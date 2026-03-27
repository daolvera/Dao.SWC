using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.GameRoom;

/// <summary>
/// Represents a single card instance in a game.
/// Each card in a player's deck gets a unique instance ID.
/// </summary>
public class CardInstance
{
    public Guid InstanceId { get; set; } = Guid.NewGuid();
    public int CardId { get; set; }
    public string CardName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }

    /// <summary>
    /// The type of the card (Unit, Location, Equipment, Mission, Battle).
    /// </summary>
    public CardType CardType { get; set; }

    /// <summary>
    /// The designated arena for Unit cards (space, ground, character).
    /// Null for non-unit cards.
    /// </summary>
    public string? DesignatedArena { get; set; }

    /// <summary>
    /// Version letter for unique cards (e.g., "A", "B", "C").
    /// Null for non-unique cards.
    /// </summary>
    public string? Version { get; set; }

    public CardZone Zone { get; set; } = CardZone.Deck;

    /// <summary>
    /// Which arena the card is in (space, ground, character).
    /// Only applicable when Zone is PlayArea.
    /// </summary>
    public string? Arena { get; set; }

    /// <summary>
    /// Whether the card is tapped (exhausted/used this turn).
    /// </summary>
    public bool IsTapped { get; set; }

    /// <summary>
    /// Whether the card is face down (hidden from opponents).
    /// </summary>
    public bool IsFaceDown { get; set; }

    /// <summary>
    /// Counter value on the card. Null means no counter.
    /// </summary>
    public int? Counter { get; set; }

    /// <summary>
    /// Damage value on the card. Null means no damage.
    /// Only visible in the UI when the card is in an arena.
    /// </summary>
    public int? Damage { get; set; }

    /// <summary>
    /// Whether the card is retreated (moved to back of arena).
    /// </summary>
    public bool IsRetreated { get; set; }

    /// <summary>
    /// Position index within the zone (e.g., position in play area).
    /// </summary>
    public int? ZonePosition { get; set; }

    #region Card Stacking (Versioned Units)

    /// <summary>
    /// If this card is stacked under another card, this is the instance ID of the card on top.
    /// Null if this card is not stacked under anything.
    /// </summary>
    public Guid? StackParentId { get; set; }

    /// <summary>
    /// List of card instance IDs stacked under this card.
    /// Only the top card of a stack tracks the cards beneath it.
    /// </summary>
    public List<Guid> StackedUnderIds { get; set; } = [];

    /// <summary>
    /// Whether this card is the top of a stack (has cards underneath).
    /// </summary>
    public bool IsStackTop => StackedUnderIds.Count > 0;

    /// <summary>
    /// Whether this card is stacked under another card.
    /// </summary>
    public bool IsStackedUnder => StackParentId.HasValue;

    #endregion
}
