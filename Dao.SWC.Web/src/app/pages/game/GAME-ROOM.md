# Game Room Component Documentation

> **⚠️ MAINTENANCE NOTICE:** This document describes the `game-room` component in detail. **Agents and developers: keep this file updated whenever you modify the component.** If you add, remove, or change signals, methods, template sections, or CSS patterns, update the corresponding section below so this remains accurate for future edits.
>
> **🧪 TESTING NOTICE:** After making changes to the game room component, **always run `cd Dao.SWC.Web && npx ng test` and verify all tests pass.** If you add new logic methods, add corresponding unit tests in `game-room.component.spec.ts`. If you change existing method behavior, update the affected tests.

---

## Overview

The `GameRoomComponent` is the main game UI for Dao.SWC. It renders the full game board including player/opponent arenas, hand, build zone, discard pile, chat, bidding, and all card interactions (drag/drop, context menus, tap, stack, pilot, equip).

**Files:**
- `game-room.component.ts` — Logic, signals, methods
- `game-room.component.html` — Template
- `game-room.component.scss` — Styles

---

## Constants

| Name | Value | Purpose |
|------|-------|---------|
| `CardZone` | `'deck' \| 'hand' \| 'space' \| 'ground' \| 'character' \| 'discard' \| 'build'` | Zone type for card locations |
| `CARD_TYPE_UNIT` | `0` | Unit card type |
| `CARD_TYPE_EQUIPMENT` | `2` | Equipment card type |
| `CARD_TYPE_BATTLE` | `4` | Battle card type |

---

## Injected Dependencies

| Name | Type | Purpose |
|------|------|---------|
| `route` | `ActivatedRoute` | Gets `roomCode` from route params |
| `router` | `Router` | Navigate away from room |
| `gameHub` | `GameHubService` | SignalR hub for all game actions |
| `notifications` | `NotificationService` | Show error/success toasts |

---

## Data Flow

```
Server (SignalR)
  │
  ├─ roomUpdated$  ──► room signal ──► ALL computed signals recompute
  ├─ diceRolled$   ──► lastDiceRoll signal
  ├─ chatMessage$  ──► chatMessages signal (append)
  ├─ kicked$       ──► router.navigate('/play')
  └─ error$        ──► console.error
```

The `room` signal is the single source of truth. Setting it triggers a cascade through all computed signals (player data, team data, arena cards, hand, discard, etc.).

---

## Signals & Computed Signals

### Core Room State

| Signal | Type | Description |
|--------|------|-------------|
| `room` | `signal<GameRoomDto \| null>` | Full game room state from server |
| `selectedCard` | `signal<string \| null>` | Currently selected card instance ID |
| `lastDiceRoll` | `signal<DiceRolledEvent \| null>` | Last dice roll event |

### UI State

| Signal | Type | Description |
|--------|------|-------------|
| `isFullscreen` | `signal<boolean>` | Fullscreen mode toggle |
| `sidePanelCollapsed` | `signal<boolean>` | Side panel collapse state |
| `showDiscard` | `signal<boolean>` | Discard pile visibility |
| `showDeckBrowser` | `signal<boolean>` | Deck browser modal visibility |
| `deckBrowserCards` | `signal<CardInstanceDto[]>` | Cards shown in deck browser |
| `dragOverZone` | `signal<CardZone \| null>` | Current drag target zone |
| `handMinimized` | `signal<boolean>` | Hand area minimized state |
| `bottomControlsCollapsed` | `signal<boolean>` | Bottom controls collapsed |
| `zoomCard` | `signal<CardInstanceDto \| null>` | Card being zoomed |
| `arenaCardOrder` | `signal<{ [arena]: string[] }>` | Client-side custom card ordering |

### Chat & Bidding

| Signal | Type | Description |
|--------|------|-------------|
| `chatMessages` | `signal<ChatMessage[]>` | All chat messages |
| `chatInput` | `FormControl<string>` | Chat input form control |
| `bidInput` | `FormControl<number \| null>` | Bid amount input |

### Player & Team Computed Signals

