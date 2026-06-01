import React, { useRef, useState } from 'react';

interface RecipeImagePickerProps {
  photoBase64: string | null;
  photoMimeType: string | null;
  onChange: (base64: string | null, mimeType: string | null) => void;
}

type MenuState = 'closed' | 'options' | 'url-input' | 'loading';

export function RecipeImagePicker({ photoBase64, photoMimeType, onChange }: RecipeImagePickerProps) {
  const [menuState, setMenuState] = useState<MenuState>('closed');
  const [urlInput, setUrlInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPhoto = !!photoBase64;

  function openMenu() {
    setMenuState('options');
    setErrorMsg('');
  }

  function closeMenu() {
    setMenuState('closed');
    setUrlInput('');
    setErrorMsg('');
  }

  async function handlePaste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const base64 = await blobToBase64(blob);
          onChange(base64, imageType);
          closeMenu();
          return;
        }
      }
      setErrorMsg('No image found on clipboard.');
    } catch {
      setErrorMsg('Clipboard access denied.');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const mimeType = dataUrl.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
      const base64 = dataUrl.split(',')[1];
      onChange(base64, mimeType);
      closeMenu();
    };
    reader.readAsDataURL(file);
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    setMenuState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/ingest/hero-image', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const { base64, mimeType } = await res.json() as { base64: string; mimeType: string };
      onChange(base64, mimeType);
      closeMenu();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load image.');
      setMenuState('url-input');
    }
  }

  return (
    <div
      className="recipe-image-box"
      onClick={menuState === 'closed' ? openMenu : undefined}
    >
      {hasPhoto ? (
        <img src={`data:${photoMimeType};base64,${photoBase64}`} alt="Recipe" />
      ) : (
        <div className="recipe-image-placeholder">
          <span className="recipe-image-placeholder-icon">+</span>
          <span className="recipe-image-placeholder-label">add photo</span>
        </div>
      )}

      {menuState !== 'closed' && (
        <div className="recipe-image-menu" onClick={e => e.stopPropagation()}>
          {menuState === 'options' && (
            <>
              {hasPhoto && (
                <button type="button" className="recipe-image-menu-btn" onClick={() => { onChange(null, null); closeMenu(); }}>
                  remove photo
                </button>
              )}
              <button type="button" className="recipe-image-menu-btn" onClick={handlePaste}>
                paste from clipboard
              </button>
              <button type="button" className="recipe-image-menu-btn" onClick={() => fileInputRef.current?.click()}>
                choose file
              </button>
              <button type="button" className="recipe-image-menu-btn" onClick={() => setMenuState('url-input')}>
                enter URL
              </button>
              <button type="button" className="recipe-image-menu-btn" onClick={closeMenu}>
                cancel
              </button>
              {errorMsg && <p className="recipe-image-error">{errorMsg}</p>}
            </>
          )}
          {(menuState === 'url-input' || menuState === 'loading') && (
            <form className="recipe-image-url-form" onSubmit={handleUrlSubmit}>
              <input
                className="recipe-image-url-input"
                type="url"
                placeholder="recipe page URL or direct image URL"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                autoFocus
                disabled={menuState === 'loading'}
              />
              <button type="submit" className="recipe-image-menu-btn" disabled={menuState === 'loading'}>
                {menuState === 'loading' ? 'loading…' : 'load image'}
              </button>
              <button type="button" className="recipe-image-menu-btn" onClick={() => setMenuState('options')}>
                back
              </button>
              {errorMsg && <p className="recipe-image-error">{errorMsg}</p>}
            </form>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        onClick={e => { (e.target as HTMLInputElement).value = ''; }}
      />
    </div>
  );
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
