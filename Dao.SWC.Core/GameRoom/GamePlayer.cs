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
    /// All card instances for this player (deck + hand + arenas + discard).
    /// </summary>
    public List<CardInstance> Cards { get; set; } = [];

    public IEnumerable<CardInstance> Deck => Cards.Where(c => c.Zone == CardZone.Deck);
    public IEnumerable<CardInstance> Hand => Cards.Where(c => c.Zone == CardZone.Hand);
    public IEnumerable<CardInstance> PlayArea => Cards.Where(c => c.Zone == CardZone.PlayArea);
    public IEnumerable<CardInstance> DiscardPile => Cards.Where(c => c.Zone == CardZone.Discard);

    // Arena-specific card collections
    public IEnumerable<CardInstance> SpaceArena =>
        Cards.Where(c => c.Zone == CardZone.PlayArea && c.Arena == "space");
    public IEnumerable<CardInstance> GroundArena =>
        Cards.Where(c => c.Zone == CardZone.PlayArea && c.Arena == "ground");
    public IEnumerable<CardInstance> CharacterArena =>
        Cards.Where(c => c.Zone == CardZone.PlayArea && c.Arena == "character");
}
