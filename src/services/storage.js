const ACTIVE_SESSION_KEY = 'wb_active_session';
const ACTIVE_PRIVATE_KEY = 'wb_active_private_key';
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
const MESSAGE_CACHE_LIMIT = 60;

const trimMessageForCache = (message) => {
  const next = { ...message };

  // The payload can be rebuilt from the server; keeping it locally quickly blows past quota.
  delete next.payload;

  if (typeof next.decrypted === 'string') {
    try {
      const parsed = JSON.parse(next.decrypted);
      if (parsed?.v === 1 && parsed.image) {
        next.decrypted = JSON.stringify({
          ...parsed,
          image: null,
          imageCachedOut: true,
          imageName: parsed.imageName || null,
        });
      }
    } catch {
      // Leave legacy/plaintext decrypted values untouched.
    }
  }

  return next;
};

const safeLocalStorageSet = (key, value, fallbackReducer = null) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error?.name !== 'QuotaExceededError' && !String(error).includes('quota')) {
      throw error;
    }

    if (typeof fallbackReducer === 'function') {
      try {
        localStorage.setItem(key, fallbackReducer());
        return true;
      } catch {
        localStorage.removeItem(key);
      }
    } else {
      localStorage.removeItem(key);
    }

    return false;
  }
};

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
    sessionStorage.removeItem(ACTIVE_PRIVATE_KEY);
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

  setPrivateKey(privateKeyBase64) {
    if (!privateKeyBase64) return;
    sessionStorage.setItem(ACTIVE_PRIVATE_KEY, privateKeyBase64);
  },

  getPrivateKey() {
    return sessionStorage.getItem(ACTIVE_PRIVATE_KEY);
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
    const key = makeUserKey('wb_conversations', userId);
    const trimmed = conversations.slice(0, 100);
    safeLocalStorageSet(key, JSON.stringify(trimmed), () => JSON.stringify(trimmed.slice(0, 40)));
  },

  getMessages(userId, partnerId) {
    if (!userId || !partnerId) return [];
    return safeJsonParse(localStorage.getItem(makeUserKey(`messages_${partnerId}`, userId)), []);
  },

  setMessages(userId, partnerId, messages) {
    if (!userId || !partnerId) return;
    const key = makeUserKey(`messages_${partnerId}`, userId);
    const trimmed = messages.slice(-MESSAGE_CACHE_LIMIT).map(trimMessageForCache);
    safeLocalStorageSet(key, JSON.stringify(trimmed), () =>
      JSON.stringify(trimmed.slice(-25).map((message) => ({ ...message, decrypted: typeof message.decrypted === 'string' ? message.decrypted.slice(0, 500) : message.decrypted })))
    );
  },

  clearMessages(userId, partnerId) {
    if (!userId || !partnerId) return;
    localStorage.removeItem(makeUserKey(`messages_${partnerId}`, userId));
  },
};
