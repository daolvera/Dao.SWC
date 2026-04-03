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

  private expandedItems = new Set<string>();

  /** Filtered navigation items based on authentication and role state */
  navigationItems = computed(() => {
    const isAuthenticated = this.authService.isAuthenticated();
    return this.navigationService.navigationItems.filter((item) => {
      if (item.requiresAuth && !isAuthenticated) return false;
      if (item.requiresRole && !this.authService.hasRole(item.requiresRole)) return false;
      return true;
    });
  });

  toggleExpanded(label: string): void {
    if (this.expandedItems.has(label)) {
      this.expandedItems.delete(label);
    } else {
      this.expandedItems.add(label);
    }
  }

  isExpanded(label: string): boolean {
    return this.expandedItems.has(label);
  }

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
