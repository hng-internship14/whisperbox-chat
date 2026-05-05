import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { storyService, messageService } from '../services/api';
import { 
  Plus, 
  X, 
  ChevronLeft, 
  Shield, 
  Send,
  Camera,
  RotateCcw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const StoriesPage = ({ onBack }) => {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [showCreator, setShowCreator] = useState(false);
  const [newStoryContent, setNewStoryContent] = useState('');
  const [activeStory, setActiveStory] = useState(null);

  useEffect(() => {
    const fetchAndFilterStories = async () => {
      try {
        // Get active conversations to identify "contacts"
        const conversations = await messageService.listConversations();
        const contactIds = conversations.map(c => c.user_id);
        
        // Filter stories: own stories + stories from contacts
        const allStories = storyService.getAll(user.id);
        const filtered = allStories.filter(s => 
          s.userId === user.id || contactIds.includes(s.userId)
        );
        
        setStories(filtered);
      } catch (e) {
        console.error('Failed to filter stories', e);
        // Fallback to all stories if API fails
        setStories(storyService.getAll(user.id));
      }
    };

    fetchAndFilterStories();
  }, [user.id]);

  const handlePostStory = () => {
    if (!newStoryContent.trim()) return;
    const newStory = storyService.addStory(
      user.id,
      user.display_name,
      user.avatar,
      newStoryContent,
      'text'
    );
    setStories([...stories, newStory]);
    setNewStoryContent('');
    setShowCreator(false);
  };

  const groupedStories = stories.reduce((acc, story) => {
    if (!acc[story.userId]) acc[story.userId] = [];
    acc[story.userId].push(story);
    return acc;
  }, {});

  return (
    <div className="settings-view animate-fade-in" style={{ height: '100%' }}>
      <header className="sidebar-header" style={{ height: 64 }}>
        <button className="icon-btn" onClick={onBack}><ChevronLeft /></button>
        <div className="sidebar-title">Stories</div>
        <button className="icon-btn" onClick={() => setShowCreator(true)}><Plus /></button>
      </header>

      <div className="stories-grid">
        {/* My Story */}
        <div className="story-card" onClick={() => setShowCreator(true)}>
          <div className="story-ring" style={{ borderStyle: 'dashed', opacity: 0.5 }}>
            <div className="story-avatar">
              {user.avatar ? <img src={user.avatar} alt="" /> : <Plus size={32} className="text-secondary" />}
            </div>
          </div>
          <span className="story-name">My Story</span>
        </div>

        {/* Contact Stories */}
        {Object.keys(groupedStories).map(userId => {
          const userStories = groupedStories[userId];
          const latest = userStories[userStories.length - 1];
          return (
            <div key={userId} className="story-card" onClick={() => setActiveStory(userStories)}>
              <div className="story-ring">
                <div className="story-avatar">
                  {latest.avatar ? <img src={latest.avatar} alt="" /> : <span>{latest.displayName[0]}</span>}
                </div>
              </div>
              <span className="story-name">{latest.displayName}</span>
            </div>
          );
        })}
      </div>

      {stories.length === 0 && !showCreator && (
        <div className="empty-state" style={{ marginTop: '20vh' }}>
          <div className="logo-icon mb-4"><RotateCcw size={40} /></div>
          <p>No stories yet.</p>
          <p className="text-sm">Stories disappear after 24 hours.</p>
        </div>
      )}

      {/* Story Creator Overlay */}
      {showCreator && (
        <div className="call-overlay glass animate-slide-up" style={{ padding: '2rem' }}>
          <header className="w-full flex justify-between items-center mb-8">
            <button className="icon-btn" onClick={() => setShowCreator(false)}><X /></button>
            <h2 className="font-bold">Create Story</h2>
            <div style={{ width: 40 }} />
          </header>

          <div className="flex-1 w-full flex items-center justify-center">
             <textarea 
               className="story-textarea" 
               placeholder="What's on your mind?"
               value={newStoryContent}
               onChange={(e) => setNewStoryContent(e.target.value)}
               autoFocus
             />
          </div>

          <div className="w-full flex justify-between items-center mt-8">
            <button className="icon-btn"><Camera /></button>
            <button className="send-btn-signal" onClick={handlePostStory}>
              <Send size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Story Viewer Overlay */}
      {activeStory && (
        <div className="call-overlay animate-fade-in" style={{ background: '#000' }}>
           <div className="story-progress-bar">
             {activeStory.map((s, i) => <div key={i} className="story-bar-segment" />)}
           </div>
           <header className="w-full flex items-center p-4 gap-4" style={{ zIndex: 10 }}>
              <div className="avatar-signal" style={{ width: 40, height: 40 }}>
                {activeStory[0].avatar ? <img src={activeStory[0].avatar} alt="" /> : <span>{activeStory[0].displayName[0]}</span>}
              </div>
              <div className="flex-1">
                <div className="font-bold">{activeStory[0].displayName}</div>
                <div className="text-xs text-secondary">{formatDistanceToNow(new Date(activeStory[0].createdAt))} ago</div>
              </div>
              <button className="icon-btn" onClick={() => setActiveStory(null)}><X /></button>
           </header>
           
           <div className="flex-1 flex items-center justify-center p-8 text-center text-2xl font-medium">
              {activeStory[0].content}
           </div>
        </div>
      )}

      <style>{`
        .story-textarea {
          width: 100%;
          background: transparent;
          border: none;
          color: white;
          font-size: 2rem;
          text-align: center;
          outline: none;
          resize: none;
          font-family: inherit;
          font-weight: 600;
        }
        .story-progress-bar {
          position: absolute;
          top: 10px;
          left: 10px;
          right: 10px;
          display: flex;
          gap: 4px;
          z-index: 10;
        }
        .story-bar-segment {
          flex: 1;
          height: 3px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default StoriesPage;
