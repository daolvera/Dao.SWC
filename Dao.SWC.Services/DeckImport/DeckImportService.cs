using Dao.SWC.Core.DeckImport;
using Dao.SWC.Core.Decks;
using Dao.SWC.Core.Entities;
using Dao.SWC.Core.Enums;
using Dao.SWC.Services.Data;
using Dao.SWC.Services.Decks;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.DeckImport;

public class DeckImportService(
    SwcDbContext dbContext,
    ICsvDeckParsingService parsingService,
    ICardMatchingService matchingService,
    IDeckValidationService validationService
) : IDeckImportService
{
    public async Task<DeckImportResult> ImportDeckAsync(
        string userId,
        DeckImportRequest request,
        CancellationToken cancellationToken = default)
    {
        return await ImportDeckFromCsvAsync(
            userId,
            request.CsvContent,
            request.DeckName,
            request.Alignment,
            cancellationToken
        );
    }

    public async Task<DeckImportResult> ImportDeckFromCsvAsync(
        string userId,
        string csvContent,
        string deckName,
        Alignment alignment,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(csvContent))
        {
            return DeckImportResult.Failure("CSV content is empty");
        }

        if (string.IsNullOrWhiteSpace(deckName))
        {
            return DeckImportResult.Failure("Deck name is required");
        }

        // Step 1: Parse CSV
        var entries = parsingService.ParseCsv(csvContent);

        if (entries.Count == 0)
        {
            return DeckImportResult.Failure("No valid card entries found in CSV. Ensure the file has header: Quantity,CardName,Version");
        }

        // Step 2: Match cards to database
        var matchResults = await matchingService.MatchCardsAsync(entries, cancellationToken);

        // Step 3: Filter by alignment - skip cards with incompatible alignments
        var matched = new List<CardMatchResult>();
        var skipped = new List<CardMatchResult>();

        // Get card alignments for matched cards
        var matchedCardIds = matchResults
            .Where(r => r.IsMatched && r.CardId.HasValue)
            .Select(r => r.CardId!.Value)
            .Distinct()
            .ToList();

        var cardAlignments = await dbContext.Cards
            .Where(c => matchedCardIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Alignment, cancellationToken);

        foreach (var result in matchResults)
        {
            if (!result.IsMatched)
            {
                skipped.Add(result);
                continue;
            }

            var cardAlignment = cardAlignments[result.CardId!.Value];
            
            // Check alignment compatibility
            if (!IsAlignmentCompatible(alignment, cardAlignment))
            {
                var reason = $"Card alignment ({cardAlignment}) not compatible with deck alignment ({alignment})";
                skipped.Add(result with { IsMatched = false, SkipReason = reason });
            }
            else
            {
                matched.Add(result);
            }
        }

        if (matched.Count == 0)
        {
            return new DeckImportResult
            {
                Success = false,
                Message = "No compatible cards found for the selected alignment",
                MatchedCards = matched,
                SkippedCards = skipped
            };
        }

        // Step 4: Create deck
        var deck = new Deck
        {
            Name = deckName,
            UserId = userId,
            Alignment = alignment,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Decks.Add(deck);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Step 5: Add cards to deck (combine duplicates)
        var cardQuantities = matched
            .GroupBy(m => m.CardId!.Value)
            .Select(g => new DeckCard
            {
                DeckId = deck.Id,
                CardId = g.Key,
                Quantity = Math.Min(g.Sum(m => m.Entry.Quantity), 4)
            })
            .ToList();

        dbContext.DeckCards.AddRange(cardQuantities);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Step 6: Validate the created deck
        var validation = await validationService.ValidateDeckAsync(deck.Id, userId);

        // Step 7: Build result
        var totalImported = cardQuantities.Sum(dc => dc.Quantity);
        var message = skipped.Count > 0
            ? $"Imported {totalImported} cards ({matched.Count} unique). {skipped.Count} entries skipped."
            : $"Successfully imported {totalImported} cards ({matched.Count} unique).";

        var deckDto = await GetDeckDtoAsync(deck.Id, userId, cancellationToken);

        return new DeckImportResult
        {
            Success = true,
            Message = message,
            CreatedDeck = deckDto,
            ValidationResult = validation,
            MatchedCards = matched,
            SkippedCards = skipped
        };
    }

    private static bool IsAlignmentCompatible(Alignment deckAlignment, Alignment cardAlignment)
    {
        return deckAlignment switch
        {
            Alignment.Light => cardAlignment is Alignment.Light or Alignment.Neutral,
            Alignment.Dark => cardAlignment is Alignment.Dark or Alignment.Neutral,
            Alignment.Neutral => cardAlignment == Alignment.Neutral,
            _ => false
        };
    }

    private async Task<DeckDto?> GetDeckDtoAsync(int deckId, string userId, CancellationToken cancellationToken)
    {
        var deck = await dbContext.Decks
            .Include(d => d.DeckCards)
            .ThenInclude(dc => dc.Card)
            .FirstOrDefaultAsync(d => d.Id == deckId && d.UserId == userId, cancellationToken);

        if (deck == null) return null;

        var cardDtos = deck.DeckCards
            .Where(dc => dc.Card != null)
            .Select(dc => new DeckCardDto(
                dc.CardId,
                dc.Quantity,
                new CardDto(
                    dc.Card!.Id,
                    dc.Card.Name,
                    dc.Card.Type,
                    dc.Card.Alignment,
                    dc.Card.Arena,
                    dc.Card.Version,
                    dc.Card.IsPilot,
                    dc.Card.ImageUrl,
                    dc.Card.CardText
                )
            ))
            .ToList();

        return new DeckDto(
            deck.Id,
            deck.Name,
            deck.Alignment,
            deck.CreatedAt,
            deck.UpdatedAt,
            cardDtos.Sum(c => c.Quantity),
            cardDtos
        );
    }
}
