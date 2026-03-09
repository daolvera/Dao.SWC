import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { INotification } from "../models";

/**
 * Service to manage toast notifications
 */
@Injectable({
  providedIn: "root",
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<INotification[]>([]);

  /**
   * Observable of current notifications
   */
  public notifications$: Observable<INotification[]> =
    this.notificationsSubject.asObservable();

  /**
   * Show a success notification
   * @param message The message to display
   * @param duration Duration in milliseconds (0 for persistent)
   */
  success(message: string, duration: number = 5000): void {
    this.show({ message, type: "success", duration, dismissible: true });
  }

  /**
   * Show an error notification
   * @param message The message to display
   * @param duration Duration in milliseconds (0 for persistent)
   */
  error(message: string, duration: number = 0): void {
    this.show({ message, type: "error", duration, dismissible: true });
  }

  /**
   * Show a warning notification
   * @param message The message to display
   * @param duration Duration in milliseconds (0 for persistent)
   */
  warning(message: string, duration: number = 7000): void {
    this.show({ message, type: "warning", duration, dismissible: true });
  }

  /**
   * Show an info notification
   * @param message The message to display
   * @param duration Duration in milliseconds (0 for persistent)
   */
  info(message: string, duration: number = 5000): void {
    this.show({ message, type: "info", duration, dismissible: true });
  }

  /**
   * Show a notification
   * @param notification The notification to display
   */
  show(notification: INotification): void {
    const notifications = this.notificationsSubject.value;
    notifications.push(notification);
    this.notificationsSubject.next(notifications);

    // Auto-dismiss after duration if specified
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.dismiss(notification);
      }, notification.duration);
    }
  }

  /**
   * Dismiss a specific notification
   * @param notification The notification to dismiss
   */
  dismiss(notification: INotification): void {
    const notifications = this.notificationsSubject.value.filter(
      (n) => n !== notification,
    );
    this.notificationsSubject.next(notifications);
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this.notificationsSubject.next([]);
  }
}
