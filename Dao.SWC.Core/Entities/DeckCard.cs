namespace Dao.SWC.Core.Entities;

public class DeckCard
{
    public int DeckId { get; set; }
    public int CardId { get; set; }

    /// <summary>
    /// Number of copies of this card in the deck (1-4).
    /// </summary>
    public int Quantity { get; set; } = 1;

    // Navigation properties
    public Deck? Deck { get; set; }
    public Card? Card { get; set; }
}
