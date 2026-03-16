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
    /// Position index within the zone (e.g., position in play area).
    /// </summary>
    public int? ZonePosition { get; set; }
}
