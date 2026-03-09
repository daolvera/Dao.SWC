using Dao.SWC.Core.Decks;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.Decks;

public class CardService(SwcDbContext dbContext) : ICardService
{
    public async Task<IEnumerable<CardDto>> GetCardsAsync(CardFilterDto? filter = null)
    {
        var query = dbContext.Cards.AsQueryable();

        if (filter != null)
        {
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

            if (filter.Skip.HasValue)
            {
                query = query.Skip(filter.Skip.Value);
            }

            if (filter.Take.HasValue)
            {
                query = query.Take(filter.Take.Value);
            }
        }

        var cards = await query.OrderBy(c => c.Name).ThenBy(c => c.Version).ToListAsync();

        return cards.Select(c => new CardDto(
            c.Id,
            c.Name,
            c.Type,
            c.Alignment,
            c.Arena,
            c.Version,
            c.ImageUrl,
            c.CardText
        ));
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
}
