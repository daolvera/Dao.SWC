import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UserDto } from '../models/dtos/user.dto';
import { environment } from '../../environments/environment';

export const Roles = {
  Admin: 'Admin',
  CardEditor: 'CardEditor',
} as const;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  public userInfo = signal<UserDto | null>(null);
  public isAuthenticated = computed(() => this.getCookie('user_authenticated') === 'true');
  private http = inject(HttpClient);
  private router = inject(Router);

  public hasRole(role: string): boolean {
    const user = this.userInfo();
    return user?.roles?.includes(role) ?? false;
  }

  public isAdmin = computed(() => this.hasRole(Roles.Admin));
  public isCardEditor = computed(() => this.hasRole(Roles.CardEditor) || this.hasRole(Roles.Admin));

  public loadUserInfo() {
    this.http.get<UserDto>(environment.apiUrl + '/Auth/me').subscribe((user) => {
      this.userInfo.set(user);
    });
  }

  public login() {
    let requestEndpoint: string = 'google';
    window.location.href = environment.apiUrl + `/Auth/${requestEndpoint}`;
  }

  public logout() {
    this.http.delete(environment.apiUrl + '/Auth/logout').subscribe(() => {
      this.userInfo.set(null);
      this.router.navigate(['/']);
      window.location.reload();
    });
  }

  public refreshToken() {
    // Skip spinner to avoid double-counting during auth interceptor retry flows
    const headers = new HttpHeaders().set('X-Skip-Spinner', 'true');
    return this.http.get(environment.apiUrl + '/Auth/refresh', { headers });
  }

  private getCookie(name: string): string | null {
    const nameEQ = name + '=';
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return cookie.substring(nameEQ.length);
      }
    }
    return null;
  }
}
