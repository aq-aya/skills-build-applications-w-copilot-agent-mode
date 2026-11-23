import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('team validation', () => {
  it.each([
    { name: 'Octocats' },
    { name: 'Octocats', mascot: ' ' },
  ])('rejects a missing or blank mascot', async (team) => {
    const response = await request(createApp()).post('/api/teams').send(team);
    expect(response.status).toBe(400);
  });
});
