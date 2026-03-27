using Azure.AI.OpenAI;
using Dao.SWC.Core.CardImport;
using Dao.SWC.Core.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OpenAI.Chat;
using System.ClientModel;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Dao.SWC.Services.CardImport;

/// <summary>
/// Analyzes Star Wars TCG card images using Azure OpenAI GPT-4o vision.
/// </summary>
public partial class CardAnalysisService : ICardAnalysisService
{
    private readonly AzureOpenAIClient _openAiClient;
    private readonly AzureOpenAiOptions _options;
    private readonly ILogger<CardAnalysisService> _logger;

    private const string SystemPrompt = """
        You are an expert at analyzing Star Wars Trading Card Game cards. 
        Analyze the card image and extract the following information in JSON format:

        {
            "name": "The card name as shown on the card",
            "type": "One of: Unit, Location, Equipment, Mission, Battle",
            "alignment": "One of: Light, Dark, Neutral (determined by card border color - blue/white=Light, red/black=Dark, gray/gold=Neutral)",
            "arena": "For Unit/Location cards only: Space, Ground, or Character. Null for other types.",
            "version": "If the card is a unique character with a version letter (A, B, C, etc.), extract it. Otherwise null.",
            "cardText": "The rules text on the card (the text describing what the card does)",
            "confidence": "A number from 0.0 to 1.0 indicating your confidence",
            "notes": "Any warnings or issues encountered"
        }

        Rules for determining card properties:
        - Card TYPE is shown near the top of the card (Unit, Location, Equipment, Mission, Battle)
        - ALIGNMENT is determined by border color:
          * Light Side: Blue or white borders, Rebel/Republic symbols
          * Dark Side: Red or black borders, Imperial/Separatist symbols
          * Neutral: Gold or gray borders, no clear faction
        - ARENA is shown for Unit and Location cards (Space icon = Space, planet icon = Ground, person icon = Character)
        - VERSION is typically shown as a letter after the character name for unique characters
        - CARD TEXT is the rules text in the text box, not the flavor text in italics

        Respond ONLY with valid JSON, no markdown formatting.
        """;

