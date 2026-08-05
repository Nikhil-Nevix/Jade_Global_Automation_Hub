/**
 * WebSocket Service
 * Manages Socket.IO connection for real-time communication
 */
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnecting: boolean = false;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;

  /**
   * Initialize WebSocket connection
   */
  connect(url: string = 'http://localhost:5000', path: string = '/socket.io'): void {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('[WebSocket] Connection already in progress');
      return;
    }

    // Limit connection attempts to prevent spam
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.warn('[WebSocket] Max connection attempts reached. Please check if backend is running.');
      return;
    }

    this.isConnecting = true;
    this.connectionAttempts++;

    console.log(`[WebSocket] Connecting to ${url} (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})...`);

    this.socket = io(url, {
      path,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] ✓ Connected successfully:', this.socket?.id);
      this.isConnecting = false;
      this.connectionAttempts = 0; // Reset on successful connection
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[WebSocket] Connection failed:', error.message);
      this.isConnecting = false;
      
      // Stop trying after max attempts
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        this.disconnect();
        console.error('[WebSocket] ✗ Could not connect. Is the backend server running?');
      }
    });

    // Set up event listeners for all registered events
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket?.on(event, callback as any);
      });
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      console.log('[WebSocket] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.connectionAttempts = 0;
  }

  /**
   * Reset connection attempts (call this when user manually retries)
   */
  resetConnectionAttempts(): void {
    this.connectionAttempts = 0;
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    // If socket is already connected, register the listener immediately
    if (this.socket?.connected) {
      this.socket.on(event, callback as any);
    }
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }

    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }

  /**
   * Emit an event
   */
  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const socketService = new SocketService();
