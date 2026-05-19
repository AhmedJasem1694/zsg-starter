import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

interface AuthUser {
  userId: string;
  email: string;
}

async function fetchMe(): Promise<AuthUser> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json() as Promise<AuthUser>;
}

export function useAuth() {
  const { data: user, isLoading, status } = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60_000,
  });

  return { user, isLoading, status, isAuthed: !!user };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      navigate("/", { replace: true });
      queryClient.clear();
    },
  });
}
