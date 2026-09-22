import { useState, useEffect } from 'react';
import { getCategories } from '../services/api';

// טופס לשימוש כפול: הוספה ועריכה
export default function ExpenseForm({ onSubmit, initialData = null, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category_id: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });
  const [categories, setCategories] = useState([]);

  // אם קיבלנו נתונים ראשוניים (מצב עריכה) — ממלאים את הטופס
  useEffect(() => {
    if (initialData) setForm(initialData);
    getCategories().then(res => setCategories(res.data)).catch(() => {});
  }, [initialData]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>כותרת</label>
        <input name="title" value={form.title} onChange={handleChange} required placeholder="למשל: קניות בסופר" />
      </div>
      <div className="form-group">
        <label>סכום (₪)</label>
        <input name="amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>קטגוריה</label>
        <select name="category_id" value={form.category_id} onChange={handleChange}>
          <option value="">— ללא קטגוריה —</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.icon || '🏷️'} {c.name}
              {c.monthly_budget ? ` (תקציב: ₪${c.monthly_budget})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>תאריך</label>
        <input name="date" type="date" value={form.date} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>הערה (אופציונלי)</label>
        <input name="note" value={form.note} onChange={handleChange} placeholder="הערה נוספת..." />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>ביטול</button>
        <button type="submit" className="btn btn-success">שמור</button>
      </div>
    </form>
  );
}
