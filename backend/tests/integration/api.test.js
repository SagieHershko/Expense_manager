/**
 * Integration Tests — בדיקות אינטגרציה
 *
 * מה זה Integration Test?
 * בדיקה שבודקת כיצד מספר חלקים של המערכת עובדים יחד.
 * כאן: מפעילים את ה-Express server האמיתי ושולחים
 * אליו בקשות HTTP אמיתיות (בלי דפדפן).
 *
 * Supertest — ספריה שמדמה HTTP requests לשרת Express
 * ישירות בתוך הבדיקה, ללא פתיחת פורט אמיתי.
 */

const request = require('supertest');
const app     = require('../../src/app');

// ---- בדיקות hello-world ----
// נדרש מפורשות בדרישות הקורס!
describe('GET /api/hello-world', () => {
  test('מחזיר 200 עם הודעת Hello', async () => {
    const res = await request(app).get('/api/hello-world');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Hello, World!');
    expect(res.body.status).toBe('ok');
  });
});

// ---- בדיקות Auth ----
describe('POST /api/auth/register', () => {
  const testUser = {
    username: `testuser_${Date.now()}`, // שם ייחודי בכל ריצה
    password: 'password123'
  };

  test('הרשמה תקינה — מחזיר 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/created/i);
  });

  test('שם משתמש כפול — מחזיר 409', async () => {
    // רישום שוב עם אותו username
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
  });

  test('ללא password — מחזיר 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'onlyuser' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  const creds = { username: `login_test_${Date.now()}`, password: 'mypassword' };

  beforeAll(async () => {
    // יוצרים משתמש לפני הבדיקות
    await request(app).post('/api/auth/register').send(creds);
  });

  test('התחברות תקינה — מחזיר token', async () => {
    const res = await request(app).post('/api/auth/login').send(creds);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('סיסמה שגויה — מחזיר 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: creds.username, password: 'wrong' });

    expect(res.status).toBe(401);
  });
});

// ---- בדיקות Expenses (מוגן ב-JWT) ----
describe('Expenses API', () => {
  let token;

  beforeAll(async () => {
    // התחברות לפני כל הבדיקות — שמירת ה-token
    const creds = { username: `exp_test_${Date.now()}`, password: 'pass123' };
    await request(app).post('/api/auth/register').send(creds);
    const loginRes = await request(app).post('/api/auth/login').send(creds);
    token = loginRes.body.token;
  });

  test('GET /api/expenses ללא token — מחזיר 401', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(401);
  });

  test('GET /api/expenses עם token — מחזיר 200', async () => {
    const res = await request(app)
      .get('/api/expenses')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/expenses — הוספה תקינה', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'קפה', amount: 18.5, date: '2024-01-15' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('POST /api/expenses — ללא title מחזיר 400', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 50, date: '2024-01-15' });

    expect(res.status).toBe(400);
  });
});
