using Dao.SWC.Core.Decks;
using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.DeckImport;

/// <summary>
/// Represents a single card entry parsed from a CSV file.
/// </summary>
public record CsvDeckCardEntry(
    int Quantity,
    string CardName,
    string? Version
);

/// <summary>
/// Request to import a deck from CSV data.
/// </summary>
public record DeckImportRequest(
    string DeckName,
    Alignment Alignment,
    string CsvContent
);

/// <summary>
/// Result of attempting to match a CSV entry to a card in the database.
/// </summary>
public record CardMatchResult(
    CsvDeckCardEntry Entry,
    int? CardId,
    string? CardName,
    bool IsMatched,
    string? SkipReason
);

/// <summary>
/// Summary of the import operation including created deck, matches, and validation.
/// </summary>
public record DeckImportResult
{
    public required bool Success { get; init; }
    public required string Message { get; init; }
    public DeckDto? CreatedDeck { get; init; }
    public DeckValidationResult? ValidationResult { get; init; }
    public required IReadOnlyList<CardMatchResult> MatchedCards { get; init; }
    public required IReadOnlyList<CardMatchResult> SkippedCards { get; init; }

    public int TotalEntriesParsed => MatchedCards.Count + SkippedCards.Count;
    public int TotalCardsImported => MatchedCards.Sum(m => m.Entry.Quantity);

    public static DeckImportResult Failure(string message) => new()
    {
        Success = false,
        Message = message,
        MatchedCards = [],
        SkippedCards = []
    };
}
