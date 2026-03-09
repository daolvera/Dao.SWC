using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.Entities;

public class Deck : ITrackingBase
{
    public int Id { get; set; }
    public required string Name { get; set; }

    /// <summary>
    /// The user who owns this deck.
    /// </summary>
    public required string UserId { get; set; }

    /// <summary>
    /// Deck alignment is derived from the cards but cached for quick filtering.
    /// Light decks can only contain Light + Neutral cards.
    /// Dark decks can only contain Dark + Neutral cards.
    /// </summary>
    public Alignment Alignment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public AppUser? User { get; set; }
    public ICollection<DeckCard> DeckCards { get; set; } = [];
}
