import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

// Mock the supabase client factory
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({}),
      signUp: vi.fn().mockResolvedValue({}),
      signInWithOAuth: vi.fn().mockResolvedValue({}),
    },
  }),
}))

import LoginPage from '@/app/auth/login/page'

describe('LoginPage', () => {
  it('renders form fields and buttons', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in|create account/i })).toBeInTheDocument()
  })

  it('shows validation errors for invalid input', async () => {
    render(<LoginPage />)
    const email = screen.getByLabelText(/email/i)
    const password = screen.getByLabelText(/password/i)
    const submit = screen.getByRole('button', { name: /sign in|create account/i })

    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.change(password, { target: { value: '123' } })
    fireEvent.click(submit)

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument()
    expect(await screen.findByText(/password must be at least 6 characters/i)).toBeInTheDocument()
  })
})
