import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { CardDto, CardUpdateDto } from '../../../models/dtos/card.dto';
import { CardService } from '../../../services/card.service';

interface EditableCard extends CardDto {
  newCardText: string;
}

@Component({
  selector: 'app-card-text-fill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, NgbPagination],
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <a routerLink="/admin/cards" class="btn btn-link px-0">
            <i class="bi bi-arrow-left me-1"></i>Back to Card Management
          </a>
          <h2 class="mb-0">Cards Missing Text</h2>
          <p class="text-muted mb-0">
            Cards without descriptions. View the card image and enter the text manually.
          </p>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <span class="text-muted">{{ totalCount() }} cards missing text</span>
          <button
            class="btn btn-primary"
            [disabled]="saving() || savableCount() === 0"
            (click)="saveEntries()"
          >
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
            }
            <i class="bi bi-floppy me-1"></i>Save ({{ savableCount() }})
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="alert alert-danger d-flex align-items-center mb-3">
          <i class="bi bi-exclamation-triangle me-2 fs-5"></i>
          <div>{{ error() }}</div>
        </div>
      }

      @if (saveSuccess()) {
        <div class="alert alert-success d-flex align-items-center mb-3">
          <i class="bi bi-check-circle me-2 fs-5"></i>
          <div>{{ saveSuccess() }}</div>
        </div>
      }

      @if (loading()) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted mt-3">Loading cards...</p>
        </div>
      } @else if (cards().length === 0) {
        <div class="card">
          <div class="card-body text-center py-5">
            <i class="bi bi-check-circle display-1 text-success mb-3 d-block"></i>
            <h5>All Cards Have Text</h5>
            <p class="text-muted">
              Every card in the database has a description. Nice work!
            </p>
          </div>
        </div>
      } @else {
        <!-- Page Size -->
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="d-flex align-items-center gap-2">
            <label class="form-label mb-0">Page Size:</label>
            <select
              class="form-select form-select-sm"
              style="width: auto;"
              [(ngModel)]="pageSize"
              (change)="loadCards()"
            >
              <option [value]="25">25</option>
              <option [value]="50">50</option>
              <option [value]="100">100</option>
            </select>
          </div>
          <small class="text-muted">
            Showing {{ cards().length }} of {{ totalCount() }} cards
          </small>
        </div>

        <!-- Cards Grid -->
        <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          @for (card of cards(); track card.id) {
            <div class="col">
              <div class="card h-100" [class.border-success]="card.newCardText.trim().length > 0">
                <div class="card-body d-flex gap-3">
                  <div class="flex-shrink-0">
                    @if (card.imageUrl) {
                      <img
                        [src]="card.imageUrl"
                        [alt]="card.name"
                        class="card-image"
                        (error)="onImageError($event)"
                      />
                    } @else {
                      <div class="card-image-placeholder">
                        <i class="bi bi-image text-muted"></i>
                      </div>
                    }
                  </div>
                  <div class="flex-grow-1 d-flex flex-column">
                    <h6 class="card-title mb-1">
                      {{ card.name }}
                      @if (card.version) {
                        <span class="badge bg-secondary ms-1">{{ card.version }}</span>
                      }
                    </h6>
                    <textarea
                      class="form-control form-control-sm flex-grow-1"
                      [(ngModel)]="card.newCardText"
                      (ngModelChange)="updateSavableCount()"
                      placeholder="Enter card text..."
                      style="resize: vertical; min-height: 100px;"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
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
            />
            <small class="text-muted mt-1">
              Page {{ currentPage() }} of {{ totalPages() }}
            </small>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .card-image {
        width: 280px;
        height: 392px;
        object-fit: contain;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .card-image-placeholder {
        width: 280px;
        height: 392px;
        border-radius: 6px;
        background: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
      }
    `,
  ],
})
export class CardTextFillComponent implements OnInit {
  private cardService = inject(CardService);

  cards = signal<EditableCard[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  saveSuccess = signal<string | null>(null);
  savableCount = signal(0);

  // Pagination
  pageSize = 25;
  currentPage = signal(1);
  totalCount = signal(0);
  totalPages = signal(0);

  ngOnInit(): void {
    this.loadCards();
  }

  loadCards(): void {
    this.loading.set(true);
    this.error.set(null);

    this.cardService
      .getCards({
        missingCardText: true,
        page: this.currentPage(),
        pageSize: this.pageSize,
      })
      .subscribe({
        next: (result) => {
          this.totalCount.set(result.totalCount);
          this.totalPages.set(result.totalPages);
          this.cards.set(
            result.items.map((card) => ({ ...card, newCardText: '' })),
          );
          this.updateSavableCount();
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(
            err.error?.detail || err.message || 'Failed to load cards.',
          );
          this.loading.set(false);
        },
      });
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadCards();
  }

  saveEntries(): void {
    const cardsToSave = this.cards().filter((c) => c.newCardText.trim().length > 0);
    if (cardsToSave.length === 0) return;

    this.saving.set(true);
    this.error.set(null);
    this.saveSuccess.set(null);

    const updates: CardUpdateDto[] = cardsToSave.map((card) => ({
      id: card.id,
      name: card.name,
      type: card.type,
      alignment: card.alignment,
      arena: card.arena,
      version: card.version,
      isPilot: card.isPilot,
      imageUrl: card.imageUrl,
      cardText: card.newCardText.trim(),
    }));

    this.cardService.bulkUpdateCards(updates).subscribe({
      next: (updatedCards) => {
        const savedIds = new Set(updatedCards.map((c) => c.id));
        this.cards.update((cards) => cards.filter((c) => !savedIds.has(c.id)));
        this.totalCount.update((count) => count - updatedCards.length);
        this.updateSavableCount();
        this.saveSuccess.set(
          `Successfully saved card text for ${updatedCards.length} card${updatedCards.length !== 1 ? 's' : ''}.`,
        );
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(
          err.error?.detail || err.message || 'An error occurred while saving.',
        );
        this.saving.set(false);
      },
    });
  }

  updateSavableCount(): void {
    this.savableCount.set(
      this.cards().filter((c) => c.newCardText.trim().length > 0).length,
    );
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}
