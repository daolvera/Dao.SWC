import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  public navigationService = inject(NavigationService);
  public authService = inject(AuthService);

  /** Filtered navigation items based on authentication state */
  navigationItems = computed(() => {
    const isAuthenticated = this.authService.isAuthenticated();
    return this.navigationService.navigationItems.filter(
      (item) => !item.requiresAuth || isAuthenticated,
    );
  });

  closeSidebar(): void {
    this.navigationService.closeSidebar();
  }

  login(): void {
    this.authService.login();
    this.closeSidebar();
  }

  logout(): void {
    this.authService.logout();
    this.closeSidebar();
  }
}
