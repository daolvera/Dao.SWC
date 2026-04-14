import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Alignment } from '../../models/dtos/card.dto';
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

      @if (showRejoinAlert()) {
        <div class="alert alert-info alert-dismissible d-flex align-items-center gap-3 mb-4">
          <span>You were previously in game room <strong>{{ pendingRejoinCode() }}</strong>. Would you like to rejoin?</span>
          <div class="d-flex gap-2 ms-auto flex-shrink-0">
            <button class="btn btn-sm btn-primary" (click)="rejoinGame()">Rejoin</button>
            <button class="btn btn-sm btn-outline-secondary" (click)="dismissRejoin()">Dismiss</button>
          </div>
        </div>
      }

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
                    <select
                      class="form-select"
                      formControlName="deckId"
                      (change)="onCreateDeckChange()"
                    >
                      <option [value]="null" disabled>Choose a deck...</option>
                      @for (deck of validDecks(); track deck.id) {
                        <option [value]="deck.id">
                          {{ deck.name }} ({{ getAlignmentLabel(deck.alignment) }})
                        </option>
                      }
                    </select>
                  }
                </div>

                @if (createSelectedDeckIsNeutral()) {
                  <div class="mb-3">
                    <label class="form-label">Play As</label>
                    <div class="alert alert-info py-2 mb-2">
                      <small>Neutral decks must choose a side to play as.</small>
                    </div>
                    <div class="btn-group w-100" role="group">
                      <input
                        type="radio"
                        class="btn-check"
                        id="createPlayAsLight"
                        [value]="Alignment.Light"
                        formControlName="playAsAlignment"
                      />
                      <label class="btn btn-outline-primary" for="createPlayAsLight"
                        >Light Side</label
                      >
                      <input
                        type="radio"
                        class="btn-check"
                        id="createPlayAsDark"
                        [value]="Alignment.Dark"
                        formControlName="playAsAlignment"
                      />
                      <label class="btn btn-outline-dark" for="createPlayAsDark">Dark Side</label>
                    </div>
                  </div>
                }

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
                    <select
                      class="form-select"
                      formControlName="deckId"
                      (change)="onJoinDeckChange()"
                    >
                      <option [value]="null" disabled>Choose a deck...</option>
                      @for (deck of validDecks(); track deck.id) {
                        <option [value]="deck.id">
                          {{ deck.name }} ({{ getAlignmentLabel(deck.alignment) }})
                        </option>
                      }
                    </select>
                  }
                </div>

                @if (joinSelectedDeckIsNeutral()) {
                  <div class="mb-3">
                    <label class="form-label">Play As</label>
                    <div class="alert alert-info py-2 mb-2">
                      <small>Neutral decks must choose a side to play as.</small>
                    </div>
                    <div class="btn-group w-100" role="group">
                      <input
                        type="radio"
                        class="btn-check"
                        id="joinPlayAsLight"
                        [value]="Alignment.Light"
                        formControlName="playAsAlignment"
                      />
                      <label class="btn btn-outline-primary" for="joinPlayAsLight"
                        >Light Side</label
                      >
                      <input
                        type="radio"
                        class="btn-check"
                        id="joinPlayAsDark"
                        [value]="Alignment.Dark"
                        formControlName="playAsAlignment"
                      />
                      <label class="btn btn-outline-dark" for="joinPlayAsDark">Dark Side</label>
                    </div>
                  </div>
                }

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
  protected readonly Alignment = Alignment;

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
  showRejoinAlert = signal(false);
  pendingRejoinCode = signal<string | null>(null);

  // Track selected deck for neutral detection
  createSelectedDeckId = signal<number | null>(null);
  joinSelectedDeckId = signal<number | null>(null);

  // Computed signals for neutral deck detection
  createSelectedDeckIsNeutral = computed(() => {
    const deckId = this.createSelectedDeckId();
    if (!deckId) return false;
    const deck = this.validDecks().find((d) => d.id === deckId);
    return deck?.alignment === Alignment.Neutral;
  });

  joinSelectedDeckIsNeutral = computed(() => {
    const deckId = this.joinSelectedDeckId();
    if (!deckId) return false;
    const deck = this.validDecks().find((d) => d.id === deckId);
    return deck?.alignment === Alignment.Neutral;
  });

  // Forms
  createForm = new FormGroup({
    roomType: new FormControl<RoomType>(RoomType.OneVOne, { nonNullable: true }),
    deckId: new FormControl<number | null>(null, [Validators.required]),
    playAsAlignment: new FormControl<Alignment | null>(null),
  });

  joinForm = new FormGroup({
    roomCode: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(6),
    ]),
    deckId: new FormControl<number | null>(null, [Validators.required]),
    playAsAlignment: new FormControl<Alignment | null>(null),
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
      const savedCode = localStorage.getItem('swc_last_room_code');
      if (savedCode) {
        this.pendingRejoinCode.set(savedCode);
        this.showRejoinAlert.set(true);
      }
    } catch {
      this.error.set('Failed to connect to game server');
    }
  }

  getAlignmentLabel(alignment: Alignment): string {
    switch (alignment) {
      case Alignment.Light:
        return 'Light';
      case Alignment.Dark:
        return 'Dark';
      case Alignment.Neutral:
        return 'Neutral';
      default:
        return 'Unknown';
    }
  }

  onCreateDeckChange(): void {
    const rawValue = this.createForm.get('deckId')?.value;
    const deckId = rawValue != null ? Number(rawValue) : null;
    this.createSelectedDeckId.set(deckId);
    // Reset playAsAlignment when deck changes
    this.createForm.get('playAsAlignment')?.reset();
  }

  onJoinDeckChange(): void {
    const rawValue = this.joinForm.get('deckId')?.value;
    const deckId = rawValue != null ? Number(rawValue) : null;

    this.joinSelectedDeckId.set(deckId);
    // Reset playAsAlignment when deck changes
    this.joinForm.get('playAsAlignment')?.reset();
  }

  async createRoom(): Promise<void> {
    if (this.createForm.invalid) return;

    // Validate that neutral decks have a playAsAlignment selected
    if (this.createSelectedDeckIsNeutral() && !this.createForm.get('playAsAlignment')?.value) {
      this.error.set('Please select Light or Dark side for your neutral deck');
      return;
    }

    this.creating.set(true);
    this.error.set(null);

    const { roomType, deckId, playAsAlignment } = this.createForm.value;

    try {
      const roomCode = await this.gameHub.createRoom(
        roomType!,
        Number(deckId)!,
        playAsAlignment ?? undefined,
      );
      this.router.navigate(['/play', roomCode]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to create room');
      this.creating.set(false);
    }
  }

  async joinRoom(): Promise<void> {
    if (this.joinForm.invalid) return;

    // Validate that neutral decks have a playAsAlignment selected
    if (this.joinSelectedDeckIsNeutral() && !this.joinForm.get('playAsAlignment')?.value) {
      this.error.set('Please select Light or Dark side for your neutral deck');
      return;
    }

    this.joining.set(true);
    this.error.set(null);

    const { roomCode, deckId, playAsAlignment } = this.joinForm.value;

    try {
      await this.gameHub.joinRoom(
        roomCode!.toUpperCase(),
        Number(deckId)!,
        playAsAlignment ?? undefined,
      );
      this.router.navigate(['/play', roomCode!.toUpperCase()]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to join room');
      this.joining.set(false);
    }
  }

  async rejoinGame(): Promise<void> {
    const code = this.pendingRejoinCode();
    if (!code) return;
    this.showRejoinAlert.set(false);
    try {
      await this.gameHub.connect();
      await this.gameHub.reconnect(code);
      this.router.navigate(['/play', code]);
    } catch {
      localStorage.removeItem('swc_last_room_code');
      this.pendingRejoinCode.set(null);
      this.error.set('Could not rejoin game — the room may no longer exist.');
    }
  }

  dismissRejoin(): void {
    localStorage.removeItem('swc_last_room_code');
    this.pendingRejoinCode.set(null);
    this.showRejoinAlert.set(false);
  }
}
