/**
 * Integration Tests — Categories API
 * בדיקות ל-CRUD של קטגוריות (מוגן ב-JWT)
 */

const request = require('supertest');
const app     = require('../../src/app');

describe('Categories API', () => {
  let token;
  let otherToken;
  let categoryId;

  beforeAll(async () => {
    // שני משתמשים — כדי לוודא שמשתמש לא יכול לגעת בקטגוריות של אחר
    const creds = { username: `cat_test_${Date.now()}`, password: 'pass123' };
    const other = { username: `cat_other_${Date.now()}`, password: 'pass123' };
    await request(app).post('/api/auth/register').send(creds);
    await request(app).post('/api/auth/register').send(other);
    token      = (await request(app).post('/api/auth/login').send(creds)).body.token;
    otherToken = (await request(app).post('/api/auth/login').send(other)).body.token;
  });

  const auth = (req, t = token) => req.set('Authorization', `Bearer ${t}`);

  test('GET ללא token — מחזיר 401', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
  });

  test('GET עם token לא תקין — מחזיר 403', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(403);
  });

  test('POST — יצירת קטגוריה תקינה', async () => {
    const res = await auth(request(app).post('/api/categories'))
      .send({ name: 'Food', icon: '🍔', monthly_budget: 1500 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    categoryId = res.body.id;
  });

  test('POST — ללא שם מחזיר 400', async () => {
    const res = await auth(request(app).post('/api/categories')).send({ name: '  ' });
    expect(res.status).toBe(400);
  });

  test('POST — שם כפול מחזיר 409', async () => {
    const res = await auth(request(app).post('/api/categories')).send({ name: 'Food' });
    expect(res.status).toBe(409);
  });

  test('GET — מחזיר את הקטגוריות של המשתמש', async () => {
    const res = await auth(request(app).get('/api/categories'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'Food', icon: '🍔', monthly_budget: 1500 });
  });

  test('GET — משתמש אחר לא רואה את הקטגוריות', async () => {
    const res = await auth(request(app).get('/api/categories'), otherToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('PUT — עדכון קטגוריה', async () => {
    const res = await auth(request(app).put(`/api/categories/${categoryId}`))
      .send({ name: 'Groceries', monthly_budget: 2000 });
    expect(res.status).toBe(200);

    const list = await auth(request(app).get('/api/categories'));
    expect(list.body[0]).toMatchObject({ name: 'Groceries', monthly_budget: 2000 });
  });

  test('PUT — ללא שם מחזיר 400', async () => {
    const res = await auth(request(app).put(`/api/categories/${categoryId}`)).send({});
    expect(res.status).toBe(400);
  });

  test('PUT — שם שכבר קיים מחזיר 409', async () => {
    await auth(request(app).post('/api/categories')).send({ name: 'Transport' });
    const res = await auth(request(app).put(`/api/categories/${categoryId}`))
      .send({ name: 'Transport' });
    expect(res.status).toBe(409);
  });

  test('PUT — קטגוריה של משתמש אחר מחזיר 404', async () => {
    const res = await auth(request(app).put(`/api/categories/${categoryId}`), otherToken)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(404);
  });

  test('DELETE — קטגוריה של משתמש אחר מחזיר 404', async () => {
    const res = await auth(request(app).delete(`/api/categories/${categoryId}`), otherToken);
    expect(res.status).toBe(404);
  });

  test('DELETE — מחיקת קטגוריה', async () => {
    const res = await auth(request(app).delete(`/api/categories/${categoryId}`));
    expect(res.status).toBe(200);
  });

  test('DELETE — קטגוריה שלא קיימת מחזיר 404', async () => {
    const res = await auth(request(app).delete(`/api/categories/${categoryId}`));
    expect(res.status).toBe(404);
  });
});
