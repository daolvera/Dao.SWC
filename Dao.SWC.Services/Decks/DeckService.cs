using Dao.SWC.Core.CardImport;
using Dao.SWC.Core.Decks;
using Dao.SWC.Core.Entities;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.Decks;

public class DeckService(
    SwcDbContext dbContext,
    IDeckValidationService validationService,
    ICardImageService imageService
) : IDeckService
{
    public async Task<IEnumerable<DeckListItemDto>> GetUserDecksAsync(string userId)
    {
        var decks = await dbContext
            .Decks.Where(d => d.UserId == userId)
            .Include(d => d.DeckCards)
            .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt)
            .ToListAsync();

        var result = new List<DeckListItemDto>();
        foreach (var deck in decks)
        {
            var validation = await validationService.ValidateDeckAsync(deck.Id, userId);
            result.Add(
                new DeckListItemDto(
                    deck.Id,
                    deck.Name,
                    deck.Alignment,
                    deck.CreatedAt,
                    deck.DeckCards.Sum(dc => dc.Quantity),
                    validation.IsValid
                )
            );
        }

        return result;
    }

    public async Task<DeckDto?> GetDeckByIdAsync(int deckId, string userId)
    {
        var deck = await dbContext
            .Decks.Where(d => d.Id == deckId && d.UserId == userId)
            .Include(d => d.DeckCards)
            .ThenInclude(dc => dc.Card)
            .FirstOrDefaultAsync();

        if (deck == null)
        {
            return null;
        }

        return await MapToDeckDtoAsync(deck);
    }

    public async Task<DeckDto> CreateDeckAsync(string userId, CreateDeckDto dto)
    {
        var deck = new Deck
        {
            Name = dto.Name,
            UserId = userId,
            Alignment = dto.Alignment,
            CreatedAt = DateTime.UtcNow,
        };

        dbContext.Decks.Add(deck);
        await dbContext.SaveChangesAsync();

        return await MapToDeckDtoAsync(deck);
    }

    public async Task<DeckDto?> UpdateDeckAsync(int deckId, string userId, UpdateDeckDto dto)
    {
        var deck = await dbContext
            .Decks.Where(d => d.Id == deckId && d.UserId == userId)
            .Include(d => d.DeckCards)
            .ThenInclude(dc => dc.Card)
            .FirstOrDefaultAsync();

        if (deck == null)
        {
            return null;
        }

        if (dto.Name != null)
        {
            deck.Name = dto.Name;
        }

        if (dto.Alignment.HasValue)
        {
            deck.Alignment = dto.Alignment.Value;
        }

        if (dto.Cards != null)
        {
            // Remove existing cards
            dbContext.DeckCards.RemoveRange(deck.DeckCards);

            // Add new cards
            foreach (var cardDto in dto.Cards.Where(c => c.Quantity > 0))
            {
                deck.DeckCards.Add(
                    new DeckCard
                    {
                        DeckId = deckId,
                        CardId = cardDto.CardId,
                        Quantity = Math.Min(cardDto.Quantity, 4), // Enforce max 4
                    }
                );
            }
        }

        deck.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        // Reload with cards for return
        return await GetDeckByIdAsync(deckId, userId);
    }

    public async Task<bool> DeleteDeckAsync(int deckId, string userId)
    {
        var deck = await dbContext
            .Decks.Where(d => d.Id == deckId && d.UserId == userId)
            .FirstOrDefaultAsync();

        if (deck == null)
        {
            return false;
        }

        dbContext.Decks.Remove(deck);
        await dbContext.SaveChangesAsync();
        return true;
    }

    private async Task<DeckDto> MapToDeckDtoAsync(Deck deck)
    {
        var cardDtos = new List<DeckCardDto>();

        foreach (var dc in deck.DeckCards.Where(dc => dc.Card != null))
        {
            var imageUrl = string.IsNullOrEmpty(dc.Card!.ImageUrl)
                ? dc.Card.ImageUrl
                : await imageService.GenerateReadUrlAsync(dc.Card.ImageUrl);

            cardDtos.Add(
                new DeckCardDto(
                    dc.CardId,
                    dc.Quantity,
                    new CardDto(
                        dc.Card.Id,
                        dc.Card.Name,
                        dc.Card.Type,
                        dc.Card.Alignment,
                        dc.Card.Arena,
                        dc.Card.Version,
                        dc.Card.IsPilot,
                        imageUrl,
                        dc.Card.CardText
                    )
                )
            );
        }

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
