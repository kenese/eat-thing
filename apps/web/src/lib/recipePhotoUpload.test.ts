import { describe, expect, it } from 'vitest';
import {
  calculateRecipePhotoSize,
  estimateJsonPhotoPayloadBytes,
  getRecipePhotoUploadMimeType,
  getRecipePhotoMimeType,
  shouldResizeRecipePhoto,
} from './recipePhotoUpload';

describe('recipe photo upload helpers', () => {
  it('scales large photos down to fit the configured longest edge', () => {
    expect(calculateRecipePhotoSize(4032, 3024)).toEqual({ width: 1280, height: 960 });
  });

  it('does not upscale small photos', () => {
    expect(calculateRecipePhotoSize(1200, 900)).toEqual({ width: 1200, height: 900 });
  });

  it('resizes oversized files even when dimensions are unknown yet', () => {
    const file = new File(['x'.repeat(4_000_000)], 'recipe.jpg', { type: 'image/jpeg' });

    expect(shouldResizeRecipePhoto(file)).toBe(true);
  });

  it('uses jpeg for unsupported or empty image mime types', () => {
    expect(getRecipePhotoMimeType('')).toBe('image/jpeg');
    expect(getRecipePhotoMimeType('image/heic')).toBe('image/jpeg');
    expect(getRecipePhotoMimeType('image/png')).toBe('image/png');
  });

  it('uploads recipe photos as jpeg to keep payloads small', () => {
    expect(getRecipePhotoUploadMimeType('image/png')).toBe('image/jpeg');
    expect(getRecipePhotoUploadMimeType('image/webp')).toBe('image/jpeg');
    expect(getRecipePhotoUploadMimeType('image/jpeg')).toBe('image/jpeg');
  });

  it('estimates JSON payload bytes including wrapper fields', () => {
    const payloadBytes = estimateJsonPhotoPayloadBytes('a'.repeat(4_250_000), 'image/jpeg');

    expect(payloadBytes).toBeGreaterThan(4_250_000);
  });
});
