import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userStorageService } from '../services/storage';
import { userService } from '../services/api';
import { ChevronLeft, Camera, Check, User, Mail, Phone, Shield, Info, LogOut, UserPlus } from 'lucide-react';

const ProfilePage = ({ onBack, partner = null }) => {
  const { user, updateUserLocal, broadcastProfileUpdate, logout, contacts, addContact, removeContact } = useAuth();

  const isOwnProfile = !partner;
  const cachedPartnerProfile = partner ? userStorageService.getProfile(partner.id || partner.user_id) : {};
  const targetUser = isOwnProfile ? user : { ...partner, ...cachedPartnerProfile };

  const [displayName, setDisplayName] = useState(targetUser?.display_name || '');
  const [email, setEmail]             = useState(targetUser?.email || '');
  const [phone, setPhone]             = useState(targetUser?.phone || '');
  const [about, setAbout]             = useState(targetUser?.about || '');
  const [avatar, setAvatar]           = useState(targetUser?.avatar || null);
  const [isSaving, setIsSaving]       = useState(false);
  const [showSaved, setShowSaved]     = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);

  const partnerId = partner?.id || partner?.user_id || null;
  const isContact = partner && contacts.some(c => c.id === partnerId);

  useEffect(() => {
    if (targetUser) {
      setDisplayName(targetUser.display_name || '');
      setEmail(targetUser.email || '');
      setPhone(targetUser.phone || '');
      setAbout(targetUser.about || '');
      setAvatar(targetUser.avatar || null);
    }
  }, [targetUser]);

  useEffect(() => {
    const hydratePartnerProfile = async () => {
      if (isOwnProfile || !partner) return;
      const missingDetails = !cachedPartnerProfile?.email && !cachedPartnerProfile?.phone && !cachedPartnerProfile?.about && !cachedPartnerProfile?.avatar;
      if (!missingDetails || !partner.username) return;

      try {
        const results = await userService.search(partner.username);
        const matchedUser = results.find((result) =>
          result.id === partnerId || result.username === partner.username
        );
        if (!matchedUser) return;

        const mergedProfile = { ...cachedPartnerProfile, ...matchedUser };
        userStorageService.setProfile(partnerId, mergedProfile);
        setDisplayName(mergedProfile.display_name || '');
        setEmail(mergedProfile.email || '');
        setPhone(mergedProfile.phone || '');
        setAbout(mergedProfile.about || '');
        setAvatar(mergedProfile.avatar || null);
      } catch (err) {
        console.error('Failed to hydrate partner profile', err);
      }
    };

    hydratePartnerProfile();
  }, [cachedPartnerProfile, isOwnProfile, partner, partnerId]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatar(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!isOwnProfile) return;
    setIsSaving(true);
    try {
      const updatedProfile = { display_name: displayName, email, phone, about, avatar };
      updateUserLocal(updatedProfile);
      broadcastProfileUpdate(updatedProfile);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleContact = () => {
    if (!partner) return;
    if (isContact) {
      removeContact(partnerId);
    } else {
      addContact({ id: partnerId, username: partner.username, display_name: partner.display_name, avatar: partner.avatar });
    }
  };

  const initials = (displayName || targetUser?.username || '?')[0].toUpperCase();

  return (
    <div className="settings-view animate-fade-in" style={{ background: 'var(--bg-dark)' }}>
      <header className="settings-header">
        <button className="icon-btn" onClick={onBack}><ChevronLeft /></button>
        <div className="settings-title">{isOwnProfile ? 'Edit Profile' : 'Profile'}</div>
        {isOwnProfile && (
          <button className="pp-save-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <span className="pp-saving-dots"><span/><span/><span/></span> : 'Save'}
          </button>
        )}
        {!isOwnProfile && partner && (
          <button className="pp-contact-btn" onClick={handleToggleContact}>
            <UserPlus size={16} />
            {isContact ? 'Remove' : 'Add'}
          </button>
        )}
      </header>

      {/* Hero avatar */}
      <div className="pp-hero">
        <label
          className="pp-avatar-wrap"
          onMouseEnter={() => setAvatarHover(true)}
          onMouseLeave={() => setAvatarHover(false)}
          style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}
        >
          <div className="pp-avatar">
            {avatar
              ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : <span>{initials}</span>
            }
          </div>

          {/* Camera overlay — WhatsApp style */}
          {isOwnProfile && (
            <>
              <div className={`pp-camera-overlay ${avatarHover ? 'visible' : ''}`}>
                <Camera size={28} color="white" />
                <span>Change Photo</span>
              </div>
              <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
            </>
          )}
        </label>

        <h2 className="pp-name">{displayName || 'Anonymous'}</h2>
        <p className="pp-username">@{targetUser?.username}</p>
        {about && <p className="pp-about">{about}</p>}
      </div>

      {/* Success banner */}
      {showSaved && (
        <div className="pp-success animate-slide-up">
          <Check size={16} /> Profile updated
        </div>
      )}

      {/* Form fields */}
      <div className="settings-content">
        <div className="settings-section">
          <div className="settings-section-title">Account Info</div>

          {[
            { icon: User,  label: 'Display Name', value: displayName, setter: setDisplayName, type: 'text',  placeholder: 'Your name' },
            { icon: Phone, label: 'Phone Number',  value: phone,       setter: setPhone,       type: 'tel',   placeholder: '+1 555 000 0000' },
            { icon: Mail,  label: 'Email',         value: email,       setter: setEmail,       type: 'email', placeholder: 'email@example.com' },
          ].map(({ icon: Icon, label, value, setter, type, placeholder }) => (
            <div key={label} className="pp-field">
              <Icon size={18} className="pp-field-icon" />
              <div className="pp-field-body">
                <label className="pp-field-label">{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  readOnly={!isOwnProfile}
                  className="pp-field-input"
                />
              </div>
            </div>
          ))}

          <div className="pp-field">
            <Info size={18} className="pp-field-icon" style={{ marginTop: 4 }} />
            <div className="pp-field-body">
              <label className="pp-field-label">About</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Tell people about yourself..."
                readOnly={!isOwnProfile}
                className="pp-field-input"
                rows={2}
                style={{ resize: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* E2EE notice */}
        <div className="settings-section">
          <div className="pp-e2ee-notice">
            <Shield size={18} style={{ color: 'var(--signal-blue, #2c6bed)', flexShrink: 0 }} />
            <p>Your identity is secured by end-to-end encryption. Username and public key are permanent.</p>
          </div>
        </div>

        {/* Logout */}
        {isOwnProfile && (
          <div className="p-4">
            <button className="pp-logout-btn" onClick={logout}>
              <LogOut size={18} />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {showSaved && (
        <div className="pp-toast animate-fade-in">
          <Check size={16} /> Profile Updated
        </div>
      )}

      <style>{`
        .pp-hero {
          display: flex; flex-direction: column; align-items: center;
          padding: 28px 24px 20px; gap: 4px;
        }
        .pp-avatar-wrap { position: relative; display: block; }
        .pp-avatar {
          width: 120px; height: 120px; border-radius: 60px;
          background: linear-gradient(135deg, #2c6bed 0%, #7c3aed 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 3rem; font-weight: 700; color: white;
          box-shadow: 0 8px 32px rgba(44,107,237,0.35);
          overflow: hidden; position: relative;
          border: 3px solid rgba(44,107,237,0.3);
          transition: box-shadow 0.2s;
        }
        .pp-avatar-wrap:hover .pp-avatar { box-shadow: 0 8px 40px rgba(44,107,237,0.55); }

        /* WhatsApp-style camera overlay */
        .pp-camera-overlay {
          position: absolute; inset: 0; border-radius: 60px;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(2px);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
          opacity: 0; transition: opacity 0.2s; cursor: pointer;
          color: white; font-size: 11px; font-weight: 600; letter-spacing: 0.3px;
          pointer-events: none;
        }
        .pp-camera-overlay.visible { opacity: 1; pointer-events: all; }
        .pp-avatar-wrap:hover .pp-camera-overlay { opacity: 1; pointer-events: all; }

        .pp-name { font-size: 22px; font-weight: 700; color: white; margin-top: 12px; text-align: center; }
        .pp-username { font-size: 14px; color: rgba(255,255,255,0.45); text-align: center; }
        .pp-about { font-size: 14px; color: rgba(255,255,255,0.6); text-align: center; margin-top: 4px; max-width: 280px; }

        .pp-save-btn {
          padding: 7px 18px; border-radius: 20px; border: none; cursor: pointer; font-weight: 700;
          font-size: 14px; background: linear-gradient(135deg, #2c6bed, #7c3aed); color: white;
          transition: opacity 0.2s, transform 0.15s; box-shadow: 0 4px 14px rgba(44,107,237,0.4);
        }
        .pp-save-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .pp-save-btn:active { transform: scale(0.95); }
        .pp-save-btn:disabled { opacity: 0.5; }
        .pp-saving-dots { display: flex; gap: 4px; align-items: center; height: 16px; }
        .pp-saving-dots span {
          width: 5px; height: 5px; border-radius: 50%; background: white;
          animation: ppDot 1s infinite;
        }
        .pp-saving-dots span:nth-child(2) { animation-delay: 0.2s; }
        .pp-saving-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes ppDot { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }

        .pp-contact-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 20px;
          background: rgba(44,107,237,0.15); border: 1px solid rgba(44,107,237,0.3);
          color: #2c6bed; font-weight: 600; font-size: 13px; cursor: pointer;
          transition: background 0.18s;
        }
        .pp-contact-btn:hover { background: rgba(44,107,237,0.25); }

        .pp-field {
          display: flex; gap: 16px; padding: 12px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06); align-items: flex-start;
        }
        .pp-field-icon { color: rgba(255,255,255,0.4); margin-top: 18px; flex-shrink: 0; }
        .pp-field-body { flex: 1; }
        .pp-field-label { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
        .pp-field-input {
          width: 100%; background: transparent; border: none; color: white;
          font-size: 15px; outline: none; padding: 2px 0; font-family: inherit;
          border-bottom: 1px solid transparent; transition: border-color 0.2s;
        }
        .pp-field-input:focus { border-bottom-color: rgba(44,107,237,0.5); }
        .pp-field-input::placeholder { color: rgba(255,255,255,0.2); }
        .pp-field-input[readonly] { cursor: default; }

        .pp-e2ee-notice {
          display: flex; gap: 12px; align-items: flex-start;
          padding: 14px 20px; background: rgba(44,107,237,0.08);
          border: 1px solid rgba(44,107,237,0.15); border-radius: 14px; margin: 4px 16px 12px;
        }
        .pp-e2ee-notice p { font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.5; }

        .pp-logout-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 14px; border-radius: 14px; border: 1px solid rgba(255,69,58,0.25);
          background: rgba(255,69,58,0.08); color: #ff453a;
          font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.18s;
        }
        .pp-logout-btn:hover { background: rgba(255,69,58,0.15); }

        .pp-success {
          margin: 0 16px 8px; padding: 10px 16px; border-radius: 12px;
          background: rgba(50,215,75,0.12); border: 1px solid rgba(50,215,75,0.25);
          color: #32d74b; font-size: 14px; font-weight: 600;
          display: flex; align-items: center; gap: 8px;
        }
        .pp-toast {
          position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
          background: rgba(30,30,40,0.95); border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(16px); padding: 10px 20px; border-radius: 24px;
          display: flex; align-items: center; gap: 8px; color: #32d74b;
          font-weight: 600; font-size: 14px; z-index: 999;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;
