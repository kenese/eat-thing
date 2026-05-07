import React from "react";
import { NavLink } from "react-router-dom";
import "./TopNav.css";

const NAV_ITEMS = [
    { label: "Route 1", path: "/" },
    { label: "Route 2", path: "/route2" },
];

export const TopNav: React.FC = () => {
    return (
        <header className="topnav">
            <div className="topnav-brand">Starter App</div>
            <nav className="topnav-links">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `topnav-link ${isActive ? "topnav-link--active" : ""}`
                        }
                        end={item.path === "/"}
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </header>
    );
};
