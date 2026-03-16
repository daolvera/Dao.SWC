using System.Collections.Concurrent;
using System.Security.Claims;
using Dao.SWC.ApiService.Extensions;
using Dao.SWC.Core.Enums;
using Dao.SWC.Core.GameRoom;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Dao.SWC.ApiService.Hubs;

[Authorize]
public class GameHub(IGameRoomService gameRoomService, ILogger<GameHub> logger) : Hub
{
    private const string RoomPrefix = "room_";

    // Track which room each connection is in
    private static readonly ConcurrentDictionary<string, string> ConnectionRooms = new();

    public override async Task OnConnectedAsync()
    {
        logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.GetAppUserId();
        if (userId != null)
        {
            ConnectionRooms.TryRemove(Context.ConnectionId, out _);
            logger.LogInformation(
                "Client disconnected: {ConnectionId}, User: {UserId}",
                Context.ConnectionId,
                userId
            );
        }
        await base.OnDisconnectedAsync(exception);
    }

    private string? GetCurrentRoomCode() =>
        ConnectionRooms.TryGetValue(Context.ConnectionId, out var roomCode) ? roomCode : null;

    /// <summary>
    /// Create a new game room. Returns room code on success.
    /// </summary>
    /// <param name="playAsAlignment">Required for neutral decks - specifies playing as Light or Dark</param>
    public async Task<string?> CreateRoom(
        RoomType roomType,
        int deckId,
        Alignment? playAsAlignment = null
    )
    {
        var userId = Context.User?.GetAppUserId();
        string displayName = Context.User?.FindFirstValue(ClaimTypes.Email)!;

        if (userId == null)
        {
            logger.LogWarning(
                "CreateRoom failed: User not authenticated. ConnectionId: {ConnectionId}, Claims: {Claims}",
                Context.ConnectionId,
                string.Join(", ", Context.User?.Claims.Select(c => $"{c.Type}={c.Value}") ?? [])
            );
            await Clients.Caller.SendAsync("Error", "Not authenticated");
            return null;
        }

        var room = await gameRoomService.CreateRoomAsync(
            userId,
            displayName,
            roomType,
            deckId,
            playAsAlignment
        );

        // Update connection ID for the host
        gameRoomService.UpdatePlayerConnection(room.RoomCode, userId, Context.ConnectionId);
        ConnectionRooms[Context.ConnectionId] = room.RoomCode;

        // Add to SignalR group
        await Groups.AddToGroupAsync(Context.ConnectionId, GetRoomGroup(room.RoomCode));

        logger.LogInformation("Room created: {RoomCode} by {UserId}", room.RoomCode, userId);

        // Send room state to creator
        await SendRoomUpdateAsync(room);

        return room.RoomCode;
    }

    /// <summary>
    /// Join an existing room.
    /// </summary>
    /// <param name="playAsAlignment">Required for neutral decks - specifies playing as Light or Dark</param>
    public async Task<GameRoomDto?> JoinRoom(
        string roomCode,
        int deckId,
        Alignment? playAsAlignment = null
    )
    {
        var userId = Context.User?.GetAppUserId();
        string displayName = Context.User?.FindFirstValue(ClaimTypes.Email)!;

        if (userId == null)
        {
            await Clients.Caller.SendAsync("Error", "Not authenticated");
            return null;
        }

        var result = await gameRoomService.JoinRoomAsync(
            roomCode,
            userId,
            displayName,
            deckId,
            playAsAlignment
        );

        if (!result.Success)
        {
            await Clients.Caller.SendAsync("Error", result.Error ?? "Could not join room");
            return null;
        }

        var room = result.Room!;

        // Update connection ID
        gameRoomService.UpdatePlayerConnection(roomCode, userId, Context.ConnectionId);
        ConnectionRooms[Context.ConnectionId] = roomCode;

        // Add to SignalR group
        await Groups.AddToGroupAsync(Context.ConnectionId, GetRoomGroup(roomCode));

        logger.LogInformation("Player {UserId} joined room {RoomCode}", userId, roomCode);

        // Notify all players of updated state
        await SendRoomUpdateToGroupAsync(room);

        return MapToGameRoomDto(room, userId);
    }

