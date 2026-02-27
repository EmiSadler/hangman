import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GameBoard from '../GameBoard'

const mockInitialState = {
  gameId: 'test-id',
  maskedWord: '_ _ _',
  maxWrong: 6,
  wrongGuessesLeft: 6,
  guessedLetters: [],
  status: 'in_progress' as const,
}

describe('GameBoard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the hangman svg', () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.getByLabelText(/hangman figure/i)).toBeInTheDocument()
  })

  it('renders the word display', () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.getAllByText('_').length).toBeGreaterThan(0)
  })

  it('renders the keyboard', () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
  })

  it('calls onGameEnd with won when game is won', async () => {
    const onGameEnd = vi.fn()
    const wonResponse = {
      masked_word: 'c a t',
      correct: true,
      wrong_guesses_left: 6,
      guessed_letters: ['c', 'a', 't'],
      status: 'won',
      word: null,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => wonResponse,
    }))

    render(<GameBoard initialState={mockInitialState} onGameEnd={onGameEnd} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))

    await waitFor(() => {
      expect(onGameEnd).toHaveBeenCalledWith('won')
    })
  })

  it('shows error message on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))

    await waitFor(() => {
      expect(screen.getByText(/could not reach server/i)).toBeInTheDocument()
    })
  })
})
