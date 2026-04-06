import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  // Deck management routes
  {
    path: 'decks',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/decks/deck-list.component').then((m) => m.DeckListComponent),
  },
  {
    path: 'decks/new',
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/decks/create-deck.component').then((m) => m.CreateDeckComponent),
  },
  {
    path: 'decks/import',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/decks/import-deck.component').then((m) => m.ImportDeckComponent),
  },
  {
    path: 'decks/:id/edit',
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/decks/deck-builder.component').then((m) => m.DeckBuilderComponent),
  },
  // Game routes
  {
    path: 'play',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/game/lobby.component').then((m) => m.LobbyComponent),
  },
  {
    path: 'play/:roomCode',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/game/game-room.component').then((m) => m.GameRoomComponent),
  },
  // Admin routes
  {
    path: 'admin/cards',
    canActivate: [authGuard, roleGuard('CardEditor')],
    loadComponent: () =>
      import('./pages/admin/card-management/card-management.component').then(
        (m) => m.CardManagementComponent,
      ),
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/admin/user-stats/user-stats.component').then((m) => m.UserStatsComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
