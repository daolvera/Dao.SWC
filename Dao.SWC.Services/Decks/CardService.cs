using Dao.SWC.Core;
using Dao.SWC.Core.Decks;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.Decks;

public class CardService(SwcDbContext dbContext) : ICardService
{
    public async Task<PagedResult<CardDto>> GetCardsPagedAsync(CardFilterDto? filter = null)
    {
        filter ??= new CardFilterDto();

        var query = dbContext.Cards.AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(search)
                || (c.CardText != null && c.CardText.ToLower().Contains(search))
            );
        }

        if (filter.Type.HasValue)
        {
            query = query.Where(c => c.Type == filter.Type.Value);
        }

        if (filter.Alignment.HasValue)
        {
            query = query.Where(c => c.Alignment == filter.Alignment.Value);
        }

        if (filter.Arena.HasValue)
        {
            query = query.Where(c => c.Arena == filter.Arena.Value);
        }

        var totalCount = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalCount / (double)filter.PageSize);

        var cards = await query
            .OrderBy(c => c.Name)
            .ThenBy(c => c.Version)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(c => new CardDto(
                c.Id,
                c.Name,
                c.Type,
                c.Alignment,
                c.Arena,
                c.Version,
                c.ImageUrl,
                c.CardText
            ))
            .ToListAsync();

        return new PagedResult<CardDto>(
            cards,
            filter.Page,
            filter.PageSize,
            totalCount,
            totalPages
        );
    }

    public async Task<CardDto?> GetCardByIdAsync(int cardId)
    {
        var card = await dbContext.Cards.FindAsync(cardId);

        if (card == null)
        {
            return null;
        }

        return new CardDto(
            card.Id,
            card.Name,
            card.Type,
            card.Alignment,
            card.Arena,
            card.Version,
            card.ImageUrl,
            card.CardText
        );
    }

    public async Task<CardDto?> UpdateCardAsync(CardUpdateDto dto)
    {
        var card = await dbContext.Cards.FindAsync(dto.Id);
        if (card == null)
        {
            return null;
        }

        card.Name = dto.Name;
        card.Type = dto.Type;
        card.Alignment = dto.Alignment;
        card.Arena = dto.Arena;
        card.Version = dto.Version;
        card.ImageUrl = dto.ImageUrl;
        card.CardText = dto.CardText;

        await dbContext.SaveChangesAsync();

        return new CardDto(
            card.Id,
            card.Name,
            card.Type,
            card.Alignment,
            card.Arena,
            card.Version,
            card.ImageUrl,
            card.CardText
        );
    }

    public async Task<IEnumerable<CardDto>> BulkUpdateCardsAsync(IEnumerable<CardUpdateDto> dtos)
    {
        var dtoList = dtos.ToList();
        var ids = dtoList.Select(d => d.Id).ToList();
        var cards = await dbContext.Cards.Where(c => ids.Contains(c.Id)).ToListAsync();
        var cardMap = cards.ToDictionary(c => c.Id);

        var updatedCards = new List<CardDto>();

        foreach (var dto in dtoList)
        {
            if (!cardMap.TryGetValue(dto.Id, out var card))
            {
                continue;
            }

            card.Name = dto.Name;
            card.Type = dto.Type;
            card.Alignment = dto.Alignment;
            card.Arena = dto.Arena;
            card.Version = dto.Version;
            card.ImageUrl = dto.ImageUrl;
            card.CardText = dto.CardText;

            updatedCards.Add(
                new CardDto(
                    card.Id,
                    card.Name,
                    card.Type,
                    card.Alignment,
                    card.Arena,
                    card.Version,
                    card.ImageUrl,
                    card.CardText
                )
            );
        }

        await dbContext.SaveChangesAsync();

        return updatedCards;
    }
}
