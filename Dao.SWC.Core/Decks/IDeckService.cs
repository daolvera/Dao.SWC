namespace Dao.SWC.Core.Decks;

public interface IDeckService
{
    Task<IEnumerable<DeckListItemDto>> GetUserDecksAsync(string userId);
    Task<DeckDto?> GetDeckByIdAsync(int deckId, string userId);
    Task<DeckDto> CreateDeckAsync(string userId, CreateDeckDto dto);
    Task<DeckDto?> UpdateDeckAsync(int deckId, string userId, UpdateDeckDto dto);
    Task<bool> DeleteDeckAsync(int deckId, string userId);
}
