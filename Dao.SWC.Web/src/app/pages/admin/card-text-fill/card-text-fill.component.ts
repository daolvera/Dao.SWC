import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardUpdateDto } from '../../../models/dtos/card.dto';
import { CardService } from '../../../services/card.service';
import {
  AdminService,
  CardScrapeNotFoundDto,
  CardTextScrapeResult,
} from '../../../services/admin.service';

interface EditableNotFoundCard extends CardScrapeNotFoundDto {
  cardText: string;
}

@Component({
  selector: 'app-card-text-fill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <a routerLink="/admin/cards" class="btn btn-link px-0">
            <i class="bi bi-arrow-left me-1"></i>Back to Card Management
          </a>
          <h2 class="mb-0">Card Text Auto-Fill</h2>
          <p class="text-muted mb-0">
            Scrape card text from swtcg.com for cards missing descriptions.
          </p>
        </div>
        <div class="d-flex gap-2">
          @if (notFoundCards().length > 0) {
            <button
              class="btn btn-primary"
              [disabled]="saving() || savableCount() === 0"
              (click)="saveManualEntries()"
            >
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-2"></span>
              }
              <i class="bi bi-floppy me-1"></i>Save Manual Entries ({{ savableCount() }})
            </button>
          }
          <button
            class="btn btn-success"
            [disabled]="scraping()"
            (click)="startScrape()"
          >
            @if (scraping()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
              Scraping...
            } @else {
              <i class="bi bi-cloud-download me-1"></i>Auto-Fill from swtcg.com
            }
          </button>
        </div>
      </div>

      <!-- Status Banner -->
      @if (scrapeResult()) {
        <div class="alert alert-info d-flex align-items-center mb-3">
          <i class="bi bi-info-circle me-2 fs-5"></i>
          <div>
            <strong>Scrape Complete:</strong>
            {{ scrapeResult()!.filledCount }} cards filled successfully.
            @if (scrapeResult()!.notFoundCount > 0) {
              {{ scrapeResult()!.notFoundCount }} cards need manual entry below.
            } @else {
              All cards have been filled!
            }
          </div>
        </div>
      }

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

      <!-- Scraping Progress -->
      @if (scraping()) {
        <div class="card mb-3">
          <div class="card-body text-center py-5">
            <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;">
              <span class="visually-hidden">Scraping...</span>
            </div>
            <h5>Scraping card text from swtcg.com</h5>
            <p class="text-muted">
              This may take several minutes depending on how many cards need text.
              Please don't close this page.
            </p>
          </div>
        </div>
      }

      <!-- Not Found Cards Grid -->
      @if (notFoundCards().length > 0) {
        <h4 class="mb-3">
          <i class="bi bi-pencil-square me-1"></i>
          Cards Requiring Manual Entry ({{ notFoundCards().length }})
        </h4>
        <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          @for (card of notFoundCards(); track card.id) {
            <div class="col">
              <div class="card h-100">
                <div class="card-body d-flex gap-3">
                  <div class="flex-shrink-0">
                    @if (card.imageUrl) {
                      <img
                        [src]="card.imageUrl"
                        [alt]="card.name"
                        class="card-image-thumb"
                        (error)="onImageError($event)"
                      />
                    } @else {
                      <div class="card-image-placeholder">
                        <i class="bi bi-image text-muted"></i>
                      </div>
                    }
                  </div>
                  <div class="flex-grow-1">
                    <h6 class="card-title mb-1">
                      {{ card.name }}
                      @if (card.version) {
                        <span class="badge bg-secondary ms-1">{{ card.version }}</span>
                      }
                    </h6>
                    <textarea
                      class="form-control form-control-sm"
                      [(ngModel)]="card.cardText"
                      placeholder="Enter card text..."
                      rows="4"
                      style="resize: vertical; min-height: 80px;"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Empty State -->
      @if (!scraping() && !scrapeResult() && notFoundCards().length === 0) {
        <div class="card">
          <div class="card-body text-center py-5">
            <i class="bi bi-cloud-download display-1 text-muted mb-3 d-block"></i>
            <h5>Ready to Auto-Fill Card Text</h5>
            <p class="text-muted">
              Click the "Auto-Fill from swtcg.com" button to search for card text
              for all cards that don't have descriptions yet.
            </p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .card-image-thumb {
        width: 80px;
        height: 112px;
        object-fit: cover;
        border-radius: 4px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
      }
      .card-image-placeholder {
        width: 80px;
        height: 112px;
        border-radius: 4px;
        background: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
      }
    `,
  ],
})
export class CardTextFillComponent {
  private adminService = inject(AdminService);
  private cardService = inject(CardService);

  scraping = signal(false);
  saving = signal(false);
  scrapeResult = signal<CardTextScrapeResult | null>(null);
  notFoundCards = signal<EditableNotFoundCard[]>([]);
  error = signal<string | null>(null);
  saveSuccess = signal<string | null>(null);
  savableCount = signal(0);

  startScrape(): void {
    this.scraping.set(true);
    this.error.set(null);
    this.saveSuccess.set(null);
    this.scrapeResult.set(null);
    this.notFoundCards.set([]);

    this.adminService.scrapeCardTexts().subscribe({
      next: (result) => {
        this.scrapeResult.set(result);
        this.notFoundCards.set(
          result.notFoundCards.map((card) => ({ ...card, cardText: '' })),
        );
        this.updateSavableCount();
        this.scraping.set(false);
      },
      error: (err) => {
        this.error.set(
          err.error?.detail || err.message || 'An error occurred while scraping card texts.',
        );
        this.scraping.set(false);
      },
    });
  }

  saveManualEntries(): void {
    const cardsToSave = this.notFoundCards().filter((c) => c.cardText.trim().length > 0);
    if (cardsToSave.length === 0) return;

    this.saving.set(true);
    this.error.set(null);
    this.saveSuccess.set(null);

    // Fetch actual card data first, then update with the new card text
    this.cardService.getCards({ pageSize: 10000 }).subscribe({
      next: (result) => {
        const cardMap = new Map(result.items.map((c) => [c.id, c]));
        const fullUpdates: CardUpdateDto[] = cardsToSave
          .filter((c) => cardMap.has(c.id))
          .map((card) => {
            const existing = cardMap.get(card.id)!;
            return {
              id: existing.id,
              name: existing.name,
              type: existing.type,
              alignment: existing.alignment,
              arena: existing.arena,
              version: existing.version,
              isPilot: existing.isPilot,
              imageUrl: existing.imageUrl,
              cardText: card.cardText.trim(),
            };
          });

        if (fullUpdates.length === 0) {
          this.saving.set(false);
          return;
        }

        this.cardService.bulkUpdateCards(fullUpdates).subscribe({
          next: (updatedCards) => {
            // Remove saved cards from the not-found list
            const savedIds = new Set(updatedCards.map((c) => c.id));
            this.notFoundCards.update((cards) => cards.filter((c) => !savedIds.has(c.id)));
            this.updateSavableCount();
            this.saveSuccess.set(`Successfully saved card text for ${updatedCards.length} cards.`);
            this.saving.set(false);
          },
          error: (err) => {
            this.error.set(
              err.error?.detail || err.message || 'An error occurred while saving card texts.',
            );
            this.saving.set(false);
          },
        });
      },
      error: (err) => {
        this.error.set('Failed to fetch card data for update.');
        this.saving.set(false);
      },
    });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  private updateSavableCount(): void {
    this.savableCount.set(this.notFoundCards().filter((c) => c.cardText.trim().length > 0).length);
  }
}
