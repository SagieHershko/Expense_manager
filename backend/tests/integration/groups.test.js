const request = require('supertest');
const app     = require('../../src/app');

const suffix = Date.now();

async function makeUser(prefix) {
  const creds = { username: `${prefix}_${suffix}`, password: 'password123' };
  await request(app).post('/api/auth/register').send(creds);
  const res = await request(app).post('/api/auth/login').send(creds);
  return { username: creds.username, token: res.body.token };
}

const as = (user, req) => req.set('Authorization', `Bearer ${user.token}`);

describe('Groups API', () => {
  let alice, bob, carol;
  let groupId;

  beforeAll(async () => {
    [alice, bob, carol] = await Promise.all([
      makeUser('grp_alice'), makeUser('grp_bob'), makeUser('grp_carol'),
    ]);
    await as(alice, request(app).post('/api/expenses'))
      .send({ title: 'Alice lunch', amount: 30, date: '2024-03-05' });
    await as(bob, request(app).post('/api/expenses'))
      .send({ title: 'Bob taxi', amount: 20, date: '2024-03-10' });
    await as(bob, request(app).post('/api/expenses'))
      .send({ title: 'Bob April', amount: 99, date: '2024-04-01' });
    await as(carol, request(app).post('/api/expenses'))
      .send({ title: 'Carol secret', amount: 500, date: '2024-03-12' });
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/groups');
    expect(res.status).toBe(401);
  });

  describe('create and list', () => {
    test('rejects an empty name', async () => {
      const res = await as(alice, request(app).post('/api/groups')).send({ name: '  ' });
      expect(res.status).toBe(400);
    });

    test('creates a group and makes the creator an accepted member', async () => {
      const res = await as(alice, request(app).post('/api/groups')).send({ name: 'Home' });
      expect(res.status).toBe(201);
      groupId = res.body.id;

      const list = await as(alice, request(app).get('/api/groups'));
      expect(list.status).toBe(200);
      const group = list.body.find(g => g.id === groupId);
      expect(group).toMatchObject({ name: 'Home', status: 'accepted', member_count: 1 });
    });

    test('does not list the group for a non-member', async () => {
      const list = await as(carol, request(app).get('/api/groups'));
      expect(list.body.find(g => g.id === groupId)).toBeUndefined();
    });
  });

  describe('invitations', () => {
    test('rejects a missing username', async () => {
      const res = await as(alice, request(app).post(`/api/groups/${groupId}/invite`)).send({});
      expect(res.status).toBe(400);
    });

    test('non-member cannot invite', async () => {
      const res = await as(carol, request(app).post(`/api/groups/${groupId}/invite`))
        .send({ username: bob.username });
      expect(res.status).toBe(403);
    });

    test('unknown user returns 404', async () => {
      const res = await as(alice, request(app).post(`/api/groups/${groupId}/invite`))
        .send({ username: 'no_such_user_xyz' });
      expect(res.status).toBe(404);
    });

    test('cannot invite yourself', async () => {
      const res = await as(alice, request(app).post(`/api/groups/${groupId}/invite`))
        .send({ username: alice.username });
      expect(res.status).toBe(400);
    });

    test('invites a user, who then sees a pending invitation', async () => {
      const res = await as(alice, request(app).post(`/api/groups/${groupId}/invite`))
        .send({ username: bob.username });
      expect(res.status).toBe(200);

      const list = await as(bob, request(app).get('/api/groups'));
      expect(list.body.find(g => g.id === groupId).status).toBe('pending');
    });

    test('duplicate invite returns 409', async () => {
      const res = await as(alice, request(app).post(`/api/groups/${groupId}/invite`))
        .send({ username: bob.username });
      expect(res.status).toBe(409);
    });

    test('pending member cannot read group expenses yet', async () => {
      const res = await as(bob, request(app).get(`/api/groups/${groupId}/expenses`));
      expect(res.status).toBe(403);
    });

    test('accept without an invitation returns 404', async () => {
      const res = await as(carol, request(app).post(`/api/groups/${groupId}/invite/accept`));
      expect(res.status).toBe(404);
    });

    test('accepting makes the user an active member', async () => {
      const res = await as(bob, request(app).post(`/api/groups/${groupId}/invite/accept`));
      expect(res.status).toBe(200);

      const list = await as(alice, request(app).get('/api/groups'));
      expect(list.body.find(g => g.id === groupId).member_count).toBe(2);
    });

    test('declining removes a pending invitation', async () => {
      await as(alice, request(app).post(`/api/groups/${groupId}/invite`))
        .send({ username: carol.username });

      const res = await as(carol, request(app).post(`/api/groups/${groupId}/invite/decline`));
      expect(res.status).toBe(200);

      const list = await as(carol, request(app).get('/api/groups'));
      expect(list.body.find(g => g.id === groupId)).toBeUndefined();
    });

    test('decline without an invitation returns 404', async () => {
      const res = await as(carol, request(app).post(`/api/groups/${groupId}/invite/decline`));
      expect(res.status).toBe(404);
    });

    test('decline cannot remove an already accepted membership', async () => {
      const res = await as(bob, request(app).post(`/api/groups/${groupId}/invite/decline`));
      expect(res.status).toBe(404);

      const list = await as(bob, request(app).get('/api/groups'));
      expect(list.body.find(g => g.id === groupId).status).toBe('accepted');
    });
  });

  describe('group expenses', () => {
    test('non-member gets 403', async () => {
      const res = await as(carol, request(app).get(`/api/groups/${groupId}/expenses`));
      expect(res.status).toBe(403);
    });

    test('returns every active member\'s expenses and a per-user summary', async () => {
      const res = await as(alice, request(app).get(`/api/groups/${groupId}/expenses`));
      expect(res.status).toBe(200);

      const titles = res.body.expenses.map(e => e.title);
      expect(titles).toEqual(expect.arrayContaining(['Alice lunch', 'Bob taxi', 'Bob April']));
      expect(titles).not.toContain('Carol secret');
      expect(res.body.summary[bob.username]).toBe(119);
      expect(res.body.summary[alice.username]).toBe(30);
    });

    test('filters by month', async () => {
      const res = await as(alice, request(app).get(`/api/groups/${groupId}/expenses`))
        .query({ month: '2024-03' });
      expect(res.body.expenses.map(e => e.title).sort()).toEqual(['Alice lunch', 'Bob taxi']);
    });

    test('filters by category', async () => {
      const cat = await as(alice, request(app).post('/api/categories'))
        .send({ name: `grp_cat_${suffix}` });
      await as(alice, request(app).post('/api/expenses'))
        .send({ title: 'Categorised', amount: 7, date: '2024-03-15', category_id: cat.body.id });

      const res = await as(bob, request(app).get(`/api/groups/${groupId}/expenses`))
        .query({ category_id: cat.body.id });
      expect(res.status).toBe(200);
      expect(res.body.expenses.map(e => e.title)).toEqual(['Categorised']);
    });
  });

  describe('CSV export', () => {
    test('non-member gets 403', async () => {
      const res = await as(carol, request(app).get(`/api/groups/${groupId}/expenses/export`));
      expect(res.status).toBe(403);
    });

    test('exports filtered rows as CSV with a user column', async () => {
      const res = await as(alice, request(app).get(`/api/groups/${groupId}/expenses/export`))
        .query({ month: '2024-03' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/shared_Home_2024-03\.csv/);
      expect(res.text).toContain('Date,User,Title,Amount,Category,Note');
      expect(res.text).toContain(`"${bob.username}","Bob taxi",20.00`);
      expect(res.text).not.toContain('Bob April');
    });
  });
});
