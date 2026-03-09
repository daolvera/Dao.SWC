import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CardInstanceDto,
  GamePlayerDto,
  GameRoomDto,
  GameState,
  RoomType,
  Team,
} from '../../models/dtos/game.dto';
import { GameHubService } from '../../services/game-hub.service';

@Component({
  selector: 'app-game-room',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid py-3">
      @if (room()) {
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 class="mb-0">
              Room: <span class="font-monospace">{{ roomCode }}</span>
            </h2>
            <span
              class="badge"
              [class]="room()!.roomType === RoomType.OneVOne ? 'bg-info' : 'bg-primary'"
            >
              {{ room()!.roomType === RoomType.OneVOne ? '1v1' : '2v2' }}
            </span>
            <span class="badge ms-2" [class]="stateBadgeClass()">
              {{ stateLabel() }}
            </span>
          </div>
          <div>
            @if (room()!.state === GameState.Waiting) {
              <a routerLink="/play" class="btn btn-outline-secondary me-2">Leave</a>
              @if (isHost()) {
                <button class="btn btn-success" [disabled]="!canStart()" (click)="startGame()">
                  Start Game
                </button>
              }
            }
          </div>
        </div>

        <!-- Waiting State -->
        @if (room()!.state === GameState.Waiting) {
          <div class="row">
            <div class="col-md-8">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">Players ({{ room()!.players.length }} / {{ maxPlayers() }})</h5>
                </div>
                <div class="card-body">
                  <div class="row">
                    @for (player of room()!.players; track player.username) {
                      <div class="col-md-6 mb-3">
                        <div class="card" [class.border-warning]="player.isHost">
                          <div class="card-body d-flex justify-content-between align-items-center">
                            <div>
                              <strong>{{ player.username }}</strong>
                              @if (player.isHost) {
                                <span class="badge bg-warning text-dark ms-2">Host</span>
                              }
                              <br />
                              <small class="text-muted">{{ player.deckName }}</small>
                              @if (room()!.roomType === RoomType.TwoVTwo) {
                                <br />
                                <span
                                  class="badge"
                                  [class]="player.team === Team.Alpha ? 'bg-danger' : 'bg-primary'"
                                >
                                  Team {{ player.team === Team.Alpha ? 'Alpha' : 'Beta' }}
                                </span>
                              }
                            </div>
                            @if (isHost() && !player.isHost) {
                              <div class="btn-group btn-group-sm">
                                @if (room()!.roomType === RoomType.TwoVTwo) {
                                  <button
                                    class="btn"
                                    [class.btn-danger]="player.team === Team.Alpha"
                                    [class.btn-outline-danger]="player.team !== Team.Alpha"
                                    (click)="assignTeam(player.username, Team.Alpha)"
                                  >
                                    α
                                  </button>
                                  <button
                                    class="btn"
                                    [class.btn-primary]="player.team === Team.Beta"
                                    [class.btn-outline-primary]="player.team !== Team.Beta"
                                    (click)="assignTeam(player.username, Team.Beta)"
                                  >
                                    β
                                  </button>
                                }
                                <button
                                  class="btn btn-outline-danger"
                                  (click)="kickPlayer(player.username)"
                                >
                                  Kick
                                </button>
                              </div>
                            }
                          </div>
                        </div>
                      </div>
                    }
                  </div>

                  @if (room()!.players.length < maxPlayers()) {
                    <p class="text-muted text-center mt-3">
                      Waiting for {{ maxPlayers() - room()!.players.length }} more player(s)...
                    </p>
                  }
                </div>
              </div>
            </div>

            <div class="col-md-4">
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">Share Code</h5>
                </div>
                <div class="card-body text-center">
                  <div class="display-4 font-monospace mb-3">{{ roomCode }}</div>
                  <button class="btn btn-outline-primary" (click)="copyRoomCode()">
                    Copy Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- In-Progress State -->
        @if (room()!.state === GameState.InProgress) {
          <div class="row">
            <!-- Game Board -->
            <div class="col-md-9">
              <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Game Board</h5>
                  <span class="badge bg-secondary">Turn: {{ room()!.currentTurn }}</span>
                </div>
                <div class="card-body">
                  <!-- Arenas -->
                  @for (arena of ['Space', 'Ground', 'Character']; track arena) {
                    <h6>{{ arena }} Arena</h6>
                    <div
                      class="d-flex flex-wrap gap-2 mb-3 p-2 border rounded bg-light"
                      style="min-height: 80px;"
                    >
                      @for (card of getArenaCards(arena); track card.instanceId) {
                        <div
                          class="card-instance"
                          [class.tapped]="card.isTapped"
                          [title]="card.cardName"
                        >
                          <img
                            [src]="card.cardImageUrl || 'assets/card-back.jpg'"
                            [alt]="card.cardName"
                            class="img-fluid"
                            style="max-height: 100px;"
                          />
                          <div class="card-overlay">{{ card.cardName }}</div>
                        </div>
                      } @empty {
                        <span class="text-muted">No cards</span>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Hand -->
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Your Hand</h5>
                  <span class="badge bg-info">{{ myHand().length }} cards</span>
                </div>
                <div class="card-body">
                  <div class="d-flex flex-wrap gap-2">
                    @for (card of myHand(); track card.instanceId) {
                      <div
                        class="card-instance selectable"
                        [class.selected]="selectedCard() === card.instanceId"
                        (click)="selectCard(card.instanceId)"
                      >
                        <img
                          [src]="card.cardImageUrl || 'assets/card-back.png'"
                          [alt]="card.cardName"
                          class="img-fluid"
                          style="max-height: 120px;"
                        />
                        <div class="card-overlay">{{ card.cardName }}</div>
                      </div>
                    } @empty {
                      <span class="text-muted">No cards in hand</span>
                    }
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions Panel -->
            <div class="col-md-3">
              <div class="card mb-3">
                <div class="card-header">
                  <h5 class="mb-0">Actions</h5>
                </div>
                <div class="card-body">
                  <div class="d-grid gap-2">
                    <button class="btn btn-primary" (click)="drawCards(1)">Draw Card</button>

                    @if (selectedCard()) {
                      <button class="btn btn-success" (click)="playCard()">
                        Play Selected Card
                      </button>
                      <button class="btn btn-warning" (click)="discardCard()">
                        Discard Selected Card
                      </button>
                    }

                    <button class="btn btn-secondary" (click)="endTurn()">End Turn</button>
                  </div>
                </div>
              </div>

              <!-- Dice Roller -->
              <div class="card mb-3">
                <div class="card-header">
                  <h5 class="mb-0">Dice Roller</h5>
                </div>
                <div class="card-body">
                  <div class="input-group mb-3">
                    <input
                      type="number"
                      class="form-control"
                      [formControl]="diceCount"
                      min="1"
                      max="20"
                    />
                    <button class="btn btn-outline-primary" (click)="rollDice()">Roll</button>
                  </div>
                  @if (lastDiceRoll().length > 0) {
                    <div class="text-center">
                      <div class="dice-results">
                        @for (result of lastDiceRoll(); track $index) {
                          <span class="badge bg-dark fs-5 me-1">{{ result }}</span>
                        }
                      </div>
                      <small class="text-muted">Total: {{ diceTotal() }}</small>
                    </div>
                  }
                </div>
              </div>

              <!-- Players Info -->
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">Players</h5>
                </div>
                <ul class="list-group list-group-flush">
                  @for (player of room()!.players; track player.username) {
                    <li class="list-group-item d-flex justify-content-between">
                      <span>{{ player.username }}</span>
                      <span class="badge bg-secondary">{{ getPlayerCardCount(player) }} cards</span>
                    </li>
                  }
                </ul>
              </div>
            </div>
          </div>
        }

        <!-- Finished State -->
        @if (room()!.state === GameState.Finished) {
          <div class="text-center py-5">
            <h3>Game Over!</h3>
            <p class="lead">Thanks for playing.</p>
            <a routerLink="/play" class="btn btn-primary">Back to Lobby</a>
          </div>
        }
      } @else {
        <div class="text-center py-5">
          <div class="spinner-border"></div>
          <p class="mt-3">Connecting to room...</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .card-instance {
        position: relative;
        border: 2px solid #ccc;
        border-radius: 4px;
        overflow: hidden;
        transition: transform 0.2s;
      }

      .card-instance.tapped {
        transform: rotate(90deg);
      }

      .card-instance.selectable:hover {
        border-color: #007bff;
        cursor: pointer;
      }

      .card-instance.selected {
        border-color: #28a745;
        box-shadow: 0 0 8px rgba(40, 167, 69, 0.6);
      }

      .card-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 0.75rem;
        padding: 2px 4px;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      }
    `,
  ],
  imports: [ReactiveFormsModule, RouterLink],
})
export class GameRoomComponent implements OnInit, OnDestroy {
  protected readonly RoomType = RoomType;
  protected readonly GameState = GameState;
  protected readonly Team = Team;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private gameHub = inject(GameHubService);

  roomCode = '';
  room = signal<GameRoomDto | null>(null);
  selectedCard = signal<string | null>(null);
  lastDiceRoll = signal<number[]>([]);
  diceCount = new FormControl(1, [Validators.min(1), Validators.max(20)]);

  private subscriptions: Subscription[] = [];

  // Computed
  isHost = computed(() => {
    const r = this.room();
    if (!r) return false;
    const me = r.players.find((p) => p.username === this.gameHub.currentUser);
    return me?.isHost ?? false;
  });

  maxPlayers = computed(() => (this.room()?.roomType === RoomType.OneVOne ? 2 : 4));

  canStart = computed(() => {
    const r = this.room();
    if (!r) return false;
    return r.players.length >= 2 && (r.roomType === RoomType.OneVOne || r.players.length === 4);
  });

  stateBadgeClass = computed(() => {
    switch (this.room()?.state) {
      case GameState.Waiting:
        return 'bg-warning text-dark';
      case GameState.InProgress:
        return 'bg-success';
      case GameState.Finished:
        return 'bg-secondary';
      default:
        return 'bg-secondary';
    }
  });

  stateLabel = computed(() => {
    switch (this.room()?.state) {
      case GameState.Waiting:
        return 'Waiting';
      case GameState.InProgress:
        return 'In Progress';
      case GameState.Finished:
        return 'Finished';
      default:
        return 'Unknown';
    }
  });

  myHand = computed(() => {
    const r = this.room();
    if (!r) return [];
    const me = r.players.find((p) => p.username === this.gameHub.currentUser);
    return me?.hand ?? [];
  });

  diceTotal = computed(() => this.lastDiceRoll().reduce((sum, n) => sum + n, 0));

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('roomCode')?.toUpperCase() ?? '';
    if (!this.roomCode) {
      this.router.navigate(['/play']);
      return;
    }

    // Subscribe to hub events
    this.subscriptions.push(
      this.gameHub.roomUpdated$.subscribe((room) => {
        if (room.roomCode === this.roomCode) {
          this.room.set(room);
        }
      }),
      this.gameHub.diceRolled$.subscribe((event) => {
        this.lastDiceRoll.set(event.results);
      }),
      this.gameHub.kicked$.subscribe(() => {
        this.router.navigate(['/play']);
      }),
      this.gameHub.error$.subscribe((error) => {
        console.error('Game error:', error);
      }),
    );

    // Attempt reconnect
    this.reconnect();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  private async reconnect(): Promise<void> {
    try {
      await this.gameHub.connect();
      await this.gameHub.reconnect(this.roomCode);
    } catch {
      this.router.navigate(['/play']);
    }
  }

  getArenaCards(arena: string): CardInstanceDto[] {
    const r = this.room();
    if (!r) return [];

    // Collect all cards in this arena from all players
    const allCards: CardInstanceDto[] = [];
    for (const player of r.players) {
      const arenaCards = player.arenas[arena.toLowerCase()] ?? [];
      allCards.push(...arenaCards);
    }
    return allCards;
  }

  getPlayerCardCount(player: GamePlayerDto): number {
    return player.hand.length + player.deckSize;
  }

  selectCard(instanceId: string): void {
    if (this.selectedCard() === instanceId) {
      this.selectedCard.set(null);
    } else {
      this.selectedCard.set(instanceId);
    }
  }

  async startGame(): Promise<void> {
    await this.gameHub.startGame();
  }

  async drawCards(count: number): Promise<void> {
    await this.gameHub.drawCards(count);
  }

  async playCard(): Promise<void> {
    const cardId = this.selectedCard();
    if (!cardId) return;

    // Determine arena from card (simplified - would need card metadata)
    await this.gameHub.playCard(cardId, 'ground');
    this.selectedCard.set(null);
  }

  async discardCard(): Promise<void> {
    const cardId = this.selectedCard();
    if (!cardId) return;

    await this.gameHub.discardCard(cardId);
    this.selectedCard.set(null);
  }

  async endTurn(): Promise<void> {
    await this.gameHub.endTurn();
  }

  async rollDice(): Promise<void> {
    const count = this.diceCount.value ?? 1;
    await this.gameHub.rollDice(count);
  }

  async assignTeam(username: string, team: Team): Promise<void> {
    await this.gameHub.assignTeam(username, team);
  }

  async kickPlayer(username: string): Promise<void> {
    await this.gameHub.kickPlayer(username);
  }

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomCode);
  }
}
