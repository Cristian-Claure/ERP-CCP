import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { authKeys } from '@/features/auth/hooks'
import { setUnauthorizedHandler } from '@/lib/api'

import { CommandPalette } from './CommandPalette'
import { MobileSidebar } from './MobileSidebar'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** Routes rendered edge to edge, without the page container. */
const FULL_BLEED = ['/atlas']

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Any 401 while inside the app means the session expired.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.setQueryData(authKeys.me, null)
      toast.error('Tu sesión expiró. Vuelve a iniciar sesión.')
      navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate, queryClient])

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <MobileSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="relative flex-1">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(99_102_241/0.08),transparent)]"
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={
                // Immersive pages (CCP Atlas) use the whole area below the top bar.
                FULL_BLEED.some((p) => location.pathname.startsWith(p))
                  ? 'relative h-[calc(100dvh-4rem)] w-full overflow-hidden'
                  : 'relative mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8'
              }
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
