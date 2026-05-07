import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TopNav } from "./components/TopNav";
import { Counter } from "./components/Counter";
import { useCounter } from "./hooks/useCounter";
import "./index.css";

const CounterPage: React.FC = () => {
    const { data, isLoading, isError, updateCounter } = useCounter();

    if (isLoading) return <div className="page-centered">Loading...</div>;
    if (isError) return <div className="page-centered">Error fetching data</div>;

    return (
        <div className="page-centered" style={{ paddingTop: '2rem' }}>
            <Counter
                value={data?.counter || 0}
                onIncrement={() => updateCounter({ counter: (data?.counter || 0) + 1 })}
                onReset={() => updateCounter({ counter: 0 })}
            />
        </div>
    );
};

const Route2Page: React.FC = () => {
    return (
        <div className="page-centered">
            <h2>Route 2</h2>
            <p className="page-placeholder">This page is a placeholder.</p>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <div className="app">
                <TopNav />
                <div className="app-body">
                    <Routes>
                        <Route path="/" element={<CounterPage />} />
                        <Route path="/route2" element={<Route2Page />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </div>
        </BrowserRouter>
    );
};

export default App;
