import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GameBoard from '../GameBoard'
import type { GameState } from '../../types'

const mockGame: GameState = {
  gameId: 'test-id',
  word: 'cat',
  maskedWord: '_ _ _',
  category: 'animals',
  firstLetter: 'c',
  guessedLetters: [],
  status: 'in_progress',
}

describe('GameBoard', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders WordDisplay', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.getAllByText('_').length).toBeGreaterThan(0)
  })

  it('renders Keyboard', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
  })

  it('does NOT render a hangman figure', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.queryByLabelText(/hangman figure/i)).not.toBeInTheDocument()
  })

  it('does NOT render a Solve Puzzle button', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /solve puzzle/i })).not.toBeInTheDocument()
  })

  it('calls onGuessResult with letter, correct=true, occurrences on correct guess', async () => {
    const correctResponse = {
      masked_word: '_ a _', correct: true,
      guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => correctResponse }))
    const onGuessResult = vi.fn()
    render(<GameBoard initialState={mockGame} onGuessResult={onGuessResult} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(onGuessResult).toHaveBeenCalledWith('a', true, 1)
  })

  it('calls onGuessResult with correct=false, occurrences=0 on wrong guess', async () => {
    const wrongResponse = {
      masked_word: '_ _ _', correct: false,
      guessed_letters: ['z'], status: 'in_progress', occurrences: 0,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wrongResponse }))
    const onGuessResult = vi.fn()
    render(<GameBoard initialState={mockGame} onGuessResult={onGuessResult} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    expect(onGuessResult).toHaveBeenCalledWith('z', false, 0)
  })

  it('calls onWordSolved when backend returns status won', async () => {
    const wonResponse = {
      masked_word: 'c a t', correct: true,
      guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wonResponse }))
    const onWordSolved = vi.fn()
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={onWordSolved} onPlayAgain={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    expect(onWordSolved).toHaveBeenCalledOnce()
  })

  it('when combatOver=true, reveals full word and shows continue button', () => {
    render(<GameBoard initialState={mockGame} onGuessResult={vi.fn()} onWordSolved={vi.fn()} onPlayAgain={vi.fn()} combatOver={true} playAgainLabel="Continue" />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    // Full word "cat" should be visible
    expect(screen.getByText('c')).toBeInTheDocument()
    expect(screen.getByText('t')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A' })).not.toBeInTheDocument()
  })
})
