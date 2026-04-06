import { Alignment } from './card.dto';

export enum RoomType {
  OneVOne,
  TwoVTwo,
  OneVTwo,
}

export enum GameState {
  Waiting,
  InProgress,
  Finished,
}

export enum Team {
  Team1,
  Team2,
}

export interface GameRoomDto {
  roomCode: string;
  roomType: RoomType;
  state: GameState;
  players: GamePlayerDto[];
  teams: TeamDataDto[] | null;
  bidsRevealed: boolean;
}

export interface TeamDataDto {
  team: Team;
  force: number;
  buildCounter: number;
  arenas: { [arena: string]: CardInstanceDto[] };
  buildZone: CardInstanceDto[];
  spaceArenaRetreated: boolean;
  groundArenaRetreated: boolean;
  characterArenaRetreated: boolean;
  secretBid: number | null;
}

export interface GamePlayerDto {
  username: string;
  deckName: string;
  alignment: Alignment;
  team: Team;
  isHost: boolean;
  isConnected: boolean;
  force: number;
  buildCounter: number;
  hand: CardInstanceDto[];
  handSize: number;
  deckSize: number;
  arenas: { [arena: string]: CardInstanceDto[] };
  discardPile: CardInstanceDto[];
  buildZone: CardInstanceDto[];
  spaceArenaRetreated: boolean;
  groundArenaRetreated: boolean;
  characterArenaRetreated: boolean;
  secretBid: number | null;
}

export interface CardInstanceDto {
  instanceId: string;
  cardId: number;
  cardName: string;
  cardImageUrl: string | null;
  cardType: number;
  cardArena: string | null;
  version: string | null;
  isTapped: boolean;
  isFaceDown: boolean;
  isRetreated: boolean;
  counter: number | null;
  damage: number | null;
  stackParentId: string | null;
  stackedUnderIds: string[];
  ownerUserId: string | null;
  // Piloting
  isPilot: boolean;
  pilotCardIds: string[];
  pilotingUnitId: string | null;
  // Equipment
  equipmentCardId: string | null;
  equippedToUnitId: string | null;
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
  alignment: Alignment;
  isConnected: boolean;
  cardsInDeck: number;
  cardsInHand: number;
  cardsInPlayArea: number;
  cardsInDiscard: number;
}

export interface MyPlayerStateResponse {
  userId: string;
  displayName: string;
  alignment: Alignment;
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
  alignment: Alignment;
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

// Stack operation result
export interface StackResultDto {
  success: boolean;
  errorMessage: string | null;
  topCard: CardInstanceDto | null;
}

// Pilot operation result
export interface PilotResultDto {
  success: boolean;
  errorMessage: string | null;
  pilotCard: CardInstanceDto | null;
  unitCard: CardInstanceDto | null;
}

// Equipment operation result
export interface EquipmentResultDto {
  success: boolean;
  errorMessage: string | null;
  equipmentCard: CardInstanceDto | null;
  unitCard: CardInstanceDto | null;
}

// Play card result (for auto-stacking)
export interface PlayCardResultDto {
  success: boolean;
  errorMessage: string | null;
  card: CardInstanceDto | null;
  wasAutoStacked: boolean;
}

// Chat message
export interface ChatMessage {
  username: string;
  message: string;
}
