using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.CardImport;

/// <summary>
/// Result of AI analysis of a card image.
/// </summary>
public record CardAnalysisResult
{
    /// <summary>
    /// The name of the card as displayed on the card.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// The type of card (Unit, Location, Equipment, Mission, Battle).
    /// </summary>
    public required CardType Type { get; init; }

    /// <summary>
    /// The alignment of the card (Light, Dark, Neutral).
    /// </summary>
    public required Alignment Alignment { get; init; }

    /// <summary>
    /// The arena for Unit and Location cards (Space, Ground, Character).
    /// Null for other card types.
    /// </summary>
    public Arena? Arena { get; init; }

    /// <summary>
    /// Version letter for unique cards (e.g., "A", "B", "C").
    /// Extracted from the card or filename.
    /// </summary>
    public string? Version { get; init; }

    /// <summary>
    /// The rules text on the card.
    /// </summary>
    public string? CardText { get; init; }

    /// <summary>
    /// Confidence score from 0 to 1 indicating how confident the AI is in the analysis.
    /// </summary>
    public double Confidence { get; init; }

    /// <summary>
    /// Any warnings or notes from the analysis (e.g., "Could not read card text clearly").
    /// </summary>
    public string? Notes { get; init; }
}
