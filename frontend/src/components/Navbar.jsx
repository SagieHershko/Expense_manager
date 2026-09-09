import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate  = useNavigate();
  const username  = localStorage.getItem('username');

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <h1>💰 ניהול הוצאות</h1>
      <div className="navbar-links">
        <Link to="/">דשבורד</Link>
        <Link to="/categories">קטגוריות</Link>
        <span style={{ opacity: 0.8 }}>שלום, {username}</span>
        <button className="btn btn-secondary" onClick={logout} style={{ padding: '6px 14px', fontSize: '0.9rem' }}>
          התנתק
        </button>
      </div>
    </nav>
  );
}
