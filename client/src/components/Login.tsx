import React, { useState } from 'react';

interface LoginProps {
  onLoggedIn: (user: any) => void;
  onSwitchToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoggedIn, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onLoggedIn(data.user);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '40px', width: '360px' }}>
      <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Morozka 2.0</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="email" 
          placeholder="Email" 
          className="input-field" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Пароль" 
          className="input-field" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        {error && <p style={{ color: '#ff4d4d', fontSize: '14px' }}>{error}</p>}
        <button type="submit" className="btn-primary">Войти</button>
      </form>
      <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: 'var(--text-dim)' }}>
        Нет аккаунта? <span onClick={onSwitchToRegister} style={{ color: 'var(--primary)', cursor: 'pointer' }}>Регистрация</span>
      </p>
    </div>
  );
};

export default Login;
