import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/api';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    try {
      await register(username, password);
      setSuccess('נרשמת בהצלחה! מעבר לכניסה...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בהרשמה');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>💰 הרשמה</h2>
        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>שם משתמש</label>
            <input value={username} onChange={e => setUsername(e.target.value)} required minLength={3} />
          </div>
          <div className="form-group">
            <label>סיסמה (לפחות 6 תווים)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-primary">הרשמה</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem' }}>
          כבר יש לך חשבון? <Link to="/login">כנס כאן</Link>
        </p>
      </div>
    </div>
  );
}
