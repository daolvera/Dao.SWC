export enum RoomType {
  OneVOne = 0,
  TwoVTwo = 1,
}

export enum GameState {
  Waiting = 0,
  InProgress = 1,
  Finished = 2,
}

export enum Team {
  Alpha = 0,
  Beta = 1,
}

export interface GameRoomDto {
  roomCode: string;
  roomType: RoomType;
  state: GameState;
  currentTurn: number;
  players: GamePlayerDto[];
}

export interface GamePlayerDto {
  username: string;
  deckName: string;
  team: Team;
  isHost: boolean;
  isConnected: boolean;
  hand: CardInstanceDto[];
  deckSize: number;
  arenas: { [arena: string]: CardInstanceDto[] };
  discardPile: CardInstanceDto[];
}

export interface CardInstanceDto {
  instanceId: string;
  cardId: number;
  cardName: string;
  cardImageUrl: string | null;
  isTapped: boolean;
}

export interface DiceRolledEvent {
  username: string;
  results: number[];
}

// Legacy response types for compatibility
export interface RoomCreatedResponse {
  roomCode: string;
  roomType: RoomType;
}

export interface RoomStateResponse {
  roomCode: string;
  roomType: RoomType;
  state: GameState;
  hostUserId: string;
  currentTurnUserId: string | null;
  players: PlayerStateResponse[];
}

export interface PlayerStateResponse {
  userId: string;
  displayName: string;
  team: Team;
  isConnected: boolean;
  cardsInDeck: number;
  cardsInHand: number;
  cardsInPlayArea: number;
  cardsInDiscard: number;
}

export interface MyPlayerStateResponse {
  userId: string;
  displayName: string;
  team: Team;
  hand: CardInstanceDto[];
  playArea: CardInstanceDto[];
  discardPile: CardInstanceDto[];
  cardsInDeck: number;
}

export interface DiceRollResponse {
  userId: string;
  displayName: string;
  results: number[];
  total: number;
}

// Events
export interface PlayerJoinedEvent {
  userId: string;
  displayName: string;
  team: Team;
}

export interface PlayerLeftEvent {
  userId: string;
  displayName: string;
}

export interface PlayerKickedEvent {
  userId: string;
  displayName: string;
  reason: string;
}

export interface TeamAssignedEvent {
  userId: string;
  team: Team;
}

export interface GameStartedEvent {
  firstTurnUserId: string;
}

export interface TurnChangedEvent {
  currentTurnUserId: string;
  previousTurnUserId: string | null;
}

export interface CardsDrawnEvent {
  userId: string;
  count: number;
}

export interface CardPlayedEvent {
  userId: string;
  card: CardInstanceDto;
}

export interface CardDiscardedEvent {
  userId: string;
  card: CardInstanceDto;
}
