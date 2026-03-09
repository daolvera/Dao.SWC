import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

/**
 * Service to manage navigation state, particularly sidebar visibility
 */
@Injectable({
  providedIn: "root",
})
export class NavigationService {
  private sidebarOpenSubject = new BehaviorSubject<boolean>(false);
  private isMobileSubject = new BehaviorSubject<boolean>(this.checkMobile());

  /**
   * Observable to track sidebar open/closed state
   */
  public sidebarOpen$: Observable<boolean> =
    this.sidebarOpenSubject.asObservable();

  /**
   * Observable to track mobile viewport state
   */
  public isMobile$: Observable<boolean> = this.isMobileSubject.asObservable();

  constructor() {
    // Listen for window resize events
    if (typeof window !== "undefined") {
      window.addEventListener("resize", () => {
        this.isMobileSubject.next(this.checkMobile());

        // Auto-close sidebar on desktop
        if (!this.checkMobile()) {
          this.closeSidebar();
        }
      });
    }
  }

  /**
   * Toggle sidebar visibility
   */
  toggleSidebar(): void {
    this.sidebarOpenSubject.next(!this.sidebarOpenSubject.value);
  }

  /**
   * Open the sidebar
   */
  openSidebar(): void {
    this.sidebarOpenSubject.next(true);
  }

  /**
   * Close the sidebar
   */
  closeSidebar(): void {
    this.sidebarOpenSubject.next(false);
  }

  /**
   * Get current sidebar state
   */
  get isSidebarOpen(): boolean {
    return this.sidebarOpenSubject.value;
  }

  /**
   * Check if current viewport is mobile
   */
  private checkMobile(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    return window.innerWidth < 992; // Bootstrap's lg breakpoint
  }

  /**
   * Get current mobile state
   */
  get isMobile(): boolean {
    return this.isMobileSubject.value;
  }
}
