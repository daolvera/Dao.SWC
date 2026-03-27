using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.GameRoom;

/// <summary>
/// Represents a player in a game room.
/// </summary>
public class GamePlayer
{
    public required string UserId { get; set; }
    public required string DisplayName { get; set; }
    public string? ConnectionId { get; set; }
    public int DeckId { get; set; }
    public string DeckName { get; set; } = string.Empty;
    public Team Team { get; set; }
    public bool IsConnected { get; set; }

    /// <summary>
    /// The player's Force counter. Starts at 4.
    /// </summary>
    public int Force { get; set; } = 4;

    /// <summary>
    /// The player's Build counter. Starts at 60 (or 30 for 1v1).
    /// </summary>
    public int BuildCounter { get; set; } = 60;

    /// <summary>
    /// Whether the Space arena is retreated.
    /// </summary>
    public bool SpaceArenaRetreated { get; set; }

    /// <summary>
    /// Whether the Ground arena is retreated.
    /// </summary>
    public bool GroundArenaRetreated { get; set; }

    /// <summary>
    /// Whether the Character arena is retreated.
    /// </summary>
    public bool CharacterArenaRetreated { get; set; }

    /// <summary>
    /// The alignment of the player's deck (Light, Dark, or Neutral).
    /// </summary>
    public Alignment DeckAlignment { get; set; }

    /// <summary>
    /// For neutral decks, the alignment the player chose to play as (Light or Dark).
    /// Null for non-neutral decks.
    /// </summary>
    public Alignment? PlayAsAlignment { get; set; }

    /// <summary>
    /// Gets the effective alignment for gameplay purposes.
    /// For neutral decks, returns the PlayAsAlignment; otherwise returns DeckAlignment.
    /// </summary>
    public Alignment EffectiveAlignment =>
        DeckAlignment == Alignment.Neutral && PlayAsAlignment.HasValue
            ? PlayAsAlignment.Value
            : DeckAlignment;

    /// <summary>
    /// All card instances for this player (deck + hand + arenas + discard).
    /// </summary>
    public List<CardInstance> Cards { get; set; } = [];

    public IEnumerable<CardInstance> Deck => Cards.Where(c => c.Zone == CardZone.Deck);
    public IEnumerable<CardInstance> Hand => Cards.Where(c => c.Zone == CardZone.Hand);
    public IEnumerable<CardInstance> PlayArea => Cards.Where(c => c.Zone == CardZone.PlayArea);
    public IEnumerable<CardInstance> DiscardPile => Cards.Where(c => c.Zone == CardZone.Discard);
    public IEnumerable<CardInstance> BuildArea => Cards.Where(c => c.Zone == CardZone.BuildZone);

    // Arena-specific card collections
    public IEnumerable<CardInstance> SpaceArena =>
        Cards.Where(c => c.Zone == CardZone.PlayArea && c.Arena == "space");
    public IEnumerable<CardInstance> GroundArena =>
        Cards.Where(c => c.Zone == CardZone.PlayArea && c.Arena == "ground");
    public IEnumerable<CardInstance> CharacterArena =>
        Cards.Where(c => c.Zone == CardZone.PlayArea && c.Arena == "character");
}
