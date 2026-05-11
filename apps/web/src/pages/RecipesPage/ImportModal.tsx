import React, { useRef, useState } from 'react';
import { useIngestUrl, useIngestPhoto, useIngestSearch, useIngestOpenBrainList, useIngestOpenBrainParse } from '../../hooks/useIngest';
import { RecipeForm } from './RecipeForm';
import type { ImportedRecipe } from '@eat/shared';
import './ImportModal.css';

type Tab = 'url' | 'photo' | 'search' | 'openbrain';

interface ImportModalProps {
  onClose: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImportModal({ onClose }: ImportModalProps) {
  const [tab, setTab] = useState<Tab>('url');
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ base64: string; mimeType: string } | null>(null);

  const urlMutation = useIngestUrl();
  const photoMutation = useIngestPhoto();
  const searchMutation = useIngestSearch();
  const openBrainList = useIngestOpenBrainList(tab === 'openbrain');
  const openBrainParse = useIngestOpenBrainParse();

  // ─── URL tab ──────────────────────────────────────────────────────────────

  const [urlInput, setUrlInput] = useState('');

  async function handleUrlExtract(e: React.FormEvent) {
    e.preventDefault();
    const result = await urlMutation.mutateAsync(urlInput.trim());
    setImported(result);
  }

  // ─── Photo tab ────────────────────────────────────────────────────────────

  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handlePhotoExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!photoFile) return;
    const base64 = await fileToBase64(photoFile);
    const mimeType = photoFile.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    const result = await photoMutation.mutateAsync({ imageBase64: base64, mimeType });
    setPendingPhoto({ base64, mimeType });
    setImported(result);
  }

  // ─── Search tab ───────────────────────────────────────────────────────────

  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<ImportedRecipe[]>([]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const results = await searchMutation.mutateAsync(searchInput.trim());
    setSearchResults(results);
  }

  // ─── If we have an imported recipe, show the confirm form ─────────────────

  if (imported) {
    return (
      <RecipeForm
        mode="add"
        initialData={imported}
        pendingPhoto={pendingPhoto ?? undefined}
        onClose={onClose}
      />
    );
  }

  const isLoading = urlMutation.isPending || photoMutation.isPending || searchMutation.isPending || openBrainParse.isPending;
  const error =
    (urlMutation.error as Error | null)?.message ||
    (photoMutation.error as Error | null)?.message ||
    (searchMutation.error as Error | null)?.message ||
    (openBrainParse.error as Error | null)?.message ||
    null;

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel import-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>Import recipe</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="import-tabs">
          {(['url', 'photo', 'search', 'openbrain'] as Tab[]).map(t => (
            <button
              key={t}
              className={`import-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'url' ? 'URL' : t === 'photo' ? 'Photo' : t === 'search' ? 'Search' : 'OpenBrain'}
            </button>
          ))}
        </div>

        {tab === 'url' && (
          <form className="import-form" onSubmit={handleUrlExtract}>
            <p className="import-hint">Paste the URL of any recipe page. We'll extract the recipe automatically.</p>
            <input
              className="form-input"
              type="url"
              placeholder="https://example.com/recipe"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              required
            />
            {error && <p className="form-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={isLoading || !urlInput.trim()}>
              {isLoading ? 'Extracting…' : 'Extract recipe'}
            </button>
          </form>
        )}

        {tab === 'photo' && (
          <form className="import-form" onSubmit={handlePhotoExtract}>
            <p className="import-hint">Upload a photo of a recipe (from a book, magazine, or screenshot).</p>
            <div
              className="photo-drop-zone"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file?.type.startsWith('image/')) {
                  setPhotoFile(file);
                  setPhotoPreview(URL.createObjectURL(file));
                }
              }}
            >
              {photoPreview ? (
                <img src={photoPreview} className="photo-preview" alt="Recipe preview" />
              ) : (
                <span className="photo-drop-hint">Click or drag image here</span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFilePick} hidden />
            {error && <p className="form-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={isLoading || !photoFile}>
              {isLoading ? 'Extracting…' : 'Extract recipe'}
            </button>
          </form>
        )}

        {tab === 'openbrain' && (
          <div className="import-form">
            <p className="import-hint">Import recipes stored in your OpenBrain account. Already-imported recipes are marked.</p>
            {openBrainList.isLoading && <p className="recipes-status">Loading from OpenBrain…</p>}
            {openBrainList.isError && (
              <p className="form-error">{(openBrainList.error as Error).message}</p>
            )}
            {error && <p className="form-error">{error}</p>}
            {openBrainList.data && openBrainList.data.length === 0 && (
              <p className="recipes-status empty">No recipe thoughts found in OpenBrain.</p>
            )}
            {openBrainList.data && openBrainList.data.length > 0 && (
              <ul className="search-results">
                {openBrainList.data.map(r => (
                  <li key={r.id} className="search-result-item">
                    <div className="search-result-info">
                      <strong>{r.title}</strong>
                      <span>{r.preview || 'No preview'}</span>
                      {r.alreadyImported && <span className="openbrain-badge">Already in eat-thing</span>}
                    </div>
                    <button
                      className="btn-secondary"
                      disabled={isLoading}
                      onClick={async () => {
                        const result = await openBrainParse.mutateAsync(r.id);
                        setImported(result);
                      }}
                    >
                      {openBrainParse.isPending ? 'Importing…' : 'Import'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'search' && (
          <div className="import-form">
            <p className="import-hint">Search 300+ recipes from TheMealDB — free, no sign-up.</p>
            <form onSubmit={handleSearch} className="search-row">
              <input
                className="form-input"
                type="search"
                placeholder="e.g. chicken pasta"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
              <button className="btn-primary" type="submit" disabled={isLoading || !searchInput.trim()}>
                {isLoading ? 'Searching…' : 'Search'}
              </button>
            </form>
            {error && <p className="form-error">{error}</p>}
            {searchResults.length > 0 && (
              <ul className="search-results">
                {searchResults.map(r => (
                  <li key={r.name} className="search-result-item">
                    <div className="search-result-info">
                      <strong>{r.name}</strong>
                      <span>{r.ingredients.length} ingredients</span>
                    </div>
                    <button className="btn-secondary" onClick={() => setImported(r)}>
                      Use this
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searchMutation.isSuccess && searchResults.length === 0 && (
              <p className="recipes-status empty">No results found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
