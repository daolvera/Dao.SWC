import { effect, Injectable, signal } from "@angular/core";

export type Theme = "light" | "dark" | "auto";

/**
 * Service for managing application theme (light/dark mode)
 *
 * @example
 * ```typescript
 * constructor(private theme: ThemeService) {
 *   // Subscribe to theme changes
 *   this.theme.currentTheme$.subscribe(theme => console.log(theme));
 * }
 *
 * // Set theme
 * this.theme.setTheme('dark');
 *
 * // Toggle between light and dark
 * this.theme.toggleTheme();
 *
 * // Use auto (follows system preference)
 * this.theme.setTheme('auto');
 * ```
 */
@Injectable({
  providedIn: "root",
})
export class ThemeService {
  private readonly STORAGE_KEY = "app-theme";
  private readonly DARK_CLASS = "dark-theme";

  // Signal-based reactive theme
  public theme = signal<Theme>(this.getStoredTheme());

  // Media query for system preference
  private prefersDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  constructor() {
    // Apply initial theme
    this.applyTheme(this.theme());

    // Watch for system preference changes when in auto mode
    this.prefersDarkQuery.addEventListener("change", (e) => {
      if (this.theme() === "auto") {
        this.applyTheme("auto");
      }
    });

    // Effect to apply theme changes
    effect(() => {
      const currentTheme = this.theme();
      this.applyTheme(currentTheme);
      this.storeTheme(currentTheme);
    });
  }

  /**
   * Set the application theme
   * @param theme - Theme to apply ('light', 'dark', or 'auto')
   */
  public setTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  /**
   * Toggle between light and dark theme
   * (auto mode will become light after toggle)
   */
  public toggleTheme(): void {
    const current = this.theme();
    const isDark =
      current === "dark" ||
      (current === "auto" && this.prefersDarkQuery.matches);
    this.theme.set(isDark ? "light" : "dark");
  }

  /**
   * Check if dark mode is currently active
   */
  public isDarkMode(): boolean {
    const current = this.theme();
    return (
      current === "dark" ||
      (current === "auto" && this.prefersDarkQuery.matches)
    );
  }

  /**
   * Get the effective theme (resolves 'auto' to 'light' or 'dark')
   */
  public getEffectiveTheme(): "light" | "dark" {
    const current = this.theme();
    if (current === "auto") {
      return this.prefersDarkQuery.matches ? "dark" : "light";
    }
    return current;
  }

  /**
   * Apply theme to document
   */
  private applyTheme(theme: Theme): void {
    const isDark =
      theme === "dark" || (theme === "auto" && this.prefersDarkQuery.matches);

    if (isDark) {
      document.documentElement.classList.add(this.DARK_CLASS);
      document.documentElement.setAttribute("data-bs-theme", "dark");
    } else {
      document.documentElement.classList.remove(this.DARK_CLASS);
      document.documentElement.setAttribute("data-bs-theme", "light");
    }
  }

  /**
   * Get theme from localStorage
   */
  private getStoredTheme(): Theme {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "auto") {
        return stored;
      }
    } catch (e) {
      console.warn("Failed to read theme from localStorage", e);
    }
    return "auto"; // Default to system preference
  }

  /**
   * Store theme in localStorage
   */
  private storeTheme(theme: Theme): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (e) {
      console.warn("Failed to save theme to localStorage", e);
    }
  }
}
