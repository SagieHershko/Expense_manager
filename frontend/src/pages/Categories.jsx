import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getCategories, createCategory, deleteCategory, updateCategory } from '../services/api';

// רשימת אייקונים לבחירה
const ICON_OPTIONS = [
  '🍔','🍕','🥤','☕','🍎','🛒','🚗','🚌','✈️','⛽',
  '🏠','💡','📱','💻','💊','🏋️','🎮','🎬','📚','👗',
  '🐕','🎵','🎁','🏥','💰','✂️','🧹','🎓','🧴','🏖️'
];

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [newName,    setNewName]    = useState('');
  const [newIcon,    setNewIcon]    = useState('🏷️');
  const [newBudget,  setNewBudget]  = useState('');
  const [editId,     setEditId]     = useState(null);   // קטגוריה בעריכה
  const [editData,   setEditData]   = useState({});
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [showPicker, setShowPicker] = useState(false);  // בורר אייקון לטופס הוספה
  const [showEditPicker, setShowEditPicker] = useState(false); // בורר לעריכה

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
      await createCategory(newName, newIcon, newBudget ? parseFloat(newBudget) : null);
      setSuccess(`קטגוריה "${newName}" נוספה בהצלחה`);
      setNewName(''); setNewIcon('🏷️'); setNewBudget('');
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

  const startEdit = (cat) => {
    setEditId(cat.id);
    setEditData({ name: cat.name, icon: cat.icon || '🏷️', monthly_budget: cat.monthly_budget || '' });
    setShowEditPicker(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await updateCategory(editId, editData.name, editData.icon, editData.monthly_budget ? parseFloat(editData.monthly_budget) : null);
      setSuccess('קטגוריה עודכנה בהצלחה');
      setEditId(null);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בעדכון');
    }
  };

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 24 }}>
        <h2 style={{ marginBottom: 20 }}>🗂️ ניהול קטגוריות</h2>

        {error   && <div className="alert alert-error"   onClick={() => setError('')}>{error} ✕</div>}
        {success && <div className="alert alert-success" onClick={() => setSuccess('')}>{success} ✕</div>}

        {/* טופס הוספת קטגוריה חדשה */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>הוספת קטגוריה חדשה</h3>
          <form onSubmit={handleAdd}>
            {/* שורה ראשונה: אייקון + שם */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
              {/* בורר אייקון */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.9rem' }}>אייקון</label>
                <button
                  type="button"
                  className="btn btn-secondary icon-picker-btn"
                  onClick={() => setShowPicker(p => !p)}
                  title="בחר אייקון"
                >
                  {newIcon}
                </button>
                {showPicker && (
                  <div className="icon-picker-grid">
                    {ICON_OPTIONS.map(ic => (
                      <button
                        key={ic}
                        type="button"
                        className={`icon-option ${ic === newIcon ? 'selected' : ''}`}
                        onClick={() => { setNewIcon(ic); setShowPicker(false); }}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* שם */}
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>שם קטגוריה</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="למשל: מזון, תחבורה, בידור..."
                  required
                />
              </div>

              {/* תקציב חודשי */}
              <div className="form-group" style={{ width: 160, marginBottom: 0 }}>
                <label>תקציב חודשי (₪)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newBudget}
                  onChange={e => setNewBudget(e.target.value)}
                  placeholder="אופציונלי"
                />
              </div>

              <button className="btn btn-success" style={{ width: 'auto' }}>+ הוסף</button>
            </div>
          </form>
        </div>

        {/* רשימת קטגוריות */}
        {categories.length === 0
          ? <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted, #888)' }}>
              אין קטגוריות עדיין
            </div>
          : categories.map(cat => (
            <div key={cat.id} className="cat-item">
              {editId === cat.id ? (
                /* מצב עריכה */
                <form onSubmit={handleUpdate} className="cat-edit-form">
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="btn btn-secondary icon-picker-btn"
                      onClick={() => setShowEditPicker(p => !p)}
                    >
                      {editData.icon}
                    </button>
                    {showEditPicker && (
                      <div className="icon-picker-grid">
                        {ICON_OPTIONS.map(ic => (
                          <button
                            key={ic}
                            type="button"
                            className={`icon-option ${ic === editData.icon ? 'selected' : ''}`}
                            onClick={() => { setEditData(d => ({ ...d, icon: ic })); setShowEditPicker(false); }}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    value={editData.name}
                    onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                    required
                    style={{ flex: 1, padding: '8px 12px', border: '2px solid #667eea', borderRadius: 8, fontFamily: 'inherit', fontSize: '1rem' }}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editData.monthly_budget}
                    onChange={e => setEditData(d => ({ ...d, monthly_budget: e.target.value }))}
                    placeholder="תקציב חודשי ₪"
                    style={{ width: 150, padding: '8px 12px', border: '2px solid #e0e0e0', borderRadius: 8, fontFamily: 'inherit', fontSize: '1rem' }}
                  />
                  <button type="submit" className="btn btn-success" style={{ padding: '8px 14px' }}>💾</button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px' }} onClick={() => setEditId(null)}>ביטול</button>
                </form>
              ) : (
                /* מצב תצוגה */
                <>
                  <div className="cat-info">
                    <span className="cat-icon">{cat.icon || '🏷️'}</span>
                    <div>
                      <span className="cat-name">{cat.name}</span>
                      {cat.monthly_budget && (
                        <span className="cat-budget">תקציב: ₪{cat.monthly_budget}</span>
                      )}
                    </div>
                  </div>
                  <div className="cat-actions">
                    <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => startEdit(cat)}>
                      ✏️ ערוך
                    </button>
                    <button className="btn btn-danger" style={{ padding: '6px 12px' }} onClick={() => handleDelete(cat.id, cat.name)}>
                      🗑️ מחק
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        }
      </div>
    </>
  );
}
