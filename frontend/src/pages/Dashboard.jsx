import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import Navbar from '../components/Navbar';
import ExpenseForm from '../components/ExpenseForm';
import {
  getExpenses, createExpense, updateExpense, deleteExpense, getCategories,
  getGroups, createGroup, inviteToGroup, acceptGroupInvite, getGroupExpenses,
} from '../services/api';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const COLORS = ['#667eea','#f59e0b','#22c55e','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6'];

const MONTHS_HE = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'
];

// ── Plugin: מספר מרכזי בגרף עוגה ──
const centerTextPlugin = {
  id: 'centerText',
  beforeDraw(chart) {
    if (chart.config.type !== 'doughnut') return;
    const { ctx } = chart;
    const { top, bottom, left, right } = chart.chartArea;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const total = chart.data.datasets[0].data.reduce((s, v) => s + v, 0);
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#1a1b2e';
    const mutedColor = isDark ? '#94a3b8' : '#888';

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = textColor;
    ctx.fillText(`₪${total.toFixed(0)}`, cx, cy - 10);
    ctx.font = '13px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = mutedColor;
    ctx.fillText('סה״כ', cx, cy + 14);
    ctx.restore();
  }
};

// ── Plugin: אחוזים מחוץ לטבעת ──
const outerLabelsPlugin = {
  id: 'outerLabels',
  afterDraw(chart) {
    if (chart.config.type !== 'doughnut') return;
    const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    const total = dataset.data.reduce((s, v) => s + v, 0);
    if (!total) return;

    meta.data.forEach((arc, i) => {
      const val = dataset.data[i];
      const pct = Math.round((val / total) * 100);
      if (pct < 4) return;

      const props = arc.getProps(['x', 'y', 'startAngle', 'endAngle', 'outerRadius'], true);
      const mid = (props.startAngle + props.endAngle) / 2;
      const r = props.outerRadius + 26;
      const lx = props.x + Math.cos(mid) * r;
      const ly = props.y + Math.sin(mid) * r;

      ctx.save();
      ctx.font = 'bold 12px Segoe UI, Arial, sans-serif';
      ctx.fillStyle = dataset.backgroundColor[i];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3;
      ctx.fillText(`${pct}%`, lx, ly);
      ctx.restore();
    });
  }
};

function getMonthStr(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}
function addMonths(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return getMonthStr(d.getFullYear(), d.getMonth() + 1);
}
function parseMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return { year: y, month: m };
}

