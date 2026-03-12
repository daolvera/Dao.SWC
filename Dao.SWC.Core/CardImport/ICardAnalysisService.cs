namespace Dao.SWC.Core.CardImport;

/// <summary>
/// Service for analyzing card images using AI vision capabilities.
/// </summary>
public interface ICardAnalysisService
{
    /// <summary>
    /// Analyzes a card image and extracts card properties.
    /// </summary>
    /// <param name="imageStream">The image file stream.</param>
    /// <param name="fileName">The original filename (used for version extraction fallback).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Analysis result containing extracted card properties.</returns>
    Task<CardAnalysisResult> AnalyzeCardImageAsync(
        Stream imageStream,
        string fileName,
        CancellationToken cancellationToken = default
    );
}
