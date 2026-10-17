import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { authErrorMessage, readAuthRedirect, redirectNotice } from '@/lib/auth/errors'
import type { SignUpResult } from '@/lib/auth/AuthProvider'
import { Login } from '@/pages/auth/Login'

const auth = vi.hoisted(() => ({
  redirectNotice: null as string | null,
  signUpResult: { error: null, needsConfirmation: true, alreadyRegistered: false } as SignUpResult,
}))
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    session: null,
    redirectNotice: auth.redirectNotice,
    signUp: async () => auth.signUpResult,
    signIn: async () => ({ error: null }),
    signInWithGoogle: async () => ({ error: null }),
    sendMagicLink: async () => ({ error: null }),
  }),
}))

function signUp(email: string) {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: "Pas encore de compte ? S'inscrire" }))
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))
}

describe('Inscription par e-mail', () => {
  it('explique la confirmation par e-mail puis propose de se connecter', async () => {
    signUp('brasseuse@example.com')
    expect(await screen.findByText(/Un e-mail de confirmation a été envoyé à brasseuse@example.com/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('adresse déjà inscrite : invite à se connecter au lieu de dire « compte créé »', async () => {
    auth.signUpResult = { error: null, needsConfirmation: false, alreadyRegistered: true }
    signUp('deja@example.com')
    expect(await screen.findByText(/Un compte existe déjà avec cette adresse/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('lien de confirmation ouvert dans un autre navigateur : la page de connexion l’explique', () => {
    auth.redirectNotice = redirectNotice({ hadCode: true, errorCode: null }, false)
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Adresse e-mail confirmée/)).toBeInTheDocument()
  })
})

describe('Messages d’authentification', () => {
  it('traduit les erreurs Supabase courantes', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('E-mail ou mot de passe incorrect.')
    expect(authErrorMessage({ message: 'Email not confirmed' })).toMatch(/pas encore confirmée/)
    expect(authErrorMessage({ code: 'inconnu', message: 'Something else' })).toBe('Something else')
  })

  it('lit le retour d’un lien e-mail (code PKCE ou erreur)', () => {
    expect(readAuthRedirect({ search: '?code=abc', hash: '' })).toEqual({ hadCode: true, errorCode: null })
    expect(readAuthRedirect({ search: '?error=access_denied&error_code=otp_expired', hash: '' }).errorCode).toBe('otp_expired')
    expect(redirectNotice({ hadCode: false, errorCode: 'otp_expired' }, false)).toMatch(/expiré/)
    expect(redirectNotice({ hadCode: true, errorCode: null }, true)).toBeNull()
  })
})
