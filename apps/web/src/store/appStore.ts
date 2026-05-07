import { create } from "zustand";

interface StoreState {
    theme: "light" | "dark";
    toggleTheme: () => void;
}

export const useAppStore = create<StoreState>((set) => ({
    theme: "dark",
    toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
}));
