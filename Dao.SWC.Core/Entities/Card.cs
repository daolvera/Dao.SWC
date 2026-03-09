using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.Entities;

public class Card
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public CardType Type { get; set; }
    public Alignment Alignment { get; set; }

    /// <summary>
    /// Arena is required for Unit and Location cards (Space, Ground, Character).
    /// Null for other card types.
    /// </summary>
    public Arena? Arena { get; set; }

    /// <summary>
    /// Version letter for unique cards (e.g., "A", "B", "C").
    /// Null for non-unique cards.
    /// </summary>
    public string? Version { get; set; }

    /// <summary>
    /// URL to the card image in blob storage.
    /// </summary>
    public string? ImageUrl { get; set; }

    /// <summary>
    /// The rules text on the card.
    /// </summary>
    public string? CardText { get; set; }

    // Navigation property
    public ICollection<DeckCard> DeckCards { get; set; } = [];
}
