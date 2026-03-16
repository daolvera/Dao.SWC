import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Output,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Alignment, Arena, CardCreateDto, CardDto, CardType } from '../../../models/dtos/card.dto';
import { CardService } from '../../../services/card.service';

@Component({
  selector: 'app-card-create-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <ng-template #modalContent let-modal>
      <div class="modal-header">
        <h5 class="modal-title">Create New Card</h5>
        <button type="button" class="btn-close" (click)="modal.dismiss()"></button>
      </div>
      <div class="modal-body">
        <!-- Image Upload -->
        <div class="mb-3">
          <label class="form-label">Card Image</label>
          <div class="d-flex gap-3 align-items-start">
            <div class="flex-grow-1">
              <input
                type="file"
                class="form-control"
                accept="image/jpeg,image/png,image/gif,image/webp"
                (change)="onFileSelected($event)"
                #fileInput
              />
              <small class="text-muted">Max 5MB. Allowed: JPEG, PNG, GIF, WebP</small>
              @if (uploadError()) {
                <div class="text-danger mt-1">{{ uploadError() }}</div>
              }
            </div>
            @if (imagePreview()) {
              <div class="text-center">
                <img
                  [src]="imagePreview()"
                  alt="Preview"
                  class="img-thumbnail"
                  style="max-height: 150px; max-width: 150px;"
                />
                <br />
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger mt-1"
                  (click)="clearImage()"
                >
                  Remove
                </button>
              </div>
            }
          </div>
        </div>

        <!-- Card Name -->
        <div class="mb-3">
          <label class="form-label">Name <span class="text-danger">*</span></label>
          <input
            type="text"
            class="form-control"
            [(ngModel)]="cardName"
            placeholder="Enter card name"
            required
          />
        </div>

        <!-- Card Type -->
        <div class="row mb-3">
          <div class="col-md-6">
            <label class="form-label">Type <span class="text-danger">*</span></label>
            <select class="form-select" [(ngModel)]="cardType">
              <option [ngValue]="CardType.Unit">Unit</option>
              <option [ngValue]="CardType.Location">Location</option>
              <option [ngValue]="CardType.Equipment">Equipment</option>
              <option [ngValue]="CardType.Mission">Mission</option>
              <option [ngValue]="CardType.Battle">Battle</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Alignment <span class="text-danger">*</span></label>
            <select class="form-select" [(ngModel)]="cardAlignment">
              <option [ngValue]="Alignment.Light">Light</option>
              <option [ngValue]="Alignment.Dark">Dark</option>
              <option [ngValue]="Alignment.Neutral">Neutral</option>
            </select>
          </div>
        </div>

        <!-- Arena and Version -->
        <div class="row mb-3">
          <div class="col-md-6">
            <label class="form-label">Arena</label>
            <select class="form-select" [(ngModel)]="cardArena">
              <option [ngValue]="null">None</option>
              <option [ngValue]="Arena.Space">Space</option>
              <option [ngValue]="Arena.Ground">Ground</option>
              <option [ngValue]="Arena.Character">Character</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Version</label>
            <input
              type="text"
              class="form-control"
              [(ngModel)]="cardVersion"
              placeholder="A, B, C..."
            />
          </div>
        </div>

        <!-- Card Text -->
        <div class="mb-3">
          <label class="form-label">Card Text</label>
          <textarea
            class="form-control"
            [(ngModel)]="cardText"
            rows="4"
            placeholder="Enter card rules text..."
          ></textarea>
        </div>

        @if (saveError()) {
          <div class="alert alert-danger">{{ saveError() }}</div>
        }
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" (click)="modal.dismiss()">Cancel</button>
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!canSave() || saving()"
          (click)="saveCard()"
        >
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Create Card
        </button>
      </div>
    </ng-template>
  `,
})
export class CardCreateModalComponent {
  protected readonly CardType = CardType;
  protected readonly Alignment = Alignment;
  protected readonly Arena = Arena;

  @ViewChild('modalContent') modalContent!: TemplateRef<unknown>;
  @Output() cardCreated = new EventEmitter<CardDto>();

  private modalService = inject(NgbModal);
  private cardService = inject(CardService);
  private modalRef: NgbModalRef | null = null;

  // Form state
  cardName = '';
  cardType = CardType.Unit;
  cardAlignment = Alignment.Light;
  cardArena: Arena | null = null;
  cardVersion: string | null = null;
  cardText: string | null = null;

  // UI state
  saving = signal(false);
  imagePreview = signal<string | null>(null);
  uploadError = signal<string | null>(null);
  saveError = signal<string | null>(null);

  private selectedFile: File | null = null;

  open(): void {
    this.resetForm();
    this.modalRef = this.modalService.open(this.modalContent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
    });
  }

  private resetForm(): void {
    this.cardName = '';
    this.cardType = CardType.Unit;
    this.cardAlignment = Alignment.Light;
    this.cardArena = null;
    this.cardVersion = null;
    this.cardText = null;
    this.selectedFile = null;
    this.imagePreview.set(null);
    this.uploadError.set(null);
    this.saveError.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.uploadError.set('Invalid file type. Allowed: JPEG, PNG, GIF, WebP');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set('File size exceeds 5MB limit');
      return;
    }

    this.uploadError.set(null);
    this.selectedFile = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  clearImage(): void {
    this.selectedFile = null;
    this.imagePreview.set(null);
    this.uploadError.set(null);
  }

  canSave(): boolean {
    return this.cardName.trim().length > 0;
  }

  saveCard(): void {
    if (!this.canSave()) return;

    this.saving.set(true);
    this.saveError.set(null);

    const dto: CardCreateDto = {
      name: this.cardName.trim(),
      type: this.cardType,
      alignment: this.cardAlignment,
      arena: this.cardArena,
      version: this.cardVersion?.trim() || null,
      cardText: this.cardText?.trim() || null,
    };

    this.cardService.createCard(dto, this.selectedFile ?? undefined).subscribe({
      next: (card) => {
        this.saving.set(false);
        this.cardCreated.emit(card);
        this.modalRef?.close();
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err.error?.message || err.error || 'Failed to create card');
      },
    });
  }
}
