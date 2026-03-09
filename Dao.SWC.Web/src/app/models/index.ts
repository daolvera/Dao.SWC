/**
 * Modal configuration interface
 */
export interface IModalConfig {
  title?: string;
  size?: "sm" | "lg" | "xl";
  backdrop?: boolean | "static";
  keyboard?: boolean;
  centered?: boolean;
}

/**
 * Notification interface
 */
export interface INotification {
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
  dismissible?: boolean;
}

/**
 * Navigation item interface
 */
export interface INavigationItem {
  label: string;
  route: string;
  icon?: string;
  children?: INavigationItem[];
}

/**
 * Loading state interface
 */
export interface ILoadingState {
  isLoading: boolean;
  message?: string;
}
