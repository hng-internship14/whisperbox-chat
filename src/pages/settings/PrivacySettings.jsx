import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, Shield, Eye, UserX, MessageSquare, Keyboard, Lock, Timer } from 'lucide-react';

const VisibilityPicker = ({ value, onChange }) => {
  const options = [
    { key: 'everyone', label: 'Everyone' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'nobody',   label: 'No One'   },
  ];
  return (
    <div className="ps-pill-row">
      {options.map(o => (
        <button
          key={o.key}
          className={`ps-pill ${value === o.key ? 'ps-pill-active' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

const Toggle = ({ checked, onChange }) => (
  <div className={`wb-toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
    <div className="wb-toggle-thumb" />
  </div>
);

const TIMER_OPTIONS = [
  { key: 'off', label: 'Off' },
  { key: '30s', label: '30 Seconds' },
  { key: '5m',  label: '5 Minutes' },
  { key: '1h',  label: '1 Hour' },
  { key: '1d',  label: '1 Day' },
  { key: '1w',  label: '1 Week' },
];

const PrivacySettings = ({ onBack }) => {
  const { settings, updateSettings, unblockUser } = useAuth();
  const [showTimerPicker, setShowTimerPicker] = useState(false);

  const p = settings.privacy;
  const c = settings.chat;

  return (
    <div className="settings-view animate-fade-in">
      <header className="settings-header">
        <button className="icon-btn" onClick={onBack}><ChevronLeft /></button>
        <div className="settings-title">Privacy</div>
      </header>

      <div className="settings-content">

        {/* Who can see profile */}
        <div className="settings-section">
          <div className="settings-section-title">Profile Visibility</div>
          <div className="settings-item ps-expand-item">
            <div className="settings-icon-wrap" style={{ background: '#32d74b' }}><Eye size={20} /></div>
            <div className="settings-item-label">
              <div>Who can see my profile</div>
              <div className="settings-subtext">Photo, name, and about</div>
            </div>
          </div>
          <div className="ps-picker-pad">
            <VisibilityPicker
              value={p.profileVisibility || 'everyone'}
              onChange={(v) => updateSettings('privacy', { profileVisibility: v })}
            />
          </div>
        </div>

        {/* Phone visibility */}
        <div className="settings-section">
          <div className="settings-section-title">Phone Number</div>
          <div className="settings-item ps-expand-item">
            <div className="settings-icon-wrap" style={{ background: '#2c6bed' }}><Shield size={20} /></div>
            <div className="settings-item-label">
              <div>Who can see my phone number</div>
            </div>
          </div>
          <div className="ps-picker-pad">
            <VisibilityPicker
              value={p.phoneVisibility || 'contacts'}
              onChange={(v) => updateSettings('privacy', { phoneVisibility: v })}
            />
          </div>
        </div>

        {/* Functional toggles */}
        <div className="settings-section">
          <div className="settings-section-title">Messaging</div>

          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#2c6bed' }}><MessageSquare size={20} /></div>
            <div className="settings-item-label">
              <div>Read Receipts</div>
              <div className="settings-subtext">Show blue ticks when you've read messages</div>
            </div>
            <Toggle
              checked={p.readReceipts}
              onChange={(v) => updateSettings('privacy', { readReceipts: v })}
            />
          </div>

          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#ffd60a' }}><Keyboard size={20} /></div>
            <div className="settings-item-label">
              <div>Typing Indicators</div>
              <div className="settings-subtext">Show when you're typing to others</div>
            </div>
            <Toggle
              checked={p.typingIndicators}
              onChange={(v) => updateSettings('privacy', { typingIndicators: v })}
            />
          </div>

          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#af52de' }}><Lock size={20} /></div>
            <div className="settings-item-label">
              <div>App Lock</div>
              <div className="settings-subtext">Require passcode to open WhisperBox</div>
            </div>
            <Toggle
              checked={p.appLock}
              onChange={(v) => updateSettings('privacy', { appLock: v })}
            />
          </div>
        </div>

        {/* Disappearing messages */}
        <div className="settings-section">
          <div className="settings-section-title">Disappearing Messages</div>
          <div className="settings-item" onClick={() => setShowTimerPicker(!showTimerPicker)}>
            <div className="settings-icon-wrap" style={{ background: '#ff453a' }}><Timer size={20} /></div>
            <div className="settings-item-label">
              <div>Default Timer</div>
              <div className="settings-subtext">
                {TIMER_OPTIONS.find(o => o.key === (c.disappearingMessages || 'off'))?.label || 'Off'}
              </div>
            </div>
            <span className="ps-chevron">{showTimerPicker ? '▲' : '▼'}</span>
          </div>
          {showTimerPicker && (
            <div className="ps-timer-list animate-fade-in">
              {TIMER_OPTIONS.map(o => (
                <div
                  key={o.key}
                  className={`ps-timer-option ${c.disappearingMessages === o.key || (!c.disappearingMessages && o.key === 'off') ? 'ps-timer-active' : ''}`}
                  onClick={() => { updateSettings('chat', { disappearingMessages: o.key }); setShowTimerPicker(false); }}
                >
                  {o.label}
                  {(c.disappearingMessages === o.key || (!c.disappearingMessages && o.key === 'off')) && <span className="ps-check">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocked users */}
        <div className="settings-section">
          <div className="settings-section-title">Blocked</div>
          {p.blockedUsers && p.blockedUsers.length > 0 ? (
            p.blockedUsers.map(u => (
              <div key={u.id} className="settings-item">
                <div className="settings-avatar">{u.display_name[0]}</div>
                <div className="settings-item-label">{u.display_name}</div>
                <button className="ps-unblock-btn" onClick={() => unblockUser(u.id)}>Unblock</button>
              </div>
            ))
          ) : (
            <div className="p-4 text-secondary text-sm">No blocked users</div>
          )}
        </div>
      </div>

      <style>{`
        .ps-pill-row { display: flex; gap: 8px; padding: 0 16px 16px; }
        .ps-pill {
          flex: 1; padding: 8px 4px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); font-size: 13px;
          cursor: pointer; transition: all 0.18s; font-weight: 500;
        }
        .ps-pill-active { background: var(--signal-blue, #2c6bed); border-color: var(--signal-blue, #2c6bed); color: white; }
        .ps-picker-pad { padding: 4px 0 8px; }
        .ps-expand-item { border-bottom: none !important; padding-bottom: 4px !important; }
        .ps-chevron { color: rgba(255,255,255,0.4); font-size: 12px; margin-right: 4px; }
        .ps-timer-list { background: rgba(255,255,255,0.04); border-top: 1px solid rgba(255,255,255,0.06); }
        .ps-timer-option {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 24px; font-size: 15px; color: rgba(255,255,255,0.8);
          cursor: pointer; transition: background 0.15s;
        }
        .ps-timer-option:hover { background: rgba(255,255,255,0.06); }
        .ps-timer-active { color: white; font-weight: 600; }
        .ps-check { color: var(--signal-blue, #2c6bed); font-weight: 700; font-size: 16px; }
        .ps-unblock-btn {
          padding: 6px 14px; border-radius: 10px; font-size: 13px; font-weight: 600;
          background: rgba(44,107,237,0.15); border: 1px solid rgba(44,107,237,0.3);
          color: var(--signal-blue, #2c6bed); cursor: pointer; transition: background 0.18s;
        }
        .ps-unblock-btn:hover { background: rgba(44,107,237,0.25); }

        /* Shared toggle */
        .wb-toggle {
          width: 50px; height: 28px; border-radius: 14px; background: rgba(255,255,255,0.15);
          position: relative; cursor: pointer; transition: background 0.25s; flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .wb-toggle.on { background: #32d74b; border-color: #32d74b; }
        .wb-toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 20px; height: 20px; border-radius: 10px;
          background: white; transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .wb-toggle.on .wb-toggle-thumb { transform: translateX(22px); }
      `}</style>
    </div>
  );
};

export default PrivacySettings;
