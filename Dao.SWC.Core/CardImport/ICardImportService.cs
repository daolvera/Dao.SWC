using Dao.SWC.Core.Entities;

namespace Dao.SWC.Core.CardImport;

/// <summary>
/// Result of importing a single card.
/// </summary>
public record CardImportResult
{
    public required string FileName { get; init; }
    public required string PackName { get; init; }
    public bool Success { get; init; }
    public bool Skipped { get; init; }
    public string? SkipReason { get; init; }
    public string? ErrorMessage { get; init; }
    public Card? ImportedCard { get; init; }
}

/// <summary>
/// Summary of the entire import operation.
/// </summary>
public record ImportSummary
{
    public int TotalFiles { get; init; }
    public int Imported { get; init; }
    public int Skipped { get; init; }
    public int Failed { get; init; }
    public TimeSpan Duration { get; init; }
    public List<CardImportResult> Results { get; init; } = [];
}

/// <summary>
/// Service for orchestrating the card import process.
/// </summary>
public interface ICardImportService
{
    /// <summary>
    /// Imports all cards from the specified directory.
    /// </summary>
    /// <param name="packFilter">Optional pack name filter (imports only matching pack).</param>
    /// <param name="dryRun">If true, analyzes cards but doesn't persist to database.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Summary of the import operation.</returns>
    Task<ImportSummary> ImportCardsAsync(
        string? packFilter = null,
        bool dryRun = false,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Event raised when a card is processed (for progress reporting).
    /// </summary>
    event Action<CardImportResult>? OnCardProcessed;
}
