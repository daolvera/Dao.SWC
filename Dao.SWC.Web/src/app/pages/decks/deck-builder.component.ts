import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Alignment, Arena, CardDto, CardType } from '../../models/dtos/card.dto';
import { DeckCardDto, DeckDto, DeckValidationResult } from '../../models/dtos/deck.dto';
import { CardService } from '../../services/card.service';
import { DeckService } from '../../services/deck.service';

interface DeckCardEntry {
  card: CardDto;
  quantity: number;
}

@Component({
  selector: 'app-deck-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <a routerLink="/decks" class="btn btn-link px-0">
            <i class="bi bi-arrow-left me-1"></i>Back to Decks
          </a>
          <h2 class="mb-0">{{ deck()?.name ?? 'Loading...' }}</h2>
        </div>
        <button class="btn btn-primary" [disabled]="saving()" (click)="saveDeck()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-2"></span>
          }
          Save Deck
        </button>
      </div>

      <!-- Validation Status -->
      @if (validation()) {
        <div
          class="alert"
          [class.alert-success]="validation()!.isValid"
          [class.alert-warning]="!validation()!.isValid"
        >
          @if (validation()!.isValid) {
            <strong>✓ Deck is valid!</strong> Ready for battle.
          } @else {
            <strong>⚠ Deck has issues:</strong>
            <ul class="mb-0 mt-2">
              @for (error of validation()!.errors; track error) {
                <li>{{ error }}</li>
              }
            </ul>
          }
        </div>
      }

      <div class="row">
        <!-- Card Browser -->
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Card Browser</h5>
            </div>
            <div class="card-body">
              <!-- Search and Filters -->
              <div class="row g-2 mb-3">
                <div class="col-12">
                  <input
                    type="text"
                    class="form-control"
                    placeholder="Search cards..."
                    [formControl]="searchControl"
                  />
                </div>
                <div class="col-6">
                  <select class="form-select" [formControl]="typeFilter">
                    <option [value]="null">All Types</option>
                    <option [value]="CardType.Unit">Unit</option>
                    <option [value]="CardType.Location">Location</option>
                    <option [value]="CardType.Equipment">Equipment</option>
                    <option [value]="CardType.Mission">Mission</option>
                    <option [value]="CardType.Battle">Battle</option>
                  </select>
                </div>
                <div class="col-6">
                  <select class="form-select" [formControl]="arenaFilter">
                    <option [value]="null">All Arenas</option>
                    <option [value]="Arena.Space">Space</option>
                    <option [value]="Arena.Ground">Ground</option>
                    <option [value]="Arena.Character">Character</option>
                  </select>
                </div>
              </div>

              <!-- Card List -->
              <div class="card-list" style="max-height: 500px; overflow-y: auto;">
                @if (loadingCards()) {
                  <div class="text-center py-3">
                    <div class="spinner-border spinner-border-sm"></div>
                  </div>
                } @else if (availableCards().length === 0) {
                  <p class="text-muted text-center py-3">No cards found</p>
                } @else {
                  @for (card of availableCards(); track card.id) {
                    <div
                      class="d-flex align-items-center justify-content-between p-2 border-bottom"
                      [class.bg-light]="getCardQuantity(card.id) > 0"
                    >
                      <div>
                        <strong>{{ card.name }}</strong>
                        @if (card.version) {
                          <span class="text-muted">({{ card.version }})</span>
                        }
                        <br />
                        <small class="text-muted">
                          {{ getCardTypeLabel(card.type) }}
                          @if (card.arena !== null) {
                            - {{ getArenaLabel(card.arena) }}
                          }
                        </small>
                      </div>
                      <div class="btn-group btn-group-sm">
                        <button
                          class="btn btn-outline-secondary"
                          [disabled]="getCardQuantity(card.id) === 0"
                          (click)="removeCard(card)"
                        >
                          -
                        </button>
                        <span class="btn btn-outline-secondary disabled">
                          {{ getCardQuantity(card.id) }}
                        </span>
                        <button
                          class="btn btn-outline-primary"
                          [disabled]="getCardQuantity(card.id) >= 4"
                          (click)="addCard(card)"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Deck Contents -->
        <div class="col-md-6">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Deck Contents</h5>
              <span class="badge bg-secondary">{{ totalCards() }} / 60+ cards</span>
            </div>
            <div class="card-body">
              <!-- Unit counts -->
              <div class="row mb-3 text-center">
                <div class="col-4">
                  <div class="border rounded p-2">
                    <div class="fw-bold">{{ spaceUnits() }}</div>
                    <small class="text-muted">Space Units (12+)</small>
                  </div>
                </div>
                <div class="col-4">
                  <div class="border rounded p-2">
                    <div class="fw-bold">{{ groundUnits() }}</div>
                    <small class="text-muted">Ground Units (12+)</small>
                  </div>
                </div>
                <div class="col-4">
                  <div class="border rounded p-2">
                    <div class="fw-bold">{{ characterUnits() }}</div>
                    <small class="text-muted">Character Units (12+)</small>
                  </div>
                </div>
              </div>

              <!-- Deck card list -->
              <div style="max-height: 400px; overflow-y: auto;">
                @if (deckCards().length === 0) {
                  <p class="text-muted text-center py-3">
                    Add cards from the browser to build your deck
                  </p>
                } @else {
                  @for (entry of deckCards(); track entry.card.id) {
                    <div
                      class="d-flex align-items-center justify-content-between p-2 border-bottom"
                    >
                      <div>
                        <strong>{{ entry.card.name }}</strong>
                        @if (entry.card.version) {
                          <span class="text-muted">({{ entry.card.version }})</span>
                        }
                        <span class="badge bg-secondary ms-2">x{{ entry.quantity }}</span>
                      </div>
                      <button
                        class="btn btn-sm btn-outline-danger"
                        (click)="removeCard(entry.card)"
                      >
                        <i class="bi bi-dash"></i>
                      </button>
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  imports: [ReactiveFormsModule, RouterLink],
})
export class DeckBuilderComponent implements OnInit {
  protected readonly CardType = CardType;
  protected readonly Arena = Arena;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private deckService = inject(DeckService);
  private cardService = inject(CardService);

  // State
  deck = signal<DeckDto | null>(null);
  deckCards = signal<DeckCardEntry[]>([]);
  availableCards = signal<CardDto[]>([]);
  validation = signal<DeckValidationResult | null>(null);
  loadingCards = signal(false);
  saving = signal(false);

  // Filters
  searchControl = new FormControl('');
  typeFilter = new FormControl<CardType | null>(null);
  arenaFilter = new FormControl<Arena | null>(null);

  // Computed values
  totalCards = computed(() => this.deckCards().reduce((sum, entry) => sum + entry.quantity, 0));

  spaceUnits = computed(() =>
    this.deckCards()
      .filter((e) => e.card.type === CardType.Unit && e.card.arena === Arena.Space)
      .reduce((sum, e) => sum + e.quantity, 0),
  );

  groundUnits = computed(() =>
    this.deckCards()
      .filter((e) => e.card.type === CardType.Unit && e.card.arena === Arena.Ground)
      .reduce((sum, e) => sum + e.quantity, 0),
  );

  characterUnits = computed(() =>
    this.deckCards()
      .filter((e) => e.card.type === CardType.Unit && e.card.arena === Arena.Character)
      .reduce((sum, e) => sum + e.quantity, 0),
  );

  constructor() {
    // Set up search debounce
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadCards());

    this.typeFilter.valueChanges.subscribe(() => this.loadCards());
    this.arenaFilter.valueChanges.subscribe(() => this.loadCards());
  }

  ngOnInit(): void {
    const deckId = Number(this.route.snapshot.paramMap.get('id'));
    if (isNaN(deckId)) {
      this.router.navigate(['/decks']);
      return;
    }

    this.loadDeck(deckId);
    this.loadCards();
  }

  private loadDeck(deckId: number): void {
    this.deckService.getDeck(deckId).subscribe({
      next: (deck) => {
        this.deck.set(deck);
        // Convert deck cards to entries
        const entries: DeckCardEntry[] = deck.cards.map((dc) => ({
          card: dc.card,
          quantity: dc.quantity,
        }));
        this.deckCards.set(entries);
        this.validateDeck();
      },
      error: () => {
        this.router.navigate(['/decks']);
      },
    });
  }

  private loadCards(): void {
    this.loadingCards.set(true);

    const deck = this.deck();
    const filter = {
      search: this.searchControl.value || undefined,
      type: this.typeFilter.value ?? undefined,
      arena: this.arenaFilter.value ?? undefined,
      // Filter by deck alignment (allow neutral + deck's alignment)
      alignment: undefined, // We'll filter client-side for flexibility
    };

    this.cardService.getCards(filter).subscribe({
      next: (cards) => {
        // Filter to only show cards matching the deck's alignment
        if (deck) {
          const deckAlignment = deck.alignment;
          this.availableCards.set(
            cards.filter((c) => c.alignment === Alignment.Neutral || c.alignment === deckAlignment),
          );
        } else {
          this.availableCards.set(cards);
        }
        this.loadingCards.set(false);
      },
      error: () => {
        this.loadingCards.set(false);
      },
    });
  }

  getCardQuantity(cardId: number): number {
    const entry = this.deckCards().find((e) => e.card.id === cardId);
    return entry?.quantity ?? 0;
  }

  addCard(card: CardDto): void {
    const currentQuantity = this.getCardQuantity(card.id);
    if (currentQuantity >= 4) return;

    this.deckCards.update((entries) => {
      const existing = entries.find((e) => e.card.id === card.id);
      if (existing) {
        return entries.map((e) => (e.card.id === card.id ? { ...e, quantity: e.quantity + 1 } : e));
      } else {
        return [...entries, { card, quantity: 1 }];
      }
    });
  }

  removeCard(card: CardDto): void {
    const currentQuantity = this.getCardQuantity(card.id);
    if (currentQuantity === 0) return;

    this.deckCards.update((entries) => {
      const existing = entries.find((e) => e.card.id === card.id);
      if (existing && existing.quantity > 1) {
        return entries.map((e) => (e.card.id === card.id ? { ...e, quantity: e.quantity - 1 } : e));
      } else {
        return entries.filter((e) => e.card.id !== card.id);
      }
    });
  }

  saveDeck(): void {
    const deck = this.deck();
    if (!deck) return;

    this.saving.set(true);

    const updateDto = {
      cards: this.deckCards().map((e) => ({
        cardId: e.card.id,
        quantity: e.quantity,
      })),
    };

    this.deckService.updateDeck(deck.id, updateDto).subscribe({
      next: () => {
        this.saving.set(false);
        this.validateDeck();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  private validateDeck(): void {
    const deck = this.deck();
    if (!deck) return;

    this.deckService.validateDeck(deck.id).subscribe((result) => {
      this.validation.set(result);
    });
  }

  getCardTypeLabel(type: CardType): string {
    switch (type) {
      case CardType.Unit:
        return 'Unit';
      case CardType.Location:
        return 'Location';
      case CardType.Equipment:
        return 'Equipment';
      case CardType.Mission:
        return 'Mission';
      case CardType.Battle:
        return 'Battle';
    }
  }

  getArenaLabel(arena: Arena): string {
    switch (arena) {
      case Arena.Space:
        return 'Space';
      case Arena.Ground:
        return 'Ground';
      case Arena.Character:
        return 'Character';
    }
  }
}
