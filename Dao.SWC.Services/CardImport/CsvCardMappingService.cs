using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Dao.SWC.Core.CardImport;
using Dao.SWC.Core.Enums;
using Microsoft.Extensions.Logging;

namespace Dao.SWC.Services.CardImport;

/// <summary>
/// Reads card mappings from CSV files in pack directories.
/// </summary>
public class CsvCardMappingService : ICsvCardMappingService
{
    private const string CsvFileName = "cards.csv";
    private readonly ILogger<CsvCardMappingService> _logger;
    private readonly Dictionary<string, Dictionary<string, CsvCardMapping>> _cache = new();

    public CsvCardMappingService(ILogger<CsvCardMappingService> logger)
    {
        _logger = logger;
    }

    public async Task<Dictionary<string, CsvCardMapping>> LoadPackMappingsAsync(
        string packDirectory,
        CancellationToken cancellationToken = default
    )
    {
        // Check cache first
        if (_cache.TryGetValue(packDirectory, out var cached))
        {
            return cached;
        }

        var csvPath = Path.Combine(packDirectory, CsvFileName);

        if (!File.Exists(csvPath))
        {
            _logger.LogWarning("No cards.csv found in: {PackDirectory}", packDirectory);
            return new Dictionary<string, CsvCardMapping>();
        }

        _logger.LogDebug("Loading card mappings from: {CsvPath}", csvPath);

        var mappings = new Dictionary<string, CsvCardMapping>(StringComparer.OrdinalIgnoreCase);

        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            MissingFieldFound = null,
            HeaderValidated = null,
        };

        using var reader = new StreamReader(csvPath);
        using var csv = new CsvReader(reader, config);

        await foreach (var record in csv.GetRecordsAsync<CsvCardMappingDto>(cancellationToken))
        {
            var mapping = MapToCardMapping(record);
            if (mapping != null)
            {
                mappings[mapping.FileName] = mapping;
            }
        }

        _logger.LogInformation(
            "Loaded {Count} card mappings from: {PackDirectory}",
            mappings.Count,
            Path.GetFileName(packDirectory)
        );

        _cache[packDirectory] = mappings;
        return mappings;
    }

    public async Task<CsvCardMapping?> GetCardMappingAsync(
        string packDirectory,
        string fileName,
        CancellationToken cancellationToken = default
    )
    {
        var mappings = await LoadPackMappingsAsync(packDirectory, cancellationToken);
        return mappings.TryGetValue(fileName, out var mapping) ? mapping : null;
    }

    private CsvCardMapping? MapToCardMapping(CsvCardMappingDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FileName) || string.IsNullOrWhiteSpace(dto.Name))
        {
            _logger.LogWarning("Skipping invalid CSV row: missing FileName or Name");
            return null;
        }

        // Parse enums with fallback defaults
        var cardType = ParseEnum<CardType>(dto.Type, CardType.Unit);
        var alignment = ParseEnum<Alignment>(dto.Alignment, Alignment.Neutral);
        Arena? arena = string.IsNullOrWhiteSpace(dto.Arena)
            ? null
            : ParseEnum<Arena>(dto.Arena, Arena.Character);

        // Parse IsPilot boolean
        var isPilot = ParseBool(dto.IsPilot);

        return new CsvCardMapping
        {
            FileName = dto.FileName.Trim(),
            Name = dto.Name.Trim(),
            Type = cardType,
            Alignment = alignment,
            Arena = arena,
            Version = string.IsNullOrWhiteSpace(dto.Version) ? null : dto.Version.Trim(),
            IsPilot = isPilot,
            CardText = string.IsNullOrWhiteSpace(dto.CardText) ? null : dto.CardText.Trim(),
        };
    }

    private static T ParseEnum<T>(string? value, T defaultValue) where T : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return defaultValue;
        }

        return Enum.TryParse<T>(value.Trim(), ignoreCase: true, out var result)
            ? result
            : defaultValue;
    }

    private static bool ParseBool(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var trimmed = value.Trim().ToLowerInvariant();
        return trimmed == "true" || trimmed == "1" || trimmed == "yes";
    }

    /// <summary>
    /// Internal DTO for CSV parsing (allows string properties for flexible parsing).
    /// </summary>
    private class CsvCardMappingDto
    {
        public string? FileName { get; set; }
        public string? Name { get; set; }
        public string? Type { get; set; }
        public string? Alignment { get; set; }
        public string? Arena { get; set; }
        public string? Version { get; set; }
        public string? IsPilot { get; set; }
        public string? CardText { get; set; }
    }
}
