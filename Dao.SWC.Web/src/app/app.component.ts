import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LayoutComponent } from './components/layout/layout.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LayoutComponent],
  template: `
    <app-layout>
      <router-outlet />
    </app-layout>
  `,
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private authService = inject(AuthService);

  constructor() {
    if (this.authService.isAuthenticated()) {
      this.authService.loadUserInfo();
    }
  }
}
