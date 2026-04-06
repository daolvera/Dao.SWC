import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService, UserStatsDto } from '../../../services/admin.service';

@Component({
  selector: 'app-user-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="container py-4">
      <div class="mb-3">
        <a routerLink="/" class="btn btn-link px-0">
          <i class="bi bi-arrow-left me-1"></i>Back to Home
        </a>
        <h2 class="mb-0">User Statistics</h2>
        <p class="text-muted">Overview of registered users and their deck counts</p>
      </div>

      @if (loading()) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>
              <i class="bi bi-people me-2"></i>
              {{ users().length }} Users
            </span>
            <span class="text-muted">
              Total Decks: {{ totalDecks() }}
            </span>
          </div>
          <div class="table-responsive">
            <table class="table table-striped table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th class="text-center">Decks</th>
                  <th>Account Created</th>
                </tr>
              </thead>
              <tbody>
                @for (user of users(); track user.id) {
                  <tr>
                    <td>{{ user.displayName }}</td>
                    <td>{{ user.email }}</td>
                    <td class="text-center">
                      <span class="badge bg-secondary">{{ user.deckCount }}</span>
                    </td>
                    <td>{{ user.createdAt | date: 'medium' }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="text-center text-muted py-4">
                      No users found
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
})
export class UserStatsComponent implements OnInit {
  private adminService = inject(AdminService);

  users = signal<UserStatsDto[]>([]);
  loading = signal(true);
  totalDecks = signal(0);

  ngOnInit(): void {
    this.loadStats();
  }

  private loadStats(): void {
    this.adminService.getUserStats().subscribe({
      next: (users) => {
        this.users.set(users);
        this.totalDecks.set(users.reduce((sum, u) => sum + u.deckCount, 0));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
