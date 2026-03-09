export enum CardType {
  Unit = 0,
  Location = 1,
  Equipment = 2,
  Mission = 3,
  Battle = 4,
}

export enum Alignment {
  Light = 0,
  Dark = 1,
  Neutral = 2,
}

export enum Arena {
  Space = 0,
  Ground = 1,
  Character = 2,
}

export interface CardDto {
  id: number;
  name: string;
  type: CardType;
  alignment: Alignment;
  arena: Arena | null;
  version: string | null;
  imageUrl: string | null;
  cardText: string | null;
}
