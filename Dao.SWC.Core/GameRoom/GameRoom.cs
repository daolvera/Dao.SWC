namespace Dao.SWC.Core.GameRoom;

/// <summary>
/// Represents a game room where players can play matches.
/// </summary>
public class GameRoom
{
    public required string RoomCode { get; set; }
    public RoomType RoomType { get; set; }
    public required string HostUserId { get; set; }
    public GameState State { get; set; } = GameState.Waiting;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }

    /// <summary>
    /// Current turn number (starts at 1 when game begins).
    /// </summary>
    public int TurnNumber { get; set; }

    /// <summary>
    /// UserId of the player whose turn it is.
    /// </summary>
    public string? CurrentTurnUserId { get; set; }

    /// <summary>
    /// Turn order (list of UserIds).
    /// </summary>
    public List<string> TurnOrder { get; set; } = [];

    public List<GamePlayer> Players { get; set; } = [];

    /// <summary>
    /// History of dice rolls for the game.
    /// </summary>
    public List<DiceRollResult> DiceRolls { get; set; } = [];

    public int MaxPlayers => RoomType == RoomType.OneVsOne ? 2 : 4;

    public bool IsFull => Players.Count >= MaxPlayers;

    public GamePlayer? GetPlayer(string userId) => Players.FirstOrDefault(p => p.UserId == userId);

    public bool IsHost(string userId) => HostUserId == userId;
}

/// <summary>
/// Result of a dice roll.
/// </summary>
public record DiceRollResult(
    string UserId,
    string DisplayName,
    int[] Results,
    int Total,
    DateTime RolledAt
);
