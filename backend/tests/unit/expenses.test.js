/**
 * Unit Tests — בדיקות יחידה
 *
 * מה זה Unit Test?
 * בדיקה של פונקציה בודדת, מבודדת מכל שאר המערכת.
 * לא מחברים ל-DB אמיתי, לא מפעילים שרת — רק בודקים לוגיקה.
 *
 * למה? כי כך אפשר לאתר באגים מהר, ולוודא שפונקציה אחת
 * לא שוברת פונקציות אחרות.
 */

// פונקציות עזר שנרצה לבדוק (לוגיקה עסקית טהורה)
function validateExpense(title, amount, date) {
  if (!title || title.trim() === '') return { valid: false, error: 'Title is required' };
  if (!amount || isNaN(amount) || amount <= 0) return { valid: false, error: 'Amount must be positive' };
  if (!date) return { valid: false, error: 'Date is required' };
  return { valid: true };
}

function calculateTotal(expenses) {
  if (!Array.isArray(expenses)) return 0;
  return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
}

function groupByCategory(expenses) {
  return expenses.reduce((acc, e) => {
    const key = e.category || 'Uncategorized';
    acc[key] = (acc[key] || 0) + e.amount;
    return acc;
  }, {});
}

function filterByMonth(expenses, month) {
  // month בפורמט "YYYY-MM"
  return expenses.filter(e => e.date && e.date.startsWith(month));
}

// ---- בדיקות ----

describe('validateExpense', () => {
  test('קלט תקין — מחזיר valid:true', () => {
    const result = validateExpense('קניות', 150, '2024-01-15');
    expect(result.valid).toBe(true);
  });

  test('כותרת ריקה — מחזיר שגיאה', () => {
    const result = validateExpense('', 100, '2024-01-15');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Title/);
  });

  test('סכום שלילי — מחזיר שגיאה', () => {
    expect(validateExpense('שם', -50, '2024-01-15').valid).toBe(false);
  });

  test('סכום אפס — מחזיר שגיאה', () => {
    expect(validateExpense('שם', 0, '2024-01-15').valid).toBe(false);
  });

  test('ללא תאריך — מחזיר שגיאה', () => {
    expect(validateExpense('שם', 100, '').valid).toBe(false);
  });
});

describe('calculateTotal', () => {
  test('מחשב סכום נכון', () => {
    const expenses = [{ amount: 100 }, { amount: 50 }, { amount: 25.5 }];
    expect(calculateTotal(expenses)).toBe(175.5);
  });

  test('מערך ריק — מחזיר 0', () => {
    expect(calculateTotal([])).toBe(0);
  });

  test('קלט לא תקין — מחזיר 0', () => {
    expect(calculateTotal(null)).toBe(0);
  });
});

describe('groupByCategory', () => {
  test('מקבץ לפי קטגוריה', () => {
    const expenses = [
      { amount: 100, category: 'מזון' },
      { amount: 50,  category: 'מזון' },
      { amount: 200, category: 'תחבורה' }
    ];
    const result = groupByCategory(expenses);
    expect(result['מזון']).toBe(150);
    expect(result['תחבורה']).toBe(200);
  });

  test('ללא קטגוריה — מקובץ תחת Uncategorized', () => {
    const expenses = [{ amount: 75 }];
    expect(groupByCategory(expenses)['Uncategorized']).toBe(75);
  });
});

describe('filterByMonth', () => {
  const expenses = [
    { amount: 100, date: '2024-01-15' },
    { amount: 200, date: '2024-01-28' },
    { amount: 300, date: '2024-02-05' }
  ];

  test('מסנן חודש נכון', () => {
    const result = filterByMonth(expenses, '2024-01');
    expect(result).toHaveLength(2);
  });

  test('חודש ללא הוצאות — מערך ריק', () => {
    expect(filterByMonth(expenses, '2024-03')).toHaveLength(0);
  });
});

module.exports = { validateExpense, calculateTotal, groupByCategory, filterByMonth };
