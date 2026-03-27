import { inject, Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Alignment } from '../models/dtos/card.dto';
import { CardInstanceDto, DiceRolledEvent, GameRoomDto, PlayCardResultDto, RoomType, StackResultDto } from '../models/dtos/game.dto';
import { AuthService } from './auth.service';

interface SignalRTokenResponse {
  accessToken: string;
}

@Injectable({
  providedIn: 'root',
})
export class GameHubService {
  private hubConnection: signalR.HubConnection | null = null;
  private authService = inject(AuthService);
  private _currentRoomCode: string | null = null;
  private _currentUser: string | null = null;
  private _accessToken: string | null = null;
  private _pendingError: string | null = null;

  // Connection state
  public isConnected = signal(false);
  public connectionError = signal<string | null>(null);

  // Event subjects for components to subscribe to
  public roomUpdated$ = new Subject<GameRoomDto>();
  public diceRolled$ = new Subject<DiceRolledEvent>();
  public kicked$ = new Subject<string>();
  public error$ = new Subject<string>();

  get currentUser(): string | null {
    return this._currentUser;
  }

  async connect(): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    // Fetch the access token for SignalR (WebSockets can't use cookies)
    await this.fetchAccessToken();

    const hubUrl = environment.apiUrl + '/gamehub';

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        withCredentials: true,
        accessTokenFactory: () => this._accessToken ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.setupEventHandlers();

