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
    public async Task<PlayCardResultDto> PlayCard(string cardInstanceId, string arena)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return new PlayCardResultDto(false, "Not connected to a room", null, false);

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return new PlayCardResultDto(false, "Invalid card ID format", null, false);

        var result = await gameRoomService.PlayCardAsync(
            roomCode,
            userId,
            instanceGuid,
            arena: arena
        );

        if (result.Success && result.Card != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
            return new PlayCardResultDto(
                true,
                null,
                MapToCardInstanceDto(result.Card),
                result.WasAutoStacked
            );
        }

        return new PlayCardResultDto(false, result.ErrorMessage, null, false);
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
    /// Reorder the player's deck based on the provided card instance IDs.
    /// </summary>
    public async Task<bool> ReorderDeck(IEnumerable<string> cardInstanceIds)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return false;

        var guids = new List<Guid>();
        foreach (var id in cardInstanceIds)
        {
            if (!Guid.TryParse(id, out var guid))
                return false;
            guids.Add(guid);
        }

        var success = await gameRoomService.ReorderDeckAsync(roomCode, userId, guids);
        return success;
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

    /// <summary>
    /// Toggle face down state of a card in play.
    /// </summary>
    public async Task ToggleFaceDown(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.ToggleFaceDownAsync(roomCode, userId, instanceGuid);
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
    /// Set or update the counter on a card.
    /// </summary>
    public async Task SetCounter(string cardInstanceId, int counter)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.SetCounterAsync(roomCode, userId, instanceGuid, counter);
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
    /// Remove the counter from a card.
    /// </summary>
    public async Task RemoveCounter(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.RemoveCounterAsync(roomCode, userId, instanceGuid);
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
    /// Set or update the damage on a card (only for cards in arena).
    /// </summary>
    public async Task SetDamage(string cardInstanceId, int damage)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.SetDamageAsync(roomCode, userId, instanceGuid, damage);
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
    /// Remove the damage from a card.
    /// </summary>
    public async Task RemoveDamage(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.RemoveDamageAsync(roomCode, userId, instanceGuid);
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
    /// Play a card from hand to an arena face down.
    /// </summary>
    public async Task<PlayCardResultDto> PlayCardFaceDown(string cardInstanceId, string arena)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return new PlayCardResultDto(false, "Not connected to a room", null, false);

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return new PlayCardResultDto(false, "Invalid card ID format", null, false);

        var result = await gameRoomService.PlayCardFaceDownAsync(
            roomCode,
            userId,
            instanceGuid,
            arena: arena
        );

        if (result.Success && result.Card != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
            return new PlayCardResultDto(
                true,
                null,
                MapToCardInstanceDto(result.Card),
                result.WasAutoStacked
            );
        }

        return new PlayCardResultDto(false, result.ErrorMessage, null, false);
    }

    /// <summary>
    /// Move a card to the build zone.
    /// </summary>
    public async Task MoveToBuild(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.MoveToBuildAsync(roomCode, userId, instanceGuid);
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
    /// Toggle retreat state of an entire arena.
    /// </summary>
    public async Task ToggleArenaRetreat(string arena)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var success = await gameRoomService.ToggleArenaRetreatAsync(roomCode, userId, arena);
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
    /// Toggle retreat state of an individual card in play.
    /// </summary>
    public async Task ToggleCardRetreat(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var card = await gameRoomService.ToggleCardRetreatAsync(roomCode, userId, instanceGuid);
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
    /// Toggle whether the current player's hand is visible to opponents.
    /// </summary>
    public async Task ToggleShowHandToOpponents()
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var room = gameRoomService.GetRoom(roomCode);
        if (room == null)
            return;

        var player = room.Players.FirstOrDefault(p => p.UserId == userId);
        if (player == null)
            return;

        player.ShowHandToOpponents = !player.ShowHandToOpponents;
        await SendRoomUpdateToGroupAsync(room);
    }

    /// <summary>
    /// Move a card from build zone to play area.
    /// </summary>
    public async Task<PlayCardResultDto> MoveFromBuild(string cardInstanceId, string arena)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return new PlayCardResultDto(false, "Not connected to a room", null, false);

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return new PlayCardResultDto(false, "Invalid card ID format", null, false);

        var result = await gameRoomService.MoveFromBuildAsync(roomCode, userId, instanceGuid, arena);
        if (result.Success && result.Card != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
            return new PlayCardResultDto(
                true,
                null,
                MapToCardInstanceDto(result.Card),
                result.WasAutoStacked
            );
        }

        return new PlayCardResultDto(false, result.ErrorMessage, null, false);
    }

    /// <summary>
    /// Update the player's Build counter.
    /// </summary>
    public async Task UpdateBuildCounter(int buildCounter)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var success = await gameRoomService.UpdateBuildCounterAsync(roomCode, userId, buildCounter);
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
        var viewingPlayer = room.GetPlayer(viewingUserId);
        return new GameRoomDto(
            room.RoomCode,
            room.RoomType,
            room.State,
            room.Players.Select(p => MapToPlayerDto(p, p.UserId == viewingUserId, room.HostUserId, room, viewingPlayer)),
            room.IsTeamMode ? room.Teams.Values.Select(t => MapToTeamDto(t, room, viewingPlayer)) : null,
            room.BidsRevealed,
            room.IsRestarting
        );
    }

    private static TeamDataDto MapToTeamDto(TeamData team, Core.GameRoom.GameRoom room, GamePlayer? viewingPlayer)
    {
        // Aggregate cards from all players on this team
        var teamPlayers = room.GetPlayersOnTeam(team.Team).ToList();
        var allTeamCards = teamPlayers.SelectMany(p => p.Cards).ToList();

        var spaceArenaCards = allTeamCards.Where(c => c.Zone == Core.GameRoom.CardZone.PlayArea && c.Arena == "space").Select(MapToCardInstanceDto);
        var groundArenaCards = allTeamCards.Where(c => c.Zone == Core.GameRoom.CardZone.PlayArea && c.Arena == "ground").Select(MapToCardInstanceDto);
        var characterArenaCards = allTeamCards.Where(c => c.Zone == Core.GameRoom.CardZone.PlayArea && c.Arena == "character").Select(MapToCardInstanceDto);
        var buildZoneCards = allTeamCards.Where(c => c.Zone == Core.GameRoom.CardZone.BuildZone).Select(MapToCardInstanceDto);

        // Show bid only if revealed OR viewing user is on this team
        var canSeeBid = room.BidsRevealed || (viewingPlayer != null && viewingPlayer.Team == team.Team);
        var bidToShow = canSeeBid ? team.SecretBid : null;

        return new TeamDataDto(
            team.Team,
            team.Force,
            team.BuildCounter,
            new Dictionary<string, IEnumerable<CardInstanceDto>>
            {
                ["space"] = spaceArenaCards,
                ["ground"] = groundArenaCards,
                ["character"] = characterArenaCards,
            },
            buildZoneCards,
            team.SpaceArenaRetreated,
            team.GroundArenaRetreated,
            team.CharacterArenaRetreated,
            bidToShow
        );
    }

    private static GamePlayerDto MapToPlayerDto(GamePlayer player, bool isMe, string hostUserId, Core.GameRoom.GameRoom room, GamePlayer? viewingPlayer)
    {
        // In team mode, arenas/build/force/build counter come from team data
        // In 1v1, they come from player data
        var teamData = room.GetPlayerTeam(player.UserId);
        var isTeamMode = room.IsTeamMode;

        // For 1v1 mode, show bid only if revealed OR viewing user is this player
        int? bidToShow = null;
        if (!isTeamMode)
        {
            var canSeeBid = room.BidsRevealed || isMe;
            bidToShow = canSeeBid ? player.SecretBid : null;
        }

        // In team mode, teammates can see each other's hands
        // Also allow if player has opted to show hand to opponents
        var isTeammate = isTeamMode && viewingPlayer != null && player.Team == viewingPlayer.Team;
        var canSeeHand = isMe || isTeammate || player.ShowHandToOpponents;

        return new GamePlayerDto(
            player.DisplayName,
            player.DeckName,
            player.DeckId,
            player.EffectiveAlignment,
            player.Team,
            player.UserId == hostUserId,
            player.IsConnected,
            isTeamMode && teamData != null ? teamData.Force : player.Force,
            isTeamMode && teamData != null ? teamData.BuildCounter : player.BuildCounter,
            canSeeHand ? player.Hand.Select(MapToCardInstanceDto) : [],
            player.Hand.Count(),
            player.Deck.Count(),
            isTeamMode ? new Dictionary<string, IEnumerable<CardInstanceDto>>() :
            new Dictionary<string, IEnumerable<CardInstanceDto>>
            {
                ["space"] = player.SpaceArena.Select(MapToCardInstanceDto),
                ["ground"] = player.GroundArena.Select(MapToCardInstanceDto),
                ["character"] = player.CharacterArena.Select(MapToCardInstanceDto),
            },
            player.DiscardPile.Select(MapToCardInstanceDto),
            isTeamMode ? [] : player.BuildArea.Select(MapToCardInstanceDto),
            isTeamMode && teamData != null ? teamData.SpaceArenaRetreated : player.SpaceArenaRetreated,
            isTeamMode && teamData != null ? teamData.GroundArenaRetreated : player.GroundArenaRetreated,
            isTeamMode && teamData != null ? teamData.CharacterArenaRetreated : player.CharacterArenaRetreated,
            bidToShow,
            player.HasConfirmedRestartDeck,
            player.ShowHandToOpponents
        );
    }

    private static CardInstanceDto MapToCardInstanceDto(CardInstance card)
    {
        // Use current arena if card is in play area, otherwise use designated arena
        var arena = card.Zone == Core.GameRoom.CardZone.PlayArea ? card.Arena : card.DesignatedArena;
        
        return new CardInstanceDto(
            card.InstanceId.ToString(),
            card.CardId,
            card.CardName,
            card.ImageUrl,
            (int)card.CardType,
            arena,
            card.Version,
            card.IsTapped,
            card.IsFaceDown,
            card.IsRetreated,
            card.Counter,
            card.Damage,
            card.StackParentId?.ToString(),
            card.StackedUnderIds.Select(id => id.ToString()),
            card.OwnerUserId,
            // Piloting
            card.IsPilot,
            card.PilotCardIds.Select(id => id.ToString()),
            card.PilotingUnitId?.ToString(),
            // Equipment
            card.EquipmentCardId?.ToString(),
            card.EquippedToUnitId?.ToString()
        );
    }

    #endregion

    #region Card Stacking

    /// <summary>
    /// Stack a versioned unit card under another card of the same name but different version.
    /// </summary>
    public async Task<StackResultDto> StackCard(string cardToStackId, string targetCardId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return new StackResultDto(false, "Not connected to a room", null);
        }

        if (
            !Guid.TryParse(cardToStackId, out var cardToStackGuid)
            || !Guid.TryParse(targetCardId, out var targetCardGuid)
        )
        {
            return new StackResultDto(false, "Invalid card ID format", null);
        }

        var result = await gameRoomService.StackCardAsync(
            roomCode,
            userId,
            cardToStackGuid,
            targetCardGuid
        );

        if (result.Success && result.TopCard != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
            return new StackResultDto(true, null, MapToCardInstanceDto(result.TopCard));
        }

        return new StackResultDto(false, result.ErrorMessage, null);
    }

    /// <summary>
    /// Change which card is on top of a stack.
    /// </summary>
    public async Task<StackResultDto> SetStackTop(string currentTopCardId, string newTopCardId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return new StackResultDto(false, "Not connected to a room", null);
        }

        if (
            !Guid.TryParse(currentTopCardId, out var currentTopGuid)
            || !Guid.TryParse(newTopCardId, out var newTopGuid)
        )
        {
            return new StackResultDto(false, "Invalid card ID format", null);
        }

        var result = await gameRoomService.SetStackTopAsync(
            roomCode,
            userId,
            currentTopGuid,
            newTopGuid
        );

        if (result.Success && result.TopCard != null)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
            return new StackResultDto(true, null, MapToCardInstanceDto(result.TopCard));
        }

        return new StackResultDto(false, result.ErrorMessage, null);
    }

    /// <summary>
    /// Get cards that can be stacked with the given card.
    /// </summary>
    public Task<IEnumerable<CardInstanceDto>> GetStackableCards(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return Task.FromResult<IEnumerable<CardInstanceDto>>([]);
        }

        if (!Guid.TryParse(cardInstanceId, out var cardGuid))
        {
            return Task.FromResult<IEnumerable<CardInstanceDto>>([]);
        }

        var stackableCards = gameRoomService.GetStackableCards(roomCode, userId, cardGuid);
        return Task.FromResult(stackableCards.Select(MapToCardInstanceDto));
    }

    /// <summary>
    /// Check if a versioned card can be played independently (not must-stack).
    /// </summary>
    public Task<bool> CanPlayVersionedCard(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return Task.FromResult(false);
        }

        if (!Guid.TryParse(cardInstanceId, out var cardGuid))
        {
            return Task.FromResult(false);
        }

        return Task.FromResult(gameRoomService.CanPlayVersionedCard(roomCode, userId, cardGuid));
    }

    #endregion

    #region Piloting

    /// <summary>
    /// Add a pilot to a unit in space or ground arena.
    /// </summary>
    public async Task<PilotResultDto> AddPilot(string pilotCardId, string targetUnitId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return new PilotResultDto(false, "Not connected to a room", null, null);
        }

        if (
            !Guid.TryParse(pilotCardId, out var pilotGuid)
            || !Guid.TryParse(targetUnitId, out var unitGuid)
        )
        {
            return new PilotResultDto(false, "Invalid card ID format", null, null);
        }

        var result = await gameRoomService.AddPilotAsync(roomCode, userId, pilotGuid, unitGuid);

        if (result.Success)
        {
            // Notify all players in the room
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
            return new PilotResultDto(
                true,
                null,
                result.PilotCard != null ? MapToCardInstanceDto(result.PilotCard) : null,
                result.UnitCard != null ? MapToCardInstanceDto(result.UnitCard) : null
            );
        }

        return new PilotResultDto(false, result.ErrorMessage, null, null);
    }

    /// <summary>
    /// Remove a pilot from a unit.
    /// </summary>
    public async Task<PilotResultDto> RemovePilot(string pilotCardId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return new PilotResultDto(false, "Not connected to a room", null, null);
        }

        if (!Guid.TryParse(pilotCardId, out var pilotGuid))
        {
            return new PilotResultDto(false, "Invalid card ID format", null, null);
        }

        var result = await gameRoomService.RemovePilotAsync(roomCode, userId, pilotGuid);

        if (result.Success)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
            return new PilotResultDto(
                true,
                null,
                result.PilotCard != null ? MapToCardInstanceDto(result.PilotCard) : null,
                result.UnitCard != null ? MapToCardInstanceDto(result.UnitCard) : null
            );
        }

        return new PilotResultDto(false, result.ErrorMessage, null, null);
    }

    /// <summary>
    /// Get units that can be piloted by a given pilot card.
    /// </summary>
    public Task<IEnumerable<CardInstanceDto>> GetPilotableUnits(string pilotCardId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return Task.FromResult<IEnumerable<CardInstanceDto>>([]);
        }

        if (!Guid.TryParse(pilotCardId, out var pilotGuid))
        {
            return Task.FromResult<IEnumerable<CardInstanceDto>>([]);
        }

        var units = gameRoomService.GetPilotableUnits(roomCode, userId, pilotGuid);
        return Task.FromResult(units.Select(MapToCardInstanceDto));
    }

    #endregion

    #region Equipment

    /// <summary>
    /// Add equipment to a unit.
    /// </summary>
    public async Task<EquipmentResultDto> AddEquipment(string equipmentCardId, string targetUnitId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return new EquipmentResultDto(false, "Not connected to a room", null, null);
        }

        if (
            !Guid.TryParse(equipmentCardId, out var equipmentGuid)
            || !Guid.TryParse(targetUnitId, out var unitGuid)
        )
        {
            return new EquipmentResultDto(false, "Invalid card ID format", null, null);
        }

        var result = await gameRoomService.AddEquipmentAsync(
            roomCode,
            userId,
            equipmentGuid,
            unitGuid
        );

        if (result.Success)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
            return new EquipmentResultDto(
                true,
                null,
                result.EquipmentCard != null ? MapToCardInstanceDto(result.EquipmentCard) : null,
                result.UnitCard != null ? MapToCardInstanceDto(result.UnitCard) : null
            );
        }

        return new EquipmentResultDto(false, result.ErrorMessage, null, null);
    }

    /// <summary>
    /// Remove equipment from a unit.
    /// </summary>
    public async Task<EquipmentResultDto> RemoveEquipment(string equipmentCardId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return new EquipmentResultDto(false, "Not connected to a room", null, null);
        }

        if (!Guid.TryParse(equipmentCardId, out var equipmentGuid))
        {
            return new EquipmentResultDto(false, "Invalid card ID format", null, null);
        }

        var result = await gameRoomService.RemoveEquipmentAsync(roomCode, userId, equipmentGuid);

        if (result.Success)
        {
            var room = gameRoomService.GetRoom(roomCode);
            if (room != null)
            {
                await SendRoomUpdateToGroupAsync(room);
            }
            return new EquipmentResultDto(
                true,
                null,
                result.EquipmentCard != null ? MapToCardInstanceDto(result.EquipmentCard) : null,
                result.UnitCard != null ? MapToCardInstanceDto(result.UnitCard) : null
            );
        }

        return new EquipmentResultDto(false, result.ErrorMessage, null, null);
    }

    /// <summary>
    /// Get units that can have a given equipment card equipped.
    /// </summary>
    public Task<IEnumerable<CardInstanceDto>> GetEquippableUnits(string equipmentCardId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
        {
            return Task.FromResult<IEnumerable<CardInstanceDto>>([]);
        }

        if (!Guid.TryParse(equipmentCardId, out var equipmentGuid))
        {
            return Task.FromResult<IEnumerable<CardInstanceDto>>([]);
        }

        var units = gameRoomService.GetEquippableUnits(roomCode, userId, equipmentGuid);
        return Task.FromResult(units.Select(MapToCardInstanceDto));
    }

    #endregion

    #region Chat

    /// <summary>
    /// Send a chat message to all players in the current room.
    /// </summary>
    public async Task SendChatMessage(string message)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        var displayName = Context.User?.FindFirstValue(ClaimTypes.Email);

        if (userId == null || roomCode == null || string.IsNullOrEmpty(displayName))
        {
            return;
        }

        // Sanitize and limit message length
        message = message?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(message) || message.Length > 500)
        {
            return;
        }

        await Clients
            .Group(GetRoomGroup(roomCode))
            .SendAsync("ChatMessageReceived", displayName, message);
    }

    #endregion

    #region Game Actions

    /// <summary>
    /// Move a card from build zone back to hand.
    /// </summary>
    public async Task MoveFromBuildToHand(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var room = await gameRoomService.MoveFromBuildToHandAsync(roomCode, userId, instanceGuid);
        if (room != null)
            await SendRoomUpdateToGroupAsync(room);
    }

    /// <summary>
    /// Untap all cards in the player's (or team's) play area.
    /// </summary>
    public async Task UntapAll()
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var room = await gameRoomService.UntapAllAsync(roomCode, userId);
        if (room != null)
            await SendRoomUpdateToGroupAsync(room);
    }

    /// <summary>
    /// Put a card on the bottom of the player's deck.
    /// </summary>
    public async Task PutOnBottomOfDeck(string cardInstanceId)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        if (!Guid.TryParse(cardInstanceId, out var instanceGuid))
            return;

        var room = await gameRoomService.PutOnBottomOfDeckAsync(roomCode, userId, instanceGuid);
        if (room != null)
            await SendRoomUpdateToGroupAsync(room);
    }

    /// <summary>
    /// Discard all Battle and Mission cards from the player's (or team's) play area.
    /// </summary>
    public async Task DiscardBattleAndMissionCards()
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var room = await gameRoomService.DiscardBattleAndMissionCardsAsync(roomCode, userId);
        if (room != null)
            await SendRoomUpdateToGroupAsync(room);
    }

    /// <summary>
    /// Reset the game to Waiting state (host only).
    /// </summary>
    public async Task RestartGame()
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var room = await gameRoomService.RestartGameAsync(roomCode, userId);
        if (room != null)
            await SendRoomUpdateToGroupAsync(room);
    }

    /// <summary>
    /// Select a deck for the upcoming restarted game.
    /// </summary>
    public async Task SelectRestartDeck(int deckId, Alignment? playAsAlignment = null)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        if (userId == null || roomCode == null)
            return;

        var room = await gameRoomService.SelectRestartDeckAsync(roomCode, userId, deckId, playAsAlignment);
        if (room != null)
            await SendRoomUpdateToGroupAsync(room);
        else
            await Clients.Caller.SendAsync("Error", "Failed to select deck for restart");
    }

    #endregion

    #region Bidding

    /// <summary>
    /// Submit or update a secret bid for the current team/player.
    /// </summary>
    public async Task SubmitBid(int bid)
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();
        var displayName = Context.User?.FindFirstValue(ClaimTypes.Email);

        if (userId == null || roomCode == null || string.IsNullOrEmpty(displayName))
        {
            await Clients.Caller.SendAsync("Error", "Not in a room");
            return;
        }

        if (bid <= 0)
        {
            await Clients.Caller.SendAsync("Error", "Bid must be a positive number");
            return;
        }

        var room = gameRoomService.GetRoom(roomCode);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            await Clients.Caller.SendAsync("Error", "Player not in room");
            return;
        }

        if (room.IsTeamMode)
        {
            // Team mode: store bid in team data
            var teamData = room.GetTeam(player.Team);
            if (teamData != null)
            {
                teamData.SecretBid = bid;
            }
        }
        else
        {
            // 1v1 mode: store bid in player data
            player.SecretBid = bid;
        }

        // Notify teammates of bid update
        await BroadcastToTeammates(room, player);

        logger.LogInformation(
            "Bid submitted in room {RoomCode} by {DisplayName}: {Bid}",
            roomCode,
            displayName,
            bid
        );
    }

    /// <summary>
    /// Reveal all bids to all players (host only).
    /// </summary>
    public async Task RevealBids()
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();

        if (userId == null || roomCode == null)
        {
            await Clients.Caller.SendAsync("Error", "Not in a room");
            return;
        }

        var room = gameRoomService.GetRoom(roomCode);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        if (!room.IsHost(userId))
        {
            await Clients.Caller.SendAsync("Error", "Only the host can reveal bids");
            return;
        }

        room.BidsRevealed = true;

        // Broadcast full room state update to all players
        await SendRoomUpdateToGroupAsync(room);

        logger.LogInformation("Bids revealed in room {RoomCode} by host", roomCode);
    }

    /// <summary>
    /// Hide all bids (host only).
    /// </summary>
    public async Task HideBids()
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();

        if (userId == null || roomCode == null)
        {
            await Clients.Caller.SendAsync("Error", "Not in a room");
            return;
        }

        var room = gameRoomService.GetRoom(roomCode);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        if (!room.IsHost(userId))
        {
            await Clients.Caller.SendAsync("Error", "Only the host can hide bids");
            return;
        }

        room.BidsRevealed = false;

        // Broadcast full room state update to all players
        await SendRoomUpdateToGroupAsync(room);

        logger.LogInformation("Bids hidden in room {RoomCode} by host", roomCode);
    }

    /// <summary>
    /// Clear the current team/player bid.
    /// </summary>
    public async Task ClearBid()
    {
        var userId = Context.User?.GetAppUserId();
        var roomCode = GetCurrentRoomCode();

        if (userId == null || roomCode == null)
        {
            await Clients.Caller.SendAsync("Error", "Not in a room");
            return;
        }

        var room = gameRoomService.GetRoom(roomCode);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            await Clients.Caller.SendAsync("Error", "Player not in room");
            return;
        }

        if (room.IsTeamMode)
        {
            var teamData = room.GetTeam(player.Team);
            if (teamData != null)
            {
                teamData.SecretBid = null;
            }
        }
        else
        {
            player.SecretBid = null;
        }

        // Notify teammates of bid update
        await BroadcastToTeammates(room, player);

        logger.LogInformation("Bid cleared in room {RoomCode} by {UserId}", roomCode, userId);
    }

    private async Task BroadcastToTeammates(Core.GameRoom.GameRoom room, GamePlayer player)
    {
        if (room.IsTeamMode)
        {
            // Notify all teammates
            var teammates = room.GetPlayersOnTeam(player.Team);
            foreach (var teammate in teammates)
            {
                if (teammate.ConnectionId != null)
                {
                    var dto = MapToGameRoomDto(room, teammate.UserId);
                    await Clients.Client(teammate.ConnectionId).SendAsync("RoomUpdated", dto);
                }
            }
        }
        else
        {
            // 1v1: just notify the player
            if (player.ConnectionId != null)
            {
                var dto = MapToGameRoomDto(room, player.UserId);
                await Clients.Client(player.ConnectionId).SendAsync("RoomUpdated", dto);
            }
        }
    }

    #endregion
}
