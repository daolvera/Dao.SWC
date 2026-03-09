using System.Collections.Concurrent;
using Dao.SWC.Core.GameRoom;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.GameRoom;

public class GameRoomService : IGameRoomService
{
    private readonly ConcurrentDictionary<string, Core.GameRoom.GameRoom> _rooms;
    private readonly SwcDbContext _dbContext;
    private static readonly Random _random = new();

    public GameRoomService(SwcDbContext dbContext, IGameRoomStorage storage)
    {
        _dbContext = dbContext;
        _rooms = storage.Rooms;
    }

    public async Task<Core.GameRoom.GameRoom> CreateRoomAsync(
        string hostUserId,
        string hostDisplayName,
        RoomType roomType,
        int deckId
    )
    {
        var roomCode = GenerateRoomCode();

        // Ensure unique room code
        while (_rooms.ContainsKey(roomCode))
        {
            roomCode = GenerateRoomCode();
        }

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
        };

        room.Players.Add(hostPlayer);
        _rooms[roomCode] = room;

        return room;
    }

    public async Task<Core.GameRoom.GameRoom?> JoinRoomAsync(
        string roomCode,
        string userId,
        string displayName,
        int deckId
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return null;
        }

        if (room.State != GameState.Waiting)
        {
            return null; // Game already started
        }

        if (room.IsFull)
        {
            return null;
        }

        // Check if already in room
        var existingPlayer = room.GetPlayer(userId);
        if (existingPlayer != null)
        {
            existingPlayer.IsConnected = true;
            existingPlayer.DeckId = deckId;
            return room;
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
        };

        room.Players.Add(player);
        return room;
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

    public Task<bool> AssignTeamAsync(
        string roomCode,
        string hostUserId,
        string targetUserId,
        Team team
    )
    {
        if (!_rooms.TryGetValue(roomCode.ToUpperInvariant(), out var room))
        {
            return Task.FromResult(false);
        }

        if (!room.IsHost(hostUserId))
        {
            return Task.FromResult(false);
        }

        if (room.State != GameState.Waiting)
        {
            return Task.FromResult(false);
        }

        var player = room.GetPlayer(targetUserId);
        if (player == null)
        {
            return Task.FromResult(false);
        }

        player.Team = team;
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

            // Create card instances based on quantity
            for (int i = 0; i < deckCard.Quantity; i++)
            {
                player.Cards.Add(
                    new CardInstance
                    {
                        CardId = deckCard.CardId,
                        CardName = deckCard.Card.Name,
                        ImageUrl = deckCard.Card.ImageUrl,
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
