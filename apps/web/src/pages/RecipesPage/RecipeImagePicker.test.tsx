import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecipeImagePicker, blobToBase64 } from './RecipeImagePicker';

describe('RecipeImagePicker', () => {
  it('shows placeholder when no photo', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    expect(screen.getByText('add photo')).toBeInTheDocument();
  });

  it('shows image when photo is provided', () => {
    render(<RecipeImagePicker photoBase64="abc123" photoMimeType="image/jpeg" onChange={vi.fn()} />);
    const img = screen.getByAltText('Recipe');
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,abc123');
  });

  it('opens option menu on click when no photo', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('add photo').closest('.recipe-image-box')!);
    expect(screen.getByText('paste from clipboard')).toBeInTheDocument();
    expect(screen.getByText('choose file')).toBeInTheDocument();
    expect(screen.getByText('enter URL')).toBeInTheDocument();
  });

  it('shows Remove option when photo is present', () => {
    render(<RecipeImagePicker photoBase64="abc" photoMimeType="image/jpeg" onChange={vi.fn()} />);
    fireEvent.click(screen.getByAltText('Recipe').closest('.recipe-image-box')!);
    expect(screen.getByText('remove photo')).toBeInTheDocument();
  });

  it('calls onChange(null, null) when Remove photo clicked', () => {
    const onChange = vi.fn();
    render(<RecipeImagePicker photoBase64="abc" photoMimeType="image/jpeg" onChange={onChange} />);
    fireEvent.click(screen.getByAltText('Recipe').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('remove photo'));
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('reveals URL input after clicking Enter URL', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('add photo').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('enter URL'));
    expect(screen.getByPlaceholderText('recipe page URL or direct image URL')).toBeInTheDocument();
  });

  it('closes menu when Cancel is clicked', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('add photo').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('cancel'));
    expect(screen.queryByText('paste from clipboard')).not.toBeInTheDocument();
  });
});

describe('Enter URL — server-side image extraction', () => {
  it('calls /api/ingest/hero-image and returns base64 to onChange', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ base64: 'abc123', mimeType: 'image/jpeg' }),
    } as unknown as Response);
    globalThis.fetch = fetchMock as typeof fetch;

    const onChange = vi.fn();
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={onChange} />);

    fireEvent.click(screen.getByText('add photo').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('enter URL'));

    const input = screen.getByPlaceholderText('recipe page URL or direct image URL');
    fireEvent.change(input, { target: { value: 'https://example.com/recipe' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ingest/hero-image',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(onChange).toHaveBeenCalledWith('abc123', 'image/jpeg');
    });

    globalThis.fetch = originalFetch;
  });

  it('shows error message when server returns error', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'No image found on this page.' }),
    } as unknown as Response);
    globalThis.fetch = fetchMock as typeof fetch;

    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('add photo').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('enter URL'));

    const input = screen.getByPlaceholderText('recipe page URL or direct image URL');
    fireEvent.change(input, { target: { value: 'https://example.com/recipe' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('No image found on this page.')).toBeInTheDocument();
    });

    globalThis.fetch = originalFetch;
  });
});

describe('blobToBase64', () => {
  it('converts a blob to a base64 string without the data-URI prefix', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const result = await blobToBase64(blob);
    expect(result).toBe('aGVsbG8=');
  });
});
