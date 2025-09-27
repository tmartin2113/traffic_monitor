/**
 * EventStream Client for Real-time Updates
 * Production-ready WebSocket/SSE client with differential sync support
 * 
 * @module services/websocket/EventStreamClient
 * @version 2.0.0
 */

import { TrafficEvent } from '@types/api.types';
import { DifferentialResponse } from '@services/api/trafficApi';
import { EventEmitter } from 'events';

// ============================================================================
// Type Definitions
// ============================================================================

export type ConnectionType = 'websocket' | 'sse' | 'long-polling';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type MessagePriority = 'high' | 'normal' | 'low';

export interface EventStreamConfig {
  url: string;
  apiKey: string;
  connectionType?: ConnectionType;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
  enableCompression?: boolean;
  enableBatching?: boolean;
  batchInterval?: number;
  debug?: boolean;
}

export interface StreamMessage {
  id: string;
  type: MessageType;
  payload: any;
  timestamp: string;
  sequence?: number;
  priority?: MessagePriority;
  compressed?: boolean;
}

export type MessageType =
  | 'differential'
  | 'event-update'
  | 'event-delete'
  | 'bulk-update'
  | 'heartbeat'
  | 'sync-request'
  | 'sync-response'
  | 'error'
  | 'info'
  | 'config';

export interface ConnectionStats {
  state: ConnectionState;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  reconnectCount: number;
  messagesSent: number;
  messagesReceived: number;
  bytesReceived: number;
  bytesSent: number;
  latency: number;
  errors: ConnectionError[];
}

export interface ConnectionError {
  timestamp: Date;
  type: 'connection' | 'message' | 'auth' | 'timeout';
  message: string;
  code?: string;
  fatal?: boolean;
}

export interface StreamEventHandlers {
  onDifferential?: (diff: DifferentialResponse) => void;
  onEventUpdate?: (event: TrafficEvent) => void;
  onEventDelete?: (eventId: string) => void;
  onBulkUpdate?: (events: TrafficEvent[]) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onError?: (error: ConnectionError) => void;
  onMessage?: (message: StreamMessage) => void;
}

interface QueuedMessage {
  message: any;
  timestamp: number;
  attempts: number;
  priority: MessagePriority;
}

interface ReconnectState {
  attempts: number;
  nextAttemptAt: number;
  backoffMultiplier: number;
}

// ============================================================================
// EventStream Client Implementation
// ============================================================================

export class EventStreamClient extends EventEmitter {
  private config: Required<EventStreamConfig>;
  private handlers: StreamEventHandlers;
  private connection: WebSocket | EventSource | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private stats: ConnectionStats;
  private messageQueue: QueuedMessage[] = [];
  private reconnectState: ReconnectState;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private batchTimer: NodeJS.Timeout | null = null;
  private messageBuffer: StreamMessage[] = [];
  private sequenceNumber: number = 0;
  private lastMessageTime: number = 0;
  private sessionId: string;
  private compressionWorker: Worker | null = null;

  constructor(config: EventStreamConfig, handlers: StreamEventHandlers = {}) {
    super();
    
    this.config = {
      connectionType: 'websocket',
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      messageQueueSize: 100,
      enableCompression: true,
      enableBatching: false,
      batchInterval: 100,
      debug: false,
      ...config
    };

    this.handlers = handlers;
    this.sessionId = this.generateSessionId();
    
    this.stats = {
      state: 'disconnected',
      connectedAt: null,
      disconnectedAt: null,
      reconnectCount: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesReceived: 0,
      bytesSent: 0,
      latency: 0,
      errors: []
    };

    this.reconnectState = {
      attempts: 0,
      nextAttemptAt: 0,
      backoffMultiplier: 1
    };

    this.initializeCompressionWorker();
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to the event stream
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected') {
      this.log('Already connected');
      return;
    }

    this.updateConnectionState('connecting');

