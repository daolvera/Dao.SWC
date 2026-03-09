import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/']);
    return false;
  }

  if (authService.userInfo() === null) {
    authService.loadUserInfo();
    return toObservable(authService.userInfo).pipe(
      filter((user) => user !== null),
      take(1),
      map(() => true),
    );
  }

  return true;
};
