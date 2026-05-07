import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCounter } from "./useCounter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

describe("useCounter Hook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("fetches the initial counter state successfully", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ counter: 10 }),
        });

        const { result } = renderHook(() => useCounter(), {
            wrapper: createWrapper(),
        });

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual({ counter: 10 });
        expect(mockFetch).toHaveBeenCalledWith("http://localhost:3001/api/counter");
    });

    it("handles fetch errors", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
        });

        const { result } = renderHook(() => useCounter(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    it("updates the counter via mutation", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ counter: 0 }),
        }); // Initial fetch
        
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ counter: 5 }),
        }); // Mutation response

        const { result } = renderHook(() => useCounter(), {
            wrapper: createWrapper(),
        });

        // wait for initial load
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Fire mutation
        result.current.updateCounter({ counter: 5 });

        await waitFor(() => {
            expect(result.current.data).toEqual({ counter: 5 });
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenLastCalledWith("http://localhost:3001/api/counter", expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ counter: 5 })
        }));
    });
});
