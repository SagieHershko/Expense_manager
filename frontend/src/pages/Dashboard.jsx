import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import Navbar from '../components/Navbar';
import ExpenseForm from '../components/ExpenseForm';
import { getExpenses, createExpense, updateExpense, deleteExpense, getCategories } from '../services/api';

// רישום components של Chart.js (חובה לפני שימוש)
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const [expenses,    setExpenses]    = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCat,   setFilterCat]   = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [editItem,    setEditItem]    = useState(null);
  const [error,       setError]       = useState('');

  // טעינה ראשונית וכל פעם שמשתנים הפילטרים
  useEffect(() => {
    fetchExpenses();
    getCategories().then(r => setCategories(r.data)).catch(() => {});
  }, [filterMonth, filterCat]);

  const fetchExpenses = async () => {
    try {
      const params = {};
      if (filterMonth) params.month = filterMonth;
      if (filterCat)   params.category_id = filterCat;
      const res = await getExpenses(params);
      setExpenses(res.data);
    } catch {
      setError('שגיאה בטעינת הוצאות');
    }
  };

  const handleAdd = async (formData) => {
    try {
      await createExpense(formData);
      setShowModal(false);
      fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בהוספה');
    }
  };

  const handleEdit = async (formData) => {
    try {
      await updateExpense(editItem.id, formData);
      setEditItem(null);
      fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בעדכון');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק הוצאה זו?')) return;
    try {
      await deleteExpense(id);
      fetchExpenses();
    } catch {
      setError('שגיאה במחיקה');
    }
  };

  // חישוב סיכומים
  const total     = expenses.reduce((sum, e) => sum + e.amount, 0);
  const avgPerDay = expenses.length ? (total / new Set(expenses.map(e => e.date)).size).toFixed(2) : 0;

  // נתונים לגרף — סכום לפי קטגוריה
  const categoryTotals = expenses.reduce((acc, e) => {
    const name = e.category_name || 'ללא קטגוריה';
    acc[name] = (acc[name] || 0) + e.amount;
    return acc;
  }, {});

  const chartData = {
    labels: Object.keys(categoryTotals),
    datasets: [{
      label: 'סכום לפי קטגוריה (₪)',
      data: Object.values(categoryTotals),
      backgroundColor: ['#667eea','#f59e0b','#22c55e','#ef4444','#8b5cf6','#06b6d4']
    }]
  };

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 24 }}>
        {error && <div className="alert alert-error" onClick={() => setError('')}>{error} ✕</div>}

        {/* כרטיסי סיכום */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="value">₪{total.toFixed(2)}</div>
            <div className="label">סה״כ הוצאות</div>
          </div>
          <div className="summary-card">
            <div className="value">{expenses.length}</div>
            <div className="label">מספר פעולות</div>
          </div>
          <div className="summary-card">
            <div className="value">₪{avgPerDay}</div>
            <div className="label">ממוצע ליום</div>
          </div>
        </div>

        {/* גרף */}
        {expenses.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </div>
        )}

        {/* פילטרים + כפתור הוספה */}
        <div className="filter-bar">
          <div className="form-group">
            <label>סינון לפי חודש</label>
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          </div>
          <div className="form-group">
            <label>סינון לפי קטגוריה</label>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">הכל</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowModal(true)}>
            + הוסף הוצאה
          </button>
        </div>

        {/* רשימת הוצאות */}
        {expenses.length === 0
          ? <div className="card" style={{ textAlign: 'center', color: '#888' }}>אין הוצאות להצגה</div>
          : expenses.map(exp => (
            <div className="expense-item" key={exp.id}>
              <div>
                <div><strong>{exp.title}</strong></div>
                <div className="meta">{exp.date} {exp.category_name && `• ${exp.category_name}`} {exp.note && `• ${exp.note}`}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="amount">₪{exp.amount.toFixed(2)}</span>
                <div className="actions">
                  <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setEditItem(exp)}>✏️</button>
                  <button className="btn btn-danger"    style={{ padding: '6px 10px' }} onClick={() => handleDelete(exp.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* Modal הוספה */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>➕ הוספת הוצאה</h3>
            <ExpenseForm onSubmit={handleAdd} onCancel={() => setShowModal(false)} />
          </div>
        </div>
      )}

      {/* Modal עריכה */}
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
