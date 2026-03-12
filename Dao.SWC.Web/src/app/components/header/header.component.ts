import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { INavigationItem } from '../../models';
import { NavigationService } from '../../services/navigation.service';
import { AuthService } from '../../services/auth.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ThemeToggleComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  public authService = inject(AuthService);
  public navigationService = inject(NavigationService);

  toggleSidebar(): void {
    this.navigationService.toggleSidebar();
  }

  login(): void {
    this.authService.login();
  }

  logout(): void {
    this.authService.logout();
  }

  shouldShowNavItem(item: INavigationItem): boolean {
    if (item.requiresAuth && !this.authService.isAuthenticated()) return false;
    if (item.requiresRole && !this.authService.hasRole(item.requiresRole)) return false;
    return true;
  }
}