    try {
      switch (this.config.connectionType) {
        case 'websocket':
          await this.connectWebSocket();
          break;
        case 'sse':
          await this.connectSSE();
          break;
        case 'long-polling':
          await this.connectLongPolling();
          break;
        default:
          throw new Error(`Unknown connection type: ${this.config.connectionType}`);
      }

      this.updateConnectionState('connected');
      this.stats.connectedAt = new Date();
      this.reconnectState.attempts = 0;
      this.startHeartbeat();
      this.processQueuedMessages();
      
    } catch (error) {
      this.handleConnectionError(error as Error);
      
      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.buildConnectionUrl('ws');
      this.log(`Connecting to WebSocket: ${url}`);

      const ws = new WebSocket(url);
      
      // Configure WebSocket
      ws.binaryType = 'arraybuffer';

      // Connection opened
      ws.onopen = () => {
        this.log('WebSocket connected');
        this.connection = ws;
        this.sendAuthMessage();
        resolve();
      };

      // Message received
      ws.onmessage = async (event) => {
        this.stats.messagesReceived++;
        this.stats.bytesReceived += this.getMessageSize(event.data);
        this.lastMessageTime = Date.now();

        try {
          const message = await this.parseMessage(event.data);
          await this.handleMessage(message);
        } catch (error) {
          this.log('Failed to parse message:', error);
          this.recordError('message', 'Failed to parse message');
        }
      };

      // Error occurred
      ws.onerror = (event) => {
        this.log('WebSocket error:', event);
        this.recordError('connection', 'WebSocket error');
        reject(new Error('WebSocket connection failed'));
      };

      // Connection closed
      ws.onclose = (event) => {
        this.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        this.handleDisconnect(event.wasClean);
      };

      // Set timeout for connection
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Connect via Server-Sent Events
   */
  private async connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.buildConnectionUrl('https');
      this.log(`Connecting to SSE: ${url}`);

      const eventSource = new EventSource(url);
      
      eventSource.onopen = () => {
        this.log('SSE connected');
        this.connection = eventSource;
        resolve();
      };

      eventSource.onmessage = async (event) => {
        this.stats.messagesReceived++;
        this.stats.bytesReceived += event.data.length;
        this.lastMessageTime = Date.now();

        try {
          const message = await this.parseMessage(event.data);
          await this.handleMessage(message);
        } catch (error) {
          this.log('Failed to parse SSE message:', error);
          this.recordError('message', 'Failed to parse SSE message');
        }
      };

      eventSource.onerror = (event) => {
        this.log('SSE error:', event);
        this.recordError('connection', 'SSE error');
        
        if (eventSource.readyState === EventSource.CLOSED) {
          reject(new Error('SSE connection failed'));
        }
      };

      // Custom event types
      eventSource.addEventListener('differential', async (event) => {
        const data = JSON.parse(event.data);
        this.handleDifferential(data);
      });

      eventSource.addEventListener('event-update', async (event) => {
        const data = JSON.parse(event.data);
        this.handleEventUpdate(data);
      });

      // Set timeout for connection
      setTimeout(() => {
        if (eventSource.readyState !== EventSource.OPEN) {
          eventSource.close();
          reject(new Error('SSE connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Connect via Long Polling (fallback)
   */
  private async connectLongPolling(): Promise<void> {
    // Long polling implementation
    this.log('Long polling not yet implemented');
    throw new Error('Long polling not implemented');
  }

  /**
   * Disconnect from the event stream
   */
  disconnect(): void {
    this.log('Disconnecting');
    this.updateConnectionState('disconnected');
    this.stats.disconnectedAt = new Date();
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.connection) {
      if (this.connection instanceof WebSocket) {
        this.connection.close(1000, 'Client disconnect');
      } else if (this.connection instanceof EventSource) {
        this.connection.close();
      }
      this.connection = null;
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(wasClean: boolean): void {
    this.connection = null;
    this.updateConnectionState('disconnected');
    this.stats.disconnectedAt = new Date();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (!wasClean && this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectState.attempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached');
      this.updateConnectionState('error');
      this.recordError('connection', 'Max reconnection attempts reached', true);
      return;
    }

    this.updateConnectionState('reconnecting');
    this.reconnectState.attempts++;
    
    // Calculate backoff delay
    const baseDelay = this.config.reconnectInterval;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectState.backoffMultiplier),
      30000 // Max 30 seconds
    );
    
    this.reconnectState.nextAttemptAt = Date.now() + delay;
    this.reconnectState.backoffMultiplier = Math.min(
      this.reconnectState.backoffMultiplier + 1,
      5
    );

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectState.attempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  /**
   * Parse incoming message
   */
  private async parseMessage(data: any): Promise<StreamMessage> {
    let messageData: any;

    // Handle binary data
    if (data instanceof ArrayBuffer) {
      if (this.config.enableCompression) {
        messageData = await this.decompress(data);
      } else {
        const decoder = new TextDecoder();
        messageData = decoder.decode(data);
      }
    } else {
      messageData = data;
    }

    // Parse JSON
    if (typeof messageData === 'string') {
      messageData = JSON.parse(messageData);
    }

    // Validate message structure
    if (!messageData.type || !messageData.payload) {
      throw new Error('Invalid message structure');
    }

    return messageData as StreamMessage;
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: StreamMessage): Promise<void> {
    this.log('Received message:', message.type);
    
    // Update latency
    if (message.timestamp) {
      this.stats.latency = Date.now() - new Date(message.timestamp).getTime();
    }

    // Call generic handler
    if (this.handlers.onMessage) {
      this.handlers.onMessage(message);
    }

    // Handle specific message types
    switch (message.type) {
      case 'differential':
        this.handleDifferential(message.payload);
        break;
        
      case 'event-update':
        this.handleEventUpdate(message.payload);
        break;
        
      case 'event-delete':
        this.handleEventDelete(message.payload);
        break;
        
      case 'bulk-update':
        this.handleBulkUpdate(message.payload);
        break;
        
      case 'heartbeat':
        this.handleHeartbeat(message.payload);
        break;
        
      case 'sync-request':
        this.handleSyncRequest(message.payload);
        break;
        
      case 'sync-response':
        this.handleSyncResponse(message.payload);
        break;
        
      case 'error':
        this.handleErrorMessage(message.payload);
        break;
        
      case 'info':
        this.handleInfoMessage(message.payload);
        break;
        
      case 'config':
        this.handleConfigMessage(message.payload);
        break;
        
      default:
        this.log(`Unknown message type: ${message.type}`);
    }

    this.emit(`message:${message.type}`, message.payload);
  }

  /**
   * Handle differential update
   */
  private handleDifferential(payload: DifferentialResponse): void {
    this.log('Processing differential update');
    
    if (this.handlers.onDifferential) {
      this.handlers.onDifferential(payload);
    }
    
    this.emit('differential', payload);
  }

  /**
   * Handle single event update
   */
  private handleEventUpdate(payload: TrafficEvent): void {
    this.log(`Processing event update: ${payload.id}`);
    
    if (this.handlers.onEventUpdate) {
      this.handlers.onEventUpdate(payload);
    }
    
    this.emit('event-update', payload);
  }

  /**
   * Handle event deletion
   */
  private handleEventDelete(payload: { eventId: string }): void {
    this.log(`Processing event deletion: ${payload.eventId}`);
    
    if (this.handlers.onEventDelete) {
      this.handlers.onEventDelete(payload.eventId);
    }
    
    this.emit('event-delete', payload.eventId);
  }

  /**
   * Handle bulk update
   */
  private handleBulkUpdate(payload: TrafficEvent[]): void {
    this.log(`Processing bulk update: ${payload.length} events`);
    
    if (this.handlers.onBulkUpdate) {
      this.handlers.onBulkUpdate(payload);
    }
    
    this.emit('bulk-update', payload);
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(payload: any): void {
    // Send pong response
    this.sendMessage({
      type: 'pong',
      payload: { timestamp: new Date().toISOString() }
    });
  }

  /**
   * Handle sync request from server
   */
  private handleSyncRequest(payload: any): void {
    this.log('Server requested sync');
    
    // Send current sync state
    this.sendMessage({
      type: 'sync-response',
      payload: {
        lastSyncTimestamp: payload.lastSyncTimestamp,
        eventCount: payload.eventCount,
        sessionId: this.sessionId
      }
    });
  }

  /**
   * Handle sync response from server
   */
  private handleSyncResponse(payload: any): void {
    this.log('Received sync response');
    this.emit('sync-response', payload);
  }

  /**
   * Handle error message
   */
  private handleErrorMessage(payload: any): void {
    this.log('Server error:', payload);
    this.recordError('message', payload.message || 'Server error');
    
    if (this.handlers.onError) {
      this.handlers.onError({
        timestamp: new Date(),
        type: 'message',
        message: payload.message || 'Unknown error',
        code: payload.code
      });
    }
  }

  /**
   * Handle info message
   */
  private handleInfoMessage(payload: any): void {
    this.log('Server info:', payload);
    this.emit('info', payload);
  }

  /**
   * Handle config update
   */
  private handleConfigMessage(payload: any): void {
    this.log('Config update:', payload);
    
    // Update local config if needed
    if (payload.heartbeatInterval) {
      this.config.heartbeatInterval = payload.heartbeatInterval;
      this.restartHeartbeat();
    }
    
    this.emit('config', payload);
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  /**
   * Send message through the connection
   */
  async sendMessage(
    data: any,
    priority: MessagePriority = 'normal'
  ): Promise<void> {
    const message: StreamMessage = {
      id: this.generateMessageId(),
      type: data.type,
      payload: data.payload,
      timestamp: new Date().toISOString(),
      sequence: this.sequenceNumber++,
      priority
    };

    // Queue if disconnected
    if (this.connectionState !== 'connected') {
      this.queueMessage(message, priority);
      return;
    }

    // Batch if enabled
    if (this.config.enableBatching && priority !== 'high') {
      this.messageBuffer.push(message);
      this.scheduleBatch();
      return;
    }

    await this.sendMessageInternal(message);
  }

  /**
   * Send message internally
   */
  private async sendMessageInternal(message: StreamMessage): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    let data: any = message;
    
    // Compress if enabled
    if (this.config.enableCompression && this.connection instanceof WebSocket) {
      data = await this.compress(JSON.stringify(message));
    } else {
      data = JSON.stringify(message);
    }

    // Send based on connection type
    if (this.connection instanceof WebSocket) {
      this.connection.send(data);
      this.stats.messagesSent++;
      this.stats.bytesSent += this.getMessageSize(data);
    } else {
      // SSE is receive-only, would need to use fetch for sending
      this.log('Cannot send messages via SSE');
    }
  }

  /**
   * Send authentication message
   */
  private sendAuthMessage(): void {
    this.sendMessage({
      type: 'auth',
      payload: {
        apiKey: this.config.apiKey,
        sessionId: this.sessionId,
        capabilities: {
          compression: this.config.enableCompression,
          batching: this.config.enableBatching,
          differential: true
        }
      }
    }, 'high');
  }

  /**
   * Queue message for later sending
   */
  private queueMessage(message: any, priority: MessagePriority): void {
    if (this.messageQueue.length >= this.config.messageQueueSize) {
      // Remove oldest low priority message
      const lowPriorityIndex = this.messageQueue.findIndex(
        m => m.priority === 'low'
      );
      
      if (lowPriorityIndex !== -1) {
        this.messageQueue.splice(lowPriorityIndex, 1);
      } else if (priority !== 'high') {
        // Don't queue if full and not high priority
        return;
      }
    }

    this.messageQueue.push({
      message,
      timestamp: Date.now(),
      attempts: 0,
      priority
    });

    // Sort by priority
    this.messageQueue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Process queued messages
   */
  private async processQueuedMessages(): Promise<void> {
    while (this.messageQueue.length > 0 && this.connectionState === 'connected') {
      const queued = this.messageQueue.shift();
      if (!queued) break;

      try {
        await this.sendMessageInternal(queued.message);
      } catch (error) {
        this.log('Failed to send queued message:', error);
        
        queued.attempts++;
        if (queued.attempts < 3) {
          this.messageQueue.unshift(queued);
        }
        
        break;
      }
    }
  }

  /**
   * Schedule batch sending
   */
  private scheduleBatch(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.sendBatch();
      this.batchTimer = null;
    }, this.config.batchInterval);
  }

  /**
   * Send batched messages
   */
  private async sendBatch(): Promise<void> {
    if (this.messageBuffer.length === 0) return;

    const batch = this.messageBuffer.splice(0, this.messageBuffer.length);
    
    await this.sendMessageInternal({
      id: this.generateMessageId(),
      type: 'batch',
      payload: batch,
      timestamp: new Date().toISOString(),
      sequence: this.sequenceNumber++
    });
  }

  // ============================================================================
  // Heartbeat Management
  // ============================================================================

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Restart heartbeat timer
   */
  private restartHeartbeat(): void {
    this.startHeartbeat();
  }

  /**
   * Send heartbeat message
   */
  private sendHeartbeat(): void {
    // Check if connection is stale
    const timeSinceLastMessage = Date.now() - this.lastMessageTime;
    if (timeSinceLastMessage > this.config.heartbeatInterval * 2) {
      this.log('Connection appears stale, reconnecting');
      this.disconnect();
      this.connect();
      return;
    }

    this.sendMessage({
      type: 'ping',
      payload: { 
        timestamp: new Date().toISOString(),
        stats: {
          messagesReceived: this.stats.messagesReceived,
          latency: this.stats.latency
        }
      }
    }, 'low');
  }

  // ============================================================================
  // Compression
  // ============================================================================

  /**
   * Initialize compression worker
   */
  private initializeCompressionWorker(): void {
    if (!this.config.enableCompression) return;

    try {
      // Create inline worker for compression
      const workerCode = `
        self.onmessage = async function(e) {
          const { type, data } = e.data;
          
          if (type === 'compress') {
            const encoder = new TextEncoder();
            const input = encoder.encode(data);
            
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue(input);
                controller.close();
              }
            });
            
            const compressedStream = stream.pipeThrough(
              new CompressionStream('gzip')
            );
            
            const chunks = [];
            const reader = compressedStream.getReader();
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            
            const compressed = new Uint8Array(
              chunks.reduce((acc, chunk) => acc + chunk.length, 0)
            );
            
            let offset = 0;
            for (const chunk of chunks) {
              compressed.set(chunk, offset);
              offset += chunk.length;
            }
            
            self.postMessage({ type: 'compressed', data: compressed });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.compressionWorker = new Worker(workerUrl);
    } catch (error) {
      this.log('Failed to initialize compression worker:', error);
      this.config.enableCompression = false;
    }
  }

  /**
   * Compress data
   */
  private async compress(data: string): Promise<ArrayBuffer> {
    if (!this.compressionWorker) {
      return new TextEncoder().encode(data).buffer;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Compression timeout'));
      }, 5000);

      this.compressionWorker!.onmessage = (e) => {
        clearTimeout(timeout);
        if (e.data.type === 'compressed') {
          resolve(e.data.data.buffer);
        }
      };

      this.compressionWorker!.postMessage({
        type: 'compress',
        data
      });
    });
  }

  /**
   * Decompress data
   */
  private async decompress(data: ArrayBuffer): Promise<string> {
    try {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(data));
          controller.close();
        }
      });

      const decompressedStream = stream.pipeThrough(
        new (globalThis as any).DecompressionStream('gzip')
      );

      const chunks: Uint8Array[] = [];
      const reader = decompressedStream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const decompressed = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      );

      let offset = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }

      return new TextDecoder().decode(decompressed);
    } catch (error) {
      this.log('Decompression failed:', error);
      return new TextDecoder().decode(data);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Update connection state
   */
  private updateConnectionState(state: ConnectionState): void {
    const oldState = this.connectionState;
    this.connectionState = state;
    this.stats.state = state;

    if (oldState !== state) {
      this.log(`Connection state: ${oldState} -> ${state}`);
      
      if (this.handlers.onConnectionStateChange) {
        this.handlers.onConnectionStateChange(state);
      }
      
      this.emit('state-change', state);
    }
  }

  /**
   * Record error
   */
  private recordError(
    type: ConnectionError['type'],
    message: string,
    fatal: boolean = false
  ): void {
    const error: ConnectionError = {
      timestamp: new Date(),
      type,
      message,
      fatal
    };

    this.stats.errors.push(error);

    // Keep only last 100 errors
    if (this.stats.errors.length > 100) {
      this.stats.errors.shift();
    }

    if (this.handlers.onError) {
      this.handlers.onError(error);
    }

    this.emit('error', error);
  }

  /**
   * Build connection URL
   */
  private buildConnectionUrl(protocol: string): string {
    const baseUrl = this.config.url.replace(/^https?:/, protocol + ':');
    const params = new URLSearchParams({
      api_key: this.config.apiKey,
      session_id: this.sessionId,
      compression: this.config.enableCompression.toString()
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Get message size in bytes
   */
  private getMessageSize(data: any): number {
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (typeof data === 'string') {
      return new Blob([data]).size;
    } else {
      return JSON.stringify(data).length;
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Log message (if debug enabled)
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[EventStream]', ...args);
    }
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Request sync from server
   */
  requestSync(since?: string): void {
    this.sendMessage({
      type: 'sync-request',
      payload: {
        since,
        sessionId: this.sessionId
      }
    }, 'high');
  }

  /**
   * Subscribe to event types
   */
  subscribe(eventTypes: string[]): void {
    this.sendMessage({
      type: 'subscribe',
      payload: { eventTypes }
    });
  }

  /**
   * Unsubscribe from event types
   */
  unsubscribe(eventTypes: string[]): void {
    this.sendMessage({
      type: 'unsubscribe',
      payload: { eventTypes }
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();

    if (this.compressionWorker) {
      this.compressionWorker.terminate();
      this.compressionWorker = null;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and configure an EventStream client
 */
export function createEventStreamClient(
  config: EventStreamConfig,
  handlers?: StreamEventHandlers
): EventStreamClient {
  return new EventStreamClient(config, handlers);
}

// ============================================================================
// Export Default Instance
// ============================================================================

export default EventStreamClient;
