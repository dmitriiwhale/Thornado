import { useQuery, useQueryClient } from '@tanstack/react-query'

async function fetchSession() {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('session request failed')
  return res.json()
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
    staleTime: 60_000,
  })
}

export function useInvalidateSession() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['session'] })
}
