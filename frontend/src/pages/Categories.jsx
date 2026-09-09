import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getCategories, createCategory, deleteCategory } from '../services/api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [newName,    setNewName]    = useState('');
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      const res = await getCategories();
      setCategories(res.data);
    } catch {
      setError('שגיאה בטעינת קטגוריות');
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await createCategory(newName);
      setNewName('');
      setSuccess(`קטגוריה "${newName}" נוספה בהצלחה`);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בהוספה');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`למחוק קטגוריה "${name}"? ההוצאות המשויכות לא יימחקו.`)) return;
    try {
      await deleteCategory(id);
      fetchCategories();
    } catch {
      setError('שגיאה במחיקה');
    }
  };

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 24 }}>
        <h2 style={{ marginBottom: 20 }}>🗂️ ניהול קטגוריות</h2>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* טופס הוספה */}
        <div className="card">
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>שם קטגוריה חדשה</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="למשל: מזון, תחבורה, בידור..."
                required
              />
            </div>
            <button className="btn btn-success" style={{ width: 'auto' }}>+ הוסף</button>
          </form>
        </div>

        {/* רשימת קטגוריות */}
        {categories.length === 0
          ? <div className="card" style={{ textAlign: 'center', color: '#888' }}>אין קטגוריות עדיין</div>
          : categories.map(cat => (
            <div key={cat.id} className="expense-item">
              <span style={{ fontWeight: 600 }}>🏷️ {cat.name}</span>
              <button className="btn btn-danger" style={{ padding: '6px 12px' }} onClick={() => handleDelete(cat.id, cat.name)}>
                מחק
              </button>
            </div>
          ))
        }
      </div>
    </>
  );
}
