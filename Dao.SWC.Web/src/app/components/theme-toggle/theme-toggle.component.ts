import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ThemeService } from "../../services/theme.service";

/**
 * Theme toggle component for switching between light/dark modes
 * Displays a button with icon that changes based on current theme
 */
@Component({
  selector: "app-theme-toggle",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-toggle">
      <button
        class="btn btn-link"
        (click)="toggleTheme()"
        [attr.aria-label]="
          'Switch to ' + (isDark() ? 'light' : 'dark') + ' mode'
        "
        title="Toggle theme"
      >
        @if (isDark()) {
          <i class="bi bi-sun-fill"></i>
        } @else {
          <i class="bi bi-moon-stars-fill"></i>
        }
      </button>
    </div>
  `,
  styles: [
    `
      .theme-toggle {
        display: inline-block;

        .btn-link {
          color: var(--bs-body-color);
          text-decoration: none;
          font-size: 1.25rem;
          padding: 0.25rem 0.5rem;

          &:hover {
            color: var(--bs-primary);
          }

          i {
            transition: transform 0.3s ease;
          }

          &:hover i {
            transform: rotate(20deg);
          }
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  isDark = signal(false);

  constructor(private themeService: ThemeService) {
    // Subscribe to theme changes
    this.updateIsDark();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.updateIsDark();
  }

  private updateIsDark(): void {
    this.isDark.set(this.themeService.isDarkMode());
  }
}
