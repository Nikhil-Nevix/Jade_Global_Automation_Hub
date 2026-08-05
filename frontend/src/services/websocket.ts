/**
 * WebSocket Service for Real-time Job Logs
 * Manages Socket.IO connection and job log subscriptions.
 *
 * Key design decisions:
 *  - Callbacks are stored by jobId so socket.off() can remove the exact function
 *    reference and not accidentally remove unrelated listeners.
 *  - Exponential back-off is applied manually after Socket.IO exhausts its own
 *    reconnection attempts, so the browser never enters a reconnection storm.
 */
import { io, Socket } from 'socket.io-client';
import { getBackendBaseUrl } from '../config/network';

const BACKEND_URL = getBackendBaseUrl();

interface JobCallbacks {
  onLog?: (data: any) => void;
  onStatus?: (data: any) => void;
  onError?: (data: any) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  // Stores the exact callback references per jobId so we can cleanly remove them
  private jobCallbacks: Map<number, JobCallbacks> = new Map();
  // Manual back-off timer after Socket.IO exhausts its built-in retries
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;

  connect(token?: string): void {
    if (this.socket?.connected) {
      return;
    }

    // Cancel any pending back-off retry
    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }

    const socketOptions: any = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: this.maxReconnectAttempts,
    };

    if (token) {
      socketOptions.auth = { token };
      socketOptions.query = { token };
    }

    this.socket = io(BACKEND_URL, socketOptions);

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {});

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 60_000);
        this.backoffTimer = setTimeout(() => {
          this.reconnectAttempts = 0;
          this.connect(token);
        }, delay);
      }
    });

    this.socket.on('error', () => {});
  }

  disconnect(): void {
    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
    if (this.socket) {
      // Remove all tracked callbacks before disconnecting
      this.jobCallbacks.forEach((_, jobId) => this._removeListeners(jobId));
      this.jobCallbacks.clear();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeToJob(
    jobId: number,
    callbacks: {
      onLog?: (data: any) => void;
      onStatus?: (data: any) => void;
      onSubscribed?: (data: any) => void;
      onError?: (data: any) => void;
    }
  ): void {
    if (!this.socket) {
      return;
    }

    // Remove any stale listeners for this jobId before adding new ones
    if (this.jobCallbacks.has(jobId)) {
      this._removeListeners(jobId);
    }

    // Store the exact references so unsubscribeFromJob can remove them precisely
    const stored: JobCallbacks = {};
    if (callbacks.onLog) {
      stored.onLog = callbacks.onLog;
      this.socket.on('job_log', callbacks.onLog);
    }
    if (callbacks.onStatus) {
      stored.onStatus = callbacks.onStatus;
      this.socket.on('job_status', callbacks.onStatus);
    }
    if (callbacks.onError) {
      stored.onError = callbacks.onError;
      this.socket.on('error', callbacks.onError);
    }
    this.jobCallbacks.set(jobId, stored);

    // one-time subscribed ack — no need to store, socket.once removes itself
    if (callbacks.onSubscribed) {
      this.socket.once('subscribed', callbacks.onSubscribed);
    }

    this.socket.emit('subscribe_job', { job_id: jobId });
  }

  unsubscribeFromJob(jobId: number): void {
    if (!this.socket) {
      return;
    }
    this._removeListeners(jobId);
    this.socket.emit('unsubscribe_job', { job_id: jobId });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  private _removeListeners(jobId: number): void {
    const cbs = this.jobCallbacks.get(jobId);
    if (!cbs || !this.socket) return;

    if (cbs.onLog) this.socket.off('job_log', cbs.onLog);
    if (cbs.onStatus) this.socket.off('job_status', cbs.onStatus);
    if (cbs.onError) this.socket.off('error', cbs.onError);

    this.jobCallbacks.delete(jobId);
  }
}

export const webSocketService = new WebSocketService();
