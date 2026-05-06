import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/socket';
import { callLogService } from '../services/api';
import { notificationService } from '../services/notifications';

export const CALL_STATE = {
  IDLE: 'idle',
  OFFERING: 'offering',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  ENDED: 'ended',
  CONNECTING: 'connecting'
};

const buildIceConfig = () => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl.split(',').map((value) => value.trim()).filter(Boolean),
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return { iceServers };
};

const ICE_CONFIG = buildIceConfig();

export const useWebRTC = ({ user, onCallStateChange, onCallLogged }) => {
  const [callState, setCallState] = useState(CALL_STATE.IDLE);
  const [partner, setPartner] = useState(null);
  const [callType, setCallType] = useState('voice'); // 'voice' | 'video'
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callError, setCallError] = useState('');
  
  const pc = useRef(null);
  const callStartTime = useRef(null);
  const pendingCandidates = useRef([]);
  const unansweredTimeout = useRef(null);

  const cleanup = useCallback(() => {
    if (unansweredTimeout.current) {
      clearTimeout(unansweredTimeout.current);
      unansweredTimeout.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    pendingCandidates.current = [];
  }, [localStream]);

  const endCall = useCallback((reason = 'ended', remoteNotified = false) => {
    if (partner) {
      const duration = callStartTime.current
        ? Math.floor((Date.now() - callStartTime.current) / 1000)
        : 0;
      const direction = callState === CALL_STATE.OFFERING ? 'outgoing' : 'incoming';
      const logEntry = {
        partnerId: partner.user_id || partner.id,
        partnerName: partner.display_name || partner.username || 'Unknown',
        partnerAvatar: partner.avatar || null,
        type: callType,
        direction,
        durationSeconds: duration,
        reason,
      };
      callLogService.addLog(user.id, logEntry);
      onCallLogged?.(logEntry);
    }

    if (!remoteNotified && partner) {
      socketService.send('call.ended', { to: partner.user_id || partner.id });
    }

    if (reason === 'missed') {
      setCallError('No answer');
    } else if (reason === 'remote-ended') {
      setCallError('Call ended');
    } else if (reason === 'error') {
      setCallError('Call failed');
    } else if (reason === 'rejected' || reason === 'busy') {
      setCallError('Call declined');
    } else {
      setCallError('');
    }

    cleanup();
    setCallState(CALL_STATE.ENDED);
    setTimeout(() => {
      setCallState(CALL_STATE.IDLE);
      setPartner(null);
      callStartTime.current = null;
      setCallError('');
    }, 2000);
  }, [partner, callType, callState, user.id, cleanup, onCallLogged]);

  const initPeerConnection = useCallback((targetPartnerId) => {
    if (pc.current) return pc.current;

    console.log('[WebRTC] Initializing PeerConnection for:', targetPartnerId);
    const peer = new RTCPeerConnection(ICE_CONFIG);

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate');
        socketService.send('call.ice-candidate', {
          to: targetPartnerId,
          candidate: event.candidate
        });
      }
    };

    peer.ontrack = (event) => {
      console.log('[WebRTC] Received remote track');
      setRemoteStream(event.streams[0]);
    };

    peer.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', peer.connectionState);
      if (peer.connectionState === 'connected') {
        setCallState(CALL_STATE.CONNECTED);
        callStartTime.current = Date.now();
      } else if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        endCall('disconnected', true);
      }
    };

    pc.current = peer;
    return peer;
  }, [endCall]);

  const startCall = async (targetPartner, type = 'voice') => {
    if (callState !== CALL_STATE.IDLE) return;
    setPartner(targetPartner);
    setCallType(type);
    setCallState(CALL_STATE.OFFERING);
    setCallError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      setLocalStream(stream);

      const peer = initPeerConnection(targetPartner.user_id || targetPartner.id);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      console.log('[WebRTC] Sending Call Offer to:', targetPartner.user_id || targetPartner.id);
      socketService.send('call.offer', {
        to: targetPartner.user_id || targetPartner.id,
        callType: type,
        offer: offer,
        from: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar: user.avatar
        }
      });

      unansweredTimeout.current = setTimeout(() => {
        endCall('missed');
      }, 30000);

    } catch (err) {
      console.error('Failed to start call', err);
      endCall('error');
    }
  };

  const acceptIncomingCall = async () => {
    if (!partner) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      setLocalStream(stream);

      const peer = initPeerConnection(partner.user_id || partner.id);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      console.log('[WebRTC] Sending Call Answer to:', partner.user_id || partner.id);
      socketService.send('call.answer', {
        to: partner.user_id || partner.id,
        answer: answer
      });

      if (unansweredTimeout.current) {
        clearTimeout(unansweredTimeout.current);
        unansweredTimeout.current = null;
      }
      setCallState(CALL_STATE.CONNECTING);
    } catch (err) {
      console.error('Failed to accept call', err);
      endCall('error');
    }
  };

  const rejectIncomingCall = () => {
    if (partner) {
      socketService.send('call.rejected', { to: partner.user_id || partner.id, reason: 'declined' });
    }
    endCall('rejected', true);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream && callType === 'video') {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  useEffect(() => {
    onCallStateChange?.(callState);
  }, [callState, onCallStateChange]);

  useEffect(() => {
    const removeListener = socketService.addListener(async (msg) => {
      switch (msg.type) {
        case 'call.offer':
          if (callState !== CALL_STATE.IDLE) {
            socketService.send('call.rejected', { to: msg.from.id, reason: 'busy' });
            break;
          }
          console.log('[WebRTC] Received Call Offer from:', msg.from.username);
          setPartner(msg.from);
          setCallType(msg.callType || 'voice');
          setCallState(CALL_STATE.RINGING);
          setCallError('');
          if (document.hidden) {
            notificationService.notifyIncomingCall(
              msg.from?.display_name || msg.from?.username || 'Unknown',
              msg.callType || 'voice',
              true
            );
          }
          
          const peerO = initPeerConnection(msg.from.id);
          await peerO.setRemoteDescription(new RTCSessionDescription(msg.offer));
          
          while (pendingCandidates.current.length > 0) {
            const cand = pendingCandidates.current.shift();
            await peerO.addIceCandidate(new RTCIceCandidate(cand));
          }
          break;

        case 'call.answer':
          console.log('[WebRTC] Received Call Answer');
          if (unansweredTimeout.current) {
            clearTimeout(unansweredTimeout.current);
            unansweredTimeout.current = null;
          }
          setCallState(CALL_STATE.CONNECTING);
          if (pc.current) {
            await pc.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
          }
          break;

        case 'call.ice-candidate':
          console.log('[WebRTC] Received ICE candidate');
          const candidate = msg.candidate;
          if (pc.current && pc.current.remoteDescription) {
            try {
              await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('[WebRTC] Error adding ice candidate', e);
            }
          } else {
            pendingCandidates.current.push(candidate);
          }
          break;

        case 'call.rejected':
          endCall(msg.reason === 'busy' ? 'busy' : 'rejected', true);
          break;
        case 'call.ended':
          endCall('remote-ended', true);
          break;
      }
    });
    return () => {
      removeListener();
      cleanup();
    };
  }, [endCall, initPeerConnection, cleanup]);

  return {
    callState,
    partner,
    callType,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    callError,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleCamera
  };
};