export default function Dashboard() {
  const now   = new Date();
  const today = getMonthStr(now.getFullYear(), now.getMonth() + 1);

  // טאב פעיל — personal / shared — נקרא מה-URL (?tab=shared)
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'shared' ? 'shared' : 'personal';
  const setTab = (t) => setSearchParams(t === 'shared' ? { tab: 'shared' } : {});

  // ── State אישי ──────────────────────────────────────
  const [navMonth,   setNavMonth]   = useState(today);
  const [expenses,   setExpenses]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterCat,  setFilterCat]  = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [error,      setError]      = useState('');
  const [exporting,  setExporting]  = useState(false);
  const [chartType,  setChartType]  = useState('doughnut');

  // ── State משותף ─────────────────────────────────────
  const [groups,        setGroups]       = useState([]);
  const [activeGroup,   setActiveGroup]  = useState(null);
  const [sharedExp,     setSharedExp]    = useState([]);
  const [sharedSummary, setSharedSummary] = useState({});
  const [newGroupName,  setNewGroupName] = useState('');
  const [inviteUser,    setInviteUser]   = useState('');
  const [showManage,    setShowManage]   = useState(false);
  const [sharedAlert,   setSharedAlert] = useState('');

  const showSharedAlert = (msg) => {
    setSharedAlert(msg);
    setTimeout(() => setSharedAlert(''), 4000);
  };

  // ── טעינה אישית ─────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    try {
      const params = { month: navMonth };
      if (filterCat) params.category_id = filterCat;
      const res = await getExpenses(params);
      setExpenses(res.data);
    } catch { setError('שגיאה בטעינת הוצאות'); }
  }, [navMonth, filterCat]);

  useEffect(() => {
    fetchExpenses();
    getCategories().then(r => setCategories(r.data)).catch(() => {});
  }, [fetchExpenses]);

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

  // ── טעינת הוצאות משותפות ────────────────────────────
  useEffect(() => {
    if (!activeGroup) return;
    getGroupExpenses(activeGroup.id, { month: navMonth })
      .then(({ expenses, summary }) => { setSharedExp(expenses); setSharedSummary(summary); })
      .catch(() => {});
  }, [activeGroup, navMonth]);

  // ── פעולות אישיות ───────────────────────────────────
  const handleAdd = async (formData) => {
    try {
      await createExpense(formData);
      setShowModal(false);
      fetchExpenses();
    } catch (err) { setError(err.response?.data?.error || 'שגיאה בהוספה'); }
  };

  const handleEdit = async (formData) => {
    try {
      await updateExpense(editItem.id, formData);
      setEditItem(null);
      fetchExpenses();
    } catch (err) { setError(err.response?.data?.error || 'שגיאה בעדכון'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק הוצאה זו?')) return;
    try { await deleteExpense(id); fetchExpenses(); }
    catch { setError('שגיאה במחיקה'); }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = { month: navMonth };
      if (filterCat) params.category_id = filterCat;
      const res = await api.get('/expenses/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `expenses_${navMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { setError('שגיאה בייצוא'); }
    finally { setExporting(false); }
  };

  // ── פעולות משותפות ──────────────────────────────────
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await createGroup(newGroupName.trim());
      setNewGroupName('');
      await fetchGroups();
      showSharedAlert('✅ קבוצה נוצרה!');
    } catch { showSharedAlert('שגיאה ביצירת הקבוצה'); }
  };

  const handleInvite = async () => {
    if (!activeGroup || !inviteUser.trim()) return;
    try {
      const res = await inviteToGroup(activeGroup.id, inviteUser.trim());
      setInviteUser('');
      showSharedAlert(`✅ ${res.message}`);
    } catch (err) {
      showSharedAlert(err.response?.data?.error || 'שגיאה בהזמנה');
    }
  };

  const handleAccept = async (group) => {
    try {
      await acceptGroupInvite(group.id);
      await fetchGroups();
      showSharedAlert(`✅ הצטרפת לקבוצה "${group.name}"!`);
    } catch { showSharedAlert('שגיאה באישור ההזמנה'); }
  };

  // ── חישובים ─────────────────────────────────────────
  const activeExpenses  = tab === 'shared' ? sharedExp : expenses;
  const total           = activeExpenses.reduce((s, e) => s + e.amount, 0);
  const { year: navY, month: navM } = parseMonth(navMonth);
  const prevMonthStr    = addMonths(navMonth, -1);
  const nextMonthStr    = addMonths(navMonth, +1);
  const { month: pm }   = parseMonth(prevMonthStr);
  const { month: nm }   = parseMonth(nextMonthStr);
  const isCurrentMonth  = navMonth === today;
  const daysInMonth     = new Date(navY, navM, 0).getDate();
  const dayOfMonth      = isCurrentMonth ? now.getDate() : daysInMonth;
  const uniqueDays      = new Set(activeExpenses.map(e => e.date)).size;
  const avgPerDay       = uniqueDays > 0 ? (total / uniqueDays).toFixed(2) : '0.00';
  const projected       = dayOfMonth > 0 ? (total / dayOfMonth) * daysInMonth : 0;

  const categoryTotals = activeExpenses.reduce((acc, e) => {
    const name = e.category_name || 'ללא קטגוריה';
    acc[name] = (acc[name] || 0) + e.amount;
    return acc;
  }, {});

  const chartLabels = Object.keys(categoryTotals);
  const chartValues = Object.values(categoryTotals);
  const chartColors = COLORS.slice(0, chartLabels.length);

  const barData = {
    labels: chartLabels,
    datasets: [{ label: 'סכום לפי קטגוריה (₪)', data: chartValues, backgroundColor: chartColors, borderRadius: 8 }]
  };
  const doughnutData = {
    labels: chartLabels,
    datasets: [{ data: chartValues, backgroundColor: chartColors, borderWidth: 3, borderColor: 'transparent', hoverOffset: 10 }]
  };
  const doughnutOptions = {
    responsive: true, cutout: '68%', layout: { padding: 32 },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `  ₪${ctx.parsed.toFixed(2)}  (${total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0}%)` } }
    }
  };

  const catsWithBudget = categories.filter(c => c.monthly_budget);
  const pendingGroups  = groups.filter(g => g.status === 'pending');
  const acceptedGroups = groups.filter(g => g.status === 'accepted');

  return (
    <>
      <Navbar
        onAddExpense={tab === 'personal' ? () => setShowModal(true) : undefined}
        onExportCSV={tab === 'personal' ? handleExportCSV : undefined}
        exporting={exporting}
        expensesExist={expenses.length > 0}
        activeTab={tab}
        onTabChange={setTab}
      />
      <div className="container" style={{ paddingTop: 24 }}>

        {error && <div className="alert alert-error" onClick={() => setError('')}>{error} ✕</div>}

        {/* ── הזמנות ממתינות (מצב משותף) ── */}
        {tab === 'shared' && pendingGroups.map(g => (
          <div key={g.id} className="alert" style={{ background: '#fef9c3', color: '#713f12', borderColor: '#fde047', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📨 הוזמנת לקבוצה: <strong>{g.name}</strong></span>
            <button className="btn btn-secondary" onClick={() => handleAccept(g)}>✅ הצטרף</button>
          </div>
        ))}

        {/* ── כותרת מצב משותף: בחירת קבוצה + ניהול ── */}
        {tab === 'shared' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {activeGroup ? (
                <>
                  קבוצה:&nbsp;
                  {acceptedGroups.length > 1
                    ? <select style={{ border: 'none', background: 'transparent', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                        value={activeGroup.id}
                        onChange={e => setActiveGroup(acceptedGroups.find(g => g.id === +e.target.value))}>
                        {acceptedGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    : <strong style={{ color: 'var(--primary)' }}>{activeGroup.name}</strong>
                  }
                  <span style={{ marginRight: 8 }}>· {activeGroup.member_count} חברים</span>
                </>
              ) : <span>לא נמצאה קבוצה פעילה</span>}
            </div>
            <button className="btn btn-secondary" onClick={() => setShowManage(v => !v)}>
              ⚙️ {showManage ? 'סגור ניהול' : 'ניהול קבוצות'}
            </button>
          </div>
        )}

        {/* ── פאנל ניהול קבוצות ── */}
        {tab === 'shared' && showManage && (
          <div className="card" style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {sharedAlert && <div className="alert alert-success" style={{ gridColumn: '1/-1' }}>{sharedAlert}</div>}
            <div>
              <h4 style={{ marginBottom: 10 }}>➕ קבוצה חדשה</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="שם הקבוצה"
                  value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} />
                <button className="btn btn-primary" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>צור</button>
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: 10 }}>📨 הזמן משתמש{activeGroup ? ` ל-${activeGroup.name}` : ''}</h4>
              {acceptedGroups.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>צור קבוצה תחילה</p>
                : <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" placeholder="שם משתמש (username)"
                      value={inviteUser} onChange={e => setInviteUser(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleInvite()} />
                    <button className="btn btn-primary" onClick={handleInvite} disabled={!inviteUser.trim()}>הזמן</button>
                  </div>
              }
            </div>
          </div>
        )}

        {/* ── ניווט חודשים ── */}
        <div className="month-nav">
          <button className="month-arrow-btn" onClick={() => setNavMonth(nextMonthStr)} disabled={nextMonthStr > today}>
            {MONTHS_HE[nm - 1]} &#9654;
          </button>
          <div className="month-current">
            <span className="month-name">{MONTHS_HE[navM - 1]}</span>
            <span className="month-year">{navY}</span>
          </div>
          <button className="month-arrow-btn" onClick={() => setNavMonth(prevMonthStr)}>
            &#9664; {MONTHS_HE[pm - 1]}
          </button>
        </div>

        {/* ── כרטיסי סיכום ── */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="value">₪{total.toFixed(2)}</div>
            <div className="label">{tab === 'shared' ? 'סה"כ הוצאות משותפות' : 'סה״כ הוצאות החודש'}</div>
          </div>

          {tab === 'personal' ? (
            <>
              {isCurrentMonth && projected > 0 && (
                <div className="summary-card summary-card-predict">
                  <div className="value predict-value">₪{projected.toFixed(0)}</div>
                  <div className="label">תחזית לסוף החודש</div>
                  <div className="predict-hint">
                    {projected > total ? `עוד ₪${(projected - total).toFixed(0)} עד סוף החודש` : ''}
                  </div>
                </div>
              )}
            </>
          ) : (
            // כרטיסי סיכום לפי משתמש (מצב משותף)
            Object.entries(sharedSummary).map(([user, amt]) => (
              <div key={user} className="summary-card">
                <div className="value">₪{amt.toFixed(2)}</div>
                <div className="label">הוצאות של {user}</div>
              </div>
            ))
          )}
        </div>

        {/* ── גרף ── */}
        {activeExpenses.length > 0 && (
          <div className="card chart-card">
            <div className="chart-header">
              <h3>הוצאות לפי קטגוריה</h3>
              <button className="btn btn-secondary btn-chart-toggle"
                onClick={() => setChartType(t => t === 'bar' ? 'doughnut' : 'bar')}>
                {chartType === 'bar' ? '🥧 תצוגת עוגה' : '📊 תצוגת עמודות'}
              </button>
            </div>
            {chartType === 'bar' ? (
              <Bar data={barData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
            ) : (
              <div className="doughnut-wrapper">
                <Doughnut data={doughnutData} options={doughnutOptions} plugins={[centerTextPlugin, outerLabelsPlugin]} />
                <div className="doughnut-legend">
                  {chartLabels.map((label, i) => (
                    <div key={label} className="legend-item">
                      <span className="legend-dot" style={{ background: chartColors[i] }} />
                      <span className="legend-label">{label}</span>
                      <span className="legend-val">₪{chartValues[i].toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── מעקב תקציב (רק במצב אישי) ── */}
        {tab === 'personal' && catsWithBudget.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>📊 מעקב תקציב חודשי</h3>
            {catsWithBudget.map(cat => {
              const spent = categoryTotals[cat.name] || 0;
              const pct   = Math.min((spent / cat.monthly_budget) * 100, 100);
              const over  = spent > cat.monthly_budget;
              return (
                <div key={cat.id} className="budget-row">
                  <div className="budget-row-header">
                    <span className="budget-cat-label">{cat.icon || '🏷️'} {cat.name}</span>
                    <span className={`budget-amount ${over ? 'over-budget' : ''}`}>
                      ₪{spent.toFixed(2)} / ₪{cat.monthly_budget}{over && ' ⚠️'}
                    </span>
                  </div>
                  <div className="budget-bar">
                    <div className="budget-fill" style={{ width: `${pct}%`, background: over ? '#ef4444' : pct > 75 ? '#f59e0b' : '#22c55e' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── פילטר קטגוריה (רק במצב אישי) ── */}
        {tab === 'personal' && (
          <div className="filter-bar">
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>סינון לפי קטגוריה</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">הכל</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon || '🏷️'} {c.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── רשימת הוצאות ── */}
        {!activeGroup && tab === 'shared' ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <p>צור קבוצה ראשונה כדי לראות הוצאות משותפות</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowManage(true)}>
              ➕ צור קבוצה
            </button>
          </div>
        ) : activeExpenses.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            אין הוצאות ב{MONTHS_HE[navM - 1]}
          </div>
        ) : (
          activeExpenses.map(exp => {
            const cat = categories.find(c => c.id === exp.category_id);
            return (
              <div className="expense-item" key={exp.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className="expense-icon">{cat?.icon || '🧾'}</span>
                  <div>
                    <div><strong>{exp.title}</strong></div>
                    <div className="meta">
                      {exp.date}
                      {exp.category_name && ` • ${exp.category_name}`}
                      {exp.note && ` • ${exp.note}`}
                      {tab === 'shared' && (
                        <span style={{ marginRight: 6, background: 'var(--primary)', color: '#fff', borderRadius: 12, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                          {exp.owner_username}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="amount">₪{exp.amount.toFixed(2)}</span>
                  {tab === 'personal' && (
                    <div className="actions">
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setEditItem(exp)}>✏️</button>
                      <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(exp.id)}>🗑️</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* מודלים */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>➕ הוספת הוצאה</h3>
            <ExpenseForm onSubmit={handleAdd} onCancel={() => setShowModal(false)} />
          </div>
        </div>
      )}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>✏️ עריכת הוצאה</h3>
            <ExpenseForm onSubmit={handleEdit} initialData={editItem} onCancel={() => setEditItem(null)} />
          </div>
        </div>
      )}
    </>
  );
}
