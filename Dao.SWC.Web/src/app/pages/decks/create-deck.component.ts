import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Alignment } from '../../models/dtos/card.dto';
import { HasUnsavedChanges } from '../../guards/unsaved-changes.guard';
import { DeckService } from '../../services/deck.service';

@Component({
  selector: 'app-create-deck',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h4 class="mb-0">Create New Deck</h4>
            </div>
            <div class="card-body">
              <form [formGroup]="form" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <label for="name" class="form-label">Deck Name</label>
                  <input
                    type="text"
                    class="form-control"
                    id="name"
                    formControlName="name"
                    placeholder="Enter deck name"
                  />
                  @if (form.get('name')?.invalid && form.get('name')?.touched) {
                    <div class="text-danger small mt-1">Name is required</div>
                  }
                </div>

                <div class="mb-3">
                  <label class="form-label">Alignment</label>
                  <div class="d-flex gap-3">
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
                        <span class="badge bg-secondary">Pure Neutral</span>
                      </label>
                    </div>
                  </div>
                  @if (form.get('alignment')?.value === Alignment.Neutral) {
                    <div class="form-text text-info mt-2">
                      <i class="bi bi-info-circle"></i>
                      Pure Neutral decks can only contain neutral cards. When playing, you'll choose
                      Light or Dark side.
                    </div>
                  }
                </div>

                <div class="d-flex gap-2">
                  <button
                    type="submit"
                    class="btn btn-primary"
                    [disabled]="form.invalid || saving()"
                  >
                    @if (saving()) {
                      <span class="spinner-border spinner-border-sm me-2"></span>
                    }
                    Create Deck
                  </button>
                  <a routerLink="/decks" class="btn btn-outline-secondary">Cancel</a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  imports: [ReactiveFormsModule],
})
export class CreateDeckComponent implements HasUnsavedChanges {
  protected readonly Alignment = Alignment;

  private fb = inject(FormBuilder);
  private deckService = inject(DeckService);
  private router = inject(Router);

  saving = signal(false);
  private submitted = false;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]],
    alignment: [Alignment.Light, Validators.required],
  });

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.submitted;
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.submitted = true;

    const { name, alignment } = this.form.value;
    this.deckService.createDeck({ name: name!, alignment: alignment! }).subscribe({
      next: (deck) => {
        this.router.navigate(['/decks', deck.id, 'edit']);
      },
      error: () => {
        this.saving.set(false);
        this.submitted = false;
      },
    });
  }
}
