using System.Collections.Concurrent;
using Dao.SWC.Core.CardImport;
using Dao.SWC.Core.Enums;
using Dao.SWC.Core.GameRoom;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.GameRoom;

public class GameRoomService : IGameRoomService
{
    private readonly ConcurrentDictionary<string, Core.GameRoom.GameRoom> _rooms;
    private readonly SwcDbContext _dbContext;
    private readonly ICardImageService _imageService;
    private static readonly Random _random = new();

    public GameRoomService(
        SwcDbContext dbContext,
        IGameRoomStorage storage,
        ICardImageService imageService
    )
    {
        _dbContext = dbContext;
        _rooms = storage.Rooms;
        _imageService = imageService;
    }

    public async Task<Core.GameRoom.GameRoom> CreateRoomAsync(
        string hostUserId,
        string hostDisplayName,
        RoomType roomType,
        int deckId,
        Alignment? playAsAlignment = null
    )
    {
        var roomCode = GenerateRoomCode();

        // Ensure unique room code
        while (_rooms.ContainsKey(roomCode))
        {
            roomCode = GenerateRoomCode();
        }

        // Fetch deck alignment
        var deck = await _dbContext.Decks.AsNoTracking().FirstOrDefaultAsync(d => d.Id == deckId);

        Alignment deckAlignment = (Alignment)(deck?.Alignment ?? Alignment.Neutral);

        var room = new Core.GameRoom.GameRoom
        {
            RoomCode = roomCode,
            RoomType = roomType,
            HostUserId = hostUserId,
            State = GameState.Waiting,
            CreatedAt = DateTime.UtcNow,
        };

        var hostPlayer = new GamePlayer
        {
            UserId = hostUserId,
            DisplayName = hostDisplayName,
            DeckId = deckId,
            Team = Team.Team1,
            IsConnected = true,
            DeckAlignment = deckAlignment,
            PlayAsAlignment = playAsAlignment,
        };

        room.Players.Add(hostPlayer);
        _rooms[roomCode] = room;

        return room;
    }

    public async Task<JoinRoomResult> JoinRoomAsync(
        string roomCode,
        string userId,
        string displayName,
        int deckId,
        Alignment? playAsAlignment = null
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return JoinRoomResult.Failed("Room not found");
        }

        if (room.State != GameState.Waiting)
        {
            return JoinRoomResult.Failed("Game already started");
        }

        if (room.IsFull)
        {
            return JoinRoomResult.Failed("Room is full");
        }

        // Fetch deck alignment
        var deck = await _dbContext.Decks.AsNoTracking().FirstOrDefaultAsync(d => d.Id == deckId);

        if (deck == null)
        {
            return JoinRoomResult.Failed("Deck not found");
        }

        var deckAlignment = deck.Alignment;
        Alignment effectiveAlignment =
            deckAlignment == Alignment.Neutral && playAsAlignment.HasValue
                ? playAsAlignment.Value
                : deckAlignment;

        // Validate alignment based on room type and existing players
        var validationError = ValidateJoinAlignment(room, effectiveAlignment);
        if (validationError != null)
        {
            return JoinRoomResult.Failed(validationError);
        }

        // Check if already in room
        var existingPlayer = room.GetPlayer(userId);
        if (existingPlayer != null)
        {
            existingPlayer.IsConnected = true;
            existingPlayer.DeckId = deckId;
            existingPlayer.DeckAlignment = deckAlignment;
            existingPlayer.PlayAsAlignment = playAsAlignment;
            return JoinRoomResult.Succeeded(room);
        }

        // Auto-assign team based on room type and current players
        var team = DetermineTeam(room);

        var player = new GamePlayer
        {
            UserId = userId,
            DisplayName = displayName,
            DeckId = deckId,
            Team = team,
            IsConnected = true,
            DeckAlignment = deckAlignment,
            PlayAsAlignment = playAsAlignment,
        };

