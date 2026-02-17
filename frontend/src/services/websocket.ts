/**
 * WebSocket Service for Real-time Job Logs
 * Manages Socket.IO connection and job log subscriptions
 */
import { io, Socket } from 'socket.io-client';

// Extract base URL from VITE_API_URL (remove /api suffix if present)
const getBackendUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://0.0.0.0:5000/api';
  return apiUrl.replace(/\/api$/, '');
};

const BACKEND_URL = getBackendUrl();

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Initialize WebSocket connection
   */
  connect(token?: string): void {
    if (this.socket?.connected) {
      return;
    }

    const socketOptions: any = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    };

    // Add auth if token provided
    if (token) {
      socketOptions.auth = { token };
      socketOptions.query = { token };
    }

    this.socket = io(BACKEND_URL, socketOptions);

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Subscribe to job logs
   */
  subscribeToJob(jobId: number, callbacks: {
    onLog?: (data: any) => void;
    onStatus?: (data: any) => void;
    onSubscribed?: (data: any) => void;
    onError?: (data: any) => void;
  }): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }

    // Register event listeners
    if (callbacks.onLog) {
      this.socket.on('job_log', callbacks.onLog);
    }

    if (callbacks.onStatus) {
      this.socket.on('job_status', callbacks.onStatus);
    }

    if (callbacks.onSubscribed) {
      this.socket.once('subscribed', callbacks.onSubscribed);
    }

    if (callbacks.onError) {
      this.socket.on('error', callbacks.onError);
    }

    // Subscribe to job
    this.socket.emit('subscribe_job', { job_id: jobId });
  }

  /**
   * Unsubscribe from job logs
   */
  unsubscribeFromJob(jobId: number): void {
    if (!this.socket) {
      return;
    }

    // Remove all job-related listeners
    this.socket.off('job_log');
    this.socket.off('job_status');
    this.socket.off('subscribed');

    // Unsubscribe from job
    this.socket.emit('unsubscribe_job', { job_id: jobId });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
