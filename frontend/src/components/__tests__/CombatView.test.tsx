import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CombatView from '../CombatView'
import { buildRun } from '../../runState'
import type { GameState, RunState } from '../../types'

const mockGame: GameState = {
  gameId: 'test-id',
  word: 'cat',
  maskedWord: '_ _ _',
  category: 'animals',
  firstLetter: 'c',
  guessedLetters: [],
  status: 'in_progress',
}

function enemyRoom() {
  return { type: 'enemy' as const, completed: false, gameId: null }
}

function mockGuessResponse(overrides = {}) {
  return {
    masked_word: '_ _ _', correct: false,
    guessed_letters: ['z'], status: 'in_progress', occurrences: 0,
    ...overrides,
  }
}

describe('CombatView', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders player HP and coins', () => {
    const run = { ...buildRun('berserker'), hp: 14, coins: 10 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByText(/14 \/ 50/)).toBeInTheDocument()
    expect(screen.getByText(/10/)).toBeInTheDocument()
  })

  it('renders enemy HP bar', () => {
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // mockGame word='cat' (3 letters), floor=1 → enemy HP = 3×1×2 = 6
    expect(screen.getByText(/6 \/ 6/)).toBeInTheDocument()
  })

  it('reduces enemy HP on correct guess', async () => {
    // word='cat', 'a' appears once → 2 damage (base). Enemy HP 6→4
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: '_ a _', correct: true, guessed_letters: ['a'], occurrences: 1 }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/4 \/ 6/)).toBeInTheDocument())
  })

  it('reduces player HP on wrong guess', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    const run: RunState = { ...buildRun('berserker'), hp: 50 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => expect(screen.getByText(/48 \/ 50/)).toBeInTheDocument())
  })

  it('shows Continue button when word solved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: 'c a t', correct: true, guessed_letters: ['c','a','t'], status: 'won', occurrences: 1 }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
  })

  it('calls onCombatEnd with updated run when Continue clicked after win', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: 'c a t', correct: true, guessed_letters: ['c','a','t'], status: 'won', occurrences: 1 }),
    }))
    const onCombatEnd = vi.fn()
    const run: RunState = { ...buildRun('berserker'), hp: 50, coins: 0 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 5 }))
  })

  it('shows Play Again when player HP hits 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    const run: RunState = { ...buildRun('berserker'), hp: 2 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => screen.getByRole('button', { name: /play again/i }))
  })

  it('enemy killed early: reveals all letters and shows Continue', async () => {
    const mockGameLowHp: GameState = { ...mockGame, word: 'hi', maskedWord: '_ _' }
    // 'hi': 2 letters, floor 1 → enemy HP = 2×1×2 = 4
    // Guess 'h' (1 occ → 2 dmg → HP 4→2), guess 'i' (1 occ → 2 dmg → HP 2→0) → enemy dead
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ masked_word: 'h _', correct: true, guessed_letters: ['h'], status: 'in_progress', occurrences: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ masked_word: 'h i', correct: true, guessed_letters: ['h','i'], status: 'won', occurrences: 1 }) })
    )
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGameLowHp} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'H' }))
    await userEvent.click(screen.getByRole('button', { name: 'I' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
  })

  it('Berserker gains rage on wrong guess, increases damage', async () => {
    // wrong guess first (rage+1), then correct guess → base 2 + rage 1 = 3 per occurrence
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ masked_word: '_ a _', correct: true, guessed_letters: ['z','a'], status: 'in_progress', occurrences: 1 }) })
    )
    // word='cat', floor=1 → enemy HP=6. After wrong guess: rage=1. After correct 'a': damage = (2+1)×1 = 3. HP: 6→3
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument())
  })

  it('Vowel Mage deals bonus damage on vowels', async () => {
    // word='cat', floor=1 → enemy HP=6. Guess 'a' (vowel, 1 occ) → base 2 + vowel bonus 1 = 3. HP: 6→3
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: '_ a _', correct: true, guessed_letters: ['a'], status: 'in_progress', occurrences: 1 }),
    }))
    render(<CombatView run={buildRun('vowel_mage')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument())
  })

  it('Rogue combo stacks increase damage', async () => {
    // Guess 'c' (combo was 0, dmg = (2+0)×1=2, HP 6→4), guess 'a' (combo was 1, dmg=(2+1)×1=3, HP 4→1)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ masked_word: 'c _ _', correct: true, guessed_letters: ['c'], status: 'in_progress', occurrences: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ masked_word: 'c a _', correct: true, guessed_letters: ['c','a'], status: 'in_progress', occurrences: 1 }) })
    )
    render(<CombatView run={buildRun('rogue')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/1 \/ 6/)).toBeInTheDocument())
  })

  it('renders ability button', () => {
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByRole('button', { name: /bloodletter/i })).toBeInTheDocument()
  })

  it('Archivist deals bonus damage on correct guess when 5+ letters hidden', async () => {
    // 6-letter word = 6 hidden letters > 5 threshold → Archivist gets +1 dmg/occ
    // floor=1, word='castle' (6 letters) → enemy HP = 6×1×2 = 12
    // Guess 'a' (1 occ, hiddenCount=6 >= 5) → dmg = (2+1)×1 = 3. HP: 12→9
    const archivistGame: GameState = { ...mockGame, word: 'castle', maskedWord: '_ _ _ _ _ _', firstLetter: 'c' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: '_ a _ _ _ _', correct: true, guessed_letters: ['a'], status: 'in_progress', occurrences: 1 }),
    }))
    render(<CombatView run={buildRun('archivist')} room={enemyRoom()} initialState={archivistGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/9 \/ 12/)).toBeInTheDocument())
  })

  it('awards coins via onCombatEnd when enemy killed before word solved', async () => {
    // word='act' (3 letters), floor=1 → enemy HP = 3×1×2 = 6
    // 3 correct guesses (1 occ each, 2 dmg each) = 6 total damage → enemy dead, status stays in_progress
    const mockGameAct: GameState = { ...mockGame, word: 'act', maskedWord: '_ _ _', firstLetter: 'a' }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ masked_word: 'a _ _', correct: true, guessed_letters: ['a'], status: 'in_progress', occurrences: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ masked_word: 'a c _', correct: true, guessed_letters: ['a','c'], status: 'in_progress', occurrences: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ masked_word: 'a c t', correct: true, guessed_letters: ['a','c','t'], status: 'in_progress', occurrences: 1 }) })
    )
    const onCombatEnd = vi.fn()
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGameAct} floor={1} onCombatEnd={onCombatEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    // enemy HP = 0 → useEffect fires finishCombat → combatDone=true → Continue shown
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 5 }))
  })
})
