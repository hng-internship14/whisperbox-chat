import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, ChevronDown } from 'lucide-react';
import { CALL_STATE } from '../hooks/useWebRTC';

const CallOverlay = ({
  callState, partner, callType,
  localStream, remoteStream,
  isMuted, isCameraOff, callError,
  onAccept, onDecline, onEnd,
  onToggleMute, onToggleCamera,
  onCallEnded // callback → navigate to calls page
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Timer
  useEffect(() => {
    if (callState === CALL_STATE.CONNECTED) {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (callState !== CALL_STATE.CONNECTED) setCallDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleEnd = () => {
    onEnd();
    // After a brief pause so the ENDED animation shows, navigate to calls tab
    setTimeout(() => { if (onCallEnded) onCallEnded(); }, 1200);
  };

  const handleDecline = () => {
    onDecline();
    setTimeout(() => { if (onCallEnded) onCallEnded(); }, 800);
  };

  if (callState === CALL_STATE.IDLE) return null;

  const partnerName = partner?.display_name || partner?.username || 'Unknown';
  const partnerInitial = partnerName[0]?.toUpperCase() || '?';

  const statusLabel =
    callState === CALL_STATE.RINGING  ? 'Incoming Call' :
    callState === CALL_STATE.OFFERING ? 'Calling...' :
    callState === CALL_STATE.CONNECTING ? 'Connecting...' :
    callState === CALL_STATE.CONNECTED ? formatDuration(callDuration) :
    (callError || 'Call Ended');

  return (
    <div className="co-backdrop">
      <div className={`co-card ${callState === CALL_STATE.ENDED ? 'co-ending' : 'co-active'}`}>

        {/* Header */}
        <div className="co-header">
          <button className="co-minimize-btn" onClick={handleEnd}>
            <ChevronDown size={22} />
          </button>
          <span className="co-type-label">
            {callType === 'video' ? 'Video Call' : 'Voice Call'}
          </span>
          <div style={{ width: 36 }} />
        </div>

        {/* Body */}
        {callType === 'video' && (callState === CALL_STATE.CONNECTED || callState === CALL_STATE.OFFERING || callState === CALL_STATE.CONNECTING) ? (
          <div className="co-video-grid">
            <video ref={remoteVideoRef} autoPlay playsInline className="co-remote-video" />
            <video ref={localVideoRef}  autoPlay playsInline muted className="co-local-video" />
            <div className="co-video-status">{statusLabel}</div>
          </div>
        ) : (
          <div className="co-audio-body">
            <div className="co-avatar-wrap">
              {callState === CALL_STATE.RINGING && <div className="co-ring-1" />}
              {callState === CALL_STATE.RINGING && <div className="co-ring-2" />}
              <div className="co-avatar">
                {partner?.avatar
                  ? <img src={partner.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : <span>{partnerInitial}</span>
                }
              </div>
            </div>
            <h2 className="co-name">{partnerName}</h2>
            <p className="co-status">{statusLabel}</p>
          </div>
        )}

        {/* Controls */}
        <div className="co-footer">
          {callState === CALL_STATE.RINGING ? (
            <div className="co-actions">
              <div className="co-action-wrap">
                <button className="co-btn co-btn-decline" onClick={handleDecline}>
                  <PhoneOff size={28} />
                </button>
                <span className="co-btn-label">Decline</span>
              </div>
              <div className="co-action-wrap">
                <button className="co-btn co-btn-accept" onClick={onAccept}>
                  <Phone size={28} />
                </button>
                <span className="co-btn-label">Accept</span>
              </div>
            </div>
          ) : (
            <div className="co-actions">
              <div className="co-action-wrap">
                <button className={`co-icon-btn ${isMuted ? 'co-icon-active' : ''}`} onClick={onToggleMute}>
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
                <span className="co-btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
              </div>
              <div className="co-action-wrap">
                <button className="co-btn co-btn-decline" onClick={handleEnd}>
                  <PhoneOff size={28} />
                </button>
                <span className="co-btn-label">End</span>
              </div>
              {callType === 'video' && (
                <div className="co-action-wrap">
                  <button className={`co-icon-btn ${isCameraOff ? 'co-icon-active' : ''}`} onClick={onToggleCamera}>
                    {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
                  </button>
                  <span className="co-btn-label">{isCameraOff ? 'Show' : 'Camera'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .co-backdrop {
          position: fixed; inset: 0; z-index: 3000;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(24px);
          display: flex; align-items: flex-end; justify-content: center;
          padding: 0;
          animation: coFadeIn 0.3s ease;
        }
        @keyframes coFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .co-card {
          width: 100%; max-width: 480px; height: 88vh;
          background: linear-gradient(170deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          border-radius: 32px 32px 0 0;
          display: flex; flex-direction: column; overflow: hidden;
          position: relative;
          border: 1px solid rgba(255,255,255,0.08);
          border-bottom: none;
          box-shadow: 0 -20px 60px rgba(0,0,0,0.6);
        }
        .co-active { animation: coSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1); }
        .co-ending { animation: coPulse 0.5s ease; opacity: 0.7; }
        @keyframes coSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes coPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(0.98); } }

        .co-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 20px 8px;
        }
        .co-minimize-btn {
          width: 36px; height: 36px; border-radius: 18px;
          background: rgba(255,255,255,0.1); border: none; color: white;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background 0.2s;
        }
        .co-minimize-btn:hover { background: rgba(255,255,255,0.18); }
        .co-type-label { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); letter-spacing: 0.5px; }

        .co-audio-body {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 0; padding: 20px;
        }
        .co-avatar-wrap { position: relative; width: 130px; height: 130px; }
        .co-avatar {
          width: 130px; height: 130px; border-radius: 65px;
          background: linear-gradient(135deg, #2c6bed, #7c3aed);
          display: flex; align-items: center; justify-content: center;
          font-size: 3.5rem; font-weight: 700; color: white; position: relative; z-index: 1;
        }
        .co-ring-1, .co-ring-2 {
          position: absolute; inset: -12px; border-radius: 50%;
          border: 2px solid rgba(44,107,237,0.4);
          animation: coRing 2s ease-out infinite;
        }
        .co-ring-2 { inset: -24px; animation-delay: 0.5s; }
        @keyframes coRing { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }

        .co-name { font-size: 28px; font-weight: 700; color: white; margin-top: 24px; text-align: center; }
        .co-status { font-size: 16px; color: rgba(255,255,255,0.55); margin-top: 8px; font-variant-numeric: tabular-nums; }

        .co-video-grid { flex: 1; position: relative; background: #000; }
        .co-remote-video { width: 100%; height: 100%; object-fit: cover; }
        .co-local-video {
          position: absolute; bottom: 16px; right: 16px;
          width: 110px; height: 150px; border-radius: 16px;
          object-fit: cover; border: 2px solid rgba(255,255,255,0.15);
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        .co-video-status {
          position: absolute;
          left: 50%;
          top: 18px;
          transform: translateX(-50%);
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(0,0,0,0.45);
          color: rgba(255,255,255,0.88);
          font-size: 13px;
          font-weight: 600;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .co-footer { padding: 32px 20px 40px; }
        .co-actions { display: flex; align-items: flex-start; justify-content: center; gap: 40px; }
        .co-action-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .co-btn-label { font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 500; }

        .co-btn {
          width: 72px; height: 72px; border-radius: 36px;
          display: flex; align-items: center; justify-content: center;
          border: none; cursor: pointer; color: white;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .co-btn:active { transform: scale(0.92); }
        .co-btn-accept { background: linear-gradient(135deg, #32d74b, #28a745); }
        .co-btn-decline { background: linear-gradient(135deg, #ff453a, #c0392b); }

        .co-icon-btn {
          width: 60px; height: 60px; border-radius: 30px;
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.1);
          color: white; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.2s, transform 0.15s;
        }
        .co-icon-btn:active { transform: scale(0.92); }
        .co-icon-active { background: white !important; color: #1a1a2e !important; }
      `}</style>
    </div>
  );
};

export default CallOverlay;
