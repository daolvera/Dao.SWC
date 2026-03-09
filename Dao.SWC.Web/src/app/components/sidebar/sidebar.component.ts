import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { INavigationItem } from "../../models";
import { NavigationService } from "../../services/navigation.service";

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: "./sidebar.component.html",
  styleUrls: ["./sidebar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  navigationItems: INavigationItem[] = [
    { label: "Home", route: "/", icon: "house" },
    { label: "About", route: "/about", icon: "info-circle" },
    { label: "Utils Demo", route: "/utils-demo", icon: "tools" },
  ];

  constructor(public navigationService: NavigationService) {}

  closeSidebar(): void {
    this.navigationService.closeSidebar();
  }
}
