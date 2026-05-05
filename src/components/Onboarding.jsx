import React, { useState } from 'react';
import { Shield, Lock, MessageSquare, ChevronRight, Check } from 'lucide-react';

const Onboarding = ({ onFinish }) => {
  const [step, setStep] = useState(0);

  const slides = [
    {
      title: 'Welcome to WhisperBox',
      description: 'The most secure way to communicate with your friends and family.',
      icon: <Shield size={60} />,
      color: '#2c6bed'
    },
    {
      title: 'End-to-End Encryption',
      description: 'Your messages are encrypted before they even leave your device.',
      icon: <Lock size={60} />,
      color: '#32d74b'
    },
    {
      title: 'Privacy First',
      description: 'No ads, no tracking, no compromise. Just you and your conversations.',
      icon: <MessageSquare size={60} />,
      color: '#af52de'
    }
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      onFinish();
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <div className="auth-card glass animate-fade-in" style={{ maxWidth: 450 }}>
        <div className="flex flex-col items-center gap-8 py-4">
          <div 
            className="slide-icon-signal" 
            style={{ background: slides[step].color }}
          >
            {slides[step].icon}
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-extrabold mb-4">{slides[step].title}</h1>
            <p className="text-secondary leading-relaxed px-4">{slides[step].description}</p>
          </div>

          <div className="flex gap-2">
            {slides.map((_, i) => (
              <div 
                key={i} 
                className={`indicator-signal ${step === i ? 'active' : ''}`} 
              />
            ))}
          </div>

          <div className="flex gap-4 w-full mt-4">
            {step > 0 && (
              <button className="btn btn-secondary flex-1 h-14 rounded-2xl" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button className={`btn btn-primary h-14 rounded-2xl ${step > 0 ? 'flex-1' : 'w-full'}`} onClick={handleNext}>
              <span>{step === slides.length - 1 ? 'Get Started' : 'Continue'}</span>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .slide-icon-signal {
          width: 120px;
          height: 120px;
          border-radius: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .indicator-signal {
          width: 8px;
          height: 8px;
          border-radius: 4px;
          background: var(--text-dim);
          transition: all 0.3s ease;
        }
        .indicator-signal.active {
          width: 24px;
          background: var(--signal-blue);
        }
      `}</style>
    </div>
  );
};

export default Onboarding;