    public CardAnalysisService(
        AzureOpenAIClient openAiClient,
        IOptions<AzureOpenAiOptions> options,
        ILogger<CardAnalysisService> logger
    )
    {
        _openAiClient = openAiClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<CardAnalysisResult> AnalyzeCardImageAsync(
        Stream imageStream,
        string fileName,
        CancellationToken cancellationToken = default
    )
    {
        _logger.LogDebug("Analyzing card image: {FileName}", fileName);

        // Read image bytes
        using var memoryStream = new MemoryStream();
        await imageStream.CopyToAsync(memoryStream, cancellationToken);
        var imageBytes = memoryStream.ToArray();
        var base64Image = Convert.ToBase64String(imageBytes);

        // Create chat client
        var chatClient = _openAiClient.GetChatClient(_options.DeploymentName);

        // Build message with image
        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(SystemPrompt),
            new UserChatMessage(
                ChatMessageContentPart.CreateTextPart(
                    $"Analyze this Star Wars TCG card. The filename is: {fileName}"
                ),
                ChatMessageContentPart.CreateTextPart(
                    $"Non units are sideways cards. Units are vertical. Purple outlines are for Characters, Green is for Ground, and Blue is for Space. The Red lightsaber in the corner is for Dark side cards, a blue lightsaber is for Light side cards, and a yello and brown bounty hunter symbol in the corner is for Neutral."
                ),
                ChatMessageContentPart.CreateImagePart(
                    BinaryData.FromBytes(imageBytes),
                    "image/jpeg"
                )
            ),
        };

        try
        {
            var response = await chatClient.CompleteChatAsync(
                messages,
                cancellationToken: cancellationToken
            );
            var content = response.Value.Content[0].Text;

            _logger.LogDebug("AI Response for {FileName}: {Response}", fileName, content);

            // Parse JSON response
            var result = ParseAnalysisResponse(content, fileName);
            return result;
        }
        catch (ClientResultException ex)
            when (ex.Message.Contains("rate limit", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(
                "Rate limited by Azure OpenAI, returning fallback result for {FileName}",
                fileName
            );
            return CreateFallbackResult(fileName, "Rate limited - manual review needed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error analyzing card {FileName}", fileName);
            return CreateFallbackResult(fileName, $"Analysis error: {ex.Message}");
        }
    }

    private CardAnalysisResult ParseAnalysisResponse(string jsonResponse, string fileName)
    {
        try
        {
            // Clean up response (remove markdown code blocks if present)
            var cleanJson = jsonResponse.Trim();
            if (cleanJson.StartsWith("```"))
            {
                cleanJson = JsonCodeBlockRegex().Replace(cleanJson, "").Trim();
            }

            var jsonDoc = JsonDocument.Parse(cleanJson);
            var root = jsonDoc.RootElement;

            // Parse required fields
            var name = root.GetProperty("name").GetString() ?? ExtractNameFromFileName(fileName);
            var typeStr = root.GetProperty("type").GetString() ?? "Mission";
            var alignmentStr = root.GetProperty("alignment").GetString() ?? "Neutral";

            // Parse optional fields
            string? arenaStr = null;
            if (
                root.TryGetProperty("arena", out var arenaProp)
                && arenaProp.ValueKind != JsonValueKind.Null
            )
            {
                arenaStr = arenaProp.GetString();
            }

            string? version = null;
            if (
                root.TryGetProperty("version", out var versionProp)
                && versionProp.ValueKind != JsonValueKind.Null
            )
            {
                version = versionProp.GetString();
            }

            // Fallback version extraction from filename if AI didn't detect it
            if (string.IsNullOrEmpty(version))
            {
                version = ExtractVersionFromFileName(fileName);
            }

            string? cardText = null;
            if (
                root.TryGetProperty("cardText", out var textProp)
                && textProp.ValueKind != JsonValueKind.Null
            )
            {
                cardText = textProp.GetString();
            }

            double confidence = 0.8;
            if (root.TryGetProperty("confidence", out var confProp))
            {
                confidence = confProp.GetDouble();
            }

            string? notes = null;
            if (
                root.TryGetProperty("notes", out var notesProp)
                && notesProp.ValueKind != JsonValueKind.Null
            )
            {
                notes = notesProp.GetString();
            }

            // Convert strings to enums
            var type = Enum.Parse<CardType>(typeStr, ignoreCase: true);
            var alignment = Enum.Parse<Alignment>(alignmentStr, ignoreCase: true);
            Arena? arena = null;
            if (!string.IsNullOrEmpty(arenaStr))
            {
                arena = Enum.Parse<Arena>(arenaStr, ignoreCase: true);
            }

            return new CardAnalysisResult
            {
                Name = name,
                Type = type,
                Alignment = alignment,
                Arena = arena,
                Version = version,
                CardText = cardText,
                Confidence = confidence,
                Notes = notes,
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to parse AI response for {FileName}, using fallback",
                fileName
            );
            return CreateFallbackResult(fileName, $"Parse error: {ex.Message}");
        }
    }

    private CardAnalysisResult CreateFallbackResult(string fileName, string errorNote)
    {
        var name = ExtractNameFromFileName(fileName);
        var version = ExtractVersionFromFileName(fileName);

        return new CardAnalysisResult
        {
            Name = name,
            Type = CardType.Mission, // Safe default
            Alignment = Alignment.Neutral,
            Arena = null,
            Version = version,
            CardText = null,
            Confidence = 0.0,
            Notes = errorNote,
        };
    }

    private static string ExtractNameFromFileName(string fileName)
    {
        // Remove extension
        var name = Path.GetFileNameWithoutExtension(fileName);

        // Remove version suffix (e.g., "_A", "_B")
        name = VersionSuffixRegex().Replace(name, "");

        // Replace underscores with spaces
        name = name.Replace('_', ' ');

        return name.Trim();
    }

    private static string? ExtractVersionFromFileName(string fileName)
    {
        // Look for version pattern like "_A", "_B", "_C" at end of filename
        var match = VersionSuffixRegex().Match(Path.GetFileNameWithoutExtension(fileName));
        return match.Success ? match.Groups[1].Value : null;
    }

    [GeneratedRegex(@"```(?:json)?\s*|\s*```", RegexOptions.Singleline)]
    private static partial Regex JsonCodeBlockRegex();

    [GeneratedRegex(@"_([A-Z])$", RegexOptions.IgnoreCase)]
    private static partial Regex VersionSuffixRegex();
}
