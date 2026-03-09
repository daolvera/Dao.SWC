using Dao.SWC.Core.Decks;
using Dao.SWC.Core.Enums;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.Decks;

public class DeckValidationService(SwcDbContext dbContext) : IDeckValidationService
{
    private const int MinimumTotalCards = 60;
    private const int MinimumUnitPerArena = 12;
    private const int MaxCopiesPerCard = 4;

    public async Task<DeckValidationResult> ValidateDeckAsync(int deckId, string userId)
    {
        var deck = await dbContext
            .Decks.Include(d => d.DeckCards)
            .ThenInclude(dc => dc.Card)
            .FirstOrDefaultAsync(d => d.Id == deckId && d.UserId == userId);

        if (deck == null)
        {
            return DeckValidationResult.Invalid(["Deck not found"]);
        }

        var errors = new List<string>();
        var warnings = new List<string>();

        var cards = deck
            .DeckCards.Where(dc => dc.Card != null)
            .Select(dc => new { dc.Quantity, Card = dc.Card! })
            .ToList();

        var totalCards = cards.Sum(c => c.Quantity);

        // Rule: At least 60 cards
        if (totalCards < MinimumTotalCards)
        {
            errors.Add($"Deck must have at least {MinimumTotalCards} cards. Current: {totalCards}");
        }

        // Rule: Cannot mix Light and Dark alignment cards
        var hasLight = cards.Any(c => c.Card.Alignment == Alignment.Light);
        var hasDark = cards.Any(c => c.Card.Alignment == Alignment.Dark);
        if (hasLight && hasDark)
        {
            errors.Add("Deck cannot contain both Light Side and Dark Side cards");
        }

        // Get unit counts by arena
        var unitCards = cards.Where(c => c.Card.Type == CardType.Unit && c.Card.Arena.HasValue);
        var spaceUnits = unitCards.Where(c => c.Card.Arena == Arena.Space).Sum(c => c.Quantity);
        var groundUnits = unitCards.Where(c => c.Card.Arena == Arena.Ground).Sum(c => c.Quantity);
        var characterUnits = unitCards
            .Where(c => c.Card.Arena == Arena.Character)
            .Sum(c => c.Quantity);

        // Rule: At least 12 of each unit type
        if (spaceUnits < MinimumUnitPerArena)
        {
            errors.Add(
                $"Deck must have at least {MinimumUnitPerArena} Space units. Current: {spaceUnits}"
            );
        }
        if (groundUnits < MinimumUnitPerArena)
        {
            errors.Add(
                $"Deck must have at least {MinimumUnitPerArena} Ground units. Current: {groundUnits}"
            );
        }
        if (characterUnits < MinimumUnitPerArena)
        {
            errors.Add(
                $"Deck must have at least {MinimumUnitPerArena} Character units. Current: {characterUnits}"
            );
        }

        // Rule: No unit type can be more than twice another
        var unitCounts = new[] { spaceUnits, groundUnits, characterUnits }
            .Where(c => c > 0)
            .ToList();
        if (unitCounts.Count > 1)
        {
            var minUnits = unitCounts.Min();
            var maxUnits = unitCounts.Max();
            if (maxUnits > minUnits * 2)
            {
                errors.Add(
                    $"No unit type can have more than twice as many cards as another. Min: {minUnits}, Max: {maxUnits}"
                );
            }
        }

        // Rule: No more than 4 copies of any card (same name and version)
        var cardGroups = cards
            .GroupBy(c => new { c.Card.Name, c.Card.Version })
            .Where(g => g.Sum(c => c.Quantity) > MaxCopiesPerCard)
            .ToList();

        foreach (var group in cardGroups)
        {
            var cardName =
                group.Key.Version != null
                    ? $"{group.Key.Name} ({group.Key.Version})"
                    : group.Key.Name;
            errors.Add(
                $"Cannot have more than {MaxCopiesPerCard} copies of '{cardName}'. Current: {group.Sum(c => c.Quantity)}"
            );
        }

        // Warnings for deck composition recommendations
        if (totalCards > 0 && totalCards < MinimumTotalCards)
        {
            var remaining = MinimumTotalCards - totalCards;
            warnings.Add($"Add {remaining} more cards to meet the minimum requirement");
        }

        return new DeckValidationResult(errors.Count == 0, errors, warnings);
    }
}
