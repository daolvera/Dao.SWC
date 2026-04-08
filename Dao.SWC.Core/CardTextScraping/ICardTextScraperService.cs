namespace Dao.SWC.Core.CardTextScraping;

public interface ICardTextScraperService
{
    Task<CardTextScrapeResult> ScrapeCardTextsAsync(CancellationToken cancellationToken = default);
}
