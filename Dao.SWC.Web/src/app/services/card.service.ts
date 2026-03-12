import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CardDto, CardUpdateDto } from '../models/dtos/card.dto';
import { CardFilter } from '../models/filters/card-filter';
import { PagedResult } from '../models/results/paged-result';

@Injectable({
  providedIn: 'root',
})
export class CardService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}api/cards`;

  getCards(filter?: CardFilter): Observable<PagedResult<CardDto>> {
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
      if (filter.page !== undefined) {
        params = params.set('page', filter.page.toString());
      }
      if (filter.pageSize !== undefined) {
        params = params.set('pageSize', filter.pageSize.toString());
      }
    }

    return this.http.get<PagedResult<CardDto>>(this.baseUrl, { params });
  }

  getCard(id: number): Observable<CardDto> {
    return this.http.get<CardDto>(`${this.baseUrl}/${id}`);
  }

  updateCard(id: number, dto: CardUpdateDto): Observable<CardDto> {
    return this.http.put<CardDto>(`${this.baseUrl}/${id}`, dto);
  }

  bulkUpdateCards(dtos: CardUpdateDto[]): Observable<CardDto[]> {
    return this.http.put<CardDto[]>(`${this.baseUrl}/bulk`, dtos);
  }
}
