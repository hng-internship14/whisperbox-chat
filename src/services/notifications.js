let audioContext = null;

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window;

const playBeep = (frequency = 880, duration = 0.18) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = audioContext || new AudioCtx();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.03;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn('Unable to play notification sound', error);
  }
};

export const notificationService = {
  async requestPermission() {
    if (!canNotify() || Notification.permission === 'granted') return Notification.permission;
    return Notification.requestPermission();
  },

  async notify({ title, body, tag, silent = false }) {
    if (!canNotify()) return;
    if (Notification.permission !== 'granted') {
      await this.requestPermission();
    }
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(title, { body, tag, silent });
    notification.onclick = () => window.focus();
  },

  async notifyIncomingMessage(senderName, preview, shouldPlaySound = false) {
    if (shouldPlaySound) {
      playBeep(960, 0.12);
    }
    await this.notify({
      title: senderName,
      body: preview,
      tag: `message:${senderName}`,
      silent: !shouldPlaySound,
    });
  },

  async notifyIncomingCall(callerName, callType, shouldPlaySound = false) {
    if (shouldPlaySound) {
      playBeep(540, 0.18);
      setTimeout(() => playBeep(680, 0.18), 220);
    }
    await this.notify({
      title: `${callerName} is calling`,
      body: callType === 'video' ? 'Incoming video call' : 'Incoming voice call',
      tag: `call:${callerName}`,
      silent: !shouldPlaySound,
    });
  },
};
