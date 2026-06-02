import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import { useSession } from './hooks/useSession';
import { LoginPage } from './pages/LoginPage';
import { InventoryPage } from './pages/InventoryPage';
import { RecipesPage } from './pages/RecipesPage';
import { PlanPage } from './pages/PlanPage';
import { ShoppingListPage } from './pages/ShoppingListPage/ShoppingListPage';
import { HomePage } from './pages/HomePage';
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
          <Route path="/" element={<HomePage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/list" element={<ShoppingListPage />} />
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