    try {
      await this.hubConnection.start();
      this.isConnected.set(true);
      this.connectionError.set(null);
      console.log('SignalR Connected');
    } catch (err) {
      console.error('SignalR Connection Error:', err);
      this.connectionError.set('Failed to connect to game server');
      this.isConnected.set(false);
      throw err;
    }
  }

  private async fetchAccessToken(): Promise<void> {
    try {
      const response = await fetch(environment.apiUrl + '/Auth/signalr-token', {
        credentials: 'include',
      });
      if (response.ok) {
        const data: SignalRTokenResponse = await response.json();
        this._accessToken = data.accessToken;
      } else {
        console.error('Failed to fetch SignalR token:', response.status);
        this._accessToken = null;
      }
    } catch (err) {
      console.error('Error fetching SignalR token:', err);
      this._accessToken = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.isConnected.set(false);
      this._currentRoomCode = null;
    }
  }

  private setupEventHandlers(): void {
    if (!this.hubConnection) return;

    // Room state updates
    this.hubConnection.on('RoomUpdated', (room: GameRoomDto) => {
      this.roomUpdated$.next(room);
    });

    // Dice roll results
    this.hubConnection.on('DiceRolled', (event: DiceRolledEvent) => {
      this.diceRolled$.next(event);
    });

    // Player was kicked
    this.hubConnection.on('Kicked', (reason: string) => {
      this.kicked$.next(reason);
      this._currentRoomCode = null;
    });

    // Error messages - also store as pending error for invoke operations
    this.hubConnection.on('Error', (message: string) => {
      this._pendingError = message;
      this.error$.next(message);
    });

    this.hubConnection.onreconnecting(() => {
      this.isConnected.set(false);
    });

    this.hubConnection.onreconnected(() => {
      this.isConnected.set(true);
      if (this._currentRoomCode) {
        this.reconnect(this._currentRoomCode);
      }
    });

    this.hubConnection.onclose(() => {
      this.isConnected.set(false);
    });
  }

  // Room management

  async createRoom(
    roomType: RoomType,
    deckId: number,
    playAsAlignment?: Alignment,
  ): Promise<string> {
    if (!this.hubConnection) throw new Error('Not connected');
    const roomCode = await this.hubConnection.invoke<string>(
      'CreateRoom',
      roomType,
      deckId,
      playAsAlignment ?? null,
    );
    this._currentRoomCode = roomCode;
    return roomCode;
  }

  async joinRoom(roomCode: string, deckId: number, playAsAlignment?: Alignment): Promise<void> {
    if (!this.hubConnection) throw new Error('Not connected');

    // Clear any pending error before the invoke
    this._pendingError = null;

    const room = await this.hubConnection.invoke<GameRoomDto | null>(
      'JoinRoom',
      roomCode,
      deckId,
      playAsAlignment ?? null,
    );

    if (!room) {
      // Use the specific error from the server if available
      const errorMessage =
        this._pendingError ||
        'Failed to join room. The room may not exist or your deck may be invalid.';
      this._pendingError = null;
      throw new Error(errorMessage);
    }

    this._currentRoomCode = roomCode;
    this._currentUser = this.extractUsername(room);
    this.roomUpdated$.next(room);
  }

  async reconnect(roomCode: string): Promise<void> {
    if (!this.hubConnection) throw new Error('Not connected');
    const room = await this.hubConnection.invoke<GameRoomDto>('Reconnect', roomCode);
    this._currentRoomCode = roomCode;
    this._currentUser = this.extractUsername(room);
    this.roomUpdated$.next(room);
  }

  async leaveRoom(): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('LeaveRoom', this._currentRoomCode);
    this._currentRoomCode = null;
  }

  async kickPlayer(username: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('KickPlayer', username);
  }

  async startGame(): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('StartGame');
  }

  // Game actions

  async drawCards(count: number): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('DrawCards', count);
  }

  async playCard(cardInstanceId: string, arena: string): Promise<PlayCardResultDto> {
    if (!this.hubConnection || !this._currentRoomCode) {
      return { success: false, errorMessage: 'Not connected', card: null, wasAutoStacked: false };
    }
    return await this.hubConnection.invoke<PlayCardResultDto>('PlayCard', cardInstanceId, arena);
  }

  async discardCard(cardInstanceId: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('DiscardCard', cardInstanceId);
  }

  async returnToHand(cardInstanceId: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('ReturnToHand', cardInstanceId);
  }

  async toggleTap(cardInstanceId: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('ToggleTap', cardInstanceId);
  }

  async shuffleDeck(): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('ShuffleDeck');
  }

  async rollDice(numberOfDice: number): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('RollDice', numberOfDice);
  }

  async viewDeck(): Promise<CardInstanceDto[]> {
    if (!this.hubConnection || !this._currentRoomCode) return [];
    return await this.hubConnection.invoke<CardInstanceDto[]>('ViewDeck');
  }

  async takeFromDeck(cardInstanceId: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('TakeFromDeck', cardInstanceId);
  }

  async updateForce(force: number): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('UpdateForce', force);
  }

  async toggleFaceDown(cardInstanceId: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('ToggleFaceDown', cardInstanceId);
  }

  async setCounter(cardInstanceId: string, counter: number): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('SetCounter', cardInstanceId, counter);
  }

  async removeCounter(cardInstanceId: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('RemoveCounter', cardInstanceId);
  }

  async setDamage(cardInstanceId: string, damage: number): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('SetDamage', cardInstanceId, damage);
  }

  async removeDamage(cardInstanceId: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('RemoveDamage', cardInstanceId);
  }

  async playCardFaceDown(cardInstanceId: string, arena: string): Promise<PlayCardResultDto> {
    if (!this.hubConnection || !this._currentRoomCode) {
      return { success: false, errorMessage: 'Not connected', card: null, wasAutoStacked: false };
    }
    return await this.hubConnection.invoke<PlayCardResultDto>('PlayCardFaceDown', cardInstanceId, arena);
  }

  async moveToBuild(cardInstanceId: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('MoveToBuild', cardInstanceId);
  }

  async toggleArenaRetreat(arena: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('ToggleArenaRetreat', arena);
  }

  async moveFromBuild(cardInstanceId: string, arena: string): Promise<PlayCardResultDto> {
    if (!this.hubConnection || !this._currentRoomCode) {
      return { success: false, errorMessage: 'Not connected to a room', card: null, wasAutoStacked: false };
    }
    return await this.hubConnection.invoke<PlayCardResultDto>('MoveFromBuild', cardInstanceId, arena);
  }

  async updateBuildCounter(buildCounter: number): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('UpdateBuildCounter', buildCounter);
  }

  // Card Stacking methods

  async stackCard(cardToStackId: string, targetCardId: string): Promise<StackResultDto> {
    if (!this.hubConnection || !this._currentRoomCode) {
      return { success: false, errorMessage: 'Not connected to a room', topCard: null };
    }
    return await this.hubConnection.invoke<StackResultDto>(
      'StackCard',
      cardToStackId,
      targetCardId,
    );
  }

  async setStackTop(
    currentTopCardId: string,
    newTopCardId: string,
  ): Promise<StackResultDto> {
    if (!this.hubConnection || !this._currentRoomCode) {
      return { success: false, errorMessage: 'Not connected to a room', topCard: null };
    }
    return await this.hubConnection.invoke<StackResultDto>(
      'SetStackTop',
      currentTopCardId,
      newTopCardId,
    );
  }

  async getStackableCards(cardInstanceId: string): Promise<CardInstanceDto[]> {
    if (!this.hubConnection || !this._currentRoomCode) return [];
    return await this.hubConnection.invoke<CardInstanceDto[]>('GetStackableCards', cardInstanceId);
  }

  async canPlayVersionedCard(cardInstanceId: string): Promise<boolean> {
    if (!this.hubConnection || !this._currentRoomCode) return true;
    return await this.hubConnection.invoke<boolean>('CanPlayVersionedCard', cardInstanceId);
  }

  private extractUsername(room: GameRoomDto): string | null {
    const user = this.authService.userInfo();
    return user?.name ?? user?.email ?? null;
  }
}
