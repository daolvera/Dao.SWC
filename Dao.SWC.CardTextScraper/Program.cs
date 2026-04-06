using Dao.SWC.Core;
using Dao.SWC.Core.CardTextScraping;
using Dao.SWC.Services.CardTextScraping;
using Dao.SWC.Services.Data;

var showHelp = HasFlag(args, "--help", "-h");

if (showHelp)
{
    PrintHelp();
    return 0;
}

var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();

builder.AddSqlServerDbContext<SwcDbContext>(Constants.ProjectNames.Database);

builder.Services.AddScoped<ICardTextScraperService, CardTextScraperService>();

var host = builder.Build();

using var scope = host.Services.CreateScope();
var services = scope.ServiceProvider;

var logger = services.GetRequiredService<ILogger<Program>>();
var scraperService = services.GetRequiredService<ICardTextScraperService>();

Console.WriteLine("================================================================");
Console.WriteLine("       Star Wars TCG Card Text Scraper                         ");
Console.WriteLine("================================================================");
Console.WriteLine();
Console.WriteLine("NOTE: Playwright requires Chromium browsers to be installed.");
Console.WriteLine("  If you get a browser error, run:");
Console.WriteLine("  pwsh bin/Debug/net10.0/playwright.ps1 install chromium");
Console.WriteLine();

try
{
    using var cts = new CancellationTokenSource();
    Console.CancelKeyPress += (_, e) =>
    {
        e.Cancel = true;
        cts.Cancel();
    };

    var result = await scraperService.ScrapeCardTextsAsync(cts.Token);

    Console.WriteLine();
    Console.WriteLine("================================================================");
    Console.WriteLine("                         SUMMARY                               ");
    Console.WriteLine("================================================================");
    Console.ForegroundColor = ConsoleColor.Green;
    Console.WriteLine($"  Filled:         {result.FilledCount}");
    Console.ForegroundColor = ConsoleColor.Yellow;
    Console.WriteLine($"  Not Found:      {result.NotFoundCount}");
    Console.ResetColor();
    Console.WriteLine("================================================================");

    if (result.NotFoundCards.Count > 0)
    {
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("NOT FOUND CARDS:");
        foreach (var card in result.NotFoundCards)
        {
            var version = !string.IsNullOrEmpty(card.Version) ? $" ({card.Version})" : "";
            Console.WriteLine($"  - [{card.Id}] {card.Name}{version}");
        }
        Console.ResetColor();
    }

    return 0;
}
catch (OperationCanceledException)
{
    Console.WriteLine();
    Console.ForegroundColor = ConsoleColor.Yellow;
    Console.WriteLine("Scraping was cancelled.");
    Console.ResetColor();
    return 1;
}
catch (Exception ex)
{
    logger.LogError(ex, "Card text scraping failed");
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine($"Scraping failed: {ex.Message}");
    Console.ResetColor();
    return 1;
}

static bool HasFlag(string[] args, params string[] flags) =>
    args.Any(a => flags.Contains(a, StringComparer.OrdinalIgnoreCase));

static void PrintHelp()
{
    Console.WriteLine(
        """
        Star Wars TCG Card Text Scraper

        Scrapes card text from swtcg.com for cards missing descriptions
        in the database, then exits.

        Usage: Dao.SWC.CardTextScraper [options]

        Options:
          -h, --help            Show this help message

        Prerequisites:
          Playwright requires Chromium browsers. Install them with:
          pwsh bin/Debug/net10.0/playwright.ps1 install chromium
        """
    );
}
