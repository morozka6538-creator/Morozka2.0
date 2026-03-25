import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { Send, Phone, Video, LogOut, User, Reply, Smile, X, CheckCheck, Trash2, Ban, Shield, ShieldAlert } from 'lucide-react';
import Call from './Call';

interface ChatProps {
  user: { id: number; email: string; username: string; avatar?: string; is_admin: boolean };
  onLogout: () => void;
}

const Chat: React.FC<ChatProps> = ({ user, onLogout }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [callData, setCallData] = useState<any>(null); // { incoming: boolean, from: number, signal: any }
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [unreads, setUnreads] = useState<Record<number, number>>({});
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedUserRef = useRef(selectedUser);

  // Sync ref to avoid closure staleness in socket listeners
  useEffect(() => {
    selectedUserRef.current = selectedUser;
    if (selectedUser) {
      setUnreads(prev => ({ ...prev, [selectedUser.id]: 0 }));
    }
  }, [selectedUser]);

  const emojis = ['❄️', '🧊', '✨', '😊', '😂', '❤️', '👍', '🔥', '🚀', '🙌'];

  useEffect(() => {
    socket.on('new-message', (data) => {
      const activeUser = selectedUserRef.current;
      console.log('Global New Message:', data, 'Active User:', activeUser?.id);
      
      // Update users list with last message snippet
      setUsers((prev) => prev.map(u => (u.id === data.sender_id || u.id === data.senderId) ? { ...u, lastMessage: data.content } : u));

      if (activeUser && (data.senderId === activeUser.id || data.receiverId === activeUser.id)) {
        setMessages((prev) => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      } else if (data.senderId !== user.id) {
        // Only notify if it's NOT from us
        setUnreads((prev) => ({ ...prev, [data.senderId]: (prev[data.senderId] || 0) + 1 }));
        // Optional: Play sound or browser notification here
      }
    });

    socket.on('message-sent-ack', (fullMsg) => {
      console.log('Received ACK for:', fullMsg.tempId, 'ID:', fullMsg.id);
      setMessages((prev) => prev.map(m => (m.tempId === fullMsg.tempId || (!m.id && m.content === fullMsg.content)) ? fullMsg : m));
      // Update own last message in sidebar
      setUsers((prev) => prev.map(u => u.id === fullMsg.receiverId ? { ...u, lastMessage: fullMsg.content } : u));
    });

    socket.on('message-deleted', (msgId) => {
      setMessages((prev) => prev.filter(m => m.id !== msgId));
    });

    socket.on('call-incoming', (data) => {
      setCallData({ incoming: true, from: data.from, signal: data.signal, video: data.video });
    });

    socket.on('call-rejected', () => {
      setCallData(null);
    });

    socket.on('call-ended', () => {
      setCallData(null);
    });

    socket.on('user-registered', (newUser) => {
      setUsers((prev) => {
        const updated = [...prev, newUser];
        return updated.sort((a, b) => a.username.localeCompare(b.username));
      });
    });

    socket.on('user-updated', (updatedUser) => {
      setUsers((prev) => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
    });

    socket.on('account-blocked', () => {
      alert('Ваш аккаунт был заблокирован администратором.');
      onLogout();
    });

    return () => {
      socket.off('new-message');
      socket.off('message-sent-ack');
      socket.off('message-deleted');
      socket.off('call-incoming');
      socket.off('user-registered');
      socket.off('user-updated');
    };
  }, []); // Run once on mount

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data));
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetch(`/api/messages/${user.id}/${selectedUser.id}`)
        .then(res => res.json())
        .then(data => setMessages(data));
    }
  }, [selectedUser, user.id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !selectedUser) return;

    const tempId = `temp-${Date.now()}`;
    const msg = { 
      senderId: user.id, 
      receiverId: selectedUser.id, 
      content,
      replyToId: replyTo?.id,
      tempId
    };
    socket.emit('send-message', msg);
    // Optimistic update with id: null (will be updated by ack)
    setMessages((prev) => [...prev, { ...msg, id: null, sender_id: user.id, timestamp: new Date().toISOString(), tempId }]);
    setContent('');
    setReplyTo(null);
  };

  const deleteMessage = (id: number) => {
    console.log('Requesting deletion for ID:', id);
    if (!id) return;
    socket.emit('delete-message', { messageId: id, userId: user.id });
  };

  const startCall = (video: boolean) => {
    if (!selectedUser) return;
    setCallData({ incoming: false, to: selectedUser.id, video });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        await fetch('/api/user/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, avatar: base64 })
        });
        // Update local state if needed (optional since socket will also trigger it)
      } catch (err) {
        console.error('Failed to upload avatar:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBlockUser = async (targetId: number, block: boolean) => {
    try {
      const endpoint = block ? '/api/admin/block' : '/api/admin/unblock';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, targetId })
      });
      if (!res.ok) throw new Error('Action failed');
      // Status will be updated via socket 'user-updated'
    } catch (err) {
      console.error('Failed to update block status:', err);
      alert('Ошибка при выполнении операции');
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar animate-fade-in" style={{ background: '#17212b' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              className="avatar-round" 
              style={{ width: '40px', height: '40px', cursor: 'pointer', position: 'relative', background: '#3390ec' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {user.avatar ? <img src={user.avatar} className="avatar-round" style={{ width: '100%', height: '100%' }} alt="Avatar" /> : user.username[0].toUpperCase()}
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', background: '#4ada71', borderRadius: '50%', border: '2px solid #17212b' }} />
            </div>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleAvatarChange} />
            <h3 style={{ fontSize: '18px', flex: 1, margin: 0 }}>{user.username}</h3>
            <LogOut size={20} className="icon-btn" onClick={onLogout} style={{ opacity: 0.6 }} />
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {users.map((u) => (
            <div 
              key={u.id} 
              className={`sidebar-item ${selectedUser?.id === u.id ? 'active' : ''}`}
              onClick={() => setSelectedUser(u)}
            >
              <div className="avatar-round">
                {u.avatar ? <img src={u.avatar} className="avatar-round" style={{ width: '100%', height: '100%' }} alt="Avatar" /> : u.username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: '600', fontSize: '15px', color: u.is_blocked ? '#999' : 'inherit' }}>{u.username}</span>
                    {user.is_admin && u.is_blocked && <ShieldAlert size={14} color="#ff4d4d" />}
                  </div>
                  <span style={{ fontSize: '11px', opacity: 0.5 }}>{u.lastMessage ? 'сейчас' : '12:00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '14px', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                    {u.is_blocked ? 'ЗАБЛОКИРОВАН' : (u.id === user.id ? 'Избранное (Это вы)' : (u.lastMessage || 'Начни общение...'))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {user.is_admin && u.id !== user.id && (
                      <button 
                        className="glass-btn-icon" 
                        title={u.is_blocked ? "Разблокировать" : "Заблокировать"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBlockUser(u.id, !u.is_blocked);
                        }}
                        style={{ padding: '4px', color: u.is_blocked ? '#4ade80' : '#ff4d4d' }}
                      >
                        {u.is_blocked ? <Shield size={16} /> : <Ban size={16} />}
                      </button>
                    )}
                    {unreads[u.id] > 0 && (
                      <div className="unread-badge animate-fade-in">{unreads[u.id]}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="chat-main">
        {selectedUser ? (
          <>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {selectedUser.avatar ? (
                    <img src={selectedUser.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                  ) : (
                    <User color="white" size={20} />
                  )}
                </div>
                <div>
                  <h4 style={{ margin: 0 }}>{selectedUser.username}</h4>
                  <p style={{ fontSize: '12px', color: '#4ade80' }}>online</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <Phone size={20} style={{ cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => startCall(false)} />
                <Video size={20} style={{ cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => startCall(true)} />
              </div>
            </div>
            <div className="chat-history">
              {messages.map((m, i) => {
                const isSent = m.sender_id === user.id || m.senderId === user.id;
                const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div 
                    key={i} 
                    id={`msg-${m.id}`}
                    className={`message-wrapper ${isSent ? 'sent' : 'received'}`}
                  >
                  <div className="message-actions">
                    <button 
                      type="button"
                      className="glass-btn-icon" 
                      onClick={() => setReplyTo(m)}
                    >
                      <Reply size={16} />
                    </button>
                    {isSent && (
                      <button 
                        type="button"
                        className="glass-btn-icon" 
                        style={{ color: '#ff4d4d', opacity: m.id ? 1 : 0.4, cursor: m.id ? 'pointer' : 'wait' }}
                        onClick={() => {
                          console.log('Click on Trash. Message ID:', m.id);
                          if (m.id) deleteMessage(m.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                    <div className={`message ${isSent ? 'sent' : 'received'}`}>
                      {m.reply_to_id && (
                        <div 
                          className="reply-quote"
                          onClick={() => document.getElementById(`msg-${m.reply_to_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '2px', color: isSent ? '#fff' : 'var(--primary)' }}>Ответ на сообщение</div>
                          <div style={{ opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                            {messages.find(prev => prev.id === m.reply_to_id)?.content || 'Сообщение удалено'}
                          </div>
                        </div>
                      )}
                      {m.content}
                      <div className="message-info">
                        {time}
                        {isSent && <CheckCheck size={14} style={{ color: '#4ada71' }} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messageEndRef} />
            </div>
            <form className="chat-input-area" onSubmit={sendMessage}>
              <div className="input-pill-container">
                <div className="input-pill">
                  {replyTo && (
                    <div style={{ padding: '4px 0 8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '2px', height: '20px', background: 'var(--primary)', borderRadius: '10px' }} />
                        <div style={{ fontSize: '12px' }}>
                          <p style={{ margin: 0, color: 'var(--tg-blue)', fontWeight: 'bold' }}>{users.find(u => u.id === (replyTo.sender_id || replyTo.senderId))?.username || 'Пользователь'}</p>
                          <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>{replyTo.content}</p>
                        </div>
                      </div>
                      <X size={16} style={{ cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setReplyTo(null)} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      {showEmojis && (
                        <div className="glass-panel animate-fade-in" style={{ position: 'absolute', bottom: '100%', left: '-10px', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '15px', zIndex: 100 }}>
                          {emojis.map(e => (
                            <span key={e} style={{ cursor: 'pointer', fontSize: '20px' }} onClick={() => { setContent(prev => prev + e); setShowEmojis(false); }}>{e}</span>
                          ))}
                        </div>
                      )}
                      <Smile size={24} style={{ cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setShowEmojis(!showEmojis)} />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Сообщение" 
                      className="input-field" 
                      style={{ flex: 1, border: 'none', background: 'transparent', padding: '4px 0' }}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" style={{ width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <Send size={24} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            Выберите чат, чтобы начать общение
          </div>
        )}
      </div>

      {callData && (
        <Call 
          userId={user.id}
          callData={callData} 
          onClose={() => setCallData(null)} 
        />
      )}
    </div>
  );
};

export default Chat;
