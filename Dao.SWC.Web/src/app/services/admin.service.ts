import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserRoleDto {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export interface AssignRoleDto {
  email: string;
  role: string;
}

export interface SeedCardsResult {
  cardsAdded: number;
  totalCards: number;
}

export interface UserStatsDto {
  id: string;
  displayName: string;
  email: string;
  deckCount: number;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/admin`;

  getUsers(): Observable<UserRoleDto[]> {
    return this.http.get<UserRoleDto[]>(`${this.baseUrl}/users`);
  }

  getRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/roles`);
  }

  assignRole(email: string, role: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/roles/assign`, { email, role });
  }

  removeRole(email: string, role: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/roles/remove`, { email, role });
  }

  seedCards(): Observable<SeedCardsResult> {
    return this.http.post<SeedCardsResult>(`${this.baseUrl}/seed-cards`, {});
  }

  getUserStats(): Observable<UserStatsDto[]> {
    return this.http.get<UserStatsDto[]>(`${this.baseUrl}/user-stats`);
  }
}
