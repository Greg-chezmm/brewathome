import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: unknown) => void),
  signOut: vi.fn(async () => ({ error: null })),
}))

vi.mock('@/lib/supabase/client', () => ({
  authRedirect: null,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        auth.listener = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signOut: auth.signOut,
    },
  },
}))

const { AuthProvider, useAuth } = await import('@/lib/auth/AuthProvider')

function SignOutButton() {
  const { signOut, loading } = useAuth()
  return loading ? null : <button onClick={() => void signOut()}>quitter</button>
}

function setup() {
  const client = new QueryClient()
  client.setQueryData(['brewfather-account'], { userId: 'bf', apiKey: 'secret-key' })
  client.setQueryData(['batches'], [{ id: 'b1' }])
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return client
}

describe('AuthProvider — cache des données à la déconnexion', () => {
  beforeEach(() => auth.signOut.mockClear())

  it('vide le cache (clé Brewfather comprise) quand on se déconnecte', async () => {
    const client = setup()
    const button = await screen.findByRole('button', { name: 'quitter' })
    act(() => button.click())
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled())
    await waitFor(() => expect(client.getQueryData(['brewfather-account'])).toBeUndefined())
    expect(client.getQueryData(['batches'])).toBeUndefined()
  })

  it('le vide aussi quand la session se termine ailleurs (autre onglet, expiration)', async () => {
    const client = setup()
    await screen.findByRole('button', { name: 'quitter' })
    act(() => auth.listener!('SIGNED_OUT', null))
    expect(client.getQueryData(['brewfather-account'])).toBeUndefined()
  })

  it('ne touche pas au cache pour un simple renouvellement de jeton', async () => {
    const client = setup()
    await screen.findByRole('button', { name: 'quitter' })
    act(() => auth.listener!('TOKEN_REFRESHED', { user: { id: 'u1' } }))
    expect(client.getQueryData(['batches'])).toEqual([{ id: 'b1' }])
  })
})
