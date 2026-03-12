namespace Dao.SWC.Core.CardImport;

/// <summary>
/// Configuration options for the card import process.
/// </summary>
public class CardImportOptions
{
    public const string SectionName = "ImportOptions";

    /// <summary>
    /// Delay in milliseconds between processing each card (rate limiting for AI API).
    /// Default: 500ms.
    /// </summary>
    public int DelayMs { get; set; } = 500;

    /// <summary>
    /// Path to the TCG/Cards directory containing pack subdirectories.
    /// </summary>
    public string CardsPath { get; set; } = "../TCG/Cards";
}
