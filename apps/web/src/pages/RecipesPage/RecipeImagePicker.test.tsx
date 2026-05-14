import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecipeImagePicker, blobToBase64 } from './RecipeImagePicker';

describe('RecipeImagePicker', () => {
  it('shows placeholder when no photo', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    expect(screen.getByText('Add photo')).toBeInTheDocument();
  });

  it('shows image when photo is provided', () => {
    render(<RecipeImagePicker photoBase64="abc123" photoMimeType="image/jpeg" onChange={vi.fn()} />);
    const img = screen.getByAltText('Recipe');
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,abc123');
  });

  it('opens option menu on click when no photo', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Add photo').closest('.recipe-image-box')!);
    expect(screen.getByText('Paste from clipboard')).toBeInTheDocument();
    expect(screen.getByText('Choose file')).toBeInTheDocument();
    expect(screen.getByText('Enter URL')).toBeInTheDocument();
  });

  it('shows Remove option when photo is present', () => {
    render(<RecipeImagePicker photoBase64="abc" photoMimeType="image/jpeg" onChange={vi.fn()} />);
    fireEvent.click(screen.getByAltText('Recipe').closest('.recipe-image-box')!);
    expect(screen.getByText('Remove photo')).toBeInTheDocument();
  });

  it('calls onChange(null, null) when Remove photo clicked', () => {
    const onChange = vi.fn();
    render(<RecipeImagePicker photoBase64="abc" photoMimeType="image/jpeg" onChange={onChange} />);
    fireEvent.click(screen.getByAltText('Recipe').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('Remove photo'));
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('reveals URL input after clicking Enter URL', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Add photo').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('Enter URL'));
    expect(screen.getByPlaceholderText('https://example.com/image.jpg')).toBeInTheDocument();
  });

  it('closes menu when Cancel is clicked', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Add photo').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Paste from clipboard')).not.toBeInTheDocument();
  });
});

describe('blobToBase64', () => {
  it('converts a blob to a base64 string without the data-URI prefix', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const result = await blobToBase64(blob);
    expect(result).toBe('aGVsbG8=');
  });
});
