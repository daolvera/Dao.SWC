using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.GameRoom;

/// <summary>
/// Result of a stack operation.
/// </summary>
public class StackResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public CardInstance? TopCard { get; init; }

    public static StackResult Ok(CardInstance topCard) =>
        new() { Success = true, TopCard = topCard };

    public static StackResult Fail(string errorMessage) =>
        new() { Success = false, ErrorMessage = errorMessage };
}

/// <summary>
/// Result of a play card operation.
/// </summary>
public class PlayCardResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public CardInstance? Card { get; init; }
    public bool WasAutoStacked { get; init; }

    public static PlayCardResult Ok(CardInstance card, bool wasAutoStacked = false) =>
        new() { Success = true, Card = card, WasAutoStacked = wasAutoStacked };

    public static PlayCardResult Fail(string errorMessage) =>
        new() { Success = false, ErrorMessage = errorMessage };
}

/// <summary>
/// Information about a version conflict when trying to play a versioned card.
/// </summary>
public class VersionConflictInfo
{
    public required string ConflictingCardName { get; init; }
    public required string ConflictingVersion { get; init; }
    public required string ConflictingArena { get; init; }
}

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
    /// Returns PlayCardResult with success/error and the card (or stacked card if auto-stacked).
    /// </summary>
    Task<PlayCardResult> PlayCardAsync(
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

    /// <summary>
    /// Toggle face down state of a card in play.
    /// </summary>
    Task<CardInstance?> ToggleFaceDownAsync(string roomCode, string userId, Guid cardInstanceId);

    /// <summary>
    /// Set or update the counter on a card.
    /// </summary>
    Task<CardInstance?> SetCounterAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        int counter
    );

    /// <summary>
    /// Remove the counter from a card.
    /// </summary>
    Task<CardInstance?> RemoveCounterAsync(string roomCode, string userId, Guid cardInstanceId);

    /// <summary>
    /// Set or update the damage on a card (only for cards in arena).
    /// </summary>
    Task<CardInstance?> SetDamageAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        int damage
    );

    /// <summary>
    /// Remove the damage from a card.
    /// </summary>
    Task<CardInstance?> RemoveDamageAsync(string roomCode, string userId, Guid cardInstanceId);

    /// <summary>
    /// Play a card face down to an arena.
    /// Returns PlayCardResult with success/error and the card.
    /// </summary>
    Task<PlayCardResult> PlayCardFaceDownAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        int? zonePosition = null,
        string? arena = null
    );

    /// <summary>
    /// Move a card to the build zone (auto face-down).
    /// </summary>
    Task<CardInstance?> MoveToBuildAsync(string roomCode, string userId, Guid cardInstanceId);

    /// <summary>
    /// Toggle retreat state of an entire arena.
    /// </summary>
    Task<bool> ToggleArenaRetreatAsync(string roomCode, string userId, string arena);

    /// <summary>
    /// Update a player's Build counter.
    /// </summary>
    Task<bool> UpdateBuildCounterAsync(string roomCode, string userId, int buildCounter);

    /// <summary>
    /// Move a card from build zone to play area.
    /// </summary>
    Task<PlayCardResult> MoveFromBuildAsync(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        string arena
    );

    #region Card Stacking (Versioned Units)

    /// <summary>
    /// Stack a card under another card in the arena.
    /// Both cards must be units with the same name but different versions.
    /// </summary>
    /// <param name="roomCode">The room code</param>
    /// <param name="userId">The player's user ID</param>
    /// <param name="cardToStackId">The card being stacked (goes under)</param>
    /// <param name="targetCardId">The card to stack under (becomes/remains top)</param>
    /// <returns>StackResult with success status, error message if failed, and top card if succeeded</returns>
    Task<StackResult> StackCardAsync(
        string roomCode,
        string userId,
        Guid cardToStackId,
        Guid targetCardId
    );

    /// <summary>
    /// Change which card is on top of a stack.
    /// </summary>
    /// <param name="roomCode">The room code</param>
    /// <param name="userId">The player's user ID</param>
    /// <param name="stackTopCardId">The current top card of the stack</param>
    /// <param name="newTopCardId">The card from the stack to make the new top</param>
    /// <returns>StackResult with success status, error message if failed, and new top card if succeeded</returns>
    Task<StackResult> SetStackTopAsync(
        string roomCode,
        string userId,
        Guid stackTopCardId,
        Guid newTopCardId
    );

    /// <summary>
    /// Check if a versioned card can be played to the arena (not already in play as another version).
    /// </summary>
    bool CanPlayVersionedCard(string roomCode, string userId, Guid cardInstanceId);

    /// <summary>
    /// Get cards that can be stacked with the given card (same name, different version, in arena).
    /// </summary>
    IEnumerable<CardInstance> GetStackableCards(
        string roomCode,
        string userId,
        Guid cardInstanceId
    );

    /// <summary>
    /// Find a stackable target for a versioned card in the specified arena.
    /// </summary>
    /// <param name="roomCode">The room code</param>
    /// <param name="userId">The player's user ID</param>
    /// <param name="cardInstanceId">The card to find a stack target for</param>
    /// <param name="targetArena">The arena to look in</param>
    /// <returns>The card to stack under, or null if no valid target</returns>
    CardInstance? FindStackTargetInArena(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        string targetArena
    );

    /// <summary>
    /// Check if a versioned card has another version in a different arena.
    /// </summary>
    /// <param name="roomCode">The room code</param>
    /// <param name="userId">The player's user ID</param>
    /// <param name="cardInstanceId">The card to check</param>
    /// <param name="targetArena">The arena the player wants to play to</param>
    /// <returns>Info about conflicting card if exists, null otherwise</returns>
    VersionConflictInfo? CheckVersionConflict(
        string roomCode,
        string userId,
        Guid cardInstanceId,
        string targetArena
    );

    #endregion
}
