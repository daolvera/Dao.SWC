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
    /// <returns>The public URL of the uploaded image.</returns>
    Task<string> UploadCardImageAsync(
        Stream imageStream,
        string packName,
        string fileName,
        CancellationToken cancellationToken = default
    );
}
