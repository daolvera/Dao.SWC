using Dao.SWC.Core.Decks;
using Dao.SWC.Core.Enums;
using Microsoft.AspNetCore.Mvc;

namespace Dao.SWC.ApiService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CardsController(ICardService cardService) : ControllerBase
{
    /// <summary>
    /// Get all cards with optional filtering.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<CardDto>), 200)]
    public async Task<IActionResult> GetCards(
        [FromQuery] string? search = null,
        [FromQuery] CardType? type = null,
        [FromQuery] Alignment? alignment = null,
        [FromQuery] Arena? arena = null,
        [FromQuery] int? skip = null,
        [FromQuery] int? take = null
    )
    {
        var filter = new CardFilterDto(search, type, alignment, arena, skip, take);
        var cards = await cardService.GetCardsAsync(filter);
        return Ok(cards);
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
}
