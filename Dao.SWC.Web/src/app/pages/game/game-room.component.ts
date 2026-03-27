import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TitleCasePipe } from '@angular/common';
import {
  CardInstanceDto,
  ChatMessage,
  DiceRolledEvent,
  GamePlayerDto,
  GameRoomDto,
  GameState,
  RoomType,
} from '../../models/dtos/game.dto';
import { Alignment } from '../../models/dtos/card.dto';
import { GameHubService } from '../../services/game-hub.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationsComponent } from '../../components/notifications/notifications.component';

type CardZone = 'deck' | 'hand' | 'space' | 'ground' | 'character' | 'discard' | 'build';

interface DraggedCard {
  card: CardInstanceDto;
  sourceZone: CardZone;
}

// CardType enum values
const CARD_TYPE_UNIT = 0;

@Component({
  selector: 'app-game-room',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./game-room.component.scss'],
  templateUrl: './game-room.component.html',
  imports: [ReactiveFormsModule, RouterLink, FormsModule, NotificationsComponent, TitleCasePipe],
})
export class GameRoomComponent implements OnInit, OnDestroy {
  protected readonly RoomType = RoomType;
  protected readonly GameState = GameState;
  protected readonly Alignment = Alignment;

  @ViewChild('gameContainer') gameContainer!: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private gameHub = inject(GameHubService);
  private notifications = inject(NotificationService);

  roomCode = '';
  room = signal<GameRoomDto | null>(null);
  selectedCard = signal<string | null>(null);
  lastDiceRoll = signal<DiceRolledEvent | null>(null);
  diceCount = new FormControl(1, [Validators.min(1), Validators.max(20)]);

  isFullscreen = signal(false);
  sidePanelCollapsed = signal(false);
  showDiscard = signal(false);
  showDeckBrowser = signal(false);
  deckBrowserCards = signal<CardInstanceDto[]>([]);
  dragOverZone = signal<CardZone | null>(null);
  handMinimized = signal(false);
  bottomControlsCollapsed = signal(false);
  zoomCard = signal<CardInstanceDto | null>(null);

  // Chat state
  chatMessages = signal<ChatMessage[]>([]);
  chatInput = new FormControl('');
  @ViewChild('chatMessagesContainer') chatMessagesContainer!: ElementRef<HTMLElement>;
  
  // Computed: check if zoomed card should be displayed sideways (non-unit cards)
  isZoomCardSideways = computed(() => {
    const card = this.zoomCard();
    return card !== null && card.cardType !== CARD_TYPE_UNIT;
  });

  // Card context menu state - store only the instanceId to always get fresh data
  cardMenuCardId = signal<string | null>(null);
  handCardMenuCardId = signal<string | null>(null);
  opponentCardMenuCard = signal<CardInstanceDto | null>(null);
  cardMenuX = signal(0);
  cardMenuY = signal(0);

  // Computed: get the current card from live room state
  cardMenuCard = computed(() => {
    const cardId = this.cardMenuCardId();
    if (!cardId) return null;
    const me = this.myPlayer();
    if (!me) return null;
    // Search all arenas and play areas
    for (const arena of Object.values(me.arenas)) {
      const card = arena.find((c) => c.instanceId === cardId);
      if (card) return card;
    }
    // Also search discard pile
    const discardCard = me.discardPile.find((c) => c.instanceId === cardId);
    if (discardCard) return discardCard;
    return null;
  });

  handCardMenuCard = computed(() => {
    const cardId = this.handCardMenuCardId();
    if (!cardId) return null;
    const me = this.myPlayer();
    if (!me) return null;
    return me.hand.find((c) => c.instanceId === cardId) ?? null;
  });

  // Stack context menu state
  stackMenuCardId = signal<string | null>(null);
  stackMenuX = signal(0);
  stackMenuY = signal(0);

