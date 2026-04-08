namespace Dao.SWC.Core.CardTextScraping;

public record CardTextScrapeResult(
    int FilledCount,
    int NotFoundCount,
    IReadOnlyList<CardScrapeNotFoundDto> NotFoundCards
);

public record CardScrapeNotFoundDto(
    int Id,
    string Name,
    string? Version,
    string? ImageUrl
);
