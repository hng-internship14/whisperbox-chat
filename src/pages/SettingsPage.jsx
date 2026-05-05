import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ChevronLeft, ChevronRight,
  Lock, MessageCircle, Bell, HelpCircle, LogOut,
  Users, Shield
} from 'lucide-react';

const SettingsPage = ({ onBack, onNavigate, onOpenProfile }) => {
  const { user, logout, contacts } = useAuth();

  const settingsItems = [
    { id: 'privacy',       label: 'Privacy',       sub: 'Profile, read receipts, typing',  icon: <Lock size={20} />,        color: '#32d74b' },
    { id: 'chats',         label: 'Chats',          sub: 'Backup, disappearing messages',    icon: <MessageCircle size={20} />, color: '#2c6bed' },
    { id: 'notifications', label: 'Notifications',  sub: 'Messages, calls, mentions',        icon: <Bell size={20} />,         color: '#ff453a' },
    { id: 'help',          label: 'Help',            sub: 'FAQ, contact support',             icon: <HelpCircle size={20} />,   color: '#ffd60a' },
  ];

  const avatarInitial = (user.display_name || user.username || '?')[0].toUpperCase();

  return (
    <div className="settings-view animate-fade-in">
      <header className="settings-header">
        <button className="icon-btn" onClick={onBack}><ChevronLeft /></button>
        <div className="settings-title">Settings</div>
        <div style={{ width: 40 }} />
      </header>

      <div className="settings-content">
        {/* Profile card */}
        <div className="sp-profile-card" onClick={onOpenProfile}>
          <div className="sp-profile-avatar">
            {user.avatar
              ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : <span>{avatarInitial}</span>
            }
          </div>
          <div className="sp-profile-info">
            <div className="sp-profile-name">{user.display_name || 'Anonymous'}</div>
            <div className="sp-profile-sub">@{user.username}</div>
            {user.about && <div className="sp-profile-about">{user.about}</div>}
          </div>
          <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
        </div>

        {/* Contacts count pill */}
        {contacts.length > 0 && (
          <div className="sp-contacts-row" onClick={() => {}}>
            <div className="settings-icon-wrap" style={{ background: '#af52de' }}><Users size={20} /></div>
            <div className="settings-item-label">
              <div>Contacts</div>
              <div className="settings-subtext">{contacts.length} saved contact{contacts.length !== 1 ? 's' : ''}</div>
            </div>
            <ChevronRight size={20} className="text-secondary" />
          </div>
        )}

        {/* Main settings items */}
        <div className="settings-section">
          {settingsItems.map(item => (
            <div key={item.id} className="settings-item" onClick={() => onNavigate(item.id)}>
              <div className="settings-icon-wrap" style={{ background: item.color }}>
                {item.icon}
              </div>
              <div className="settings-item-label">
                <div>{item.label}</div>
                <div className="settings-subtext">{item.sub}</div>
              </div>
              <ChevronRight size={20} className="text-secondary" />
            </div>
          ))}
        </div>

        {/* E2EE badge */}
        <div className="sp-e2ee-badge">
          <Shield size={14} />
          <span>End-to-end encrypted by WhisperBox</span>
        </div>

        {/* Logout */}
        <div className="p-4 pt-0">
          <button className="sp-logout-btn" onClick={logout}>
            <LogOut size={18} />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      <style>{`
        .sp-profile-card {
          display: flex; align-items: center; gap: 16px;
          margin: 8px 16px 4px; padding: 16px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px; cursor: pointer; transition: background 0.18s;
        }
        .sp-profile-card:hover { background: rgba(255,255,255,0.08); }

        .sp-profile-avatar {
          width: 62px; height: 62px; border-radius: 31px; flex-shrink: 0;
          background: linear-gradient(135deg, #2c6bed, #7c3aed);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem; font-weight: 700; color: white; overflow: hidden;
          box-shadow: 0 4px 14px rgba(44,107,237,0.3);
        }

        .sp-profile-info { flex: 1; min-width: 0; }
        .sp-profile-name { font-size: 17px; font-weight: 700; color: white; margin-bottom: 2px; }
        .sp-profile-sub  { font-size: 13px; color: rgba(255,255,255,0.45); }
        .sp-profile-about { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .sp-contacts-row {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 20px; cursor: pointer; transition: background 0.15s;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .sp-contacts-row:hover { background: rgba(255,255,255,0.04); }

        .sp-e2ee-badge {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 12px; font-size: 12px; color: rgba(255,255,255,0.25);
          font-weight: 500;
        }

        .sp-logout-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 14px; border-radius: 14px; border: 1px solid rgba(255,69,58,0.2);
          background: rgba(255,69,58,0.08); color: #ff453a;
          font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.18s;
          font-family: inherit;
        }
        .sp-logout-btn:hover { background: rgba(255,69,58,0.15); }
        .sp-logout-btn:active { transform: scale(0.98); }
      `}</style>
    </div>
  );
};

export default SettingsPage;
