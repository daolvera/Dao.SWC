using System.Diagnostics;
using Dao.SWC.Core.CardImport;
using Dao.SWC.Core.Entities;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Dao.SWC.Services.CardImport;

/// <summary>
/// Orchestrates the card import process: iterates directories, uploads images,
/// analyzes with AI, and persists to database.
/// </summary>
public class CardImportService : ICardImportService
{
    private readonly SwcDbContext _dbContext;
    private readonly ICardAnalysisService _analysisService;
    private readonly ICardImageService _imageService;
    private readonly CardImportOptions _options;
    private readonly ILogger<CardImportService> _logger;

    public event Action<CardImportResult>? OnCardProcessed;

    public CardImportService(
        SwcDbContext dbContext,
        ICardAnalysisService analysisService,
        ICardImageService imageService,
        IOptions<CardImportOptions> options,
        ILogger<CardImportService> logger
    )
    {
        _dbContext = dbContext;
        _analysisService = analysisService;
        _imageService = imageService;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<ImportSummary> ImportCardsAsync(
        string? packFilter = null,
        bool dryRun = false,
        CancellationToken cancellationToken = default
    )
    {
        var stopwatch = Stopwatch.StartNew();
        var results = new List<CardImportResult>();

        var cardsPath = Path.GetFullPath(_options.CardsPath);
        _logger.LogInformation("Starting card import from: {CardsPath}", cardsPath);

        if (!Directory.Exists(cardsPath))
        {
            _logger.LogError("Cards directory not found: {CardsPath}", cardsPath);
            throw new DirectoryNotFoundException($"Cards directory not found: {cardsPath}");
        }

        // Get all pack directories
        var packDirs = Directory
            .GetDirectories(cardsPath)
            .Where(d =>
                packFilter == null
                || Path.GetFileName(d).Contains(packFilter, StringComparison.OrdinalIgnoreCase)
            )
            .OrderBy(d => d)
            .ToList();

        _logger.LogInformation("Found {PackCount} pack(s) to process", packDirs.Count);

        foreach (var packDir in packDirs)
        {
            var packName = Path.GetFileName(packDir);
            _logger.LogInformation("Processing pack: {PackName}", packName);

            // Get all image files in the pack directory
            var imageFiles = Directory
                .GetFiles(packDir, "*.jpg")
                .Concat(Directory.GetFiles(packDir, "*.png"))
                .OrderBy(f => f)
                .ToList();

            _logger.LogInformation(
                "Found {FileCount} card images in {PackName}",
                imageFiles.Count,
                packName
            );

            foreach (var imageFile in imageFiles)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    _logger.LogWarning("Import cancelled");
                    break;
                }

                var result = await ProcessCardAsync(imageFile, packName, dryRun, cancellationToken);
                results.Add(result);
                OnCardProcessed?.Invoke(result);

                // Rate limiting delay
                if (_options.DelayMs > 0)
                {
                    await Task.Delay(_options.DelayMs, cancellationToken);
                }
            }
        }

        stopwatch.Stop();

        var summary = new ImportSummary
        {
            TotalFiles = results.Count,
            Imported = results.Count(r => r.Success && !r.Skipped),
            Skipped = results.Count(r => r.Skipped),
            Failed = results.Count(r => !r.Success && !r.Skipped),
            Duration = stopwatch.Elapsed,
            Results = results,
        };

        _logger.LogInformation(
            "Import completed in {Duration}: {Imported} imported, {Skipped} skipped, {Failed} failed",
            summary.Duration,
            summary.Imported,
            summary.Skipped,
            summary.Failed
        );

        return summary;
    }

    private async Task<CardImportResult> ProcessCardAsync(
        string imageFile,
        string packName,
        bool dryRun,
        CancellationToken cancellationToken
    )
    {
        var fileName = Path.GetFileName(imageFile);
        _logger.LogDebug("Processing card: {FileName}", fileName);

        try
        {
            // Read image file
            await using var imageStream = File.OpenRead(imageFile);

            // Analyze with AI
            var analysis = await _analysisService.AnalyzeCardImageAsync(
                imageStream,
                fileName,
                cancellationToken
            );

            // Check if card already exists
            var existingCard = await _dbContext.Cards.FirstOrDefaultAsync(
                c => c.Name == analysis.Name && c.Version == analysis.Version,
                cancellationToken
            );

            if (existingCard != null)
            {
                _logger.LogDebug(
                    "Card already exists: {Name} {Version}",
                    analysis.Name,
                    analysis.Version
                );
                return new CardImportResult
                {
                    FileName = fileName,
                    PackName = packName,
                    Success = true,
                    Skipped = true,
                    SkipReason = $"Card already exists (ID: {existingCard.Id})",
                    ImportedCard = existingCard,
                };
            }

            // Upload image to blob storage (need to reopen stream)
            imageStream.Position = 0;
            var imageUrl = await _imageService.UploadCardImageAsync(
                imageStream,
                packName,
                fileName,
                cancellationToken
            );

            if (dryRun)
            {
                _logger.LogInformation(
                    "[DRY RUN] Would import: {Name} ({Type}, {Alignment}, {Arena}) - Confidence: {Confidence:P0}",
                    analysis.Name,
                    analysis.Type,
                    analysis.Alignment,
                    analysis.Arena,
                    analysis.Confidence
                );

                return new CardImportResult
                {
                    FileName = fileName,
                    PackName = packName,
                    Success = true,
                    Skipped = true,
                    SkipReason = "Dry run - no database changes",
                    ImportedCard = new Card
                    {
                        Name = analysis.Name,
                        Type = analysis.Type,
                        Alignment = analysis.Alignment,
                        Arena = analysis.Arena,
                        Version = analysis.Version,
                        CardText = analysis.CardText,
                        ImageUrl = imageUrl,
                    },
                };
            }

            // Create and save card
            var card = new Card
            {
                Name = analysis.Name,
                Type = analysis.Type,
                Alignment = analysis.Alignment,
                Arena = analysis.Arena,
                Version = analysis.Version,
                CardText = analysis.CardText,
                ImageUrl = imageUrl,
            };

            _dbContext.Cards.Add(card);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Imported card: {Name} ({Type}, {Alignment}) - ID: {Id}",
                card.Name,
                card.Type,
                card.Alignment,
                card.Id
            );

            return new CardImportResult
            {
                FileName = fileName,
                PackName = packName,
                Success = true,
                Skipped = false,
                ImportedCard = card,
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing card: {FileName}", fileName);
            return new CardImportResult
            {
                FileName = fileName,
                PackName = packName,
                Success = false,
                Skipped = false,
                ErrorMessage = ex.Message,
            };
        }
    }
}
