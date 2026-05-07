import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppState } from "@starter/shared";

const API_URL = "http://localhost:3001/api";

export function useCounter() {
    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery<AppState>({
        queryKey: ["counter"],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/counter`);
            if (!res.ok) throw new Error("Failed to fetch counter");
            return res.json();
        },
    });

    const mutation = useMutation({
        mutationFn: async (update: Partial<AppState>) => {
            const res = await fetch(`${API_URL}/counter`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(update),
            });
            if (!res.ok) throw new Error("Failed to update counter");
            return res.json();
        },
        onSuccess: (newData) => {
            queryClient.setQueryData(["counter"], newData);
        },
    });

    return {
        data,
        isLoading,
        isError,
        updateCounter: mutation.mutate,
    };
}
