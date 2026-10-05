import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import {
  getGroups,
  createGroup,
  inviteToGroup,
  acceptGroupInvite,
  declineGroupInvite,
  getGroupExpenses,
  exportGroupExpenses,
  getCategories,
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
  const [categories,    setCategories]    = useState([]);
  const [filterCat,     setFilterCat]     = useState('');
  const [filterUser,    setFilterUser]    = useState('');
  const [exporting,     setExporting]     = useState(false);

  const [y, m] = navMonth.split('-').map(Number);
  const prevMonth = addMonths(navMonth, -1);
  const nextMonth = addMonths(navMonth, +1);

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

  useEffect(() => {
    fetchGroups();
    getCategories().then(r => setCategories(r.data)).catch(() => {});
  }, []);

  // ── טעינת הוצאות ────────────────────────────────────
  useEffect(() => {
    if (!activeGroup) return;
    const params = { month: navMonth };
    if (filterCat) params.category_id = filterCat;
    getGroupExpenses(activeGroup.id, params)
      .then(({ expenses, summary }) => { setExpenses(expenses); setSummary(summary); })
      .catch(() => showAlert('שגיאה בטעינת ההוצאות', 'error'));
  }, [activeGroup, navMonth, filterCat]);

  const switchGroup = (group) => {
    setActiveGroup(group);
    setFilterUser('');
  };

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

  const handleDecline = async (group) => {
    try {
      await declineGroupInvite(group.id);
      await fetchGroups();
      showAlert(`ההזמנה לקבוצה "${group.name}" נדחתה`);
    } catch { showAlert('שגיאה בדחיית ההזמנה', 'error'); }
  };

  const handleExport = async () => {
    if (!activeGroup) return;
    try {
      setExporting(true);
      const params = { month: navMonth };
      if (filterCat) params.category_id = filterCat;
      const res = await exportGroupExpenses(activeGroup.id, params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `shared_expenses_${navMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { showAlert('שגיאה בייצוא הוצאות משותפות', 'error'); }
    finally { setExporting(false); }
  };

  const visibleExpenses = filterUser
    ? expenses.filter(e => e.owner_username === filterUser)
    : expenses;
  const total        = visibleExpenses.reduce((s, e) => s + e.amount, 0);
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
            <span style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => handleAccept(g)}>✅ הצטרף</button>
              <button className="btn btn-danger" onClick={() => handleDecline(g)}>דחה</button>
            </span>
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
                    onChange={e => switchGroup(acceptedGroups.find(g => g.id === +e.target.value))}
                  >
                    {acceptedGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : (
                  <strong style={{ color: 'var(--primary)' }}>{activeGroup.name}</strong>
                )}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {activeGroup && (
              <button className="btn btn-secondary" onClick={handleExport} disabled={exporting || expenses.length === 0}>
                {exporting ? '⏳...' : '📥 ייצוא CSV'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setShowManage(v => !v)}>
              ⚙️ {showManage ? 'סגור ניהול' : 'ניהול קבוצות'}
            </button>
          </div>
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

        {/* ── פילטרים ── */}
        {activeGroup && (
          <div className="filter-bar">
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>סינון לפי קטגוריה</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">הכל</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon || '🏷️'} {c.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>סינון לפי משתמש</label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">כולם</option>
                {Object.keys(summary).map(user => <option key={user} value={user}>{user}</option>)}
              </select>
            </div>
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
        ) : visibleExpenses.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            אין הוצאות משותפות ב{MONTHS_HE[m - 1]}
          </div>
        ) : (
          visibleExpenses.map(exp => (
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
