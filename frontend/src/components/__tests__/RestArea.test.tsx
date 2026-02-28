import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RestArea from '../RestArea'
import type { RunState } from '../../types'
import { buildRun } from '../../runState'

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return { ...buildRun(), ...overrides }
}

describe('RestArea', () => {
  it('renders heading', () => {
    render(<RestArea run={makeRun()} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /rest area/i })).toBeInTheDocument()
  })

  it('displays current HP and coins', () => {
    render(<RestArea run={makeRun({ hp: 12, coins: 25 })} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByText(/12 \/ 50/)).toBeInTheDocument()
    expect(screen.getByText(/25/)).toBeInTheDocument()
  })

  it('heal button is enabled when coins >= 10 and HP < max', () => {
    render(<RestArea run={makeRun({ hp: 15, coins: 10 })} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /heal/i })).not.toBeDisabled()
  })

  it('heal button is disabled when coins < 10', () => {
    render(<RestArea run={makeRun({ hp: 15, coins: 9 })} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /heal/i })).toBeDisabled()
  })

  it('heal button is disabled when HP is at max', () => {
    render(<RestArea run={makeRun({ hp: 50, coins: 20 })} onHeal={vi.fn()} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /heal/i })).toBeDisabled()
  })

  it('calls onHeal with +5 HP and -10 coins', async () => {
    const onHeal = vi.fn()
    render(<RestArea run={makeRun({ hp: 10, coins: 15 })} onHeal={onHeal} onLeave={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /heal/i }))
    expect(onHeal).toHaveBeenCalledWith(expect.objectContaining({ hp: 15, coins: 5 }))
  })

  it('heal caps at maxHp', async () => {
    const onHeal = vi.fn()
    render(<RestArea run={makeRun({ hp: 48, maxHp: 50, coins: 20 })} onHeal={onHeal} onLeave={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /heal/i }))
    expect(onHeal).toHaveBeenCalledWith(expect.objectContaining({ hp: 50 }))
  })

  it('calls onLeave when Leave is clicked', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun()} onHeal={vi.fn()} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /leave/i }))
    expect(onLeave).toHaveBeenCalledOnce()
  })
})
