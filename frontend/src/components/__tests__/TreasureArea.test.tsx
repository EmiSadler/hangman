import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import TreasureArea from '../TreasureArea'
import { buildRun } from '../../runState'

describe('TreasureArea', () => {
  it('renders heading', () => {
    render(<TreasureArea run={buildRun('berserker')} onChoose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /treasure/i })).toBeInTheDocument()
  })

  it('renders three bonus buttons', () => {
    render(<TreasureArea run={buildRun('berserker')} onChoose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /reveal a letter/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+5 hp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+10 coins/i })).toBeInTheDocument()
  })

  it('reveal letter sets pendingReveal to true', async () => {
    const onChoose = vi.fn()
    render(<TreasureArea run={buildRun('berserker')} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /reveal a letter/i }))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ pendingReveal: true }))
  })

  it('+5 HP increases hp by 5', async () => {
    const onChoose = vi.fn()
    render(<TreasureArea run={{ ...buildRun('berserker'), hp: 10 }} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /\+5 hp/i }))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ hp: 15 }))
  })

  it('+5 HP caps at maxHp', async () => {
    const onChoose = vi.fn()
    render(<TreasureArea run={{ ...buildRun('berserker'), hp: 18, maxHp: 20 }} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /\+5 hp/i }))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ hp: 20 }))
  })

  it('+10 coins increases coins by 10', async () => {
    const onChoose = vi.fn()
    render(<TreasureArea run={{ ...buildRun('berserker'), coins: 5 }} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /\+10 coins/i }))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ coins: 15 }))
  })
})