| Computed | Type | Description |
|----------|------|-------------|
| `isHost` | `boolean` | Is current user the room host? |
| `myPlayer` | `GamePlayerDto \| null` | Current player's data |
| `opponents` | `GamePlayerDto[]` | All other players |
| `isTeamMode` | `boolean` | `true` if room is not 1v1 (i.e., 1v2 or 2v2) |
| `myTeam` | `TeamDataDto \| null` | My team (team mode only) |
| `opponentTeam` | `TeamDataDto \| null` | Opponent team (team mode only) |
| `teammates` | `GamePlayerDto[]` | My teammates excluding self |
| `opponentTeamPlayers` | `GamePlayerDto[]` | Players on the opponent team |

### Team Arena Computed Signals

| Computed | Type | Description |
|----------|------|-------------|
| `myTeamArenas` | `{ [arena]: CardInstanceDto[] }` | My team's shared arenas |
| `myTeamBuildZone` | `CardInstanceDto[]` | My team's build zone |
| `myTeamForce` | `number` | Team force (team mode) or player force (1v1) |
| `myTeamBuildCounter` | `number` | Team or player build counter |
| `opponentTeamArenas` | `{ [arena]: CardInstanceDto[] }` | Opponent team arenas |
| `opponentTeamBuildZone` | `CardInstanceDto[]` | Opponent team build zone |

### Bidding Computed Signals

| Computed | Type | Description |
|----------|------|-------------|
| `myBid` | `number \| null` | My current bid (team or player based) |
| `bidsRevealed` | `boolean` | Are bids visible? |
| `allBids` | `Array<{ label, bid }>` | All bids with display labels |

### Room Status Computed Signals

| Computed | Type | Description |
|----------|------|-------------|
| `maxPlayers` | `number` | Max players for room type (2/3/4) |
| `emptySlots` | `number[]` | Array for rendering empty player slots |
| `canStart` | `boolean` | Host can start game? (2+ players required) |
| `roomTypeBadgeClass` | `string` | CSS class for room type badge |
| `roomTypeLabel` | `string` | "1v1" / "1v2" / "2v2" |
| `stateBadgeClass` | `string` | CSS class for game state badge |
| `stateLabel` | `string` | "Waiting" / "In Progress" / "Finished" |

### Hand & Deck Computed Signals

| Computed | Type | Description |
|----------|------|-------------|
| `myHand` | `CardInstanceDto[]` | Player's hand cards |
| `myHandSorted` | `CardInstanceDto[]` | Hand sorted: units first, then non-units (sideways) |
| `myDeckSize` | `number` | Remaining deck count |
| `myDiscard` | `CardInstanceDto[]` | Discard pile |
| `myBuildZone` | `CardInstanceDto[]` | Build zone (team-aware) |

### Context Menu Signals

Each context menu has a set of signals for state management:

- **Arena Card Menu:** `cardMenuCardId`, `cardMenuX/Y`, `cardMenuCard` (computed)
- **Hand Card Menu:** `handCardMenuCardId`, `handCardMenuX/Y`, `handCardMenuCard` (computed)
- **Stack Menu:** `stackMenuCardId`, `stackMenuX/Y`, `stackMenuCard` (computed), `stackableTargets`
- **Pilot Menu:** `pilotMenuCardId`, `pilotMenuX/Y`, `pilotMenuCard` (computed), `pilotMenuUnitCard`
- **Equipment Menu:** `equipmentMenuCardId`, `equipmentMenuX/Y`, `equipmentMenuCard` (computed), `equipmentMenuUnitCard`
- **Build Card Menu:** `buildCardMenuCardId`, `buildCardMenuX/Y`, `buildCardMenuCard` (computed)
- **Discard Card Menu:** `discardCardMenuCardId`, `discardCardMenuX/Y`, `discardCardMenuCard` (computed)

### Modal Signals

| Signal | Type | Description |
|--------|------|-------------|
| `showPilotModal` | `signal<boolean>` | Pilot selection modal |
| `pilotModalCard` | `signal<CardInstanceDto \| null>` | Card for pilot modal |
| `showEquipmentModal` | `signal<boolean>` | Equipment selection modal |
| `equipmentModalCard` | `signal<CardInstanceDto \| null>` | Card for equipment modal |
| `showOpponentBuildZone` | `signal<GamePlayerDto \| null>` | Opponent build zone view |
| `showOpponentTeamBuildZone` | `signal<boolean>` | Opponent team build zone view |

---

## Team Mode vs 1v1 Mode

The `isTeamMode` computed signal (`room.roomType !== RoomType.OneVOne`) gates nearly all branching:

