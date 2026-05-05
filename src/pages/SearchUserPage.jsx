import React, { useState, useEffect } from 'react';
import { userService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ChevronLeft, Search, UserPlus, MessageSquare, Loader2,
  User, Mail, Phone, UserCheck
} from 'lucide-react';

const SearchUserPage = ({ onBack, onStartChat }) => {
  const { contacts, addContact } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set(contacts.map(c => c.id)));

  useEffect(() => {
    if (query.length > 2) {
      const search = async () => {
        setIsSearching(true);
        try {
          const data = await userService.search(query);
          setResults(data);
        } catch (e) {
          console.error('Search failed', e);
        } finally {
          setIsSearching(false);
        }
      };
      const delay = setTimeout(search, 300);
      return () => clearTimeout(delay);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleAddContact = (e, user) => {
    e.stopPropagation();
    addContact({ id: user.id, username: user.username, display_name: user.display_name, avatar: user.avatar });
    setAddedIds(prev => new Set([...prev, user.id]));
  };

  return (
    <div className="settings-view animate-fade-in">
      <header className="settings-header">
        <button className="icon-btn" onClick={onBack}><ChevronLeft /></button>
        <div className="settings-title">New Message</div>
      </header>

      <div className="settings-content">
        <div className="search-container p-4">
          <div className="search-wrap glass">
            <Search size={18} className="text-secondary" />
            <input
              type="text"
              placeholder="Search by username..."
              className="search-input-signal"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="results-list">
          {isSearching ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-accent" size={32} />
            </div>
          ) : results.length > 0 ? (
            results.map(user => (
              <div key={user.id} className="chat-item" onClick={() => onStartChat(user)}>
                <div className="avatar-signal">
                  {user.avatar
                    ? <img src={user.avatar} alt="" />
                    : user.display_name[0].toUpperCase()
                  }
                </div>
                <div className="chat-content">
                  <div className="chat-name">{user.display_name}</div>
                  <div className="chat-preview">@{user.username}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    title={addedIds.has(user.id) ? 'Added' : 'Add Contact'}
                    style={{
                      width: 34, height: 34, borderRadius: 17,
                      background: addedIds.has(user.id) ? 'rgba(50,215,75,0.15)' : 'rgba(44,107,237,0.15)',
                      border: `1px solid ${addedIds.has(user.id) ? 'rgba(50,215,75,0.3)' : 'rgba(44,107,237,0.3)'}`,
                      color: addedIds.has(user.id) ? '#32d74b' : '#2c6bed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                    onClick={(e) => handleAddContact(e, user)}
                  >
                    {addedIds.has(user.id) ? <UserCheck size={16} /> : <UserPlus size={16} />}
                  </button>
                  <button
                    title="Message"
                    style={{
                      width: 34, height: 34, borderRadius: 17,
                      background: 'rgba(44,107,237,0.15)',
                      border: '1px solid rgba(44,107,237,0.3)', color: '#2c6bed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <MessageSquare size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : query.length > 2 ? (
            <div className="p-8 text-center text-secondary">No users found matching "{query}"</div>
          ) : (
            <div className="p-8 text-center text-secondary">Search for users to start a secure conversation.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchUserPage;

