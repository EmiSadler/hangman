import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RestArea from '../RestArea'
import { buildRun } from '../../runState'
import type { RunState } from '../../types'

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return { ...buildRun('berserker'), ...overrides }
}

describe('RestArea', () => {
  it('renders heading', () => {
    render(<RestArea run={makeRun()} onLeave={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /rest area/i })).toBeInTheDocument()
  })

  it('displays current HP and coins', () => {
    render(<RestArea run={makeRun({ hp: 12, coins: 25 })} onLeave={vi.fn()} />)
    expect(screen.getByText(/12 \/ 50/)).toBeInTheDocument()
    expect(screen.getByText(/25/)).toBeInTheDocument()
  })

  it('Rest fully button calls onLeave with hp set to maxHp', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun({ hp: 20, maxHp: 50 })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /rest fully/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ hp: 50 }))
  })

  it('Rest fully works even when already at max HP', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun({ hp: 50, maxHp: 50 })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /rest fully/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ hp: 50 }))
  })

  it('Power up button calls onLeave with bonusDamage incremented by 1', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun({ bonusDamage: 0 })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /power up/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ bonusDamage: 1 }))
  })

  it('Power up stacks: bonusDamage 2 becomes 3', async () => {
    const onLeave = vi.fn()
    render(<RestArea run={makeRun({ bonusDamage: 2 })} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /power up/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ bonusDamage: 3 }))
  })
})