| Aspect | Team Mode (1v2, 2v2) | 1v1 Mode |
|--------|----------------------|----------|
| **Force/Build** | Team totals (`myTeamForce`, `myTeamBuildCounter`) | Player totals from `myPlayer()` |
| **Arenas** | `myTeamArenas()` → shared team arena | `myPlayer()?.arenas` → individual arenas |
| **Bid** | Team bid | Player bid |
| **Opponent Arenas (HTML)** | Single opponent team arena block | Per-opponent `@for` loop |
| **Card Ownership** | Check `card.ownerUserId === currentUser` | Always `true` for own cards |
| **Arena Cards Access** | `getMyArenaCards()` → `myTeamArenas()` | `getMyArenaCards()` → `myPlayer()?.arenas` |

### Template Branching

In the HTML, the arena grid has two major branches:
```
@if (isTeamMode()) {
  <!-- Team Mode: Single shared opponent team arena per arena type -->
  <!-- Uses: getOpponentTeamArenaUnits/Others/StackedCards -->
} @else {
  <!-- 1v1 Mode: Per-player arenas -->
  @for (opponent of opponents()) {
    <!-- Uses: getPlayerArenaUnits/Others, getStackedCards(opponent, card) -->
  }
}
```

---

## Arena Card Filtering

Cards in arenas are filtered into distinct categories for display:

| Category | Method | Filter Logic | Purpose |
|----------|--------|-------------|---------|
| **Units** | `myArenaUnits()` / `getPlayerArenaUnits()` / `getOpponentTeamArenaUnits()` | `cardType === UNIT && !stackParentId && !isPiloting()` | Top-level unit cards displayed in the units section |
| **Others (non-units)** | `myArenaOthers()` / `getPlayerArenaOthers()` / `getOpponentTeamArenaOthers()` | `cardType !== UNIT && !isEquipped()` | Sideways cards (locations, missions, etc.) in others section |
| **Stacked Cards** | `getMyStackedCards()` / `getStackedCards()` / `getOpponentTeamStackedCards()` | Cards whose IDs are in `card.stackedUnderIds` | Versioned duplicates stacked under a unit |
| **Pilot Cards** | `getPilotCards()` | Cards whose IDs are in `card.pilotCardIds` | Units piloting another unit, displayed as overlay |
| **Equipment Card** | `getEquipmentCard()` | Single card matching `card.equipmentCardId` | Equipment attached to a unit, displayed as overlay |

### Lookup Scope

`getPilotCards()` and `getEquipmentCard()` search across:
- My arenas (`getMyArenaCards`)
- Opponent team arenas (`getOpponentTeamArenaCards`)
- Individual opponent arenas (`opponents().flatMap(...)`)

This ensures they work in both team mode and 1v1 mode.

---

## Methods by Category

### Arena Helpers

| Method | Description |
|--------|-------------|
| `getMyArenaCards(arena)` | Private. Get arena cards — team-aware (team arenas in team mode, player arenas in 1v1) |
| `myArenaUnits(arena)` | Get my units for arena |
| `myArenaUnitsOrdered(arena)` | Get my units with client-side custom ordering |
| `myArenaOthers(arena)` | Get my non-units for arena (excludes equipped) |
| `myArenaActiveUnits(arena)` | Units if arena not retreated |
| `myArenaActiveOthers(arena)` | Non-units if arena not retreated |
| `myArenaRetreatedCards(arena)` | All cards if arena is retreated |
| `getPlayerArenaUnits(player, arena)` | Get opponent's units (1v1) |
| `getPlayerArenaOthers(player, arena)` | Get opponent's non-units (1v1, excludes equipped) |
| `getPlayerArenaActiveUnits(player, arena)` | Active units for opponent |
| `getPlayerArenaActiveOthers(player, arena)` | Active non-units for opponent |
| `getStackedCards(player, card)` | Get stacked cards under a card (1v1) |
| `getMyStackedCards(card)` | Get my stacked cards (team-aware) |
| `getOpponentTeamArenaCards(arena)` | Get opponent team arena cards |
| `getOpponentTeamArenaUnits(arena)` | Get opponent team units |
| `getOpponentTeamArenaOthers(arena)` | Get opponent team non-units |
| `getOpponentTeamStackedCards(card)` | Get stacked cards under opponent team card |

