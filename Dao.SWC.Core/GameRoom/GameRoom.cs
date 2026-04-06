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
    /// Team data for 2v1 and 2v2 game modes.
    /// Key is the Team enum value. Empty for 1v1 games.
    /// </summary>
    public Dictionary<Team, TeamData> Teams { get; set; } = [];

    /// <summary>
    /// Whether this game uses team mode (shared arenas/resources).
    /// </summary>
    public bool IsTeamMode => RoomType != RoomType.OneVsOne;

    /// <summary>
    /// History of dice rolls for the game.
    /// </summary>
    public List<DiceRollResult> DiceRolls { get; set; } = [];

    /// <summary>
    /// Whether bids are currently revealed to all players.
    /// </summary>
    public bool BidsRevealed { get; set; }

    public int MaxPlayers =>
        RoomType switch
        {
            RoomType.OneVsOne => 2,
            RoomType.OneVsTwo => 3,
            RoomType.TwoVsTwo => 4,
            _ => 4,
        };

    public int MinPlayersToStart => RoomType == RoomType.OneVsOne ? 2 : 2;

    public bool IsFull => Players.Count >= MaxPlayers;

    public GamePlayer? GetPlayer(string userId) => Players.FirstOrDefault(p => p.UserId == userId);

    public bool IsHost(string userId) => HostUserId == userId;

    /// <summary>
    /// Gets the team data for a player. Returns null for 1v1 games.
    /// </summary>
    public TeamData? GetPlayerTeam(string userId)
    {
        if (!IsTeamMode)
            return null;

        var player = GetPlayer(userId);
        if (player == null)
            return null;

        return Teams.TryGetValue(player.Team, out var team) ? team : null;
    }

    /// <summary>
    /// Gets the team data for a team. Returns null for 1v1 games or if team not found.
    /// </summary>
    public TeamData? GetTeam(Team team)
    {
        if (!IsTeamMode)
            return null;

        return Teams.TryGetValue(team, out var teamData) ? teamData : null;
    }

    /// <summary>
    /// Gets all players on a specific team.
    /// </summary>
    public IEnumerable<GamePlayer> GetPlayersOnTeam(Team team) =>
        Players.Where(p => p.Team == team);

    /// <summary>
    /// Initializes team data for team modes. Should be called when game starts.
    /// </summary>
    public void InitializeTeams()
    {
        if (!IsTeamMode)
            return;

        Teams[Team.Team1] = new TeamData { Team = Team.Team1 };
        Teams[Team.Team2] = new TeamData { Team = Team.Team2 };
    }
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

/// <summary>
/// Result of a join room operation.
/// </summary>
public record JoinRoomResult(GameRoom? Room, string? Error)
{
    public bool Success => Room != null && Error == null;

    public static JoinRoomResult Succeeded(GameRoom room) => new(room, null);

    public static JoinRoomResult Failed(string error) => new(null, error);
}
