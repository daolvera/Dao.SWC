namespace Dao.SWC.Core.Decks;

public record CardFilterDto(
    string? Search = null,
    Enums.CardType? Type = null,
    Enums.Alignment? Alignment = null,
    Enums.Arena? Arena = null,
    int Page = 1,
    int PageSize = 50
);
