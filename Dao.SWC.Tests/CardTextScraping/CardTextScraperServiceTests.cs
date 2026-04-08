using Dao.SWC.Core.CardTextScraping;
using Dao.SWC.Core.Entities;
using Dao.SWC.Core.Enums;
using Dao.SWC.Services.CardTextScraping;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Dao.SWC.Tests.CardTextScraping;

/// <summary>
/// Unit tests for CardTextScraperService database query logic.
/// Note: These tests verify the DB filtering and result logic.
/// Full Playwright integration tests require a running browser and swtcg.com access.
/// </summary>
[TestClass]
public class CardTextScraperServiceTests
{
    private static DbContextOptions<SwcDbContext> CreateInMemoryOptions()
    {
        return new DbContextOptionsBuilder<SwcDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
    }

    [TestMethod]
    public async Task ScrapeCardTextsAsync_AllCardsHaveText_ReturnsZeroCounts()
    {
        // Arrange
        var options = CreateInMemoryOptions();
        using (var seedContext = new SwcDbContext(options))
        {
            seedContext.Cards.AddRange(
                new Card { Name = "Luke Skywalker", Type = CardType.Unit, CardText = "Has text" },
                new Card { Name = "Darth Vader", Type = CardType.Unit, CardText = "Also has text" }
            );
            await seedContext.SaveChangesAsync();
        }

        using var context = new SwcDbContext(options);
        var logger = LoggerFactory.Create(b => { }).CreateLogger<CardTextScraperService>();
        var service = new CardTextScraperService(context, logger);

        // Act
        var result = await service.ScrapeCardTextsAsync(CancellationToken.None);

        // Assert
        Assert.AreEqual(0, result.FilledCount);
        Assert.AreEqual(0, result.NotFoundCount);
        Assert.AreEqual(0, result.NotFoundCards.Count);
    }

    [TestMethod]
    public void CardTextScrapeResult_CorrectlyStoresData()
    {
        // Arrange & Act
        var notFound = new List<CardScrapeNotFoundDto>
        {
            new(1, "Luke Skywalker", "A", "https://example.com/luke.jpg"),
            new(2, "Darth Vader", null, null),
        };

        var result = new CardTextScrapeResult(5, 2, notFound);

        // Assert
        Assert.AreEqual(5, result.FilledCount);
        Assert.AreEqual(2, result.NotFoundCount);
        Assert.AreEqual(2, result.NotFoundCards.Count);
        Assert.AreEqual("Luke Skywalker", result.NotFoundCards[0].Name);
        Assert.AreEqual("A", result.NotFoundCards[0].Version);
        Assert.AreEqual("Darth Vader", result.NotFoundCards[1].Name);
        Assert.IsNull(result.NotFoundCards[1].Version);
    }

    [TestMethod]
    public void CardScrapeNotFoundDto_PropertiesMapCorrectly()
    {
        var dto = new CardScrapeNotFoundDto(42, "Test Card", "B", "https://example.com/img.jpg");

        Assert.AreEqual(42, dto.Id);
        Assert.AreEqual("Test Card", dto.Name);
        Assert.AreEqual("B", dto.Version);
        Assert.AreEqual("https://example.com/img.jpg", dto.ImageUrl);
    }
}
