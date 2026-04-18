import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { GameRoomComponent } from './game-room.component';
import { GameHubService } from '../../services/game-hub.service';
import { NotificationService } from '../../services/notification.service';
import {
  CardInstanceDto,
  GamePlayerDto,
  GameRoomDto,
  GameState,
  RoomType,
  Team,
  TeamDataDto,
  ChatMessage,
  DiceRolledEvent,
} from '../../models/dtos/game.dto';
import { Alignment } from '../../models/dtos/card.dto';

// Card type constants matching the component
const CARD_TYPE_UNIT = 0;
const CARD_TYPE_EQUIPMENT = 2;
const CARD_TYPE_BATTLE = 4;

// --- Test Data Factories ---

function makeCard(overrides: Partial<CardInstanceDto> = {}): CardInstanceDto {
  return {
    instanceId: crypto.randomUUID(),
    cardId: 1,
    cardName: 'Test Card',
    cardImageUrl: null,
    cardType: CARD_TYPE_UNIT,
    cardArena: null,
    version: null,
    isTapped: false,
    isFaceDown: false,
    isRetreated: false,
    counter: null,
    damage: null,
    stackParentId: null,
    stackedUnderIds: [],
    ownerUserId: null,
    isPilot: false,
    pilotCardIds: [],
    pilotingUnitId: null,
    equipmentCardId: null,
    equippedToUnitId: null,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<GamePlayerDto> = {}): GamePlayerDto {
  return {
    username: 'player1',
    deckName: 'Test Deck',
    deckId: 1,
    alignment: Alignment.Light,
    team: Team.Team1,
    isHost: false,
    isConnected: true,
    force: 4,
    buildCounter: 60,
    hand: [],
    handSize: 0,
    deckSize: 30,
    arenas: { space: [], ground: [], character: [] },
    discardPile: [],
    buildZone: [],
    spaceArenaRetreated: false,
    groundArenaRetreated: false,
    characterArenaRetreated: false,
    secretBid: null,
    hasConfirmedRestartDeck: false,
    showHandToOpponents: false,
    ...overrides,
  };
}

function makeTeamData(overrides: Partial<TeamDataDto> = {}): TeamDataDto {
  return {
    team: Team.Team1,
    force: 8,
    buildCounter: 120,
    arenas: { space: [], ground: [], character: [] },
    buildZone: [],
    spaceArenaRetreated: false,
    groundArenaRetreated: false,
    characterArenaRetreated: false,
    secretBid: null,
    ...overrides,
  };
}

function makeRoom(overrides: Partial<GameRoomDto> = {}): GameRoomDto {
  return {
    roomCode: 'TESTROOM',
    roomType: RoomType.OneVOne,
    state: GameState.InProgress,
    players: [],
    teams: null,
    bidsRevealed: false,
    isRestarting: false,
    ...overrides,
  };
}

// --- Test Suite ---

describe('GameRoomComponent', () => {
  let component: GameRoomComponent;
  let mockGameHub: {
    currentUser: string | null;
    isConnected: { (): boolean };
    connectionError: { (): string | null };
    roomUpdated$: Subject<GameRoomDto>;
    diceRolled$: Subject<DiceRolledEvent>;
    kicked$: Subject<string>;
    error$: Subject<string>;
    chatMessage$: Subject<ChatMessage>;
    connect: ReturnType<typeof vi.fn>;
    reconnect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    [key: string]: unknown;
  };

  beforeEach(async () => {
    mockGameHub = {
      currentUser: 'player1',
      isConnected: () => true,
      connectionError: () => null,
      roomUpdated$: new Subject<GameRoomDto>(),
      diceRolled$: new Subject<DiceRolledEvent>(),
      kicked$: new Subject<string>(),
      error$: new Subject<string>(),
      chatMessage$: new Subject<ChatMessage>(),
      connect: vi.fn().mockResolvedValue(undefined),
      reconnect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [GameRoomComponent],
      providers: [
        { provide: GameHubService, useValue: mockGameHub },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'TESTROOM' } },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(GameRoomComponent);
    component = fixture.componentInstance;
  });

  // Helper to set room state on the component
  function setRoom(room: GameRoomDto): void {
    component.room.set(room);
  }

  // ---------- Computed Signals ----------

  describe('Computed Signals', () => {
    it('myPlayer returns the current user player', () => {
      const me = makePlayer({ username: 'player1' });
      setRoom(makeRoom({ players: [me, makePlayer({ username: 'player2' })] }));

      expect(component.myPlayer()?.username).toBe('player1');
    });

    it('myPlayer returns null when room is null', () => {
      expect(component.myPlayer()).toBeNull();
    });

    it('opponents returns all non-current-user players', () => {
      const p1 = makePlayer({ username: 'player1' });
      const p2 = makePlayer({ username: 'player2' });
      const p3 = makePlayer({ username: 'player3' });
      setRoom(makeRoom({ players: [p1, p2, p3] }));

      const opponents = component.opponents();
      expect(opponents).toHaveLength(2);
      expect(opponents.map((o) => o.username)).toEqual(['player2', 'player3']);
    });

    it('isHost returns true when current user is host', () => {
      setRoom(makeRoom({ players: [makePlayer({ username: 'player1', isHost: true })] }));
      expect(component.isHost()).toBe(true);
    });

    it('isHost returns false when current user is not host', () => {
      setRoom(makeRoom({ players: [makePlayer({ username: 'player1', isHost: false })] }));
      expect(component.isHost()).toBe(false);
    });

    it('myHandSorted places units before non-units', () => {
      const unit1 = makeCard({ cardType: CARD_TYPE_UNIT, cardName: 'Unit1' });
      const equip = makeCard({ cardType: CARD_TYPE_EQUIPMENT, cardName: 'Equip' });
      const unit2 = makeCard({ cardType: CARD_TYPE_UNIT, cardName: 'Unit2' });
      const battle = makeCard({ cardType: CARD_TYPE_BATTLE, cardName: 'Battle' });

      setRoom(
        makeRoom({
          players: [makePlayer({ username: 'player1', hand: [equip, unit1, battle, unit2] })],
        }),
      );

      const sorted = component.myHandSorted();
      expect(sorted[0].cardName).toBe('Unit1');
      expect(sorted[1].cardName).toBe('Unit2');
      expect(sorted[2].cardName).toBe('Equip');
      expect(sorted[3].cardName).toBe('Battle');
    });

    it('myDeckSize returns player deck size', () => {
      setRoom(makeRoom({ players: [makePlayer({ username: 'player1', deckSize: 25 })] }));
      expect(component.myDeckSize()).toBe(25);
    });

    it('myDiscard returns player discard pile', () => {
      const card = makeCard();
      setRoom(makeRoom({ players: [makePlayer({ username: 'player1', discardPile: [card] })] }));
      expect(component.myDiscard()).toHaveLength(1);
    });
  });

  // ---------- Team Mode vs 1v1 Mode ----------

  describe('Team Mode vs 1v1 Mode', () => {
    it('isTeamMode returns false for 1v1', () => {
      setRoom(makeRoom({ roomType: RoomType.OneVOne }));
      expect(component.isTeamMode()).toBe(false);
    });

    it('isTeamMode returns true for 2v2', () => {
      setRoom(makeRoom({ roomType: RoomType.TwoVTwo }));
      expect(component.isTeamMode()).toBe(true);
    });

    it('isTeamMode returns true for 1v2', () => {
      setRoom(makeRoom({ roomType: RoomType.OneVTwo }));
      expect(component.isTeamMode()).toBe(true);
    });

    it('myTeam returns the team matching current player', () => {
      const team1 = makeTeamData({ team: Team.Team1 });
      const team2 = makeTeamData({ team: Team.Team2 });
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1 })],
          teams: [team1, team2],
        }),
      );

      expect(component.myTeam()?.team).toBe(Team.Team1);
    });

    it('opponentTeam returns the other team', () => {
      const team1 = makeTeamData({ team: Team.Team1 });
      const team2 = makeTeamData({ team: Team.Team2, force: 10 });
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1 })],
          teams: [team1, team2],
        }),
      );

      expect(component.opponentTeam()?.team).toBe(Team.Team2);
      expect(component.opponentTeam()?.force).toBe(10);
    });

    it('myTeamForce uses team force in team mode', () => {
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1, force: 4 })],
          teams: [makeTeamData({ team: Team.Team1, force: 12 })],
        }),
      );

      expect(component.myTeamForce()).toBe(12);
    });

    it('myTeamForce uses player force in 1v1 mode', () => {
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [makePlayer({ username: 'player1', force: 6 })],
        }),
      );

      expect(component.myTeamForce()).toBe(6);
    });

    it('myTeamBuildCounter uses team counter in team mode', () => {
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1, buildCounter: 60 })],
          teams: [makeTeamData({ team: Team.Team1, buildCounter: 200 })],
        }),
      );

      expect(component.myTeamBuildCounter()).toBe(200);
    });

    it('myBuildZone uses team build zone in team mode', () => {
      const card = makeCard();
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1, buildZone: [] })],
          teams: [makeTeamData({ team: Team.Team1, buildZone: [card] })],
        }),
      );

      expect(component.myBuildZone()).toHaveLength(1);
    });

    it('myBuildZone uses player build zone in 1v1 mode', () => {
      const card = makeCard();
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [makePlayer({ username: 'player1', buildZone: [card] })],
        }),
      );

      expect(component.myBuildZone()).toHaveLength(1);
    });

    it('teammates returns players on same team excluding self', () => {
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [
            makePlayer({ username: 'player1', team: Team.Team1 }),
            makePlayer({ username: 'player2', team: Team.Team1 }),
            makePlayer({ username: 'player3', team: Team.Team2 }),
          ],
          teams: [makeTeamData({ team: Team.Team1 }), makeTeamData({ team: Team.Team2 })],
        }),
      );

      expect(component.teammates()).toHaveLength(1);
      expect(component.teammates()[0].username).toBe('player2');
    });

    it('opponentTeamPlayers returns players on opposite team', () => {
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [
            makePlayer({ username: 'player1', team: Team.Team1 }),
            makePlayer({ username: 'player3', team: Team.Team2 }),
            makePlayer({ username: 'player4', team: Team.Team2 }),
          ],
          teams: [makeTeamData({ team: Team.Team1 }), makeTeamData({ team: Team.Team2 })],
        }),
      );

      const opp = component.opponentTeamPlayers();
      expect(opp).toHaveLength(2);
      expect(opp.map((p) => p.username)).toEqual(['player3', 'player4']);
    });
  });

  // ---------- Arena Card Filtering ----------

  describe('Arena Card Filtering', () => {
    describe('Player arena methods (1v1 opponent)', () => {
      it('getPlayerArenaUnits returns only top-level units', () => {
        const unit = makeCard({ cardType: CARD_TYPE_UNIT });
        const stackedUnit = makeCard({ cardType: CARD_TYPE_UNIT, stackParentId: 'parent' });
        const equip = makeCard({ cardType: CARD_TYPE_EQUIPMENT });
        const player = makePlayer({ arenas: { ground: [unit, stackedUnit, equip], space: [], character: [] } });

        const units = component.getPlayerArenaUnits(player, 'ground');
        expect(units).toHaveLength(1);
        expect(units[0].instanceId).toBe(unit.instanceId);
      });

      it('getPlayerArenaUnits excludes piloting cards', () => {
        const unit = makeCard({ cardType: CARD_TYPE_UNIT });
        const piloting = makeCard({ cardType: CARD_TYPE_UNIT, pilotingUnitId: 'some-unit' });
        const player = makePlayer({ arenas: { ground: [unit, piloting], space: [], character: [] } });

        const units = component.getPlayerArenaUnits(player, 'ground');
        expect(units).toHaveLength(1);
        expect(units[0].instanceId).toBe(unit.instanceId);
      });

      it('getPlayerArenaOthers returns non-unit cards', () => {
        const unit = makeCard({ cardType: CARD_TYPE_UNIT });
        const equip = makeCard({ cardType: CARD_TYPE_EQUIPMENT });
        const battle = makeCard({ cardType: CARD_TYPE_BATTLE });
        const player = makePlayer({ arenas: { ground: [unit, equip, battle], space: [], character: [] } });

        const others = component.getPlayerArenaOthers(player, 'ground');
        expect(others).toHaveLength(2);
      });

      it('getPlayerArenaOthers excludes equipped equipment cards', () => {
        const equip = makeCard({ cardType: CARD_TYPE_EQUIPMENT, equippedToUnitId: 'some-unit' });
        const freeEquip = makeCard({ cardType: CARD_TYPE_EQUIPMENT });
        const player = makePlayer({ arenas: { ground: [equip, freeEquip], space: [], character: [] } });

        const others = component.getPlayerArenaOthers(player, 'ground');
        expect(others).toHaveLength(1);
        expect(others[0].instanceId).toBe(freeEquip.instanceId);
      });

      it('getStackedCards returns stacked cards under a unit', () => {
        const stacked1 = makeCard({ instanceId: 'stacked-1' });
        const stacked2 = makeCard({ instanceId: 'stacked-2' });
        const topCard = makeCard({ stackedUnderIds: ['stacked-1', 'stacked-2'] });
        const player = makePlayer({ arenas: { ground: [topCard, stacked1, stacked2], space: [], character: [] } });

        const stacked = component.getStackedCards(player, topCard);
        expect(stacked).toHaveLength(2);
      });

      it('getStackedCards returns empty for card with no stack', () => {
        const card = makeCard({ stackedUnderIds: [] });
        const player = makePlayer({ arenas: { ground: [card], space: [], character: [] } });

        expect(component.getStackedCards(player, card)).toHaveLength(0);
      });
    });

    describe('My arena methods', () => {
      it('myArenaUnits returns my units in 1v1 mode', () => {
        const unit = makeCard({ cardType: CARD_TYPE_UNIT });
        const equip = makeCard({ cardType: CARD_TYPE_EQUIPMENT });
        setRoom(
          makeRoom({
            roomType: RoomType.OneVOne,
            players: [makePlayer({ username: 'player1', arenas: { space: [unit, equip], ground: [], character: [] } })],
          }),
        );

        expect(component.myArenaUnits('space')).toHaveLength(1);
      });

      it('myArenaUnits returns team arena units in team mode', () => {
        const unit = makeCard({ cardType: CARD_TYPE_UNIT });
        setRoom(
          makeRoom({
            roomType: RoomType.TwoVTwo,
            players: [makePlayer({ username: 'player1', team: Team.Team1 })],
            teams: [makeTeamData({ team: Team.Team1, arenas: { space: [unit], ground: [], character: [] } })],
          }),
        );

        expect(component.myArenaUnits('space')).toHaveLength(1);
      });

      it('myArenaOthers excludes equipped equipment cards', () => {
        const equipped = makeCard({ cardType: CARD_TYPE_EQUIPMENT, equippedToUnitId: 'unit-1' });
        const battle = makeCard({ cardType: CARD_TYPE_BATTLE });
        setRoom(
          makeRoom({
            roomType: RoomType.OneVOne,
            players: [
              makePlayer({
                username: 'player1',
                arenas: { ground: [equipped, battle], space: [], character: [] },
              }),
            ],
          }),
        );

        const others = component.myArenaOthers('ground');
        expect(others).toHaveLength(1);
        expect(others[0].cardType).toBe(CARD_TYPE_BATTLE);
      });

      it('myArenaUnitsOrdered respects custom ordering', () => {
        const unit1 = makeCard({ instanceId: 'u1', cardType: CARD_TYPE_UNIT, cardName: 'First' });
        const unit2 = makeCard({ instanceId: 'u2', cardType: CARD_TYPE_UNIT, cardName: 'Second' });
        setRoom(
          makeRoom({
            roomType: RoomType.OneVOne,
            players: [
              makePlayer({
                username: 'player1',
                arenas: { ground: [unit1, unit2], space: [], character: [] },
              }),
            ],
          }),
        );

        // Set custom order: unit2 before unit1
        component.arenaCardOrder.set({ ground: ['u2', 'u1'], space: [], character: [] });

        const ordered = component.myArenaUnitsOrdered('ground');
        expect(ordered[0].instanceId).toBe('u2');
        expect(ordered[1].instanceId).toBe('u1');
      });
    });

    describe('Opponent team arena methods', () => {
      it('getOpponentTeamArenaUnits returns units from opponent team', () => {
        const unit = makeCard({ cardType: CARD_TYPE_UNIT });
        const equip = makeCard({ cardType: CARD_TYPE_EQUIPMENT });
        setRoom(
          makeRoom({
            roomType: RoomType.TwoVTwo,
            players: [makePlayer({ username: 'player1', team: Team.Team1 })],
            teams: [
              makeTeamData({ team: Team.Team1 }),
              makeTeamData({ team: Team.Team2, arenas: { ground: [unit, equip], space: [], character: [] } }),
            ],
          }),
        );

        expect(component.getOpponentTeamArenaUnits('ground')).toHaveLength(1);
      });

      it('getOpponentTeamArenaOthers excludes equipped cards', () => {
        const equipped = makeCard({ cardType: CARD_TYPE_EQUIPMENT, equippedToUnitId: 'u1' });
        const free = makeCard({ cardType: CARD_TYPE_EQUIPMENT });
        setRoom(
          makeRoom({
            roomType: RoomType.TwoVTwo,
            players: [makePlayer({ username: 'player1', team: Team.Team1 })],
            teams: [
              makeTeamData({ team: Team.Team1 }),
              makeTeamData({ team: Team.Team2, arenas: { ground: [equipped, free], space: [], character: [] } }),
            ],
          }),
        );

        const others = component.getOpponentTeamArenaOthers('ground');
        expect(others).toHaveLength(1);
        expect(others[0].instanceId).toBe(free.instanceId);
      });

      it('getOpponentTeamStackedCards returns stacked cards', () => {
        const stacked = makeCard({ instanceId: 'stacked-1' });
        const top = makeCard({ cardType: CARD_TYPE_UNIT, stackedUnderIds: ['stacked-1'] });
        setRoom(
          makeRoom({
            roomType: RoomType.TwoVTwo,
            players: [makePlayer({ username: 'player1', team: Team.Team1 })],
            teams: [
              makeTeamData({ team: Team.Team1 }),
              makeTeamData({ team: Team.Team2, arenas: { ground: [top, stacked], space: [], character: [] } }),
            ],
          }),
        );

        expect(component.getOpponentTeamStackedCards(top)).toHaveLength(1);
      });
    });
  });

  // ---------- Equipment Logic ----------

  describe('Equipment Logic', () => {
    it('hasEquipment returns true when unit has equipmentCardId', () => {
      const card = makeCard({ equipmentCardId: 'equip-1' });
      expect(component.hasEquipment(card)).toBe(true);
    });

    it('hasEquipment returns false when equipmentCardId is null', () => {
      const card = makeCard({ equipmentCardId: null });
      expect(component.hasEquipment(card)).toBe(false);
    });

    it('isEquipped returns true when card has equippedToUnitId', () => {
      const card = makeCard({ equippedToUnitId: 'unit-1' });
      expect(component.isEquipped(card)).toBe(true);
    });

    it('isEquipped returns false when equippedToUnitId is null', () => {
      const card = makeCard({ equippedToUnitId: null });
      expect(component.isEquipped(card)).toBe(false);
    });

    it('isEquipmentCard returns true for equipment type', () => {
      expect(component.isEquipmentCard(makeCard({ cardType: CARD_TYPE_EQUIPMENT }))).toBe(true);
    });

    it('isEquipmentCard returns false for unit type', () => {
      expect(component.isEquipmentCard(makeCard({ cardType: CARD_TYPE_UNIT }))).toBe(false);
    });

    it('getEquipmentCard finds equipment in own arenas (1v1)', () => {
      const equipCard = makeCard({ instanceId: 'equip-1', cardType: CARD_TYPE_EQUIPMENT });
      const unit = makeCard({ cardType: CARD_TYPE_UNIT, equipmentCardId: 'equip-1' });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              arenas: { ground: [unit, equipCard], space: [], character: [] },
            }),
          ],
        }),
      );

      const found = component.getEquipmentCard(unit);
      expect(found).not.toBeNull();
      expect(found!.instanceId).toBe('equip-1');
    });

    it('getEquipmentCard finds equipment in 1v1 opponent arenas', () => {
      const equipCard = makeCard({ instanceId: 'equip-1', cardType: CARD_TYPE_EQUIPMENT });
      const unit = makeCard({ cardType: CARD_TYPE_UNIT, equipmentCardId: 'equip-1' });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({ username: 'player1', arenas: { space: [], ground: [], character: [] } }),
            makePlayer({
              username: 'player2',
              arenas: { ground: [unit, equipCard], space: [], character: [] },
            }),
          ],
        }),
      );

      const found = component.getEquipmentCard(unit);
      expect(found).not.toBeNull();
      expect(found!.instanceId).toBe('equip-1');
    });

    it('getEquipmentCard finds equipment in opponent team arenas (team mode)', () => {
      const equipCard = makeCard({ instanceId: 'equip-1', cardType: CARD_TYPE_EQUIPMENT });
      const unit = makeCard({ cardType: CARD_TYPE_UNIT, equipmentCardId: 'equip-1' });
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1 })],
          teams: [
            makeTeamData({ team: Team.Team1 }),
            makeTeamData({ team: Team.Team2, arenas: { ground: [unit, equipCard], space: [], character: [] } }),
          ],
        }),
      );

      const found = component.getEquipmentCard(unit);
      expect(found).not.toBeNull();
      expect(found!.instanceId).toBe('equip-1');
    });

    it('getEquipmentCard returns null when no equipment attached', () => {
      const unit = makeCard({ equipmentCardId: null });
      expect(component.getEquipmentCard(unit)).toBeNull();
    });

    it('getEquippableTargets returns units without equipment', () => {
      const unitFree = makeCard({ instanceId: 'u1', cardType: CARD_TYPE_UNIT });
      const unitEquipped = makeCard({ instanceId: 'u2', cardType: CARD_TYPE_UNIT, equipmentCardId: 'e1' });
      const equipCard = makeCard({ cardType: CARD_TYPE_EQUIPMENT, cardArena: null });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              arenas: { ground: [unitFree, unitEquipped], space: [], character: [] },
            }),
          ],
        }),
      );

      const targets = component.getEquippableTargets(equipCard);
      expect(targets).toHaveLength(1);
      expect(targets[0].instanceId).toBe('u1');
    });

    it('getEquippableTargets respects arena restriction', () => {
      const spaceUnit = makeCard({ instanceId: 'su', cardType: CARD_TYPE_UNIT });
      const groundUnit = makeCard({ instanceId: 'gu', cardType: CARD_TYPE_UNIT });
      const equipCard = makeCard({ cardType: CARD_TYPE_EQUIPMENT, cardArena: 'Ground' });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              arenas: { space: [spaceUnit], ground: [groundUnit], character: [] },
            }),
          ],
        }),
      );

      const targets = component.getEquippableTargets(equipCard);
      expect(targets).toHaveLength(1);
      expect(targets[0].instanceId).toBe('gu');
    });

    it('getEquippableTargets excludes stacked cards', () => {
      const topUnit = makeCard({ instanceId: 'top', cardType: CARD_TYPE_UNIT });
      const stackedUnit = makeCard({ instanceId: 'stacked', cardType: CARD_TYPE_UNIT, stackParentId: 'top' });
      const equipCard = makeCard({ cardType: CARD_TYPE_EQUIPMENT, cardArena: null });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              arenas: { ground: [topUnit, stackedUnit], space: [], character: [] },
            }),
          ],
        }),
      );

      const targets = component.getEquippableTargets(equipCard);
      expect(targets).toHaveLength(1);
      expect(targets[0].instanceId).toBe('top');
    });
  });

  // ---------- Pilot Logic ----------

  describe('Pilot Logic', () => {
    it('isPilot returns true when card.isPilot is true', () => {
      expect(component.isPilot(makeCard({ isPilot: true }))).toBe(true);
    });

    it('isPilot returns false when card.isPilot is false', () => {
      expect(component.isPilot(makeCard({ isPilot: false }))).toBe(false);
    });

    it('hasPilots returns true when unit has pilotCardIds', () => {
      expect(component.hasPilots(makeCard({ pilotCardIds: ['p1'] }))).toBe(true);
    });

    it('hasPilots returns false when pilotCardIds is empty', () => {
      expect(component.hasPilots(makeCard({ pilotCardIds: [] }))).toBe(false);
    });

    it('isPiloting returns true when card has pilotingUnitId', () => {
      expect(component.isPiloting(makeCard({ pilotingUnitId: 'unit-1' }))).toBe(true);
    });

    it('isPiloting returns false when pilotingUnitId is null', () => {
      expect(component.isPiloting(makeCard({ pilotingUnitId: null }))).toBe(false);
    });

    it('getPilotCards finds pilots in own arenas (1v1)', () => {
      const pilotCard = makeCard({ instanceId: 'pilot-1', cardType: CARD_TYPE_UNIT, pilotingUnitId: 'unit-1' });
      const unit = makeCard({ instanceId: 'unit-1', cardType: CARD_TYPE_UNIT, pilotCardIds: ['pilot-1'] });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              arenas: { character: [pilotCard], ground: [unit], space: [] },
            }),
          ],
        }),
      );

      const pilots = component.getPilotCards(unit);
      expect(pilots).toHaveLength(1);
      expect(pilots[0].instanceId).toBe('pilot-1');
    });

    it('getPilotCards finds pilots in 1v1 opponent arenas', () => {
      const pilotCard = makeCard({ instanceId: 'pilot-1', cardType: CARD_TYPE_UNIT, pilotingUnitId: 'unit-1' });
      const unit = makeCard({ instanceId: 'unit-1', cardType: CARD_TYPE_UNIT, pilotCardIds: ['pilot-1'] });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({ username: 'player1', arenas: { space: [], ground: [], character: [] } }),
            makePlayer({
              username: 'player2',
              arenas: { character: [pilotCard], ground: [unit], space: [] },
            }),
          ],
        }),
      );

      const pilots = component.getPilotCards(unit);
      expect(pilots).toHaveLength(1);
      expect(pilots[0].instanceId).toBe('pilot-1');
    });

    it('getPilotCards returns empty when no pilots', () => {
      const unit = makeCard({ pilotCardIds: [] });
      expect(component.getPilotCards(unit)).toHaveLength(0);
    });

    it('getPilotableTargets returns space/ground units with <2 pilots', () => {
      const spaceUnit = makeCard({ instanceId: 's1', cardType: CARD_TYPE_UNIT, pilotCardIds: ['p1'] });
      const groundUnit = makeCard({ instanceId: 'g1', cardType: CARD_TYPE_UNIT, pilotCardIds: [] });
      const fullUnit = makeCard({ instanceId: 'g2', cardType: CARD_TYPE_UNIT, pilotCardIds: ['p1', 'p2'] });
      const charUnit = makeCard({ instanceId: 'c1', cardType: CARD_TYPE_UNIT, pilotCardIds: [] });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              arenas: { space: [spaceUnit], ground: [groundUnit, fullUnit], character: [charUnit] },
            }),
          ],
        }),
      );

      const targets = component.getPilotableTargets();
      // spaceUnit (1 pilot, <2) ✓, groundUnit (0 pilots) ✓, fullUnit (2 pilots) ✗, charUnit (character arena) ✗
      expect(targets).toHaveLength(2);
      expect(targets.map((t) => t.instanceId)).toContain('s1');
      expect(targets.map((t) => t.instanceId)).toContain('g1');
    });
  });

  // ---------- Stack Logic ----------

  describe('Stack Logic', () => {
    it('hasStack returns true when card has stackedUnderIds', () => {
      expect(component.hasStack(makeCard({ stackedUnderIds: ['a', 'b'] }))).toBe(true);
    });

    it('hasStack returns false when stackedUnderIds is empty', () => {
      expect(component.hasStack(makeCard({ stackedUnderIds: [] }))).toBe(false);
    });

    it('getStackSize returns count + 1 for top card', () => {
      expect(component.getStackSize(makeCard({ stackedUnderIds: ['a', 'b'] }))).toBe(3);
    });

    it('getStackSize returns 1 for single card', () => {
      expect(component.getStackSize(makeCard({ stackedUnderIds: [] }))).toBe(1);
    });

    it('getMyStackedCards retrieves stacked cards in 1v1 mode', () => {
      const stacked = makeCard({ instanceId: 'stacked-1' });
      const top = makeCard({ stackedUnderIds: ['stacked-1'] });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              arenas: { ground: [top, stacked], space: [], character: [] },
            }),
          ],
        }),
      );

      expect(component.getMyStackedCards(top)).toHaveLength(1);
    });

    it('getMyStackedCards retrieves stacked cards in team mode', () => {
      const stacked = makeCard({ instanceId: 'stacked-1' });
      const top = makeCard({ stackedUnderIds: ['stacked-1'] });
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1 })],
          teams: [
            makeTeamData({ team: Team.Team1, arenas: { ground: [top, stacked], space: [], character: [] } }),
          ],
        }),
      );

      expect(component.getMyStackedCards(top)).toHaveLength(1);
    });
  });

  // ---------- Card Ownership ----------

  describe('Card Ownership', () => {
    it('isCardOwner returns true in 1v1 mode regardless of ownerUserId', () => {
      setRoom(makeRoom({ roomType: RoomType.OneVOne, players: [makePlayer({ username: 'player1' })] }));
      const card = makeCard({ ownerUserId: 'someone-else' });
      expect(component.isCardOwner(card)).toBe(true);
    });

    it('isCardOwner checks ownerUserId in team mode', () => {
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1 })],
          teams: [makeTeamData({ team: Team.Team1 })],
        }),
      );

      expect(component.isCardOwner(makeCard({ ownerUserId: 'player1' }))).toBe(true);
      expect(component.isCardOwner(makeCard({ ownerUserId: 'player2' }))).toBe(false);
    });

    it('canActOnCard delegates to isCardOwner', () => {
      setRoom(makeRoom({ roomType: RoomType.OneVOne, players: [makePlayer({ username: 'player1' })] }));
      expect(component.canActOnCard(makeCard())).toBe(true);
    });

    it('getCardOwnerDisplay returns null in 1v1 mode', () => {
      setRoom(makeRoom({ roomType: RoomType.OneVOne, players: [makePlayer({ username: 'player1' })] }));
      expect(component.getCardOwnerDisplay(makeCard({ ownerUserId: 'player1' }))).toBeNull();
    });

    it('getCardOwnerDisplay returns username in team mode', () => {
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1 })],
          teams: [makeTeamData({ team: Team.Team1 })],
        }),
      );

      expect(component.getCardOwnerDisplay(makeCard({ ownerUserId: 'player1' }))).toBe('player1');
    });
  });

  // ---------- Arena Retreat ----------

  describe('Arena Retreat', () => {
    it('isArenaRetreated returns correct value per arena', () => {
      const player = makePlayer({ spaceArenaRetreated: true, groundArenaRetreated: false, characterArenaRetreated: true });
      expect(component.isArenaRetreated(player, 'space')).toBe(true);
      expect(component.isArenaRetreated(player, 'ground')).toBe(false);
      expect(component.isArenaRetreated(player, 'character')).toBe(true);
    });

    it('isArenaRetreated returns false for unknown arena', () => {
      const player = makePlayer();
      expect(component.isArenaRetreated(player, 'unknown')).toBe(false);
    });

    it('isMyArenaRetreated checks team retreat in team mode', () => {
      setRoom(
        makeRoom({
          roomType: RoomType.TwoVTwo,
          players: [makePlayer({ username: 'player1', team: Team.Team1, groundArenaRetreated: false })],
          teams: [makeTeamData({ team: Team.Team1, groundArenaRetreated: true })],
        }),
      );

      expect(component.isMyArenaRetreated('ground')).toBe(true);
    });

    it('isMyArenaRetreated checks player retreat in 1v1 mode', () => {
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [makePlayer({ username: 'player1', groundArenaRetreated: true })],
        }),
      );

      expect(component.isMyArenaRetreated('ground')).toBe(true);
    });

    it('myArenaActiveUnits returns empty when arena is retreated', () => {
      const unit = makeCard({ cardType: CARD_TYPE_UNIT });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              groundArenaRetreated: true,
              arenas: { ground: [unit], space: [], character: [] },
            }),
          ],
        }),
      );

      expect(component.myArenaActiveUnits('ground')).toHaveLength(0);
    });

    it('myArenaActiveUnits returns units when arena is not retreated', () => {
      const unit = makeCard({ cardType: CARD_TYPE_UNIT });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              groundArenaRetreated: false,
              arenas: { ground: [unit], space: [], character: [] },
            }),
          ],
        }),
      );

      expect(component.myArenaActiveUnits('ground')).toHaveLength(1);
    });

    it('myArenaRetreatedCards returns all cards when retreated', () => {
      const unit = makeCard({ cardType: CARD_TYPE_UNIT });
      const equip = makeCard({ cardType: CARD_TYPE_EQUIPMENT });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              spaceArenaRetreated: true,
              arenas: { space: [unit, equip], ground: [], character: [] },
            }),
          ],
        }),
      );

      expect(component.myArenaRetreatedCards('space')).toHaveLength(2);
    });

    it('myArenaRetreatedCards returns empty when not retreated', () => {
      const unit = makeCard({ cardType: CARD_TYPE_UNIT });
      setRoom(
        makeRoom({
          roomType: RoomType.OneVOne,
          players: [
            makePlayer({
              username: 'player1',
              spaceArenaRetreated: false,
              arenas: { space: [unit], ground: [], character: [] },
            }),
          ],
        }),
      );

      expect(component.myArenaRetreatedCards('space')).toHaveLength(0);
    });

    it('getPlayerArenaActiveUnits returns empty when opponent arena retreated', () => {
      const unit = makeCard({ cardType: CARD_TYPE_UNIT });
      const player = makePlayer({ groundArenaRetreated: true, arenas: { ground: [unit], space: [], character: [] } });

      expect(component.getPlayerArenaActiveUnits(player, 'ground')).toHaveLength(0);
    });

    it('getPlayerArenaActiveOthers returns empty when opponent arena retreated', () => {
      const equip = makeCard({ cardType: CARD_TYPE_EQUIPMENT });
      const player = makePlayer({ groundArenaRetreated: true, arenas: { ground: [equip], space: [], character: [] } });

      expect(component.getPlayerArenaActiveOthers(player, 'ground')).toHaveLength(0);
    });
  });

  // ---------- Utility ----------

  describe('Utility Methods', () => {
    it('getPlayerCardCount returns hand + deck', () => {
      const player = makePlayer({ hand: [makeCard(), makeCard()], deckSize: 28 });
      expect(component.getPlayerCardCount(player)).toBe(30);
    });
  });

  // ---------- Opponent Hand Sharing ----------

  describe('Opponent Hand Sharing', () => {
    it('myShowHandToOpponents returns false by default', () => {
      setRoom(
        makeRoom({
          players: [makePlayer({ username: 'player1', showHandToOpponents: false })],
        }),
      );
      expect(component.myShowHandToOpponents()).toBe(false);
    });

    it('myShowHandToOpponents returns true when enabled', () => {
      setRoom(
        makeRoom({
          players: [makePlayer({ username: 'player1', showHandToOpponents: true })],
        }),
      );
      expect(component.myShowHandToOpponents()).toBe(true);
    });

    it('opponentsWhoShareHand returns only opponents with sharing enabled', () => {
      setRoom(
        makeRoom({
          players: [
            makePlayer({ username: 'player1' }),
            makePlayer({ username: 'opponent1', showHandToOpponents: true }),
            makePlayer({ username: 'opponent2', showHandToOpponents: false }),
            makePlayer({ username: 'opponent3', showHandToOpponents: true }),
          ],
        }),
      );
      const sharing = component.opponentsWhoShareHand();
      expect(sharing).toHaveLength(2);
      expect(sharing.map((p) => p.username)).toEqual(['opponent1', 'opponent3']);
    });

    it('opponentsWhoShareHand returns empty when no opponents share', () => {
      setRoom(
        makeRoom({
          players: [
            makePlayer({ username: 'player1' }),
            makePlayer({ username: 'opponent1', showHandToOpponents: false }),
          ],
        }),
      );
      expect(component.opponentsWhoShareHand()).toHaveLength(0);
    });

    it('opponentHandPlayer returns the opponent matching modal username', () => {
      const opponent = makePlayer({ username: 'opponent1', showHandToOpponents: true });
      setRoom(
        makeRoom({
          players: [makePlayer({ username: 'player1' }), opponent],
        }),
      );
      component.openOpponentHandModal('opponent1');
      expect(component.opponentHandPlayer()?.username).toBe('opponent1');
    });

    it('opponentHandPlayer returns null when modal not open', () => {
      setRoom(
        makeRoom({
          players: [
            makePlayer({ username: 'player1' }),
            makePlayer({ username: 'opponent1' }),
          ],
        }),
      );
      expect(component.opponentHandPlayer()).toBeNull();
    });

    it('closeOpponentHandModal clears the modal state', () => {
      setRoom(
        makeRoom({
          players: [
            makePlayer({ username: 'player1' }),
            makePlayer({ username: 'opponent1', showHandToOpponents: true }),
          ],
        }),
      );
      component.openOpponentHandModal('opponent1');
      expect(component.showOpponentHandModal()).toBe('opponent1');
      component.closeOpponentHandModal();
      expect(component.showOpponentHandModal()).toBeNull();
    });
  });
});