  stackMenuCard = computed(() => {
    const cardId = this.stackMenuCardId();
    if (!cardId) return null;
    const me = this.myPlayer();
    if (!me) return null;
    for (const arena of Object.values(me.arenas)) {
      const card = arena.find((c) => c.instanceId === cardId);
      if (card) return card;
    }
    return null;
  });

  // Stackable cards for hand card
  stackableTargets = signal<CardInstanceDto[]>([]);

  private draggedCard: DraggedCard | null = null;
  private subscriptions: Subscription[] = [];

  // Computed values
  isHost = computed(() => {
    const r = this.room();
    if (!r) return false;
    const me = r.players.find((p) => p.username === this.gameHub.currentUser);
    return me?.isHost ?? false;
  });

  myPlayer = computed(() => {
    const r = this.room();
    if (!r) return null;
    return r.players.find((p) => p.username === this.gameHub.currentUser) ?? null;
  });

  opponents = computed(() => {
    const r = this.room();
    if (!r) return [];
    return r.players.filter((p) => p.username !== this.gameHub.currentUser);
  });

  maxPlayers = computed(() => {
    const r = this.room();
    if (!r) return 2;
    switch (r.roomType) {
      case RoomType.OneVOne:
        return 2;
      case RoomType.OneVTwo:
        return 3;
      case RoomType.TwoVTwo:
        return 4;
      default:
        return 4;
    }
  });

  emptySlots = computed(() => {
    const max = this.maxPlayers();
    const current = this.room()?.players.length ?? 0;
    return Array(Math.max(0, max - current))
      .fill(0)
      .map((_, i) => i);
  });

  canStart = computed(() => {
    const r = this.room();
    if (!r) return false;
    return r.players.length >= 2;
  });

  roomTypeBadgeClass = computed(() => {
    const r = this.room();
    if (!r) return 'bg-secondary';
    switch (r.roomType) {
      case RoomType.OneVOne:
        return 'bg-info';
      case RoomType.OneVTwo:
        return 'bg-warning text-dark';
      case RoomType.TwoVTwo:
        return 'bg-primary';
      default:
        return 'bg-secondary';
    }
  });

  roomTypeLabel = computed(() => {
    const r = this.room();
    if (!r) return '';
    switch (r.roomType) {
      case RoomType.OneVOne:
        return '1v1';
      case RoomType.OneVTwo:
        return '1v2';
      case RoomType.TwoVTwo:
        return '2v2';
      default:
        return '';
    }
  });

  stateBadgeClass = computed(() => {
    switch (this.room()?.state) {
      case GameState.Waiting:
        return 'bg-warning text-dark';
      case GameState.InProgress:
        return 'bg-success';
      case GameState.Finished:
        return 'bg-secondary';
      default:
        return 'bg-secondary';
    }
  });

  stateLabel = computed(() => {
    switch (this.room()?.state) {
      case GameState.Waiting:
        return 'Waiting';
      case GameState.InProgress:
        return 'In Progress';
      case GameState.Finished:
        return 'Finished';
      default:
        return 'Unknown';
    }
  });

  myHand = computed(() => {
    const me = this.myPlayer();
    return me?.hand ?? [];
  });

  myDeckSize = computed(() => {
    const me = this.myPlayer();
    return me?.deckSize ?? 0;
  });

  myDiscard = computed(() => {
    const me = this.myPlayer();
    return me?.discardPile ?? [];
  });

  myBuildZone = computed(() => {
    const me = this.myPlayer();
    return me?.buildZone ?? [];
  });

  showBuildZone = signal(false);
  showOpponentBuildZone = signal<GamePlayerDto | null>(null);

  // Build zone card context menu
  buildCardMenuCardId = signal<string | null>(null);
  buildCardMenuX = signal(0);
  buildCardMenuY = signal(0);

  buildCardMenuCard = computed(() => {
    const cardId = this.buildCardMenuCardId();
    if (!cardId) return null;
    const me = this.myPlayer();
    if (!me) return null;
    return me.buildZone.find((c) => c.instanceId === cardId) ?? null;
  });

