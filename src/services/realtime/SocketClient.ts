/**
 * Socket.io Client for Real-time Updates
 * Replaces WebSocket with more robust Socket.io
 */

import { io, Socket } from 'socket.io-client';
import { TrafficEvent } from '@types/api.types';
import { DifferentialResponse } from '@services/api/trafficApi';

export interface SocketConfig {
  url: string;
  apiKey: string;
  enableCompression?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export class SocketClient {
  private socket: Socket | null = null;
  private config: SocketConfig;
  private eventHandlers: Map<string, Function[]> = new Map();
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: SocketConfig) {
    this.config = config;
  }

  /**
   * Connect to Socket.io server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.config.url, {
        auth: {
          apiKey: this.config.apiKey
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.config.reconnectionAttempts || 10,
        reconnectionDelay: this.config.reconnectionDelay || 1000,
        compress: this.config.enableCompression ?? true
      });

      this.socket.on('connect', () => {
        console.log('Socket.io connected');
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket.io disconnected:', reason);
        this.isConnected = false;
        this.emit('disconnected', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket.io connection error:', error);
        reject(error);
      });

      // Real-time event handlers
      this.socket.on('differential', (data: DifferentialResponse) => {
        this.emit('differential', data);
      });

      this.socket.on('event:update', (event: TrafficEvent) => {
        this.emit('event:update', event);
      });

      this.socket.on('event:delete', (eventId: string) => {
        this.emit('event:delete', eventId);
      });

      this.socket.on('bulk:update', (events: TrafficEvent[]) => {
        this.emit('bulk:update', events);
      });

      // Room-based updates (for geo-specific events)
      this.socket.on('room:joined', (room: string) => {
        console.log(`Joined room: ${room}`);
        this.emit('room:joined', room);
      });

      // Set connection timeout
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Join a geo-based room for location-specific updates
   */
  joinRoom(room: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('join:room', room);
    }
  }

  /**
   * Leave a room
   */
  leaveRoom(room: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave:room', room);
    }
  }

  /**
   * Request sync from server
   */
  requestSync(since?: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('sync:request', { since });
    }
  }

  /**
   * Send acknowledgment for received differential
   */
  acknowledgeDifferential(diffId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('differential:ack', { id: diffId });
    }
  }

  /**
   * Subscribe to event type
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Unsubscribe from event
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    id?: string;
    latency?: number;
  } {
    if (this.socket && this.isConnected) {
      return {
        connected: true,
        id: this.socket.id,
        latency: (this.socket as any).latency || 0
      };
    }
    return { connected: false };
  }
}

export const socketClient = new SocketClient({
  url: import.meta.env.VITE_SOCKET_URL || 'https://realtime.511.org',
  apiKey: '',
  enableCompression: true
});
