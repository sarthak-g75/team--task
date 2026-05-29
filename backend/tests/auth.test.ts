import { api, resetDb, teardown } from './helpers.js';

describe('Auth — register', () => {
  beforeAll(resetDb);
  afterAll(teardown);

  it('registers the first user as ADMIN and returns an access token', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ name: 'First Owner', email: 'owner@test.io', password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  it('registers subsequent users as MEMBER', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ name: 'Second User', email: 'second@test.io', password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('MEMBER');
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'owner@test.io', password: 'Passw0rd!' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('validates input with 400 VALIDATION_ERROR', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ name: 'Ok Name', email: 'bad@test.io', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