  // Discard pile card context menu
  discardCardMenuCardId = signal<string | null>(null);
  discardCardMenuX = signal(0);
  discardCardMenuY = signal(0);

  discardCardMenuCard = computed(() => {
    const cardId = this.discardCardMenuCardId();
    if (!cardId) return null;
    const me = this.myPlayer();
    if (!me) return null;
    return me.discardPile.find((c) => c.instanceId === cardId) ?? null;
  });

  diceTotal = computed(() => {
    const roll = this.lastDiceRoll();
    if (!roll) return 0;
    return roll.results.reduce((sum, n) => sum + n, 0);
  });

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('roomCode')?.toUpperCase() ?? '';
    if (!this.roomCode) {
      this.router.navigate(['/play']);
      return;
    }

    this.subscriptions.push(
      this.gameHub.roomUpdated$.subscribe((room) => {
        if (room.roomCode === this.roomCode) {
          this.room.set(room);
        }
      }),
      this.gameHub.diceRolled$.subscribe((event) => {
        this.lastDiceRoll.set(event);
      }),
      this.gameHub.kicked$.subscribe(() => {
        this.router.navigate(['/play']);
      }),
      this.gameHub.error$.subscribe((error) => {
        console.error('Game error:', error);
      }),
      this.gameHub.chatMessage$.subscribe((message) => {
        this.chatMessages.update((messages) => [...messages, message]);
        // Auto-scroll to bottom
        setTimeout(() => {
          if (this.chatMessagesContainer) {
            this.chatMessagesContainer.nativeElement.scrollTop =
              this.chatMessagesContainer.nativeElement.scrollHeight;
          }
        }, 0);
      }),
    );

