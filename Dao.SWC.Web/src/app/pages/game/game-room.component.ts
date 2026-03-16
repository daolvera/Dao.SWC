import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CardInstanceDto,
  DiceRolledEvent,
  GamePlayerDto,
  GameRoomDto,
  GameState,
  RoomType,
} from '../../models/dtos/game.dto';
import { Alignment } from '../../models/dtos/card.dto';
import { GameHubService } from '../../services/game-hub.service';

type CardZone = 'deck' | 'hand' | 'space' | 'ground' | 'character' | 'discard';

interface DraggedCard {
  card: CardInstanceDto;
  sourceZone: CardZone;
}

// CardType enum values
const CARD_TYPE_UNIT = 0;

@Component({
  selector: 'app-game-room',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #gameContainer class="game-container" [class.fullscreen]="isFullscreen()">
      @if (room()) {
        <!-- Top Bar -->
        <div class="top-bar">
          <div class="d-flex align-items-center gap-3">
            <span class="room-code font-monospace">{{ roomCode }}</span>
            <span class="badge" [class]="roomTypeBadgeClass()">
              {{ roomTypeLabel() }}
            </span>
            <span class="badge" [class]="stateBadgeClass()">
              {{ stateLabel() }}
            </span>
          </div>
          <div class="d-flex align-items-center gap-2">
            @if (room()!.state === GameState.Waiting && isHost()) {
              <button class="btn btn-success btn-sm" [disabled]="!canStart()" (click)="startGame()">
                Start Game
              </button>
            }
            <button
              class="btn btn-outline-light btn-sm"
              (click)="toggleFullscreen()"
              [title]="isFullscreen() ? 'Exit Fullscreen' : 'Enter Fullscreen'"
            >
              {{ isFullscreen() ? '⊟' : '⛶' }}
            </button>
            <a routerLink="/play" class="btn btn-outline-light btn-sm">Exit</a>
          </div>
        </div>

        <!-- Main Game Area -->
        <div class="game-area">
          <!-- Waiting State: Show player list and share code -->
          @if (room()!.state === GameState.Waiting) {
            <div class="waiting-overlay">
              <div class="waiting-content">
                <h2>Waiting for Players</h2>
                <div class="room-code-display">{{ roomCode }}</div>
                <button class="btn btn-outline-primary mb-4" (click)="copyRoomCode()">
                  Copy Code
                </button>
                <div class="players-grid">
                  @for (player of room()!.players; track player.username) {
                    <div class="player-card" [class.host]="player.isHost">
                      <div class="player-name">
                        {{ player.username }}
                        @if (player.isHost) {
                          <span class="badge bg-warning text-dark ms-1">Host</span>
                        }
                      </div>
                      <div class="deck-name">{{ player.deckName }}</div>
                      <div class="alignment-badge">
                        <span
                          class="badge"
                          [class]="
                            player.alignment === Alignment.Light ? 'bg-primary' : 'bg-danger'
                          "
                        >
                          {{ player.alignment === Alignment.Light ? 'Light Side' : 'Dark Side' }}
                        </span>
                      </div>
                      @if (isHost() && !player.isHost) {
                        <button
                          class="btn btn-outline-danger btn-sm mt-2"
                          (click)="kickPlayer(player.username)"
                        >
                          Kick
                        </button>
                      }
                    </div>
                  }
                  @for (i of emptySlots(); track i) {
                    <div class="player-card empty">
                      <span class="text-muted">Waiting...</span>
                    </div>
                  }
                </div>
                @if (canStart()) {
                  <p class="mt-3 text-success">Ready to start!</p>
                } @else {
                  <p class="mt-3 text-muted">Need at least 2 players to start</p>
                }
              </div>
            </div>
          }

          <!-- In-Progress State: Two-sided board -->
          @if (room()!.state === GameState.InProgress) {
            <div class="board-container">
              <!-- Opponents Section (Top) -->
              <div class="opponents-section">
                @for (opponent of opponents(); track opponent.username) {
                  <div class="player-board opponent-board">
                    <!-- Opponent Info Bar -->
                    <div class="player-info-bar opponent">
                      <span class="player-name">{{ opponent.username }}</span>
                      <span class="force-display">
                        <span class="force-icon">⚡</span>
                        <span class="force-value">{{ opponent.force }}</span>
                      </span>
                      <span class="card-counts">
                        <span title="Hand">🃏 {{ opponent.hand.length }}</span>
                        <span title="Deck">📚 {{ opponent.deckSize }}</span>
                      </span>
                    </div>
                    <!-- Opponent Arenas -->
                    <div class="arenas-row">
                      <!-- Character Arena -->
                      <div class="arena character-arena">
                        <div class="arena-label">CHARACTER</div>
                        <div class="arena-content">
                          <div class="units-section">
                            @for (
                              card of getPlayerArenaUnits(opponent, 'character');
                              track card.instanceId
                            ) {
                              <div class="game-card small" [class.tapped]="card.isTapped">
                                <img
                                  [src]="card.cardImageUrl || 'assets/card-back.png'"
                                  [alt]="card.cardName"
                                />
                              </div>
                            }
                          </div>
                          <div class="others-section">
                            @for (
                              card of getPlayerArenaOthers(opponent, 'character');
                              track card.instanceId
                            ) {
                              <div class="game-card tiny" [class.tapped]="card.isTapped">
                                <img
                                  [src]="card.cardImageUrl || 'assets/card-back.png'"
                                  [alt]="card.cardName"
                                />
                              </div>
                            }
                          </div>
                        </div>
                      </div>
                      <!-- Ground Arena -->
                      <div class="arena ground-arena">
                        <div class="arena-label">GROUND</div>
                        <div class="arena-content">
                          <div class="units-section">
                            @for (
                              card of getPlayerArenaUnits(opponent, 'ground');
                              track card.instanceId
                            ) {
                              <div class="game-card small" [class.tapped]="card.isTapped">
                                <img
                                  [src]="card.cardImageUrl || 'assets/card-back.png'"
                                  [alt]="card.cardName"
                                />
                              </div>
                            }
                          </div>
                          <div class="others-section">
                            @for (
                              card of getPlayerArenaOthers(opponent, 'ground');
                              track card.instanceId
                            ) {
                              <div class="game-card tiny" [class.tapped]="card.isTapped">
                                <img
                                  [src]="card.cardImageUrl || 'assets/card-back.png'"
                                  [alt]="card.cardName"
                                />
                              </div>
                            }
                          </div>
                        </div>
                      </div>
                      <!-- Space Arena -->
                      <div class="arena space-arena">
                        <div class="arena-label">SPACE</div>
                        <div class="arena-content">
                          <div class="units-section">
                            @for (
                              card of getPlayerArenaUnits(opponent, 'space');
                              track card.instanceId
                            ) {
                              <div class="game-card small" [class.tapped]="card.isTapped">
                                <img
                                  [src]="card.cardImageUrl || 'assets/card-back.png'"
                                  [alt]="card.cardName"
                                />
                              </div>
                            }
                          </div>
                          <div class="others-section">
                            @for (
                              card of getPlayerArenaOthers(opponent, 'space');
                              track card.instanceId
                            ) {
                              <div class="game-card tiny" [class.tapped]="card.isTapped">
                                <img
                                  [src]="card.cardImageUrl || 'assets/card-back.png'"
                                  [alt]="card.cardName"
                                />
                              </div>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>

              <!-- Player Section (Bottom) -->
              <div class="player-section">
                <div class="player-board my-board">
                  <!-- Player Info Bar -->
                  <div class="player-info-bar me">
                    <span class="player-name">{{ myPlayer()?.username }}</span>
                    <div class="force-control">
                      <span class="force-icon">⚡</span>
                      <button
                        class="btn btn-sm btn-outline-light force-btn"
                        (click)="decrementForce()"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        class="force-input"
                        [value]="myPlayer()?.force ?? 4"
                        (change)="onForceChange($event)"
                        min="0"
                        max="99"
                      />
                      <button
                        class="btn btn-sm btn-outline-light force-btn"
                        (click)="incrementForce()"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <!-- Player Arenas -->
                  <div class="arenas-row">
                    <!-- Character Arena -->
                    <div
                      class="arena character-arena"
                      (dragover)="onDragOver($event)"
                      (drop)="onDrop($event, 'character')"
                      [class.drag-over]="dragOverZone() === 'character'"
                    >
                      <div class="arena-label">CHARACTER</div>
                      <div class="arena-content">
                        <div class="units-section">
                          @for (card of myArenaUnits('character'); track card.instanceId) {
                            <div
                              class="game-card"
                              [class.tapped]="card.isTapped"
                              [class.selected]="selectedCard() === card.instanceId"
                              draggable="true"
                              (dragstart)="onDragStart($event, card, 'character')"
                              (dragend)="onDragEnd()"
                              (click)="selectCard(card.instanceId)"
                              (dblclick)="toggleTap(card)"
                            >
                              <img
                                [src]="card.cardImageUrl || 'assets/card-back.png'"
                                [alt]="card.cardName"
                              />
                              <div class="card-name">{{ card.cardName }}</div>
                            </div>
                          }
                        </div>
                        <div class="others-section">
                          @for (card of myArenaOthers('character'); track card.instanceId) {
                            <div
                              class="game-card small"
                              [class.tapped]="card.isTapped"
                              [class.selected]="selectedCard() === card.instanceId"
                              draggable="true"
                              (dragstart)="onDragStart($event, card, 'character')"
                              (dragend)="onDragEnd()"
                              (click)="selectCard(card.instanceId)"
                              (dblclick)="toggleTap(card)"
                            >
                              <img
                                [src]="card.cardImageUrl || 'assets/card-back.png'"
                                [alt]="card.cardName"
                              />
                            </div>
                          }
                        </div>
                      </div>
                    </div>
                    <!-- Ground Arena -->
                    <div
                      class="arena ground-arena"
                      (dragover)="onDragOver($event)"
                      (drop)="onDrop($event, 'ground')"
                      [class.drag-over]="dragOverZone() === 'ground'"
                    >
                      <div class="arena-label">GROUND</div>
                      <div class="arena-content">
                        <div class="units-section">
                          @for (card of myArenaUnits('ground'); track card.instanceId) {
                            <div
                              class="game-card"
                              [class.tapped]="card.isTapped"
                              [class.selected]="selectedCard() === card.instanceId"
                              draggable="true"
                              (dragstart)="onDragStart($event, card, 'ground')"
                              (dragend)="onDragEnd()"
                              (click)="selectCard(card.instanceId)"
                              (dblclick)="toggleTap(card)"
                            >
                              <img
                                [src]="card.cardImageUrl || 'assets/card-back.png'"
                                [alt]="card.cardName"
                              />
                              <div class="card-name">{{ card.cardName }}</div>
                            </div>
                          }
                        </div>
                        <div class="others-section">
                          @for (card of myArenaOthers('ground'); track card.instanceId) {
                            <div
                              class="game-card small"
                              [class.tapped]="card.isTapped"
                              [class.selected]="selectedCard() === card.instanceId"
                              draggable="true"
                              (dragstart)="onDragStart($event, card, 'ground')"
                              (dragend)="onDragEnd()"
                              (click)="selectCard(card.instanceId)"
                              (dblclick)="toggleTap(card)"
                            >
                              <img
                                [src]="card.cardImageUrl || 'assets/card-back.png'"
                                [alt]="card.cardName"
                              />
                            </div>
                          }
                        </div>
                      </div>
                    </div>
                    <!-- Space Arena -->
                    <div
                      class="arena space-arena"
                      (dragover)="onDragOver($event)"
                      (drop)="onDrop($event, 'space')"
                      [class.drag-over]="dragOverZone() === 'space'"
                    >
                      <div class="arena-label">SPACE</div>
                      <div class="arena-content">
                        <div class="units-section">
                          @for (card of myArenaUnits('space'); track card.instanceId) {
                            <div
                              class="game-card"
                              [class.tapped]="card.isTapped"
                              [class.selected]="selectedCard() === card.instanceId"
                              draggable="true"
                              (dragstart)="onDragStart($event, card, 'space')"
                              (dragend)="onDragEnd()"
                              (click)="selectCard(card.instanceId)"
                              (dblclick)="toggleTap(card)"
                            >
                              <img
                                [src]="card.cardImageUrl || 'assets/card-back.png'"
                                [alt]="card.cardName"
                              />
                              <div class="card-name">{{ card.cardName }}</div>
                            </div>
                          }
                        </div>
                        <div class="others-section">
                          @for (card of myArenaOthers('space'); track card.instanceId) {
                            <div
                              class="game-card small"
                              [class.tapped]="card.isTapped"
                              [class.selected]="selectedCard() === card.instanceId"
                              draggable="true"
                              (dragstart)="onDragStart($event, card, 'space')"
                              (dragend)="onDragEnd()"
                              (click)="selectCard(card.instanceId)"
                              (dblclick)="toggleTap(card)"
                            >
                              <img
                                [src]="card.cardImageUrl || 'assets/card-back.png'"
                                [alt]="card.cardName"
                              />
                            </div>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bottom Area: Hand, Deck, Discard -->
            <div class="bottom-area">
              <!-- Left: Deck -->
              <div
                class="zone deck-zone"
                (click)="drawCard()"
                (dragover)="onDragOver($event)"
                (drop)="onDrop($event, 'deck')"
                [class.drag-over]="dragOverZone() === 'deck'"
              >
                <div class="zone-label">DECK</div>
                <div class="deck-stack">
                  <div class="card-back"></div>
                  <span class="deck-count">{{ myDeckSize() }}</span>
                </div>
              </div>

              <!-- Center: Hand -->
              <div
                class="zone hand-zone"
                (dragover)="onDragOver($event)"
                (drop)="onDrop($event, 'hand')"
                [class.drag-over]="dragOverZone() === 'hand'"
              >
                <div class="zone-label">HAND ({{ myHand().length }})</div>
                <div class="hand-cards">
                  @for (card of myHand(); track card.instanceId) {
                    <div
                      class="game-card hand-card"
                      [class.selected]="selectedCard() === card.instanceId"
                      draggable="true"
                      (dragstart)="onDragStart($event, card, 'hand')"
                      (dragend)="onDragEnd()"
                      (click)="selectCard(card.instanceId)"
                    >
                      <img
                        [src]="card.cardImageUrl || 'assets/card-back.png'"
                        [alt]="card.cardName"
                      />
                      <div class="card-name">{{ card.cardName }}</div>
                    </div>
                  }
                </div>
              </div>

              <!-- Right: Discard -->
              <div
                class="zone discard-zone"
                (dragover)="onDragOver($event)"
                (drop)="onDrop($event, 'discard')"
                [class.drag-over]="dragOverZone() === 'discard'"
                (click)="showDiscard.set(!showDiscard())"
              >
                <div class="zone-label">DISCARD</div>
                <div class="discard-stack">
                  @if (myDiscard().length > 0) {
                    <div class="game-card small">
                      <img
                        [src]="
                          myDiscard()[myDiscard().length - 1].cardImageUrl || 'assets/card-back.png'
                        "
                      />
                    </div>
                  } @else {
                    <div class="empty-zone">Empty</div>
                  }
                  <span class="discard-count">{{ myDiscard().length }}</span>
                </div>
              </div>
            </div>

            <!-- Discard Modal -->
            @if (showDiscard()) {
              <div class="modal-overlay" (click)="showDiscard.set(false)">
                <div class="modal-content" (click)="$event.stopPropagation()">
                  <h4>Discard Pile</h4>
                  <div class="modal-cards">
                    @for (card of myDiscard(); track card.instanceId) {
                      <div
                        class="game-card"
                        draggable="true"
                        (dragstart)="onDragStart($event, card, 'discard')"
                        (dragend)="onDragEnd()"
                      >
                        <img
                          [src]="card.cardImageUrl || 'assets/card-back.png'"
                          [alt]="card.cardName"
                        />
                        <div class="card-name">{{ card.cardName }}</div>
                      </div>
                    } @empty {
                      <p class="text-muted">No cards in discard</p>
                    }
                  </div>
                  <button class="btn btn-secondary mt-3" (click)="showDiscard.set(false)">
                    Close
                  </button>
                </div>
              </div>
            }

            <!-- Deck Browser Modal -->
            @if (showDeckBrowser()) {
              <div class="modal-overlay" (click)="showDeckBrowser.set(false)">
                <div class="modal-content large" (click)="$event.stopPropagation()">
                  <h4>Browse Deck ({{ deckBrowserCards().length }} cards)</h4>
                  <div class="modal-cards scrollable">
                    @for (card of deckBrowserCards(); track card.instanceId) {
                      <div
                        class="game-card clickable"
                        (click)="takeCardFromDeck(card.instanceId)"
                        [title]="'Click to take ' + card.cardName + ' to hand'"
                      >
                        <img
                          [src]="card.cardImageUrl || 'assets/card-back.png'"
                          [alt]="card.cardName"
                        />
                        <div class="card-name">{{ card.cardName }}</div>
                      </div>
                    } @empty {
                      <p class="text-muted">Deck is empty</p>
                    }
                  </div>
                  <button class="btn btn-secondary mt-3" (click)="showDeckBrowser.set(false)">
                    Close
                  </button>
                </div>
              </div>
            }

            <!-- Side Panel -->
            <div class="side-panel" [class.collapsed]="sidePanelCollapsed()">
              <button class="panel-toggle" (click)="sidePanelCollapsed.set(!sidePanelCollapsed())">
                {{ sidePanelCollapsed() ? '◀' : '▶' }}
              </button>
              @if (!sidePanelCollapsed()) {
                <div class="panel-content">
                  <!-- Quick Actions -->
                  <div class="panel-section">
                    <h6>Actions</h6>
                    <div class="d-grid gap-1">
                      <button class="btn btn-sm btn-primary" (click)="drawCard()">Draw Card</button>
                      <button class="btn btn-sm btn-outline-primary" (click)="openDeckBrowser()">
                        View Deck
                      </button>
                    </div>
                  </div>

                  <!-- Dice Roller -->
                  <div class="panel-section">
                    <h6>Dice</h6>
                    <div class="input-group input-group-sm">
                      <input
                        type="number"
                        class="form-control"
                        [formControl]="diceCount"
                        min="1"
                        max="20"
                      />
                      <button class="btn btn-outline-primary" (click)="rollDice()">Roll</button>
                    </div>
                    @if (lastDiceRoll()) {
                      <div class="dice-results mt-2">
                        <div class="small text-info mb-1">
                          {{ lastDiceRoll()!.username }} rolled:
                        </div>
                        @for (result of lastDiceRoll()!.results; track $index) {
                          <span class="badge bg-dark me-1">{{ result }}</span>
                        }
                        <div class="small text-muted">Total: {{ diceTotal() }}</div>
                      </div>
                    }
                  </div>

                  <!-- Players -->
                  <div class="panel-section">
                    <h6>Players</h6>
                    @for (player of room()!.players; track player.username) {
                      <div class="player-info">
                        <span>{{ player.username }}</span>
                        <span class="badge bg-secondary">{{ getPlayerCardCount(player) }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Finished State -->
          @if (room()!.state === GameState.Finished) {
            <div class="waiting-overlay">
              <div class="waiting-content">
                <h2>Game Over!</h2>
                <p class="lead">Thanks for playing.</p>
                <a routerLink="/play" class="btn btn-primary">Back to Lobby</a>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="loading-overlay">
          <div class="spinner-border text-light"></div>
          <p class="mt-3 text-light">Connecting to room...</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .game-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: white;
        overflow: hidden;
      }

      .game-container.fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
      }

      /* Top Bar */
      .top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 1rem;
        background: rgba(0, 0, 0, 0.5);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        flex-shrink: 0;
      }

      .room-code {
        font-size: 1.2rem;
        font-weight: bold;
        color: #ffd700;
      }

      /* Game Area */
      .game-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      }

      /* Waiting/Loading Overlays */
      .waiting-overlay,
      .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        z-index: 100;
      }

      .waiting-content {
        text-align: center;
        padding: 2rem;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        backdrop-filter: blur(10px);
      }

      .room-code-display {
        font-size: 3rem;
        font-weight: bold;
        font-family: monospace;
        letter-spacing: 0.5rem;
        color: #ffd700;
        margin: 1rem 0;
      }

      .players-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        justify-content: center;
        max-width: 600px;
      }

      .player-card {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 0.5rem;
        padding: 1rem;
        min-width: 150px;
        text-align: center;
      }

      .player-card.host {
        border: 2px solid #ffd700;
      }

      .player-card.empty {
        border: 2px dashed rgba(255, 255, 255, 0.3);
      }

      .player-name {
        font-weight: bold;
        margin-bottom: 0.25rem;
      }

      .deck-name {
        font-size: 0.875rem;
        opacity: 0.8;
      }

      /* Board Container - Two-sided layout */
      .board-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding: 0.5rem;
        gap: 0.5rem;
      }

      .opponents-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        overflow: hidden;
      }

      .player-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .player-board {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 0.5rem;
        overflow: hidden;
      }

      .opponent-board {
        border: 1px solid rgba(255, 100, 100, 0.3);
      }

      .my-board {
        border: 1px solid rgba(100, 200, 255, 0.3);
      }

      /* Player Info Bar */
      .player-info-bar {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.25rem 0.5rem;
        background: rgba(0, 0, 0, 0.4);
        font-size: 0.85rem;
      }

      .player-info-bar.opponent {
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .player-info-bar.me {
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .force-display {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        color: #ffd700;
      }

      .force-icon {
        font-size: 1rem;
      }

      .force-value {
        font-weight: bold;
        font-size: 1.1rem;
      }

      .force-control {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .force-btn {
        padding: 0.1rem 0.4rem;
        font-size: 1rem;
        line-height: 1;
      }

      .force-input {
        width: 50px;
        text-align: center;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: #ffd700;
        font-weight: bold;
        font-size: 1rem;
      }

      .force-input:focus {
        outline: none;
        border-color: #ffd700;
      }

      .card-counts {
        display: flex;
        gap: 0.5rem;
        opacity: 0.8;
        font-size: 0.8rem;
      }

      /* Arenas Row */
      .arenas-row {
        flex: 1;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.25rem;
        padding: 0.25rem;
        min-height: 0;
      }

      .arena {
        display: flex;
        flex-direction: column;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 0.25rem;
        overflow: hidden;
        transition:
          border-color 0.2s,
          background 0.2s;
      }

      .arena.drag-over {
        border-color: #28a745;
        background: rgba(40, 167, 69, 0.2);
      }

      .space-arena {
        border-color: rgba(138, 43, 226, 0.4);
      }

      .ground-arena {
        border-color: rgba(34, 139, 34, 0.4);
      }

      .character-arena {
        border-color: rgba(255, 215, 0, 0.4);
      }

      .arena-label {
        padding: 0.15rem 0.25rem;
        font-size: 0.65rem;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: rgba(0, 0, 0, 0.5);
        text-align: center;
      }

      .space-arena .arena-label {
        background: rgba(138, 43, 226, 0.3);
      }

      .ground-arena .arena-label {
        background: rgba(34, 139, 34, 0.3);
      }

      .character-arena .arena-label {
        background: rgba(255, 215, 0, 0.3);
      }

      /* Arena Content - Units (9/12) and Others (3/12) split */
      .arena-content {
        flex: 1;
        display: flex;
        gap: 2px;
        padding: 2px;
        min-height: 0;
        overflow: hidden;
      }

      .units-section {
        flex: 9;
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        align-content: flex-start;
        overflow-y: auto;
        padding: 2px;
      }

      .others-section {
        flex: 3;
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-items: center;
        overflow-y: auto;
        padding: 2px;
        background: rgba(0, 0, 0, 0.2);
        border-left: 1px solid rgba(255, 255, 255, 0.1);
      }

      /* Bottom Area */
      .bottom-area {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.5);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        height: 160px;
        flex-shrink: 0;
      }

      .zone {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 0.5rem;
        padding: 0.5rem;
        transition:
          border-color 0.2s,
          background 0.2s;
      }

      .zone.drag-over {
        border-color: #28a745;
        background: rgba(40, 167, 69, 0.2);
      }

      .zone-label {
        font-size: 0.7rem;
        font-weight: bold;
        text-transform: uppercase;
        margin-bottom: 0.25rem;
        opacity: 0.8;
      }

      .deck-zone,
      .discard-zone {
        width: 100px;
        cursor: pointer;
      }

      .deck-stack,
      .discard-stack {
        position: relative;
        width: 60px;
        height: 84px;
      }

      .card-back {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        border: 2px solid #444;
        border-radius: 4px;
        box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
      }

      .deck-count,
      .discard-count {
        position: absolute;
        bottom: -5px;
        right: -5px;
        background: #333;
        color: white;
        font-size: 0.75rem;
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
      }

      .hand-zone {
        flex: 1;
        overflow: hidden;
      }

      .hand-cards {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        padding: 0.25rem;
        height: 100%;
        align-items: center;
      }

      .empty-zone {
        width: 60px;
        height: 84px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px dashed rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        font-size: 0.7rem;
        opacity: 0.5;
      }

      /* Game Cards */
      .game-card {
        position: relative;
        width: 70px;
        height: 98px;
        flex-shrink: 0;
        border: 2px solid #444;
        border-radius: 4px;
        overflow: hidden;
        cursor: grab;
        transition:
          transform 0.2s,
          box-shadow 0.2s;
        background: #1a1a2e;
      }

      .game-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
        z-index: 10;
      }

      .game-card.selected {
        border-color: #28a745;
        box-shadow: 0 0 10px rgba(40, 167, 69, 0.8);
      }

      .game-card.tapped {
        transform: rotate(90deg);
      }

      .game-card.hand-card {
        width: 80px;
        height: 112px;
      }

      .game-card.small {
        width: 50px;
        height: 70px;
      }

      .game-card.tiny {
        width: 35px;
        height: 49px;
      }

      .game-card.clickable {
        cursor: pointer;
      }

      .game-card.clickable:hover {
        border-color: #28a745;
      }

      .game-card img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .card-name {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        font-size: 0.55rem;
        padding: 1px 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Side Panel */
      .side-panel {
        position: absolute;
        right: 0;
        top: 50px;
        bottom: 160px;
        width: 180px;
        background: rgba(0, 0, 0, 0.8);
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        transition: transform 0.3s;
        z-index: 50;
      }

      .side-panel.collapsed {
        transform: translateX(180px);
      }

      .panel-toggle {
        position: absolute;
        left: -30px;
        top: 50%;
        transform: translateY(-50%);
        width: 30px;
        height: 60px;
        background: rgba(0, 0, 0, 0.8);
        border: none;
        border-radius: 4px 0 0 4px;
        color: white;
        cursor: pointer;
      }

      .panel-content {
        padding: 0.5rem;
        height: 100%;
        overflow-y: auto;
      }

      .panel-section {
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .panel-section h6 {
        font-size: 0.75rem;
        text-transform: uppercase;
        opacity: 0.7;
        margin-bottom: 0.5rem;
      }

      .player-info {
        display: flex;
        justify-content: space-between;
        padding: 0.25rem 0;
        font-size: 0.875rem;
      }

      .dice-results {
        text-align: center;
      }

      /* Modal */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .modal-content {
        background: #1a1a2e;
        border-radius: 0.5rem;
        padding: 1.5rem;
        max-width: 90vw;
        max-height: 80vh;
        overflow: auto;
      }

      .modal-content.large {
        width: 80vw;
        max-width: 900px;
      }

      .modal-cards {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        max-width: 500px;
      }

      .modal-cards.scrollable {
        max-width: none;
        max-height: 60vh;
        overflow-y: auto;
      }
    `,
  ],
  imports: [ReactiveFormsModule, RouterLink, FormsModule],
})
export class GameRoomComponent implements OnInit, OnDestroy {
  protected readonly RoomType = RoomType;
  protected readonly GameState = GameState;
  protected readonly Alignment = Alignment;

  @ViewChild('gameContainer') gameContainer!: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private gameHub = inject(GameHubService);

  roomCode = '';
  room = signal<GameRoomDto | null>(null);
  selectedCard = signal<string | null>(null);
  lastDiceRoll = signal<DiceRolledEvent | null>(null);
  diceCount = new FormControl(1, [Validators.min(1), Validators.max(20)]);

  isFullscreen = signal(false);
  sidePanelCollapsed = signal(false);
  showDiscard = signal(false);
  showDeckBrowser = signal(false);
  deckBrowserCards = signal<CardInstanceDto[]>([]);
  dragOverZone = signal<CardZone | null>(null);

  private draggedCard: DraggedCard | null = null;
  private subscriptions: Subscription[] = [];

  // Computed values
  isHost = computed(() => {
    const r = this.room();
    if (!r) return false;
    const me = r.players.find((p) => p.username === this.gameHub.currentUser);
    return me?.isHost ?? false;
  });

  myPlayer = computed(() => {
    const r = this.room();
    if (!r) return null;
    return r.players.find((p) => p.username === this.gameHub.currentUser) ?? null;
  });

  opponents = computed(() => {
    const r = this.room();
    if (!r) return [];
    return r.players.filter((p) => p.username !== this.gameHub.currentUser);
  });

  maxPlayers = computed(() => {
    const r = this.room();
    if (!r) return 2;
    switch (r.roomType) {
      case RoomType.OneVOne:
        return 2;
      case RoomType.OneVTwo:
        return 3;
      case RoomType.TwoVTwo:
        return 4;
      default:
        return 4;
    }
  });

  emptySlots = computed(() => {
    const max = this.maxPlayers();
    const current = this.room()?.players.length ?? 0;
    return Array(Math.max(0, max - current))
      .fill(0)
      .map((_, i) => i);
  });

  canStart = computed(() => {
    const r = this.room();
    if (!r) return false;
    return r.players.length >= 2;
  });

  roomTypeBadgeClass = computed(() => {
    const r = this.room();
    if (!r) return 'bg-secondary';
    switch (r.roomType) {
      case RoomType.OneVOne:
        return 'bg-info';
      case RoomType.OneVTwo:
        return 'bg-warning text-dark';
      case RoomType.TwoVTwo:
        return 'bg-primary';
      default:
        return 'bg-secondary';
    }
  });

  roomTypeLabel = computed(() => {
    const r = this.room();
    if (!r) return '';
    switch (r.roomType) {
      case RoomType.OneVOne:
        return '1v1';
      case RoomType.OneVTwo:
        return '1v2';
      case RoomType.TwoVTwo:
        return '2v2';
      default:
        return '';
    }
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
    const me = this.myPlayer();
    return me?.hand ?? [];
  });

  myDeckSize = computed(() => {
    const me = this.myPlayer();
    return me?.deckSize ?? 0;
  });

  myDiscard = computed(() => {
    const me = this.myPlayer();
    return me?.discardPile ?? [];
  });

  diceTotal = computed(() => {
    const roll = this.lastDiceRoll();
    if (!roll) return 0;
    return roll.results.reduce((sum, n) => sum + n, 0);
  });

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('roomCode')?.toUpperCase() ?? '';
    if (!this.roomCode) {
      this.router.navigate(['/play']);
      return;
    }

    this.subscriptions.push(
      this.gameHub.roomUpdated$.subscribe((room) => {
        if (room.roomCode === this.roomCode) {
          this.room.set(room);
        }
      }),
      this.gameHub.diceRolled$.subscribe((event) => {
        this.lastDiceRoll.set(event);
      }),
      this.gameHub.kicked$.subscribe(() => {
        this.router.navigate(['/play']);
      }),
      this.gameHub.error$.subscribe((error) => {
        console.error('Game error:', error);
      }),
    );

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

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.gameContainer.nativeElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // Get units (cardType === 0) from a player's arena
  getPlayerArenaUnits(player: GamePlayerDto, arena: string): CardInstanceDto[] {
    const arenaCards = player.arenas[arena] ?? [];
    return arenaCards.filter((c) => c.cardType === CARD_TYPE_UNIT);
  }

  // Get non-units from a player's arena
  getPlayerArenaOthers(player: GamePlayerDto, arena: string): CardInstanceDto[] {
    const arenaCards = player.arenas[arena] ?? [];
    return arenaCards.filter((c) => c.cardType !== CARD_TYPE_UNIT);
  }

  // Get my units for an arena
  myArenaUnits(arena: string): CardInstanceDto[] {
    const me = this.myPlayer();
    if (!me) return [];
    return this.getPlayerArenaUnits(me, arena);
  }

  // Get my non-units for an arena
  myArenaOthers(arena: string): CardInstanceDto[] {
    const me = this.myPlayer();
    if (!me) return [];
    return this.getPlayerArenaOthers(me, arena);
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

  // Force counter methods
  async incrementForce(): Promise<void> {
    const me = this.myPlayer();
    if (me) {
      await this.gameHub.updateForce(me.force + 1);
    }
  }

  async decrementForce(): Promise<void> {
    const me = this.myPlayer();
    if (me && me.force > 0) {
      await this.gameHub.updateForce(me.force - 1);
    }
  }

  async onForceChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
      await this.gameHub.updateForce(value);
    }
  }

  // Deck browser
  async openDeckBrowser(): Promise<void> {
    const cards = await this.gameHub.viewDeck();
    this.deckBrowserCards.set(cards);
    this.showDeckBrowser.set(true);
  }

  async takeCardFromDeck(cardInstanceId: string): Promise<void> {
    await this.gameHub.takeFromDeck(cardInstanceId);
    this.showDeckBrowser.set(false);
  }

  // Drag and drop
  onDragStart(event: DragEvent, card: CardInstanceDto, zone: CardZone): void {
    this.draggedCard = { card, sourceZone: zone };
    event.dataTransfer?.setData('text/plain', card.instanceId);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    const zone = this.getZoneFromEvent(event);
    this.dragOverZone.set(zone);
  }

  onDragEnd(): void {
    this.draggedCard = null;
    this.dragOverZone.set(null);
  }

  async onDrop(event: DragEvent, targetZone: CardZone): Promise<void> {
    event.preventDefault();
    this.dragOverZone.set(null);

    if (!this.draggedCard) return;

    const { card, sourceZone } = this.draggedCard;
    this.draggedCard = null;

    if (sourceZone === targetZone) return;

    await this.moveCard(card.instanceId, sourceZone, targetZone);
  }

  private getZoneFromEvent(event: DragEvent): CardZone | null {
    const target = event.target as HTMLElement;
    const zone = target.closest('[class*="-zone"], [class*="-arena"]');
    if (!zone) return null;

    if (zone.classList.contains('deck-zone')) return 'deck';
    if (zone.classList.contains('hand-zone')) return 'hand';
    if (zone.classList.contains('discard-zone')) return 'discard';
    if (zone.classList.contains('space-arena')) return 'space';
    if (zone.classList.contains('ground-arena')) return 'ground';
    if (zone.classList.contains('character-arena')) return 'character';

    return null;
  }

  async moveCard(cardId: string, from: CardZone, to: CardZone): Promise<void> {
    if (to === 'space' || to === 'ground' || to === 'character') {
      await this.gameHub.playCard(cardId, to);
    } else if (to === 'discard') {
      await this.gameHub.discardCard(cardId);
    } else if (to === 'hand') {
      await this.gameHub.returnToHand(cardId);
    }
  }

  async toggleTap(card: CardInstanceDto): Promise<void> {
    await this.gameHub.toggleTap(card.instanceId);
  }

  async startGame(): Promise<void> {
    await this.gameHub.startGame();
  }

  async drawCard(): Promise<void> {
    await this.gameHub.drawCards(1);
  }

  async rollDice(): Promise<void> {
    const count = this.diceCount.value ?? 1;
    await this.gameHub.rollDice(count);
  }

  async kickPlayer(username: string): Promise<void> {
    await this.gameHub.kickPlayer(username);
  }

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomCode);
  }
}
