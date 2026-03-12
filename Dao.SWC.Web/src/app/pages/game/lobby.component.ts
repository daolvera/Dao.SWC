import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DeckListItemDto } from '../../models/dtos/deck.dto';
import { RoomType } from '../../models/dtos/game.dto';
import { DeckService } from '../../services/deck.service';
import { GameHubService } from '../../services/game-hub.service';

@Component({
  selector: 'app-lobby',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4">
      <h1 class="mb-4">Game Lobby</h1>

      @if (error()) {
        <div class="alert alert-danger alert-dismissible">
          {{ error() }}
          <button type="button" class="btn-close" (click)="error.set(null)"></button>
        </div>
      }

      <div class="row">
        <!-- Create Room -->
        <div class="col-md-6 mb-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="mb-0">Create Room</h5>
            </div>
            <div class="card-body">
              <form [formGroup]="createForm" (ngSubmit)="createRoom()">
                <div class="mb-3">
                  <label class="form-label">Room Type</label>
                  <div class="btn-group w-100" role="group">
                    <input
                      type="radio"
                      class="btn-check"
                      id="oneVOne"
                      [value]="RoomType.OneVOne"
                      formControlName="roomType"
                    />
                    <label class="btn btn-outline-primary" for="oneVOne">1v1</label>

                    <input
                      type="radio"
                      class="btn-check"
                      id="oneVTwo"
                      [value]="RoomType.OneVTwo"
                      formControlName="roomType"
                    />
                    <label class="btn btn-outline-primary" for="oneVTwo">1v2</label>

                    <input
                      type="radio"
                      class="btn-check"
                      id="twoVTwo"
                      [value]="RoomType.TwoVTwo"
                      formControlName="roomType"
                    />
                    <label class="btn btn-outline-primary" for="twoVTwo">2v2</label>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Select Deck</label>
                  @if (loadingDecks()) {
                    <div class="text-center py-2">
                      <div class="spinner-border spinner-border-sm"></div>
                    </div>
                  } @else if (validDecks().length === 0) {
                    <div class="alert alert-warning mb-0">
                      No valid decks available.
                      <a routerLink="/decks">Build a deck</a> first.
                    </div>
                  } @else {
                    <select class="form-select" formControlName="deckId">
                      <option [value]="null" disabled>Choose a deck...</option>
                      @for (deck of validDecks(); track deck.id) {
                        <option [value]="deck.id">
                          {{ deck.name }} ({{ deck.alignment === 0 ? 'Dark' : 'Light' }})
                        </option>
                      }
                    </select>
                  }
                </div>

                <button
                  type="submit"
                  class="btn btn-primary w-100"
                  [disabled]="createForm.invalid || creating()"
                >
                  @if (creating()) {
                    <span class="spinner-border spinner-border-sm me-2"></span>
                  }
                  Create Room
                </button>
              </form>
            </div>
          </div>
        </div>

        <!-- Join Room -->
        <div class="col-md-6 mb-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="mb-0">Join Room</h5>
            </div>
            <div class="card-body">
              <form [formGroup]="joinForm" (ngSubmit)="joinRoom()">
                <div class="mb-3">
                  <label class="form-label">Room Code</label>
                  <input
                    type="text"
                    class="form-control text-uppercase"
                    formControlName="roomCode"
                    placeholder="Enter 6-character code"
                    maxlength="6"
                  />
                </div>

                <div class="mb-3">
                  <label class="form-label">Select Deck</label>
                  @if (loadingDecks()) {
                    <div class="text-center py-2">
                      <div class="spinner-border spinner-border-sm"></div>
                    </div>
                  } @else if (validDecks().length === 0) {
                    <div class="alert alert-warning mb-0">
                      No valid decks available.
                      <a routerLink="/decks">Build a deck</a> first.
                    </div>
                  } @else {
                    <select class="form-select" formControlName="deckId">
                      <option [value]="null" disabled>Choose a deck...</option>
                      @for (deck of validDecks(); track deck.id) {
                        <option [value]="deck.id">
                          {{ deck.name }} ({{ deck.alignment === 0 ? 'Dark' : 'Light' }})
                        </option>
                      }
                    </select>
                  }
                </div>

                <button
                  type="submit"
                  class="btn btn-success w-100"
                  [disabled]="joinForm.invalid || joining()"
                >
                  @if (joining()) {
                    <span class="spinner-border spinner-border-sm me-2"></span>
                  }
                  Join Room
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  imports: [ReactiveFormsModule, RouterLink],
})
export class LobbyComponent implements OnInit {
  protected readonly RoomType = RoomType;

  private router = inject(Router);
  private deckService = inject(DeckService);
  private gameHub = inject(GameHubService);

  // State
  decks = signal<DeckListItemDto[]>([]);
  validDecks = signal<DeckListItemDto[]>([]);
  loadingDecks = signal(false);
  creating = signal(false);
  joining = signal(false);
  error = signal<string | null>(null);

  // Forms
  createForm = new FormGroup({
    roomType: new FormControl<RoomType>(RoomType.OneVOne, { nonNullable: true }),
    deckId: new FormControl<number | null>(null, [Validators.required]),
  });

  joinForm = new FormGroup({
    roomCode: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(6),
    ]),
    deckId: new FormControl<number | null>(null, [Validators.required]),
  });

  ngOnInit(): void {
    this.loadDecks();
    this.connectToHub();
  }

  private loadDecks(): void {
    this.loadingDecks.set(true);
    this.deckService.getUserDecks().subscribe({
      next: (decks) => {
        this.decks.set(decks);
        this.validDecks.set(decks.filter((d) => d.isValid));
        this.loadingDecks.set(false);
      },
      error: () => {
        this.loadingDecks.set(false);
      },
    });
  }

  private async connectToHub(): Promise<void> {
    try {
      await this.gameHub.connect();
    } catch {
      this.error.set('Failed to connect to game server');
    }
  }

  async createRoom(): Promise<void> {
    if (this.createForm.invalid) return;

    this.creating.set(true);
    this.error.set(null);

    const { roomType, deckId } = this.createForm.value;

    try {
      const roomCode = await this.gameHub.createRoom(roomType!, deckId!);
      this.router.navigate(['/play', roomCode]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to create room');
      this.creating.set(false);
    }
  }

  async joinRoom(): Promise<void> {
    if (this.joinForm.invalid) return;

    this.joining.set(true);
    this.error.set(null);

    const { roomCode, deckId } = this.joinForm.value;

    try {
      await this.gameHub.joinRoom(roomCode!.toUpperCase(), deckId!);
      this.router.navigate(['/play', roomCode!.toUpperCase()]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to join room');
      this.joining.set(false);
    }
  }
}
