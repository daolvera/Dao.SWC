using Dao.SWC.Core.Enums;

namespace Dao.SWC.Core.Decks;

public record CardDto(
    int Id,
    string Name,
    CardType Type,
    Alignment Alignment,
    Arena? Arena,
    string? Version,
    string? ImageUrl,
    string? CardText
);

public record DeckCardDto(int CardId, int Quantity, CardDto Card);

public record DeckDto(
    int Id,
    string Name,
    Alignment Alignment,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    int TotalCards,
    IEnumerable<DeckCardDto> Cards
);

public record DeckListItemDto(
    int Id,
    string Name,
    Alignment Alignment,
    DateTime CreatedAt,
    int TotalCards,
    bool IsValid
);

public record CreateDeckDto(string Name, Alignment Alignment);

public record UpdateDeckDto(
    string? Name,
    Alignment? Alignment,
    IEnumerable<UpdateDeckCardDto>? Cards
);

public record UpdateDeckCardDto(int CardId, int Quantity);

public record CardUpdateDto(
    int Id,
    string Name,
    CardType Type,
    Alignment Alignment,
    Arena? Arena,
    string? Version,
    string? ImageUrl,
    string? CardText
);
