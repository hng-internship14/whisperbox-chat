import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import { socketService } from '../services/socket';
import { sessionStorageService, userStorageService } from '../services/storage';
import { 
  deriveWrappingKey, 
  unwrapPrivateKey, 
  generateIdentityKeys, 
  generateSalt, 
  wrapPrivateKey,
  importPrivateKey
} from '../crypto';

const AuthContext = createContext(null);

// ── Helpers ────────────────────────────────────────────────────────────────
const loadExtendedProfile = (userId) => {
  try {
    return userStorageService.getProfile(userId);
  } catch {
    return {};
  }
};

const DEFAULT_SETTINGS = {
  privacy: {
    profileVisibility: 'everyone',   // 'everyone' | 'contacts' | 'nobody'
    phoneVisibility: 'contacts',     // 'everyone' | 'contacts' | 'nobody'
    readReceipts: true,
    typingIndicators: true,
    appLock: false,
    blockedUsers: [],
  },
  notifications: {
    sounds: true,
    showContent: true,
    badgeCounts: true,
    callNotifications: true,
  },
  chat: {
    archivedChats: [],
    disappearingMessages: 'off',    // 'off' | '30s' | '5m' | '1h' | '1d' | '1w'
  },
};

const loadSettings = (userId = null) => {
  try {
    const saved = userStorageService.getSettings(userId);
    if (!saved) return DEFAULT_SETTINGS;
    return {
      privacy: { ...DEFAULT_SETTINGS.privacy, ...saved.privacy },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...saved.notifications },
      chat: { ...DEFAULT_SETTINGS.chat, ...saved.chat },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

// ── Provider ───────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(sessionStorageService.getAccessToken());
  const [privateKey, setPrivateKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appBusy, setAppBusy] = useState(false);
  const [appBusyLabel, setAppBusyLabel] = useState('Loading');
  const [settings, setSettings] = useState(() => loadSettings());
  const [contacts, setContacts] = useState([]);

  // Merge server user with extended localStorage profile
  const mergeUser = useCallback((serverUser) => {
    const ext = loadExtendedProfile(serverUser.id);
    return { ...serverUser, ...ext };
  }, []);

  const logout = useCallback(() => {
    const refreshToken = sessionStorageService.getRefreshToken();
    sessionStorageService.clearActiveSession();
    setToken(null);
    setUser(null);
    setPrivateKey(null);
    setSettings(loadSettings());
    setContacts([]);
    socketService.disconnect();
    if (refreshToken) {
      authService.logout(refreshToken).catch((e) => {
        console.error('Logout error', e);
      });
    }
  }, []);

  // ── Login / Register ───────────────────────────────────────────────────
  const login = async (username, password) => {
    try {
      const data = await authService.login(username, password);
      sessionStorageService.setActiveSession({
        userId: data.user.id,
        username: data.user.username,
        displayName: data.user.display_name,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
      setToken(data.access_token);
      
      const wrappingKey = await deriveWrappingKey(password, data.user.pbkdf2_salt);
      const decryptedPrivateKey = await unwrapPrivateKey(data.user.wrapped_private_key, wrappingKey);
      
      const importedKey = await importPrivateKey(decryptedPrivateKey);
      sessionStorageService.setPrivateKey(decryptedPrivateKey);
      setPrivateKey(importedKey);
      const localProfile = loadExtendedProfile(data.user.id);
      setUser(mergeUser({
        ...data.user,
        public_key: data.user.public_key || localProfile.public_key || null,
      }));
      setSettings(loadSettings(data.user.id));
      setContacts(userStorageService.getContacts(data.user.id));
      socketService.connect(data.access_token);
      return data;
    } catch (e) {
      const errorMsg = e.response?.data?.detail || e.response?.data || e.message;
      console.error('Login error detail:', JSON.stringify(errorMsg, null, 2));
      throw e;
    }
  };

  const register = async (username, displayName, password, profileData = {}) => {
    try {
      const { publicKey, privateKey: rawPrivateKey } = await generateIdentityKeys();
      const salt = generateSalt();
      const wrappingKey = await deriveWrappingKey(password, salt);
      const wrappedPrivateKey = await wrapPrivateKey(rawPrivateKey, wrappingKey);
      
      const data = await authService.register({
        username,
        display_name: displayName,
        password,
        public_key: publicKey,
        wrapped_private_key: wrappedPrivateKey,
        pbkdf2_salt: salt,
      });
      
      sessionStorageService.setActiveSession({
        userId: data.user.id,
        username: data.user.username,
        displayName: data.user.display_name,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
      setToken(data.access_token);
      const importedKey = await importPrivateKey(rawPrivateKey);
      sessionStorageService.setPrivateKey(rawPrivateKey);
      setPrivateKey(importedKey);
      const localProfile = {
        display_name: displayName,
        email: profileData.email || '',
        phone: profileData.phone || '',
        avatar: profileData.avatar || null,
        about: profileData.about || '',
        public_key: publicKey,
      };
      userStorageService.setProfile(data.user.id, localProfile);
      setUser(mergeUser({ ...data.user, ...localProfile, public_key: data.user.public_key || publicKey }));
      setSettings(loadSettings(data.user.id));
      setContacts(userStorageService.getContacts(data.user.id));
      socketService.connect(data.access_token);
      return data;
    } catch (e) {
      console.error('Registration error:', e.response?.data || e.message);
      throw e;
    }
  };

  // ── Profile update ─────────────────────────────────────────────────────
  const updateUserLocal = useCallback((newData) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...newData };
      const ext = {
        display_name: updated.display_name,
        email: updated.email,
        phone: updated.phone,
        avatar: updated.avatar,
        about: updated.about,
        public_key: updated.public_key,
      };
      userStorageService.setProfile(prev.id, ext);
      return updated;
    });
  }, []);

  // ── Broadcast profile update to all connected clients ─────────────────
  const broadcastProfileUpdate = useCallback((profileData) => {
    if (!user) return;
    socketService.send('profile.update', {
      user_id: user.id,
      username: user.username,
      profile: profileData,
    });
  }, [user]);

  // ── Listen for partner profile updates via socket ──────────────────────
  useEffect(() => {
    if (!token) return;
    const removeListener = socketService.addListener((msg) => {
      if (msg.type === 'profile.update' && msg.user_id) {
        // Cache it so ChatPage can pick it up when building conversation lists
        const cached = { ...msg.profile, username: msg.username };
        userStorageService.setProfile(msg.user_id, cached);
      }
    });
    return () => removeListener();
  }, [token]);

  // ── Settings update ────────────────────────────────────────────────────
  const updateSettings = useCallback((section, newValues) => {
    setSettings(prev => {
      const updated = {
        ...prev,
        [section]: { ...prev[section], ...newValues },
      };
      if (user?.id) {
        userStorageService.setSettings(user.id, updated);
      }
      return updated;
    });
  }, [user?.id]);

  // ── Contacts management ────────────────────────────────────────────────
  const addContact = useCallback((contactUser) => {
    setContacts(prev => {
      if (prev.some(c => c.id === contactUser.id)) return prev;
      const updated = [...prev, contactUser];
      if (user?.id) {
        userStorageService.setContacts(user.id, updated);
      }
      return updated;
    });
  }, [user?.id]);

  const removeContact = useCallback((userId) => {
    setContacts(prev => {
      const updated = prev.filter(c => c.id !== userId);
      if (user?.id) {
        userStorageService.setContacts(user.id, updated);
      }
      return updated;
    });
  }, [user?.id]);

  // ── Block / Archive ────────────────────────────────────────────────────
  const blockUser = useCallback((userToBlock) => {
    setSettings(prev => {
      const alreadyBlocked = prev.privacy.blockedUsers.some(u => u.id === userToBlock.id);
      if (alreadyBlocked) return prev;
      const updated = {
        ...prev,
        privacy: { ...prev.privacy, blockedUsers: [...prev.privacy.blockedUsers, userToBlock] },
      };
      if (user?.id) {
        userStorageService.setSettings(user.id, updated);
      }
      return updated;
    });
  }, [user?.id]);

  const unblockUser = useCallback((userId) => {
    setSettings(prev => {
      const updated = {
        ...prev,
        privacy: { ...prev.privacy, blockedUsers: prev.privacy.blockedUsers.filter(u => u.id !== userId) },
      };
      if (user?.id) {
        userStorageService.setSettings(user.id, updated);
      }
      return updated;
    });
  }, [user?.id]);

  const archiveChat = useCallback((userId) => {
    setSettings(prev => {
      if (prev.chat.archivedChats.includes(userId)) return prev;
      const updated = { ...prev, chat: { ...prev.chat, archivedChats: [...prev.chat.archivedChats, userId] } };
      if (user?.id) {
        userStorageService.setSettings(user.id, updated);
      }
      return updated;
    });
  }, [user?.id]);

  const unarchiveChat = useCallback((userId) => {
    setSettings(prev => {
      const updated = { ...prev, chat: { ...prev.chat, archivedChats: prev.chat.archivedChats.filter(id => id !== userId) } };
      if (user?.id) {
        userStorageService.setSettings(user.id, updated);
      }
      return updated;
    });
  }, [user?.id]);

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const accessToken = sessionStorageService.getAccessToken();
      if (accessToken) {
        try {
          const profile = await authService.me();
          const storedPrivateKey = sessionStorageService.getPrivateKey();
          setUser(mergeUser(profile));
          if (storedPrivateKey) {
            const importedKey = await importPrivateKey(storedPrivateKey);
            setPrivateKey(importedKey);
          }
          setSettings(loadSettings(profile.id));
          setContacts(userStorageService.getContacts(profile.id));
          socketService.connect(accessToken);
        } catch (e) {
          logout();
        }
      } else {
        setSettings(loadSettings());
        setContacts([]);
      }
      setLoading(false);
    };
    init();
  }, [logout, mergeUser]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      privateKey,
      loading,
      appBusy,
      appBusyLabel,
      settings,
      contacts,
      login,
      register,
      logout,
      setAppBusy,
      setAppBusyLabel,
      setPrivateKey,
      updateUserLocal,
      broadcastProfileUpdate,
      updateSettings,
      addContact,
      removeContact,
      blockUser,
      unblockUser,
      archiveChat,
      unarchiveChat,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
