import React, { useState } from 'react';

interface RegisterProps {
  onRegistered: () => void;
  onSwitchToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegistered, onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onRegistered();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '40px', width: '360px' }}>
      <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Создать аккаунт</h2>
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="text" 
          placeholder="Имя пользователя" 
          className="input-field" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          required 
        />
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
        <button type="submit" className="btn-primary">Зарегистрироваться</button>
      </form>
      <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: 'var(--text-dim)' }}>
        Уже есть аккаунт? <span onClick={onSwitchToLogin} style={{ color: 'var(--primary)', cursor: 'pointer' }}>Войти</span>
      </p>
    </div>
  );
};

export default Register;
