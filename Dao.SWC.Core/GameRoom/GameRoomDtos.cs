namespace Dao.SWC.Core.GameRoom;

// Request DTOs
public record CreateRoomRequest(RoomType RoomType, int DeckId);

public record JoinRoomRequest(string RoomCode, int DeckId);

public record KickPlayerRequest(string RoomCode, string Username);

public record DrawCardRequest(string RoomCode, int Count = 1);

public record PlayCardRequest(string RoomCode, Guid CardInstanceId, int? ZonePosition = null);

public record DiscardCardRequest(string RoomCode, Guid CardInstanceId);

public record RollDiceRequest(string RoomCode, int NumberOfDice);

// New simplified DTOs for frontend
public record GameRoomDto(
    string RoomCode,
    RoomType RoomType,
    GameState State,
    IEnumerable<GamePlayerDto> Players,
    IEnumerable<TeamDataDto>? Teams,
    bool BidsRevealed
);

public record TeamDataDto(
    Team Team,
    int Force,
    int BuildCounter,
    Dictionary<string, IEnumerable<CardInstanceDto>> Arenas,
    IEnumerable<CardInstanceDto> BuildZone,
    bool SpaceArenaRetreated,
    bool GroundArenaRetreated,
    bool CharacterArenaRetreated,
    int? SecretBid
);

public record GamePlayerDto(
    string Username,
    string DeckName,
    Enums.Alignment Alignment,
    Team Team,
    bool IsHost,
    bool IsConnected,
    int Force,
    int BuildCounter,
    IEnumerable<CardInstanceDto> Hand,
    int HandSize,
    int DeckSize,
    Dictionary<string, IEnumerable<CardInstanceDto>> Arenas,
    IEnumerable<CardInstanceDto> DiscardPile,
    IEnumerable<CardInstanceDto> BuildZone,
    bool SpaceArenaRetreated,
    bool GroundArenaRetreated,
    bool CharacterArenaRetreated,
    int? SecretBid
);

public record CardInstanceDto(
    string InstanceId,
    int CardId,
    string CardName,
    string? CardImageUrl,
    int CardType,
    string? CardArena,
    string? Version,
    bool IsTapped,
    bool IsFaceDown,
    bool IsRetreated,
    int? Counter,
    int? Damage,
    string? StackParentId,
    IEnumerable<string> StackedUnderIds,
    string? OwnerUserId,
    // Piloting
    bool IsPilot,
    IEnumerable<string> PilotCardIds,
    string? PilotingUnitId,
    // Equipment
    string? EquipmentCardId,
    string? EquippedToUnitId
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
    Enums.Alignment Alignment,
    bool IsConnected,
    int CardsInDeck,
    int CardsInHand,
    int CardsInPlayArea,
    int CardsInDiscard
);

public record MyPlayerStateResponse(
    string UserId,
    string DisplayName,
    Enums.Alignment Alignment,
    IEnumerable<CardInstanceDto> Hand,
    IEnumerable<CardInstanceDto> PlayArea,
    IEnumerable<CardInstanceDto> DiscardPile,
    int CardsInDeck
);

public record DiceRollResponse(string UserId, string DisplayName, int[] Results, int Total);

// Event DTOs (for SignalR broadcasts)
public record PlayerJoinedEvent(string UserId, string DisplayName, Enums.Alignment Alignment);

public record PlayerLeftEvent(string UserId, string DisplayName);

public record PlayerKickedEvent(string UserId, string DisplayName, string Reason);

public record GameStartedEvent(string FirstTurnUserId);

public record TurnChangedEvent(string CurrentTurnUserId, string? PreviousTurnUserId);

public record CardsDrawnEvent(string UserId, int Count);

public record CardPlayedEvent(string UserId, CardInstanceDto Card);

public record CardDiscardedEvent(string UserId, CardInstanceDto Card);

// Stack operation result DTOs
public record StackResultDto(
    bool Success,
    string? ErrorMessage,
    CardInstanceDto? TopCard
);

// Pilot operation result DTOs
public record PilotResultDto(
    bool Success,
    string? ErrorMessage,
    CardInstanceDto? PilotCard,
    CardInstanceDto? UnitCard
);

// Equipment operation result DTOs
public record EquipmentResultDto(
    bool Success,
    string? ErrorMessage,
    CardInstanceDto? EquipmentCard,
    CardInstanceDto? UnitCard
);

public record PlayCardResultDto(
    bool Success,
    string? ErrorMessage,
    CardInstanceDto? Card,
    bool WasAutoStacked
);

// Bidding DTOs
public record BidSubmittedEvent(Team Team, int Bid, string SubmittedBy);

public record BidsRevealedEvent(IEnumerable<TeamBidDto> Bids);

public record BidsHiddenEvent();

public record TeamBidDto(Team Team, int? Bid, string? PlayerName);
