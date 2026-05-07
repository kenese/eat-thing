import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TopNav } from "./TopNav";
import { BrowserRouter } from "react-router-dom";

describe("TopNav Component", () => {
    it("renders the brand name and links", () => {
        render(
            <BrowserRouter>
                <TopNav />
            </BrowserRouter>
        );

        expect(screen.getByText("Starter App")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Route 1" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Route 2" })).toBeInTheDocument();
    });
});
