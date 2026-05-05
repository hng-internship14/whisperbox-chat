import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { messageService, userService, storyService } from '../services/api';
import { userStorageService } from '../services/storage';
import { socketService } from '../services/socket';
import { notificationService } from '../services/notifications';
import { encryptMessage, decryptMessage } from '../crypto';
import { 
  Search, 
  Send, 
  ShieldCheck, 
  MoreVertical,
  Plus,
  Loader2,
  Camera,
  Edit,
  MessageSquare,
  Phone,
  Video,
  Settings,
  Archive,
  Ban,
  Trash2,
  Check,
  ChevronLeft,
  X,
  Reply,
  CheckCheck,
  RotateCcw,
  ArrowLeft,
  Clock3,
  ImageIcon,
  MapPin,
  UserRound,
  FileText,
  BarChart3,
  CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { useWebRTC, CALL_STATE } from '../hooks/useWebRTC';
import CallOverlay from '../components/CallOverlay';
import CallsPage from './CallsPage';
import StoriesPage from './StoriesPage';

const getChatUserId = (chat) => chat?.user_id || chat?.id || null;

const mergeMessages = (currentMessages, incomingMessages) => {
  const map = new Map();
  [...currentMessages, ...incomingMessages].forEach((message) => {
    const key = message.id ?? message.tempId ?? `${message.from_user_id}-${message.to_user_id}-${message.created_at}`;
    map.set(key, { ...(map.get(key) || {}), ...message });
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

const buildMessageEnvelope = ({ text, replyToId = null, attachment = null }) => {
  if (!attachment && !replyToId) {
    return text;
  }

  return JSON.stringify({
    v: 1,
    type: attachment ? 'image' : 'text',
    text: text || '',
    image: attachment ? attachment.dataUrl : null,
    imageName: attachment?.name || null,
    replyToId,
  });
};

const parseMessageEnvelope = (value) => {
  if (!value) {
    return { text: '', replyToId: null, image: null, imageName: null };
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && parsed.v === 1) {
      return {
        text: parsed.text || '',
        replyToId: parsed.replyToId || null,
        image: parsed.image || null,
        imageName: parsed.imageName || null,
      };
    }
  } catch {
    // Fall through to legacy parsing.
  }

  const legacyReply = value.match(/Ref:\[(.*?)\]\n([\s\S]*)/);
  if (legacyReply) {
    return {
      text: legacyReply[2],
      replyToId: legacyReply[1],
      image: null,
      imageName: null,
    };
  }

  return { text: value, replyToId: null, image: null, imageName: null };
};

const buildConversationPreview = (messageValue) => {
  const parsed = parseMessageEnvelope(messageValue);
  if (parsed.image && parsed.text) return `${parsed.text} [image]`;
  if (parsed.image) return '[image]';
  return parsed.text || 'Secure channel active';
};

const DISAPPEARING_OPTIONS = [
  { key: 'off', label: 'Off' },
  { key: '30s', label: '30 Seconds' },
  { key: '5m', label: '5 Minutes' },
  { key: '1h', label: '1 Hour' },
  { key: '1d', label: '1 Day' },
  { key: '1w', label: '1 Week' },
];

const mergePartnerProfile = (partner) => {
  if (!partner) return partner;
  const cached = userStorageService.getProfile(partner.user_id || partner.id);
  return { ...partner, ...cached };
};

const persistConversationProfiles = (conversations) => {
  conversations.forEach((conversation) => {
    const partnerId = conversation.user_id || conversation.id;
    if (!partnerId) return;
    userStorageService.setProfile(partnerId, {
      ...userStorageService.getProfile(partnerId),
      ...conversation,
    });
  });
};

const ChatPage = ({ onOpenProfile, onOpenSettings, onOpenSearch, initialChat }) => {
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const { 
    user, 
    token,
    logout, 
    privateKey, 
    settings, 
    contacts,
    addContact,
    updateSettings,
    archiveChat, 
    unarchiveChat, 
    blockUser 
  } = useAuth();
  
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'calls' | 'stories'
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // UI States
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [editMode, setEditMode] = useState(null); // { id, text }
  const [filterUnread, setFilterUnread] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [presenceByUserId, setPresenceByUserId] = useState({});
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [showDisappearOptions, setShowDisappearOptions] = useState(false);
  const [actionToast, setActionToast] = useState('');
  const [socketStatus, setSocketStatus] = useState(() => socketService.getStatus());
  
  const messagesEndRef = useRef(null);
  const dropdownRef = useRef(null);
  const chatMenuRef = useRef(null);
  const selectedChatRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const conversationsRef = useRef([]);

  const upsertConversation = useCallback((partnerData) => {
    setConversations(prev => {
      const existing = prev.find(item => item.user_id === partnerData.user_id);
      const merged = { ...(existing || {}), ...partnerData };
      const nextConversations = existing
        ? [merged, ...prev.filter(item => item.user_id !== partnerData.user_id)]
        : [merged, ...prev];
      persistConversationProfiles(nextConversations);
      if (user?.id) {
        userStorageService.setConversations(user.id, nextConversations);
      }
      return nextConversations;
    });
  }, [user?.id]);

  const showToast = useCallback((message) => {
    setActionToast(message);
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setActionToast(''), 2200);
  }, []);

  const persistMessagesForPartner = useCallback((partnerId, nextMessages) => {
    if (!user?.id || !partnerId) return;
    userStorageService.setMessages(user.id, partnerId, nextMessages);
  }, [user?.id]);

  // WebRTC
  const rtc = useWebRTC({ 
    user, 
    onCallStateChange: undefined,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (editMode) {
      setInputText(editMode.text);
    }
  }, [editMode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target)) {
        setShowChatMenu(false);
        setShowDisappearOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await messageService.listConversations();
      // Add mock unread for demo if needed, or use real data if backend supports
      const nextConversations = data.map(mergePartnerProfile);
      persistConversationProfiles(nextConversations);
      setConversations(nextConversations);
      if (user?.id) {
        userStorageService.setConversations(user.id, nextConversations);
      }
      setPresenceByUserId(prev => {
        const next = { ...prev };
        data.forEach((conversation) => {
          next[conversation.user_id] = {
            online: Boolean(conversation.online),
            lastSeenAt: conversation.last_seen_at || prev[conversation.user_id]?.lastSeenAt || null,
          };
        });
        return next;
      });
    } catch (e) {
      console.error('Failed to fetch conversations', e);
    }
  }, [user?.id]);

  const loadChatHistory = useCallback(async (chat, { merge = false } = {}) => {
    const chatUserId = getChatUserId(chat);
    if (!chatUserId || !user?.id) return;

    // Load from local cache first for instant UI
    if (!merge) {
      const localCached = userStorageService.getMessages(user.id, chatUserId);
      if (localCached.length > 0) {
        setMessages(localCached);
      }
    }

    setLoadingHistory(true);
    try {
      const history = await messageService.getHistory(chatUserId);
      const decryptedHistory = await Promise.all(history.map(async (msg) => {
        try {
          if (privateKey) {
            msg.decrypted = await decryptMessage(msg.payload, privateKey);
          } else {
            msg.decrypted = '[Encrypted]';
          }
        } catch (e) {
          msg.decrypted = '[Decryption Failed]';
        }
        return msg;
      }));
      const orderedHistory = decryptedHistory.reverse();
      setMessages(prev => {
        const merged = merge ? mergeMessages(prev, orderedHistory) : mergeMessages(userStorageService.getMessages(user.id, chatUserId), orderedHistory);
        // Persist to local cache
        userStorageService.setMessages(user.id, chatUserId, merged);
        return merged;
      });
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [privateKey, user?.id]);

  useEffect(() => {
    if (user?.id) {
      const cachedConversations = userStorageService.getConversations(user.id).map(mergePartnerProfile);
      if (cachedConversations.length > 0) {
        setConversations(cachedConversations);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (initialChat) {
      setSelectedChat(mergePartnerProfile(initialChat));
    }
  }, [initialChat]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    conversationsRef.current = conversations;
    if (user?.id && conversations.length > 0) {
      userStorageService.setConversations(user.id, conversations);
    }
  }, [conversations]);

  useEffect(() => {
    if (settings.notifications?.callNotifications || settings.notifications?.sounds || settings.notifications?.showContent) {
      notificationService.requestPermission();
    }
  }, [settings.notifications]);

  useEffect(() => {
    const removeStatusListener = socketService.addStatusListener(({ status }) => {
      setSocketStatus(status);
    });
    return () => removeStatusListener();
  }, []);

  // Socket Listeners
  useEffect(() => {
    if (!token || !privateKey) return;

    const removeListener = socketService.addListener(async (msg) => {
      // 1. Handle incoming/sent messages
      if (msg.type === 'message.receive' || msg.type === 'message.sent' || msg.type === 'message.incoming') {
        try {
          msg.decrypted = await decryptMessage(msg.payload, privateKey);
        } catch (e) {
          msg.decrypted = '[Decryption Failed]';
        }

        const partnerId = msg.from_user_id === user.id ? msg.to_user_id : msg.from_user_id;
        const messageMeta = parseMessageEnvelope(msg.decrypted);
        
        if (selectedChatRef.current && getChatUserId(selectedChatRef.current) === partnerId) {
          setMessages(prev => {
            // Check if message already exists (e.g. from optimistic update or confirmation)
            const exists = prev.some(m => m.id === msg.id || (m.tempId && m.tempId === msg.tempId));
            let next;
            if (exists) {
              next = prev.map(m => (m.id === msg.id || (m.tempId && m.tempId === msg.tempId)) ? { ...m, ...msg, tempId: undefined } : m);
            } else {
              next = mergeMessages(prev, [msg]);
            }
            // Persist
            userStorageService.setMessages(user.id, partnerId, next);
            return next;
          });
          
          if (msg.from_user_id !== user.id) {
            socketService.send('message.delivered', { message_id: msg.id, from_user_id: user.id, to_user_id: partnerId });
          }
          // Send read receipt if it's incoming
          if (msg.from_user_id !== user.id && settings.privacy.readReceipts) {
             socketService.send('message.read', { message_id: msg.id, from_user_id: user.id, to_user_id: partnerId });
          }
        } else {
          // Even if not selected, we should persist incoming messages to local cache
          if (msg.type === 'message.receive' || msg.type === 'message.incoming') {
            const cached = userStorageService.getMessages(user.id, partnerId);
            const exists = cached.some(m => m.id === msg.id);
            if (!exists) {
               userStorageService.setMessages(user.id, partnerId, mergeMessages(cached, [msg]));
            }
            socketService.send('message.delivered', { message_id: msg.id, from_user_id: user.id, to_user_id: partnerId });
            if (document.hidden) {
              notificationService.notifyIncomingMessage(
                msg.sender_display_name || msg.sender_username || 'New message',
                settings.notifications?.showContent === false
                  ? 'New message'
                  : (messageMeta.image ? (messageMeta.text ? `${messageMeta.text} [image]` : '[image]') : (messageMeta.text || 'New message')),
                settings.notifications?.sounds !== false
              );
            }
          }
        }
        upsertConversation({
          user_id: partnerId,
          display_name: msg.sender_display_name || conversationsRef.current.find(c => c.user_id === partnerId)?.display_name || selectedChatRef.current?.display_name || 'Unknown',
          username: msg.sender_username || conversationsRef.current.find(c => c.user_id === partnerId)?.username || selectedChatRef.current?.username,
          avatar: msg.sender_avatar || conversationsRef.current.find(c => c.user_id === partnerId)?.avatar || selectedChatRef.current?.avatar || null,
          last_message_at: msg.created_at || new Date().toISOString(),
          last_message_preview: buildConversationPreview(msg.decrypted),
          unread_count: msg.from_user_id !== user.id && (!selectedChatRef.current || getChatUserId(selectedChatRef.current) !== partnerId)
            ? ((conversationsRef.current.find(c => c.user_id === partnerId)?.unread_count || 0) + 1)
            : 0,
        });
        fetchConversations();
      }

      // 2. Handle read receipts
      if (msg.type === 'message.read' && settings.privacy.readReceipts) {
        setMessages(prev => prev.map(m => m.id === msg.message_id ? { ...m, read: true, status: 'read' } : m));
      }

      if (msg.type === 'message.delivered') {
        setMessages(prev => prev.map(m => m.id === msg.message_id ? { ...m, delivered: true, status: m.read ? 'read' : 'delivered' } : m));
      }

      if (msg.type === 'message.edit' && msg.message_id) {
        const partnerId = msg.from_user_id === user.id ? msg.to_user_id : msg.from_user_id;
        setMessages(prev => {
          const next = prev.map(message =>
            message.id === msg.message_id
              ? {
                  ...message,
                  decrypted: msg.payload_preview || message.decrypted,
                  edited: true,
                  edited_at: msg.edited_at || new Date().toISOString(),
                }
              : message
          );
          persistMessagesForPartner(partnerId, next);
          return next;
        });
      }

      // 3. Handle typing indicators
      if (msg.type === 'typing.start' && settings.privacy.typingIndicators) {
        if (selectedChatRef.current && getChatUserId(selectedChatRef.current) === msg.from_user_id) {
          setIsPartnerTyping(true);
        }
      }
      if (msg.type === 'typing.stop') {
        if (selectedChatRef.current && getChatUserId(selectedChatRef.current) === msg.from_user_id) {
          setIsPartnerTyping(false);
        }
      }
      if (msg.type === 'presence.update' && msg.user_id) {
        setPresenceByUserId(prev => ({
          ...prev,
          [msg.user_id]: {
            online: msg.online !== false,
            lastSeenAt: msg.last_seen_at || prev[msg.user_id]?.lastSeenAt || null,
          },
        }));
        setConversations(prev => prev.map(conversation =>
          conversation.user_id === msg.user_id
            ? { ...conversation, online: msg.online !== false, last_seen_at: msg.last_seen_at || conversation.last_seen_at }
            : conversation
        ));
      }
      // 4. Handle profile updates from other users
      if (msg.type === 'profile.update' && msg.user_id && msg.profile) {
        // Update in the conversations list so avatar/name refresh instantly
        setConversations(prev => prev.map(c =>
          c.user_id === msg.user_id
            ? { ...c, ...msg.profile, display_name: msg.profile.display_name || c.display_name }
            : c
        ));
        // Update selected chat header if we're talking to this user
        setSelectedChat(prev =>
          prev && (prev.user_id === msg.user_id || prev.id === msg.user_id)
            ? mergePartnerProfile({ ...prev, ...msg.profile })
            : prev
        );
      }
    });

    return () => removeListener();
  }, [user.id, privateKey, fetchConversations, settings.privacy, token, settings.notifications, upsertConversation, persistMessagesForPartner]);

  // Load history
  useEffect(() => {
    if (selectedChat) {
      loadChatHistory(selectedChat);
    }
  }, [selectedChat, privateKey, loadChatHistory]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchConversations();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations, token]);

  useEffect(() => {
    if (!token || !user?.id) return;

    if (socketService.isConnected()) {
      socketService.send('presence.subscribe', { user_id: user.id });
      socketService.send('presence.ping', { user_id: user.id, status: 'online' });
    }

    const interval = setInterval(() => {
      if (socketService.isConnected()) {
        socketService.send('presence.ping', { user_id: user.id, status: document.hidden ? 'away' : 'online' });
      }
    }, 15000);

    const handleVisibility = () => {
      if (socketService.isConnected()) {
        socketService.send('presence.ping', { user_id: user.id, status: document.hidden ? 'away' : 'online' });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!selectedChat || !privateKey) return;
    const interval = setInterval(() => {
      loadChatHistory(selectedChatRef.current, { merge: true });
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedChat, privateKey, loadChatHistory]);

  // Disappearing messages timer
  useEffect(() => {
    if (!settings.chat.disappearingMessages || settings.chat.disappearingMessages === 'off') return;
    
    const interval = setInterval(() => {
      const ttlMap = {
        '30s': 30,
        '5m': 300,
        '1h': 3600,
        '1d': 86400,
        '1w': 604800
      };
      const ttl = ttlMap[settings.chat.disappearingMessages] || 0;
      if (ttl === 0) return;

      const now = new Date();
      setMessages(prev => prev.filter(m => {
        const created = new Date(m.created_at);
        return (now - created) < (ttl * 1000);
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [settings.chat.disappearingMessages]);

  // Search
  useEffect(() => {
    if (searchQuery.length > 2) {
      const search = async () => {
        setIsSearching(true);
        try {
          const results = await userService.search(searchQuery);
          setSearchResults(results);
        } catch (e) {
          console.error('Search failed', e);
        } finally {
          setIsSearching(false);
        }
      };
      const delay = setTimeout(search, 300);
      return () => clearTimeout(delay);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Typing Indicator Logic
  const typingTimeoutRef = useRef(null);
  const handleTyping = () => {
    if (!settings.privacy.typingIndicators || !selectedChat || !socketService.isConnected()) return;
    
    socketService.send('typing.start', { to_user_id: getChatUserId(selectedChat), from_user_id: user.id });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.send('typing.stop', { to_user_id: getChatUserId(selectedChat), from_user_id: user.id });
    }, 3000);
  };

  const handleAttachmentSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Only image attachments are supported right now.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedAttachment({
        name: file.name,
        dataUrl: reader.result,
      });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleAttachmentAction = (type) => {
    setShowAttachmentSheet(false);
    if (type === 'photos') {
      attachmentInputRef.current?.click();
      return;
    }
    if (type === 'camera') {
      cameraInputRef.current?.click();
      return;
    }
    showToast(`${type} attachments are coming next.`);
  };

  const clearChatHistory = useCallback((partnerId) => {
    if (!user?.id || !partnerId) return;
    userStorageService.clearMessages(user.id, partnerId);
    if (selectedChatRef.current && getChatUserId(selectedChatRef.current) === partnerId) {
      setMessages([]);
      setReplyTo(null);
      setEditMode(null);
    }
    setConversations(prev => prev.map(conversation =>
      conversation.user_id === partnerId
        ? { ...conversation, last_message_preview: 'No messages yet', unread_count: 0 }
        : conversation
    ));
    showToast('Chat history cleared');
  }, [showToast, user?.id]);

  const deleteChat = useCallback((partnerId) => {
    if (!partnerId) return;
    clearChatHistory(partnerId);
    setConversations(prev => prev.filter(conversation => conversation.user_id !== partnerId));
    if (selectedChatRef.current && getChatUserId(selectedChatRef.current) === partnerId) {
      setSelectedChat(null);
    }
    showToast('Chat deleted');
  }, [clearChatHistory, showToast]);

  const archiveCurrentChat = useCallback(() => {
    const partnerId = getChatUserId(selectedChatRef.current);
    if (!partnerId) return;
    archiveChat(partnerId);
    setShowChatMenu(false);
    setSelectedChat(null);
    showToast('Chat archived');
  }, [archiveChat, showToast]);

  const blockCurrentChat = useCallback(() => {
    const partner = selectedChatRef.current;
    const partnerId = getChatUserId(partner);
    if (!partnerId || !partner) return;
    blockUser({
      id: partnerId,
      username: partner.username,
      display_name: partner.display_name,
      avatar: partner.avatar || null,
    });
    setShowChatMenu(false);
    showToast('Contact blocked');
  }, [blockUser, showToast]);

  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if ((!inputText.trim() && !selectedAttachment) || !selectedChat || !privateKey) return;

    const text = inputText;
    const attachment = selectedAttachment;
    
    if (editMode) {
      const partnerId = getChatUserId(selectedChat);
      const originalMessage = messages.find(message => message.id === editMode.id);
      if (!originalMessage) return;

      const parsedOriginal = parseMessageEnvelope(originalMessage.decrypted);
      const editedEnvelope = buildMessageEnvelope({
        text,
        replyToId: parsedOriginal.replyToId,
        attachment: parsedOriginal.image ? { name: parsedOriginal.imageName, dataUrl: parsedOriginal.image } : null,
      });

      const nextMessages = messages.map(message =>
        message.id === editMode.id
          ? {
              ...message,
              decrypted: editedEnvelope,
              edited: true,
              edited_at: new Date().toISOString(),
            }
          : message
      );
      setMessages(nextMessages);
      persistMessagesForPartner(partnerId, nextMessages);
      setConversations(prev => prev.map(conversation =>
        conversation.user_id === partnerId && conversation.last_message_at === originalMessage.created_at
          ? { ...conversation, last_message_preview: buildConversationPreview(editedEnvelope) }
          : conversation
      ));
      setInputText('');
      setReplyTo(null);
      setSelectedAttachment(null);
      setEditMode(null);
      socketService.send('message.edit', {
        message_id: editMode.id,
        to_user_id: partnerId,
        payload_preview: editedEnvelope,
      });
      showToast('Message edited');
      return;
    }

    setInputText('');
    setReplyTo(null);
    setSelectedAttachment(null);

    let optimisticTempId = null;
    try {
      const chatUserId = getChatUserId(selectedChat);
      const cachedProfile = userStorageService.getProfile(chatUserId);
      const recipientPublicKey = selectedChat.public_key || cachedProfile.public_key || await userService.getPublicKey(chatUserId);

      if (!recipientPublicKey) {
        throw new Error('Recipient public key is unavailable.');
      }
      if (!user?.public_key) {
        throw new Error('Your encryption public key is unavailable. Please sign out and sign back in.');
      }
      
      // If reply, append metadata (Signal style)
      let payloadText = text;
      payloadText = buildMessageEnvelope({
        text,
        replyToId: replyTo?.id || null,
        attachment,
      });

      const encryptedPayload = await encryptMessage(
        payloadText, 
        recipientPublicKey, 
        user.public_key
      );

      const tempId = `temp_${Date.now()}`;
      optimisticTempId = tempId;
      const socketSent = socketService.send('message.send', {
        to: chatUserId,
        payload: encryptedPayload,
        tempId,
      });

      const newMessage = {
        id: tempId,
        tempId,
        from_user_id: user.id,
        to_user_id: chatUserId,
        payload: encryptedPayload,
        decrypted: payloadText,
        created_at: new Date().toISOString(),
        is_outgoing: true,
        status: 'sending'
      };
      setMessages(prev => {
        const next = mergeMessages(prev, [newMessage]);
        persistMessagesForPartner(chatUserId, next);
        return next;
      });
      upsertConversation({
        user_id: chatUserId,
        display_name: selectedChat.display_name,
        username: selectedChat.username,
        avatar: selectedChat.avatar || null,
        last_message_at: newMessage.created_at,
        last_message_preview: buildConversationPreview(payloadText),
        unread_count: 0,
        online: presenceByUserId[chatUserId]?.online || false,
      });

      if (socketSent) {
        setTimeout(() => {
          loadChatHistory(selectedChatRef.current, { merge: true });
          fetchConversations();
        }, 150);
      } else {
        const persistedMessage = await messageService.sendMessage(chatUserId, encryptedPayload);
        setMessages(prev => {
          const next = prev.map(message =>
            message.tempId === tempId
              ? {
                  ...message,
                  id: persistedMessage.id || message.id,
                  payload: persistedMessage.payload || message.payload,
                  created_at: persistedMessage.created_at || message.created_at,
                  status: 'sent',
                }
              : message
          );
          persistMessagesForPartner(chatUserId, next);
          return next;
        });
        fetchConversations();
      }
      
    } catch (e) {
      console.error('Send failed', e);
      showToast(e?.message || 'Message failed to send');
      setInputText(text);
      setSelectedAttachment(attachment);
      if (optimisticTempId) {
        setMessages(prev => prev.map(message => message.tempId === optimisticTempId ? { ...message, status: 'failed' } : message));
      }
    }
  };

  const toggleChatSelection = (chatId) => {
    setSelectedChatIds(prev => 
      prev.includes(chatId) 
        ? prev.filter(id => id !== chatId) 
        : [...prev, chatId]
    );
  };

  const handleArchiveSelected = () => {
    selectedChatIds.forEach(id => archiveChat(id));
    setIsSelectionMode(false);
    setSelectedChatIds([]);
    setSelectedChat(null);
  };

  const handleBlockSelected = () => {
    selectedChatIds.forEach(id => {
      const chat = conversations.find(c => c.user_id === id);
      if (chat) blockUser({ id: chat.user_id, display_name: chat.display_name, username: chat.username });
    });
    setIsSelectionMode(false);
    setSelectedChatIds([]);
    setSelectedChat(null);
  };

  const startNewChat = (partner) => {
    setSelectedChat(mergePartnerProfile({
      user_id: partner.id,
      display_name: partner.display_name,
      username: partner.username,
      avatar: partner.avatar
    }));
    setSearchQuery('');
    setSearchResults([]);
  };

  const archivedConversations = conversations.filter(c => settings.chat.archivedChats.includes(c.user_id));
  const filteredConversations = conversations.filter(c => {
    const isArchived = settings.chat.archivedChats.includes(c.user_id);
    if (showArchivedOnly && !isArchived) return false;
    if (!showArchivedOnly && isArchived) return false;
    if (filterUnread) return c.unread_count > 0;
    return true;
  });

  const selectedStatusLabel = isPartnerTyping ? 'typing...' : '';

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${selectedChat ? 'mobile-hidden' : ''}`}>
        <header className="sidebar-header">
          <div className="avatar-signal cursor-pointer" onClick={() => setShowDropdown(!showDropdown)}>
            {user.avatar ? <img src={user.avatar} alt="" /> : user.display_name[0].toUpperCase()}
          </div>
          
          <div className="sidebar-title">{showArchivedOnly ? 'Archived' : 'Chats'}</div>
          
          <div className="header-actions">
            {showArchivedOnly && (
              <button className="icon-btn" onClick={() => setShowArchivedOnly(false)}><ArrowLeft size={20} /></button>
            )}
            <button className="icon-btn" onClick={onOpenSearch}><Edit size={20} /></button>
          </div>

          {showDropdown && (
            <div className="dropdown-menu animate-fade-in" ref={dropdownRef}>
              <div className="dropdown-item" onClick={() => { setFilterUnread(!filterUnread); setShowDropdown(false); }}>
                <Check size={18} style={{ opacity: filterUnread ? 1 : 0 }} />
                <span>Filter By Unread</span>
              </div>
              <div className="dropdown-item" onClick={() => { setIsSelectionMode(true); setShowDropdown(false); }}>
                <Edit size={18} />
                <span>Select Chats</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => { onOpenSettings(); setShowDropdown(false); }}>
                <Settings size={18} />
                <span>Settings</span>
              </div>
            </div>
          )}
        </header>

        <div className="search-container">
          <div className="search-wrap">
            <Search size={18} className="text-secondary" />
            <input 
              type="text" 
              placeholder="Search" 
              className="search-input-signal"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="conversation-list">
          {activeTab === 'chats' ? (
            searchQuery ? (
              searchResults.map(res => (
                <div key={res.id} className="chat-item" onClick={() => startNewChat(res)}>
                  <div className="avatar-signal">{res.display_name[0].toUpperCase()}</div>
                  <div className="chat-content">
                    <div className="chat-name">{res.display_name}</div>
                    <div className="chat-preview">@{res.username}</div>
                  </div>
                </div>
              ))
            ) : (
              <>
                {!showArchivedOnly && archivedConversations.length > 0 && (
                  <div className="chat-item archived-entry" onClick={() => setShowArchivedOnly(true)}>
                    <div className="avatar-wrap">
                      <div className="avatar-signal archived-avatar">
                        <Archive size={20} />
                      </div>
                    </div>
                    <div className="chat-content">
                      <div className="chat-top">
                        <span className="chat-name">Archived</span>
                        <span className="chat-time">{archivedConversations.length}</span>
                      </div>
                      <div className="chat-bottom">
                        <div className="chat-preview">Stored archived conversations</div>
                      </div>
                    </div>
                  </div>
                )}
                {filteredConversations.map(conv => (
                  <div 
                    key={conv.user_id} 
                    className={`chat-item ${selectedChat?.user_id === conv.user_id ? 'active' : ''} ${selectedChatIds.includes(conv.user_id) ? 'selected' : ''}`}
                    onClick={() => isSelectionMode ? toggleChatSelection(conv.user_id) : setSelectedChat(mergePartnerProfile(conv))}
                  >
                    {isSelectionMode && (
                      <div className={`selection-check ${selectedChatIds.includes(conv.user_id) ? 'checked' : ''}`}>
                        <Check size={14} />
                      </div>
                    )}
                    <div className="avatar-wrap">
                      <div className="avatar-signal">
                        {conv.avatar ? <img src={conv.avatar} alt="" /> : conv.display_name[0].toUpperCase()}
                      </div>
                    </div>
                    <div className="chat-content">
                      <div className="chat-top">
                        <span className="chat-name">{conv.display_name}</span>
                        <span className="chat-time">{conv.last_message_at ? format(new Date(conv.last_message_at), 'HH:mm') : ''}</span>
                      </div>
                      <div className="chat-bottom">
                        <div className="chat-preview">{conv.last_message_preview || 'Secure channel active'}</div>
                        {conv.unread_count > 0 && <div className="unread-badge">{conv.unread_count}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )
          ) : activeTab === 'calls' ? (
            <CallsPage onBack={() => setActiveTab('chats')} />
          ) : (
            <StoriesPage onBack={() => setActiveTab('chats')} />
          )}
        </div>

        <nav className="bottom-nav">
          <div className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>
            <div className="nav-icon-wrap"><MessageSquare size={24} /></div>
            <span className="nav-label">Chats</span>
          </div>
          <div className={`nav-item ${activeTab === 'calls' ? 'active' : ''}`} onClick={() => setActiveTab('calls')}>
            <div className="nav-icon-wrap"><Phone size={24} /></div>
            <span className="nav-label">Calls</span>
          </div>
          <div className={`nav-item ${activeTab === 'stories' ? 'active' : ''}`} onClick={() => setActiveTab('stories')}>
            <div className="nav-icon-wrap"><RotateCcw size={24} /></div>
            <span className="nav-label">Stories</span>
          </div>
        </nav>
      </aside>

      {/* Main Chat Area */}
      <main className={`chat-main ${selectedChat ? 'active' : ''}`}>
        {selectedChat ? (
          <>
            <header className="chat-main-header">
              <div className="header-user" onClick={() => onOpenProfile(selectedChat)}>
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setSelectedChat(null); }}><ArrowLeft size={18} /></button>
                <div className="avatar-signal" style={{ width: 40, height: 40 }}>
                   {selectedChat.avatar ? <img src={selectedChat.avatar} alt="" /> : selectedChat.display_name[0].toUpperCase()}
                </div>
                <div className="chat-header-info">
                  <div className="chat-header-name">{selectedChat.display_name}</div>
                  {selectedStatusLabel && (
                    <div className={`chat-header-status ${isPartnerTyping ? 'typing' : ''}`}>
                      {selectedStatusLabel}
                    </div>
                  )}
                </div>
              </div>
              <div className="header-actions">
                <button className="icon-btn" onClick={() => rtc.startCall(selectedChat, 'video')}><Video size={20} /></button>
                <button className="icon-btn" onClick={() => rtc.startCall(selectedChat, 'voice')}><Phone size={20} /></button>
                <div className="chat-menu-wrap" ref={chatMenuRef}>
                  <button className="icon-btn" onClick={() => setShowChatMenu(prev => !prev)}><MoreVertical size={20} /></button>
                  {showChatMenu && (
                    <div className="chat-action-menu animate-fade-in">
                      <button className="chat-action-item" onClick={() => setShowDisappearOptions(prev => !prev)}>
                        <span className="chat-action-main"><Clock3 size={16} />Disappearing messages</span>
                        <span>{showDisappearOptions ? '−' : '+'}</span>
                      </button>
                      {showDisappearOptions && (
                        <div className="chat-submenu">
                          {DISAPPEARING_OPTIONS.map(option => (
                            <button
                              key={option.key}
                              className={`chat-submenu-item ${settings.chat.disappearingMessages === option.key ? 'active' : ''}`}
                              onClick={() => {
                                updateSettings('chat', { disappearingMessages: option.key });
                                setShowDisappearOptions(false);
                                setShowChatMenu(false);
                                showToast(`Disappearing messages: ${option.label}`);
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <button className="chat-action-item" onClick={archiveCurrentChat}>
                        <span className="chat-action-main"><Archive size={16} />Archive chat</span>
                      </button>
                      <button className="chat-action-item" onClick={() => {
                        clearChatHistory(getChatUserId(selectedChat));
                        setShowChatMenu(false);
                      }}>
                        <span className="chat-action-main"><Trash2 size={16} />Clear chat history</span>
                      </button>
                      <button className="chat-action-item danger" onClick={() => {
                        deleteChat(getChatUserId(selectedChat));
                        setShowChatMenu(false);
                      }}>
                        <span className="chat-action-main"><Trash2 size={16} />Delete chat</span>
                      </button>
                      <button className="chat-action-item danger" onClick={blockCurrentChat}>
                        <span className="chat-action-main"><Ban size={16} />Block contact</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <div className="messages-viewport">
              {socketStatus !== 'connected' && (
                <div className={`realtime-banner ${socketStatus === 'reconnecting' || socketStatus === 'connecting' ? 'pending' : 'offline'}`}>
                  {socketStatus === 'connecting' || socketStatus === 'reconnecting'
                    ? 'Realtime connection is reconnecting... messages may fall back to slower delivery.'
                    : 'Realtime connection is unavailable. Messages may send more slowly until the server reconnects.'}
                </div>
              )}
              <div className="encryption-notice">
                <ShieldCheck size={14} className="text-success" />
                <span>Messages and calls are end-to-end encrypted.</span>
              </div>

              {messages.map((msg, i) => {
                const parsedMessage = parseMessageEnvelope(msg.decrypted);
                const replyId = parsedMessage.replyToId;
                const cleanText = parsedMessage.text;
                const image = parsedMessage.image;

                return (
                  <div 
                    key={msg.id || i} 
                    className={`message-row ${msg.from_user_id === user.id ? 'sent' : 'received'} animate-slide-in`}
                    onDoubleClick={() => msg.from_user_id === user.id && setEditMode({ id: msg.id, text: cleanText })}
                  >
                    <div className="message-bubble-signal glass-light">
                      {replyId && (
                        <div className="reply-preview-msg">
                          <div className="reply-line" />
                          <div className="reply-content-text">Replying to a message</div>
                        </div>
                      )}
                      {image && <img src={image} alt={parsedMessage.imageName || 'attachment'} className="message-image" />}
                      {cleanText && <div>{cleanText}</div>}
                    </div>
                    <div className="message-info-signal">
                      <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                      {msg.edited && <span className="message-edited-indicator">(edited)</span>}
                      {msg.from_user_id === user.id && (
                        <div className="status-icons">
                          {msg.status === 'sending' ? (
                             <Loader2 size={10} className="animate-spin opacity-50" />
                          ) : msg.status === 'failed' ? (
                             <span className="message-failed">!</span>
                          ) : msg.read || msg.status === 'read' ? (
                             <CheckCheck size={12} style={{ color: '#34B7F1' }} />
                          ) : msg.status === 'delivered' || msg.delivered ? (
                             <CheckCheck size={12} style={{ color: 'rgba(255,255,255,0.65)' }} />
                          ) : (
                             <Check size={12} style={{ color: 'rgba(255,255,255,0.55)' }} />
                          )}
                        </div>
                      )}
                    </div>
                    <button className="reply-btn-hidden" onClick={() => setReplyTo(msg)}><Reply size={14} /></button>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {replyTo && (
              <div className="reply-bar glass animate-fade-in">
                <div className="reply-line" />
                <div className="flex-1 px-4 py-2">
                  <div className="text-accent text-xs font-bold">Replying to {replyTo.from_user_id === user.id ? 'yourself' : selectedChat.display_name}</div>
                  <div className="text-sm text-secondary truncate">{replyTo.decrypted}</div>
                </div>
                <button className="p-2" onClick={() => setReplyTo(null)}><X size={18} /></button>
              </div>
            )}

            {selectedAttachment && (
              <div className="reply-bar glass animate-fade-in">
                <div className="reply-line" />
                <div className="flex-1 px-4 py-2">
                  <div className="text-accent text-xs font-bold">Image attached</div>
                  <div className="text-sm text-secondary truncate">{selectedAttachment.name}</div>
                </div>
                <button className="p-2" onClick={() => setSelectedAttachment(null)}><X size={18} /></button>
              </div>
            )}

            {editMode && (
              <div className="reply-bar glass animate-fade-in" style={{ borderLeftColor: '#ffd60a' }}>
                <div className="reply-line" style={{ background: '#ffd60a' }} />
                <div className="flex-1 px-4 py-2">
                  <div className="text-accent text-xs font-bold" style={{ color: '#ffd60a' }}>Editing Message</div>
                  <div className="text-sm text-secondary truncate">{editMode.text}</div>
                </div>
                <button className="p-2" onClick={() => { setEditMode(null); setInputText(''); }}><X size={18} /></button>
              </div>
            )}

            <div className="chat-input-area">
              <input
                ref={attachmentInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={handleAttachmentSelected}
              />
              <input
                ref={cameraInputRef}
                type="file"
                hidden
                accept="image/*"
                capture="environment"
                onChange={handleAttachmentSelected}
              />
              <button className="icon-btn" onClick={() => setShowAttachmentSheet(true)}><Plus size={24} /></button>
              <div className="input-pill">
                <textarea 
                  placeholder="Message" 
                  className="message-input-signal"
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={1}
                />
                {editMode && (
                  <button className="icon-btn edit-mode-icon" onClick={() => handleSendMessage()}>
                    <Edit size={18} />
                  </button>
                )}
              </div>
              <button 
                className="send-btn-signal" 
                onClick={handleSendMessage}
                disabled={!inputText.trim() && !selectedAttachment}
              >
                <Send size={20} />
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="text-center">
              <div className="logo-icon" style={{ opacity: 0.2 }}><ShieldCheck size={40} /></div>
              <h2>Select a chat to start messaging</h2>
            </div>
          </div>
        )}
      </main>

      {showAttachmentSheet && (
        <div className="attachment-sheet-overlay" onClick={() => setShowAttachmentSheet(false)}>
          <div className="attachment-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="attachment-grabber" />
            <div className="attachment-grid">
              <button className="attachment-option" onClick={() => handleAttachmentAction('photos')}>
                <div className="attachment-option-icon photos"><ImageIcon size={28} /></div>
                <span>Photos</span>
              </button>
              <button className="attachment-option" onClick={() => handleAttachmentAction('camera')}>
                <div className="attachment-option-icon camera"><Camera size={28} /></div>
                <span>Camera</span>
              </button>
              <button className="attachment-option" onClick={() => handleAttachmentAction('location')}>
                <div className="attachment-option-icon location"><MapPin size={28} /></div>
                <span>Location</span>
              </button>
              <button className="attachment-option" onClick={() => handleAttachmentAction('contact')}>
                <div className="attachment-option-icon contact"><UserRound size={28} /></div>
                <span>Contact</span>
              </button>
              <button className="attachment-option" onClick={() => handleAttachmentAction('document')}>
                <div className="attachment-option-icon document"><FileText size={28} /></div>
                <span>Document</span>
              </button>
              <button className="attachment-option" onClick={() => handleAttachmentAction('poll')}>
                <div className="attachment-option-icon poll"><BarChart3 size={28} /></div>
                <span>Poll</span>
              </button>
              <button className="attachment-option" onClick={() => handleAttachmentAction('event')}>
                <div className="attachment-option-icon event"><CalendarDays size={28} /></div>
                <span>Event</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlays */}
      <CallOverlay 
        {...rtc} 
        onAccept={rtc.acceptIncomingCall}
        onDecline={rtc.rejectIncomingCall}
        onEnd={rtc.endCall}
        onToggleMute={rtc.toggleMute}
        onToggleCamera={rtc.toggleCamera}
        onCallEnded={() => setActiveTab('calls')}
      />

      {isSelectionMode && (
        <div className="selection-bar glass animate-slide-up">
          <div className="selection-info">
             <button className="icon-btn" onClick={() => { setIsSelectionMode(false); setSelectedChatIds([]); }}><X /></button>
             <span>{selectedChatIds.length} Selected</span>
          </div>
          <div className="selection-actions">
            <button onClick={handleArchiveSelected} title="Archive"><Archive /></button>
            <button onClick={handleBlockSelected} title="Block"><Ban /></button>
            <button onClick={() => { /* Clear history placeholder */ }} className="text-error" title="Clear History"><Trash2 /></button>
          </div>
        </div>
      )}

      {actionToast && <div className="chat-toast animate-fade-in">{actionToast}</div>}
    </div>
  );
};

export default ChatPage;