    this.reconnect();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  private async reconnect(): Promise<void> {
    try {
      await this.gameHub.connect();
      await this.gameHub.reconnect(this.roomCode);
    } catch {
      this.router.navigate(['/play']);
    }
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.gameContainer.nativeElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // Get units (cardType === 0) from a player's arena (only top-level cards, not stacked under)
  getPlayerArenaUnits(player: GamePlayerDto, arena: string): CardInstanceDto[] {
    const arenaCards = player.arenas[arena] ?? [];
    return arenaCards.filter((c) => c.cardType === CARD_TYPE_UNIT && !c.stackParentId);
  }

  // Get non-units from a player's arena
  getPlayerArenaOthers(player: GamePlayerDto, arena: string): CardInstanceDto[] {
    const arenaCards = player.arenas[arena] ?? [];
    return arenaCards.filter((c) => c.cardType !== CARD_TYPE_UNIT);
  }

  // Get stacked cards under a given card
  getStackedCards(player: GamePlayerDto, card: CardInstanceDto): CardInstanceDto[] {
    if (!card.stackedUnderIds || card.stackedUnderIds.length === 0) return [];
    const allArenaCards = Object.values(player.arenas).flat();
    return card.stackedUnderIds
      .map((id) => allArenaCards.find((c) => c.instanceId === id))
      .filter((c): c is CardInstanceDto => c !== undefined);
  }

  // Get my stacked cards
  getMyStackedCards(card: CardInstanceDto): CardInstanceDto[] {
    const me = this.myPlayer();
    if (!me) return [];
    return this.getStackedCards(me, card);
  }

  // Get my units for an arena
  myArenaUnits(arena: string): CardInstanceDto[] {
    const me = this.myPlayer();
    if (!me) return [];
    return this.getPlayerArenaUnits(me, arena);
  }

  // Get my non-units for an arena
  myArenaOthers(arena: string): CardInstanceDto[] {
    const me = this.myPlayer();
    if (!me) return [];
    return this.getPlayerArenaOthers(me, arena);
  }

  // Get active (non-retreated) cards from my arena - now based on arena-level retreat
  myArenaActiveUnits(arena: string): CardInstanceDto[] {
    const me = this.myPlayer();
    if (!me) return [];
    if (this.isArenaRetreated(me, arena)) return [];
    return this.myArenaUnits(arena);
  }

  myArenaActiveOthers(arena: string): CardInstanceDto[] {
    const me = this.myPlayer();
    if (!me) return [];
    if (this.isArenaRetreated(me, arena)) return [];
    return this.myArenaOthers(arena);
  }

  // Check if an arena is retreated
  isArenaRetreated(player: GamePlayerDto, arena: string): boolean {
    switch (arena) {
      case 'space':
        return player.spaceArenaRetreated;
      case 'ground':
        return player.groundArenaRetreated;
      case 'character':
        return player.characterArenaRetreated;
      default:
        return false;
    }
  }

  // Get all cards from a retreated arena
  myArenaRetreatedCards(arena: string): CardInstanceDto[] {
    const me = this.myPlayer();
    if (!me) return [];
    if (!this.isArenaRetreated(me, arena)) return [];
    const arenaCards = me.arenas[arena] ?? [];
    return arenaCards;
  }

  // Get retreated cards from opponent's arena
  getPlayerArenaRetreated(player: GamePlayerDto, arena: string): CardInstanceDto[] {
    if (!this.isArenaRetreated(player, arena)) return [];
    const arenaCards = player.arenas[arena] ?? [];
    return arenaCards;
  }

  // Get active cards from opponent's arena
  getPlayerArenaActiveUnits(player: GamePlayerDto, arena: string): CardInstanceDto[] {
    if (this.isArenaRetreated(player, arena)) return [];
    return this.getPlayerArenaUnits(player, arena);
  }

  getPlayerArenaActiveOthers(player: GamePlayerDto, arena: string): CardInstanceDto[] {
    if (this.isArenaRetreated(player, arena)) return [];
    return this.getPlayerArenaOthers(player, arena);
  }

  getPlayerCardCount(player: GamePlayerDto): number {
    return player.hand.length + player.deckSize;
  }

  selectCard(instanceId: string): void {
    if (this.selectedCard() === instanceId) {
      this.selectedCard.set(null);
    } else {
      this.selectedCard.set(instanceId);
    }
  }

  // Force counter methods
  async incrementForce(): Promise<void> {
    const me = this.myPlayer();
    if (me) {
      await this.gameHub.updateForce(me.force + 1);
    }
  }

  async decrementForce(): Promise<void> {
    const me = this.myPlayer();
    if (me && me.force > 0) {
      await this.gameHub.updateForce(me.force - 1);
    }
  }

  async onForceChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
      await this.gameHub.updateForce(value);
    }
  }

  // Build counter methods
  async incrementBuild(): Promise<void> {
    const me = this.myPlayer();
    if (me) {
      await this.gameHub.updateBuildCounter(me.buildCounter + 1);
    }
  }

  async decrementBuild(): Promise<void> {
    const me = this.myPlayer();
    if (me && me.buildCounter > 0) {
      await this.gameHub.updateBuildCounter(me.buildCounter - 1);
    }
  }

  async onBuildChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
      await this.gameHub.updateBuildCounter(value);
    }
  }

  // Build zone methods
  async moveToBuild(card: CardInstanceDto): Promise<void> {
    await this.gameHub.moveToBuild(card.instanceId);
  }

  async moveToBuildFromMenu(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      await this.gameHub.moveToBuild(card.instanceId);
      this.closeCardMenu();
    }
  }

  async moveToBuildFromHandMenu(): Promise<void> {
    const card = this.handCardMenuCard();
    if (card) {
      await this.gameHub.moveToBuild(card.instanceId);
      this.closeHandCardMenu();
    }
  }

  // Arena retreat methods
  async toggleArenaRetreat(arena: string): Promise<void> {
    await this.gameHub.toggleArenaRetreat(arena);
  }

  // Build card context menu methods
  openBuildCardMenu(event: MouseEvent, card: CardInstanceDto): void {
    event.preventDefault();
    event.stopPropagation();
    this.buildCardMenuCardId.set(card.instanceId);
    this.buildCardMenuX.set(event.clientX);
    this.buildCardMenuY.set(event.clientY);
  }

  closeBuildCardMenu(): void {
    this.buildCardMenuCardId.set(null);
  }

  async incrementBuildCardCounter(): Promise<void> {
    const card = this.buildCardMenuCard();
    if (card) {
      const currentValue = card.counter ?? 0;
      await this.gameHub.setCounter(card.instanceId, currentValue + 1);
    }
  }

  async decrementBuildCardCounter(): Promise<void> {
    const card = this.buildCardMenuCard();
    if (card) {
      const currentValue = card.counter ?? 0;
      if (currentValue > 0) {
        await this.gameHub.setCounter(card.instanceId, currentValue - 1);
      }
    }
  }

  async removeBuildCardCounter(): Promise<void> {
    const card = this.buildCardMenuCard();
    if (card) {
      await this.gameHub.removeCounter(card.instanceId);
      this.closeBuildCardMenu();
    }
  }

  async moveFromBuildTo(arena: string): Promise<void> {
    const card = this.buildCardMenuCard();
    if (card) {
      const result = await this.gameHub.moveFromBuild(card.instanceId, arena);
      if (!result.success && result.errorMessage) {
        this.notifications.error(result.errorMessage);
      }
      this.closeBuildCardMenu();
      this.showBuildZone.set(false);
    }
  }

  // Discard card menu methods
  openDiscardCardMenu(event: MouseEvent, card: CardInstanceDto): void {
    event.preventDefault();
    event.stopPropagation();
    this.discardCardMenuCardId.set(card.instanceId);
    this.discardCardMenuX.set(event.clientX);
    this.discardCardMenuY.set(event.clientY);
  }

  closeDiscardCardMenu(): void {
    this.discardCardMenuCardId.set(null);
  }

  async returnToHandFromDiscardMenu(): Promise<void> {
    const card = this.discardCardMenuCard();
    if (card) {
      await this.gameHub.returnToHand(card.instanceId);
      this.closeDiscardCardMenu();
    }
  }

  // Deck browser
  async openDeckBrowser(): Promise<void> {
    const cards = await this.gameHub.viewDeck();
    this.deckBrowserCards.set(cards);
    this.showDeckBrowser.set(true);
  }

  async takeCardFromDeck(cardInstanceId: string): Promise<void> {
    await this.gameHub.takeFromDeck(cardInstanceId);
    this.showDeckBrowser.set(false);
  }

  // Drag and drop
  onDragStart(event: DragEvent, card: CardInstanceDto, zone: CardZone): void {
    this.draggedCard = { card, sourceZone: zone };
    event.dataTransfer?.setData('text/plain', card.instanceId);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    const zone = this.getZoneFromEvent(event);
    this.dragOverZone.set(zone);
  }

  onDragEnd(): void {
    this.draggedCard = null;
    this.dragOverZone.set(null);
  }

  async onDrop(event: DragEvent, targetZone: CardZone): Promise<void> {
    event.preventDefault();
    this.dragOverZone.set(null);

    if (!this.draggedCard) return;

    const { card, sourceZone } = this.draggedCard;
    this.draggedCard = null;

    if (sourceZone === targetZone) return;

    await this.moveCard(card.instanceId, sourceZone, targetZone, card);
  }

  private getZoneFromEvent(event: DragEvent): CardZone | null {
    const target = event.target as HTMLElement;
    const zone = target.closest('[class*="-zone"], [class*="-arena"]');
    if (!zone) return null;

    if (zone.classList.contains('deck-zone')) return 'deck';
    if (zone.classList.contains('hand-zone')) return 'hand';
    if (zone.classList.contains('discard-zone')) return 'discard';
    if (zone.classList.contains('build-zone')) return 'build';
    if (zone.classList.contains('space-arena')) return 'space';
    if (zone.classList.contains('ground-arena')) return 'ground';
    if (zone.classList.contains('character-arena')) return 'character';

    return null;
  }

  async moveCard(
    cardId: string,
    from: CardZone,
    to: CardZone,
    card?: CardInstanceDto,
  ): Promise<void> {
    // Play to arena - server handles all validation (arena, stacking, version conflicts)
    if (to === 'space' || to === 'ground' || to === 'character') {
      // Use different methods depending on source zone
      if (from === 'build') {
        const result = await this.gameHub.moveFromBuild(cardId, to);
        if (!result.success && result.errorMessage) {
          this.notifications.error(result.errorMessage);
        }
      } else {
        const result = await this.gameHub.playCard(cardId, to);
        if (!result.success && result.errorMessage) {
          this.notifications.error(result.errorMessage);
        }
      }
    } else if (to === 'discard') {
      await this.gameHub.discardCard(cardId);
    } else if (to === 'hand') {
      await this.gameHub.returnToHand(cardId);
    } else if (to === 'build') {
      await this.gameHub.moveToBuild(cardId);
    }
  }

  async toggleTap(card: CardInstanceDto): Promise<void> {
    await this.gameHub.toggleTap(card.instanceId);
  }

  async startGame(): Promise<void> {
    await this.gameHub.startGame();
  }

  async drawCard(): Promise<void> {
    await this.gameHub.drawCards(1);
  }

  async rollDice(): Promise<void> {
    const count = this.diceCount.value ?? 1;
    await this.gameHub.rollDice(count);
  }

  async sendChatMessage(): Promise<void> {
    const message = this.chatInput.value?.trim();
    if (!message) return;
    await this.gameHub.sendChatMessage(message);
    this.chatInput.setValue('');
  }

  linkifyMessage(message: string): string {
    // Escape HTML first to prevent XSS
    const escaped = message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    // Convert URLs to clickable links
    const urlPattern = /(https?:\/\/[^\s<]+)/g;
    return escaped.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  async kickPlayer(username: string): Promise<void> {
    await this.gameHub.kickPlayer(username);
  }

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomCode);
  }

  // Card context menu methods
  openCardMenu(event: MouseEvent, card: CardInstanceDto): void {
    event.preventDefault();
    event.stopPropagation();
    this.cardMenuCardId.set(card.instanceId);
    this.setMenuPosition(event.clientX, event.clientY);
  }

  // Helper to position menus within viewport
  private setMenuPosition(x: number, y: number, menuHeight = 300): void {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const menuWidth = 200;

    // Adjust Y if menu would overflow bottom
    let adjustedY = y;
    if (y + menuHeight > viewportHeight) {
      adjustedY = Math.max(10, viewportHeight - menuHeight - 10);
    }

    // Adjust X if menu would overflow right
    let adjustedX = x;
    if (x + menuWidth > viewportWidth) {
      adjustedX = Math.max(10, viewportWidth - menuWidth - 10);
    }

    this.cardMenuX.set(adjustedX);
    this.cardMenuY.set(adjustedY);
  }

  closeCardMenu(): void {
    this.cardMenuCardId.set(null);
  }

  openOpponentCardMenu(event: MouseEvent, card: CardInstanceDto): void {
    event.preventDefault();
    event.stopPropagation();
    this.opponentCardMenuCard.set(card);
    this.setMenuPosition(event.clientX, event.clientY);
  }

  closeOpponentCardMenu(): void {
    this.opponentCardMenuCard.set(null);
  }

  zoomOpponentCard(): void {
    const card = this.opponentCardMenuCard();
    if (card) {
      this.zoomCard.set(card);
      this.closeOpponentCardMenu();
    }
  }

  openHandCardMenu(event: MouseEvent, card: CardInstanceDto): void {
    event.preventDefault();
    event.stopPropagation();
    this.handCardMenuCardId.set(card.instanceId);
    this.setMenuPosition(event.clientX, event.clientY, 350); // Hand menu can be taller
    // Fetch stackable targets for versioned units
    this.checkStackableTargets(card);
  }

  closeHandCardMenu(): void {
    this.handCardMenuCardId.set(null);
    this.stackableTargets.set([]);
  }

  zoomFromMenu(): void {
    const card = this.cardMenuCard();
    if (card) {
      this.zoomCard.set(card);
      this.closeCardMenu();
    }
  }

  async toggleTapFromMenu(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      await this.gameHub.toggleTap(card.instanceId);
      this.closeCardMenu();
    }
  }

  async incrementCounter(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      const currentValue = card.counter ?? 0;
      await this.gameHub.setCounter(card.instanceId, currentValue + 1);
    }
  }

  async decrementCounter(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      const currentValue = card.counter ?? 0;
      if (currentValue > 0) {
        await this.gameHub.setCounter(card.instanceId, currentValue - 1);
      }
    }
  }

  async removeCounter(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      await this.gameHub.removeCounter(card.instanceId);
    }
  }

  async incrementDamage(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      const currentValue = card.damage ?? 0;
      await this.gameHub.setDamage(card.instanceId, currentValue + 1);
    }
  }

  async decrementDamage(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      const currentValue = card.damage ?? 0;
      if (currentValue > 0) {
        await this.gameHub.setDamage(card.instanceId, currentValue - 1);
      }
    }
  }

  async removeDamage(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      await this.gameHub.removeDamage(card.instanceId);
    }
  }

  async discardFromMenu(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      await this.gameHub.discardCard(card.instanceId);
      this.closeCardMenu();
    }
  }

  async returnToHandFromMenu(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      await this.gameHub.returnToHand(card.instanceId);
      this.closeCardMenu();
    }
  }

  async playToArena(arena: string): Promise<void> {
    const card = this.handCardMenuCard();
    if (card) {
      const result = await this.gameHub.playCard(card.instanceId, arena);
      if (!result.success && result.errorMessage) {
        this.notifications.error(result.errorMessage);
      }
      this.closeHandCardMenu();
    }
  }

  // Stack Menu Methods

  openStackMenu(event: MouseEvent, card: CardInstanceDto): void {
    event.preventDefault();
    event.stopPropagation();
    this.stackMenuCardId.set(card.instanceId);
    this.setMenuPosition(event.clientX, event.clientY, 400); // Stack menu can be tall
    this.stackMenuX.set(this.cardMenuX());
    this.stackMenuY.set(this.cardMenuY());
  }

  closeStackMenu(): void {
    this.stackMenuCardId.set(null);
  }

  // Open card menu from stack menu (More Options)
  openCardMenuFromStack(event: MouseEvent): void {
    const card = this.stackMenuCard();
    if (card) {
      this.closeStackMenu();
      this.openCardMenu(event, card);
    }
  }

  async setStackTop(newTopCardId: string): Promise<void> {
    const currentTop = this.stackMenuCard();
    if (currentTop) {
      const result = await this.gameHub.setStackTop(currentTop.instanceId, newTopCardId);
      if (!result.success && result.errorMessage) {
        this.notifications.error(result.errorMessage);
      }
      this.closeStackMenu();
    }
  }

  // Check if a hand card has stackable targets in the arena
  async checkStackableTargets(card: CardInstanceDto): Promise<void> {
    if (!card.version || card.cardType !== CARD_TYPE_UNIT) {
      this.stackableTargets.set([]);
      return;
    }
    const targets = await this.gameHub.getStackableCards(card.instanceId);
    this.stackableTargets.set(targets);
  }

  // Stack a card from hand onto a target in arena
  async stackCardOnTarget(cardToStackId: string, targetCardId: string): Promise<void> {
    const result = await this.gameHub.stackCard(cardToStackId, targetCardId);
    if (!result.success && result.errorMessage) {
      this.notifications.error(result.errorMessage);
    }
    this.stackableTargets.set([]);
    this.closeHandCardMenu();
  }

  // Check if card has a stack
  hasStack(card: CardInstanceDto): boolean {
    return card.stackedUnderIds && card.stackedUnderIds.length > 0;
  }

  // Get stack size
  getStackSize(card: CardInstanceDto): number {
    return (card.stackedUnderIds?.length ?? 0) + 1;
  }
}