    /// <summary>
    /// Reconnect to a room after disconnection.
    /// </summary>
    public async Task<GameRoomDto?> Reconnect(string roomCode)
    {
        var userId = Context.User?.GetAppUserId();

        if (userId == null)
        {
            await Clients.Caller.SendAsync("Error", "Not authenticated");
            return null;
        }

        var room = await gameRoomService.ReconnectAsync(roomCode, userId, Context.ConnectionId);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Could not reconnect to room");
            return null;
        }

        ConnectionRooms[Context.ConnectionId] = roomCode;

        // Rejoin SignalR group
        await Groups.AddToGroupAsync(Context.ConnectionId, GetRoomGroup(roomCode));

        logger.LogInformation("Player {UserId} reconnected to room {RoomCode}", userId, roomCode);

        // Notify all players
        await SendRoomUpdateToGroupAsync(room);

        return MapToGameRoomDto(room, userId);
    }

    /// <summary>
    /// Leave the current room.
    /// </summary>
    public async Task LeaveRoom(string? roomCode = null)
    {
        var userId = Context.User?.GetAppUserId();
        roomCode ??= GetCurrentRoomCode();

        if (userId == null || roomCode == null)
            return;

        var success = await gameRoomService.LeaveRoomAsync(roomCode, userId);
        if (success)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetRoomGroup(roomCode));
            ConnectionRooms.TryRemove(Context.ConnectionId, out _);

            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }

            logger.LogInformation("Player {UserId} left room {RoomCode}", userId, roomCode);
        }
    }

    /// <summary>
    /// Kick a player from the room (host only).
    /// </summary>
    public async Task KickPlayer(string username)
    {
        var hostUserId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (hostUserId == null || roomCode == null)
            return;

        var room = gameRoomService.GetRoom(roomCode);
        var targetPlayer = room?.Players.FirstOrDefault(p =>
            p.DisplayName.Equals(username, StringComparison.OrdinalIgnoreCase)
        );

        if (targetPlayer == null)
            return;

        var success = await gameRoomService.KickPlayerAsync(roomCode, hostUserId, username);
        if (success)
        {
            // Notify the kicked player
            if (targetPlayer.ConnectionId != null)
            {
                await Clients
                    .Client(targetPlayer.ConnectionId)
                    .SendAsync("Kicked", "You have been kicked from the room");
                await Groups.RemoveFromGroupAsync(
                    targetPlayer.ConnectionId,
                    GetRoomGroup(roomCode)
                );
            }

            // Send updated room state
            room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }

            logger.LogInformation(
                "Player {Username} kicked from room {RoomCode}",
                username,
                roomCode
            );
        }
    }

    /// <summary>
    /// Start the game (host only).
    /// </summary>
    public async Task StartGame()
    {
        var hostUserId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (hostUserId == null || roomCode == null)
            return;

        var success = await gameRoomService.StartGameAsync(roomCode, hostUserId);
        if (success)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
                logger.LogInformation("Game started in room {RoomCode}", roomCode);
            }
        }
        else
        {
            await Clients.Caller.SendAsync("Error", "Could not start game");
        }
    }

    /// <summary>
    /// Draw cards from deck.
    /// </summary>
    public async Task DrawCards(int count = 1)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var cards = await gameRoomService.DrawCardsAsync(roomCode, userId, count);

        var room = gameRoomService.GetRoom(roomCode);
        if (room != null)
        {
            await SendRoomUpdateToGroupAsync(room);
        }
    }

    /// <summary>
    /// Play a card from hand to an arena.
    /// </summary>
    public async Task PlayCard(string cardInstanceId, string arena)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.PlayCardAsync(
            roomCode,
            userId,
            instanceGuid,
            arena: arena
        );
        if (card != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
        }
    }

    /// <summary>
    /// Discard a card.
    /// </summary>
    public async Task DiscardCard(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.DiscardCardAsync(roomCode, userId, instanceGuid);
        if (card != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
        }
    }

    /// <summary>
    /// Return a card to hand (from play area or discard).
    /// </summary>
    public async Task ReturnToHand(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.ReturnToHandAsync(roomCode, userId, instanceGuid);
        if (card != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
        }
    }

    /// <summary>
    /// Toggle tap/untap state of a card in play.
    /// </summary>
    public async Task ToggleTap(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.ToggleTapAsync(roomCode, userId, instanceGuid);
        if (card != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
        }
    }

    /// <summary>
    /// Shuffle the player's deck.
    /// </summary>
    public async Task ShuffleDeck()
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var success = await gameRoomService.ShuffleDeckAsync(roomCode, userId);
        if (success)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
        }
    }

    /// <summary>
    /// Roll dice.
    /// </summary>
    public async Task RollDice(int numberOfDice)
    {
        var userId = Context.User?.GetAppUserId();
        string displayName = Context.User?.FindFirstValue(ClaimTypes.Email)!;
        var roomCode = GetCurrentRoomCode();

        if (userId == null || roomCode == null)
            return;

        // Clamp dice count
        numberOfDice = Math.Clamp(numberOfDice, 1, 20);

        var result = await gameRoomService.RollDiceAsync(
            roomCode,
            userId,
            displayName,
            numberOfDice
        );

        // Broadcast to all players
        await Clients
            .Group(GetRoomGroup(roomCode))
            .SendAsync("DiceRolled", new DiceRolledEvent(displayName, result.Results));
    }

    /// <summary>
    /// View all cards in the player's deck for browsing.
    /// </summary>
    public async Task<IEnumerable<CardInstanceDto>> ViewDeck()
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return [];

        var deckCards = gameRoomService.GetDeckCards(roomCode, userId);
        return await Task.FromResult(deckCards.Select(MapToCardInstanceDto));
    }

    /// <summary>
    /// Take a specific card from deck to hand.
    /// </summary>
    public async Task TakeFromDeck(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.TakeFromDeckAsync(roomCode, userId, instanceGuid);
        if (card != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
        }
    }

    /// <summary>
    /// Update the player's Force counter.
    /// </summary>
    public async Task UpdateForce(int force)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var success = await gameRoomService.UpdateForceAsync(roomCode, userId, force);
        if (success)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
        }
    }

    #region Helpers

    private static string GetRoomGroup(string roomCode) =>
        $"{RoomPrefix}{roomCode.ToUpperInvariant()}";

    private async Task SendRoomUpdateAsync(Core.GameRoom.GameRoom room)
    {
        var userId = Context.User?.GetAppUserId()!;
        var dto = MapToGameRoomDto(room, userId);
        await Clients.Caller.SendAsync("RoomUpdated", dto);
    }

    private async Task SendRoomUpdateToGroupAsync(Core.GameRoom.GameRoom room)
    {
        // Send personalized updates to each player (each sees their own hand)
        foreach (var player in room.Players)
        {
            if (player.ConnectionId != null)
            {
                var dto = MapToGameRoomDto(room, player.UserId);
                await Clients.Client(player.ConnectionId).SendAsync("RoomUpdated", dto);
            }
        }
    }

    private static GameRoomDto MapToGameRoomDto(Core.GameRoom.GameRoom room, string viewingUserId)
    {
        return new GameRoomDto(
            room.RoomCode,
            room.RoomType,
            room.State,
            room.Players.Select(p => MapToPlayerDto(p, p.UserId == viewingUserId, room.HostUserId))
        );
    }

    private static GamePlayerDto MapToPlayerDto(GamePlayer player, bool isMe, string hostUserId)
    {
        return new GamePlayerDto(
            player.DisplayName,
            player.DeckName,
            player.EffectiveAlignment,
            player.UserId == hostUserId,
            player.IsConnected,
            player.Force,
            isMe ? player.Hand.Select(MapToCardInstanceDto) : [],
            player.Deck.Count(),
            new Dictionary<string, IEnumerable<CardInstanceDto>>
            {
                ["space"] = player.SpaceArena.Select(MapToCardInstanceDto),
                ["ground"] = player.GroundArena.Select(MapToCardInstanceDto),
                ["character"] = player.CharacterArena.Select(MapToCardInstanceDto),
            },
            player.DiscardPile.Select(MapToCardInstanceDto)
        );
    }

    private static CardInstanceDto MapToCardInstanceDto(CardInstance card)
    {
        return new CardInstanceDto(
            card.InstanceId.ToString(),
            card.CardId,
            card.CardName,
            card.ImageUrl,
            (int)card.CardType,
            card.IsTapped
        );
    }

    #endregion
}
