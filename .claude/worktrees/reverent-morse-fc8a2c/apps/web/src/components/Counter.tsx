import React from "react";
import "./Counter.css";

interface CounterProps {
    value: number;
    onIncrement: () => void;
    onReset: () => void;
}

export const Counter: React.FC<CounterProps> = ({
    value,
    onIncrement,
    onReset,
}) => {
    return (
        <div className="counter">
            <div className="counter-display">
                <span className="counter-value">{value}</span>
            </div>
            <div className="counter-actions">
                <button className="counter-btn counter-btn--primary" onClick={onIncrement}>
                    Increment
                </button>
                <button className="counter-btn counter-btn--secondary" onClick={onReset}>
                    Reset
                </button>
            </div>
        </div>
    );
};
