import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Counter } from "./Counter";

describe("Counter Component", () => {
    it("renders the current value", () => {
        render(
            <Counter
                value={42}
                onIncrement={vi.fn()}
                onReset={vi.fn()}
            />
        );

        expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("calls onIncrement when Increment button is clicked", () => {
        const handleIncrement = vi.fn();
        render(
            <Counter
                value={0}
                onIncrement={handleIncrement}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByText("Increment"));
        expect(handleIncrement).toHaveBeenCalledTimes(1);
    });

    it("calls onReset when Reset button is clicked", () => {
        const handleReset = vi.fn();
        render(
            <Counter
                value={10}
                onIncrement={vi.fn()}
                onReset={handleReset}
            />
        );

        fireEvent.click(screen.getByText("Reset"));
        expect(handleReset).toHaveBeenCalledTimes(1);
    });
});
