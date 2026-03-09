namespace Dao.SWC.Core.Decks;

public interface IDeckValidationService
{
    Task<DeckValidationResult> ValidateDeckAsync(int deckId, string userId);
}