### Arena Retreat

| Method | Description |
|--------|-------------|
| `isMyArenaRetreated(arena)` | Is my arena retreated? (team-aware) |
| `isArenaRetreated(player, arena)` | Is a player's arena retreated? |
| `isOpponentTeamArenaRetreated(arena)` | Is opponent team arena retreated? |
| `toggleArenaRetreat(arena)` | Toggle arena retreat via server |

### Card Ownership

| Method | Description |
|--------|-------------|
| `isCardOwner(card)` | Is current user the card owner? (always true in 1v1 for own cards) |
| `canActOnCard(card)` | Can user perform actions on card? |
| `getCardOwnerDisplay(card)` | Get owner username for display |

### Drag & Drop

| Method | Description |
|--------|-------------|
| `onDragStart(event, card, zone)` | Initialize drag with card data |
| `onDragOver(event)` | Detect zone and update drag preview |
| `onDragEnd()` | Clean up drag state |
| `onDrop(event, targetZone)` | Handle drop — move card or reorder within arena |
| `handleArenaReorder(event, card, arena)` | Private. Reorder cards within same arena |
| `getZoneFromEvent(event)` | Private. Extract zone from DOM event target |
| `moveCard(cardId, from, to, card?)` | Move card between zones via server |

### Force & Build Counters

| Method | Description |
|--------|-------------|
| `incrementForce()` / `decrementForce()` | Adjust force counter |
| `onForceChange(event)` | Handle force input change |
| `incrementBuild()` / `decrementBuild()` | Adjust build counter |
| `onBuildChange(event)` | Handle build input change |

### Build Zone

| Method | Description |
|--------|-------------|
| `moveToBuild(card)` | Move card to build zone (no battle cards allowed) |
| `moveToBuildFromMenu()` | Move arena card to build from context menu |
| `moveToBuildFromHandMenu()` | Move hand card to build from context menu |
| `moveFromBuildTo(arena)` | Move card from build to arena |
| `openBuildCardMenu(event, card)` | Open build card context menu |
| `closeBuildCardMenu()` | Close build card menu |
| `incrementBuildCardCounter()` / `decrementBuildCardCounter()` / `removeBuildCardCounter()` | Adjust build card counter |

### Discard & Deck

| Method | Description |
|--------|-------------|
| `openDiscardCardMenu(event, card)` / `closeDiscardCardMenu()` | Discard card context menu |
| `returnToHandFromDiscardMenu()` | Return card from discard to hand |
| `openDeckBrowser()` | Fetch deck and show browser modal |
| `takeCardFromDeck(cardInstanceId)` | Take specific card from deck |

### Tap & Game Actions

| Method | Description |
|--------|-------------|
| `toggleTap(card)` | Toggle card tap state |
| `startGame()` | Start game (host only) |
| `drawCard()` | Draw 1 card |
| `drawSevenCards()` | Draw 7 cards (mulligan) |
| `rollDice()` | Roll dice (count from diceCount control) |

### Chat & Bidding

| Method | Description |
|--------|-------------|
| `sendChatMessage()` | Send chat message |
| `submitBid()` | Submit bid (with validation) |
| `revealBids()` / `hideBids()` | Toggle bid visibility |
| `clearBid()` | Clear bid |

### Card Context Menus

| Method | Description |
|--------|-------------|
| `openCardMenu(event, card)` / `closeCardMenu()` | Arena card context menu |
| `openOpponentCardMenu(event, card)` / `closeOpponentCardMenu()` | Opponent card context menu |
| `openHandCardMenu(event, card)` / `closeHandCardMenu()` | Hand card context menu |
| `openStackMenu(event, card)` / `closeStackMenu()` | Stack context menu |
| `openCardMenuFromStack(event)` | Open full card menu from stack menu ("More Options") |
| `zoomFromMenu()` / `zoomOpponentCard()` | Zoom card from menus |
| `toggleTapFromMenu()` | Toggle tap from menu |
| `incrementCounter()` / `decrementCounter()` / `removeCounter()` | Card counter from menu |
| `incrementDamage()` / `decrementDamage()` / `removeDamage()` | Card damage from menu |
| `discardFromMenu()` | Discard card from arena menu |
| `returnToHandFromMenu()` | Return card to hand from menu |
| `playToArena(arena)` | Play hand card to arena |

