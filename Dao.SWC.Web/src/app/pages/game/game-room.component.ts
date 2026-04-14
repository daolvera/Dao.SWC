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
  Team,
  TeamDataDto,
} from '../../models/dtos/game.dto';
import { Alignment } from '../../models/dtos/card.dto';
import { DeckListItemDto } from '../../models/dtos/deck.dto';
import { DeckService } from '../../services/deck.service';
import { GameHubService } from '../../services/game-hub.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationsComponent } from '../../components/notifications/notifications.component';
import { TouchCardDirective, TouchDragEvent, TouchDropEvent } from '../../directives/touch-card.directive';

type CardZone = 'deck' | 'hand' | 'space' | 'ground' | 'character' | 'discard' | 'build';

interface DraggedCard {
  card: CardInstanceDto;
  sourceZone: CardZone;
}

// CardType enum values
const CARD_TYPE_UNIT = 0;
const CARD_TYPE_EQUIPMENT = 2;
const CARD_TYPE_BATTLE = 4;

@Component({
  selector: 'app-game-room',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./game-room.component.scss'],
  templateUrl: './game-room.component.html',
  imports: [ReactiveFormsModule, RouterLink, FormsModule, NotificationsComponent, TitleCasePipe, TouchCardDirective],
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
  private deckService = inject(DeckService);

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
  deckBrowserTopX = signal<number | null>(null);

  deckBrowserFiltered = computed(() => {
    const cards = this.deckBrowserCards();
    const topX = this.deckBrowserTopX();
    if (topX === null || topX <= 0) return cards;
    return cards.slice(0, topX);
  });

  deckCardMenuCardId = signal<string | null>(null);

  deckCardMenuCard = computed(() => {
    const id = this.deckCardMenuCardId();
    if (!id) return null;
    return this.deckBrowserCards().find(c => c.instanceId === id) ?? null;
  });
  dragOverZone = signal<CardZone | null>(null);
  handMinimized = signal(false);
  bottomControlsCollapsed = signal(false);
  zoomCard = signal<CardInstanceDto | null>(null);

  // Arena card order state (for client-side reordering)
  arenaCardOrder = signal<{ [arena: string]: string[] }>({
    space: [],
    ground: [],
    character: [],
  });

  // Chat state
  chatMessages = signal<ChatMessage[]>([]);
  chatInput = new FormControl('');
  @ViewChild('chatMessagesContainer') chatMessagesContainer!: ElementRef<HTMLElement>;

  // Bidding state
  bidInput = new FormControl<number | null>(null, [Validators.min(1)]);
  
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
    // Search arenas (team-aware)
    const arenas = this.isTeamMode() ? this.myTeamArenas() : this.myPlayer()?.arenas;
    if (arenas) {
      for (const arena of Object.values(arenas)) {
        const card = arena.find((c) => c.instanceId === cardId);
        if (card) return card;
      }
    }
    // Also search discard pile
    const me = this.myPlayer();
    const discardCard = me?.discardPile.find((c) => c.instanceId === cardId);
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
    // Search arenas (team-aware)
    const arenas = this.isTeamMode() ? this.myTeamArenas() : this.myPlayer()?.arenas;
    if (arenas) {
      for (const arena of Object.values(arenas)) {
        const card = arena.find((c) => c.instanceId === cardId);
        if (card) return card;
      }
    }
    return null;
  });

  // Stackable cards for hand card
  stackableTargets = signal<CardInstanceDto[]>([]);

  // Pilot context menu state
  pilotMenuCardId = signal<string | null>(null);
  pilotMenuUnitCard = signal<CardInstanceDto | null>(null);
  pilotMenuX = signal(0);
  pilotMenuY = signal(0);

  pilotMenuCard = computed(() => {
    const cardId = this.pilotMenuCardId();
    if (!cardId) return null;
    // Search arenas (team-aware)
    const arenas = this.isTeamMode() ? this.myTeamArenas() : this.myPlayer()?.arenas;
    if (arenas) {
      for (const arena of Object.values(arenas)) {
        const card = arena.find((c) => c.instanceId === cardId);
        if (card) return card;
      }
    }
    return null;
  });

  // Pilot modal state
  showPilotModal = signal(false);
  pilotModalCard = signal<CardInstanceDto | null>(null);

  // Equipment context menu state
  equipmentMenuCardId = signal<string | null>(null);
  equipmentMenuUnitCard = signal<CardInstanceDto | null>(null);
  equipmentMenuX = signal(0);
  equipmentMenuY = signal(0);

  equipmentMenuCard = computed(() => {
    const cardId = this.equipmentMenuCardId();
    if (!cardId) return null;
    // Search arenas (team-aware)
    const arenas = this.isTeamMode() ? this.myTeamArenas() : this.myPlayer()?.arenas;
    if (arenas) {
      for (const arena of Object.values(arenas)) {
        const card = arena.find((c) => c.instanceId === cardId);
        if (card) return card;
      }
    }
    return null;
  });

  // Equipment modal state
  showEquipmentModal = signal(false);
  equipmentModalCard = signal<CardInstanceDto | null>(null);

  // Teammate hand modal state
  showTeammateHandModal = signal<string | null>(null); // username of teammate to show

  // Restart game state
  showRestartModal = signal(false);
  isRestartWaiting = signal(false);
  restartValidDecks = signal<DeckListItemDto[]>([]);
  restartDeckIdSelect = signal<number | null>(null);
  restartAlignmentSelect = signal<Alignment | null>(null);

  restartDeckIsNeutral = computed(() => {
    const id = this.restartDeckIdSelect();
    if (!id) return false;
    return this.restartValidDecks().find(d => d.id === id)?.alignment === Alignment.Neutral;
  });

  // Hand card order (client-side reordering)
  handCardOrder = signal<string[]>([]);

  teammateHandPlayer = computed(() => {
    const username = this.showTeammateHandModal();
    if (!username) return null;
    return this.teammates().find((t) => t.username === username) ?? null;
  });

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

  // Team mode computed signals
  isTeamMode = computed(() => {
    const r = this.room();
    return r !== null && r.roomType !== RoomType.OneVOne;
  });

  myTeam = computed((): TeamDataDto | null => {
    const r = this.room();
    const me = this.myPlayer();
    if (!r || !me || !r.teams) return null;
    return r.teams.find((t) => t.team === me.team) ?? null;
  });

  opponentTeam = computed((): TeamDataDto | null => {
    const r = this.room();
    const me = this.myPlayer();
    if (!r || !me || !r.teams) return null;
    return r.teams.find((t) => t.team !== me.team) ?? null;
  });

  teammates = computed(() => {
    const r = this.room();
    const me = this.myPlayer();
    if (!r || !me) return [];
    return r.players.filter((p) => p.team === me.team && p.username !== this.gameHub.currentUser);
  });

  opponentTeamPlayers = computed(() => {
    const r = this.room();
    const me = this.myPlayer();
    if (!r || !me) return [];
    return r.players.filter((p) => p.team !== me.team);
  });

  // Team arena cards (for team mode)
  myTeamArenas = computed((): { [arena: string]: CardInstanceDto[] } => {
    const team = this.myTeam();
    if (!team) return { space: [], ground: [], character: [] };
    return team.arenas;
  });

  myTeamBuildZone = computed(() => {
    const team = this.myTeam();
    return team?.buildZone ?? [];
  });

  myTeamForce = computed(() => {
    const team = this.myTeam();
    const me = this.myPlayer();
    // In team mode use team force, otherwise use player force
    if (this.isTeamMode() && team) return team.force;
    return me?.force ?? 4;
  });

  myTeamBuildCounter = computed(() => {
    const team = this.myTeam();
    const me = this.myPlayer();
    // In team mode use team build counter, otherwise use player build counter
    if (this.isTeamMode() && team) return team.buildCounter;
    return me?.buildCounter ?? 60;
  });

  opponentTeamArenas = computed((): { [arena: string]: CardInstanceDto[] } => {
    const team = this.opponentTeam();
    if (!team) return { space: [], ground: [], character: [] };
    return team.arenas;
  });

  opponentTeamBuildZone = computed(() => {
    const team = this.opponentTeam();
    return team?.buildZone ?? [];
  });

  // Bidding computed properties
  myBid = computed(() => {
    const r = this.room();
    if (!r) return null;

    if (this.isTeamMode()) {
      // Team mode: get bid from my team
      return this.myTeam()?.secretBid ?? null;
    } else {
      // 1v1 mode: get bid from my player
      return this.myPlayer()?.secretBid ?? null;
    }
  });

  bidsRevealed = computed(() => {
    return this.room()?.bidsRevealed ?? false;
  });

  allBids = computed(() => {
    const r = this.room();
    if (!r) return [];

    if (this.isTeamMode()) {
      // Team mode: return team bids
      return (
        r.teams?.map((t) => ({
          team: t.team,
          label: t.team === Team.Team1 ? 'Team 1' : 'Team 2',
          bid: t.secretBid,
        })) ?? []
      );
    } else {
      // 1v1 mode: return player bids
      return r.players.map((p) => ({
        team: p.team,
        label: p.username,
        bid: p.secretBid,
      }));
    }
  });

  // Check if opponent team arena is retreated
  isOpponentTeamArenaRetreated(arena: string): boolean {
    const team = this.opponentTeam();
    if (!team) return false;
    switch (arena) {
      case 'space':
        return team.spaceArenaRetreated;
      case 'ground':
        return team.groundArenaRetreated;
      case 'character':
        return team.characterArenaRetreated;
      default:
        return false;
    }
  }

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

  // Hand sorted with sideways cards (non-units) at the end
  myHandSorted = computed(() => {
    const hand = this.myHand();
    // Partition: units first, then non-units (sideways)
    const units = hand.filter((c) => c.cardType === CARD_TYPE_UNIT);
    const nonUnits = hand.filter((c) => c.cardType !== CARD_TYPE_UNIT);
    return [...units, ...nonUnits];
  });

  // Hand sorted respecting client-side card order
  myHandSortedWithOrder = computed(() => {
    const sorted = this.myHandSorted();
    const order = this.handCardOrder();
    if (order.length === 0) return sorted;

    const orderMap = new Map(order.map((id, i) => [id, i]));
    return [...sorted].sort((a, b) => {
      const aIdx = orderMap.has(a.instanceId) ? orderMap.get(a.instanceId)! : 999;
      const bIdx = orderMap.has(b.instanceId) ? orderMap.get(b.instanceId)! : 999;
      return aIdx - bIdx;
    });
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
    // In team mode, use team build zone; otherwise, use player build zone
    if (this.isTeamMode()) {
      return this.myTeamBuildZone();
    }
    const me = this.myPlayer();
    return me?.buildZone ?? [];
  });

  showBuildZone = signal(false);
  showOpponentBuildZone = signal<GamePlayerDto | null>(null);
  showOpponentTeamBuildZone = signal(false);

  // Computed: Get opponent build zone cards (team-aware)
  opponentBuildZoneCards = computed(() => {
    if (this.isTeamMode()) {
      return this.opponentTeamBuildZone();
    }
    const opponent = this.showOpponentBuildZone();
    return opponent?.buildZone ?? [];
  });

  // Build zone card context menu
  buildCardMenuCardId = signal<string | null>(null);
  buildCardMenuX = signal(0);
  buildCardMenuY = signal(0);

  buildCardMenuCard = computed(() => {
    const cardId = this.buildCardMenuCardId();
    if (!cardId) return null;
    // Use myBuildZone() which handles team mode correctly
    return this.myBuildZone().find((c) => c.instanceId === cardId) ?? null;
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
          // Clear restart-waiting flag once the game goes back in progress
          if (room.state === GameState.InProgress) {
            this.isRestartWaiting.set(false);
          }
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
      this.deckService.getUserDecks().subscribe(decks =>
        this.restartValidDecks.set(decks.filter(d => d.isValid))
      ),
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

  // Get units (cardType === 0) from a player's arena (only top-level cards, not stacked under, not piloting)
  getPlayerArenaUnits(player: GamePlayerDto, arena: string): CardInstanceDto[] {
    const arenaCards = player.arenas[arena] ?? [];
    return arenaCards.filter((c) => c.cardType === CARD_TYPE_UNIT && !c.stackParentId && !this.isPiloting(c));
  }

  // Get non-units from a player's arena
  getPlayerArenaOthers(player: GamePlayerDto, arena: string): CardInstanceDto[] {
    const arenaCards = player.arenas[arena] ?? [];
    return arenaCards.filter((c) => c.cardType !== CARD_TYPE_UNIT && !this.isEquipped(c));
  }

  // Get stacked cards under a given card
  getStackedCards(player: GamePlayerDto, card: CardInstanceDto): CardInstanceDto[] {
    if (!card.stackedUnderIds || card.stackedUnderIds.length === 0) return [];
    const allArenaCards = Object.values(player.arenas).flat();
    return card.stackedUnderIds
      .map((id) => allArenaCards.find((c) => c.instanceId === id))
      .filter((c): c is CardInstanceDto => c !== undefined);
  }

  // Get my stacked cards (team-aware)
  getMyStackedCards(card: CardInstanceDto): CardInstanceDto[] {
    // In team mode, search all team arena cards
    if (this.isTeamMode()) {
      return this.getMyStackedCardsTeamAware(card);
    }
    const me = this.myPlayer();
    if (!me) return [];
    return this.getStackedCards(me, card);
  }

  // Get arena cards - team or player based on mode
  private getMyArenaCards(arena: string): CardInstanceDto[] {
    if (this.isTeamMode()) {
      return this.myTeamArenas()[arena] ?? [];
    }
    const me = this.myPlayer();
    return me?.arenas[arena] ?? [];
  }

  // Get my units for an arena
  myArenaUnits(arena: string): CardInstanceDto[] {
    const arenaCards = this.getMyArenaCards(arena);
    // Filter out: non-units, stacked cards (pilots are shown as overlays, not filtered)
    return arenaCards.filter((c) => c.cardType === CARD_TYPE_UNIT && !c.stackParentId && !this.isPiloting(c));
  }

  // Get my units for an arena with custom ordering
  myArenaUnitsOrdered(arena: string): CardInstanceDto[] {
    const units = this.myArenaUnits(arena);
    const order = this.arenaCardOrder()[arena] || [];

    if (order.length === 0) {
      return units;
    }

    // Sort units based on custom order
    const orderMap = new Map(order.map((id, idx) => [id, idx]));
    return [...units].sort((a, b) => {
      const aIdx = orderMap.get(a.instanceId) ?? Number.MAX_SAFE_INTEGER;
      const bIdx = orderMap.get(b.instanceId) ?? Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });
  }

  // Get my non-units for an arena (excludes equipment that is currently equipped to a unit)
  myArenaOthers(arena: string): CardInstanceDto[] {
    const arenaCards = this.getMyArenaCards(arena);
    return arenaCards.filter((c) => 
      c.cardType !== CARD_TYPE_UNIT && 
      !this.isEquipped(c) // Exclude equipped equipment cards
    );
  }

  // Get active (non-retreated) cards from my arena - now based on arena-level retreat
  myArenaActiveUnits(arena: string): CardInstanceDto[] {
    if (this.isMyArenaRetreated(arena)) return [];
    return this.myArenaUnits(arena);
  }

  myArenaActiveOthers(arena: string): CardInstanceDto[] {
    if (this.isMyArenaRetreated(arena)) return [];
    return this.myArenaOthers(arena);
  }

  // Check if my arena is retreated (team-aware)
  isMyArenaRetreated(arena: string): boolean {
    if (this.isTeamMode()) {
      const team = this.myTeam();
      if (!team) return false;
      switch (arena) {
        case 'space':
          return team.spaceArenaRetreated;
        case 'ground':
          return team.groundArenaRetreated;
        case 'character':
          return team.characterArenaRetreated;
        default:
          return false;
      }
    }
    const me = this.myPlayer();
    if (!me) return false;
    return this.isArenaRetreated(me, arena);
  }

  // Check if an arena is retreated for a specific player
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
    if (!this.isMyArenaRetreated(arena)) return [];
    return this.getMyArenaCards(arena);
  }

  // Check if current user owns a card (for team mode permission checks)
  isCardOwner(card: CardInstanceDto): boolean {
    // In non-team mode, if card is in my player's collection, I own it
    if (!this.isTeamMode()) return true;
    // In team mode, check ownerUserId
    return card.ownerUserId === this.gameHub.currentUser;
  }

  // Check if current user can perform actions on a card (owner-only except for stacking)
  canActOnCard(card: CardInstanceDto): boolean {
    return this.isCardOwner(card);
  }

  // Get the owner username for display
  getCardOwnerDisplay(card: CardInstanceDto): string | null {
    if (!this.isTeamMode() || !card.ownerUserId) return null;
    const r = this.room();
    if (!r) return null;
    const owner = r.players.find((p) => p.username === card.ownerUserId);
    return owner?.username ?? card.ownerUserId;
  }

  // Get stacked cards in team mode (searches all team cards)
  getMyStackedCardsTeamAware(card: CardInstanceDto): CardInstanceDto[] {
    if (!card.stackedUnderIds || card.stackedUnderIds.length === 0) return [];
    
    // Get all cards from my arena (team or player based)
    const allArenaCards = [
      ...this.getMyArenaCards('space'),
      ...this.getMyArenaCards('ground'),
      ...this.getMyArenaCards('character'),
    ];
    
    return card.stackedUnderIds
      .map((id) => allArenaCards.find((c) => c.instanceId === id))
      .filter((c): c is CardInstanceDto => c !== undefined);
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

  // Team-based arena access for opponent team
  getOpponentTeamArenaCards(arena: string): CardInstanceDto[] {
    return this.opponentTeamArenas()[arena] ?? [];
  }

  getOpponentTeamArenaUnits(arena: string): CardInstanceDto[] {
    const arenaCards = this.getOpponentTeamArenaCards(arena);
    return arenaCards.filter((c) => c.cardType === CARD_TYPE_UNIT && !c.stackParentId);
  }

  getOpponentTeamArenaOthers(arena: string): CardInstanceDto[] {
    const arenaCards = this.getOpponentTeamArenaCards(arena);
    return arenaCards.filter((c) => 
      c.cardType !== CARD_TYPE_UNIT && 
      !this.isEquipped(c) // Exclude equipped equipment cards
    );
  }

  // Get stacked cards in opponent team arena
  getOpponentTeamStackedCards(card: CardInstanceDto): CardInstanceDto[] {
    if (!card.stackedUnderIds || card.stackedUnderIds.length === 0) return [];
    const allArenaCards = [
      ...this.getOpponentTeamArenaCards('space'),
      ...this.getOpponentTeamArenaCards('ground'),
      ...this.getOpponentTeamArenaCards('character'),
    ];
    return card.stackedUnderIds
      .map((id) => allArenaCards.find((c) => c.instanceId === id))
      .filter((c): c is CardInstanceDto => c !== undefined);
  }

  getPlayerCardCount(player: GamePlayerDto): number {
    return player.hand.length + player.deckSize;
  }

  // Arena indicator for build zone cards
  getArenaIndicatorClass(card: CardInstanceDto): string {
    // Non-unit cards (Location, Equipment, Mission, Battle) are "sideways" - no specific arena
    if (card.cardType !== CARD_TYPE_UNIT) {
      return 'arena-sideways';
    }
    // Unit cards have a specific arena
    switch (card.cardArena?.toLowerCase()) {
      case 'space':
        return 'arena-space';
      case 'ground':
        return 'arena-ground';
      case 'character':
        return 'arena-character';
      default:
        return 'arena-unknown';
    }
  }

  getArenaIndicatorText(card: CardInstanceDto): string {
    // Non-unit cards are sideways
    if (card.cardType !== CARD_TYPE_UNIT) {
      return 'S';
    }
    // Unit cards show arena initial
    switch (card.cardArena?.toLowerCase()) {
      case 'space':
        return 'SP';
      case 'ground':
        return 'GR';
      case 'character':
        return 'CH';
      default:
        return '?';
    }
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
    if (card.cardType === CARD_TYPE_BATTLE) {
      this.notifications.error('Battle cards cannot be placed in the build zone');
      return;
    }
    await this.gameHub.moveToBuild(card.instanceId);
  }

  async moveToBuildFromMenu(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      if (card.cardType === CARD_TYPE_BATTLE) {
        this.notifications.error('Battle cards cannot be placed in the build zone');
        this.closeCardMenu();
        return;
      }
      await this.gameHub.moveToBuild(card.instanceId);
      this.closeCardMenu();
    }
  }

  async moveToBuildFromHandMenu(): Promise<void> {
    const card = this.handCardMenuCard();
    if (card) {
      if (card.cardType === CARD_TYPE_BATTLE) {
        this.notifications.error('Battle cards cannot be placed in the build zone');
        this.closeHandCardMenu();
        return;
      }
      await this.gameHub.moveToBuild(card.instanceId);
      this.closeHandCardMenu();
    }
  }

  async moveFromBuildToHandFromMenu(): Promise<void> {
    const card = this.buildCardMenuCard();
    if (card) {
      this.closeBuildCardMenu();
      await this.gameHub.moveFromBuildToHand(card.instanceId);
    }
  }

  async discardFromHandMenu(): Promise<void> {
    const card = this.handCardMenuCard();
    if (card) {
      this.closeHandCardMenu();
      await this.gameHub.discardCard(card.instanceId);
    }
  }

  async putOnBottomOfDeckFromMenu(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      this.closeCardMenu();
      await this.gameHub.putOnBottomOfDeck(card.instanceId);
    }
  }

  async putOnBottomOfDeckFromHandMenu(): Promise<void> {
    const card = this.handCardMenuCard();
    if (card) {
      this.closeHandCardMenu();
      await this.gameHub.putOnBottomOfDeck(card.instanceId);
    }
  }

  // Arena retreat methods
  async untapAll(): Promise<void> {
    await this.gameHub.untapAll();
  }

  async discardBattleAndMissionCards(): Promise<void> {
    await this.gameHub.discardBattleAndMissionCards();
  }

  // Restart game methods
  async confirmRestartGame(): Promise<void> {
    this.showRestartModal.set(false);
    this.isRestartWaiting.set(true);
    await this.gameHub.restartGame();
  }

  async submitRestartDeck(): Promise<void> {
    const deckId = this.restartDeckIdSelect();
    if (!deckId) return;
    if (this.restartDeckIsNeutral() && !this.restartAlignmentSelect()) return;
    await this.gameHub.selectRestartDeck(deckId, this.restartAlignmentSelect() ?? undefined);
  }

  // Hand drag-and-drop reorder handlers
  onHandCardDragStart(event: DragEvent, card: CardInstanceDto, index: number): void {
    this.onDragStart(event, card, 'hand');
  }

  onHandCardDragOver(event: DragEvent, targetIndex: number): void {
    if (this.draggedCard?.sourceZone === 'hand') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  onHandCardDrop(event: DragEvent, targetCard: CardInstanceDto): void {
    const dragged = this.draggedCard;
    if (!dragged || dragged.sourceZone !== 'hand') return;

    event.preventDefault();
    event.stopPropagation();

    const currentOrder = this.myHandSortedWithOrder();
    const fromIndex = currentOrder.findIndex(c => c.instanceId === dragged.card.instanceId);
    const toIndex = currentOrder.findIndex(c => c.instanceId === targetCard.instanceId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      this.onDragEnd();
      return;
    }

    const newOrder = currentOrder.map(c => c.instanceId);
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, dragged.card.instanceId);

    this.handCardOrder.set(newOrder);
    this.onDragEnd();
  }

  // Arena retreat methods
  async toggleArenaRetreat(arena: string): Promise<void> {
    await this.gameHub.toggleArenaRetreat(arena);
  }
  async toggleCardRetreatFromMenu(): Promise<void> {
    const card = this.cardMenuCard();
    if (card) {
      await this.gameHub.toggleCardRetreat(card.instanceId);
      this.closeCardMenu();
    }
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
    this.deckBrowserTopX.set(null);
    this.showDeckBrowser.set(true);
  }

  viewTopXInput = signal<number>(3);

  async openDeckBrowserTopX(): Promise<void> {
    const cards = await this.gameHub.viewDeck();
    this.deckBrowserCards.set(cards);
    this.deckBrowserTopX.set(this.viewTopXInput());
    this.showDeckBrowser.set(true);
  }

  async takeCardFromDeck(cardInstanceId: string): Promise<void> {
    await this.gameHub.takeFromDeck(cardInstanceId);
    this.showDeckBrowser.set(false);
  }

  openDeckCardMenu(event: MouseEvent, card: CardInstanceDto): void {
    event.preventDefault();
    event.stopPropagation();
    this.deckCardMenuCardId.set(card.instanceId);
    this.setMenuPosition(event.clientX, event.clientY);
  }

  closeDeckCardMenu(): void {
    this.deckCardMenuCardId.set(null);
  }

  zoomFromDeckMenu(): void {
    const card = this.deckCardMenuCard();
    if (card) {
      this.zoomCard.set(card);
      this.closeDeckCardMenu();
    }
  }

  async takeFromDeckMenu(): Promise<void> {
    const card = this.deckCardMenuCard();
    if (card) {
      this.closeDeckCardMenu();
      await this.takeCardFromDeck(card.instanceId);
    }
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
    event.stopPropagation();
    this.dragOverZone.set(null);

    if (!this.draggedCard) return;

    const { card, sourceZone } = this.draggedCard;
    this.draggedCard = null;

    // If dropping in the same arena, handle reordering
    if (sourceZone === targetZone && this.isArenaZone(targetZone)) {
      this.handleArenaReorder(event, card, targetZone);
      return;
    }

    if (sourceZone === targetZone) return;

    await this.moveCard(card.instanceId, sourceZone, targetZone, card);
  }

  private isArenaZone(zone: CardZone): boolean {
    return zone === 'space' || zone === 'ground' || zone === 'character';
  }

  private handleArenaReorder(event: DragEvent, card: CardInstanceDto, arena: CardZone): void {
    // Get the target card element we're dropping on
    const target = event.target as HTMLElement;
    const targetCard = target.closest('.game-card[data-instanceid]');
    
    // Get current units in arena
    const units = this.myArenaUnits(arena);
    
    // Initialize order if not set
    let currentOrder = this.arenaCardOrder()[arena];
    if (!currentOrder || currentOrder.length === 0) {
      currentOrder = units.map((c) => c.instanceId);
    }
    
    // Ensure all current units are in the order
    const unitIds = new Set(units.map((c) => c.instanceId));
    currentOrder = currentOrder.filter((id) => unitIds.has(id));
    for (const unit of units) {
      if (!currentOrder.includes(unit.instanceId)) {
        currentOrder.push(unit.instanceId);
      }
    }

    // Remove the dragged card from order
    const newOrder = currentOrder.filter((id) => id !== card.instanceId);

    if (targetCard) {
      // Get the data-instanceid of the target card
      const dropTargetId = targetCard.getAttribute('data-instanceid');
      if (dropTargetId && dropTargetId !== card.instanceId) {
        // Find the index of the target card and insert before it
        const targetIdx = newOrder.indexOf(dropTargetId);
        if (targetIdx >= 0) {
          newOrder.splice(targetIdx, 0, card.instanceId);
        } else {
          newOrder.push(card.instanceId);
        }
      } else {
        // Dropped on self or no valid target, append to end
        newOrder.push(card.instanceId);
      }
    } else {
      // Dropped on arena background, append to end
      newOrder.push(card.instanceId);
    }

    // Update the order
    this.arenaCardOrder.update((orders) => ({
      ...orders,
      [arena]: newOrder,
    }));
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
      // Battle cards cannot go to build zone
      if (card && card.cardType === CARD_TYPE_BATTLE) {
        this.notifications.error('Battle cards cannot be placed in the build zone');
        return;
      }
      await this.gameHub.moveToBuild(cardId);
    }
  }

  // Touch event handlers for iPad/mobile support
  onTouchLongPress(event: TouchDragEvent, card: CardInstanceDto, menuType: 'card' | 'hand' | 'build' | 'discard' | 'opponent'): void {
    switch (menuType) {
      case 'card':
        this.cardMenuCardId.set(card.instanceId);
        this.setMenuPosition(event.clientX, event.clientY);
        break;
      case 'hand':
        this.handCardMenuCardId.set(card.instanceId);
        this.setMenuPosition(event.clientX, event.clientY, 350);
        this.checkStackableTargets(card);
        break;
      case 'build':
        this.buildCardMenuCardId.set(card.instanceId);
        this.setMenuPosition(event.clientX, event.clientY);
        break;
      case 'discard':
        this.discardCardMenuCardId.set(card.instanceId);
        this.setMenuPosition(event.clientX, event.clientY);
        break;
      case 'opponent':
        this.opponentCardMenuCard.set(card);
        this.setMenuPosition(event.clientX, event.clientY);
        break;
    }
  }

  onTouchDragStart(event: TouchDragEvent, card: CardInstanceDto, zone: CardZone): void {
    this.draggedCard = { card, sourceZone: zone };
  }

  async onTouchDrop(event: TouchDropEvent, card: CardInstanceDto, sourceZone: CardZone): Promise<void> {
    if (!event.dropTarget) {
      this.draggedCard = null;
      return;
    }

    const targetZone = this.getZoneFromElement(event.dropTarget);
    if (!targetZone) {
      this.draggedCard = null;
      return;
    }

    // If dropping in the same arena, handle reordering
    if (sourceZone === targetZone && this.isArenaZone(targetZone)) {
      this.handleTouchArenaReorder(event, card, targetZone);
      this.draggedCard = null;
      return;
    }

    if (sourceZone === targetZone) {
      this.draggedCard = null;
      return;
    }

    await this.moveCard(card.instanceId, sourceZone, targetZone, card);
    this.draggedCard = null;
  }

  private getZoneFromElement(element: Element): CardZone | null {
    const zone = element.closest('[class*="-zone"], [class*="-arena"]');
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

  private handleTouchArenaReorder(event: TouchDropEvent, card: CardInstanceDto, arena: CardZone): void {
    if (!event.dropTarget) return;
    
    const targetCard = event.dropTarget.closest('.game-card[data-instanceid]');
    const units = this.myArenaUnits(arena);
    
    let currentOrder = this.arenaCardOrder()[arena];
    if (!currentOrder || currentOrder.length === 0) {
      currentOrder = units.map((c) => c.instanceId);
    }
    
    const unitIds = new Set(units.map((c) => c.instanceId));
    currentOrder = currentOrder.filter((id) => unitIds.has(id));
    for (const unit of units) {
      if (!currentOrder.includes(unit.instanceId)) {
        currentOrder.push(unit.instanceId);
      }
    }

    const newOrder = currentOrder.filter((id) => id !== card.instanceId);

    if (targetCard) {
      const dropTargetId = targetCard.getAttribute('data-instanceid');
      if (dropTargetId && dropTargetId !== card.instanceId) {
        const targetIdx = newOrder.indexOf(dropTargetId);
        if (targetIdx >= 0) {
          newOrder.splice(targetIdx, 0, card.instanceId);
        } else {
          newOrder.push(card.instanceId);
        }
      } else {
        newOrder.push(card.instanceId);
      }
    } else {
      newOrder.push(card.instanceId);
    }

    this.arenaCardOrder.update((orders) => ({
      ...orders,
      [arena]: newOrder,
    }));
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

  async drawSevenCards(): Promise<void> {
    await this.gameHub.drawCards(7);
  }

  async shuffleDeck(): Promise<void> {
    await this.gameHub.shuffleDeck();
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

  async submitBid(): Promise<void> {
    const bid = this.bidInput.value;
    if (!bid || bid <= 0) {
      this.notifications.warning('Please enter a positive number');
      return;
    }
    await this.gameHub.submitBid(bid);
    this.notifications.success('Bid submitted');
  }

  async revealBids(): Promise<void> {
    await this.gameHub.revealBids();
  }

  async hideBids(): Promise<void> {
    await this.gameHub.hideBids();
  }

  async clearBid(): Promise<void> {
    await this.gameHub.clearBid();
    this.bidInput.setValue(null);
    this.notifications.info('Bid cleared');
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

  zoomFromHandMenu(): void {
    const card = this.handCardMenuCard();
    if (card) {
      this.zoomCard.set(card);
      this.closeHandCardMenu();
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

  // Piloting helpers

  // Check if a card is a pilot
  isPilot(card: CardInstanceDto): boolean {
    return card.isPilot === true;
  }

  // Check if a unit has pilots attached
  hasPilots(card: CardInstanceDto): boolean {
    return card.pilotCardIds && card.pilotCardIds.length > 0;
  }

  // Get pilot cards attached to a unit (searches all arenas including opponent's)
  getPilotCards(card: CardInstanceDto): CardInstanceDto[] {
    if (!card.pilotCardIds || card.pilotCardIds.length === 0) return [];
    
    // Get all cards from all arenas (mine, opponent team, and individual opponents)
    const allArenaCards = [
      ...this.getMyArenaCards('space'),
      ...this.getMyArenaCards('ground'),
      ...this.getMyArenaCards('character'),
      ...this.getOpponentTeamArenaCards('space'),
      ...this.getOpponentTeamArenaCards('ground'),
      ...this.getOpponentTeamArenaCards('character'),
      ...this.opponents().flatMap((o) => Object.values(o.arenas).flat()),
    ];
    
    return card.pilotCardIds
      .map((id) => allArenaCards.find((c) => c.instanceId === id))
      .filter((c): c is CardInstanceDto => c !== undefined);
  }

  // Check if a card is currently piloting a unit
  isPiloting(card: CardInstanceDto): boolean {
    return card.pilotingUnitId !== null && card.pilotingUnitId !== undefined;
  }

  // Open pilot card context menu
  openPilotCardMenu(event: MouseEvent, pilotCard: CardInstanceDto, unitCard: CardInstanceDto): void {
    event.preventDefault();
    event.stopPropagation();
    this.pilotMenuCardId.set(pilotCard.instanceId);
    this.pilotMenuUnitCard.set(unitCard);
    this.pilotMenuX.set(event.clientX);
    this.pilotMenuY.set(event.clientY);
  }

  closePilotMenu(): void {
    this.pilotMenuCardId.set(null);
    this.pilotMenuUnitCard.set(null);
  }

  // Detach pilot from the pilot context menu
  async detachPilotFromPilotMenu(): Promise<void> {
    const pilotCard = this.pilotMenuCard();
    if (!pilotCard) return;
    
    const result = await this.gameHub.removePilot(pilotCard.instanceId);
    if (result.success) {
      this.notifications.success(`${pilotCard.cardName} detached`);
    } else if (result.errorMessage) {
      this.notifications.error(result.errorMessage);
    }
    this.closePilotMenu();
  }

  // Zoom on unit from pilot menu
  zoomUnitFromPilotMenu(): void {
    const unitCard = this.pilotMenuUnitCard();
    if (unitCard) {
      this.zoomCard.set(unitCard);
    }
    this.closePilotMenu();
  }

  // Zoom on pilot from pilot menu
  zoomPilotFromPilotMenu(): void {
    const pilotCard = this.pilotMenuCard();
    if (pilotCard) {
      this.zoomCard.set(pilotCard);
    }
    this.closePilotMenu();
  }

  // Open pilot modal for selecting unit to pilot
  openPilotModal(card: CardInstanceDto): void {
    this.pilotModalCard.set(card);
    this.showPilotModal.set(true);
    this.closeCardMenu();
    this.closeHandCardMenu();
    this.closeBuildCardMenu();
  }

  closePilotModal(): void {
    this.showPilotModal.set(false);
    this.pilotModalCard.set(null);
  }

  // Pilot a unit from the modal
  async pilotUnitFromModal(targetUnit: CardInstanceDto): Promise<void> {
    const pilotCard = this.pilotModalCard();
    if (!pilotCard) return;
    
    const result = await this.gameHub.addPilot(pilotCard.instanceId, targetUnit.instanceId);
    if (result.success) {
      this.notifications.success(`${pilotCard.cardName} is now piloting ${targetUnit.cardName}`);
    } else if (result.errorMessage) {
      this.notifications.error(result.errorMessage);
    }
    this.closePilotModal();
  }

  // Equipment context menu methods

  openEquipmentCardMenu(event: MouseEvent, equipmentCard: CardInstanceDto, unitCard: CardInstanceDto): void {
    event.preventDefault();
    event.stopPropagation();
    this.equipmentMenuCardId.set(equipmentCard.instanceId);
    this.equipmentMenuUnitCard.set(unitCard);
    this.equipmentMenuX.set(event.clientX);
    this.equipmentMenuY.set(event.clientY);
  }

  closeEquipmentMenu(): void {
    this.equipmentMenuCardId.set(null);
    this.equipmentMenuUnitCard.set(null);
  }

  async discardEquipmentFromMenu(): Promise<void> {
    const equipCard = this.equipmentMenuCard();
    if (!equipCard) return;
    
    await this.gameHub.discardCard(equipCard.instanceId);
    this.notifications.success(`${equipCard.cardName} discarded`);
    this.closeEquipmentMenu();
  }

  async moveEquipmentToHandFromMenu(): Promise<void> {
    const equipCard = this.equipmentMenuCard();
    if (!equipCard) return;
    
    await this.gameHub.returnToHand(equipCard.instanceId);
    this.notifications.success(`${equipCard.cardName} returned to hand`);
    this.closeEquipmentMenu();
  }

  zoomEquipmentFromMenu(): void {
    const equipCard = this.equipmentMenuCard();
    if (equipCard) {
      this.zoomCard.set(equipCard);
    }
    this.closeEquipmentMenu();
  }

  zoomUnitFromEquipmentMenu(): void {
    const unitCard = this.equipmentMenuUnitCard();
    if (unitCard) {
      this.zoomCard.set(unitCard);
    }
    this.closeEquipmentMenu();
  }

  // Equipment modal methods

  openEquipmentModal(card: CardInstanceDto): void {
    this.equipmentModalCard.set(card);
    this.showEquipmentModal.set(true);
    this.closeCardMenu();
    this.closeHandCardMenu();
    this.closeBuildCardMenu();
  }

  closeEquipmentModal(): void {
    this.showEquipmentModal.set(false);
    this.equipmentModalCard.set(null);
  }

  async equipUnitFromModal(targetUnit: CardInstanceDto): Promise<void> {
    const equipCard = this.equipmentModalCard();
    if (!equipCard) return;
    
    const result = await this.gameHub.addEquipment(equipCard.instanceId, targetUnit.instanceId);
    if (result.success) {
      this.notifications.success(`${equipCard.cardName} equipped to ${targetUnit.cardName}`);
    } else if (result.errorMessage) {
      this.notifications.error(result.errorMessage);
    }
    this.closeEquipmentModal();
  }

  // Teammate hand modal methods
  openTeammateHandModal(username: string): void {
    this.showTeammateHandModal.set(username);
  }

  closeTeammateHandModal(): void {
    this.showTeammateHandModal.set(null);
  }

  // Equipment helpers

  // Check if a unit has equipment attached
  hasEquipment(card: CardInstanceDto): boolean {
    return card.equipmentCardId !== null && card.equipmentCardId !== undefined;
  }

  // Get equipment card attached to a unit (searches all arenas including opponent's)
  getEquipmentCard(card: CardInstanceDto): CardInstanceDto | null {
    if (!card.equipmentCardId) return null;
    
    // Get all cards from all arenas (mine, opponent team, and individual opponents)
    const allArenaCards = [
      ...this.getMyArenaCards('space'),
      ...this.getMyArenaCards('ground'),
      ...this.getMyArenaCards('character'),
      ...this.getOpponentTeamArenaCards('space'),
      ...this.getOpponentTeamArenaCards('ground'),
      ...this.getOpponentTeamArenaCards('character'),
      ...this.opponents().flatMap((o) => Object.values(o.arenas).flat()),
    ];
    
    return allArenaCards.find((c) => c.instanceId === card.equipmentCardId) ?? null;
  }

  // Check if a card is currently equipped to a unit
  isEquipped(card: CardInstanceDto): boolean {
    return card.equippedToUnitId !== null && card.equippedToUnitId !== undefined;
  }

  // Check if a card is equipment type
  isEquipmentCard(card: CardInstanceDto): boolean {
    return card.cardType === CARD_TYPE_EQUIPMENT;
  }

  // Get units that can be piloted by a pilot card (units in space/ground arenas with < 2 pilots)
  // Only returns top cards of stacks (not stacked cards)
  getPilotableTargets(): CardInstanceDto[] {
    const player = this.myPlayer();
    if (!player) return [];
    
    // Get all my units in space and ground arenas that have less than 2 pilots
    const spaceUnits = player.arenas['space'] || [];
    const groundUnits = player.arenas['ground'] || [];
    const allUnits = [...spaceUnits, ...groundUnits];
    
    return allUnits.filter((card: CardInstanceDto) =>
      card.cardType === CARD_TYPE_UNIT &&
      (card.pilotCardIds?.length ?? 0) < 2 &&
      !card.stackParentId // Only top cards of stacks (not stacked under another card)
    );
  }

  // Get units that can receive equipment (units with no equipment, respecting arena restrictions)
  // Only returns top cards of stacks (not stacked cards)
  getEquippableTargets(equipmentCard: CardInstanceDto): CardInstanceDto[] {
    // Get all my units in arenas that have no equipment and match arena restrictions
    let arenaUnits: CardInstanceDto[] = [];
    if (!equipmentCard.cardArena) {
      // Equipment has no designated arena restriction - can go on units in any arena
      arenaUnits = [
        ...this.getMyArenaCards('space'),
        ...this.getMyArenaCards('ground'),
        ...this.getMyArenaCards('character'),
      ];
    } else {
      // Equipment has designated arena restriction
      const arena = equipmentCard.cardArena.toLowerCase();
      arenaUnits = this.getMyArenaCards(arena);
    }
    
    return arenaUnits.filter((card: CardInstanceDto) =>
      card.cardType === CARD_TYPE_UNIT &&
      !card.equipmentCardId &&
      !card.stackParentId // Only top cards of stacks
    );
  }

  // Pilot/Equipment actions

  async addPilotToUnit(pilotCard: CardInstanceDto, targetUnit: CardInstanceDto): Promise<void> {
    const result = await this.gameHub.addPilot(pilotCard.instanceId, targetUnit.instanceId);
    if (!result.success && result.errorMessage) {
      this.notifications.error(result.errorMessage);
    }
  }

  async removePilotFromUnit(pilotCard: CardInstanceDto): Promise<void> {
    const result = await this.gameHub.removePilot(pilotCard.instanceId);
    if (!result.success && result.errorMessage) {
      this.notifications.error(result.errorMessage);
    }
  }

  async addEquipmentToUnit(equipmentCard: CardInstanceDto, targetUnit: CardInstanceDto): Promise<void> {
    const result = await this.gameHub.addEquipment(equipmentCard.instanceId, targetUnit.instanceId);
    if (!result.success && result.errorMessage) {
      this.notifications.error(result.errorMessage);
    }
  }

  async removeEquipmentFromUnit(equipmentCard: CardInstanceDto): Promise<void> {
    const result = await this.gameHub.removeEquipment(equipmentCard.instanceId);
    if (!result.success && result.errorMessage) {
      this.notifications.error(result.errorMessage);
    }
  }

  // Helper to find a card by ID across all player areas
  private findMyCard(cardId: string): CardInstanceDto | undefined {
    const player = this.myPlayer();
    if (!player) return undefined;
    
    // Check hand
    let card = player.hand.find((c: CardInstanceDto) => c.instanceId === cardId);
    if (card) return card;
    
    // Check all arenas
    for (const arenaCards of Object.values(player.arenas)) {
      card = arenaCards.find((c: CardInstanceDto) => c.instanceId === cardId);
      if (card) return card;
    }
    
    // Check build zone
    card = player.buildZone.find((c: CardInstanceDto) => c.instanceId === cardId);
    if (card) return card;
    
    // Check discard pile
    card = player.discardPile.find((c: CardInstanceDto) => c.instanceId === cardId);
    return card;
  }

  // Context menu handlers for pilot/equipment
  async attachPilotFromHandMenu(targetUnitId: string): Promise<void> {
    const pilotCard = this.handCardMenuCard();
    if (!pilotCard) return;
    
    const targetUnit = this.findMyCard(targetUnitId);
    if (!targetUnit) return;
    
    await this.addPilotToUnit(pilotCard, targetUnit);
    this.closeHandCardMenu();
  }

  async attachEquipmentFromHandMenu(targetUnitId: string): Promise<void> {
    const equipCard = this.handCardMenuCard();
    if (!equipCard) return;
    
    const targetUnit = this.findMyCard(targetUnitId);
    if (!targetUnit) return;
    
    await this.addEquipmentToUnit(equipCard, targetUnit);
    this.closeHandCardMenu();
  }

  // Remove pilot from card menu
  async detachPilotFromMenu(pilotCard: CardInstanceDto): Promise<void> {
    await this.removePilotFromUnit(pilotCard);
    this.closeCardMenu();
  }

  // Remove equipment from card menu
  async detachEquipmentFromMenu(): Promise<void> {
    const card = this.cardMenuCard();
    if (!card || !card.equipmentCardId) return;
    
    const equipCard = this.findMyCard(card.equipmentCardId);
    if (!equipCard) return;
    
    await this.removeEquipmentFromUnit(equipCard);
    this.closeCardMenu();
  }

  // Build zone context menu handlers for pilot/equipment
  async attachPilotFromBuildMenu(targetUnitId: string): Promise<void> {
    const pilotCard = this.buildCardMenuCard();
    if (!pilotCard) return;
    
    const targetUnit = this.findMyCard(targetUnitId);
    if (!targetUnit) return;
    
    await this.addPilotToUnit(pilotCard, targetUnit);
    this.closeBuildCardMenu();
  }

  async attachEquipmentFromBuildMenu(targetUnitId: string): Promise<void> {
    const equipCard = this.buildCardMenuCard();
    if (!equipCard) return;
    
    const targetUnit = this.findMyCard(targetUnitId);
    if (!targetUnit) return;
    
    await this.addEquipmentToUnit(equipCard, targetUnit);
    this.closeBuildCardMenu();
  }

  // Arena context menu handler for attaching pilot from Character arena
  async attachPilotFromArenaMenu(targetUnitId: string): Promise<void> {
    const pilotCard = this.cardMenuCard();
    if (!pilotCard) return;
    
    const targetUnit = this.findMyCard(targetUnitId);
    if (!targetUnit) return;
    
    await this.addPilotToUnit(pilotCard, targetUnit);
    this.closeCardMenu();
  }
}
