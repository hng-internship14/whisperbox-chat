import axios from 'axios';
import { socketService } from './socket';
import { sessionStorageService, userStorageService } from './storage';

// Use the Vite proxy in development to bypass CORS.
// In production, set VITE_API_URL to your actual backend URL.
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorageService.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = sessionStorageService.getRefreshToken();
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${BASE_URL}/auth/refresh`, { 
            refresh_token: refreshToken 
          });
          const { access_token } = response.data;
          const currentSession = sessionStorageService.getActiveSession();
          
          sessionStorageService.setActiveSession({
            ...(currentSession || {}),
            accessToken: access_token,
            refreshToken,
          });
          api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
          
          // Reconnect socket with new token (connect() handles replacing existing socket)
          socketService.connect(access_token);
          
          return api(originalRequest);
        } catch (refreshError) {
          sessionStorageService.clearActiveSession();
          window.location.href = '/';
          return Promise.reject(refreshError);
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async register(data) {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  async login(username, password) {
    // Reverting to JSON as form-data was rejected with 422.
    // Including grant_type in case it's required in JSON.
    const response = await api.post('/auth/login', { 
      username, 
      password,
      grant_type: 'password' 
    });
    return response.data;
  },

  async me() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async refresh(refreshToken) {
    const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },

  async logout(refreshToken) {
    const response = await api.post('/auth/logout', { refresh_token: refreshToken });
    return response.data;
  },
};

export const userService = {
  async search(query) {
    const response = await api.get('/users/search', { params: { q: query } });
    return response.data;
  },

  async getPublicKey(userId) {
    const response = await api.get(`/users/${userId}/public-key`);
    return response.data.public_key;
  },
};

export const messageService = {
  async listConversations() {
    const response = await api.get('/conversations');
    return response.data;
  },

  async getHistory(userId, before = null) {
    const response = await api.get(`/conversations/${userId}/messages`, {
      params: { before, limit: 50 },
    });
    return response.data;
  },

  async sendMessage(userId, payload) {
    const response = await api.post('/messages', {
      to: userId,
      payload: payload,
    });
    return response.data;
  },
};

// ── Local-only services (no backend endpoints) ──────────────────────────────

export const storyService = {
  STORY_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours

  getAll(userId) {
    try {
      const stories = userStorageService.getStories(userId);
      const now = Date.now();
      // Filter out expired stories
      return stories.filter(s => now - s.createdAt < this.STORY_TTL_MS);
    } catch {
      return [];
    }
  },

  save(userId, stories) {
    userStorageService.setStories(userId, stories);
  },

  addStory(ownerUserId, displayName, avatar, content, type = 'text') {
    const stories = this.getAll(ownerUserId);
    const newStory = {
      id: `story_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      userId: ownerUserId,
      displayName,
      avatar,
      content,
      type, // 'text' | 'image'
      createdAt: Date.now(),
      viewedBy: [],
    };
    stories.push(newStory);
    this.save(ownerUserId, stories);
    return newStory;
  },

  markViewed(ownerUserId, storyId, viewerUserId) {
    const stories = this.getAll(ownerUserId);
    const idx = stories.findIndex(s => s.id === storyId);
    if (idx !== -1 && !stories[idx].viewedBy.includes(viewerUserId)) {
      stories[idx].viewedBy.push(viewerUserId);
      this.save(ownerUserId, stories);
    }
  },

  deleteStory(ownerUserId, storyId) {
    const stories = this.getAll(ownerUserId).filter(s => s.id !== storyId);
    this.save(ownerUserId, stories);
  },

  getStoriesForContacts(contactUserIds, currentUserId) {
    const stories = this.getAll(currentUserId);
    const validUserIds = new Set([...contactUserIds, currentUserId]);
    return stories.filter(s => validUserIds.has(s.userId));
  },
};

export const callLogService = {
  getAll(userId) {
    try {
      return userStorageService.getCallLogs(userId);
    } catch {
      return [];
    }
  },

  addLog(userId, log) {
    const logs = this.getAll(userId);
    logs.unshift({ ...log, id: `call_${Date.now()}`, timestamp: Date.now() });
    // Keep last 100
    userStorageService.setCallLogs(userId, logs.slice(0, 100));
  },

  clear(userId) {
    userStorageService.clearCallLogs(userId);
  },
};

export default api;
