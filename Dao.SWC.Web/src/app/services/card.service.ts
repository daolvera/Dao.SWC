import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CardDto, CardUpdateDto, CardCreateDto } from '../models/dtos/card.dto';
import { CardFilter } from '../models/filters/card-filter';
import { PagedResult } from '../models/results/paged-result';
import { form } from '@angular/forms/signals';

@Injectable({
  providedIn: 'root',
})
export class CardService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/cards`;

  getCards(filter?: CardFilter): Observable<PagedResult<CardDto>> {
    let params = new HttpParams();

    if (filter) {
      if (filter.search) {
        params = params.set('search', filter.search);
      }
      if (filter.searchByName !== undefined) {
        params = params.set('searchByName', filter.searchByName.toString());
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
      if (filter.missingCardText !== undefined) {
        params = params.set('missingCardText', filter.missingCardText.toString());
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

  createCard(dto: CardCreateDto, image?: File): Observable<CardDto> {
    const formData = new FormData();
    formData.append('name', dto.name);
    formData.append('type', dto.type.toString());
    formData.append('alignment', dto.alignment.toString());
    formData.append('isPilot', dto.isPilot.toString());
    if (dto.arena !== null) {
      formData.append('arena', dto.arena.toString());
    }
    if (dto.version) {
      formData.append('version', dto.version);
    }
    if (dto.cardText) {
      formData.append('cardText', dto.cardText);
    }
    if (image) {
      formData.append('image', image);
    }
    return this.http.post<CardDto>(this.baseUrl, formData);
  }

  deleteCard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
