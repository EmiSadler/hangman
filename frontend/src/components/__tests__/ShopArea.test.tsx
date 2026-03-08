import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ShopArea from '../ShopArea'
import { buildRun } from '../../runState'
import type { RunState, ArtifactId } from '../../types'

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return { ...buildRun('berserker'), ...overrides }
}

describe('ShopArea', () => {
  it('renders shop heading', () => {
    render(<ShopArea run={makeRun()} onLeave={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /shop/i })).toBeInTheDocument()
  })

  it('displays current coin count', () => {
    render(<ShopArea run={makeRun({ coins: 30 })} onLeave={vi.fn()} />)
    expect(screen.getByText(/30/)).toBeInTheDocument()
  })

  it('renders 4 artifact options', () => {
    render(<ShopArea run={makeRun({ coins: 99 })} onLeave={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /buy/i }).length).toBe(4)
  })

  it('buy button is disabled when player cannot afford the artifact', () => {
    // With 0 coins, all buy buttons should be disabled
    render(<ShopArea run={makeRun({ coins: 0 })} onLeave={vi.fn()} />)
    const buyButtons = screen.getAllByRole('button', { name: /buy/i })
    expect(buyButtons.every(btn => (btn as HTMLButtonElement).disabled)).toBe(true)
  })

  it('leave button calls onLeave with unchanged run', async () => {
    const onLeave = vi.fn()
    const run = makeRun({ coins: 5 })
    render(<ShopArea run={run} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledWith(run)
  })

  it('renders available artifacts when pool has fewer than 4', () => {
    // Own 12 of 14 artifacts — only 2 remain in pool
    const nearlyFull: ArtifactId[] = [
      'vowel_seeker', 'crystal_ball', 'category_scroll',
      'short_sword', 'blood_dagger', 'iron_shield', 'thick_skin',
      'chainmail', 'healing_salve', 'gold_tooth', 'battle_scar', 'shadow_cloak',
    ]
    render(<ShopArea run={makeRun({ coins: 99, artifacts: nearlyFull })} onLeave={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /buy/i }).length).toBe(2)
  })

  it('buying an artifact deducts its price and adds it to artifacts', async () => {
    const onLeave = vi.fn()
    // Give enough coins to afford anything, own nothing
    render(<ShopArea run={makeRun({ coins: 99, artifacts: [] })} onLeave={onLeave} />)
    const buyButtons = screen.getAllByRole('button', { name: /buy/i })
    await userEvent.click(buyButtons[0])
    expect(onLeave).toHaveBeenCalledOnce()
    const updatedRun = onLeave.mock.calls[0][0] as RunState
    expect(updatedRun.coins).toBeLessThan(99)
    expect(updatedRun.artifacts.length).toBe(1)
  })
})
