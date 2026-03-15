namespace Dao.SWC.Core.CardImport;

/// <summary>
/// Service for uploading card images to blob storage.
/// </summary>
public interface ICardImageService
{
    /// <summary>
    /// Uploads a card image to blob storage.
    /// </summary>
    /// <param name="imageStream">The image file stream.</param>
    /// <param name="packName">The name of the card pack (used for folder organization).</param>
    /// <param name="fileName">The original filename.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The blob URL of the uploaded image (without SAS token).</returns>
    Task<string> UploadCardImageAsync(
        Stream imageStream,
        string packName,
        string fileName,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Generates a SAS token URL for reading a blob image.
    /// Uses User Delegation SAS for managed identity authentication.
    /// </summary>
    /// <param name="blobUrl">The blob URL (without SAS token).</param>
    /// <param name="expiresIn">Time until the SAS token expires (default: 1 hour).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The blob URL with SAS token for read access.</returns>
    Task<string> GenerateReadUrlAsync(
        string blobUrl,
        TimeSpan? expiresIn = null,
        CancellationToken cancellationToken = default
    );
}
