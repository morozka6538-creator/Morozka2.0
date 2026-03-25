import React, { useState, useEffect } from 'react';
import socket from './socket';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import './index.css';

const App: React.FC = () => {
  const [user, setUser] = useState<{ id: number; email: string; username: string; is_admin: boolean } | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (user) {
      socket.connect();
      socket.emit('identify', user.id);
    } else {
      socket.disconnect();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        {isRegistering ? (
          <Register onRegistered={() => setIsRegistering(false)} onSwitchToLogin={() => setIsRegistering(false)} />
        ) : (
          <Login onLoggedIn={setUser} onSwitchToRegister={() => setIsRegistering(true)} />
        )}
      </div>
    );
  }

  return <Chat user={user} onLogout={() => setUser(null)} />;
};

export default App;
