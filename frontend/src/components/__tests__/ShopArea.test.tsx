import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ShopArea from '../ShopArea'
import { buildRun } from '../../runState'
import type { RunState, ArtifactId, PotionId } from '../../types'

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return { ...buildRun('berserker'), ...overrides }
}

// 8 artifacts that fill the inventory limit
const FULL_INVENTORY: ArtifactId[] = [
  'vowel_seeker', 'crystal_ball', 'category_scroll', 'short_sword',
  'blood_dagger', 'iron_shield', 'thick_skin', 'healing_salve',
]

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
    const { container } = render(<ShopArea run={makeRun({ coins: 99 })} onLeave={vi.fn()} />)
    const stockSection = container.querySelector('.shop-area__stock')!
    expect(stockSection.querySelectorAll('button').length).toBe(4)
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
    const { container } = render(<ShopArea run={makeRun({ coins: 99, artifacts: nearlyFull })} onLeave={vi.fn()} />)
    const stockSection = container.querySelector('.shop-area__stock')!
    expect(stockSection.querySelectorAll('button').length).toBe(2)
  })

  it('buying an artifact deducts its price and adds it to artifacts', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 99, artifacts: [] })} onLeave={onLeave} />)
    const buyButtons = screen.getAllByRole('button', { name: /buy/i })
    await userEvent.click(buyButtons[0])
    // Buy no longer exits the shop — click Leave to commit
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledOnce()
    const updatedRun = onLeave.mock.calls[0][0] as RunState
    expect(updatedRun.coins).toBeLessThan(99)
    expect(updatedRun.artifacts.length).toBe(1)
  })

  it('buying an artifact does not call onLeave (shop stays open)', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 99, artifacts: [] })} onLeave={onLeave} />)
    const buyButtons = screen.getAllByRole('button', { name: /buy/i })
    await userEvent.click(buyButtons[0])
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('bought artifact disappears from stock and leave calls onLeave with updated run', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 99, artifacts: [] })} onLeave={onLeave} />)
    const buyButtonsBefore = screen.getAllByRole('button', { name: /buy/i })
    const countBefore = buyButtonsBefore.length
    await userEvent.click(buyButtonsBefore[0])
    // One fewer buy button in stock now
    expect(screen.getAllByRole('button', { name: /buy/i })).toHaveLength(countBefore - 1)
    // Leave commits the purchase
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledOnce()
    const updatedRun = onLeave.mock.calls[0][0] as RunState
    expect(updatedRun.artifacts.length).toBe(1)
  })

  it('shows swap banner when buying with a full inventory', async () => {
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={vi.fn()} />)
    const swapButtons = screen.getAllByRole('button', { name: /swap/i })
    await userEvent.click(swapButtons[0])
    expect(screen.getByText(/inventory full/i)).toBeInTheDocument()
  })

  it('cancel in swap mode hides the swap banner', async () => {
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: /swap/i })[0])
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/inventory full/i)).not.toBeInTheDocument()
  })

  it('clicking remove in swap mode shows confirmation banner', async () => {
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={vi.fn()} />)
    // Enter swap mode
    await userEvent.click(screen.getAllByRole('button', { name: /swap/i })[0])
    // Click Remove on the first artifact (vowel_seeker) in the shelf
    await userEvent.click(screen.getByRole('button', { name: /remove vowel seeker/i }))
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
  })

  it('cancel in confirmation returns to swap mode', async () => {
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: /swap/i })[0])
    await userEvent.click(screen.getByRole('button', { name: /remove vowel seeker/i }))
    // Cancel confirmation — should go back to swap banner, not all the way out
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText(/inventory full/i)).toBeInTheDocument()
    expect(screen.queryByText(/this cannot be undone/i)).not.toBeInTheDocument()
  })

  it('confirming swap replaces item, deducts coins, and stays in shop', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 99, artifacts: FULL_INVENTORY })} onLeave={onLeave} />)
    await userEvent.click(screen.getAllByRole('button', { name: /swap/i })[0])
    await userEvent.click(screen.getByRole('button', { name: /remove vowel seeker/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    // Shop still open — Leave to commit
    expect(onLeave).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledOnce()
    const updatedRun = onLeave.mock.calls[0][0] as RunState
    // Inventory still 8 (one swapped), vowel_seeker removed
    expect(updatedRun.artifacts).toHaveLength(8)
    expect(updatedRun.artifacts).not.toContain('vowel_seeker')
    // Coins decreased
    expect(updatedRun.coins).toBeLessThan(99)
  })

  it('renders health potion for sale', () => {
    render(<ShopArea run={makeRun({ coins: 20 })} onLeave={vi.fn()} />)
    expect(screen.getByText(/health potion/i)).toBeInTheDocument()
  })

  it('buy potion button is disabled when player cannot afford it', () => {
    render(<ShopArea run={makeRun({ coins: 0 })} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /buy.*health potion/i })).toBeDisabled()
  })

  it('buy potion button is disabled when pouch is full', () => {
    const fullPotions: PotionId[] = ['health_potion', 'health_potion', 'health_potion', 'health_potion']
    render(<ShopArea run={makeRun({ coins: 99, potions: fullPotions })} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /buy.*health potion/i })).toBeDisabled()
  })

  it('buying a potion deducts coins and adds it to potions', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 20, potions: [] })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /buy.*health potion/i }))
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    const updatedRun = onLeave.mock.calls[0][0] as RunState
    expect(updatedRun.coins).toBe(10)
    expect(updatedRun.potions).toEqual(['health_potion'])
  })

  it('buy potion does not call onLeave (shop stays open)', async () => {
    const onLeave = vi.fn()
    render(<ShopArea run={makeRun({ coins: 20, potions: [] })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /buy.*health potion/i }))
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('always shows health potion in shop', () => {
    render(<ShopArea run={makeRun({ coins: 99 })} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /buy.*health potion/i })).toBeInTheDocument()
  })

  it('shows exactly 3 potions in shop (health + 2 random)', () => {
    render(<ShopArea run={makeRun({ coins: 99 })} onLeave={vi.fn()} />)
    const potionSection = document.querySelector('.shop-area__potions')!
    const buyButtons = potionSection.querySelectorAll('button[aria-label^="Buy"]')
    expect(buyButtons).toHaveLength(3)
  })
})
