namespace Dao.SWC.Core.Decks;

public interface ICardService
{
    Task<IEnumerable<CardDto>> GetCardsAsync(CardFilterDto? filter = null);
    Task<CardDto?> GetCardByIdAsync(int cardId);
}

public record CardFilterDto(
    string? Search = null,
    Enums.CardType? Type = null,
    Enums.Alignment? Alignment = null,
    Enums.Arena? Arena = null,
    int? Skip = null,
    int? Take = null
);
