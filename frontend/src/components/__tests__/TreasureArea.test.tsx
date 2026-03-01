import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TreasureArea from '../TreasureArea'
import { buildRun } from '../../runState'
import { ARTIFACTS, sampleArtifacts } from '../../artifacts'

vi.mock('../../artifacts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../artifacts')>()
  return {
    ...actual,
    sampleArtifacts: vi.fn(),
  }
})

describe('TreasureArea', () => {
  beforeEach(() => {
    vi.mocked(sampleArtifacts).mockReturnValue([
      ARTIFACTS['short_sword'],
      ARTIFACTS['iron_shield'],
      ARTIFACTS['chainmail'],
    ])
  })

  it('renders heading', () => {
    render(<TreasureArea run={buildRun('berserker')} onChoose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /treasure/i })).toBeInTheDocument()
  })

  it('renders the bonus option buttons', () => {
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

  it('renders a Find an Artifact button', () => {
    render(<TreasureArea run={buildRun('berserker')} onChoose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /find an artifact/i })).toBeInTheDocument()
  })

  it('clicking Find an Artifact shows artifact picker heading', async () => {
    render(<TreasureArea run={buildRun('berserker')} onChoose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /find an artifact/i }))
    expect(screen.getByRole('heading', { name: /find an artifact/i })).toBeInTheDocument()
  })

  it('clicking Find an Artifact shows 3 artifact buttons', async () => {
    render(<TreasureArea run={buildRun('berserker')} onChoose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /find an artifact/i }))
    expect(screen.getByRole('button', { name: /short sword/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iron shield/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /chainmail/i })).toBeInTheDocument()
  })

  it('picking an artifact adds it to run.artifacts', async () => {
    const onChoose = vi.fn()
    render(<TreasureArea run={buildRun('berserker')} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /find an artifact/i }))
    await userEvent.click(screen.getByRole('button', { name: /short sword/i }))
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ artifacts: expect.arrayContaining(['short_sword']) })
    )
  })

  it('picking Chainmail increases maxHp and hp by 5', async () => {
    const onChoose = vi.fn()
    vi.mocked(sampleArtifacts).mockReturnValue([ARTIFACTS['chainmail']])
    const run = { ...buildRun('berserker'), hp: 30, maxHp: 50 }
    render(<TreasureArea run={run} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /find an artifact/i }))
    await userEvent.click(screen.getByRole('button', { name: /chainmail/i }))
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ maxHp: 55, hp: 35, artifacts: expect.arrayContaining(['chainmail']) })
    )
  })
})
