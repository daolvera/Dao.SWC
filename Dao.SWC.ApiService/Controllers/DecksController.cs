using Dao.SWC.ApiService.Extensions;
using Dao.SWC.Core.Decks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dao.SWC.ApiService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DecksController(IDeckService deckService, IDeckValidationService validationService)
    : ControllerBase
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
}
