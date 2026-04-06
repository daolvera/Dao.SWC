namespace Dao.SWC.Core.GameRoom;

/// <summary>
/// Represents shared team state for 2v1 and 2v2 game modes.
/// Each team shares force, build counter, build zone, and arenas.
/// </summary>
public class TeamData
{
    public Team Team { get; set; }

    /// <summary>
    /// Shared force counter for the team. Starts at 4.
    /// </summary>
    public int Force { get; set; } = 4;

    /// <summary>
    /// Shared build counter for the team. Starts at 60.
    /// </summary>
    public int BuildCounter { get; set; } = 60;

    /// <summary>
    /// Whether the Space arena is retreated for this team.
    /// </summary>
    public bool SpaceArenaRetreated { get; set; }

    /// <summary>
    /// Whether the Ground arena is retreated for this team.
    /// </summary>
    public bool GroundArenaRetreated { get; set; }

    /// <summary>
    /// Whether the Character arena is retreated for this team.
    /// </summary>
    public bool CharacterArenaRetreated { get; set; }

    /// <summary>
    /// Cards in the team's shared build zone.
    /// </summary>
    public List<CardInstance> BuildZone { get; set; } = [];

    /// <summary>
    /// Cards in the team's shared Space arena.
    /// </summary>
    public List<CardInstance> SpaceArena { get; set; } = [];

    /// <summary>
    /// Cards in the team's shared Ground arena.
    /// </summary>
    public List<CardInstance> GroundArena { get; set; } = [];

    /// <summary>
    /// Cards in the team's shared Character arena.
    /// </summary>
    public List<CardInstance> CharacterArena { get; set; } = [];

    /// <summary>
    /// Secret bid for bidding system.
    /// </summary>
    public int? SecretBid { get; set; }

    /// <summary>
    /// Gets all cards in the specified arena.
    /// </summary>
    public List<CardInstance> GetArena(string arenaName)
    {
        return arenaName.ToLowerInvariant() switch
        {
            "space" => SpaceArena,
            "ground" => GroundArena,
            "character" => CharacterArena,
            _ => []
        };
    }

    /// <summary>
    /// Gets all cards across all arenas.
    /// </summary>
    public IEnumerable<CardInstance> AllArenaCards =>
        SpaceArena.Concat(GroundArena).Concat(CharacterArena);

    /// <summary>
    /// Gets whether the specified arena is retreated.
    /// </summary>
    public bool IsArenaRetreated(string arenaName)
    {
        return arenaName.ToLowerInvariant() switch
        {
            "space" => SpaceArenaRetreated,
            "ground" => GroundArenaRetreated,
            "character" => CharacterArenaRetreated,
            _ => false
        };
    }

    /// <summary>
    /// Sets the retreat status for the specified arena.
    /// </summary>
    public void SetArenaRetreated(string arenaName, bool retreated)
    {
        switch (arenaName.ToLowerInvariant())
        {
            case "space":
                SpaceArenaRetreated = retreated;
                break;
            case "ground":
                GroundArenaRetreated = retreated;
                break;
            case "character":
                CharacterArenaRetreated = retreated;
                break;
        }
    }
}
