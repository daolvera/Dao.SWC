import { Alignment, Arena, CardType } from '../dtos/card.dto';

export interface CardFilter {
  search?: string;
  searchByName?: boolean;
  type?: CardType;
  alignment?: Alignment;
  arena?: Arena;
  page?: number;
  pageSize?: number;
}
