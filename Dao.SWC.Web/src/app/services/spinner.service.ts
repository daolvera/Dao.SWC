import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

/**
 * Service to manage loading/spinner state across the application
 */
@Injectable({
  providedIn: "root",
})
export class SpinnerService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>("");

  /**
   * Observable to track loading state
   */
  public isLoading$: Observable<boolean> = this.loadingSubject.asObservable();

  /**
   * Observable to track loading message
   */
  public message$: Observable<string> = this.messageSubject.asObservable();

  /**
   * Show the spinner
   * @param message Optional loading message
   */
  show(message: string = "Loading..."): void {
    this.messageSubject.next(message);
    this.loadingSubject.next(true);
  }

  /**
   * Hide the spinner
   */
  hide(): void {
    this.loadingSubject.next(false);
    this.messageSubject.next("");
  }

  /**
   * Toggle the spinner state
   */
  toggle(): void {
    this.loadingSubject.next(!this.loadingSubject.value);
  }

  /**
   * Get current loading state
   */
  get isLoading(): boolean {
    return this.loadingSubject.value;
  }
}
