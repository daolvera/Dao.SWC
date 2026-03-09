import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Alignment, Arena, CardDto, CardType } from '../models/dtos/card.dto';

export interface CardFilter {
  search?: string;
  type?: CardType;
  alignment?: Alignment;
  arena?: Arena;
  skip?: number;
  take?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CardService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}api/cards`;

  getCards(filter?: CardFilter): Observable<CardDto[]> {
    let params = new HttpParams();

    if (filter) {
      if (filter.search) {
        params = params.set('search', filter.search);
      }
      if (filter.type !== undefined) {
        params = params.set('type', filter.type.toString());
      }
      if (filter.alignment !== undefined) {
        params = params.set('alignment', filter.alignment.toString());
      }
      if (filter.arena !== undefined) {
        params = params.set('arena', filter.arena.toString());
      }
      if (filter.skip !== undefined) {
        params = params.set('skip', filter.skip.toString());
      }
      if (filter.take !== undefined) {
        params = params.set('take', filter.take.toString());
      }
    }

    return this.http.get<CardDto[]>(this.baseUrl, { params });
  }

  getCard(id: number): Observable<CardDto> {
    return this.http.get<CardDto>(`${this.baseUrl}/${id}`);
  }
}
