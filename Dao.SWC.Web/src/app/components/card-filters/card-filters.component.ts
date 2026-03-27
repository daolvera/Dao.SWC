import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  FormsModule,
  Validators,
} from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { Alignment, Arena, CardType } from '../../models/dtos/card.dto';
import { CardFilter } from '../../models/filters/card-filter';

@Component({
  selector: 'app-card-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <form [formGroup]="filter" class="card p-3 mb-3">
      <div class="row g-2">
        <div class="col-12">
          <div class="input-group">
            <input
              type="text"
              class="form-control"
              placeholder="Search cards..."
              formControlName="search"
            />
            <div class="input-group-text">
              <input
                type="checkbox"
                class="form-check-input mt-0 me-2"
                formControlName="searchByName"
                id="searchByName"
              />
              <label class="form-check-label small" for="searchByName">By Name</label>
            </div>
          </div>
        </div>
        <div class="col-12">
          <select class="form-select" formControlName="type">
            <option [ngValue]="null">All Types</option>
            <option [ngValue]="CardType.Unit">Unit</option>
            <option [ngValue]="CardType.Location">Location</option>
            <option [ngValue]="CardType.Equipment">Equipment</option>
            <option [ngValue]="CardType.Mission">Mission</option>
            <option [ngValue]="CardType.Battle">Battle</option>
          </select>
        </div>
        @if (showArenaFilter()) {
          <div class="col-12">
            <select class="form-select" formControlName="arena">
              <option [ngValue]="null">All Arenas</option>
              <option [ngValue]="Arena.Space">Space</option>
              <option [ngValue]="Arena.Ground">Ground</option>
              <option [ngValue]="Arena.Character">Character</option>
            </select>
          </div>
        }
        @if (showAlignmentFilter) {
          <div class="col-12">
            <select class="form-select" formControlName="alignment">
              <option [ngValue]="null">All Alignments</option>
              <option [ngValue]="Alignment.Light">Light Side</option>
              <option [ngValue]="Alignment.Dark">Dark Side</option>
              <option [ngValue]="Alignment.Neutral">Neutral</option>
            </select>
          </div>
        }
      </div>
    </form>
  `,
})
export class CardFiltersComponent implements OnInit, OnDestroy {
  protected readonly CardType = CardType;
  protected readonly Arena = Arena;
  protected readonly Alignment = Alignment;

  @Input() showAlignmentFilter = true;
  @Input() fixedAlignment: Alignment | undefined;
  @Output() filterChange = new EventEmitter<CardFilter>();

  public filter!: FormGroup<{
    search: FormControl<string>;
    searchByName: FormControl<boolean>;
    type: FormControl<CardType | null>;
    arena: FormControl<Arena | null>;
    alignment: FormControl<Alignment | null>;
  }>;

  private formBuilder = inject(FormBuilder);

  /** Arena filter is only shown for types that can have arenas (Unit, Location) or when no type is selected */
  showArenaFilter = signal(true);

  private destroy$ = new Subject<void>();

  /** Card types that can have arenas */
  private readonly typesWithArenas: (CardType | null)[] = [null, CardType.Unit, CardType.Location];

  ngOnInit(): void {
    this.filter = this.formBuilder.group({
      search: this.formBuilder.nonNullable.control<string>(''),
      searchByName: this.formBuilder.nonNullable.control<boolean>(true),
      type: this.formBuilder.control<CardType | null>(null),
      arena: this.formBuilder.control<Arena | null>(null),
      alignment: this.formBuilder.control<Alignment | null>(null),
    });
    // Set up search debounce
    this.filter.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        const type = this.filter.get('type')?.value;
        const canHaveArena = this.typesWithArenas.includes(type ?? null);
        this.showArenaFilter.set(canHaveArena);

        // Reset arena filter to "All Arenas" when hiding
        if (!canHaveArena && this.filter.get('arena')?.value !== null) {
          this.filter.get('arena')?.setValue(null, { emitEvent: false });
        }
        this.emitFilter();
      });

    this.emitFilter();
  }

  getCurrentFilter(): CardFilter {
    return {
      search: this.filter.value.search || undefined,
      searchByName: this.filter.value.searchByName || undefined,
      type: this.filter.value.type ?? undefined,
      arena: this.filter.value.arena ?? undefined,
      alignment: this.showAlignmentFilter
        ? (this.filter.value.alignment ?? undefined)
        : this.fixedAlignment,
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private emitFilter(): void {
    this.filterChange.emit(this.getCurrentFilter());
  }
}
