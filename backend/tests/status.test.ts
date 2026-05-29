import { api, auth, createUser, login, resetDb, teardown } from './helpers.js';

/**
 * Critical flow #2 — Task status state machine.
 * TODO → IN_PROGRESS → IN_REVIEW → DONE; BLOCKED from any active state;
 * DONE terminal. Only the assignee or a MANAGER/ADMIN may advance status.
 */
describe('Task status transitions', () => {
  let managerToken: string;
  let maryToken: string; // assignee
  let bobToken: string; // not assignee
  let maryId: string;
  let projectId: string;

  beforeAll(async () => {
    await resetDb();
    await createUser('MANAGER', 'manager@test.io');
    const mary = await createUser('MEMBER', 'mary@test.io');
    await createUser('MEMBER', 'bob@test.io');
    maryId = mary.id;

    managerToken = await login('manager@test.io');
    maryToken = await login('mary@test.io');
    bobToken = await login('bob@test.io');

    const proj = await api.post('/api/projects').set(auth(managerToken)).send({ name: 'Apollo' });
    projectId = proj.body.data.id;
  });

  afterAll(teardown);

  async function newTask(): Promise<string> {
    const res = await api
      .post('/api/tasks')
      .set(auth(managerToken))
      .send({ title: 'T', projectId, assigneeId: maryId });
    return res.body.data.id;
  }

  const setStatus = (id: string, token: string, status: string) =>
    api.patch(`/api/tasks/${id}/status`).set(auth(token)).send({ status });

  it('new tasks start at TODO', async () => {
    const res = await api
      .post('/api/tasks')
      .set(auth(managerToken))
      .send({ title: 'Fresh', projectId, assigneeId: maryId, status: 'DONE' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('TODO'); // status in body is ignored
  });

  it('rejects an illegal skip TODO → DONE with 409 INVALID_TRANSITION', async () => {
    const id = await newTask();
    const res = await setStatus(id, managerToken, 'DONE');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
    expect(res.body.details.allowed).toEqual(['IN_PROGRESS', 'BLOCKED']);
  });

  it('allows the full happy path TODO → IN_PROGRESS → IN_REVIEW → DONE', async () => {
    const id = await newTask();
    expect((await setStatus(id, managerToken, 'IN_PROGRESS')).status).toBe(200);
    expect((await setStatus(id, managerToken, 'IN_REVIEW')).status).toBe(200);
    const done = await setStatus(id, managerToken, 'DONE');
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('DONE');
  });

  it('reaches BLOCKED from an active state and resumes', async () => {
    const id = await newTask();
    await setStatus(id, managerToken, 'IN_PROGRESS');
    expect((await setStatus(id, managerToken, 'BLOCKED')).status).toBe(200);
    expect((await setStatus(id, managerToken, 'IN_PROGRESS')).status).toBe(200);
  });

  it('treats DONE as terminal (409)', async () => {
    const id = await newTask();
    await setStatus(id, managerToken, 'IN_PROGRESS');
    await setStatus(id, managerToken, 'IN_REVIEW');
    await setStatus(id, managerToken, 'DONE');
    const res = await setStatus(id, managerToken, 'IN_PROGRESS');
    expect(res.status).toBe(409);
  });

  it('lets the assignee advance their own task', async () => {
    const id = await newTask();
    const res = await setStatus(id, maryToken, 'IN_PROGRESS');
    expect(res.status).toBe(200);
  });

  it('forbids a non-assignee MEMBER from changing status (403)', async () => {
    const id = await newTask();
    const res = await setStatus(id, bobToken, 'IN_PROGRESS');
    expect(res.status).toBe(403);
  });

  it('rejects an invalid status value with 400 VALIDATION_ERROR', async () => {
    const id = await newTask();
    const res = await setStatus(id, managerToken, 'SHIPPED');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('does not allow status changes through the regular update endpoint', async () => {
    const id = await newTask();
    await api.put(`/api/tasks/${id}`).set(auth(managerToken)).send({ status: 'DONE' });
    const res = await api.get(`/api/tasks/${id}`).set(auth(managerToken));
    expect(res.body.data.status).toBe('TODO');
  });
});
