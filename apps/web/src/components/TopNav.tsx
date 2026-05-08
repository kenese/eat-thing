import React from "react";
import { NavLink } from "react-router-dom";
import "./TopNav.css";

const NAV_ITEMS = [
    { label: 'Inventory', path: '/inventory' },
    { label: 'Recipes', path: '/recipes' },
    { label: 'Plan', path: '/plan' },
    { label: 'List', path: '/list' },
];

export const TopNav: React.FC = () => {
    return (
        <header className="topnav">
            <div className="topnav-brand">eat-thing</div>
            <nav className="topnav-links">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `topnav-link ${isActive ? "topnav-link--active" : ""}`
                        }
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </header>
    );
};
