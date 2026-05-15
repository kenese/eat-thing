import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('./middleware/with-household.js', () => ({
  withHousehold: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('./lib/photo-extractor.js', () => ({
  extractFromPhoto: vi.fn().mockResolvedValue({
    name: 'Large Photo Recipe',
    servings: 1,
    instructions: null,
    ingredients: [],
  }),
}));

import app from './app';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/ingest/photo', () => {
  it('accepts recipe photo JSON payloads larger than the default Express limit', async () => {
    const imageBase64 = 'a'.repeat(200_000);

    const res = await request(app)
      .post('/api/ingest/photo')
      .send({ imageBase64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Large Photo Recipe');
  });
});

describe('unknown routes', () => {
  it('returns 404 for unregistered API paths', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
