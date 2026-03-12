import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Service to manage loading/spinner state across the application
 * Uses reference counting to handle concurrent requests
 */
@Injectable({
  providedIn: 'root',
})
export class SpinnerService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('');
  private requestCount = 0;

  /**
   * Observable to track loading state
   */
  public isLoading$: Observable<boolean> = this.loadingSubject.asObservable();

  /**
   * Observable to track loading message
   */
  public message$: Observable<string> = this.messageSubject.asObservable();

  /**
   * Show the spinner (increments request counter)
   * @param message Optional loading message
   */
  show(message: string = 'Loading...'): void {
    this.requestCount++;
    if (this.requestCount === 1) {
      this.messageSubject.next(message);
      this.loadingSubject.next(true);
    }
  }

  /**
   * Hide the spinner (decrements request counter, only hides when all requests complete)
   */
  hide(): void {
    this.requestCount = Math.max(0, this.requestCount - 1);
    if (this.requestCount === 0) {
      this.loadingSubject.next(false);
      this.messageSubject.next('');
    }
  }

  /**
   * Force hide the spinner (resets counter)
   */
  forceHide(): void {
    this.requestCount = 0;
    this.loadingSubject.next(false);
    this.messageSubject.next('');
  }

  /**
   * Get current loading state
   */
  get isLoading(): boolean {
    return this.loadingSubject.value;
  }
}
