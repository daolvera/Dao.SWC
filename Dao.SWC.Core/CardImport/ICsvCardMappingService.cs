namespace Dao.SWC.Core.CardImport;

/// <summary>
/// Service for reading card mappings from CSV files.
/// </summary>
public interface ICsvCardMappingService
{
    /// <summary>
    /// Loads card mappings from a CSV file for a specific pack.
    /// </summary>
    /// <param name="packDirectory">Path to the pack directory containing cards.csv.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Dictionary mapping filename to card mapping data.</returns>
    Task<Dictionary<string, CsvCardMapping>> LoadPackMappingsAsync(
        string packDirectory,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Gets a card mapping by filename from a loaded pack.
    /// </summary>
    /// <param name="packDirectory">Path to the pack directory.</param>
    /// <param name="fileName">The image filename.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The card mapping if found, null otherwise.</returns>
    Task<CsvCardMapping?> GetCardMappingAsync(
        string packDirectory,
        string fileName,
        CancellationToken cancellationToken = default
    );
}
