import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

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
    loadComponent: () =>
      import('./pages/decks/create-deck.component').then((m) => m.CreateDeckComponent),
  },
  {
    path: 'decks/:id/edit',
    canActivate: [authGuard],
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
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
