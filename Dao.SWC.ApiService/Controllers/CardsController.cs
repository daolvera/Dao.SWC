using Dao.SWC.Core;
using Dao.SWC.Core.CardImport;
using Dao.SWC.Core.Decks;
using Dao.SWC.Core.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dao.SWC.ApiService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CardsController(ICardService cardService, ICardImageService imageService)
    : ControllerBase
{
    /// <summary>
    /// Get cards with pagination and optional filtering.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<CardDto>), 200)]
    public async Task<IActionResult> GetCards(
        [FromQuery] string? search = null,
        [FromQuery] CardType? type = null,
        [FromQuery] Alignment? alignment = null,
        [FromQuery] Arena? arena = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50
    )
    {
        var filter = new CardFilterDto(search, type, alignment, arena, page, pageSize);
        var result = await cardService.GetCardsPagedAsync(filter);
        return Ok(result);
    }

    /// <summary>
    /// Get a specific card by ID.
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(CardDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetCard(int id)
    {
        var card = await cardService.GetCardByIdAsync(id);

        if (card == null)
        {
            return NotFound();
        }

        return Ok(card);
    }

    /// <summary>
    /// Create a new card with optional image upload. Requires CardEditor role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = $"{Constants.Roles.Admin},{Constants.Roles.CardEditor}")]
    [ProducesResponseType(typeof(CardDto), 201)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> CreateCard([FromForm] CardCreateFormDto form)
    {
        string? imageUrl = null;

        // Handle image upload if provided
        if (form.Image != null && form.Image.Length > 0)
        {
            // Validate file type
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(form.Image.ContentType.ToLower()))
            {
                return BadRequest("Invalid file type. Allowed types: JPEG, PNG, GIF, WebP");
            }

            // Validate file size (max 5MB)
            if (form.Image.Length > 5 * 1024 * 1024)
            {
                return BadRequest("File size exceeds 5MB limit");
            }

            using var stream = form.Image.OpenReadStream();
            imageUrl = await imageService.UploadCardImageAsync(
                stream,
                "custom",
                form.Image.FileName
            );
        }

        var dto = new CardCreateDto(
            form.Name,
            form.Type,
            form.Alignment,
            form.Arena,
            form.Version,
            imageUrl,
            form.CardText
        );

        var result = await cardService.CreateCardAsync(dto);
        return CreatedAtAction(nameof(GetCard), new { id = result.Id }, result);
    }

    /// <summary>
    /// Upload a card image. Requires CardEditor role.
    /// </summary>
    [HttpPost("upload-image")]
    [Authorize(Roles = $"{Constants.Roles.Admin},{Constants.Roles.CardEditor}")]
    [ProducesResponseType(typeof(ImageUploadResult), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> UploadImage(
        IFormFile file,
        [FromQuery] string? packName = "custom"
    )
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file uploaded");
        }

        // Validate file type
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
        {
            return BadRequest("Invalid file type. Allowed types: JPEG, PNG, GIF, WebP");
        }

        // Validate file size (max 5MB)
        if (file.Length > 5 * 1024 * 1024)
        {
            return BadRequest("File size exceeds 5MB limit");
        }

        using var stream = file.OpenReadStream();
        var blobUrl = await imageService.UploadCardImageAsync(
            stream,
            packName ?? "custom",
            file.FileName
        );
        var sasUrl = await imageService.GenerateReadUrlAsync(blobUrl);

        return Ok(new ImageUploadResult(blobUrl, sasUrl));
    }

    /// <summary>
    /// Update a single card. Requires CardEditor role.
    /// </summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = $"{Constants.Roles.Admin},{Constants.Roles.CardEditor}")]
    [ProducesResponseType(typeof(CardDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> UpdateCard(int id, [FromBody] CardUpdateDto dto)
    {
        if (id != dto.Id)
        {
            return BadRequest("ID mismatch");
        }

        var result = await cardService.UpdateCardAsync(dto);
        if (result == null)
        {
            return NotFound();
        }

        return Ok(result);
    }

    /// <summary>
    /// Bulk update multiple cards. Requires CardEditor role.
    /// </summary>
    [HttpPut("bulk")]
    [Authorize(Roles = $"{Constants.Roles.Admin},{Constants.Roles.CardEditor}")]
    [ProducesResponseType(typeof(IEnumerable<CardDto>), 200)]
    public async Task<IActionResult> BulkUpdateCards([FromBody] IEnumerable<CardUpdateDto> dtos)
    {
        var result = await cardService.BulkUpdateCardsAsync(dtos);
        return Ok(result);
    }

    /// <summary>
    /// Delete a card by ID. Requires CardEditor role.
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = $"{Constants.Roles.Admin},{Constants.Roles.CardEditor}")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DeleteCard(int id)
    {
        var deleted = await cardService.DeleteCardAsync(id);
        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }
}

public record ImageUploadResult(string BlobUrl, string SasUrl);

/// <summary>
/// Form data for creating a card with optional image upload.
/// </summary>
public class CardCreateFormDto
{
    public required string Name { get; set; }
    public CardType Type { get; set; }
    public Alignment Alignment { get; set; }
    public Arena? Arena { get; set; }
    public string? Version { get; set; }
    public string? CardText { get; set; }
    public IFormFile? Image { get; set; }
}
