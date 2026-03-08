import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

const mockGameResponse = {
  game_id: 'test-uuid',
  masked_word: '_ _ _ _ _ _ _ _',
  word: 'testword',
  category: 'general',
  first_letter: 't',
  guessed_letters: [],
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('shows RunSetup on initial render', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /start run/i })).toBeInTheDocument()
  })

  it('shows zero score on initial render', () => {
    render(<App />)
    expect(screen.getByText(/0 runs cleared/i)).toBeInTheDocument()
  })

  it('switches to CombatView after starting a run', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    })
  })

  it('shows error when server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByText(/could not reach server/i)).toBeInTheDocument()
    })
  })

  it('shows FloorProgress during combat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/floor 1 progress/i)).toBeInTheDocument()
    })
  })

  it('loads persisted score from localStorage on mount', () => {
    localStorage.setItem('hangman_score', JSON.stringify({ runsCleared: 2, runsFailed: 3, bestRooms: 15 }))
    render(<App />)
    expect(screen.getByText(/2 runs cleared/i)).toBeInTheDocument()
  })

  it('Forget me resets score to zero and clears localStorage', async () => {
    localStorage.setItem('hangman_score', JSON.stringify({ runsCleared: 2, runsFailed: 3, bestRooms: 15 }))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /forget me/i }))
    expect(screen.getByText(/0 runs cleared/i)).toBeInTheDocument()
    expect(localStorage.getItem('hangman_score')).toBeNull()
  })

  it('falls back to zero score on invalid localStorage JSON', () => {
    localStorage.setItem('hangman_score', 'garbage')
    render(<App />)
    expect(screen.getByText(/0 runs cleared/i)).toBeInTheDocument()
  })

  it('loads a fresh game board after clicking Continue following a won combat', async () => {
    const game1 = { game_id: 'game-1', masked_word: '_ _ _', word: 'cat', category: 'general', first_letter: 'c', guessed_letters: [] }
    const wonGuess = { correct: true, masked_word: 'c a t', guessed_letters: ['c'], status: 'won' }
    const game2 = { game_id: 'game-2', masked_word: '_ _ _ _ _', word: 'brave', category: 'general', first_letter: 'b', guessed_letters: [] }

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ session_id: 'test-session' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => game1 })
      .mockResolvedValueOnce({ ok: true, json: async () => wonGuess })
      .mockResolvedValueOnce({ ok: true, json: async () => game2 }),
    )

    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => screen.getByRole('button', { name: 'A' }))

    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))

    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Fresh game board should be loaded — keyboard visible, old result gone
    await waitFor(() => expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument())
    expect(screen.queryByText(/you won/i)).not.toBeInTheDocument()
  })

  it('shows Give Up button during an active run', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mockGameResponse }))
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => screen.getByRole('button', { name: 'A' }))
    expect(screen.getByRole('button', { name: /give up/i })).toBeInTheDocument()
  })

  it('clicking Give Up ends the run as a loss and shows the run-lost screen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mockGameResponse }))
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => screen.getByRole('button', { name: /give up/i }))
    await userEvent.click(screen.getByRole('button', { name: /give up/i }))
    expect(screen.getByText(/you died/i)).toBeInTheDocument()
  })

  it('resumes saved run from localStorage on mount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    const { buildRun } = await import('../../runState')
    const savedRun = buildRun('berserker')
    localStorage.setItem('hangman_run', JSON.stringify(savedRun))
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    })
  })

  it('calls POST /api/session when starting a new run', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ session_id: 'test-session' }) })
      .mockResolvedValue({ ok: true, json: async () => mockGameResponse })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => screen.getByRole('button', { name: 'A' }))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/session')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
  })

  it('passes session_id to POST /api/game when session was created', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ session_id: 'run-abc' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGameResponse })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => screen.getByRole('button', { name: 'A' }))
    const gameCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    expect(gameCallBody.session_id).toBe('run-abc')
  })

  it('shows RestArea when resumed into a rest room', async () => {
    const { buildRun } = await import('../../runState')
    const run = { ...buildRun('berserker'), roomIndex: 4 }
    localStorage.setItem('hangman_run', JSON.stringify(run))
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/rest area/i)).toBeInTheDocument()
    })
  })

  it('clicking Rest fully in RestArea advances to the next room', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    const { buildRun } = await import('../../runState')
    const run = { ...buildRun('berserker'), roomIndex: 4 }
    localStorage.setItem('hangman_run', JSON.stringify(run))
    render(<App />)
    await waitFor(() => screen.getByText(/rest area/i))
    await userEvent.click(screen.getByRole('button', { name: /rest fully/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    })
  })

  it('shows ShopArea when resumed into a shop room', async () => {
    const { buildRun } = await import('../../runState')
    const run = { ...buildRun('berserker'), roomIndex: 9 }
    localStorage.setItem('hangman_run', JSON.stringify(run))
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/^shop$/i)).toBeInTheDocument()
    })
  })

  it('clicking Leave in ShopArea advances to the next room', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameResponse,
    }))
    const { buildRun } = await import('../../runState')
    const run = { ...buildRun('berserker'), roomIndex: 9 }
    localStorage.setItem('hangman_run', JSON.stringify(run))
    render(<App />)
    await waitFor(() => screen.getByText(/^shop$/i))
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    })
  })
})
