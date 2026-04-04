using Dao.SWC.Core.DeckImport;

namespace Dao.SWC.Services.DeckImport;

public interface ICardMatchingService
{
    /// <summary>
    /// Matches parsed CSV entries against cards in the database.
    /// Returns results for both matched and unmatched entries.
    /// </summary>
    Task<IReadOnlyList<CardMatchResult>> MatchCardsAsync(
        IReadOnlyList<CsvDeckCardEntry> entries,
        CancellationToken cancellationToken = default
    );
}
