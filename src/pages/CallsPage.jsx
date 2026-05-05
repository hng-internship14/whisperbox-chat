import React, { useState, useEffect } from 'react';
import { callLogService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Trash2, ChevronLeft, Search
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

const formatCallTime = (timestamp) => {
  const date = new Date(timestamp);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd/MM/yyyy');
};

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const DirectionIcon = ({ direction, missed }) => {
  if (missed) return <PhoneMissed size={14} color="#ff453a" />;
  if (direction === 'incoming') return <PhoneIncoming size={14} color="#32d74b" />;
  return <PhoneOutgoing size={14} color="#2c6bed" />;
};

const CallsPage = ({ onBack }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.id) {
      setLogs(callLogService.getAll(user.id));
    }
  }, [user?.id]);

  const handleClear = () => {
    if (window.confirm('Clear all call history?')) {
      callLogService.clear(user.id);
      setLogs([]);
    }
  };

  const filtered = logs.filter(l =>
    !search || (l.partnerName || '').toLowerCase().includes(search.toLowerCase())
  );

  // Group by date
  const groups = filtered.reduce((acc, log) => {
    const date = new Date(log.timestamp);
    const key = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'MMMM d, yyyy');
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  const initials = (name) => (name || 'U')[0].toUpperCase();

  return (
    <div className="cp-wrap animate-fade-in">
      {/* Header */}
      <header className="cp-header">
        <button className="icon-btn" onClick={onBack}><ChevronLeft size={22} /></button>
        <h1 className="cp-title">Calls</h1>
        {logs.length > 0 && (
          <button className="icon-btn" onClick={handleClear} title="Clear history">
            <Trash2 size={18} />
          </button>
        )}
      </header>

      {/* Search */}
      {logs.length > 0 && (
        <div className="cp-search-wrap">
          <Search size={16} className="cp-search-icon" />
          <input
            className="cp-search-input"
            placeholder="Search calls..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* List */}
      <div className="cp-list">
        {filtered.length === 0 ? (
          <div className="cp-empty">
            <div className="cp-empty-icon">
              <Phone size={40} />
            </div>
            <h3>No Calls Yet</h3>
            <p>Your call history will appear here</p>
          </div>
        ) : (
          Object.entries(groups).map(([dateLabel, groupLogs]) => (
            <div key={dateLabel}>
              <div className="cp-date-label">{dateLabel}</div>
              {groupLogs.map(log => {
                const missed = log.durationSeconds === 0 && log.direction === 'incoming';
                return (
                  <div key={log.id} className="cp-item">
                    {/* Avatar */}
                    <div className="cp-avatar">
                      {log.partnerAvatar
                        ? <img src={log.partnerAvatar} alt="" />
                        : <span>{initials(log.partnerName)}</span>
                      }
                    </div>

                    {/* Info */}
                    <div className="cp-info">
                      <div className="cp-name" style={{ color: missed ? '#ff453a' : 'white' }}>
                        {log.partnerName || 'Unknown'}
                      </div>
                      <div className="cp-meta">
                        <DirectionIcon direction={log.direction} missed={missed} />
                        <span>{log.type === 'video' ? 'Video' : 'Voice'}</span>
                        {formatDuration(log.durationSeconds) && (
                          <span className="cp-dur">· {formatDuration(log.durationSeconds)}</span>
                        )}
                      </div>
                    </div>

                    {/* Time + Recall */}
                    <div className="cp-right">
                      <span className="cp-time">{formatCallTime(log.timestamp)}</span>
                      <button className="cp-recall-btn" title={log.type === 'video' ? 'Video call' : 'Voice call'}>
                        {log.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <style>{`
        .cp-wrap {
          height: 100%; display: flex; flex-direction: column;
          background: var(--bg-dark); overflow: hidden;
        }
        .cp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 16px 8px; height: 64px; flex-shrink: 0;
        }
        .cp-title { font-size: 20px; font-weight: 700; flex: 1; text-align: center; }

        .cp-search-wrap {
          display: flex; align-items: center; gap: 8px;
          margin: 0 16px 12px; padding: 10px 14px;
          background: rgba(255,255,255,0.06); border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .cp-search-icon { color: rgba(255,255,255,0.35); flex-shrink: 0; }
        .cp-search-input {
          background: transparent; border: none; color: white;
          font-size: 15px; outline: none; width: 100%; font-family: inherit;
        }
        .cp-search-input::placeholder { color: rgba(255,255,255,0.3); }

        .cp-list { flex: 1; overflow-y: auto; }
        .cp-date-label {
          padding: 10px 20px 6px;
          font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.35);
          text-transform: uppercase; letter-spacing: 0.8px;
        }
        .cp-item {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 16px; cursor: pointer;
          transition: background 0.15s; position: relative;
        }
        .cp-item:hover { background: rgba(255,255,255,0.04); }
        .cp-item:active { background: rgba(255,255,255,0.08); }

        .cp-avatar {
          width: 52px; height: 52px; border-radius: 26px; flex-shrink: 0;
          background: linear-gradient(135deg, #2c6bed, #7c3aed);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.25rem; font-weight: 700; color: white; overflow: hidden;
        }
        .cp-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .cp-info { flex: 1; min-width: 0; }
        .cp-name { font-size: 16px; font-weight: 600; margin-bottom: 3px; }
        .cp-meta {
          display: flex; align-items: center; gap: 5px;
          font-size: 13px; color: rgba(255,255,255,0.45);
        }
        .cp-dur { color: rgba(255,255,255,0.3); }

        .cp-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .cp-time { font-size: 12px; color: rgba(255,255,255,0.35); }
        .cp-recall-btn {
          width: 34px; height: 34px; border-radius: 17px;
          background: rgba(44,107,237,0.15); border: 1px solid rgba(44,107,237,0.2);
          color: #2c6bed; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.15s;
        }
        .cp-recall-btn:hover { background: rgba(44,107,237,0.28); }
        .cp-recall-btn:active { transform: scale(0.9); }

        .cp-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; gap: 12px; padding-top: 20vh;
          color: rgba(255,255,255,0.3);
        }
        .cp-empty-icon {
          width: 80px; height: 80px; border-radius: 40px;
          background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center;
          margin-bottom: 8px;
        }
        .cp-empty h3 { font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.5); }
        .cp-empty p { font-size: 14px; color: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
};

export default CallsPage;
