import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getMe, logout as apiLogout } from "../lib/api";

interface AuthUser {
  userId: string;
  email: string;
}

async function fetchMe(): Promise<AuthUser> {
  // Use the typed api helper so the Authorization: Bearer header is included
  return getMe();
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
    mutationFn: () => apiLogout(),
    onSuccess: () => {
      navigate("/", { replace: true });
      queryClient.clear();
    },
  });
}
