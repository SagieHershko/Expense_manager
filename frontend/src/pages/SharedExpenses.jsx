import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import {
  getGroups,
  createGroup,
  inviteToGroup,
  acceptGroupInvite,
  getGroupExpenses,
} from '../services/api';

const MONTHS_HE = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'
];

function getMonthStr(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}
function addMonths(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return getMonthStr(d.getFullYear(), d.getMonth() + 1);
}

export default function SharedExpenses() {
  const now   = new Date();
  const today = getMonthStr(now.getFullYear(), now.getMonth() + 1);

  const [navMonth,      setNavMonth]      = useState(today);
  const [groups,        setGroups]        = useState([]);
  const [activeGroup,   setActiveGroup]   = useState(null);
  const [expenses,      setExpenses]      = useState([]);
  const [summary,       setSummary]       = useState({});
  const [newGroupName,  setNewGroupName]  = useState('');
  const [inviteUser,    setInviteUser]    = useState('');
  const [alert,         setAlert]         = useState('');
  const [alertType,     setAlertType]     = useState('success');
  const [showManage,    setShowManage]    = useState(false);

  const [y, m] = navMonth.split('-').map(Number);
  const prevMonth = addMonths(navMonth, -1);
  const nextMonth = addMonths(navMonth, +1);
  const { month: pm } = { month: Number(prevMonth.split('-')[1]) };
  const { month: nm } = { month: Number(nextMonth.split('-')[1]) };

  const showAlert = (msg, type = 'success') => {
    setAlert(msg); setAlertType(type);
    setTimeout(() => setAlert(''), 4000);
  };

  // ── טעינת קבוצות ────────────────────────────────────
  const fetchGroups = async () => {
    const list = await getGroups().catch(() => []);
    setGroups(list);
    if (!activeGroup) {
      const first = list.find(g => g.status === 'accepted');
      if (first) setActiveGroup(first);
    }
  };

  useEffect(() => { fetchGroups(); }, []);

  // ── טעינת הוצאות ────────────────────────────────────
  useEffect(() => {
    if (!activeGroup) return;
    getGroupExpenses(activeGroup.id, { month: navMonth })
      .then(({ expenses, summary }) => { setExpenses(expenses); setSummary(summary); })
      .catch(() => showAlert('שגיאה בטעינת ההוצאות', 'error'));
  }, [activeGroup, navMonth]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await createGroup(newGroupName.trim());
      setNewGroupName('');
      await fetchGroups();
      showAlert('✅ קבוצה נוצרה!');
    } catch { showAlert('שגיאה ביצירת הקבוצה', 'error'); }
  };

  const handleInvite = async () => {
    if (!activeGroup || !inviteUser.trim()) return;
    try {
      const res = await inviteToGroup(activeGroup.id, inviteUser.trim());
      setInviteUser('');
      showAlert(`✅ ${res.message}`);
    } catch (err) {
      showAlert(err.response?.data?.error || 'שגיאה בהזמנה', 'error');
    }
  };

  const handleAccept = async (group) => {
    try {
      await acceptGroupInvite(group.id);
      await fetchGroups();
      showAlert(`✅ הצטרפת לקבוצה "${group.name}"!`);
    } catch { showAlert('שגיאה באישור ההזמנה', 'error'); }
  };

  const total        = expenses.reduce((s, e) => s + e.amount, 0);
  const pendingGroups  = groups.filter(g => g.status === 'pending');
  const acceptedGroups = groups.filter(g => g.status === 'accepted');
  const pmNum = Number(prevMonth.split('-')[1]);
  const nmNum = Number(nextMonth.split('-')[1]);

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 24 }}>

        {/* הודעת מערכת */}
        {alert && (
          <div className={`alert ${alertType === 'error' ? 'alert-error' : 'alert-success'}`}
            onClick={() => setAlert('')}>
            {alert} ✕
          </div>
        )}

        {/* הזמנות ממתינות */}
        {pendingGroups.map(g => (
          <div key={g.id} className="alert" style={{ background: '#fef9c3', color: '#713f12', borderColor: '#fde047', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📨 הוזמנת לקבוצה: <strong>{g.name}</strong></span>
            <button className="btn btn-secondary" style={{ marginRight: 12 }} onClick={() => handleAccept(g)}>✅ הצטרף</button>
          </div>
        ))}

        {/* כותרת + בחירת קבוצה + כפתור ניהול */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>💸 הוצאות משותפות</h2>
            {activeGroup && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                קבוצה:&nbsp;
                {acceptedGroups.length > 1 ? (
                  <select
                    style={{ border: 'none', background: 'transparent', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', fontSize: 13 }}
                    value={activeGroup.id}
                    onChange={e => setActiveGroup(acceptedGroups.find(g => g.id === +e.target.value))}
                  >
                    {acceptedGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : (
                  <strong style={{ color: 'var(--primary)' }}>{activeGroup.name}</strong>
                )}
              </span>
            )}
          </div>
          <button className="btn btn-secondary" onClick={() => setShowManage(v => !v)}>
            ⚙️ {showManage ? 'סגור ניהול' : 'ניהול קבוצות'}
          </button>
        </div>

        {/* פאנל ניהול */}
        {showManage && (
          <div className="card" style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <h4 style={{ marginBottom: 10 }}>➕ קבוצה חדשה</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder='שם הקבוצה'
                  value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} />
                <button className="btn btn-primary" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>צור</button>
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: 10 }}>📨 הזמן משתמש{activeGroup ? ` ל-${activeGroup.name}` : ''}</h4>
              {acceptedGroups.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>צור קבוצה תחילה</p>
                : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" placeholder="שם משתמש (username)"
                      value={inviteUser} onChange={e => setInviteUser(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleInvite()} />
                    <button className="btn btn-primary" onClick={handleInvite} disabled={!inviteUser.trim()}>הזמן</button>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ── ניווט חודשים (כמו דשבורד) ── */}
        <div className="month-nav">
          <button className="month-arrow-btn"
            onClick={() => setNavMonth(nextMonth)}
            disabled={nextMonth > today}>
            {MONTHS_HE[nmNum - 1]} &#9654;
          </button>
          <div className="month-current">
            <span className="month-name">{MONTHS_HE[m - 1]}</span>
            <span className="month-year">{y}</span>
          </div>
          <button className="month-arrow-btn" onClick={() => setNavMonth(prevMonth)}>
            &#9664; {MONTHS_HE[pmNum - 1]}
          </button>
        </div>

        {/* ── כרטיסי סיכום (כמו דשבורד) ── */}
        {activeGroup && (
          <div className="summary-grid">
            <div className="summary-card">
              <div className="value">₪{total.toFixed(2)}</div>
              <div className="label">סה"כ הוצאות משותפות</div>
            </div>
            {Object.entries(summary).map(([user, amt]) => (
              <div key={user} className="summary-card">
                <div className="value">₪{amt.toFixed(2)}</div>
                <div className="label">הוצאות של {user}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── רשימת הוצאות (כמו דשבורד) ── */}
        {!activeGroup ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <p>צור קבוצה ראשונה כדי לראות הוצאות משותפות</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowManage(true)}>
              ➕ צור קבוצה
            </button>
          </div>
        ) : expenses.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            אין הוצאות משותפות ב{MONTHS_HE[m - 1]}
          </div>
        ) : (
          expenses.map(exp => (
            <div className="expense-item" key={exp.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="expense-icon">🧾</span>
                <div>
                  <div><strong>{exp.title}</strong></div>
                  <div className="meta">
                    {exp.date}
                    {exp.category_name && ` • ${exp.category_name}`}
                    {exp.note && ` • ${exp.note}`}
                    {' • '}
                    <span style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      borderRadius: 12,
                      padding: '1px 8px',
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      {exp.owner_username}
                    </span>
                  </div>
                </div>
              </div>
              <span className="amount">₪{exp.amount.toFixed(2)}</span>
            </div>
          ))
        )}

      </div>
    </>
  );
}
