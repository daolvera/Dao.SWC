using Dao.SWC.ApiService.Extensions;
using Dao.SWC.Core.DeckImport;
using Dao.SWC.Core.Decks;
using Dao.SWC.Core.Enums;
using Dao.SWC.Services.DeckImport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dao.SWC.ApiService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DecksController(
    IDeckService deckService,
    IDeckValidationService validationService,
    IDeckImportService importService
) : ControllerBase
{
    /// <summary>
    /// Get all decks for the current user.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<DeckListItemDto>), 200)]
    public async Task<IActionResult> GetUserDecks()
    {
        var userId = User.GetAppUserId();
        var decks = await deckService.GetUserDecksAsync(userId);
        return Ok(decks);
    }

    /// <summary>
    /// Get a specific deck by ID.
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(DeckDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetDeck(int id)
    {
        var userId = User.GetAppUserId();
        var deck = await deckService.GetDeckByIdAsync(id, userId);

        if (deck == null)
        {
            return NotFound();
        }

        return Ok(deck);
    }

    /// <summary>
    /// Create a new deck.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(DeckDto), 201)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> CreateDeck([FromBody] CreateDeckDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Deck name is required");
        }

        var userId = User.GetAppUserId();
        var deck = await deckService.CreateDeckAsync(userId, dto);
        return CreatedAtAction(nameof(GetDeck), new { id = deck.Id }, deck);
    }

    /// <summary>
    /// Update an existing deck.
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(DeckDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> UpdateDeck(int id, [FromBody] UpdateDeckDto dto)
    {
        var userId = User.GetAppUserId();
        var deck = await deckService.UpdateDeckAsync(id, userId, dto);

        if (deck == null)
        {
            return NotFound();
        }

        return Ok(deck);
    }

    /// <summary>
    /// Delete a deck.
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DeleteDeck(int id)
    {
        var userId = User.GetAppUserId();
        var success = await deckService.DeleteDeckAsync(id, userId);

        if (!success)
        {
            return NotFound();
        }

        return NoContent();
    }

    /// <summary>
    /// Validate a deck against game rules.
    /// </summary>
    [HttpGet("{id:int}/validate")]
    [ProducesResponseType(typeof(DeckValidationResult), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> ValidateDeck(int id)
    {
        var userId = User.GetAppUserId();
        var result = await validationService.ValidateDeckAsync(id, userId);
        return Ok(result);
    }

    /// <summary>
    /// Import a deck from a CSV file.
    /// </summary>
    /// <remarks>
    /// CSV format: Quantity,CardName,Version (header required)
    /// Example:
    /// Quantity,CardName,Version
    /// 3,Yoda,J
    /// 2,Mace Windu,C
    /// </remarks>
    [HttpPost("import")]
    [ProducesResponseType(typeof(DeckImportResult), 200)]
    [ProducesResponseType(typeof(DeckImportResult), 400)]
    public async Task<IActionResult> ImportDeck(
        IFormFile file,
        [FromForm] string deckName,
        [FromForm] Alignment alignment)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(DeckImportResult.Failure("No file uploaded"));
        }

        if (string.IsNullOrWhiteSpace(deckName))
        {
            return BadRequest(DeckImportResult.Failure("Deck name is required"));
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension != ".csv")
        {
            return BadRequest(DeckImportResult.Failure("Invalid file type. Please upload a CSV file."));
        }

        string csvContent;
        using (var reader = new StreamReader(file.OpenReadStream()))
        {
            csvContent = await reader.ReadToEndAsync();
        }

        var userId = User.GetAppUserId();
        var result = await importService.ImportDeckFromCsvAsync(
            userId,
            csvContent,
            deckName,
            alignment
        );

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Download a CSV template for deck import.
    /// </summary>
    [HttpGet("template")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(FileContentResult), 200)]
    public IActionResult DownloadTemplate()
    {
        const string template = "Quantity,CardName,Version\n";
        var bytes = System.Text.Encoding.UTF8.GetBytes(template);
        return File(bytes, "text/csv", "deck-template.csv");
    }

    /// <summary>
    /// Export a deck to CSV format.
    /// </summary>
    [HttpGet("{id:int}/export")]
    [ProducesResponseType(typeof(FileContentResult), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> ExportDeck(int id)
    {
        var userId = User.GetAppUserId();
        var deck = await deckService.GetDeckByIdAsync(id, userId);

        if (deck == null)
        {
            return NotFound();
        }

        var csv = new System.Text.StringBuilder();
        csv.AppendLine("Quantity,CardName,Version");

        foreach (var card in deck.Cards.OrderBy(c => c.Card.Name).ThenBy(c => c.Card.Version))
        {
            csv.AppendLine($"{card.Quantity},{card.Card.Name},{card.Card.Version ?? ""}");
        }

        var bytes = System.Text.Encoding.UTF8.GetBytes(csv.ToString());
        var fileName = $"{SanitizeFileName(deck.Name)}.csv";
        return File(bytes, "text/csv", fileName);
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Join("_", name.Split(invalid, StringSplitOptions.RemoveEmptyEntries));
    }
}
