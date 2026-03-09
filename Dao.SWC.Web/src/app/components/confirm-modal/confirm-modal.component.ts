import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

/**
 * Confirmation modal component
 * Used for yes/no, delete confirmations, etc.
 */
@Component({
  selector: "app-confirm-modal",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">{{ title }}</h5>
      <button
        type="button"
        class="btn-close"
        (click)="activeModal.dismiss()"
      ></button>
    </div>
    <div class="modal-body">
      <p>{{ message }}</p>
      @if (details) {
        <p class="text-muted small">{{ details }}</p>
      }
    </div>
    <div class="modal-footer">
      <button
        type="button"
        class="btn btn-secondary"
        (click)="activeModal.dismiss()"
      >
        {{ cancelText }}
      </button>
      <button
        type="button"
        [class]="'btn ' + confirmButtonClass"
        (click)="activeModal.close(true)"
      >
        {{ confirmText }}
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmModalComponent {
  @Input() title = "Confirm Action";
  @Input() message = "Are you sure you want to proceed?";
  @Input() details?: string;
  @Input() confirmText = "Confirm";
  @Input() cancelText = "Cancel";
  @Input() confirmButtonClass = "btn-primary";

  constructor(public activeModal: NgbActiveModal) {}
}
