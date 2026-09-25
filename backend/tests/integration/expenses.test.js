/**
 * Integration Tests — Expenses API
 * בדיקות לסינון, עדכון, מחיקה וייצוא CSV של הוצאות
 */

const request = require('supertest');
const app     = require('../../src/app');

describe('Expenses API — CRUD, filters and CSV export', () => {
  let token;
  let otherToken;
  let foodId;
  let expenseId;

  beforeAll(async () => {
    const creds = { username: `expcrud_${Date.now()}`, password: 'pass123' };
    const other = { username: `expcrud_other_${Date.now()}`, password: 'pass123' };
    await request(app).post('/api/auth/register').send(creds);
    await request(app).post('/api/auth/register').send(other);
    token      = (await request(app).post('/api/auth/login').send(creds)).body.token;
    otherToken = (await request(app).post('/api/auth/login').send(other)).body.token;

    foodId = (await auth(request(app).post('/api/categories')).send({ name: 'Food' })).body.id;

    // נתוני בסיס: שתי הוצאות בינואר (אחת עם קטגוריה) ואחת בפברואר
    expenseId = (await auth(request(app).post('/api/expenses')).send({
      title: 'Pizza, "large"', amount: 60, category_id: foodId, date: '2024-01-10', note: 'with friends'
    })).body.id;
    await auth(request(app).post('/api/expenses')).send({ title: 'Bus', amount: 5.9, date: '2024-01-20' });
    await auth(request(app).post('/api/expenses')).send({ title: 'Cinema', amount: 45, date: '2024-02-03' });
  });

  function auth(req, t = token) {
    return req.set('Authorization', `Bearer ${t}`);
  }

  // ---- POST validation ----
  test('POST — סכום שלילי מחזיר 400', async () => {
    const res = await auth(request(app).post('/api/expenses'))
      .send({ title: 'Bad', amount: -10, date: '2024-01-01' });
    expect(res.status).toBe(400);
  });

  test('POST — סכום לא מספרי מחזיר 400', async () => {
    const res = await auth(request(app).post('/api/expenses'))
      .send({ title: 'Bad', amount: 'abc', date: '2024-01-01' });
    expect(res.status).toBe(400);
  });

  // ---- GET filters ----
  test('GET — מחזיר את כל ההוצאות ממוינות לפי תאריך', async () => {
    const res = await auth(request(app).get('/api/expenses'));
    expect(res.status).toBe(200);
    expect(res.body.map(e => e.title)).toEqual(['Cinema', 'Bus', 'Pizza, "large"']);
  });

  test('GET ?month= — מסנן לפי חודש', async () => {
    const res = await auth(request(app).get('/api/expenses?month=2024-01'));
    expect(res.body).toHaveLength(2);
  });

  test('GET ?category_id= — מסנן לפי קטגוריה ומחזיר שם קטגוריה', async () => {
    const res = await auth(request(app).get(`/api/expenses?category_id=${foodId}`));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category_name).toBe('Food');
  });

  test('GET — משתמש אחר לא רואה את ההוצאות', async () => {
    const res = await auth(request(app).get('/api/expenses'), otherToken);
    expect(res.body).toHaveLength(0);
  });

  // ---- CSV export ----
  test('GET /export — מחזיר קובץ CSV עם כותרות ושורות', async () => {
    const res = await auth(request(app).get('/api/expenses/export'));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="expenses_all_/);

    const lines = res.text.replace(/^﻿/, '').split('\n');
    expect(lines[0]).toBe('Date,Title,Amount,Category,Note');
    expect(lines).toHaveLength(4);
    // פסיקים וגרשיים בתוך שדה מוקפים ומוכפלים כמו שצריך
    expect(lines).toContain('2024-01-10,"Pizza, ""large""",60.00,"Food","with friends"');
  });

  test('GET /export?month=&category_id= — מכבד את הסינונים', async () => {
    const res = await auth(request(app).get(`/api/expenses/export?month=2024-01&category_id=${foodId}`));

    expect(res.headers['content-disposition']).toMatch(/expenses_2024-01_/);
    const lines = res.text.replace(/^﻿/, '').split('\n');
    expect(lines).toHaveLength(2);
  });

  // ---- PUT ----
  test('PUT — עדכון הוצאה', async () => {
    const res = await auth(request(app).put(`/api/expenses/${expenseId}`))
      .send({ title: 'Pizza', amount: 70, date: '2024-01-11' });
    expect(res.status).toBe(200);

    const list = await auth(request(app).get('/api/expenses?month=2024-01'));
    const updated = list.body.find(e => e.id === expenseId);
    expect(updated).toMatchObject({ title: 'Pizza', amount: 70, category_id: null, note: null });
  });

  test('PUT — חסרים שדות חובה מחזיר 400', async () => {
    const res = await auth(request(app).put(`/api/expenses/${expenseId}`)).send({ title: 'x' });
    expect(res.status).toBe(400);
  });

  test('PUT — הוצאה של משתמש אחר מחזיר 404', async () => {
    const res = await auth(request(app).put(`/api/expenses/${expenseId}`), otherToken)
      .send({ title: 'Hacked', amount: 1, date: '2024-01-01' });
    expect(res.status).toBe(404);
  });

  // ---- DELETE ----
  test('DELETE — הוצאה של משתמש אחר מחזיר 404', async () => {
    const res = await auth(request(app).delete(`/api/expenses/${expenseId}`), otherToken);
    expect(res.status).toBe(404);
  });

  test('DELETE — מחיקת הוצאה', async () => {
    const res = await auth(request(app).delete(`/api/expenses/${expenseId}`));
    expect(res.status).toBe(200);

    const list = await auth(request(app).get('/api/expenses'));
    expect(list.body.find(e => e.id === expenseId)).toBeUndefined();
  });

  test('DELETE — הוצאה שלא קיימת מחזיר 404', async () => {
    const res = await auth(request(app).delete(`/api/expenses/${expenseId}`));
    expect(res.status).toBe(404);
  });
});

describe('Misc routes', () => {
  test('route לא קיים — מחזיר 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });

  test('register עם סיסמה קצרה — מחזיר 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `short_${Date.now()}`, password: '123' });
    expect(res.status).toBe(400);
  });

  test('login ללא שדות — מחזיר 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('תגובות כוללות security headers', async () => {
    const res = await request(app).get('/api/hello-world');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
