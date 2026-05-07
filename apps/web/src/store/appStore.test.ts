import { describe, it, expect } from "vitest";
import { useAppStore } from "./appStore";

describe("App Store (Zustand)", () => {
    it("should initialize with dark theme", () => {
        const state = useAppStore.getState();
        expect(state.theme).toBe("dark");
    });

    it("should toggle the theme", () => {
        const { toggleTheme } = useAppStore.getState();
        
        // Toggle once to light
        toggleTheme();
        expect(useAppStore.getState().theme).toBe("light");

        // Toggle back to dark
        toggleTheme();
        expect(useAppStore.getState().theme).toBe("dark");
    });
});
