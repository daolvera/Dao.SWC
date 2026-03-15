using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.GameRoom;

public interface IGameRoomService
{
    /// <summary>
    /// Create a new game room.
    /// </summary>
    /// <param name="playAsAlignment">Required for neutral decks - specifies playing as Light or Dark</param>
    Task<GameRoom> CreateRoomAsync(
        string hostUserId,
        string hostDisplayName,
        RoomType roomType,
        int deckId,
        Alignment? playAsAlignment = null
    );

    /// <summary>
    /// Join an existing room.
    /// </summary>
    /// <param name="playAsAlignment">Required for neutral decks - specifies playing as Light or Dark</param>
    /// <returns>JoinRoomResult with the room on success, or an error message on failure</returns>
    Task<JoinRoomResult> JoinRoomAsync(
        string roomCode,
        string userId,
        string displayName,
        int deckId,
        Alignment? playAsAlignment = null
    );

    /// <summary>
    /// Leave a room (or disconnect).
    /// </summary>
    Task<bool> LeaveRoomAsync(string roomCode, string userId);

    /// <summary>
    /// Kick a player from the room (host only).
    /// </summary>
    Task<bool> KickPlayerAsync(string roomCode, string hostUserId, string targetUsername);

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
    /// Return a card to hand (from play area or discard).
    /// </summary>
    Task<CardInstance?> ReturnToHandAsync(string roomCode, string userId, Guid cardInstanceId);

    /// <summary>
    /// Toggle tap/untap state of a card.
    /// </summary>
    Task<CardInstance?> ToggleTapAsync(string roomCode, string userId, Guid cardInstanceId);

    /// <summary>
    /// Shuffle the player's deck.
    /// </summary>
    Task<bool> ShuffleDeckAsync(string roomCode, string userId);

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

    /// <summary>
    /// Get all cards in the player's deck for browsing.
    /// </summary>
    IEnumerable<CardInstance> GetDeckCards(string roomCode, string userId);

    /// <summary>
    /// Take a specific card from the deck to hand.
    /// </summary>
    Task<CardInstance?> TakeFromDeckAsync(string roomCode, string userId, Guid cardInstanceId);

    /// <summary>
    /// Update a player's Force counter.
    /// </summary>
    Task<bool> UpdateForceAsync(string roomCode, string userId, int force);
}
