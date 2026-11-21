import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { useLogout } from './hooks'

/** Logs out, clears cached data and returns to /login with a toast. */
export function useSignOut() {
  const logout = useLogout()
  const navigate = useNavigate()

  return () =>
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success('Sesión cerrada. ¡Hasta pronto!')
        navigate('/login', { replace: true })
      },
    })
}