### Stack Methods

| Method | Description |
|--------|-------------|
| `hasStack(card)` | Check if card has stacked cards under it |
| `getStackSize(card)` | Get total stack size (includes top card) |
| `setStackTop(newTopCardId)` | Reorder: set new stack top |
| `checkStackableTargets(card)` | Get stackable targets for versioned card |
| `stackCardOnTarget(cardToStackId, targetCardId)` | Stack hand card onto arena card |

### Pilot Methods

| Method | Description |
|--------|-------------|
| `isPilot(card)` | Is card marked as pilot? |
| `hasPilots(card)` | Does unit have pilots attached? |
| `getPilotCards(card)` | Get pilot cards attached to unit |
| `isPiloting(card)` | Is card currently piloting a unit? |
| `getPilotableTargets()` | Get units that can receive pilots (space/ground, <2 pilots) |
| `addPilotToUnit(pilotCard, targetUnit)` | Add pilot to unit |
| `removePilotFromUnit(pilotCard)` | Remove pilot from unit |
| `openPilotCardMenu(event, pilotCard, unitCard)` / `closePilotMenu()` | Pilot context menu |
| `detachPilotFromPilotMenu()` | Detach pilot from pilot menu |
| `openPilotModal(card)` / `closePilotModal()` | Pilot selection modal |
| `pilotUnitFromModal(targetUnit)` | Attach pilot to unit from modal |
| `attachPilotFromHandMenu(targetUnitId)` | Attach pilot from hand menu |
| `attachPilotFromBuildMenu(targetUnitId)` | Attach pilot from build menu |
| `attachPilotFromArenaMenu(targetUnitId)` | Attach pilot from arena (character) menu |
| `detachPilotFromMenu(pilotCard)` | Detach pilot from card menu |

### Equipment Methods

| Method | Description |
|--------|-------------|
| `hasEquipment(card)` | Does unit have equipment attached? |
| `getEquipmentCard(card)` | Get equipment card attached to unit |
| `isEquipped(card)` | Is card currently equipped to a unit? |
| `isEquipmentCard(card)` | Is card equipment type? |
| `getEquippableTargets(equipmentCard)` | Get units that can receive equipment (no existing equipment, arena match) |
| `addEquipmentToUnit(equipmentCard, targetUnit)` | Add equipment to unit |
| `removeEquipmentFromUnit(equipmentCard)` | Remove equipment from unit |
| `openEquipmentCardMenu(event, equipmentCard, unitCard)` / `closeEquipmentMenu()` | Equipment context menu |
| `discardEquipmentFromMenu()` | Discard equipment from menu |
| `moveEquipmentToHandFromMenu()` | Return equipment to hand |
| `openEquipmentModal(card)` / `closeEquipmentModal()` | Equipment selection modal |
| `equipUnitFromModal(targetUnit)` | Equip unit from modal |
| `attachEquipmentFromHandMenu(targetUnitId)` | Attach equipment from hand menu |
| `attachEquipmentFromBuildMenu(targetUnitId)` | Attach equipment from build menu |
| `detachEquipmentFromMenu()` | Detach equipment from menu |

### Utility Methods

| Method | Description |
|--------|-------------|
| `findMyCard(cardId)` | Private. Find card across hand, arenas, build, discard |
| `setMenuPosition(x, y, menuHeight?)` | Private. Calculate context menu position with viewport bounds |
| `getPlayerCardCount(player)` | Get total cards (hand + deck) |
| `kickPlayer(username)` | Kick player from room (host only) |
| `copyRoomCode()` | Copy room code to clipboard |
| `linkifyMessage(message)` | Convert URLs in chat to clickable links |
| `toggleFullscreen()` | Toggle fullscreen mode |
| `getArenaIndicatorClass(card)` | CSS class for arena indicator badge |
| `getArenaIndicatorText(card)` | Arena indicator label text |

---

## HTML Template Structure

### Layout Overview

