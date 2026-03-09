import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: "app-sample-modal",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./sample-modal.component.html",
  styleUrls: ["./sample-modal.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SampleModalComponent {
  title: string = "Sample Modal";

  constructor(public activeModal: NgbActiveModal) {}

  confirm(): void {
    this.activeModal.close("Confirmed");
  }

  cancel(): void {
    this.activeModal.dismiss("Cancelled");
  }
}
