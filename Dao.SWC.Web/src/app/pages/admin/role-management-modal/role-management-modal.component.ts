import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AdminService, UserRoleDto } from '../../../services/admin.service';

@Component({
  selector: 'app-role-management-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <ng-template #modalContent let-modal>
      <div class="modal-header">
        <h5 class="modal-title">Manage User Roles</h5>
        <button type="button" class="btn-close" (click)="modal.dismiss()"></button>
      </div>
      <div class="modal-body">
        <!-- Assign Role Form -->
        <div class="card mb-3">
          <div class="card-header">
            <strong>Assign CardEditor Role</strong>
          </div>
          <div class="card-body">
            <div class="row g-2 align-items-end">
              <div class="col">
                <label class="form-label">User Email</label>
                <input
                  type="email"
                  class="form-control"
                  [(ngModel)]="newEmail"
                  placeholder="user@example.com"
                />
              </div>
              <div class="col-auto">
                <button
                  class="btn btn-primary"
                  [disabled]="!newEmail || assigning()"
                  (click)="assignRole()"
                >
                  @if (assigning()) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Add
                </button>
              </div>
            </div>
            @if (message()) {
              <div
                class="alert mt-2 mb-0"
                [class.alert-success]="messageType() === 'success'"
                [class.alert-danger]="messageType() === 'error'"
              >
                {{ message() }}
              </div>
            }
          </div>
        </div>

        <!-- Users List -->
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <strong>Users with CardEditor Role</strong>
            <button class="btn btn-sm btn-outline-secondary" (click)="loadUsers()">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>
          <div class="card-body p-0">
            @if (loading()) {
              <div class="text-center py-3">
                <span class="spinner-border spinner-border-sm"></span> Loading...
              </div>
            } @else if (cardEditorUsers().length === 0) {
              <p class="text-muted text-center py-3 mb-0">No users with CardEditor role</p>
            } @else {
              <ul class="list-group list-group-flush">
                @for (user of cardEditorUsers(); track user.id) {
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{{ user.name }}</strong>
                      <br />
                      <small class="text-muted">{{ user.email }}</small>
                    </div>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      (click)="removeRole(user.email)"
                      [disabled]="removing() === user.email"
                    >
                      @if (removing() === user.email) {
                        <span class="spinner-border spinner-border-sm"></span>
                      } @else {
                        Remove
                      }
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" (click)="modal.close()">Close</button>
      </div>
    </ng-template>
  `,
})
export class RoleManagementModalComponent {
  @ViewChild('modalContent') modalContent!: TemplateRef<unknown>;

  private modalService = inject(NgbModal);
  private adminService = inject(AdminService);
  private modalRef: NgbModalRef | null = null;

  users = signal<UserRoleDto[]>([]);
  loading = signal(false);
  assigning = signal(false);
  removing = signal<string | null>(null);
  message = signal<string | null>(null);
  messageType = signal<'success' | 'error'>('success');

  newEmail = '';

  cardEditorUsers = signal<UserRoleDto[]>([]);

  open(): void {
    this.modalRef = this.modalService.open(this.modalContent, {
      size: 'lg',
      centered: true,
    });
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.adminService.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.cardEditorUsers.set(users.filter((u) => u.roles.includes('CardEditor')));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  assignRole(): void {
    if (!this.newEmail) return;

    this.assigning.set(true);
    this.message.set(null);

    this.adminService.assignRole(this.newEmail, 'CardEditor').subscribe({
      next: (response) => {
        this.message.set(response.message);
        this.messageType.set('success');
        this.newEmail = '';
        this.assigning.set(false);
        this.loadUsers();
      },
      error: (err) => {
        this.message.set(err.error?.title || err.error?.message || 'Failed to assign role');
        this.messageType.set('error');
        this.assigning.set(false);
      },
    });
  }

  removeRole(email: string): void {
    this.removing.set(email);

    this.adminService.removeRole(email, 'CardEditor').subscribe({
      next: () => {
        this.removing.set(null);
        this.loadUsers();
      },
      error: () => {
        this.removing.set(null);
      },
    });
  }
}
