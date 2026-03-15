import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CombatView, { ENEMY_NAMES, BOSS_NAMES } from '../CombatView'
import { buildRun } from '../../runState'
import type { GameState, RunState, ThemeId, ArtifactId, PotionId } from '../../types'

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

function bossRoom() {
  return { type: 'boss' as const, completed: false, gameId: null }
}

function lowHpRun() {
  return { ...buildRun('berserker'), hp: 20, potions: ['health_potion' as PotionId] }
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
      ok: true, json: async () => mockGuessResponse({ masked_word: 'c a t', correct: true, guessed_letters: ['c','a','t'], status: 'won', occurrences: 3 }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
  })

  it('calls onCombatEnd with updated run when Continue clicked after win', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: 'c a t', correct: true, guessed_letters: ['c','a','t'], status: 'won', occurrences: 3 }),
    }))
    const onCombatEnd = vi.fn()
    const run: RunState = { ...buildRun('berserker'), hp: 50, coins: 0 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 5 }), undefined)
  })

  it('calls onCombatEnd with a non-empty bossName string when boss fight is won', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ masked_word: 'c a t', correct: true, guessed_letters: ['c','a','t'], status: 'won', occurrences: 3 }),
    }))
    const onCombatEnd = vi.fn()
    const run: RunState = { ...buildRun('berserker'), hp: 50, coins: 0 }
    render(<CombatView run={run} room={bossRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onCombatEnd).toHaveBeenCalledWith(
      expect.objectContaining({ coins: 20 }),
      expect.stringMatching(/\S+/),
    )
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

  it('ability button has data-tooltip describing the ability', () => {
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /bloodletter/i })
    expect(btn.getAttribute('data-tooltip')).toBeTruthy()
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

  it('shows category, first letter and word length for Archivist', () => {
    const archivistRun = buildRun('archivist')
    render(<CombatView run={archivistRun} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByText(/animals/i)).toBeInTheDocument()
    expect(screen.getByText(/first letter.*c/i)).toBeInTheDocument()
    expect(screen.getByText(/3 letters/i)).toBeInTheDocument()
  })

  it('does NOT show Archivist info for other classes', () => {
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.queryByText(/first letter/i)).not.toBeInTheDocument()
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
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 5 }), undefined)
  })

  it('Iron Shield starts combat with 2 shield', () => {
    const run = { ...buildRun('berserker'), artifacts: ['iron_shield'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByText(/🛡 2/)).toBeInTheDocument()
  })

  it('Battle Scar gives Berserker 1 starting rage (increases first correct hit damage)', async () => {
    // word='cat', floor=1 → enemy HP=6
    // With rage=1: correct 'a' (1 occ) → (2+1)×1 = 3. HP: 6→3
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({
        masked_word: '_ a _', correct: true,
        guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
      }),
    }))
    const run = { ...buildRun('berserker'), artifacts: ['battle_scar'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument())
  })

  it('Vowel Seeker shows vowel count at combat start', () => {
    // word='cat' has 1 vowel ('a')
    const run = { ...buildRun('berserker'), artifacts: ['vowel_seeker'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByText(/1 vowel/i)).toBeInTheDocument()
  })

  it('Category Scroll shows category for non-Archivist', () => {
    const run = { ...buildRun('berserker'), artifacts: ['category_scroll'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByText(/📜.*animals/i)).toBeInTheDocument()
  })

  it('Category Scroll does NOT duplicate category info for Archivist', () => {
    const run = { ...buildRun('archivist'), artifacts: ['category_scroll'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // Archivist info bar shows category once; category_scroll should not show a second
    expect(screen.getAllByText(/animals/i).length).toBe(1)
  })

  it('Crystal Ball reveals a letter from the word at combat start', () => {
    const run = { ...buildRun('berserker'), artifacts: ['crystal_ball'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // word='cat', firstLetter='c' → crystal ball picks 'a' or 't'
    expect(screen.getByText(/🔮.*is in this word/i)).toBeInTheDocument()
  })

  it('Short Sword deals +1 bonus damage per correct guess', async () => {
    // word='cat', floor=1 → enemy HP=6. 'a' (1 occ): base 2 + short_sword 1 = 3. HP: 6→3
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({
        masked_word: '_ a _', correct: true,
        guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
      }),
    }))
    const run = { ...buildRun('berserker'), artifacts: ['short_sword'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument())
  })

  it('Short Sword +1 bonus is flat per guess (not per occurrence)', async () => {
    // word='add', floor=1 → enemy HP = 3×1×2 = 6
    // Guess 'd' (2 occ): base dmg = 2*2 = 4, + short_sword flat +1 = 5. HP: 6→1
    const doubleLetterGame: GameState = { ...mockGame, word: 'add', maskedWord: '_ _ _', firstLetter: 'a' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({
        masked_word: 'a d d', correct: true,
        guessed_letters: ['d'], status: 'in_progress', occurrences: 2,
      }),
    }))
    const run = { ...buildRun('berserker'), artifacts: ['short_sword'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={doubleLetterGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'D' }))
    await waitFor(() => expect(screen.getByText(/1 \/ 6/)).toBeInTheDocument())
  })

  it('Thick Skin reduces damage taken by 1', async () => {
    // DAMAGE_PER_WRONG=2, thick_skin → 1 dmg taken. HP: 50→49
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    const run = { ...buildRun('berserker'), hp: 50, artifacts: ['thick_skin'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => expect(screen.getByText(/49 \/ 50/)).toBeInTheDocument())
  })

  it('Blood Dagger gives +2 bonus on next correct hit after a wrong guess', async () => {
    // wrong guess first (bloodDaggerReady=true, rage 0→1), then correct 'a' (1 occ):
    // dmg = (base 2 + rage 1) * 1 + blood_dagger 2 = 5. HP: 6→1
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({
        masked_word: '_ a _', correct: true, guessed_letters: ['z', 'a'], status: 'in_progress', occurrences: 1,
      }) })
    )
    const run = { ...buildRun('berserker'), artifacts: ['blood_dagger'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/1 \/ 6/)).toBeInTheDocument())
  })

  it('Shadow Cloak raises Rogue combo from 0 to 1 on first wrong guess', async () => {
    // Shadow Cloak spec: "combo drops to 1 instead of 0" — even from combo=0
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    const run = { ...buildRun('rogue'), artifacts: ['shadow_cloak'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // First wrong guess before any correct hits: combo=0 → should become 1 (not stay 0)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    // Verify this by doing a correct guess: combo=1 means damage = (2+1)*1 = 3, HP: 6→3
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({
        masked_word: '_ a _', correct: true, guessed_letters: ['z', 'a'], status: 'in_progress', occurrences: 1,
      }),
    }))
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument())
  })

  it('Shadow Cloak keeps Rogue combo at 1 after a wrong guess', async () => {
    // 'c' correct (combo 0→1, dmg (2+0)*1=2, HP 6→4)
    // 'z' wrong (shadow_cloak: combo stays max(1,1)=1)
    // 'a' correct (combo=1, dmg (2+1)*1=3, HP 4→1)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({
        masked_word: 'c _ _', correct: true, guessed_letters: ['c'], status: 'in_progress', occurrences: 1,
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({
        masked_word: 'c a _', correct: true, guessed_letters: ['c', 'z', 'a'], status: 'in_progress', occurrences: 1,
      }) })
    )
    const run = { ...buildRun('rogue'), artifacts: ['shadow_cloak'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/1 \/ 6/)).toBeInTheDocument())
  })

  it('Mana Crystal reduces Berserker ability cooldown by 1 after use', async () => {
    // Berserker base cooldown = 4. With mana_crystal → 3
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    const run = { ...buildRun('berserker'), artifacts: ['mana_crystal'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /bloodletter$/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /bloodletter \(3\)/i })).toBeInTheDocument()
    )
  })

  it('Healing Salve restores 3 HP after combat win', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({
        masked_word: 'c a t', correct: true,
        guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 3,
      }),
    }))
    const run = { ...buildRun('berserker'), hp: 40, artifacts: ['healing_salve'] as ArtifactId[] }
    const onCombatEnd = vi.fn()
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ hp: 43 }), undefined)
  })

  it('Healing Salve caps HP at maxHp', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({
        masked_word: 'c a t', correct: true,
        guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 3,
      }),
    }))
    const run = { ...buildRun('berserker'), hp: 49, maxHp: 50, artifacts: ['healing_salve'] as ArtifactId[] }
    const onCombatEnd = vi.fn()
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ hp: 50 }), undefined)
  })

  it('Gold Tooth awards +5 bonus coins after combat win', async () => {
    // COINS_PER_ENEMY=5 + gold_tooth 5 = 10 total
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({
        masked_word: 'c a t', correct: true,
        guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 3,
      }),
    }))
    const run = { ...buildRun('berserker'), coins: 0, artifacts: ['gold_tooth'] as ArtifactId[] }
    const onCombatEnd = vi.fn()
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={onCombatEnd} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onCombatEnd).toHaveBeenCalledWith(expect.objectContaining({ coins: 10 }), undefined)
  })

  it('Ancient Codex allows Archivist to use Cross Reference a second time', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    const run = { ...buildRun('archivist'), artifacts: ['ancient_codex'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // Use ability (puts in abilityMode), then make a guess to fire it
    await userEvent.click(screen.getByRole('button', { name: /cross reference$/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    // After first use, button should still be available (not show 'used')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /cross reference$/i })).not.toBeDisabled()
    )
  })

  it('displays an enemy name for a regular room', () => {
    const run = { ...buildRun('berserker'), floorThemes: ['space', 'swamp', 'desert'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    const nameEl = document.querySelector('.combat-view__enemy-name')
    expect(nameEl).not.toBeNull()
    expect(nameEl!.textContent!.trim()).toBeTruthy()
    // ENEMY_NAMES kept for backward-compat; themed names used in actual rendering
    void ENEMY_NAMES
  })

  it('displays a boss name for a boss room', () => {
    const run = { ...buildRun('berserker'), floorThemes: ['space', 'swamp', 'desert'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={bossRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    const nameEl = document.querySelector('.combat-view__enemy-name')
    expect(nameEl).not.toBeNull()
    expect(nameEl!.textContent!.trim()).toBeTruthy()
    // BOSS_NAMES kept for backward-compat; themed names used in actual rendering
    void BOSS_NAMES
  })

  it('Ancient Codex Archivist ability is disabled after two uses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    const run = { ...buildRun('archivist'), artifacts: ['ancient_codex'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // First use
    await userEvent.click(screen.getByRole('button', { name: /cross reference$/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    // Second use
    await waitFor(() => screen.getByRole('button', { name: /cross reference$/i }))
    await userEvent.click(screen.getByRole('button', { name: /cross reference$/i }))
    await userEvent.click(screen.getByRole('button', { name: 'X' }))
    // Now should show 'used' and be disabled
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /cross reference.*used/i })).toBeDisabled()
    )
  })

  it('potion belt shows health potion button when player has one', () => {
    render(<CombatView run={lowHpRun()} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByRole('button', { name: /health potion/i })).toBeInTheDocument()
  })

  it('using a health potion increases HP by 10', async () => {
    render(<CombatView run={lowHpRun()} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.getByText(/HP: 20/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /health potion/i }))
    expect(screen.getByText(/HP: 30/)).toBeInTheDocument()
  })

  it('using a health potion removes it from the pouch', async () => {
    render(<CombatView run={lowHpRun()} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /health potion/i }))
    expect(screen.queryByRole('button', { name: /health potion/i })).not.toBeInTheDocument()
  })

  it('potion belt is not shown when pouch is empty', () => {
    const emptyRun = { ...buildRun('berserker'), hp: 20 }  // potions: []
    render(<CombatView run={emptyRun} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /health potion/i })).not.toBeInTheDocument()
  })

  it('bonusDamage adds flat damage per correct guess', async () => {
    // word='catch' (5 letters), floor=1 → maxEnemyHp = 5*1*2 = 10
    // berserker BASE_DAMAGE=2, no rage, bonusDamage=2 → dmg per occ = 2
    // 'c' appears 2 times → base total = 2*2 = 4, +bonusDamage 2 = 6
    // Enemy HP: 10 - 6 = 4
    const game: GameState = { ...mockGame, word: 'catch', maskedWord: '_ _ _ _ _', firstLetter: 'c' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGuessResponse({
        masked_word: 'c _ _ c _',
        correct: true,
        guessed_letters: ['c'],
        status: 'in_progress',
        occurrences: 2,
      }),
    }))
    render(
      <CombatView
        run={{ ...buildRun('berserker'), bonusDamage: 2 }}
        room={enemyRoom()}
        initialState={game}
        floor={1}
        onCombatEnd={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    // Enemy HP should be 4/10 (took 6 damage: 2 per occ * 2 occ + 2 bonusDamage)
    await waitFor(() => expect(screen.getByText(/4 \/ 10/)).toBeInTheDocument())
  })

  it('wrong solve attempt when HP is low triggers game over', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ status: 'in_progress' }),
    }))
    const run = { ...buildRun('berserker'), hp: 5 }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    const input = screen.getByPlaceholderText(/type the word/i)
    await userEvent.type(input, 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /^solve$/i }))
    await waitFor(() => screen.getByRole('button', { name: /play again/i }))
  })

  it('shows summoning message with remaining HP when word solved but enemy alive', async () => {
    // floor=3, word='cat' (3 letters) → enemy HP = 3*3*2 = 18
    // Guess 't' (1 occ, 2 dmg → HP 18→16), backend returns status='won' → summoning
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockGuessResponse({
          masked_word: 'c a t', correct: true,
          guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          game_id: 'new-id', word: 'dog', masked_word: '_ _ _',
          category: 'animals', first_letter: 'd', guessed_letters: [], status: 'in_progress',
        }),
      })
    )
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={3} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    await waitFor(() => {
      expect(screen.getAllByText(/16/).length).toBeGreaterThan(0)
      expect(screen.getByText(/summon/i)).toBeInTheDocument()
    })
  })

  // ── Space theme ──────────────────────────────────────────────────────
  it('shows void warning after 2nd guess with space theme', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false }),
    }))
    const run = { ...buildRun('berserker'), floorThemes: ['space', 'swamp', 'desert'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await userEvent.click(screen.getByRole('button', { name: 'X' }))
    await waitFor(() => expect(screen.getByText(/gathering void energy/i)).toBeInTheDocument())
  })

  it('casts black hole after 3rd guess with space theme', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false }),
    }))
    const run = { ...buildRun('berserker'), floorThemes: ['space', 'swamp', 'desert'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await userEvent.click(screen.getByRole('button', { name: 'X' }))
    await userEvent.click(screen.getByRole('button', { name: 'V' }))
    await waitFor(() => expect(screen.getByText(/black hole/i)).toBeInTheDocument())
  })

  // ── Swamp theme ───────────────────────────────────────────────────────
  it('shows mud warning after 1st guess with swamp theme', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false }),
    }))
    const run = { ...buildRun('berserker'), floorThemes: ['swamp', 'space', 'desert'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => expect(screen.getByText(/winding up/i)).toBeInTheDocument())
  })

  it('throws mud after 2nd guess with swamp theme', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false }),
    }))
    const run = { ...buildRun('berserker'), floorThemes: ['swamp', 'space', 'desert'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await userEvent.click(screen.getByRole('button', { name: 'X' }))
    await waitFor(() => expect(screen.getByText(/hurls mud/i)).toBeInTheDocument())
  })

  it('doubles player damage on wrong guess for mud-stuck letter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false }),
    }))
    // berserker, 50 HP, no artifacts, no shield. Wrong guess = 2 HP damage each
    const run = { ...buildRun('berserker'), hp: 50, floorThemes: ['swamp', 'space', 'desert'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    // guess 1 (Z wrong): count=1 → warning. HP 50→48
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => expect(screen.getByText(/48 \/ 50/)).toBeInTheDocument())
    // guess 2 (X wrong): count=2 → mud thrown. HP 48→46
    await userEvent.click(screen.getByRole('button', { name: 'X' }))
    await waitFor(() => expect(screen.getByText(/46 \/ 50/)).toBeInTheDocument())
    // Find a mud-stuck letter by its CSS class and guess it (wrong) → expect double damage
    await waitFor(() => {
      const mudBtn = document.querySelector('.key--mud:not([disabled])') as HTMLButtonElement | null
      expect(mudBtn).not.toBeNull()
    })
    const mudBtn = document.querySelector('.key--mud:not([disabled])') as HTMLButtonElement
    await userEvent.click(mudBtn)
    // Normal wrong = 2 dmg, mud doubles → 4 dmg. HP 46→42
    await waitFor(() => expect(screen.getByText(/42 \/ 50/)).toBeInTheDocument())
  })

  // ── Desert theme ──────────────────────────────────────────────────────
  it('blows away a letter on wrong guess with desert theme', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => mockGuessResponse({ correct: false }),
    }))
    const run = { ...buildRun('berserker'), floorThemes: ['desert', 'space', 'swamp'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => expect(screen.getByText(/stirs the sands/i)).toBeInTheDocument())
  })

  // ── Jungle theme ──────────────────────────────────────────────────────
  it('starts with 2 disabled letters on bottom keyboard row for jungle theme', () => {
    const run = { ...buildRun('berserker'), floorThemes: ['jungle', 'space', 'swamp'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    const bottomRow = ['Z','X','C','V','B','N','M']
    const disabledCount = bottomRow.filter(
      letter => screen.getByRole('button', { name: letter }).hasAttribute('disabled')
    ).length
    expect(disabledCount).toBe(2)
  })

  it('shows vine message on correct guess with jungle theme when vine grows', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // always < 0.5 → vine always grows
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGuessResponse({ masked_word: '_ a _', correct: true, guessed_letters: ['a'], occurrences: 1 }),
    }))
    const run = { ...buildRun('berserker'), floorThemes: ['jungle', 'space', 'swamp'] as [ThemeId, ThemeId, ThemeId] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText(/spreads the jungle/i)).toBeInTheDocument())
  })

  it('Crystal Ball updates its letter after a summoned word replaces the current word', async () => {
    // word='cat', firstLetter='c' → crystal ball picks 'a' or 't'
    // New summoned word='dog', firstLetter='d' → crystal ball should pick 'o' or 'g'
    // Neither 'a' nor 't' appear in 'dog', so this distinguishes old vs new hint
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockGuessResponse({
          masked_word: 'c a t', correct: true,
          guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          game_id: 'new-id', word: 'dog', masked_word: '_ _ _',
          category: 'animals', first_letter: 'd', guessed_letters: [],
        }),
      })
    )
    const run = { ...buildRun('berserker'), artifacts: ['crystal_ball'] as ArtifactId[] }
    render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={3} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    const continueBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: /continue/i })
      expect(btn).not.toBeDisabled()
      return btn
    })
    await userEvent.click(continueBtn)
    await waitFor(() => expect(screen.queryByText(/summon/i)).not.toBeInTheDocument())
    // Crystal ball must now show a letter from 'dog' (not from 'cat')
    expect(screen.queryByText(/🔮 [AT] is in this word/i)).not.toBeInTheDocument()
    expect(screen.getByText(/🔮 [OG] is in this word/i)).toBeInTheDocument()
  })

  it('Continue on summoning screen dismisses message and shows new word', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockGuessResponse({
          masked_word: 'c a t', correct: true,
          guessed_letters: ['c', 'a', 't'], status: 'won', occurrences: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          game_id: 'new-id', word: 'dog', masked_word: '_ _ _',
          category: 'animals', first_letter: 'd', guessed_letters: [], status: 'in_progress',
        }),
      })
    )
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={3} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    // Wait for Continue button to be enabled (fetch complete)
    const continueBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: /continue/i })
      expect(btn).not.toBeDisabled()
      return btn
    })
    await userEvent.click(continueBtn)
    // Summoning message gone, back to game board
    await waitFor(() => expect(screen.queryByText(/summon/i)).not.toBeInTheDocument())
    // 'E' key available (keyboard reset with new word)
    expect(screen.getByRole('button', { name: 'E' })).toBeInTheDocument()
  })

  it('deals damage for hidden letters when player solves by typing', async () => {
    // word='cat' (3 letters), floor=3 → enemy HP = 3×3×2 = 18
    // maskedWord='_ _ _' → hiddenRemaining=3
    // Solve correctly → 3 × BASE_DAMAGE_PER_HIT(2) = 6 damage → HP 18→12
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'won', masked_word: 'c a t' }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={3} onCombatEnd={vi.fn()} />)
    const input = screen.getByPlaceholderText(/type the word/i)
    await userEvent.type(input, 'cat')
    await userEvent.click(screen.getByRole('button', { name: /solve/i }))
    await waitFor(() => expect(screen.getByText(/12 \/ 18/)).toBeInTheDocument())
  })

  it('no extra damage when word won by guessing all letters', async () => {
    // word='cat', floor=1 → enemy HP=6. Guess 'a' (1 occ, 2 dmg → HP 4), then guess all
    // winning guess should not double-deal damage
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ masked_word: '_ a _', correct: true, guessed_letters: ['a'], status: 'in_progress', occurrences: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ masked_word: 'c a _', correct: true, guessed_letters: ['a','c'], status: 'in_progress', occurrences: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResponse({ masked_word: 'c a t', correct: true, guessed_letters: ['a','c','t'], status: 'won', occurrences: 1 }) })
    )
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    await userEvent.click(screen.getByRole('button', { name: 'T' }))
    // 3×2 = 6 total dmg, enemy HP 6→0 → combat done, Continue shown
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
  })

  it('shows enemy damage popup on correct guess', async () => {
    // word='cat', floor=1 → enemy HP=6. 'a' (1 occ, 2 dmg) → popup '-2' appears on enemy side
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGuessResponse({
        masked_word: '_ a _', correct: true,
        guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
      }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(screen.getByText('-2')).toBeInTheDocument())
  })

  it('shows player damage popup on wrong guess', async () => {
    // wrong guess → DAMAGE_PER_WRONG=2 → popup '-2' appears on player side
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => expect(screen.getByText('-2')).toBeInTheDocument())
  })

  it('shows +10 popup when player uses health potion', async () => {
    render(<CombatView run={lowHpRun()} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /health potion/i }))
    await waitFor(() => expect(screen.getByText('+10')).toBeInTheDocument())
  })

  it('applies flash-hit class to enemy sprite on correct guess', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGuessResponse({
        masked_word: '_ a _', correct: true,
        guessed_letters: ['a'], status: 'in_progress', occurrences: 1,
      }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => {
      const sprite = document.querySelector('.combat-view__enemy-sprite-placeholder')
      expect(sprite).toHaveClass('flash-hit')
    })
  })

  it('applies flash-hit class to player sprite on wrong guess', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGuessResponse({ correct: false, occurrences: 0 }),
    }))
    render(<CombatView run={buildRun('berserker')} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))
    await waitFor(() => {
      const sprite = document.querySelector('.combat-view__player-sprite-placeholder')
      expect(sprite).toHaveClass('flash-hit')
    })
  })

  describe('ATK stats', () => {
    it('renders player ATK and enemy ATK', () => {
      const run = buildRun('berserker')
      render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
      // BASE_DAMAGE_PER_HIT=2, rage=0, bonusDamage=0, no short_sword → player ATK 2
      // DAMAGE_PER_WRONG=2, no thick_skin, not rogue → enemy ATK 2
      const atkEls = screen.getAllByText(/⚔\s*2/)
      expect(atkEls.length).toBeGreaterThanOrEqual(2)
    })

    it('player ATK increases with bonusDamage', () => {
      const run = { ...buildRun('berserker'), bonusDamage: 3 }
      render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
      // BASE(2) + bonusDamage(3) = 5
      expect(screen.getByText(/⚔\s*5/)).toBeInTheDocument()
    })

    it('enemy ATK decreases with thick_skin artifact', () => {
      const run = { ...buildRun('berserker'), artifacts: ['thick_skin' as ArtifactId] }
      render(<CombatView run={run} room={enemyRoom()} initialState={mockGame} floor={1} onCombatEnd={vi.fn()} />)
      // DAMAGE_PER_WRONG(2) - thick_skin(1) = 1
      expect(screen.getByText(/⚔\s*1/)).toBeInTheDocument()
    })
  })
})
