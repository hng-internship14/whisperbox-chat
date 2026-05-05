const WS_URL = import.meta.env.VITE_WS_URL || 'wss://whisperbox.koyeb.app/ws';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.reconnectTimeout = null;
    this.token = null;
    this.manualDisconnect = false;
    this.reconnectAttempts = 0;
    this.status = 'idle';
    this.lastError = null;
  }

  _setStatus(status, meta = {}) {
    this.status = status;
    this.lastError = meta.error || null;
    this.statusListeners.forEach((listener) => listener({ status, ...meta }));
  }

  connect(token) {
    // If already connected with same token, do nothing
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.token === token) return;
    // Close existing if token changed
    if (this.socket) {
      this.manualDisconnect = true;
      this.socket.close();
      this.socket = null;
    }
    if (!token) return;
    this.token = token;
    this.manualDisconnect = false;
    this._setStatus('connecting');
    this._open();
  }

  _open() {
    if (!this.token) return;
    this._setStatus('connecting');
    this.socket = new WebSocket(`${WS_URL}?token=${this.token}`);

    this.socket.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      this.lastError = null;
      this._setStatus('connected');
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.listeners.forEach((listener) => listener(data));
      } catch (e) {
        console.error('[WS] bad message', e);
      }
    };

    this.socket.onclose = (ev) => {
      console.log('[WS] Disconnected', ev.code);
      this.socket = null;
      if (!this.manualDisconnect && this.token) {
        this._setStatus('reconnecting', { code: ev.code });
        // Exponential back-off capped at 10s
        const delay = Math.min((this.reconnectAttempts || 1) * 1000, 10000);
        this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
        this.reconnectTimeout = setTimeout(() => this._open(), delay);
      } else {
        this._setStatus('disconnected', { code: ev.code });
      }
    };

    this.socket.onerror = (error) => {
      console.error('[WS] Error:', error);
      this._setStatus('error', { error });
    };
  }

  disconnect() {
    this.manualDisconnect = true;
    this.token = null;
    this.reconnectAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this._setStatus('disconnected');
  }

  send(type, payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Not connected, cannot send:', type);
      return false;
    }
    this.socket.send(JSON.stringify({ type, ...payload }));
    return true;
  }

  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  addStatusListener(listener) {
    this.statusListeners.add(listener);
    listener({ status: this.status, error: this.lastError });
    return () => this.statusListeners.delete(listener);
  }

  isConnected() {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
  }

  getStatus() {
    return this.status;
  }
}

export const socketService = new SocketService();
