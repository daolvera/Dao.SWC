import { Alignment } from './card.dto';
import { CardDto } from './card.dto';

export interface DeckCardDto {
  cardId: number;
  quantity: number;
  card: CardDto;
}

export interface DeckDto {
  id: number;
  name: string;
  alignment: Alignment;
  createdAt: string;
  updatedAt: string | null;
  totalCards: number;
  cards: DeckCardDto[];
}

export interface DeckListItemDto {
  id: number;
  name: string;
  alignment: Alignment;
  createdAt: string;
  totalCards: number;
  isValid: boolean;
}

export interface CreateDeckDto {
  name: string;
  alignment: Alignment;
}

export interface UpdateDeckDto {
  name?: string;
  alignment?: Alignment;
  cards?: UpdateDeckCardDto[];
}

export interface UpdateDeckCardDto {
  cardId: number;
  quantity: number;
}

export interface DeckValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
