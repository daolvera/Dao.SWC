using Dao.SWC.Core.DeckImport;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.DeckImport;

public class CardMatchingService(SwcDbContext dbContext) : ICardMatchingService
{
    public async Task<IReadOnlyList<CardMatchResult>> MatchCardsAsync(
        IReadOnlyList<CsvDeckCardEntry> entries,
        CancellationToken cancellationToken = default)
    {
        if (entries.Count == 0)
        {
            return [];
        }

        // Get all cards from database for matching (case-insensitive)
        var cardNames = entries.Select(e => e.CardName.ToLowerInvariant()).Distinct().ToList();
        
        var matchingCards = await dbContext.Cards
            .Where(c => cardNames.Contains(c.Name.ToLower()))
            .Select(c => new { c.Id, c.Name, c.Version })
            .ToListAsync(cancellationToken);

        // Build a lookup dictionary: (name_lower, version_lower) -> (id, name)
        var cardLookup = matchingCards
            .ToDictionary(
                c => (c.Name.ToLowerInvariant(), c.Version?.ToLowerInvariant() ?? ""),
                c => (c.Id, c.Name)
            );

        // Also build a name-only lookup for cards without versions
        var nameOnlyLookup = matchingCards
            .Where(c => string.IsNullOrEmpty(c.Version))
            .GroupBy(c => c.Name.ToLowerInvariant())
            .ToDictionary(
                g => g.Key,
                g => g.First()
            );

        var results = new List<CardMatchResult>();

        foreach (var entry in entries)
        {
            var nameLower = entry.CardName.ToLowerInvariant();
            var versionLower = entry.Version?.ToLowerInvariant() ?? "";

            // Try exact match (name + version)
            if (cardLookup.TryGetValue((nameLower, versionLower), out var exactMatch))
            {
                results.Add(new CardMatchResult(
                    entry,
                    exactMatch.Id,
                    exactMatch.Name,
                    IsMatched: true,
                    SkipReason: null
                ));
                continue;
            }

            // If version specified but no exact match, try without version
            if (!string.IsNullOrEmpty(entry.Version))
            {
                if (cardLookup.TryGetValue((nameLower, ""), out var noVersionMatch))
                {
                    results.Add(new CardMatchResult(
                        entry,
                        noVersionMatch.Id,
                        noVersionMatch.Name,
                        IsMatched: true,
                        SkipReason: null
                    ));
                    continue;
                }

                // Check if we have any card with this name but different version
                var anyWithName = matchingCards
                    .Where(c => c.Name.Equals(entry.CardName, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                if (anyWithName.Count > 0)
                {
                    var availableVersions = string.Join(", ", anyWithName.Select(c => c.Version ?? "(none)"));
                    results.Add(new CardMatchResult(
                        entry,
                        CardId: null,
                        CardName: null,
                        IsMatched: false,
                        SkipReason: $"Card '{entry.CardName}' exists but version '{entry.Version}' not found. Available versions: {availableVersions}"
                    ));
                    continue;
                }
            }

            // Try name-only match
            if (nameOnlyLookup.TryGetValue(nameLower, out var nameMatch))
            {
                results.Add(new CardMatchResult(
                    entry,
                    nameMatch.Id,
                    nameMatch.Name,
                    IsMatched: true,
                    SkipReason: null
                ));
                continue;
            }

            // No match found
            results.Add(new CardMatchResult(
                entry,
                CardId: null,
                CardName: null,
                IsMatched: false,
                SkipReason: $"Card '{entry.CardName}' not found in database"
            ));
        }

        return results;
    }
}
