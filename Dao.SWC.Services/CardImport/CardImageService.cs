using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using Dao.SWC.Core;
using Dao.SWC.Core.CardImport;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace Dao.SWC.Services.CardImport;

/// <summary>
/// Uploads card images to Azure Blob Storage with public access.
/// </summary>
public partial class CardImageService : ICardImageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<CardImageService> _logger;
    private BlobContainerClient? _containerClient;

    public CardImageService(BlobServiceClient blobServiceClient, ILogger<CardImageService> logger)
    {
        _blobServiceClient = blobServiceClient;
        _logger = logger;
    }

    public async Task<string> UploadCardImageAsync(
        Stream imageStream,
        string packName,
        string fileName,
        CancellationToken cancellationToken = default
    )
    {
        var container = await GetOrCreateContainerAsync(cancellationToken);

        // Sanitize pack name for blob path (remove special chars, use lowercase)
        var sanitizedPackName = SanitizeForBlobPath(packName);
        var blobPath = $"{sanitizedPackName}/{fileName}";

        _logger.LogDebug("Uploading card image to: {BlobPath}", blobPath);

        var blobClient = container.GetBlobClient(blobPath);

        // Check if blob already exists
        if (await blobClient.ExistsAsync(cancellationToken))
        {
            _logger.LogDebug("Blob already exists: {BlobPath}", blobPath);
            return blobClient.Uri.ToString();
        }

        // Upload with content type
        await blobClient.UploadAsync(
            imageStream,
            new BlobHttpHeaders { ContentType = GetContentType(fileName) },
            cancellationToken: cancellationToken
        );

        _logger.LogInformation("Uploaded card image: {BlobPath}", blobPath);

        return blobClient.Uri.ToString();
    }

    public async Task<string> GenerateReadUrlAsync(
        string blobUrl,
        TimeSpan? expiresIn = null,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrEmpty(blobUrl))
        {
            return string.Empty;
        }
        if (blobUrl.Contains("http://127.0.0.1") || blobUrl.Contains("localhost"))
        {
            return blobUrl;
        }

        var expiry = expiresIn ?? TimeSpan.FromHours(1);

        try
        {
            // Parse the blob URL to get the blob client
            var blobUriBuilder = new BlobUriBuilder(new Uri(blobUrl));
            var containerClient = _blobServiceClient.GetBlobContainerClient(
                blobUriBuilder.BlobContainerName
            );
            var blobClient = containerClient.GetBlobClient(blobUriBuilder.BlobName);

            // Get a user delegation key for generating SAS tokens with managed identity
            var startsOn = DateTimeOffset.UtcNow.AddMinutes(-5); // Allow for clock skew
            var expiresOn = DateTimeOffset.UtcNow.Add(expiry);

            var userDelegationKey = await _blobServiceClient.GetUserDelegationKeyAsync(
                startsOn,
                expiresOn,
                cancellationToken
            );

            // Create the SAS builder
            var sasBuilder = new BlobSasBuilder
            {
                BlobContainerName = blobUriBuilder.BlobContainerName,
                BlobName = blobUriBuilder.BlobName,
                Resource = "b", // b = blob
                StartsOn = startsOn,
                ExpiresOn = expiresOn,
            };

            // Set read permissions
            sasBuilder.SetPermissions(BlobSasPermissions.Read);

            // Generate the SAS token using user delegation key
            var sasQueryParameters = sasBuilder.ToSasQueryParameters(
                userDelegationKey,
                _blobServiceClient.AccountName
            );

            // Build the full URL with SAS token
            blobUriBuilder.Sas = sasQueryParameters;

            _logger.LogDebug(
                "Generated user delegation SAS URL for blob: {BlobName}",
                blobClient.Name
            );

            return blobUriBuilder.ToUri().ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error generating user delegation SAS token for blob URL: {BlobUrl}",
                blobUrl
            );
            return blobUrl; // Return original URL as fallback
        }
    }

    private async Task<BlobContainerClient> GetOrCreateContainerAsync(
        CancellationToken cancellationToken
    )
    {
        if (_containerClient != null)
        {
            return _containerClient;
        }

        _containerClient = _blobServiceClient.GetBlobContainerClient(
            Constants.ImportOptions.CardsContainerName
        );

        // Create container with private access if it doesn't exist
        await _containerClient.CreateIfNotExistsAsync(
            publicAccessType: PublicAccessType.None,
            cancellationToken: cancellationToken
        );

        _logger.LogDebug(
            "Ensured container exists: {ContainerName}",
            Constants.ImportOptions.CardsContainerName
        );

        return _containerClient;
    }

    private static string SanitizeForBlobPath(string input)
    {
        // Remove leading number and period (e.g., "1. Attack of the Clones (2002)" -> "attack-of-the-clones-2002")
        var result = LeadingNumberRegex().Replace(input, "");

        // Remove parentheses content but keep the number
        result = result.Replace("(", "").Replace(")", "");

        // Replace spaces and special chars with dashes
        result = SpecialCharsRegex().Replace(result, "-");

        // Remove multiple dashes
        result = MultipleDashesRegex().Replace(result, "-");

        // Trim dashes from ends
        result = result.Trim('-');

        return result.ToLowerInvariant();
    }

    private static string GetContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "application/octet-stream",
        };
    }

    [GeneratedRegex(@"^\d+\.\s*")]
    private static partial Regex LeadingNumberRegex();

    [GeneratedRegex(@"[^a-zA-Z0-9\-]")]
    private static partial Regex SpecialCharsRegex();

    [GeneratedRegex(@"-+")]
    private static partial Regex MultipleDashesRegex();
}
