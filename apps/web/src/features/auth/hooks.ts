import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { authApi } from './api'
import type { AuthUser, LoginPayload } from './types'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

/** Source of truth for the session: the /me query (null = guest). */
export function useAuth() {
  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.me,
    staleTime: 5 * 60_000,
  })

  const user = query.data ?? null

  return {
    user,
    isLoading: query.isPending,
    isAuthenticated: user !== null,
    can: (permission: string) => user?.permissions.includes(permission) ?? false,
  }
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(authKeys.me, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      // Drop every cached query of the previous user, then mark as guest.
      queryClient.clear()
      queryClient.setQueryData(authKeys.me, null)
    },
  })
}
