import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import { useSession } from './hooks/useSession';
import { LoginPage } from './pages/LoginPage';
import { InventoryPage } from './pages/InventoryPage';
import './index.css';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="page-centered">
      <h2>{title}</h2>
      <p className="page-placeholder">Coming soon.</p>
    </div>
  );
}

function AppShell() {
  const { data: session, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="page-centered">
        <p className="page-placeholder">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <>
      <TopNav />
      <div className="app-body">
        <Routes>
          <Route path="/" element={<Navigate to="/inventory" replace />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/recipes" element={<PlaceholderPage title="Recipes" />} />
          <Route path="/plan" element={<PlaceholderPage title="Meal Plan" />} />
          <Route path="/list" element={<PlaceholderPage title="Shopping List" />} />
          <Route path="*" element={<Navigate to="/inventory" replace />} />
        </Routes>
      </div>
    </>
  );
}

const App: React.FC = () => (
  <BrowserRouter>
    <div className="app">
      <AppShell />
    </div>
  </BrowserRouter>
);

export default App;
