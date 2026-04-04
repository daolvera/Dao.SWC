import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Alignment } from '../models/dtos/card.dto';
import {
  CreateDeckDto,
  DeckDto,
  DeckImportResult,
  DeckListItemDto,
  DeckValidationResult,
  UpdateDeckDto,
} from '../models/dtos/deck.dto';

@Injectable({
  providedIn: 'root',
})
export class DeckService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/decks`;

  // Cached list of user's decks
  public userDecks = signal<DeckListItemDto[]>([]);

  getUserDecks(): Observable<DeckListItemDto[]> {
    return this.http
      .get<DeckListItemDto[]>(this.baseUrl)
      .pipe(tap((decks) => this.userDecks.set(decks)));
  }

  getDeck(id: number): Observable<DeckDto> {
    return this.http.get<DeckDto>(`${this.baseUrl}/${id}`);
  }

  createDeck(dto: CreateDeckDto): Observable<DeckDto> {
    return this.http.post<DeckDto>(this.baseUrl, dto);
  }

  updateDeck(id: number, dto: UpdateDeckDto): Observable<DeckDto> {
    return this.http.put<DeckDto>(`${this.baseUrl}/${id}`, dto);
  }

  deleteDeck(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  validateDeck(id: number): Observable<DeckValidationResult> {
    return this.http.get<DeckValidationResult>(`${this.baseUrl}/${id}/validate`);
  }

  importDeck(file: File, deckName: string, alignment: Alignment): Observable<DeckImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('deckName', deckName);
    formData.append('alignment', alignment.toString());
    return this.http.post<DeckImportResult>(`${this.baseUrl}/import`, formData);
  }

  getTemplateUrl(): string {
    return `${this.baseUrl}/template`;
  }

  getExportUrl(deckId: number): string {
    return `${this.baseUrl}/${deckId}/export`;
  }
}
