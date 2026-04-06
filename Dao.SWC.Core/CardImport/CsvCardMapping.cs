using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.CardImport;

/// <summary>
/// Represents a row in the card mapping CSV file.
/// </summary>
public record CsvCardMapping
{
    /// <summary>
    /// The image filename (e.g., "Darth_Vader_A.jpg").
    /// </summary>
    public required string FileName { get; init; }

    /// <summary>
    /// The card name (e.g., "Darth Vader").
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// The card type (Unit, Location, Equipment, Mission, Battle).
    /// </summary>
    public CardType Type { get; init; }

    /// <summary>
    /// The card alignment (Light, Dark, Neutral).
    /// </summary>
    public Alignment Alignment { get; init; }

    /// <summary>
    /// The arena for Unit/Location cards (Space, Ground, Character).
    /// </summary>
    public Arena? Arena { get; init; }

    /// <summary>
    /// Version letter for unique cards (e.g., "A", "B", "C").
    /// </summary>
    public string? Version { get; init; }

    /// <summary>
    /// Whether this is a pilot character card.
    /// </summary>
    public bool IsPilot { get; init; }

    /// <summary>
    /// The rules text on the card.
    /// </summary>
    public string? CardText { get; init; }
}
