using Dao.SWC.Core.CardTextScraping;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Playwright;

namespace Dao.SWC.Services.CardTextScraping;

public class CardTextScraperService(
    SwcDbContext dbContext,
    ILogger<CardTextScraperService> logger
) : ICardTextScraperService
{
    private const string BaseUrl = "https://swtcg.com";
    private const int DelayBetweenCardMs = 800;

    public async Task<CardTextScrapeResult> ScrapeCardTextsAsync(
        CancellationToken cancellationToken = default
    )
    {
        var cardsWithoutText = await dbContext.Cards
            .Where(c => c.CardText == null || c.CardText == "")
            .OrderBy(c => c.Name)
            .ThenBy(c => c.Version)
            .ToListAsync(cancellationToken);

        if (cardsWithoutText.Count == 0)
        {
            logger.LogInformation("All cards already have card text. Nothing to scrape.");
            return new CardTextScrapeResult(0, 0, []);
        }

        logger.LogInformation(
            "Found {Count} cards without card text. Starting scrape...",
            cardsWithoutText.Count
        );

        var notFoundCards = new List<CardScrapeNotFoundDto>();
        var filledCount = 0;

        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(
            new BrowserTypeLaunchOptions { Headless = true }
        );
        var context = await browser.NewContextAsync();
        var page = await context.NewPageAsync();

        foreach (var card in cardsWithoutText)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var cardText = await ScrapeCardTextAsync(page, card.Name, card.Version);

                if (cardText is not null)
                {
                    card.CardText = cardText;
                    filledCount++;
                    logger.LogInformation(
                        "Found card text for '{Name}' ({Version})",
                        card.Name,
                        card.Version ?? "no version"
                    );
                }
                else
                {
                    notFoundCards.Add(new CardScrapeNotFoundDto(
                        card.Id,
                        card.Name,
                        card.Version,
                        card.ImageUrl
                    ));
                    logger.LogWarning(
                        "Card text not found for '{Name}' ({Version})",
                        card.Name,
                        card.Version ?? "no version"
                    );
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(
                    ex,
                    "Error scraping card text for '{Name}' ({Version})",
                    card.Name,
                    card.Version ?? "no version"
                );
                notFoundCards.Add(new CardScrapeNotFoundDto(
                    card.Id,
                    card.Name,
                    card.Version,
                    card.ImageUrl
                ));
            }

            await Task.Delay(DelayBetweenCardMs, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Scrape complete. Filled: {Filled}, Not Found: {NotFound}",
            filledCount,
            notFoundCards.Count
        );

        return new CardTextScrapeResult(filledCount, notFoundCards.Count, notFoundCards);
    }

    private async Task<string?> ScrapeCardTextAsync(IPage page, string cardName, string? version)
    {
        var searchName = version is not null ? $"{cardName} ({version})" : cardName;
        var encodedSearch = Uri.EscapeDataString(searchName);

        // Navigate to the Cards page with globalsearch param to pre-filter results
        await page.GotoAsync(
            $"{BaseUrl}/Cards?globalsearch={encodedSearch}",
            new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded }
        );

        // Wait for the AJAX grid to update with results
        await page.WaitForTimeoutAsync(2000);

        // Find the first matching card link in the results table
        var cardLink = page.Locator("table tbody tr td a[href*='/Cards/Details/']").First;

        try
        {
            await cardLink.WaitForAsync(new LocatorWaitForOptions
            {
                State = WaitForSelectorState.Visible,
                Timeout = 5000,
            });
        }
        catch (TimeoutException)
        {
            return null;
        }

        // Navigate to the detail page
        var href = await cardLink.GetAttributeAsync("href");
        if (string.IsNullOrEmpty(href))
        {
            return null;
        }

        await page.GotoAsync(
            $"{BaseUrl}{href}",
            new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded }
        );

        // Extract card text from the detail page
        // The HTML structure is: <h3>Card Text</h3> followed by <p>text content</p>
        // within the same parent div
        var cardTextHeader = page.Locator("h3:has-text('Card Text')");

        try
        {
            await cardTextHeader.WaitForAsync(new LocatorWaitForOptions
            {
                State = WaitForSelectorState.Visible,
                Timeout = 5000,
            });
        }
        catch (TimeoutException)
        {
            return null;
        }

        // Get the parent container and find the <p> sibling after the h3
        var parentDiv = cardTextHeader.Locator("..");
        var cardTextParagraph = parentDiv.Locator("p");

        if (await cardTextParagraph.CountAsync() == 0)
        {
            return null;
        }

        var text = await cardTextParagraph.First.TextContentAsync();
        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }
}
