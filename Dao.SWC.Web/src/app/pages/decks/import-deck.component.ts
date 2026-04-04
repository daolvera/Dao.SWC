import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Alignment } from '../../models/dtos/card.dto';
import { DeckImportResult } from '../../models/dtos/deck.dto';
import { DeckService } from '../../services/deck.service';

@Component({
  selector: 'app-import-deck',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h4 class="mb-0">Import Deck from CSV</h4>
              <a [href]="templateUrl" class="btn btn-sm btn-outline-secondary" download>
                <i class="bi bi-download me-1"></i>Download Template
              </a>
            </div>
            <div class="card-body">
              @if (!result()) {
                <form [formGroup]="form" (ngSubmit)="onSubmit()">
                  <div class="mb-3">
                    <label for="deckName" class="form-label">Deck Name</label>
                    <input
                      type="text"
                      class="form-control"
                      id="deckName"
                      formControlName="deckName"
                      placeholder="Enter deck name"
                    />
                    @if (form.get('deckName')?.invalid && form.get('deckName')?.touched) {
                      <div class="text-danger small mt-1">Deck name is required</div>
                    }
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Alignment</label>
                    <div class="d-flex gap-3 flex-wrap">
                      <div class="form-check">
                        <input
                          class="form-check-input"
                          type="radio"
                          id="alignLight"
                          formControlName="alignment"
                          [value]="Alignment.Light"
                        />
                        <label class="form-check-label" for="alignLight">
                          <span class="badge bg-primary">Light Side</span>
                        </label>
                      </div>
                      <div class="form-check">
                        <input
                          class="form-check-input"
                          type="radio"
                          id="alignDark"
                          formControlName="alignment"
                          [value]="Alignment.Dark"
                        />
                        <label class="form-check-label" for="alignDark">
                          <span class="badge bg-dark">Dark Side</span>
                        </label>
                      </div>
                      <div class="form-check">
                        <input
                          class="form-check-input"
                          type="radio"
                          id="alignNeutral"
                          formControlName="alignment"
                          [value]="Alignment.Neutral"
                        />
                        <label class="form-check-label" for="alignNeutral">
                          <span class="badge bg-secondary">Neutral</span>
                        </label>
                      </div>
                    </div>
                    <div class="form-text">
                      Light decks accept Light + Neutral cards. Dark decks accept Dark + Neutral.
                      Neutral decks accept only Neutral cards.
                    </div>
                  </div>

                  <div class="mb-3">
                    <label for="file" class="form-label">CSV File</label>
                    <input
                      type="file"
                      class="form-control"
                      id="file"
                      accept=".csv"
                      (change)="onFileSelected($event)"
                    />
                  </div>

                  @if (error()) {
                    <div class="alert alert-danger">{{ error() }}</div>
                  }

                  <div class="d-flex gap-2">
                    <button
                      type="submit"
                      class="btn btn-primary"
                      [disabled]="!selectedFile() || form.invalid || importing()"
                    >
                      @if (importing()) {
                        <span class="spinner-border spinner-border-sm me-2"></span>
                      }
                      Import Deck
                    </button>
                    <a routerLink="/decks" class="btn btn-outline-secondary">Cancel</a>
                  </div>
                </form>
              } @else {
                <div class="mb-4">
                  @if (result()!.success) {
                    <div class="alert alert-success">
                      <i class="bi bi-check-circle me-2"></i>{{ result()!.message }}
                    </div>
                  } @else {
                    <div class="alert alert-danger">
                      <i class="bi bi-x-circle me-2"></i>{{ result()!.message }}
                    </div>
                  }
                </div>

                @if (result()!.createdDeck) {
                  <div class="card mb-4">
                    <div class="card-header">
                      <h5 class="mb-0">{{ result()!.createdDeck!.name }}</h5>
                    </div>
                    <div class="card-body">
                      <p class="mb-1">
                        <strong>Cards:</strong> {{ result()!.createdDeck!.totalCards }}
                      </p>
                      <p class="mb-0">
                        <strong>Alignment:</strong>
                        {{ getAlignmentLabel(result()!.createdDeck!.alignment) }}
                      </p>
                    </div>
                  </div>
                }

                @if (result()!.validationResult && !result()!.validationResult!.isValid) {
                  <div class="card mb-4 border-warning">
                    <div class="card-header bg-warning">
                      <h6 class="mb-0">Validation Issues</h6>
                    </div>
                    <ul class="list-group list-group-flush">
                      @for (err of result()!.validationResult!.errors; track err) {
                        <li class="list-group-item">{{ err }}</li>
                      }
                    </ul>
                  </div>
                }

                @if (result()!.skippedCards.length > 0) {
                  <div class="card mb-4 border-warning">
                    <div class="card-header bg-warning">
                      <h6 class="mb-0">Skipped ({{ result()!.skippedCards.length }})</h6>
                    </div>
                    <ul class="list-group list-group-flush">
                      @for (skip of result()!.skippedCards; track skip.entry.cardName) {
                        <li class="list-group-item">
                          {{ skip.entry.quantity }}x {{ skip.entry.cardName }}
                          @if (skip.entry.version) {
                            ({{ skip.entry.version }})
                          }
                          <small class="text-muted d-block">{{ skip.skipReason }}</small>
                        </li>
                      }
                    </ul>
                  </div>
                }

                <div class="d-flex gap-2">
                  @if (result()!.createdDeck) {
                    <a
                      [routerLink]="['/decks', result()!.createdDeck!.id, 'edit']"
                      class="btn btn-primary"
                    >
                      Edit Deck
                    </a>
                  }
                  <button type="button" class="btn btn-outline-primary" (click)="importAnother()">
                    Import Another
                  </button>
                  <a routerLink="/decks" class="btn btn-outline-secondary">Back to Decks</a>
                </div>
              }
            </div>
          </div>

          <div class="card mt-4">
            <div class="card-header">
              <h5 class="mb-0">CSV Format</h5>
            </div>
            <div class="card-body">
              <p>Required format with header row:</p>
              <pre class="bg-light p-3 rounded mb-0"><code>Quantity,CardName,Version
3,Yoda,J
2,Mace Windu,C
4,Rebel Control Officers,</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  imports: [ReactiveFormsModule, RouterLink],
})
export class ImportDeckComponent {
  protected readonly Alignment = Alignment;

  private fb = inject(FormBuilder);
  private deckService = inject(DeckService);
  private router = inject(Router);

  importing = signal(false);
  error = signal<string | null>(null);
  selectedFile = signal<File | null>(null);
  result = signal<DeckImportResult | null>(null);
  templateUrl = this.deckService.getTemplateUrl();

  form = this.fb.group({
    deckName: ['', [Validators.required]],
    alignment: [Alignment.Light as Alignment, [Validators.required]],
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.error.set(null);
    }
  }

  onSubmit(): void {
    const file = this.selectedFile();
    if (!file || this.form.invalid) {
      return;
    }

    this.importing.set(true);
    this.error.set(null);

    const { deckName, alignment } = this.form.value;

    this.deckService.importDeck(file, deckName!, alignment!).subscribe({
      next: (importResult) => {
        this.result.set(importResult);
        this.importing.set(false);
      },
      error: (err) => {
        if (err.error && typeof err.error === 'object' && 'message' in err.error) {
          this.error.set(err.error.message);
        } else {
          this.error.set('Failed to import deck. Check the file format.');
        }
        this.importing.set(false);
      },
    });
  }

  importAnother(): void {
    this.result.set(null);
    this.selectedFile.set(null);
    this.error.set(null);
    this.form.reset({ deckName: '', alignment: Alignment.Light });
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
}
