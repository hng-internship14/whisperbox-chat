const ACTIVE_SESSION_KEY = 'wb_active_session';
const SESSION_LIST_KEY = 'wb_sessions';

const safeJsonParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const makeUserKey = (prefix, userId) => `${prefix}_${userId}`;

export const sessionStorageService = {
  getActiveSession() {
    const session = safeJsonParse(sessionStorage.getItem(ACTIVE_SESSION_KEY), null);
    if (session?.accessToken && session?.refreshToken) {
      return session;
    }

    // Legacy fallback for older installs.
    const accessToken = sessionStorage.getItem('access_token');
    const refreshToken = sessionStorage.getItem('refresh_token');
    if (accessToken && refreshToken) {
      return { accessToken, refreshToken };
    }
    return null;
  },

  setActiveSession(session) {
    if (!session) return;
    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem('access_token', session.accessToken);
    sessionStorage.setItem('refresh_token', session.refreshToken);

    const sessions = this.listSessions().filter((item) => item.userId !== session.userId);
    sessions.unshift({
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      savedAt: Date.now(),
    });
    localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessions.slice(0, 10)));
  },

  clearActiveSession() {
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
  },

  getAccessToken() {
    return this.getActiveSession()?.accessToken || null;
  },

  getRefreshToken() {
    return this.getActiveSession()?.refreshToken || null;
  },

  listSessions() {
    return safeJsonParse(localStorage.getItem(SESSION_LIST_KEY), []);
  },
};

export const userStorageService = {
  getProfile(userId) {
    if (!userId) return {};
    return safeJsonParse(localStorage.getItem(`profile_${userId}`), {});
  },

  setProfile(userId, value) {
    if (!userId) return;
    localStorage.setItem(`profile_${userId}`, JSON.stringify(value));
  },

  getSettings(userId) {
    if (!userId) {
      return safeJsonParse(localStorage.getItem('wb_settings'), null);
    }
    return safeJsonParse(localStorage.getItem(makeUserKey('wb_settings', userId)), null);
  },

  setSettings(userId, value) {
    if (!userId) return;
    localStorage.setItem(makeUserKey('wb_settings', userId), JSON.stringify(value));
  },

  getContacts(userId) {
    if (!userId) {
      return safeJsonParse(localStorage.getItem('wb_contacts'), []);
    }
    return safeJsonParse(localStorage.getItem(makeUserKey('wb_contacts', userId)), []);
  },

  setContacts(userId, value) {
    if (!userId) return;
    localStorage.setItem(makeUserKey('wb_contacts', userId), JSON.stringify(value));
  },

  getStories(userId) {
    if (!userId) {
      return safeJsonParse(localStorage.getItem('wb_stories'), []);
    }
    return safeJsonParse(localStorage.getItem(makeUserKey('wb_stories', userId)), []);
  },

  setStories(userId, value) {
    if (!userId) return;
    localStorage.setItem(makeUserKey('wb_stories', userId), JSON.stringify(value));
  },

  getCallLogs(userId) {
    if (!userId) {
      return safeJsonParse(localStorage.getItem('wb_call_logs'), []);
    }
    return safeJsonParse(localStorage.getItem(makeUserKey('wb_call_logs', userId)), []);
  },

  setCallLogs(userId, value) {
    if (!userId) return;
    localStorage.setItem(makeUserKey('wb_call_logs', userId), JSON.stringify(value));
  },

  clearCallLogs(userId) {
    if (!userId) return;
    localStorage.removeItem(makeUserKey('wb_call_logs', userId));
  },

  getConversations(userId) {
    if (!userId) return [];
    return safeJsonParse(localStorage.getItem(makeUserKey('wb_conversations', userId)), []);
  },

  setConversations(userId, conversations) {
    if (!userId) return;
    localStorage.setItem(makeUserKey('wb_conversations', userId), JSON.stringify(conversations.slice(0, 200)));
  },

  getMessages(userId, partnerId) {
    if (!userId || !partnerId) return [];
    return safeJsonParse(localStorage.getItem(makeUserKey(`messages_${partnerId}`, userId)), []);
  },

  setMessages(userId, partnerId, messages) {
    if (!userId || !partnerId) return;
    // Keep last 200 messages locally
    localStorage.setItem(makeUserKey(`messages_${partnerId}`, userId), JSON.stringify(messages.slice(-200)));
  },

  clearMessages(userId, partnerId) {
    if (!userId || !partnerId) return;
    localStorage.removeItem(makeUserKey(`messages_${partnerId}`, userId));
  },
};
