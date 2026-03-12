using Dao.SWC.Core;

namespace Dao.SWC.Core.Decks;

public interface ICardService
{
    Task<PagedResult<CardDto>> GetCardsPagedAsync(CardFilterDto? filter = null);
    Task<CardDto?> GetCardByIdAsync(int cardId);
    Task<CardDto?> UpdateCardAsync(CardUpdateDto dto);
    Task<IEnumerable<CardDto>> BulkUpdateCardsAsync(IEnumerable<CardUpdateDto> dtos);
}
