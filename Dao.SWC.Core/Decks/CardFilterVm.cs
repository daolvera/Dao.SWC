namespace Dao.SWC.Core.Decks;

public record CardFilterVm(
    string? Search = null,
    bool SearchByName = true,
    Enums.CardType? Type = null,
    Enums.Alignment? Alignment = null,
    Enums.Arena? Arena = null,
    bool MissingCardText = false,
    int Page = 1,
    int PageSize = 50
);
