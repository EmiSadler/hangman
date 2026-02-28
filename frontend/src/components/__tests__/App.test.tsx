import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

const mockGameResponse = {
  game_id: 'test-uuid',
  masked_word: '_ _ _ _ _ _',
  max_wrong: 6,
  wrong_guesses_left: 6,
  guessed_letters: [],
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('shows GameSetup on initial render', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument()
  })

  it('shows score starting at 0 wins / 0 losses', () => {
    render(<App />)
    expect(screen.getByText(/0.*win/i)).toBeInTheDocument()
  })

  it('switches to GameBoard after starting a game', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /easy/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/hangman figure/i)).toBeInTheDocument()
    })
  })

  it('shows error when server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /easy/i }))

    await waitFor(() => {
      expect(screen.getByText(/could not reach server/i)).toBeInTheDocument()
    })
  })

  it('loads persisted score from localStorage on mount', () => {
    localStorage.setItem('hangman_score', JSON.stringify({ wins: 3, losses: 2 }))
    render(<App />)
    expect(screen.getByText(/3 wins/i)).toBeInTheDocument()
    expect(screen.getByText(/2 losses/i)).toBeInTheDocument()
  })

  it('forget me button resets score to zero and removes it from localStorage', async () => {
    localStorage.setItem('hangman_score', JSON.stringify({ wins: 3, losses: 2 }))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /forget me/i }))
    expect(screen.getByText(/0 wins/i)).toBeInTheDocument()
    expect(localStorage.getItem('hangman_score')).toBeNull()
  })

  it('falls back to zero score when localStorage contains invalid JSON', () => {
    localStorage.setItem('hangman_score', 'not-valid-json')
    render(<App />)
    expect(screen.getByText(/0 wins/i)).toBeInTheDocument()
  })
})
