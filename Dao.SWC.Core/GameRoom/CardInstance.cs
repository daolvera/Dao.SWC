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

    /// <summary>
    /// The user ID of the player who owns this card.
    /// Used in team modes to track ownership within shared team arenas.
    /// </summary>
    public string? OwnerUserId { get; set; }

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

    #region Piloting

    /// <summary>
    /// Whether this character card can pilot units.
    /// Only applicable to character unit cards.
    /// </summary>
    public bool IsPilot { get; set; }

    /// <summary>
    /// List of pilot card instance IDs attached to this unit.
    /// Only units in space/ground arenas can have pilots.
    /// Maximum of 2 pilots per unit.
    /// </summary>
    public List<Guid> PilotCardIds { get; set; } = [];

    /// <summary>
    /// If this card is piloting a unit, this is the instance ID of the unit being piloted.
    /// Null if this card is not piloting anything.
    /// </summary>
    public Guid? PilotingUnitId { get; set; }

    /// <summary>
    /// Whether this unit has any pilots attached.
    /// </summary>
    public bool HasPilots => PilotCardIds.Count > 0;

    /// <summary>
    /// Whether this card is currently piloting a unit.
    /// </summary>
    public bool IsPiloting => PilotingUnitId.HasValue;

    #endregion

    #region Equipment

    /// <summary>
    /// The instance ID of the equipment card attached to this unit.
    /// Null if no equipment is attached. Only one equipment per unit.
    /// </summary>
    public Guid? EquipmentCardId { get; set; }

    /// <summary>
    /// If this card is equipment attached to a unit, this is the instance ID of the unit.
    /// Null if this equipment is not attached to anything.
    /// </summary>
    public Guid? EquippedToUnitId { get; set; }

    /// <summary>
    /// Whether this unit has equipment attached.
    /// </summary>
    public bool HasEquipment => EquipmentCardId.HasValue;

    /// <summary>
    /// Whether this equipment is attached to a unit.
    /// </summary>
    public bool IsEquipped => EquippedToUnitId.HasValue;

    #endregion
}
