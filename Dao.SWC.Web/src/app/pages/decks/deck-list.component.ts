import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Alignment } from '../../models/dtos/card.dto';
import { DeckListItemDto } from '../../models/dtos/deck.dto';
import { DeckService } from '../../services/deck.service';

@Component({
  selector: 'app-deck-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>My Decks</h1>
        <div class="d-flex gap-2">
          <a routerLink="/decks/import" class="btn btn-outline-primary">
            <i class="bi bi-upload me-2"></i>Import CSV
          </a>
          <a routerLink="/decks/new" class="btn btn-primary">
            <i class="bi bi-plus-lg me-2"></i>Create Deck
          </a>
        </div>
      </div>

      @if (loading()) {
        <div class="text-center py-5">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      } @else if (decks().length === 0) {
        <div class="text-center py-5">
          <h3>No decks yet</h3>
          <p class="text-muted">Create your first deck to get started!</p>
          <a routerLink="/decks/new" class="btn btn-primary">Create Deck</a>
        </div>
      } @else {
        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
          @for (deck of decks(); track deck.id) {
            <div class="col">
              <div class="card h-100" [class.border-warning]="!deck.isValid">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="card-title mb-0">{{ deck.name }}</h5>
                    <span
                      class="badge"
                      [class.bg-primary]="deck.alignment === Alignment.Light"
                      [class.bg-dark]="deck.alignment === Alignment.Dark"
                      [class.bg-secondary]="deck.alignment === Alignment.Neutral"
                    >
                      {{ getAlignmentLabel(deck.alignment) }}
                    </span>
                  </div>
                  <p class="card-text text-muted">{{ deck.totalCards }} cards</p>
                  @if (!deck.isValid) {
                    <span class="badge bg-warning text-dark">
                      <i class="bi bi-exclamation-triangle me-1"></i>Invalid
                    </span>
                  } @else {
                    <span class="badge bg-success">
                      <i class="bi bi-check-circle me-1"></i>Valid
                    </span>
                  }
                </div>
                <div class="card-footer bg-transparent">
                  <div class="btn-group w-100">
                    <a [routerLink]="['/decks', deck.id, 'edit']" class="btn btn-outline-primary">
                      Edit
                    </a>
                    <a
                      [href]="getExportUrl(deck.id)"
                      class="btn btn-outline-secondary"
                      download
                    >
                      Export
                    </a>
                    <button type="button" class="btn btn-outline-danger" (click)="deleteDeck(deck)">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  imports: [RouterLink],
})
export class DeckListComponent implements OnInit {
  protected readonly Alignment = Alignment;

  private deckService = inject(DeckService);
  private router = inject(Router);

  decks = signal<DeckListItemDto[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadDecks();
  }

  private loadDecks(): void {
    this.loading.set(true);
    this.deckService.getUserDecks().subscribe({
      next: (decks) => {
        this.decks.set(decks);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  getAlignmentLabel(alignment: Alignment): string {
    switch (alignment) {
      case Alignment.Light:
        return 'Light Side';
      case Alignment.Dark:
        return 'Dark Side';
      case Alignment.Neutral:
        return 'Neutral';
    }
  }

  getExportUrl(deckId: number): string {
    return this.deckService.getExportUrl(deckId);
  }

  deleteDeck(deck: DeckListItemDto): void {
    if (confirm(`Are you sure you want to delete "${deck.name}"?`)) {
      this.deckService.deleteDeck(deck.id).subscribe(() => {
        this.decks.update((decks) => decks.filter((d) => d.id !== deck.id));
      });
    }
  }
}