```
┌─────────────────────────────────────────────┐
│ Top Bar (room code, badges, controls)       │
├─────────────────────────────────────────────┤
│ Waiting Overlay (if game not started)       │
├─────────────────────────────────────────────┤
│ Opponent Info Strip (force, build, counts)  │
├─────────────────────────────────────────────┤
│ Arena Grid (chess-board layout)             │
│ ┌─────────┬─────────┬─────────┐            │
│ │ Char    │ Ground  │ Space   │ ← Opponent │
│ │ Arena   │ Arena   │ Arena   │  (rotated  │
│ │         │         │         │   180°)    │
│ ├─────────┼─────────┼─────────┤            │
│ │ Char    │ Ground  │ Space   │ ← Player   │
│ │ Arena   │ Arena   │ Arena   │            │
│ └─────────┴─────────┴─────────┘            │
├─────────────────────────────────────────────┤
│ Player Info (force, build, counters)        │
├─────────────────────────────────────────────┤
│ Hand Zone (sorted: units first, sideways)   │
├─────────────────────────────────────────────┤
│ Side Panel (chat, bid, discard, build zone) │
└─────────────────────────────────────────────┘

Modals/Overlays:
  - Zoom Card Modal
  - Pilot Selection Modal
  - Equipment Selection Modal
  - Deck Browser Modal
  - Opponent Build Zone Modal
  - Multiple Context Menus (positioned absolutely)
```

### Arena Rendering Pattern

Each arena follows this structure:

```html
<div class="arena {type}-arena {player/opponent}-arena">
  <div class="arena-label">LABEL</div>
  <div class="arena-content">
    <!-- Others section: non-unit sideways cards -->
    @if (arenaOthers.length > 0) {
      <div class="others-section">
        @for (card of arenaOthers) {
          <div class="game-card tiny sideways">...</div>
        }
      </div>
    }
    <!-- Units section -->
    <div class="units-section">
      @for (card of arenaUnits) {
        <div class="card-wrapper small"
             [class.has-stack]="hasStack(card)"
             [class.has-pilots]="hasPilots(card)"
             [class.has-equipment]="hasEquipment(card)">
          <!-- Pilot overlays -->
          @for (pilotCard of getPilotCards(card)) { ... }
          <!-- Equipment overlay -->
          @if (getEquipmentCard(card); as equipCard) { ... }
          <!-- Top card (unit itself) -->
          <div class="game-card small stack-top">...</div>
          <!-- Stacked cards underneath -->
          @for (stackedCard of getStackedCards(card)) { ... }
        </div>
      }
    </div>
  </div>
</div>
```

---

## CSS/SCSS Key Patterns

### Card Sizes

| Class | Use Case | Approximate Size |
|-------|----------|-----------------|
| `.game-card` (base) | Full size (zoom modal) | ~400px height |
| `.game-card.small` | Arena unit cards | ~84px height |
| `.game-card.tiny` | Non-unit sideways cards in arenas | ~56px height |
| `.game-card.hand-card` | Hand cards | ~196px height, 140px width |

### Rotation/Sideways

- **`.game-card.sideways`** — Rotated 90° for non-unit cards (equipment, missions, locations)
- **Sideways images** counter-rotate with `rotate(-90deg)` to keep image upright
- **`.opponent-arena`** — Rotated 180° so opponent's view is mirrored
- **Badges in opponent arenas** — Counter-rotated 180° for readability

### Card-Wrapper Layout

The `.card-wrapper` is a flex container using `row-reverse` that groups a unit with its overlays:

```
┌─────────────────────────────────────┐
│ card-wrapper                        │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌────┐ │
│ │stack │ │stack │ │ UNIT │ │pil │ │
│ │card  │ │card  │ │(top) │ │card│ │
│ │      │ │      │ │      │ └────┘ │
│ │      │ │      │ │  ┌────┐       │
│ │      │ │      │ │  │eqp │       │
│ └──────┘ └──────┘ └──┴────┘       │
│  ← stacked cards   ↑ main  ↑ overlays
└─────────────────────────────────────┘
```

- `.has-stack` — Enables stacked card display
- `.has-pilots` — Shows pilot card overlays
- `.has-equipment` — Shows equipment card overlay
- `.pilot-card` — Small overlay card positioned near unit
- `.equipment-card` — Small overlay card positioned near unit
- `.stacked-card` — Offset cards underneath the main unit

### Arena Layout

```scss
.arena {
  // Flex column with arena-specific background color
  .space-arena    { /* blue tint */ }
  .ground-arena   { /* green tint */ }
  .character-arena { /* purple tint */ }

  .arena-content {
    .others-section { /* non-units grouped at top */ }
    .units-section  { /* units below, flexible layout */ }
  }

  &.arena-retreated { /* faded/grayed appearance */ }
}
```

