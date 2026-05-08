import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import './index.css';

const HomePage: React.FC = () => (
  <div className="page-centered" style={{ paddingTop: '2rem' }}>
    <h1>eat-thing</h1>
    <p className="page-placeholder">Household food management — coming soon.</p>
  </div>
);

const App: React.FC = () => (
  <BrowserRouter>
    <div className="app">
      <TopNav />
      <div className="app-body">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  </BrowserRouter>
);

export default App;
