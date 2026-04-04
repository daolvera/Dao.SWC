using Dao.SWC.Core.DeckImport;

namespace Dao.SWC.Services.DeckImport;

public interface ICsvDeckParsingService
{
    /// <summary>
    /// Parses CSV content into card entries.
    /// Expected format: Quantity,CardName,Version (header required)
    /// </summary>
    IReadOnlyList<CsvDeckCardEntry> ParseCsv(string csvContent);
}