### Badges

| Badge | Position | Purpose |
|-------|----------|---------|
| `.counter-badge` | Top-left | Counter value display |
| `.damage-badge` | Top-right | Damage value display |
| `.version-badge` | Bottom-right | Stack version number |
| `.stack-badge` | Bottom-right corner | Stack count |
| `.pilot-badge` | Bottom-left | Pilot count ("P2") |
| `.owner-badge` | Positioned | Owner initial (team mode) |
| `.tapped-indicator` | Center | "TAP" text (red) |
| `.retreated-indicator` | Center | "RETREAT" text |

---

## Hand Cards

Hand cards are sorted via `myHandSorted`:
1. **Units first** (`cardType === CARD_TYPE_UNIT`) — displayed as normal portrait cards
2. **Non-units last** (`cardType !== CARD_TYPE_UNIT`) — displayed with `.sideways` class (rotated 90°)

Hand cards use size `140px × 196px`. When rotated sideways, the visual bounding box becomes `196px × 140px`, requiring margin compensation:
```scss
margin: calc((140px - 196px) / 2) calc((196px - 140px) / 2);
// = -28px vertical, 28px horizontal
```

---

## Testing

### Run Tests

```bash
cd Dao.SWC.Web && npx ng test
```

This runs all Vitest tests including the game room component spec.

### Test File

**`game-room.component.spec.ts`** — Comprehensive unit tests for all component logic.

Uses Vitest + Angular TestBed with mocked services (`GameHubService`, `Router`, `ActivatedRoute`, `NotificationService`). Tests are pure logic tests — no template rendering.

### Test Categories

| Describe Block | What It Covers |
|----------------|---------------|
| **Computed Signals** | `myPlayer`, `opponents`, `isHost`, `myHandSorted` (units before non-units), `myDeckSize`, `myDiscard` |
| **Team Mode vs 1v1 Mode** | `isTeamMode`, `myTeam`, `opponentTeam`, `myTeamForce`/`myTeamBuildCounter` branching, `myBuildZone`, `teammates`, `opponentTeamPlayers` |
| **Arena Card Filtering** | `getPlayerArenaUnits` (excludes stacked/piloting), `getPlayerArenaOthers` (excludes equipped), `getStackedCards`, `myArenaUnits`, `myArenaOthers`, `myArenaUnitsOrdered`, opponent team arena methods |
| **Equipment Logic** | `hasEquipment`, `isEquipped`, `isEquipmentCard`, `getEquipmentCard` (finds across own/opponent/team arenas), `getEquippableTargets` (arena restrictions, excludes stacked/already-equipped) |
| **Pilot Logic** | `isPilot`, `hasPilots`, `isPiloting`, `getPilotCards` (finds across own/opponent arenas), `getPilotableTargets` (space/ground only, <2 pilots) |
| **Stack Logic** | `hasStack`, `getStackSize`, `getMyStackedCards` (1v1 and team mode) |
| **Card Ownership** | `isCardOwner` (always true in 1v1, checks `ownerUserId` in team mode), `canActOnCard`, `getCardOwnerDisplay` |
| **Arena Retreat** | `isArenaRetreated`, `isMyArenaRetreated` (team-aware), `myArenaActiveUnits`/`ActiveOthers` return empty when retreated, `myArenaRetreatedCards`, opponent arena retreat |
| **Utility** | `getPlayerCardCount` |

### Test Data Factories

The spec file provides reusable factories for creating test data:

- **`makeCard(overrides)`** — Creates a `CardInstanceDto` with sensible defaults
- **`makePlayer(overrides)`** — Creates a `GamePlayerDto` with empty arenas
- **`makeTeamData(overrides)`** — Creates a `TeamDataDto`
- **`makeRoom(overrides)`** — Creates a `GameRoomDto` (defaults to 1v1, InProgress)

### Adding New Tests

When adding new logic to the game room component:

1. Add the test in the appropriate `describe` block (or create a new one)
2. Use `setRoom(makeRoom({...}))` to set up state via the `room` signal
3. Call the method and assert the result
4. Follow the Arrange-Act-Assert pattern
5. Run `npx ng test` to verify
