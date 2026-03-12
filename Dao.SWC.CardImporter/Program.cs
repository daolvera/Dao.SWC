using Azure.AI.OpenAI;
using Dao.SWC.Core;
using Dao.SWC.Core.CardImport;
using Dao.SWC.Services.CardImport;
using Dao.SWC.Services.Data;
using Microsoft.Extensions.Options;
using System.ClientModel;

// Parse command line arguments
var packFilter = GetArgValue(args, "--pack", "-p");
var dryRun = HasFlag(args, "--dry-run", "-d");
var verbose = HasFlag(args, "--verbose", "-v");
var delayOverride = GetArgValue(args, "--delay");
var showHelp = HasFlag(args, "--help", "-h");

if (showHelp)
{
    PrintHelp();
    return 0;
}

var builder = Host.CreateApplicationBuilder(args);

// Add service defaults (logging, telemetry, etc.)
builder.AddServiceDefaults();

// Add database context from Aspire
builder.AddNpgsqlDbContext<SwcDbContext>(Constants.ProjectNames.Database);

// Add Azure Blob Storage from Aspire
builder.AddAzureBlobServiceClient(Constants.ProjectNames.BlobContainer);

// Add Azure OpenAI client from IOptions configuration
builder.Services.Configure<AzureOpenAiOptions>(
    builder.Configuration.GetSection(AzureOpenAiOptions.SectionName)
);

builder.Services.AddSingleton(sp =>
{
    var options = sp.GetRequiredService<IOptions<AzureOpenAiOptions>>().Value;

    if (string.IsNullOrEmpty(options.Endpoint))
        throw new InvalidOperationException("AzureOpenAi:Endpoint is not configured");
    if (string.IsNullOrEmpty(options.Key))
        throw new InvalidOperationException("AzureOpenAi:Key is not configured");

    return new AzureOpenAIClient(new Uri(options.Endpoint), new ApiKeyCredential(options.Key));
});

// Configure import options from appsettings
builder.Services.Configure<CardImportOptions>(
    builder.Configuration.GetSection(CardImportOptions.SectionName)
);

// Register services
builder.Services.AddScoped<ICardAnalysisService, CardAnalysisService>();
builder.Services.AddScoped<ICardImageService, CardImageService>();
builder.Services.AddScoped<ICardImportService, CardImportService>();

var host = builder.Build();

// Run the import
using var scope = host.Services.CreateScope();
var services = scope.ServiceProvider;

var logger = services.GetRequiredService<ILogger<Program>>();
var importService = services.GetRequiredService<ICardImportService>();
var options = services.GetRequiredService<IOptions<CardImportOptions>>();

// Override delay if specified via CLI
if (!string.IsNullOrEmpty(delayOverride) && int.TryParse(delayOverride, out var delayMs))
{
    options.Value.DelayMs = delayMs;
}

// Setup progress reporting
var processedCount = 0;
importService.OnCardProcessed += result =>
{
    processedCount++;
    var status =
        result.Skipped ? "SKIPPED"
        : result.Success ? "OK"
        : "FAILED";
    var message = result.Skipped ? result.SkipReason : result.ErrorMessage;

    if (verbose || !result.Success)
    {
        var color = result.Success
            ? (result.Skipped ? ConsoleColor.Yellow : ConsoleColor.Green)
            : ConsoleColor.Red;
        Console.ForegroundColor = color;
        Console.WriteLine($"[{processedCount}] {status}: {result.FileName} - {result.PackName}");
        if (!string.IsNullOrEmpty(message))
        {
            Console.WriteLine($"    {message}");
        }
        if (verbose && result.ImportedCard != null)
        {
            Console.WriteLine(
                $"    -> {result.ImportedCard.Name} ({result.ImportedCard.Type}, {result.ImportedCard.Alignment})"
            );
        }
        Console.ResetColor();
    }
    else
    {
        // Progress indicator for non-verbose mode
        Console.Write(".");
        if (processedCount % 50 == 0)
        {
            Console.WriteLine($" [{processedCount}]");
        }
    }
};

Console.WriteLine("================================================================");
Console.WriteLine("       Star Wars TCG Card Importer                             ");
Console.WriteLine("================================================================");
Console.WriteLine();

if (dryRun)
{
    Console.ForegroundColor = ConsoleColor.Cyan;
    Console.WriteLine("[DRY RUN MODE] No database changes will be made");
    Console.ResetColor();
    Console.WriteLine();
}

Console.WriteLine($"Cards path: {Path.GetFullPath(options.Value.CardsPath)}");
Console.WriteLine($"Delay: {options.Value.DelayMs}ms between cards");
if (!string.IsNullOrEmpty(packFilter))
{
    Console.WriteLine($"Pack filter: {packFilter}");
}
Console.WriteLine();

try
{
    var summary = await importService.ImportCardsAsync(packFilter, dryRun);

    Console.WriteLine();
    Console.WriteLine("================================================================");
    Console.WriteLine("                         SUMMARY                               ");
    Console.WriteLine("================================================================");
    Console.WriteLine($"  Total files:    {summary.TotalFiles}");
    Console.ForegroundColor = ConsoleColor.Green;
    Console.WriteLine($"  Imported:       {summary.Imported}");
    Console.ForegroundColor = ConsoleColor.Yellow;
    Console.WriteLine($"  Skipped:        {summary.Skipped}");
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine($"  Failed:         {summary.Failed}");
    Console.ResetColor();
    Console.WriteLine($"  Duration:       {summary.Duration:hh\\:mm\\:ss\\.fff}");
    Console.WriteLine("================================================================");

    // List failures if any
    var failures = summary.Results.Where(r => !r.Success && !r.Skipped).ToList();
    if (failures.Count > 0)
    {
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine("FAILURES:");
        foreach (var failure in failures)
        {
            Console.WriteLine($"  - {failure.FileName}: {failure.ErrorMessage}");
        }
        Console.ResetColor();
    }

    return failures.Count > 0 ? 1 : 0;
}
catch (Exception ex)
{
    logger.LogError(ex, "Import failed");
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine($"Import failed: {ex.Message}");
    Console.ResetColor();
    return 1;
}

// Helper functions for argument parsing
static bool HasFlag(string[] args, params string[] flags) =>
    args.Any(a => flags.Contains(a, StringComparer.OrdinalIgnoreCase));

static string? GetArgValue(string[] args, params string[] flags)
{
    for (int i = 0; i < args.Length - 1; i++)
    {
        if (flags.Contains(args[i], StringComparer.OrdinalIgnoreCase))
        {
            return args[i + 1];
        }
    }
    return null;
}

static void PrintHelp()
{
    Console.WriteLine(
        """
        Star Wars TCG Card Importer

        Imports card images into the database using AI analysis.

        Usage: Dao.SWC.CardImporter [options]

        Options:
          -p, --pack <name>     Filter to import only a specific pack (partial match)
          -d, --dry-run         Analyze cards without persisting to database
          --delay <ms>          Delay between cards in milliseconds (default: 500)
          -v, --verbose         Enable verbose output
          -h, --help            Show this help message

        Examples:
          Dao.SWC.CardImporter --dry-run --verbose
          Dao.SWC.CardImporter --pack "Attack of the Clones"
          Dao.SWC.CardImporter --delay 1000 --verbose
        """
    );
}
