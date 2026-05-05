import React, { useState } from 'react';
import { ChevronLeft, Mail, Globe, Shield, MessageSquare, ChevronRight } from 'lucide-react';

const HelpPage = ({ onBack }) => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate submission
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div className="settings-view animate-fade-in">
      <header className="settings-header">
        <button className="icon-btn" onClick={onBack}><ChevronLeft /></button>
        <div className="settings-title">Help & About</div>
      </header>

      <div className="settings-content">
        <div className="p-6">
          <div className="text-center mb-8">
            <div className="logo-icon mb-4"><Shield size={40} className="text-accent" /></div>
            <h2 className="text-xl font-bold">WhisperBox</h2>
            <p className="text-secondary">Version 2.4.0</p>
          </div>

          <div className="settings-section-title mb-4 text-secondary font-bold text-xs uppercase tracking-wider">Contact Us</div>

          {submitted ? (
            <div className="glass p-6 rounded-2xl text-center animate-fade-in">
              <div className="text-success mb-2 font-bold">Message Sent!</div>
              <p className="text-sm text-secondary">We'll get back to you shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Name"
                className="input"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                className="input"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <textarea
                placeholder="How can we help?"
                className="input"
                rows={4}
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
              <button type="submit" className="btn btn-primary">Submit Feedback</button>
            </form>
          )}

          <div className="settings-section">
            <div className="settings-section-title">Support Channels</div>
            <div className="settings-item">
              <div className="settings-icon-wrap" style={{ background: '#2c6bed' }}><Globe size={20} /></div>
              <div className="settings-item-label">Official Website</div>
              <ChevronRight size={18} className="text-secondary" />
            </div>
            <div className="settings-item">
              <div className="settings-icon-wrap" style={{ background: '#32d74b' }}><Mail size={20} /></div>
              <div className="settings-item-label">support@whisperbox.app</div>
              <ChevronRight size={18} className="text-secondary" />
            </div>
            <div className="settings-item">
              <div className="settings-icon-wrap" style={{ background: '#af52de' }}><MessageSquare size={20} /></div>
              <div className="settings-item-label">Community Forum</div>
              <ChevronRight size={18} className="text-secondary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
