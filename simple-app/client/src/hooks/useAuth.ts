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
    // Do NOT refetch when the window regains focus. The default refetchOnWindowFocus
    // behaviour would fire getMe() whenever the user alt-tabs back to the app.
    // If that background refetch fails (transient error, proxy glitch), the old
    // code would wipe _authToken mid-flow — breaking onboarding API calls that
    // rely on the Bearer fallback (e.g. Railway reverse-proxy strips cookies).
    refetchOnWindowFocus: false,
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
