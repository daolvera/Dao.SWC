import { Injectable, Type } from "@angular/core";
import {
  NgbModal,
  NgbModalOptions,
  NgbModalRef,
} from "@ng-bootstrap/ng-bootstrap";
import { Observable, from } from "rxjs";
import { IModalConfig } from "../models";

/**
 * Service to manage modals using ng-bootstrap
 */
@Injectable({
  providedIn: "root",
})
export class ModalService {
  constructor(private ngbModal: NgbModal) {}

  /**
   * Open a modal with the specified component
   * @param component The component to display in the modal
   * @param config Modal configuration options
   * @returns NgbModalRef reference to the opened modal
   */
  open<T>(component: Type<T>, config?: IModalConfig): NgbModalRef {
    const options: NgbModalOptions = {
      size: config?.size,
      backdrop: config?.backdrop ?? true,
      keyboard: config?.keyboard ?? true,
      centered: config?.centered ?? false,
    };

    const modalRef = this.ngbModal.open(component, options);

    // If title is provided, set it on the component instance if it has a title property
    if (config?.title && "title" in modalRef.componentInstance) {
      (modalRef.componentInstance as any).title = config.title;
    }

    return modalRef;
  }

  /**
   * Open a modal and return the result as an Observable
   * @param component The component to display in the modal
   * @param config Modal configuration options
   * @returns Observable that emits when the modal is closed or dismissed
   */
  openAsObservable<T>(
    component: Type<T>,
    config?: IModalConfig,
  ): Observable<any> {
    const modalRef = this.open(component, config);
    return from(modalRef.result);
  }

  /**
   * Close all open modals
   */
  closeAll(): void {
    this.ngbModal.dismissAll();
  }

  /**
   * Check if any modal is currently open
   */
  hasOpenModals(): boolean {
    return this.ngbModal.hasOpenModals();
  }
}
