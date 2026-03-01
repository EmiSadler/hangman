import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CombatView from '../CombatView'
import { buildRun } from '../../runState'
import type { GameState, RunState } from '../../types'

const mockGame: GameState = {
  gameId: 'test-id',
  maskedWord: '_ _ _',
  word: 'cat',
  category: 'general',
  firstLetter: 'c',
  guessedLetters: [],
  status: 'in_progress',
}

function enemyRoom() {
  return { type: 'enemy' as const, completed: false, gameId: null }
}

describe('CombatView', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders HP and coins', () => {
    const run = { ...buildRun('berserker'), hp: 14, coins: 10 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByText(/14 \/ 50/)).toBeInTheDocument()
    expect(screen.getByText(/10/)).toBeInTheDocument()
  })

  it('does NOT render a hangman figure', () => {
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.queryByLabelText(/hangman figure/i)).not.toBeInTheDocument()
  })

  it('calls onCombatEnd with reduced HP after lost word (1 wrong guess = 2 damage)', async () => {
    // 1 wrong guess: damage=2; starting hp=14 → hp=12
    const lostResponse = {
      masked_word: '_ _ _', correct: false,
      guessed_letters: ['a'],
      status: 'lost',
      occurrences: 0,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => lostResponse }))

    const onCombatEnd = vi.fn()
    const run: RunState = { ...buildRun('berserker'), hp: 14, coins: 5 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)

    await userEvent.click(screen.getByRole('button', { name: 'A' }))

    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // 1 wrong × 2 damage = 2; 14 - 2 = 12 HP; lost → 0 coins earned
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ hp: 12, coins: 5 }))
  })

  it('calls onCombatEnd with coins earned after won enemy', async () => {
    const wonResponse = {
      masked_word: 'c a t', correct: true,
      guessed_letters: ['c', 'a', 't'],
      status: 'won',
      occurrences: 1,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wonResponse }))

    const onCombatEnd = vi.fn()
    const run: RunState = { ...buildRun('berserker'), hp: 20, coins: 0 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)

    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // 0 wrong guesses → 0 damage; enemy win → +5 coins
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ hp: 20, coins: 5 }))
  })

  it('shows Continue button when word is lost but HP remains', async () => {
    // 1 wrong guess: damage=2; starting hp=14 → hp=12 (alive)
    const lostResponse = {
      masked_word: '_ _ _', correct: false,
      guessed_letters: ['a'],
      status: 'lost',
      occurrences: 0,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => lostResponse }))

    const run: RunState = { ...buildRun('berserker'), hp: 14, coins: 5 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))

    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /play again/i })).not.toBeInTheDocument()
  })

  it('shows Play Again button when HP hits 0', async () => {
    // 1 wrong guess: damage=2; starting hp=2 → hp=0 (dead)
    const lostResponse = {
      masked_word: '_ _ _', correct: false,
      guessed_letters: ['a'],
      status: 'lost',
      occurrences: 0,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => lostResponse }))

    const run: RunState = { ...buildRun('berserker'), hp: 2, coins: 5 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))

    await waitFor(() => screen.getByRole('button', { name: /play again/i }))
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument()
  })

  it('boss win earns 20 coins', async () => {
    const wonResponse = {
      masked_word: 'c a t', correct: true,
      guessed_letters: ['c', 'a', 't'],
      status: 'won',
      occurrences: 1,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wonResponse }))

    const onCombatEnd = vi.fn()
    const bossRoom = { type: 'boss' as const, completed: false, gameId: null }
    render(<CombatView run={buildRun('berserker')} room={bossRoom} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)

    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 20 }))
  })
})
