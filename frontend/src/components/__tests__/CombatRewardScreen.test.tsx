import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CombatRewardScreen from '../CombatRewardScreen'
import { buildRun } from '../../runState'
import type { RunState, PotionId, ArtifactId } from '../../types'

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return { ...buildRun('berserker'), ...overrides }
}

describe('CombatRewardScreen', () => {
  it('shows coins earned when > 0', () => {
    render(<CombatRewardScreen run={makeRun()} coinsEarned={10} pendingPotion={null} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.getByText(/\+10 coins/i)).toBeInTheDocument()
  })

  it('does not show coins line when coinsEarned is 0', () => {
    render(<CombatRewardScreen run={makeRun()} coinsEarned={0} pendingPotion={null} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.queryByText(/coins/i)).not.toBeInTheDocument()
  })

  it('shows Continue button immediately when no potion or artifact', () => {
    render(<CombatRewardScreen run={makeRun()} coinsEarned={10} pendingPotion={null} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('calls onLeave with run when Continue clicked', async () => {
    const onLeave = vi.fn()
    const run = makeRun({ coins: 10 })
    render(<CombatRewardScreen run={run} coinsEarned={10} pendingPotion={null} pendingArtifact={null} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ coins: 10 }))
  })

  it('auto-adds potion to pouch when space available', () => {
    const run = makeRun({ potions: [] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={'health_potion' as PotionId} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.getByText(/health potion added to pouch/i)).toBeInTheDocument()
  })

  it('shows potion swap UI when pouch is full', () => {
    const run = makeRun({ potions: ['health_potion', 'health_potion', 'health_potion', 'health_potion'] as PotionId[] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={'strength_potion' as PotionId} pendingArtifact={null} onLeave={vi.fn()} />)
    expect(screen.getByText(/pouch full/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('can skip a potion when pouch is full', async () => {
    const run = makeRun({ potions: ['health_potion', 'health_potion', 'health_potion', 'health_potion'] as PotionId[] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={'strength_potion' as PotionId} pendingArtifact={null} onLeave={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('auto-adds artifact when inventory has space', () => {
    const run = makeRun({ artifacts: [] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={null} pendingArtifact={'crystal_ball' as ArtifactId} onLeave={vi.fn()} />)
    expect(screen.getByText(/crystal ball added to inventory/i)).toBeInTheDocument()
  })

  it('shows artifact swap UI when inventory is full', () => {
    const run = makeRun({ artifacts: ['vowel_seeker','crystal_ball','category_scroll','short_sword','blood_dagger','iron_shield','thick_skin','healing_salve'] as ArtifactId[] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={null} pendingArtifact={'gold_tooth' as ArtifactId} onLeave={vi.fn()} />)
    expect(screen.getByText(/inventory full/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('can skip an artifact when inventory is full', async () => {
    const run = makeRun({ artifacts: ['vowel_seeker','crystal_ball','category_scroll','short_sword','blood_dagger','iron_shield','thick_skin','healing_salve'] as ArtifactId[] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={null} pendingArtifact={'gold_tooth' as ArtifactId} onLeave={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('onLeave receives run with auto-added potion', async () => {
    const onLeave = vi.fn()
    const run = makeRun({ potions: [] })
    render(<CombatRewardScreen run={run} coinsEarned={0} pendingPotion={'health_potion' as PotionId} pendingArtifact={null} onLeave={onLeave} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ potions: ['health_potion'] }))
  })
})
