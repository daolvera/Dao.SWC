using Dao.SWC.Core;
using Dao.SWC.Core.Decks;
using Dao.SWC.Core.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dao.SWC.ApiService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CardsController(ICardService cardService) : ControllerBase
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
}