        room.Players.Add(player);
        return JoinRoomResult.Succeeded(room);
    }

    /// <summary>
    /// Validates that a player can join the room with the given effective alignment.
    /// </summary>
    /// <returns>Error message if invalid, null if valid</returns>
    private static string? ValidateJoinAlignment(
        Core.GameRoom.GameRoom room,
        Alignment joinerAlignment
    )
    {
        // Get the host's effective alignment
        var host = room.Players.FirstOrDefault(p => p.UserId == room.HostUserId);
        if (host == null)
        {
            return null; // Should not happen
        }

        var hostAlignment = host.EffectiveAlignment;

        // For 1v1: The joiner must be the opposite side
        if (room.RoomType == RoomType.OneVsOne)
        {
            if (hostAlignment == Alignment.Light && joinerAlignment != Alignment.Dark)
            {
                return "In 1v1 games, you must play the opposite side. The host is playing Light, so you must use a Dark side deck (or a neutral deck playing as Dark).";
            }
            if (hostAlignment == Alignment.Dark && joinerAlignment != Alignment.Light)
            {
                return "In 1v1 games, you must play the opposite side. The host is playing Dark, so you must use a Light side deck (or a neutral deck playing as Light).";
            }
            return null;
        }

        // For 2v2 and 1v2: Check if the side is already full
        if (room.RoomType == RoomType.TwoVsTwo || room.RoomType == RoomType.OneVsTwo)
        {
            var maxPerSide = room.RoomType == RoomType.TwoVsTwo ? 2 : 2;

            var lightCount = room.Players.Count(p => p.EffectiveAlignment == Alignment.Light);
            var darkCount = room.Players.Count(p => p.EffectiveAlignment == Alignment.Dark);

            if (joinerAlignment == Alignment.Light && lightCount >= maxPerSide)
            {
                return $"Cannot join as Light side. {lightCount} player(s) are already playing Light side (max {maxPerSide}).";
            }
            if (joinerAlignment == Alignment.Dark && darkCount >= maxPerSide)
            {
                return $"Cannot join as Dark side. {darkCount} player(s) are already playing Dark side (max {maxPerSide}).";
            }
            return null;
        }

        throw new InvalidOperationException("Game room type not detected");
    }

    public Task<bool> LeaveRoomAsync(string roomCode, string userId)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(false);
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult(false);
        }

        // If game in progress, just mark as disconnected
        if (room.State == GameState.InProgress)
        {
            player.IsConnected = false;
            return Task.FromResult(true);
        }

        // Remove from waiting room
        room.Players.Remove(player);

        // If host left and room is waiting, assign new host or delete room
        if (room.HostUserId == userId && room.State == GameState.Waiting)
        {
            if (room.Players.Count > 0)
            {
                room.HostUserId = room.Players[0].UserId;
            }
            else
            {
                _rooms.TryRemove(roomCode.ToUpperInvariant(), out _);
            }
        }

        return Task.FromResult(true);
    }

    public Task<bool> KickPlayerAsync(string roomCode, string hostUserId, string targetUsername)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(false);
        }

        if (!room.IsHost(hostUserId))
        {
            return Task.FromResult(false);
        }

        var player = room.Players.FirstOrDefault(p =>
            p.DisplayName.Equals(targetUsername, StringComparison.OrdinalIgnoreCase)
        );

        if (player == null || player.UserId == hostUserId)
        {
            return Task.FromResult(false);
        }

        room.Players.Remove(player);
        return Task.FromResult(true);
    }

    public Core.GameRoom.GameRoom? GetRoom(string roomCode)
    {
        _rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room);
        return room;
    }

    public async Task<bool> StartGameAsync(string roomCode, string hostUserId)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return false;
        }

        if (!room.IsHost(hostUserId))
        {
            return false;
        }

        if (room.State != GameState.Waiting)
        {
            return false;
        }

        // Need at least 2 players
        if (room.Players.Count < 2)
        {
            return false;
        }

        // Load cards for each player's deck
        foreach (var player in room.Players)
        {
            await LoadPlayerDeckAsync(player);
        }

        // Shuffle each player's deck
        foreach (var player in room.Players)
        {
            ShuffleDeck(player);
        }

        // Set up turn order (alternate teams)
        room.TurnOrder = room
            .Players.OrderBy(p => p.Team)
            .ThenBy(_ => _random.Next())
            .Select(p => p.UserId)
            .ToList();

        room.CurrentTurnUserId = room.TurnOrder[0];
        room.State = GameState.InProgress;
        room.StartedAt = DateTime.UtcNow;
        room.TurnNumber = 1;

        return true;
    }

    public Task<IEnumerable<CardInstance>> DrawCardsAsync(string roomCode, string userId, int count)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(Enumerable.Empty<CardInstance>());
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult(Enumerable.Empty<CardInstance>());
        }

        var deckCards = player.Cards.Where(c => c.Zone == CardZone.Deck).ToList();
        var cardsToDrawCount = Math.Min(count, deckCards.Count);
        var drawnCards = deckCards.Take(cardsToDrawCount).ToList();

        foreach (var card in drawnCards)
        {
            card.Zone = CardZone.Hand;
        }

        return Task.FromResult(drawnCards.AsEnumerable());
    }

    public Task<CardInstance?> PlayCardAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        int? zonePosition = null,
        string? arena = null
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId && c.Zone == CardZone.Hand
        );
        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        card.Zone = CardZone.PlayArea;
        card.ZonePosition = zonePosition ?? player.PlayArea.Count();
        card.Arena = arena?.ToLowerInvariant();

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<CardInstance?> DiscardCardAsync(string roomCode, string userId, Guid cardInstanceId)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId
            && (c.Zone == CardZone.Hand || c.Zone == CardZone.PlayArea)
        );

        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        card.Zone = CardZone.Discard;
        card.ZonePosition = null;

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<CardInstance?> ReturnToHandAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId
            && (c.Zone == CardZone.PlayArea || c.Zone == CardZone.Discard)
        );

        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        card.Zone = CardZone.Hand;
        card.ZonePosition = null;
        card.Arena = null;
        card.IsTapped = false;

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<CardInstance?> ToggleTapAsync(string roomCode, string userId, Guid cardInstanceId)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId && c.Zone == CardZone.PlayArea
        );

        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        card.IsTapped = !card.IsTapped;

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<bool> ShuffleDeckAsync(string roomCode, string userId)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(false);
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult(false);
        }

        ShuffleDeck(player);
        return Task.FromResult(true);
    }

    public Task<DiceRollResult> RollDiceAsync(
        string roomCode,
        string userId,
        string displayName,
        int numberOfDice
    )
    {
        var results = new int[numberOfDice];
        for (int i = 0; i < numberOfDice; i++)
        {
            results[i] = _random.Next(1, 7); // d6
        }

        var rollResult = new DiceRollResult(
            userId,
            displayName,
            results,
            results.Sum(),
            DateTime.UtcNow
        );

        if (_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            room.DiceRolls.Add(rollResult);
        }

        return Task.FromResult(rollResult);
    }

    public Task<string?> EndTurnAsync(string roomCode, string userId)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult<string?>(null);
        }

        if (room.CurrentTurnUserId != userId)
        {
            return Task.FromResult<string?>(null);
        }

        var currentIndex = room.TurnOrder.IndexOf(userId);
        var nextIndex = (currentIndex + 1) % room.TurnOrder.Count;
        room.CurrentTurnUserId = room.TurnOrder[nextIndex];

        return Task.FromResult<string?>(room.CurrentTurnUserId);
    }

    public Task<Core.GameRoom.GameRoom?> ReconnectAsync(
        string roomCode,
        string userId,
        string connectionId
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult<Core.GameRoom.GameRoom?>(null);
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult<Core.GameRoom.GameRoom?>(null);
        }

        player.IsConnected = true;
        player.ConnectionId = connectionId;

        return Task.FromResult<Core.GameRoom.GameRoom?>(room);
    }

    public void UpdatePlayerConnection(string roomCode, string userId, string? connectionId)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return;
        }

        var player = room.GetPlayer(userId);
        if (player != null)
        {
            player.ConnectionId = connectionId;
            player.IsConnected = connectionId != null;
        }
    }

    public IEnumerable<CardInstance> GetDeckCards(string roomCode, string userId)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return [];
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return [];
        }

        return player.Deck.ToList();
    }

    public Task<CardInstance?> TakeFromDeckAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId && c.Zone == CardZone.Deck
        );

        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        // Move card from deck to hand
        card.Zone = CardZone.Hand;
        card.ZonePosition = null;

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<bool> UpdateForceAsync(string roomCode, string userId, int force)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(false);
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult(false);
        }

        // Clamp force to reasonable bounds (0 to 99)
        player.Force = Math.Clamp(force, 0, 99);
        return Task.FromResult(true);
    }

    #region Private Helpers

    private static string GenerateRoomCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars
        var code = new char[6];
        for (int i = 0; i < 6; i++)
        {
            code[i] = chars[_random.Next(chars.Length)];
        }
        return new string(code);
    }

    private static Team DetermineTeam(Core.GameRoom.GameRoom room)
    {
        var team1Count = room.Players.Count(p => p.Team == Team.Team1);
        var team2Count = room.Players.Count(p => p.Team == Team.Team2);

        // Balance teams
        return team1Count <= team2Count ? Team.Team1 : Team.Team2;
    }

    private async Task LoadPlayerDeckAsync(GamePlayer player)
    {
        // Get deck name
        var deck = await _dbContext
            .Decks.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == player.DeckId);

        if (deck != null)
        {
            player.DeckName = deck.Name;
        }

        var deckCards = await _dbContext
            .DeckCards.Where(dc => dc.DeckId == player.DeckId)
            .Include(dc => dc.Card)
            .ToListAsync();

        foreach (var deckCard in deckCards)
        {
            if (deckCard.Card == null)
                continue;

            // Generate SAS token URL for the card image
            var imageUrl = string.IsNullOrEmpty(deckCard.Card.ImageUrl)
                ? deckCard.Card.ImageUrl
                : await _imageService.GenerateReadUrlAsync(deckCard.Card.ImageUrl);

            // Create card instances based on quantity
            for (int i = 0; i < deckCard.Quantity; i++)
            {
                player.Cards.Add(
                    new CardInstance
                    {
                        CardId = deckCard.CardId,
                        CardName = deckCard.Card.Name,
                        ImageUrl = imageUrl,
                        CardType = deckCard.Card.Type,
                        Zone = CardZone.Deck,
                    }
                );
            }
        }
    }

    private static void ShuffleDeck(GamePlayer player)
    {
        var deckCards = player.Cards.Where(c => c.Zone == CardZone.Deck).ToList();

        // Fisher-Yates shuffle
        for (int i = deckCards.Count - 1; i > 0; i--)
        {
            int j = _random.Next(i + 1);
            (deckCards[i], deckCards[j]) = (deckCards[j], deckCards[i]);
        }

        // Reorder in the player's card list
        var nonDeckCards = player.Cards.Where(c => c.Zone != CardZone.Deck).ToList();
        player.Cards.Clear();
        player.Cards.AddRange(deckCards);
        player.Cards.AddRange(nonDeckCards);
    }

    #endregion
}
