import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the middleware
vi.mock('../middleware/with-household.js', () => ({
  withHousehold: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { householdId: string }).householdId = 'hh-test';
    next();
  },
}));

// Mock the lib modules
vi.mock('../lib/recipe-extractor.js', () => ({
  extractFromUrl: vi.fn(),
}));

vi.mock('../lib/photo-extractor.js', () => ({
  extractFromPhoto: vi.fn(),
}));

vi.mock('../lib/themealdb.js', () => ({
  searchMealDb: vi.fn(),
}));

const { extractFromUrl } = await import('../lib/recipe-extractor.js');
const { extractFromPhoto } = await import('../lib/photo-extractor.js');
const { searchMealDb } = await import('../lib/themealdb.js');
const { default: ingestRouter } = await import('./ingest.js');

const MOCK_RECIPE = {
  name: 'Test Recipe',
  servings: 4,
  sourceUrl: 'https://example.com/recipe',
  sourceImage: null as null,
  instructions: 'Mix and bake.',
  ingredients: [
    { rawText: 'flour', canonicalFoodId: 'cf-1', foodName: 'flour', qty: 200, unit: 'g' as const, optional: false, confidence: 'high' as const },
  ],
};

describe('ingest router', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/ingest', ingestRouter);
    vi.clearAllMocks();
  });

  describe('POST /url', () => {
    it('returns 400 for missing url', async () => {
      const res = await request(app).post('/api/ingest/url').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid url', async () => {
      const res = await request(app).post('/api/ingest/url').send({ url: 'not-a-url' });
      expect(res.status).toBe(400);
    });

    it('returns extracted recipe on success', async () => {
      vi.mocked(extractFromUrl).mockResolvedValueOnce(MOCK_RECIPE);
      const res = await request(app).post('/api/ingest/url').send({ url: 'https://example.com/recipe' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Recipe');
      expect(res.body.ingredients).toHaveLength(1);
    });

    it('returns 422 when extraction fails', async () => {
      vi.mocked(extractFromUrl).mockRejectedValueOnce(new Error('Could not extract'));
      const res = await request(app).post('/api/ingest/url').send({ url: 'https://example.com/recipe' });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/Could not extract/);
    });
  });

  describe('POST /photo', () => {
    it('returns 400 for missing imageBase64', async () => {
      const res = await request(app).post('/api/ingest/photo').send({ mimeType: 'image/jpeg' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid mimeType', async () => {
      const res = await request(app).post('/api/ingest/photo').send({ imageBase64: 'abc', mimeType: 'application/pdf' });
      expect(res.status).toBe(400);
    });

    it('returns extracted recipe on success', async () => {
      vi.mocked(extractFromPhoto).mockResolvedValueOnce({
        name: 'Photo Recipe',
        servings: 2,
        instructions: null,
        ingredients: [],
      });
      const res = await request(app).post('/api/ingest/photo').send({ imageBase64: 'abc123', mimeType: 'image/jpeg' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Photo Recipe');
    });
  });

  describe('GET /search', () => {
    it('returns 400 for missing query', async () => {
      const res = await request(app).get('/api/ingest/search');
      expect(res.status).toBe(400);
    });

    it('returns search results', async () => {
      vi.mocked(searchMealDb).mockResolvedValueOnce([MOCK_RECIPE]);
      const res = await request(app).get('/api/ingest/search?q=pasta');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Test Recipe');
    });

    it('returns empty array when no results', async () => {
      vi.mocked(searchMealDb).mockResolvedValueOnce([]);
      const res = await request(app).get('/api/ingest/search?q=xyz123abc');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });
});
