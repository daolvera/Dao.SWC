import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { Alignment, Arena, CardType } from '../../models/dtos/card.dto';
import { CardFilter } from '../../models/filters/card-filter';

@Component({
  selector: 'app-card-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="row g-2">
      <div class="col-12">
        <input
          type="text"
          class="form-control"
          placeholder="Search cards..."
          [formControl]="searchControl"
        />
      </div>
      <div [class]="showAlignmentFilter ? 'col-4' : 'col-6'">
        <select class="form-select" [formControl]="typeFilter">
          <option [ngValue]="null">All Types</option>
          <option [ngValue]="CardType.Unit">Unit</option>
          <option [ngValue]="CardType.Location">Location</option>
          <option [ngValue]="CardType.Equipment">Equipment</option>
          <option [ngValue]="CardType.Mission">Mission</option>
          <option [ngValue]="CardType.Battle">Battle</option>
        </select>
      </div>
      <div [class]="showAlignmentFilter ? 'col-4' : 'col-6'">
        <select class="form-select" [formControl]="arenaFilter">
          <option [ngValue]="null">All Arenas</option>
          <option [ngValue]="Arena.Space">Space</option>
          <option [ngValue]="Arena.Ground">Ground</option>
          <option [ngValue]="Arena.Character">Character</option>
        </select>
      </div>
      @if (showAlignmentFilter) {
        <div class="col-4">
          <select class="form-select" [formControl]="alignmentFilter">
            <option [ngValue]="null">All Alignments</option>
            <option [ngValue]="Alignment.Light">Light Side</option>
            <option [ngValue]="Alignment.Dark">Dark Side</option>
            <option [ngValue]="Alignment.Neutral">Neutral</option>
          </select>
        </div>
      }
    </div>
  `,
})
export class CardFiltersComponent implements OnInit, OnDestroy {
  protected readonly CardType = CardType;
  protected readonly Arena = Arena;
  protected readonly Alignment = Alignment;

  @Input() showAlignmentFilter = true;
  @Input() fixedAlignment: Alignment | undefined;
  @Output() filterChange = new EventEmitter<CardFilter>();

  searchControl = new FormControl('');
  typeFilter = new FormControl<CardType | null>(null);
  arenaFilter = new FormControl<Arena | null>(null);
  alignmentFilter = new FormControl<Alignment | null>(null);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Set up search debounce
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.emitFilter());

    // Immediate emit on dropdown changes
    this.typeFilter.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.emitFilter());

    this.arenaFilter.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.emitFilter());

    this.alignmentFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.emitFilter());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getCurrentFilter(): CardFilter {
    return {
      search: this.searchControl.value || undefined,
      type: this.typeFilter.value ?? undefined,
      arena: this.arenaFilter.value ?? undefined,
      alignment: this.showAlignmentFilter
        ? (this.alignmentFilter.value ?? undefined)
        : this.fixedAlignment,
    };
  }

  private emitFilter(): void {
    this.filterChange.emit(this.getCurrentFilter());
  }
}
