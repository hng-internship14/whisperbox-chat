import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, Bell, Volume2, Eye, Smartphone, MessageSquare } from 'lucide-react';

const Toggle = ({ checked, onChange }) => (
  <div className={`wb-toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
    <div className="wb-toggle-thumb" />
  </div>
);

const NotificationSettings = ({ onBack }) => {
  const { settings, updateSettings } = useAuth();
  const n = settings.notifications;

  const toggle = (key) => updateSettings('notifications', { [key]: !n[key] });

  return (
    <div className="settings-view animate-fade-in">
      <header className="settings-header">
        <button className="icon-btn" onClick={onBack}><ChevronLeft /></button>
        <div className="settings-title">Notifications</div>
      </header>

      <div className="settings-content">
        <div className="settings-section">
          <div className="settings-section-title">Messages</div>

          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#ff453a' }}><Volume2 size={20} /></div>
            <div className="settings-item-label">
              <div>Message Sounds</div>
              <div className="settings-subtext">Play sound for incoming messages</div>
            </div>
            <Toggle checked={n.sounds} onChange={() => toggle('sounds')} />
          </div>

          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#2c6bed' }}><Eye size={20} /></div>
            <div className="settings-item-label">
              <div>Show Message Preview</div>
              <div className="settings-subtext">Show content in notification banner</div>
            </div>
            <Toggle checked={n.showContent} onChange={() => toggle('showContent')} />
          </div>

          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#32d74b' }}><Bell size={20} /></div>
            <div className="settings-item-label">
              <div>Badge Count</div>
              <div className="settings-subtext">Show unread count on app icon</div>
            </div>
            <Toggle checked={n.badgeCounts} onChange={() => toggle('badgeCounts')} />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Calls</div>
          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#af52de' }}><Smartphone size={20} /></div>
            <div className="settings-item-label">
              <div>Call Notifications</div>
              <div className="settings-subtext">Notify you of incoming voice/video calls</div>
            </div>
            <Toggle checked={n.callNotifications !== false} onChange={() => toggle('callNotifications')} />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Mentions</div>
          <div className="settings-item">
            <div className="settings-icon-wrap" style={{ background: '#ffd60a' }}><MessageSquare size={20} /></div>
            <div className="settings-item-label">
              <div>Mention Alerts</div>
              <div className="settings-subtext">Get notified when someone mentions you</div>
            </div>
            <Toggle checked={n.mentions !== false} onChange={() => updateSettings('notifications', { mentions: !n.mentions })} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
