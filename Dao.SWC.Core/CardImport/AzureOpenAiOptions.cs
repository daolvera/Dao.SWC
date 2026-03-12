namespace Dao.SWC.Core.CardImport;

/// <summary>
/// Configuration options for Azure OpenAI.
/// </summary>
public class AzureOpenAiOptions
{
    public const string SectionName = "AzureOpenAi";

    /// <summary>
    /// The Azure OpenAI endpoint URL (e.g., https://YOUR_RESOURCE.openai.azure.com/).
    /// </summary>
    public required string Endpoint { get; set; }

    /// <summary>
    /// The Azure OpenAI API key.
    /// </summary>
    public required string Key { get; set; }

    /// <summary>
    /// The deployment name for the model (default: gpt-4o).
    /// </summary>
    public string DeploymentName { get; set; } = "gpt-4o";
}
