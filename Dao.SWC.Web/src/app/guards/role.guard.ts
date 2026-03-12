import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

export function roleGuard(requiredRole: string): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // First check if authenticated
    if (!authService.isAuthenticated()) {
      router.navigate(['/']);
      return false;
    }

    // If user info not loaded yet, wait for it
    if (authService.userInfo() === null) {
      authService.loadUserInfo();
      return toObservable(authService.userInfo).pipe(
        filter((user) => user !== null),
        take(1),
        map((user) => {
          if (user?.roles?.includes(requiredRole)) {
            return true;
          }
          router.navigate(['/']);
          return false;
        }),
      );
    }

    // User info already loaded, check role
    if (authService.hasRole(requiredRole)) {
      return true;
    }

    router.navigate(['/']);
    return false;
  };
}
