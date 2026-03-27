using Dao.SWC.Core;
using Dao.SWC.Core.CardImport;
using Dao.SWC.Core.Decks;
using Dao.SWC.Core.Entities;
using Dao.SWC.Core.Enums;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.Decks;

public class CardService(SwcDbContext dbContext, ICardImageService imageService) : ICardService
{
    public async Task<PagedResult<CardDto>> GetCardsPagedAsync(CardFilterVm? filter = null)
    {
        filter ??= new CardFilterVm();

        var query = dbContext.Cards.AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.ToLower();
            query = filter.SearchByName ?
                query.Where(c =>
                    c.Name.ToLower().Contains(search)) :
                query.Where(c =>
                        c.CardText != null
                        && c.CardText.ToLower().Contains(search)
                    );
        }

        if (filter.Type.HasValue)
        {
            query = query.Where(c => c.Type == filter.Type.Value);
        }

        if (filter.Alignment.HasValue)
        {
            // Include Neutral cards when filtering by Light or Dark
            if (filter.Alignment.Value == Alignment.Neutral)
            {
                query = query.Where(c => c.Alignment == Alignment.Neutral);
            }
            else
            {
                query = query.Where(c =>
                    c.Alignment == filter.Alignment.Value || c.Alignment == Alignment.Neutral
                );
            }
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
            .ToListAsync();

        // Transform image URLs to include SAS tokens
        var cardDtos = new List<CardDto>();
        foreach (var c in cards)
        {
            var imageUrl = string.IsNullOrEmpty(c.ImageUrl)
                ? c.ImageUrl
                : await imageService.GenerateReadUrlAsync(c.ImageUrl);

            cardDtos.Add(
                new CardDto(
                    c.Id,
                    c.Name,
                    c.Type,
                    c.Alignment,
                    c.Arena,
                    c.Version,
                    imageUrl,
                    c.CardText
                )
            );
        }

        return new PagedResult<CardDto>(
            cardDtos,
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

        var imageUrl = string.IsNullOrEmpty(card.ImageUrl)
            ? card.ImageUrl
            : await imageService.GenerateReadUrlAsync(card.ImageUrl);

        return new CardDto(
            card.Id,
            card.Name,
            card.Type,
            card.Alignment,
            card.Arena,
            card.Version,
            imageUrl,
            card.CardText
        );
    }

    public async Task<CardDto> CreateCardAsync(CardCreateDto dto)
    {
        var card = new Card
        {
            Name = dto.Name,
            Type = dto.Type,
            Alignment = dto.Alignment,
            Arena = dto.Arena,
            Version = dto.Version,
            ImageUrl = dto.ImageUrl,
            CardText = dto.CardText,
        };

        dbContext.Cards.Add(card);
        await dbContext.SaveChangesAsync();

        var imageUrl = string.IsNullOrEmpty(card.ImageUrl)
            ? card.ImageUrl
            : await imageService.GenerateReadUrlAsync(card.ImageUrl);

        return new CardDto(
            card.Id,
            card.Name,
            card.Type,
            card.Alignment,
            card.Arena,
            card.Version,
            imageUrl,
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

        var imageUrl = string.IsNullOrEmpty(card.ImageUrl)
            ? card.ImageUrl
            : await imageService.GenerateReadUrlAsync(card.ImageUrl);

        return new CardDto(
            card.Id,
            card.Name,
            card.Type,
            card.Alignment,
            card.Arena,
            card.Version,
            imageUrl,
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

            var imageUrl = string.IsNullOrEmpty(card.ImageUrl)
                ? card.ImageUrl
                : await imageService.GenerateReadUrlAsync(card.ImageUrl);

            updatedCards.Add(
                new CardDto(
                    card.Id,
                    card.Name,
                    card.Type,
                    card.Alignment,
                    card.Arena,
                    card.Version,
                    imageUrl,
                    card.CardText
                )
            );
        }

        await dbContext.SaveChangesAsync();

        return updatedCards;
    }

    public async Task<bool> DeleteCardAsync(int cardId)
    {
        var card = await dbContext.Cards.FindAsync(cardId);
        if (card == null)
        {
            return false;
        }

        dbContext.Cards.Remove(card);
        await dbContext.SaveChangesAsync();
        return true;
    }
}
