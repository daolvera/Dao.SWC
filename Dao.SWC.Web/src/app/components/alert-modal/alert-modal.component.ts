import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

export type AlertType = "success" | "error" | "warning" | "info";

/**
 * Alert modal component
 * Simple informational modal with single OK button
 */
@Component({
  selector: "app-alert-modal",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-header" [class]="'bg-' + alertClass">
      <h5
        class="modal-title"
        [class.text-white]="alertClass === 'danger' || alertClass === 'primary'"
      >
        <i [class]="'bi ' + iconClass + ' me-2'"></i>
        {{ title }}
      </h5>
      <button
        type="button"
        class="btn-close"
        [class.btn-close-white]="
          alertClass === 'danger' || alertClass === 'primary'
        "
        (click)="activeModal.dismiss()"
      ></button>
    </div>
    <div class="modal-body">
      <p>{{ message }}</p>
      @if (details) {
        <div class="alert" [class]="'alert-' + alertClass">
          {{ details }}
        </div>
      }
    </div>
    <div class="modal-footer">
      <button
        type="button"
        [class]="'btn btn-' + alertClass"
        (click)="activeModal.close()"
      >
        {{ buttonText }}
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertModalComponent {
  @Input() type: AlertType = "info";
  @Input() title = "Alert";
  @Input() message = "";
  @Input() details?: string;
  @Input() buttonText = "OK";

  constructor(public activeModal: NgbActiveModal) {}

  get alertClass(): string {
    const map: Record<AlertType, string> = {
      success: "success",
      error: "danger",
      warning: "warning",
      info: "info",
    };
    return map[this.type];
  }

  get iconClass(): string {
    const map: Record<AlertType, string> = {
      success: "bi-check-circle-fill",
      error: "bi-exclamation-triangle-fill",
      warning: "bi-exclamation-circle-fill",
      info: "bi-info-circle-fill",
    };
    return map[this.type];
  }
}
