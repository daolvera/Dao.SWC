import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { Alignment, Arena, CardDto, CardType } from '../../models/dtos/card.dto';
import { DeckDto, DeckValidationResult } from '../../models/dtos/deck.dto';
import { CardService } from '../../services/card.service';
import { DeckService } from '../../services/deck.service';
import { CardFilter } from '../../models/filters/card-filter';
import { CardFiltersComponent } from '../../components/card-filters/card-filters.component';
import { HasUnsavedChanges } from '../../guards/unsaved-changes.guard';

interface DeckCardEntry {
  card: CardDto;
  quantity: number;
}

type ImageVisibility = Set<number>;

// Filter can be a CardType (Battle, Mission, etc.) or Arena (for Unit filtering)
type DeckFilter = { kind: 'type'; value: CardType } | { kind: 'arena'; value: Arena } | null;

@Component({
  selector: 'app-deck-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <a routerLink="/decks" class="btn btn-link px-0 d-block">
            <i class="bi bi-arrow-left me-1"></i>Back to Decks
          </a>
          @if (editingName()) {
            <div class="d-flex align-items-center gap-2">
              <input
                type="text"
                class="form-control form-control-lg"
                [value]="newName()"
                (input)="onNameInput($event)"
                (keydown.enter)="confirmRename()"
                (keydown.escape)="cancelRename()"
                #nameInput
              />
              <button class="btn btn-success btn-sm" (click)="confirmRename()" title="Save name">
                <i class="bi bi-check-lg"></i>
              </button>
              <button class="btn btn-secondary btn-sm" (click)="cancelRename()" title="Cancel">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          } @else {
            <h2 class="mb-0 d-flex align-items-center gap-2">
              {{ deck()?.name ?? 'Loading...' }}
              @if (deck()) {
                <button class="btn btn-link btn-sm p-0" (click)="startRename()" title="Rename deck">
                  <i class="bi bi-pencil"></i>
                </button>
              }
            </h2>
          }
        </div>
        <div class="d-flex gap-2">
          @if (deck()) {
            <a [href]="deckService.getExportUrl(deck()!.id)" class="btn btn-outline-secondary">
              <i class="bi bi-download me-1"></i>Export Deck
            </a>
          }
          <button class="btn btn-primary" [disabled]="saving()" (click)="saveDeck()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
            }
            Save Deck
          </button>
        </div>
      </div>

      <!-- Validation Status -->
      @if (localValidation(); as validation) {
        <div
          class="alert"
          [class.alert-success]="validation.isValid"
          [class.alert-warning]="!validation.isValid"
        >
          @if (validation.isValid) {
            <strong>✓ Deck is valid!</strong> Ready for battle.
          } @else {
            <strong>⚠ Deck has issues:</strong>
            <ul class="mb-0 mt-2">
              @for (error of validation.errors; track error) {
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
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Card Browser</h5>
              <div class="btn-group btn-group-sm">
                <button
                  class="btn btn-outline-secondary"
                  (click)="showAllBrowserImages()"
                  title="Show all images"
                >
                  <i class="bi bi-images"></i> Show All
                </button>
                <button
                  class="btn btn-outline-secondary"
                  (click)="hideAllBrowserImages()"
                  title="Hide all images"
                >
                  <i class="bi bi-eye-slash"></i> Hide All
                </button>
              </div>
            </div>
            <div class="card-body">
              <!-- Search and Filters -->
              <div class="mb-3">
                <app-card-filters
                  [showAlignmentFilter]="false"
                  [fixedAlignment]="deck()?.alignment"
                  (filterChange)="onFilterChange($event)"
                />
              </div>

              <!-- Card List -->
              <div class="card-list" style="max-height: 500px; overflow-y: auto;">
                @if (availableCards().length === 0) {
                  <p class="text-muted text-center py-3">No cards found</p>
                } @else {
                  @for (card of availableCards(); track card.id) {
                    <div class="p-2 border-bottom" [class.bg-light]="getCardQuantity(card.id) > 0">
                      <div class="d-flex align-items-center justify-content-between">
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
                        <div class="d-flex gap-2">
                          @if (card.imageUrl) {
                            <button
                              class="btn btn-sm"
                              [class.btn-outline-secondary]="!isBrowserImageVisible(card.id)"
                              [class.btn-secondary]="isBrowserImageVisible(card.id)"
                              (click)="toggleBrowserImage(card.id)"
                              title="Toggle image"
                            >
                              <i
                                class="bi"
                                [class.bi-eye]="!isBrowserImageVisible(card.id)"
                                [class.bi-eye-slash]="isBrowserImageVisible(card.id)"
                              ></i>
                            </button>
                          }
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
                      </div>
                      @if (isBrowserImageVisible(card.id) && card.imageUrl) {
                        <div class="mt-2 text-center">
                          <img
                            [src]="card.imageUrl"
                            [alt]="card.name"
                            class="img-fluid rounded"
                            style="max-height: 200px;"
                          />
                        </div>
                      }
                    </div>
                  }
                }
              </div>

              <!-- Pagination -->
              @if (totalPages() > 1) {
                <div class="d-flex flex-column align-items-center mt-3">
                  <ngb-pagination
                    [collectionSize]="totalCount()"
                    [pageSize]="pageSize"
                    [page]="currentPage()"
                    (pageChange)="goToPage($event)"
                    [maxSize]="5"
                    [rotate]="true"
                    [boundaryLinks]="true"
                    size="sm"
                  />
                  <small class="text-muted mt-1">
                    Page {{ currentPage() }} of {{ totalPages() }} ({{ totalCount() }} cards)
                  </small>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Deck Contents -->
        <div class="col-md-6">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Deck Contents</h5>
              <div class="d-flex gap-2 align-items-center">
                <div class="btn-group btn-group-sm">
                  <button
                    class="btn btn-outline-secondary"
                    (click)="showAllDeckImages()"
                    title="Show all images"
                  >
                    <i class="bi bi-images"></i>
                  </button>
                  <button
                    class="btn btn-outline-secondary"
                    (click)="hideAllDeckImages()"
                    title="Hide all images"
                  >
                    <i class="bi bi-eye-slash"></i>
                  </button>
                </div>
                <span class="badge bg-secondary">{{ totalCards() }} / 60+ cards</span>
              </div>
            </div>
            <div class="card-body">
              <!-- Unit counts (clickable arena filters) -->
              <div class="row mb-3 text-center">
                <div class="col-4">
                  <div
                    class="border rounded p-2"
                    [class.bg-primary]="isArenaFilterActive(Arena.Space)"
                    [class.text-white]="isArenaFilterActive(Arena.Space)"
                    style="cursor: pointer;"
                    (click)="toggleDeckArenaFilter(Arena.Space)"
                  >
                    <div class="fw-bold">{{ spaceUnits() }}</div>
                    <small [class.text-muted]="!isArenaFilterActive(Arena.Space)"
                      >Space Units (12+)</small
                    >
                  </div>
                </div>
                <div class="col-4">
                  <div
                    class="border rounded p-2"
                    [class.bg-primary]="isArenaFilterActive(Arena.Ground)"
                    [class.text-white]="isArenaFilterActive(Arena.Ground)"
                    style="cursor: pointer;"
                    (click)="toggleDeckArenaFilter(Arena.Ground)"
                  >
                    <div class="fw-bold">{{ groundUnits() }}</div>
                    <small [class.text-muted]="!isArenaFilterActive(Arena.Ground)"
                      >Ground Units (12+)</small
                    >
                  </div>
                </div>
                <div class="col-4">
                  <div
                    class="border rounded p-2"
                    [class.bg-primary]="isArenaFilterActive(Arena.Character)"
                    [class.text-white]="isArenaFilterActive(Arena.Character)"
                    style="cursor: pointer;"
                    (click)="toggleDeckArenaFilter(Arena.Character)"
                  >
                    <div class="fw-bold">{{ characterUnits() }}</div>
                    <small [class.text-muted]="!isArenaFilterActive(Arena.Character)"
                      >Character Units (12+)</small
                    >
                  </div>
                </div>
              </div>

              <!-- Card type counts (clickable filters) -->
              <div class="row mb-3 text-center">
                <div class="col-3">
                  <div
                    class="border rounded p-2"
                    [class.bg-primary]="isTypeFilterActive(CardType.Battle)"
                    [class.text-white]="isTypeFilterActive(CardType.Battle)"
                    style="cursor: pointer;"
                    (click)="toggleDeckTypeFilter(CardType.Battle)"
                  >
                    <div class="fw-bold">{{ battleCards() }}</div>
                    <small [class.text-muted]="!isTypeFilterActive(CardType.Battle)">Battle</small>
                  </div>
                </div>
                <div class="col-3">
                  <div
                    class="border rounded p-2"
                    [class.bg-primary]="isTypeFilterActive(CardType.Mission)"
                    [class.text-white]="isTypeFilterActive(CardType.Mission)"
                    style="cursor: pointer;"
                    (click)="toggleDeckTypeFilter(CardType.Mission)"
                  >
                    <div class="fw-bold">{{ missionCards() }}</div>
                    <small [class.text-muted]="!isTypeFilterActive(CardType.Mission)"
                      >Mission</small
                    >
                  </div>
                </div>
                <div class="col-3">
                  <div
                    class="border rounded p-2"
                    [class.bg-primary]="isTypeFilterActive(CardType.Location)"
                    [class.text-white]="isTypeFilterActive(CardType.Location)"
                    style="cursor: pointer;"
                    (click)="toggleDeckTypeFilter(CardType.Location)"
                  >
                    <div class="fw-bold">{{ locationCards() }}</div>
                    <small [class.text-muted]="!isTypeFilterActive(CardType.Location)"
                      >Location</small
                    >
                  </div>
                </div>
                <div class="col-3">
                  <div
                    class="border rounded p-2"
                    [class.bg-primary]="isTypeFilterActive(CardType.Equipment)"
                    [class.text-white]="isTypeFilterActive(CardType.Equipment)"
                    style="cursor: pointer;"
                    (click)="toggleDeckTypeFilter(CardType.Equipment)"
                  >
                    <div class="fw-bold">{{ equipmentCards() }}</div>
                    <small [class.text-muted]="!isTypeFilterActive(CardType.Equipment)"
                      >Equipment</small
                    >
                  </div>
                </div>
              </div>

              @if (deckFilter() !== null) {
                <div class="mb-2 text-center">
                  <button class="btn btn-sm btn-outline-secondary" (click)="clearDeckFilter()">
                    <i class="bi bi-x-circle me-1"></i>Clear Filter ({{ getFilterLabel() }})
                  </button>
                </div>
              }

              <!-- Deck card list -->
              <div style="max-height: 400px; overflow-y: auto;">
                @if (filteredDeckCards().length === 0) {
                  <p class="text-muted text-center py-3">
                    @if (deckFilter() !== null) {
                      No {{ getFilterLabel() }} cards in deck
                    } @else {
                      Add cards from the browser to build your deck
                    }
                  </p>
                } @else {
                  @for (entry of filteredDeckCards(); track entry.card.id) {
                    <div class="p-2 border-bottom">
                      <div class="d-flex align-items-center justify-content-between">
                        <div>
                          <strong>{{ entry.card.name }}</strong>
                          @if (entry.card.version) {
                            <span class="text-muted">({{ entry.card.version }})</span>
                          }
                          <span class="badge bg-secondary ms-2">x{{ entry.quantity }}</span>
                        </div>
                        <div class="d-flex gap-2">
                          @if (entry.card.imageUrl) {
                            <button
                              class="btn btn-sm"
                              [class.btn-outline-secondary]="!isDeckImageVisible(entry.card.id)"
                              [class.btn-secondary]="isDeckImageVisible(entry.card.id)"
                              (click)="toggleDeckImage(entry.card.id)"
                              title="Toggle image"
                            >
                              <i
                                class="bi"
                                [class.bi-eye]="!isDeckImageVisible(entry.card.id)"
                                [class.bi-eye-slash]="isDeckImageVisible(entry.card.id)"
                              ></i>
                            </button>
                          }
                          <button
                            class="btn btn-sm btn-outline-primary"
                            [disabled]="entry.quantity >= 4"
                            (click)="addCard(entry.card)"
                            title="Add copy"
                          >
                            <i class="bi bi-plus"></i>
                          </button>
                          <button
                            class="btn btn-sm btn-outline-danger"
                            (click)="removeCard(entry.card)"
                            title="Remove copy"
                          >
                            <i class="bi bi-dash"></i>
                          </button>
                        </div>
                      </div>
                      @if (isDeckImageVisible(entry.card.id) && entry.card.imageUrl) {
                        <div class="mt-2 text-center">
                          <img
                            [src]="entry.card.imageUrl"
                            [alt]="entry.card.name"
                            class="img-fluid rounded"
                            style="max-height: 200px;"
                          />
                        </div>
                      }
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
  imports: [RouterLink, NgbPagination, CardFiltersComponent],
})
export class DeckBuilderComponent implements OnInit, HasUnsavedChanges {
  protected readonly CardType = CardType;
  protected readonly Arena = Arena;

  @ViewChild(CardFiltersComponent) cardFilters!: CardFiltersComponent;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected deckService = inject(DeckService);
  private cardService = inject(CardService);

  // State
  deck = signal<DeckDto | null>(null);
  deckCards = signal<DeckCardEntry[]>([]);
  availableCards = signal<CardDto[]>([]);
  saving = signal(false);
  private savedDeckState = '';

  // Rename state
  editingName = signal(false);
  newName = signal('');

  // Image visibility tracking
  visibleBrowserImages = signal<ImageVisibility>(new Set());
  visibleDeckImages = signal<ImageVisibility>(new Set());

  // Pagination
  readonly pageSize = 25;
  currentPage = signal(1);
  totalCount = signal(0);
  totalPages = signal(0);

  // Filter state
  private currentFilter: CardFilter = {};

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

  // Card type counts
  battleCards = computed(() =>
    this.deckCards()
      .filter((e) => e.card.type === CardType.Battle)
      .reduce((sum, e) => sum + e.quantity, 0),
  );

  missionCards = computed(() =>
    this.deckCards()
      .filter((e) => e.card.type === CardType.Mission)
      .reduce((sum, e) => sum + e.quantity, 0),
  );

  locationCards = computed(() =>
    this.deckCards()
      .filter((e) => e.card.type === CardType.Location)
      .reduce((sum, e) => sum + e.quantity, 0),
  );

  equipmentCards = computed(() =>
    this.deckCards()
      .filter((e) => e.card.type === CardType.Equipment)
      .reduce((sum, e) => sum + e.quantity, 0),
  );

  // Filter state for deck view (supports both CardType and Arena)
  deckFilter = signal<DeckFilter>(null);

  // Filtered deck cards based on selected type or arena
  filteredDeckCards = computed(() => {
    const filter = this.deckFilter();
    if (filter === null) {
      return this.deckCards();
    }
    if (filter.kind === 'type') {
      return this.deckCards().filter((e) => e.card.type === filter.value);
    } else {
      // Arena filter: show Units with matching arena
      return this.deckCards().filter(
        (e) => e.card.type === CardType.Unit && e.card.arena === filter.value,
      );
    }
  });

  // Local validation that updates immediately when deck changes
  localValidation = computed<DeckValidationResult>(() => {
    const errors: string[] = [];
    const total = this.totalCards();
    const space = this.spaceUnits();
    const ground = this.groundUnits();
    const character = this.characterUnits();

    if (total < 60) {
      errors.push(`Deck must have at least 60 cards (currently ${total})`);
    }
    if (space < 12) {
      errors.push(`Deck must have at least 12 Space units (currently ${space})`);
    }
    if (ground < 12) {
      errors.push(`Deck must have at least 12 Ground units (currently ${ground})`);
    }
    if (character < 12) {
      errors.push(`Deck must have at least 12 Character units (currently ${character})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  });

  ngOnInit(): void {
    const deckId = Number(this.route.snapshot.paramMap.get('id'));
    if (isNaN(deckId)) {
      this.router.navigate(['/decks']);
      return;
    }

    this.loadDeck(deckId);
  }

  onFilterChange(filter: CardFilter): void {
    this.currentFilter = filter;
    this.currentPage.set(1);
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
        this.savedDeckState = this.serializeDeckState(entries);
        // Load cards after deck is loaded (for alignment filter)
        this.loadCards();
      },
      error: () => {
        this.router.navigate(['/decks']);
      },
    });
  }

  private loadCards(): void {
    const deck = this.deck();
    const filter: CardFilter = {
      ...this.currentFilter,
      page: this.currentPage(),
      pageSize: this.pageSize,
      alignment: deck?.alignment ?? undefined,
    };

    this.cardService.getCards(filter).subscribe({
      next: (result) => {
        this.totalCount.set(result.totalCount);
        this.totalPages.set(result.totalPages);
        this.availableCards.set(result.items);
      },
    });
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadCards();
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
        this.savedDeckState = this.serializeDeckState(this.deckCards());
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  startRename(): void {
    const deck = this.deck();
    if (!deck) return;
    this.newName.set(deck.name);
    this.editingName.set(true);
  }

  cancelRename(): void {
    this.editingName.set(false);
    this.newName.set('');
  }

  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newName.set(input.value);
  }

  confirmRename(): void {
    const deck = this.deck();
    const name = this.newName().trim();
    if (!deck || !name || name === deck.name) {
      this.cancelRename();
      return;
    }

    this.saving.set(true);
    this.deckService.updateDeck(deck.id, { name }).subscribe({
      next: (updatedDeck) => {
        this.deck.set(updatedDeck);
        this.editingName.set(false);
        this.newName.set('');
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
      },
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

  // Image visibility methods
  toggleBrowserImage(cardId: number): void {
    this.visibleBrowserImages.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  }

  toggleDeckImage(cardId: number): void {
    this.visibleDeckImages.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  }

  showAllBrowserImages(): void {
    const ids = this.availableCards().map((c) => c.id);
    this.visibleBrowserImages.set(new Set(ids));
  }

  hideAllBrowserImages(): void {
    this.visibleBrowserImages.set(new Set());
  }

  showAllDeckImages(): void {
    const ids = this.deckCards().map((e) => e.card.id);
    this.visibleDeckImages.set(new Set(ids));
  }

  hideAllDeckImages(): void {
    this.visibleDeckImages.set(new Set());
  }

  isBrowserImageVisible(cardId: number): boolean {
    return this.visibleBrowserImages().has(cardId);
  }

  isDeckImageVisible(cardId: number): boolean {
    return this.visibleDeckImages().has(cardId);
  }

  // Deck filter methods
  toggleDeckTypeFilter(type: CardType): void {
    const current = this.deckFilter();
    if (current?.kind === 'type' && current.value === type) {
      this.deckFilter.set(null);
    } else {
      this.deckFilter.set({ kind: 'type', value: type });
    }
  }

  toggleDeckArenaFilter(arena: Arena): void {
    const current = this.deckFilter();
    if (current?.kind === 'arena' && current.value === arena) {
      this.deckFilter.set(null);
    } else {
      this.deckFilter.set({ kind: 'arena', value: arena });
    }
  }

  isTypeFilterActive(type: CardType): boolean {
    const filter = this.deckFilter();
    return filter?.kind === 'type' && filter.value === type;
  }

  isArenaFilterActive(arena: Arena): boolean {
    const filter = this.deckFilter();
    return filter?.kind === 'arena' && filter.value === arena;
  }

  getFilterLabel(): string {
    const filter = this.deckFilter();
    if (!filter) return '';
    if (filter.kind === 'type') {
      return this.getCardTypeLabel(filter.value);
    } else {
      return `${this.getArenaLabel(filter.value)} Unit`;
    }
  }

  clearDeckFilter(): void {
    this.deckFilter.set(null);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  hasUnsavedChanges(): boolean {
    const currentState = this.serializeDeckState(this.deckCards());
    return currentState !== this.savedDeckState;
  }

  private serializeDeckState(entries: DeckCardEntry[]): string {
    const sorted = [...entries]
      .map((e) => `${e.card.id}:${e.quantity}`)
      .sort()
      .join(',');
    return sorted;
  }
}
