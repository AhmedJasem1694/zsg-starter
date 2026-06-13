import { useQuery, useMutation } from "@tanstack/react-query";
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
    // code would wipe _authToken mid-flow, breaking onboarding API calls that
    // rely on the Bearer fallback (e.g. Railway reverse-proxy strips cookies).
    refetchOnWindowFocus: false,
  });

  return { user, isLoading, status, isAuthed: !!user };
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiLogout(),
    onSuccess: () => {
      // Clear all client-side storage so no cached auth state survives.
      try { sessionStorage.clear(); } catch { /* ignore */ }
      try { localStorage.clear(); } catch { /* ignore */ }

      // Attempt to clear any readable cookies (httpOnly cookies can't be
      // cleared from JS, but belt-and-suspenders for any non-httpOnly ones).
      try {
        document.cookie.split(";").forEach((c) => {
          const name = c.split("=")[0].trim();
          // Clear on root path and on the production domain
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.zanelegal.ai`;
        });
      } catch { /* ignore */ }

      // Hard redirect, forces a full page reload which flushes ALL in-memory
      // React Query cache and React state. Do not use navigate() here:
      // a soft nav leaves the stale `user` object in memory long enough for
      // route guards to fire and redirect back to /dashboard.
      window.location.href = "/login";
    },
    onError: () => {
      // Even if the server call fails, still clear client state and redirect.
      try { sessionStorage.clear(); } catch { /* ignore */ }
      try { localStorage.clear(); } catch { /* ignore */ }
      window.location.href = "/login";
    },
  });
}
