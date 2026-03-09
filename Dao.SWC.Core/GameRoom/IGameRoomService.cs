namespace Dao.SWC.Core.GameRoom;

public interface IGameRoomService
{
    /// <summary>
    /// Create a new game room.
    /// </summary>
    Task<GameRoom> CreateRoomAsync(
        string hostUserId,
        string hostDisplayName,
        RoomType roomType,
        int deckId
    );

    /// <summary>
    /// Join an existing room.
    /// </summary>
    Task<GameRoom?> JoinRoomAsync(string roomCode, string userId, string displayName, int deckId);

    /// <summary>
    /// Leave a room (or disconnect).
    /// </summary>
    Task<bool> LeaveRoomAsync(string roomCode, string userId);

    /// <summary>
    /// Kick a player from the room (host only).
    /// </summary>
    Task<bool> KickPlayerAsync(string roomCode, string hostUserId, string targetUsername);

    /// <summary>
    /// Assign a player to a team (host only).
    /// </summary>
    Task<bool> AssignTeamAsync(string roomCode, string hostUserId, string targetUserId, Team team);

    /// <summary>
    /// Get room by code.
    /// </summary>
    GameRoom? GetRoom(string roomCode);

    /// <summary>
    /// Start the game (host only). Shuffles decks and deals initial hands.
    /// </summary>
    Task<bool> StartGameAsync(string roomCode, string hostUserId);

    /// <summary>
    /// Draw cards from deck to hand.
    /// </summary>
    Task<IEnumerable<CardInstance>> DrawCardsAsync(string roomCode, string userId, int count);

    /// <summary>
    /// Play a card from hand to play area.
    /// </summary>
    Task<CardInstance?> PlayCardAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        int? zonePosition = null,
        string? arena = null
    );

    /// <summary>
    /// Discard a card (from hand or play area).
    /// </summary>
    Task<CardInstance?> DiscardCardAsync(string roomCode, string userId, Guid cardInstanceId);

    /// <summary>
    /// Roll dice.
    /// </summary>
    Task<DiceRollResult> RollDiceAsync(
        string roomCode,
        string userId,
        string displayName,
        int numberOfDice
    );

    /// <summary>
    /// End current turn and move to next player.
    /// </summary>
    Task<string?> EndTurnAsync(string roomCode, string userId);

    /// <summary>
    /// Reconnect a player to a room.
    /// </summary>
    Task<GameRoom?> ReconnectAsync(string roomCode, string userId, string connectionId);

    /// <summary>
    /// Update a player's connection ID.
    /// </summary>
    void UpdatePlayerConnection(string roomCode, string userId, string? connectionId);
}
