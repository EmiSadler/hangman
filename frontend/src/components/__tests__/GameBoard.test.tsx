import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

  it('renders Solve Puzzle button when game is in progress', () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.getByRole('button', { name: /solve puzzle/i })).toBeInTheDocument()
  })

  it('shows solve input and hides keyboard when Solve Puzzle is clicked', async () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /solve puzzle/i }))
    expect(screen.getByPlaceholderText(/type the word/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A' })).not.toBeInTheDocument()
  })

  it('returns to keyboard view when Cancel is clicked', async () => {
    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /solve puzzle/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/type the word/i)).not.toBeInTheDocument()
  })

  it('calls /solve endpoint and transitions to won on correct guess', async () => {
    const onGameEnd = vi.fn()
    const solveResponse = {
      correct: true,
      masked_word: 'c a t',
      wrong_guesses_left: 6,
      guessed_letters: [],
      status: 'won',
      word: null,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => solveResponse,
    }))

    render(<GameBoard initialState={mockInitialState} onGameEnd={onGameEnd} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /solve puzzle/i }))
    await userEvent.type(screen.getByPlaceholderText(/type the word/i), 'cat')
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(onGameEnd).toHaveBeenCalledWith('won')
    })
  })

  it('triggers a guess when a letter key is pressed', async () => {
    const guessResponse = {
      correct: false,
      masked_word: '_ _ _',
      wrong_guesses_left: 5,
      guessed_letters: ['a'],
      status: 'in_progress',
      word: null,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => guessResponse,
    }))

    render(<GameBoard initialState={mockInitialState} onGameEnd={vi.fn()} onPlayAgain={vi.fn()} />)

    fireEvent.keyDown(window, { key: 'a' })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/game/test-id/guess`,
        expect.objectContaining({
          body: JSON.stringify({ letter: 'a' }),
        })
      )
    })
  })
})
