import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  navigateTo(path: string): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate([path]);
    } else {
      this.authService.login();
    }
  }
}
