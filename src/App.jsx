import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import Onboarding from './components/Onboarding';
import SettingsPage from './pages/SettingsPage';
import PrivacySettings from './pages/settings/PrivacySettings';
import ChatSettings from './pages/settings/ChatSettings';
import NotificationSettings from './pages/settings/NotificationSettings';
import HelpPage from './pages/settings/HelpPage';
import StoriesPage from './pages/StoriesPage';
import CallsPage from './pages/CallsPage';
import SearchUserPage from './pages/SearchUserPage';
import { Loader2, Shield } from 'lucide-react';

const AppContent = () => {
  const auth = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(null);
  
  // view.type can be: 'chat' | 'profile' | 'settings' | 'privacy' | 'chat_settings' | 'notifications' | 'help'
  // and tabs within chat: 'chats' | 'calls' | 'stories' (handled inside ChatPage, but App could also handle it)
  const [view, setView] = useState({ type: 'chat' }); 
  
  useEffect(() => {
    const seen = localStorage.getItem('hasSeenOnboarding');
    setShowOnboarding(seen === 'true');
  }, []);

  if (!auth || auth.loading || showOnboarding === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <Loader2 className="animate-spin mb-4 mx-auto text-blue-500" size={48} />
          <h1 className="text-2xl font-bold tracking-tight">WhisperBox</h1>
          <p className="text-secondary mt-2">Initializing secure environment...</p>
        </div>
      </div>
    );
  }

  const { user, appBusy, appBusyLabel } = auth;

  if (!showOnboarding && !user) {
    return <Onboarding onFinish={() => {
      localStorage.setItem('hasSeenOnboarding', 'true');
      setShowOnboarding(true);
    }} />;
  }

  if (!user) {
    return (
      <>
        <AuthPage />
        {appBusy && (
          <div className="global-loading-overlay">
            <div className="whatsapp-spinner-wrap">
              <div className="whatsapp-spinner-ring" />
              <div className="whatsapp-spinner-logo">
                <Shield size={32} />
              </div>
            </div>
            <div className="global-loading-label">{appBusyLabel}</div>
          </div>
        )}
      </>
    );
  }

  let content;
  switch (view.type) {
    case 'profile':
      content = <ProfilePage onBack={() => setView({ type: 'chat' })} partner={view.partner} />;
      break;
    
    case 'settings':
      content = (
        <SettingsPage 
          onBack={() => setView({ type: 'chat' })} 
          onNavigate={(id) => setView({ type: id })}
          onOpenProfile={() => setView({ type: 'profile' })}
        />
      );
      break;
    
    case 'privacy':
      content = <PrivacySettings onBack={() => setView({ type: 'settings' })} />;
      break;
    
    case 'chats':
      content = <ChatSettings onBack={() => setView({ type: 'settings' })} />;
      break;
    
    case 'notifications':
      content = <NotificationSettings onBack={() => setView({ type: 'settings' })} />;
      break;
    
    case 'help':
      content = <HelpPage onBack={() => setView({ type: 'settings' })} />;
      break;

    case 'search':
      content = (
        <SearchUserPage 
          onBack={() => setView({ type: 'chat' })} 
          onStartChat={(partner) => {
            setView({ type: 'chat', selectedPartner: partner });
          }} 
        />
      );
      break;

    default:
      content = (
        <ChatPage 
          onOpenProfile={(partner) => setView({ type: 'profile', partner })} 
          onOpenSettings={() => setView({ type: 'settings' })}
          onOpenSearch={() => setView({ type: 'search' })}
          initialChat={view.selectedPartner}
        />
      );
      break;
  }

  return (
    <>
      {content}
      {appBusy && (
        <div className="global-loading-overlay">
          <div className="whatsapp-spinner-wrap">
            <div className="whatsapp-spinner-ring" />
            <div className="whatsapp-spinner-logo">
              <Shield size={32} />
            </div>
          </div>
          <div className="global-loading-label">{appBusyLabel}</div>
        </div>
      )}
    </>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
