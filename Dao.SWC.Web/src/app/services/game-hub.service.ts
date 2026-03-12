import { inject, Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { DiceRolledEvent, GameRoomDto, RoomType, Team } from '../models/dtos/game.dto';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class GameHubService {
  private hubConnection: signalR.HubConnection | null = null;
  private authService = inject(AuthService);
  private _currentRoomCode: string | null = null;
  private _currentUser: string | null = null;

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

    const hubUrl = environment.apiUrl.replace(/\/$/, '') + '/gamehub';

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        withCredentials: true,
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

    // Error messages
    this.hubConnection.on('Error', (message: string) => {
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

  async createRoom(roomType: RoomType, deckId: number): Promise<string> {
    if (!this.hubConnection) throw new Error('Not connected');
    const roomCode = await this.hubConnection.invoke<string>('CreateRoom', roomType, deckId);
    this._currentRoomCode = roomCode;
    return roomCode;
  }

  async joinRoom(roomCode: string, deckId: number): Promise<void> {
    if (!this.hubConnection) throw new Error('Not connected');
    const room = await this.hubConnection.invoke<GameRoomDto>('JoinRoom', roomCode, deckId);
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

  async assignTeam(username: string, team: Team): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('AssignTeam', username, team);
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

  async playCard(cardInstanceId: string, arena: string): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('PlayCard', cardInstanceId, arena);
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

  async endTurn(): Promise<void> {
    if (!this.hubConnection || !this._currentRoomCode) return;
    await this.hubConnection.invoke('EndTurn');
  }

  private extractUsername(room: GameRoomDto): string | null {
    const user = this.authService.userInfo();
    return user?.name ?? user?.email ?? null;
  }
}
