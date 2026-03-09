namespace Dao.SWC.Core.GameRoom;

// Request DTOs
public record CreateRoomRequest(RoomType RoomType, int DeckId);

public record JoinRoomRequest(string RoomCode, int DeckId);

public record KickPlayerRequest(string RoomCode, string Username);

public record AssignTeamRequest(string RoomCode, string UserId, Team Team);

public record DrawCardRequest(string RoomCode, int Count = 1);

public record PlayCardRequest(string RoomCode, Guid CardInstanceId, int? ZonePosition = null);

public record DiscardCardRequest(string RoomCode, Guid CardInstanceId);

public record RollDiceRequest(string RoomCode, int NumberOfDice);

// New simplified DTOs for frontend
public record GameRoomDto(
    string RoomCode,
    RoomType RoomType,
    GameState State,
    int CurrentTurn,
    IEnumerable<GamePlayerDto> Players
);

public record GamePlayerDto(
    string Username,
    string DeckName,
    Team Team,
    bool IsHost,
    bool IsConnected,
    IEnumerable<CardInstanceDto> Hand,
    int DeckSize,
    Dictionary<string, IEnumerable<CardInstanceDto>> Arenas,
    IEnumerable<CardInstanceDto> DiscardPile
);

public record CardInstanceDto(
    string InstanceId,
    int CardId,
    string CardName,
    string? CardImageUrl,
    bool IsTapped
);

public record DiceRolledEvent(string Username, int[] Results);

// Legacy Response DTOs (keeping for backward compatibility)
public record RoomCreatedResponse(string RoomCode, RoomType RoomType);

public record RoomStateResponse(
    string RoomCode,
    RoomType RoomType,
    GameState State,
    string HostUserId,
    string? CurrentTurnUserId,
    IEnumerable<PlayerStateResponse> Players
);

public record PlayerStateResponse(
    string UserId,
    string DisplayName,
    Team Team,
    bool IsConnected,
    int CardsInDeck,
    int CardsInHand,
    int CardsInPlayArea,
    int CardsInDiscard
);

public record MyPlayerStateResponse(
    string UserId,
    string DisplayName,
    Team Team,
    IEnumerable<CardInstanceDto> Hand,
    IEnumerable<CardInstanceDto> PlayArea,
    IEnumerable<CardInstanceDto> DiscardPile,
    int CardsInDeck
);

public record DiceRollResponse(string UserId, string DisplayName, int[] Results, int Total);

// Event DTOs (for SignalR broadcasts)
public record PlayerJoinedEvent(string UserId, string DisplayName, Team Team);

public record PlayerLeftEvent(string UserId, string DisplayName);

public record PlayerKickedEvent(string UserId, string DisplayName, string Reason);

public record TeamAssignedEvent(string UserId, Team Team);

public record GameStartedEvent(string FirstTurnUserId);

public record TurnChangedEvent(string CurrentTurnUserId, string? PreviousTurnUserId);

public record CardsDrawnEvent(string UserId, int Count);

public record CardPlayedEvent(string UserId, CardInstanceDto Card);

public record CardDiscardedEvent(string UserId, CardInstanceDto Card);
