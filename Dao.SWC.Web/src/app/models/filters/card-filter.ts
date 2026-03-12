import { Alignment, Arena, CardType } from '../dtos/card.dto';

export interface CardFilter {
  search?: string;
  type?: CardType;
  alignment?: Alignment;
  arena?: Arena;
  page?: number;
  pageSize?: number;
}
