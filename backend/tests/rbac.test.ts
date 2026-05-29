import { api, auth, createUser, login, resetDb, teardown } from './helpers.js';

/**
 * Critical flow #1 — Role-based access control.
 * Verifies the ADMIN / MANAGER / MEMBER permission matrix and MEMBER
 * assignee-level ownership scoping.
 */
describe('RBAC', () => {
  let adminToken: string;
  let managerToken: string;
  let maryToken: string; // MEMBER, assignee
  let bobToken: string; // MEMBER, not assignee
  let maryId: string;
  let projectId: string;
  let maryTaskId: string;

  beforeAll(async () => {
    await resetDb();
    await createUser('ADMIN', 'admin@test.io');
    await createUser('MANAGER', 'manager@test.io');
    const mary = await createUser('MEMBER', 'mary@test.io');
    await createUser('MEMBER', 'bob@test.io');
    maryId = mary.id;

    adminToken = await login('admin@test.io');
    managerToken = await login('manager@test.io');
    maryToken = await login('mary@test.io');
    bobToken = await login('bob@test.io');

    // MANAGER creates a project and a task assigned to Mary.
    const proj = await api
      .post('/api/projects')
      .set(auth(managerToken))
      .send({ name: 'Apollo' });
    projectId = proj.body.data.id;

    const task = await api
      .post('/api/tasks')
      .set(auth(managerToken))
      .send({ title: "Mary's task", projectId, assigneeId: maryId });
    maryTaskId = task.body.data.id;
  });

  afterAll(teardown);

  it('rejects unauthenticated requests with 401', async () => {
    const res = await api.post('/api/tasks/all').send({});
    expect(res.status).toBe(401);
  });

  describe('MEMBER restrictions', () => {
    it('cannot create a project (403)', async () => {
      const res = await api.post('/api/projects').set(auth(maryToken)).send({ name: 'X' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('cannot create a task (403)', async () => {
      const res = await api
        .post('/api/tasks')
        .set(auth(maryToken))
        .send({ title: 'X', projectId });
      expect(res.status).toBe(403);
    });

    it('cannot list users (admin-only) (403)', async () => {
      const res = await api.post('/api/users/all').set(auth(maryToken)).send({});
      expect(res.status).toBe(403);
    });

    it('only sees tasks assigned to them', async () => {
      // A second task assigned to the manager must not appear in Mary's list.
      await api
        .post('/api/tasks')
        .set(auth(managerToken))
        .send({ title: 'Other', projectId });

      const res = await api.post('/api/tasks/all').set(auth(maryToken)).send({});
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(maryTaskId);
    });

    it("cannot view another member's task (404, no existence leak)", async () => {
      const res = await api.get(`/api/tasks/${maryTaskId}`).set(auth(bobToken));
      expect(res.status).toBe(404);
    });

    it('can update their own task details (200)', async () => {
      const res = await api
        .put(`/api/tasks/${maryTaskId}`)
        .set(auth(maryToken))
        .send({ description: 'working on it' });
      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('working on it');
    });

    it('cannot reassign their own task (403)', async () => {
      const res = await api
        .put(`/api/tasks/${maryTaskId}`)
        .set(auth(maryToken))
        .send({ assigneeId: maryId });
      expect(res.status).toBe(403);
    });

    it('cannot delete a task (403)', async () => {
      const res = await api.delete(`/api/tasks/${maryTaskId}`).set(auth(maryToken));
      expect(res.status).toBe(403);
    });
  });

  describe('MANAGER and ADMIN', () => {
    it('MANAGER can create projects and tasks but cannot manage users', async () => {
      const proj = await api.post('/api/projects').set(auth(managerToken)).send({ name: 'Beta' });
      expect(proj.status).toBe(201);

      const users = await api.post('/api/users/all').set(auth(managerToken)).send({});
      expect(users.status).toBe(403);
    });

    it('ADMIN can manage users', async () => {
      const res = await api
        .post('/api/users')
        .set(auth(adminToken))
        .send({ name: 'New', email: 'new@test.io', password: 'Passw0rd!', role: 'MEMBER' });
      expect(res.status).toBe(201);
    });

    it('ADMIN sees all tasks regardless of assignee', async () => {
      const res = await api.post('/api/tasks/all').set(auth(adminToken)).send({});
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });
});
