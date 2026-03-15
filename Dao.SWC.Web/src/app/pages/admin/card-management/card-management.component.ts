import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgbModal, NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { Alignment, Arena, CardDto, CardType, CardUpdateDto } from '../../../models/dtos/card.dto';
import { CardFilter } from '../../../models/filters/card-filter';
import { CardService } from '../../../services/card.service';
import { AdminService } from '../../../services/admin.service';
import { AuthService, Roles } from '../../../services/auth.service';
import { CardFiltersComponent } from '../../../components/card-filters/card-filters.component';
import { RoleManagementModalComponent } from '../role-management-modal/role-management-modal.component';
import { CardCreateModalComponent } from '../card-create-modal/card-create-modal.component';

interface EditableCard extends CardDto {
  isDirty: boolean;
}

@Component({
  selector: 'app-card-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    NgbPagination,
    CardFiltersComponent,
    RoleManagementModalComponent,
    CardCreateModalComponent,
  ],
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <a routerLink="/" class="btn btn-link px-0">
            <i class="bi bi-arrow-left me-1"></i>Back to Home
          </a>
          <h2 class="mb-0">Card Management</h2>
        </div>
        <div class="d-flex gap-2">
          <button
            class="btn btn-outline-secondary"
            [disabled]="seeding()"
            (click)="seedCards()"
            title="Add test cards to database"
          >
            @if (seeding()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
            }
            <i class="bi bi-database-add me-1"></i>Seed Test Cards
          </button>
          <button class="btn btn-success" (click)="openCreateModal()">
            <i class="bi bi-plus-lg me-1"></i>New Card
          </button>
          <button
            class="btn btn-primary"
            [disabled]="!hasChanges() || saving()"
            (click)="saveChanges()"
          >
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
            }
            Save Changes ({{ dirtyCount() }})
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card mb-3">
        <div class="card-body">
          <app-card-filters [showAlignmentFilter]="true" (filterChange)="onFilterChange($event)" />
        </div>
      </div>

      <!-- Page Size Control -->
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-2">
          <label class="form-label mb-0">Page Size:</label>
          <select
            class="form-select form-select-sm"
            style="width: auto;"
            [(ngModel)]="pageSize"
            (change)="loadCards()"
          >
            <option [value]="50">50</option>
            <option [value]="100">100</option>
            <option [value]="200">200</option>
            <option [value]="500">500</option>
          </select>
        </div>
        <small class="text-muted"> Showing {{ cards().length }} of {{ totalCount() }} cards </small>
      </div>

      <!-- Cards Table -->
      <div class="table-responsive">
        <table class="table table-sm table-bordered">
          <thead class="table-light sticky-top">
            <tr>
              <th style="width: 50px;">ID</th>
              <th style="width: 180px;">Name</th>
              <th style="width: 100px;">Type</th>
              <th style="width: 100px;">Alignment</th>
              <th style="width: 100px;">Arena</th>
              <th style="width: 80px;">Version</th>
              <th style="width: 200px;">Image URL</th>
              <th>Card Text</th>
              <th style="width: 60px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (card of cards(); track card.id) {
              <tr [class.table-warning]="card.isDirty">
                <td class="align-middle text-center">{{ card.id }}</td>
                <td>
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    [(ngModel)]="card.name"
                    (ngModelChange)="markDirty(card)"
                  />
                </td>
                <td>
                  <select
                    class="form-select form-select-sm"
                    [(ngModel)]="card.type"
                    (ngModelChange)="markDirty(card)"
                  >
                    <option [ngValue]="CardType.Unit">Unit</option>
                    <option [ngValue]="CardType.Location">Location</option>
                    <option [ngValue]="CardType.Equipment">Equipment</option>
                    <option [ngValue]="CardType.Mission">Mission</option>
                    <option [ngValue]="CardType.Battle">Battle</option>
                  </select>
                </td>
                <td>
                  <select
                    class="form-select form-select-sm"
                    [(ngModel)]="card.alignment"
                    (ngModelChange)="markDirty(card)"
                  >
                    <option [ngValue]="Alignment.Light">Light</option>
                    <option [ngValue]="Alignment.Dark">Dark</option>
                    <option [ngValue]="Alignment.Neutral">Neutral</option>
                  </select>
                </td>
                <td>
                  <select
                    class="form-select form-select-sm"
                    [(ngModel)]="card.arena"
                    (ngModelChange)="markDirty(card)"
                  >
                    <option [ngValue]="null">None</option>
                    <option [ngValue]="Arena.Space">Space</option>
                    <option [ngValue]="Arena.Ground">Ground</option>
                    <option [ngValue]="Arena.Character">Character</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    [(ngModel)]="card.version"
                    (ngModelChange)="markDirty(card)"
                    placeholder="A, B..."
                  />
                </td>
                <td>
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    [(ngModel)]="card.imageUrl"
                    (ngModelChange)="markDirty(card)"
                  />
                </td>
                <td>
                  <textarea
                    class="form-control form-control-sm"
                    [(ngModel)]="card.cardText"
                    (ngModelChange)="markDirty(card)"
                    rows="2"
                    style="resize: vertical; min-height: 60px;"
                  ></textarea>
                </td>
                <td class="align-middle text-center">
                  <button
                    class="btn btn-outline-danger btn-sm"
                    title="Delete card"
                    (click)="deleteCard(card)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
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
          <small class="text-muted mt-1"> Page {{ currentPage() }} of {{ totalPages() }} </small>
        </div>
      }
    </div>

    <!-- Role Management Modal -->
    <app-role-management-modal />

    <!-- Card Create Modal -->
    <app-card-create-modal (cardCreated)="onCardCreated($event)" />
  `,
  styles: [
    `
      .sticky-top {
        top: 0;
        z-index: 1;
      }
      textarea {
        font-size: 0.875rem;
      }
    `,
  ],
})
export class CardManagementComponent implements OnInit {
  protected readonly CardType = CardType;
  protected readonly Alignment = Alignment;
  protected readonly Arena = Arena;

  @ViewChild(CardCreateModalComponent) cardCreateModal!: CardCreateModalComponent;

  private cardService = inject(CardService);
  private adminService = inject(AdminService);
  protected authService = inject(AuthService);

  // State
  cards = signal<EditableCard[]>([]);
  saving = signal(false);
  seeding = signal(false);
  currentFilter: CardFilter = {};

  // Pagination
  pageSize = 100;
  currentPage = signal(1);
  totalCount = signal(0);
  totalPages = signal(0);

  hasChanges = signal(false);
  dirtyCount = signal(0);

  ngOnInit(): void {
    this.loadCards();
  }

  loadCards(): void {
    const filter: CardFilter = {
      ...this.currentFilter,
      page: this.currentPage(),
      pageSize: this.pageSize,
    };

    this.cardService.getCards(filter).subscribe({
      next: (result) => {
        this.totalCount.set(result.totalCount);
        this.totalPages.set(result.totalPages);
        this.cards.set(result.items.map((card) => ({ ...card, isDirty: false })));
        this.updateDirtyState();
      },
    });
  }

  onFilterChange(filter: CardFilter): void {
    this.currentFilter = filter;
    this.currentPage.set(1);
    this.loadCards();
  }

  goToPage(page: number): void {
    if (this.hasChanges()) {
      if (!confirm('You have unsaved changes. Discard and navigate?')) {
        return;
      }
    }
    this.currentPage.set(page);
    this.loadCards();
  }

  markDirty(card: EditableCard): void {
    card.isDirty = true;
    this.updateDirtyState();
  }

  private updateDirtyState(): void {
    const dirtyCards = this.cards().filter((c) => c.isDirty);
    this.dirtyCount.set(dirtyCards.length);
    this.hasChanges.set(dirtyCards.length > 0);
  }

  saveChanges(): void {
    const dirtyCards = this.cards().filter((c) => c.isDirty);
    if (dirtyCards.length === 0) return;

    this.saving.set(true);

    const updates: CardUpdateDto[] = dirtyCards.map((card) => ({
      id: card.id,
      name: card.name,
      type: card.type,
      alignment: card.alignment,
      arena: card.arena,
      version: card.version,
      imageUrl: card.imageUrl,
      cardText: card.cardText,
    }));

    this.cardService.bulkUpdateCards(updates).subscribe({
      next: (updatedCards) => {
        // Update local cards and clear dirty state
        const updatedMap = new Map(updatedCards.map((c) => [c.id, c]));
        this.cards.update((cards) =>
          cards.map((card) => {
            const updated = updatedMap.get(card.id);
            if (updated) {
              return { ...updated, isDirty: false };
            }
            return card;
          }),
        );
        this.updateDirtyState();
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.cardCreateModal.open();
  }

  onCardCreated(card: CardDto): void {
    // Reload the current page to show the new card
    this.loadCards();
  }

  seedCards(): void {
    if (!confirm('This will add test cards to the database. Continue?')) {
      return;
    }

    this.seeding.set(true);
    this.adminService.seedCards().subscribe({
      next: (result) => {
        alert(`Added ${result.cardsAdded} test cards. Total cards: ${result.totalCards}`);
        this.loadCards();
        this.seeding.set(false);
      },
      error: () => {
        this.seeding.set(false);
      },
    });
  }

  deleteCard(card: EditableCard): void {
    if (!confirm(`Are you sure you want to delete "${card.name}"?`)) {
      return;
    }

    this.cardService.deleteCard(card.id).subscribe({
      next: () => {
        // Remove the card from the local list
        this.cards.update((cards) => cards.filter((c) => c.id !== card.id));
        this.totalCount.update((count) => count - 1);
        this.updateDirtyState();
      },
    });
  }
}
