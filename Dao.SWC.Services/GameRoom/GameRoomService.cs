using Dao.SWC.Core.CardImport;
using Dao.SWC.Core.Enums;
using Dao.SWC.Core.GameRoom;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

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

        // Set build counter based on room type (30 for 1v1, 60 otherwise)
        if (room.RoomType == RoomType.OneVsOne)
        {
            foreach (var player in room.Players)
            {
                player.BuildCounter = 30;
            }
        }

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

    public Task<PlayCardResult> PlayCardAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        int? zonePosition = null,
        string? arena = null
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(PlayCardResult.Fail("Room not found"));
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult(PlayCardResult.Fail("Player not found"));
        }

        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId && c.Zone == CardZone.Hand
        );
        if (card == null)
        {
            return Task.FromResult(PlayCardResult.Fail("Card not found in hand"));
        }

        var targetArena = arena?.ToLowerInvariant();

        // Validate arena for unit cards
        if (card.CardType == CardType.Unit && !string.IsNullOrEmpty(targetArena))
        {
            var designatedArena = card.DesignatedArena?.ToLowerInvariant();
            if (!string.IsNullOrEmpty(designatedArena) && designatedArena != targetArena)
            {
                return Task.FromResult(
                    PlayCardResult.Fail($"{card.CardName} can only be played in {card.DesignatedArena} arena")
                );
            }
        }

        // For versioned unit cards, check if we need to auto-stack
        if (
            card.CardType == CardType.Unit
            && !string.IsNullOrEmpty(card.Version)
            && !string.IsNullOrEmpty(targetArena)
        )
        {
            // Check if there's a version conflict in a different arena
            var conflict = CheckVersionConflict(roomCode, userId, cardInstanceId, targetArena);
            if (conflict != null)
            {
                return Task.FromResult(
                    PlayCardResult.Fail(
                        $"Cannot play {card.CardName} ({card.Version}) - version {conflict.ConflictingVersion} is already in {conflict.ConflictingArena} arena"
                    )
                );
            }

            // Check if we should auto-stack in the target arena
            var stackTarget = FindStackTargetInArena(roomCode, userId, cardInstanceId, targetArena);
            if (stackTarget != null)
            {
                // Auto-stack: place card under the existing version
                card.Zone = CardZone.PlayArea;
                card.Arena = targetArena;
                card.StackParentId = stackTarget.InstanceId;
                stackTarget.StackedUnderIds.Add(card.InstanceId);
                return Task.FromResult(PlayCardResult.Ok(stackTarget, wasAutoStacked: true));
            }

            // Check if another version exists (in same arena but not found as target - shouldn't happen, but safety check)
            if (!CanPlayVersionedCard(roomCode, userId, cardInstanceId))
            {
                return Task.FromResult(
                    PlayCardResult.Fail($"Cannot play {card.CardName} ({card.Version}) - same version already in play")
                );
            }
        }

        card.Zone = CardZone.PlayArea;
        card.ZonePosition = zonePosition ?? player.PlayArea.Count();
        card.Arena = targetArena;
        card.IsFaceDown = false; // Cards in arenas are always face up

        return Task.FromResult(PlayCardResult.Ok(card));
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

        // Handle stack removal - discard entire stack together
        if (card.IsStackTop && card.StackedUnderIds.Count > 0)
        {
            // Discard ALL stacked cards together
            foreach (var stackedId in card.StackedUnderIds)
            {
                var stackedCard = player.Cards.FirstOrDefault(c => c.InstanceId == stackedId);
                if (stackedCard != null)
                {
                    stackedCard.Zone = CardZone.Discard;
                    stackedCard.ZonePosition = null;
                    stackedCard.IsTapped = false;
                    stackedCard.IsFaceDown = false;
                    stackedCard.Counter = null;
                    stackedCard.StackParentId = null;
                    stackedCard.StackedUnderIds.Clear();
                    stackedCard.Arena = null;
                }
            }
        }
        else if (card.IsStackedUnder)
        {
            // Remove from parent's stacked list
            var parent = player.Cards.FirstOrDefault(c => c.InstanceId == card.StackParentId);
            if (parent != null)
            {
                parent.StackedUnderIds.Remove(card.InstanceId);
            }
        }

        // Clear stack state for the main card
        card.StackParentId = null;
        card.StackedUnderIds.Clear();

        card.Zone = CardZone.Discard;
        card.ZonePosition = null;
        card.IsTapped = false;
        card.IsFaceDown = false;
        card.Counter = null;

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

        // If this card is a stack top, unstack all cards under it and return them to hand too
        if (card.StackedUnderIds.Count > 0)
        {
            foreach (var stackedId in card.StackedUnderIds.ToList())
            {
                var stackedCard = player.Cards.FirstOrDefault(c => c.InstanceId == stackedId);
                if (stackedCard != null)
                {
                    stackedCard.Zone = CardZone.Hand;
                    stackedCard.ZonePosition = null;
                    stackedCard.Arena = null;
                    stackedCard.IsTapped = false;
                    stackedCard.IsFaceDown = false;
                    stackedCard.Counter = null;
                    stackedCard.StackParentId = null;
                    stackedCard.StackedUnderIds.Clear();
                }
            }
            card.StackedUnderIds.Clear();
        }

        // If this card is stacked under another, remove it from parent's stack
        if (card.StackParentId != null)
        {
            var parent = player.Cards.FirstOrDefault(c => c.InstanceId == card.StackParentId);
            if (parent != null)
            {
                parent.StackedUnderIds.Remove(card.InstanceId);
            }
            card.StackParentId = null;
        }

        card.Zone = CardZone.Hand;
        card.ZonePosition = null;
        card.Arena = null;
        card.IsTapped = false;
        card.IsFaceDown = false;
        card.Counter = null;

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

    public Task<CardInstance?> ToggleFaceDownAsync(
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
            c.InstanceId == cardInstanceId && c.Zone == CardZone.PlayArea
        );

        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        card.IsFaceDown = !card.IsFaceDown;

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<CardInstance?> SetCounterAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        int counter
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
            && (c.Zone == CardZone.PlayArea || c.Zone == CardZone.BuildZone)
        );

        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        // Clamp counter to reasonable bounds
        card.Counter = Math.Clamp(counter, 0, 999);

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<CardInstance?> RemoveCounterAsync(
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
            && (c.Zone == CardZone.PlayArea || c.Zone == CardZone.BuildZone)
        );

        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        card.Counter = null;

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<CardInstance?> SetDamageAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        int damage
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

        // Damage can only be set on cards in the PlayArea (arena)
        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId
            && c.Zone == CardZone.PlayArea
        );

        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        // Clamp damage to reasonable bounds (0-999)
        card.Damage = Math.Clamp(damage, 0, 999);

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<CardInstance?> RemoveDamageAsync(
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

        // Damage can only be removed from cards in the PlayArea (arena)
        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId
            && c.Zone == CardZone.PlayArea
        );

        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        card.Damage = null;

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<PlayCardResult> PlayCardFaceDownAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        int? zonePosition = null,
        string? arena = null
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(PlayCardResult.Fail("Room not found"));
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult(PlayCardResult.Fail("Player not found"));
        }

        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId && c.Zone == CardZone.Hand
        );
        if (card == null)
        {
            return Task.FromResult(PlayCardResult.Fail("Card not found in hand"));
        }

        var targetArena = arena?.ToLowerInvariant();

        // Validate arena for unit cards (even when playing face-down)
        if (card.CardType == CardType.Unit && !string.IsNullOrEmpty(targetArena))
        {
            var designatedArena = card.DesignatedArena?.ToLowerInvariant();
            if (!string.IsNullOrEmpty(designatedArena) && designatedArena != targetArena)
            {
                return Task.FromResult(
                    PlayCardResult.Fail($"{card.CardName} can only be played in {card.DesignatedArena} arena")
                );
            }
        }

        // For versioned unit cards, check for version conflicts
        if (
            card.CardType == CardType.Unit
            && !string.IsNullOrEmpty(card.Version)
            && !string.IsNullOrEmpty(targetArena)
        )
        {
            // Check if there's a version conflict in a different arena
            var conflict = CheckVersionConflict(roomCode, userId, cardInstanceId, targetArena);
            if (conflict != null)
            {
                return Task.FromResult(
                    PlayCardResult.Fail(
                        $"Cannot play {card.CardName} ({card.Version}) - version {conflict.ConflictingVersion} is already in {conflict.ConflictingArena} arena"
                    )
                );
            }

            // Check if we should auto-stack in the target arena
            var stackTarget = FindStackTargetInArena(roomCode, userId, cardInstanceId, targetArena);
            if (stackTarget != null)
            {
                // Auto-stack: place card under the existing version (but still face-down)
                card.Zone = CardZone.PlayArea;
                card.Arena = targetArena;
                card.IsFaceDown = true;
                card.StackParentId = stackTarget.InstanceId;
                stackTarget.StackedUnderIds.Add(card.InstanceId);
                return Task.FromResult(PlayCardResult.Ok(stackTarget, wasAutoStacked: true));
            }

            // Check if another version exists
            if (!CanPlayVersionedCard(roomCode, userId, cardInstanceId))
            {
                return Task.FromResult(
                    PlayCardResult.Fail($"Cannot play {card.CardName} ({card.Version}) - same version already in play")
                );
            }
        }

        card.Zone = CardZone.PlayArea;
        card.ZonePosition = zonePosition ?? player.PlayArea.Count();
        card.Arena = targetArena;
        card.IsFaceDown = false; // Cards in arenas are always face up

        return Task.FromResult(PlayCardResult.Ok(card));
    }

    public Task<CardInstance?> MoveToBuildAsync(string roomCode, string userId, Guid cardInstanceId)
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

        // Can move from hand or play area to build zone
        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId
            && (c.Zone == CardZone.Hand || c.Zone == CardZone.PlayArea)
        );
        if (card == null)
        {
            return Task.FromResult<CardInstance?>(null);
        }

        card.Zone = CardZone.BuildZone;
        card.IsFaceDown = true;
        card.IsTapped = false;
        card.IsRetreated = false;
        card.Arena = null;

        return Task.FromResult<CardInstance?>(card);
    }

    public Task<bool> ToggleArenaRetreatAsync(string roomCode, string userId, string arena)
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

        // Toggle the appropriate arena retreat state
        switch (arena.ToLowerInvariant())
        {
            case "space":
                player.SpaceArenaRetreated = !player.SpaceArenaRetreated;
                break;
            case "ground":
                player.GroundArenaRetreated = !player.GroundArenaRetreated;
                break;
            case "character":
                player.CharacterArenaRetreated = !player.CharacterArenaRetreated;
                break;
            default:
                return Task.FromResult(false);
        }

        return Task.FromResult(true);
    }

    public Task<PlayCardResult> MoveFromBuildAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        string arena
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(PlayCardResult.Fail("Room not found"));
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult(PlayCardResult.Fail("Player not found"));
        }

        var card = player.Cards.FirstOrDefault(c =>
            c.InstanceId == cardInstanceId && c.Zone == CardZone.BuildZone
        );
        if (card == null)
        {
            return Task.FromResult(PlayCardResult.Fail("Card not found in build zone"));
        }

        var targetArena = arena.ToLowerInvariant();

        // Validate arena for unit cards
        if (card.CardType == CardType.Unit && !string.IsNullOrEmpty(targetArena))
        {
            var designatedArena = card.DesignatedArena?.ToLowerInvariant();
            if (!string.IsNullOrEmpty(designatedArena) && designatedArena != targetArena)
            {
                return Task.FromResult(
                    PlayCardResult.Fail($"{card.CardName} can only be played in {card.DesignatedArena} arena")
                );
            }
        }

        // For versioned unit cards, check if we need to auto-stack
        if (
            card.CardType == CardType.Unit
            && !string.IsNullOrEmpty(card.Version)
            && !string.IsNullOrEmpty(targetArena)
        )
        {
            // Check if there's a version conflict in a different arena
            var conflict = CheckVersionConflict(roomCode, userId, cardInstanceId, targetArena);
            if (conflict != null)
            {
                return Task.FromResult(
                    PlayCardResult.Fail(
                        $"Cannot play {card.CardName} ({card.Version}) - version {conflict.ConflictingVersion} is already in {conflict.ConflictingArena} arena"
                    )
                );
            }

            // Check if we should auto-stack in the target arena
            var stackTarget = FindStackTargetInArena(roomCode, userId, cardInstanceId, targetArena);
            if (stackTarget != null)
            {
                // Auto-stack: place card under the existing version
                card.Zone = CardZone.PlayArea;
                card.Arena = targetArena;
                card.StackParentId = stackTarget.InstanceId;
                card.IsFaceDown = false; // Cards in arenas are always face up
                stackTarget.StackedUnderIds.Add(card.InstanceId);
                return Task.FromResult(PlayCardResult.Ok(stackTarget, wasAutoStacked: true));
            }

            // Check if same version already exists (shouldn't happen if auto-stack found it, but safety check)
            if (!CanPlayVersionedCard(roomCode, userId, cardInstanceId))
            {
                return Task.FromResult(
                    PlayCardResult.Fail($"Cannot play {card.CardName} ({card.Version}) - same version already in play")
                );
            }
        }

        // Move card from build zone to play area
        card.Zone = CardZone.PlayArea;
        card.Arena = targetArena;
        card.ZonePosition = player.PlayArea.Count();
        card.IsFaceDown = false; // Cards in arenas are always face up
        // Counter is preserved

        return Task.FromResult(PlayCardResult.Ok(card));
    }

    public Task<bool> UpdateBuildCounterAsync(string roomCode, string userId, int buildCounter)
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

        player.BuildCounter = buildCounter;

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
                        DesignatedArena = deckCard.Card.Arena?.ToString().ToLowerInvariant(),
                        Version = deckCard.Card.Version,
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

    #region Card Stacking (Versioned Units)

    public Task<StackResult> StackCardAsync(
        string roomCode,
        string userId,
        Guid cardToStackId,
        Guid targetCardId
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(StackResult.Fail("Room not found"));
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult(StackResult.Fail("Player not found"));
        }

        // Find both cards
        var cardToStack = player.Cards.FirstOrDefault(c => c.InstanceId == cardToStackId);
        var targetCard = player.Cards.FirstOrDefault(c => c.InstanceId == targetCardId);

        if (cardToStack == null)
        {
            return Task.FromResult(StackResult.Fail("Card to stack not found"));
        }

        if (targetCard == null)
        {
            return Task.FromResult(StackResult.Fail("Target card not found"));
        }

        // Validate: both must be units
        if (cardToStack.CardType != CardType.Unit || targetCard.CardType != CardType.Unit)
        {
            return Task.FromResult(StackResult.Fail("Only unit cards can be stacked"));
        }

        // Validate: both must have versions
        if (string.IsNullOrEmpty(cardToStack.Version))
        {
            return Task.FromResult(StackResult.Fail("Card to stack must have a version"));
        }

        if (string.IsNullOrEmpty(targetCard.Version))
        {
            return Task.FromResult(StackResult.Fail("Target card must have a version"));
        }

        // Validate: same card name (base name without version)
        if (
            !string.Equals(
                cardToStack.CardName,
                targetCard.CardName,
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            return Task.FromResult(
                StackResult.Fail("Cards must have the same name to stack")
            );
        }

        // Validate: different versions (can't stack same version on itself)
        if (
            string.Equals(
                cardToStack.Version,
                targetCard.Version,
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            return Task.FromResult(
                StackResult.Fail("Cannot stack the same version on itself")
            );
        }

        // Validate: target must be in play area (arena)
        if (targetCard.Zone != CardZone.PlayArea)
        {
            return Task.FromResult(StackResult.Fail("Target card must be in the arena"));
        }

        // Validate: card to stack must be in hand
        if (cardToStack.Zone != CardZone.Hand)
        {
            return Task.FromResult(StackResult.Fail("Card to stack must be in hand"));
        }

        // If target is already stacked under something, we need the actual top
        if (targetCard.IsStackedUnder)
        {
            return Task.FromResult(
                StackResult.Fail("Can only stack under the top card of a stack")
            );
        }

        // Move cardToStack to play area and mark it as stacked
        cardToStack.Zone = CardZone.PlayArea;
        cardToStack.Arena = targetCard.Arena;
        cardToStack.StackParentId = targetCard.InstanceId;

        // Add to target's stacked list
        targetCard.StackedUnderIds.Add(cardToStack.InstanceId);

        return Task.FromResult(StackResult.Ok(targetCard));
    }

    public Task<StackResult> SetStackTopAsync(
        string roomCode,
        string userId,
        Guid stackTopCardId,
        Guid newTopCardId
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(StackResult.Fail("Room not found"));
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return Task.FromResult(StackResult.Fail("Player not found"));
        }

        // Find current top card
        var currentTop = player.Cards.FirstOrDefault(c =>
            c.InstanceId == stackTopCardId && c.IsStackTop
        );

        if (currentTop == null)
        {
            return Task.FromResult(StackResult.Fail("Current top card not found or has no stack"));
        }

        // Find the new top card (must be in the stack)
        if (!currentTop.StackedUnderIds.Contains(newTopCardId))
        {
            return Task.FromResult(StackResult.Fail("New top card is not in this stack"));
        }

        var newTop = player.Cards.FirstOrDefault(c => c.InstanceId == newTopCardId);
        if (newTop == null)
        {
            return Task.FromResult(StackResult.Fail("New top card not found"));
        }

        // Swap: new top takes over the stack
        newTop.StackParentId = null;
        newTop.StackedUnderIds = currentTop
            .StackedUnderIds.Where(id => id != newTopCardId)
            .ToList();
        newTop.StackedUnderIds.Add(currentTop.InstanceId);

        // Current top becomes stacked under new top
        currentTop.StackParentId = newTop.InstanceId;
        currentTop.StackedUnderIds.Clear();

        // Update all other stacked cards to point to new top
        foreach (var stackedId in newTop.StackedUnderIds.Where(id => id != currentTop.InstanceId))
        {
            var stackedCard = player.Cards.FirstOrDefault(c => c.InstanceId == stackedId);
            if (stackedCard != null)
            {
                stackedCard.StackParentId = newTop.InstanceId;
            }
        }

        return Task.FromResult(StackResult.Ok(newTop));
    }

    public bool CanPlayVersionedCard(string roomCode, string userId, Guid cardInstanceId)
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return false;
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return false;
        }

        var card = player.Cards.FirstOrDefault(c => c.InstanceId == cardInstanceId);
        if (card == null)
        {
            return true; // Card not found, let other validation handle it
        }

        // Non-versioned cards can always be played
        if (string.IsNullOrEmpty(card.Version))
        {
            return true;
        }

        // Non-unit cards can always be played
        if (card.CardType != CardType.Unit)
        {
            return true;
        }

        // Check if the SAME version of this card is already in the play area
        // (can't have two of the same version, e.g., two Darth Vader B)
        var sameVersionInPlay = player.Cards.Any(c =>
            c.Zone == CardZone.PlayArea
            && c.CardType == CardType.Unit
            && c.InstanceId != card.InstanceId // Not the same card instance
            && string.Equals(c.CardName, card.CardName, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(c.Version)
            && string.Equals(c.Version, card.Version, StringComparison.OrdinalIgnoreCase)
        );

        // If the same version is already in play, cannot play this card at all
        if (sameVersionInPlay)
        {
            return false;
        }

        // Check if any other version of this card is in the play area (not stacked under)
        var otherVersionInPlay = player.Cards.Any(c =>
            c.Zone == CardZone.PlayArea
            && c.CardType == CardType.Unit
            && !c.IsStackedUnder // Only count top-level cards
            && string.Equals(c.CardName, card.CardName, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(c.Version)
            && !string.Equals(c.Version, card.Version, StringComparison.OrdinalIgnoreCase)
        );

        // If another version is in play, this card MUST be stacked (can't play independently)
        return !otherVersionInPlay;
    }

    public IEnumerable<CardInstance> GetStackableCards(
        string roomCode,
        string userId,
        Guid cardInstanceId
    )
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

        var card = player.Cards.FirstOrDefault(c => c.InstanceId == cardInstanceId);
        if (card == null || card.CardType != CardType.Unit || string.IsNullOrEmpty(card.Version))
        {
            return [];
        }

        // Find other versions of this card in the play area that are stack tops (or not stacked)
        return player.Cards.Where(c =>
            c.Zone == CardZone.PlayArea
            && c.CardType == CardType.Unit
            && !c.IsStackedUnder // Only top-level cards can accept stacks
            && string.Equals(c.CardName, card.CardName, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(c.Version)
            && !string.Equals(c.Version, card.Version, StringComparison.OrdinalIgnoreCase)
        );
    }

    public CardInstance? FindStackTargetInArena(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        string targetArena
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return null;
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return null;
        }

        var card = player.Cards.FirstOrDefault(c => c.InstanceId == cardInstanceId);
        if (card == null || card.CardType != CardType.Unit || string.IsNullOrEmpty(card.Version))
        {
            return null;
        }

        // Find another version of this card in the specified arena that is not stacked under
        return player.Cards.FirstOrDefault(c =>
            c.Zone == CardZone.PlayArea
            && c.CardType == CardType.Unit
            && !c.IsStackedUnder
            && string.Equals(c.Arena, targetArena, StringComparison.OrdinalIgnoreCase)
            && string.Equals(c.CardName, card.CardName, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(c.Version)
            && !string.Equals(c.Version, card.Version, StringComparison.OrdinalIgnoreCase)
        );
    }

    public VersionConflictInfo? CheckVersionConflict(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        string targetArena
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return null;
        }

        var player = room.GetPlayer(userId);
        if (player == null)
        {
            return null;
        }

        var card = player.Cards.FirstOrDefault(c => c.InstanceId == cardInstanceId);
        if (card == null || card.CardType != CardType.Unit || string.IsNullOrEmpty(card.Version))
        {
            return null;
        }

        // Find another version of this card in a DIFFERENT arena
        var conflictingCard = player.Cards.FirstOrDefault(c =>
            c.Zone == CardZone.PlayArea
            && c.CardType == CardType.Unit
            && !c.IsStackedUnder
            && !string.Equals(c.Arena, targetArena, StringComparison.OrdinalIgnoreCase)
            && string.Equals(c.CardName, card.CardName, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(c.Version)
            && !string.Equals(c.Version, card.Version, StringComparison.OrdinalIgnoreCase)
        );

        if (conflictingCard == null)
        {
            return null;
        }

        return new VersionConflictInfo
        {
            ConflictingCardName = conflictingCard.CardName,
            ConflictingVersion = conflictingCard.Version!,
            ConflictingArena = conflictingCard.Arena ?? "unknown"
        };
    }

    #endregion
}
