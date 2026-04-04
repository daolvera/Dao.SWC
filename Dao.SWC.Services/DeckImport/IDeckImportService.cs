using Dao.SWC.Core.DeckImport;
using Dao.SWC.Core.Enums;

namespace Dao.SWC.Services.DeckImport;

public interface IDeckImportService
{
    /// <summary>
    /// Imports a deck from CSV content for the specified user.
    /// Parses CSV, matches cards, filters by alignment, creates deck, and validates.
    /// </summary>
    Task<DeckImportResult> ImportDeckAsync(
        string userId,
        DeckImportRequest request,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Imports a deck from CSV content with required deck name and alignment.
    /// </summary>
    Task<DeckImportResult> ImportDeckFromCsvAsync(
        string userId,
        string csvContent,
        string deckName,
        Alignment alignment,
        CancellationToken cancellationToken = default
    );
}
