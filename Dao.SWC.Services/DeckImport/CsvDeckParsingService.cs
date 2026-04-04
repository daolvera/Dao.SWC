using Dao.SWC.Core.DeckImport;

namespace Dao.SWC.Services.DeckImport;

public class CsvDeckParsingService : ICsvDeckParsingService
{
    private const string ExpectedHeader = "quantity,cardname,version";

    public IReadOnlyList<CsvDeckCardEntry> ParseCsv(string csvContent)
    {
        var entries = new List<CsvDeckCardEntry>();

        if (string.IsNullOrWhiteSpace(csvContent))
        {
            return entries;
        }

        var lines = csvContent.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries);
        var headerFound = false;

        foreach (var line in lines)
        {
            var trimmed = line.Trim();

            if (string.IsNullOrWhiteSpace(trimmed))
            {
                continue;
            }

            // Check for header row
            if (!headerFound)
            {
                if (trimmed.ToLowerInvariant().Replace(" ", "") == ExpectedHeader)
                {
                    headerFound = true;
                    continue;
                }
                // If first non-empty line is not header, skip file
                return entries;
            }

            // Parse data row
            var entry = ParseDataRow(trimmed);
            if (entry != null)
            {
                entries.Add(entry);
            }
        }

        return entries;
    }

    private static CsvDeckCardEntry? ParseDataRow(string line)
    {
        var parts = line.Split(',');

        if (parts.Length < 2)
        {
            return null;
        }

        // Parse quantity (first column)
        var quantityStr = parts[0].Trim();
        if (!int.TryParse(quantityStr, out var quantity) || quantity < 1)
        {
            return null;
        }

        // Clamp quantity to 1-4
        quantity = Math.Clamp(quantity, 1, 4);

        // Parse card name (second column)
        var cardName = parts[1].Trim();
        if (string.IsNullOrWhiteSpace(cardName))
        {
            return null;
        }

        // Parse version (third column, optional)
        string? version = null;
        if (parts.Length >= 3 && !string.IsNullOrWhiteSpace(parts[2]))
        {
            version = parts[2].Trim();
        }

        return new CsvDeckCardEntry(quantity, cardName, version);
    }
}
