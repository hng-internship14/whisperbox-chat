import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, Cloud, Trash2, Archive, Download, Image, Timer } from 'lucide-react';

const Toggle = ({ checked, onChange }) => (
  <div className={`wb-toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
    <div className="wb-toggle-thumb" />
  </div>
);

const TIMER_OPTIONS = [
  { key: 'off', label: 'Off (Never)' },
  { key: '30s', label: '30 Seconds' },
  { key: '5m',  label: '5 Minutes'  },
  { key: '1h',  label: '1 Hour'     },
  { key: '1d',  label: '1 Day'      },
  { key: '1w',  label: '1 Week'     },
];

const ChatSettings = ({ onBack }) => {
  const { settings, updateSettings } = useAuth();
  const [showTimer, setShowTimer] = useState(false);

  const c = settings.chat;
  const currentTimer = TIMER_OPTIONS.find(o => o.key === (c.disappearingMessages || 'off'));

  const handleClearHistory = () => {
    if (window.confirm('Clear all local chat history? This cannot be undone.')) {
      // Clear all wb_msgs_* keys
      Object.keys(localStorage)
        .filter(k => k.startsWith('wb_msgs_'))
        .forEach(k => localStorage.removeItem(k));
      alert('Chat history cleared locally.');
    }
  };

  return (
    <div className="settings-view animate-fade-in">
      <header className="settings-header">
        <button className="icon-btn" onClick={onBack}><ChevronLeft /></button>
        <div className="settings-title">Chats</div>
      </header>

      <div className="settings-content">
        {/* Disappearing messages */}
        <div className="settings-section">
          <div className="settings-section-title">Disappearing Messages</div>
          <div className="settings-item" onClick={() => setShowTimer(!showTimer)}>
            <div className="settings-icon-wrap" style={{ background: '#ff453a' }}><Timer size={20} /></div>
            <div className="settings-item-label">
              <div>Default Timer</div>
              <div className="settings-subtext">{currentTimer?.label || 'Off'}</div>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{showTimer ? '▲' : '▼'}</span>
          </div>
          {showTimer && (
            <div className="cs-timer-list animate-fade-in">
              {TIMER_OPTIONS.map(o => (
                <div
                  key={o.key}
                  className={`cs-timer-opt ${c.disappearingMessages === o.key || (!c.disappearingMessages && o.key === 'off') ? 'cs-timer-active' : ''}`}
                  onClick={() => { updateSettings('chat', { disappearingMessages: o.key }); setShowTimer(false); }}
                >
                  <span>{o.label}</span>
                  {(c.disappearingMessages === o.key || (!c.disappearingMessages && o.key === 'off')) && (
                    <span style={{ color: '#2c6bed', fontWeight: 700 }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Backup */}
        <div className="settings-section">
          <div className="settings-section-title">Data</div>
          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#2c6bed' }}><Cloud size={20} /></div>
            <div className="settings-item-label">
              <div>Chat Backup</div>
              <div className="settings-subtext">Back up messages to secure cloud</div>
            </div>
          </div>
          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#32d74b' }}><Download size={20} /></div>
            <div className="settings-item-label">
              <div>Media Auto-download</div>
              <div className="settings-subtext">Manage downloads over Wi-Fi & cellular</div>
            </div>
          </div>
        </div>

        {/* Storage & Archive */}
        <div className="settings-section">
          <div className="settings-section-title">Storage</div>
          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#af52de' }}><Image size={20} /></div>
            <div className="settings-item-label">
              <div>Manage Storage</div>
              <div className="settings-subtext">{c.archivedChats?.length || 0} archived chats</div>
            </div>
          </div>
          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#8e8e93' }}><Archive size={20} /></div>
            <div className="settings-item-label">
              <div>Archived Chats</div>
              <div className="settings-subtext">{c.archivedChats?.length || 0} chats archived</div>
            </div>
          </div>
          <div className="settings-item" onClick={handleClearHistory}>
            <div className="settings-icon-wrap" style={{ background: '#ff453a' }}><Trash2 size={20} /></div>
            <div className="settings-item-label" style={{ color: '#ff453a' }}>Clear Chat History</div>
          </div>
        </div>
      </div>

      <style>{`
        .cs-timer-list { background: rgba(255,255,255,0.04); border-top: 1px solid rgba(255,255,255,0.06); }
        .cs-timer-opt {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 24px; font-size: 15px; color: rgba(255,255,255,0.75);
          cursor: pointer; transition: background 0.15s;
        }
        .cs-timer-opt:hover { background: rgba(255,255,255,0.06); }
        .cs-timer-active { color: white; font-weight: 600; }
      `}</style>
    </div>
  );
};

export default ChatSettings;
