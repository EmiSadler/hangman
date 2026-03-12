import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import VictoryScreen from '../VictoryScreen'
import { buildRun } from '../../runState'
import type { ThemeId } from '../../types'

const run = { ...buildRun('berserker', ['space', 'swamp', 'desert'] as [ThemeId, ThemeId, ThemeId]), coins: 45, floor: 3 }
const score = { runsCleared: 2, runsFailed: 1, bestRooms: 33 }

describe('VictoryScreen', () => {
  test('shows VICTORY heading', () => {
    render(<VictoryScreen run={run} score={score} defeatedBossName={null} onNewRun={() => {}} />)
    expect(screen.getByText('V I C T O R Y')).toBeInTheDocument()
  })

  test('shows defeated boss name when provided', () => {
    render(<VictoryScreen run={run} score={score} defeatedBossName="The Singularity" onNewRun={() => {}} />)
    expect(screen.getByText('You defeated The Singularity.')).toBeInTheDocument()
  })

  test('shows coins from run', () => {
    render(<VictoryScreen run={run} score={score} defeatedBossName={null} onNewRun={() => {}} />)
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  test('shows runs cleared from score', () => {
    render(<VictoryScreen run={run} score={score} defeatedBossName={null} onNewRun={() => {}} />)
    expect(screen.getByText(/runs cleared: 2/i)).toBeInTheDocument()
  })

  test('calls onNewRun when Play Again is clicked', () => {
    const onNewRun = vi.fn()
    render(<VictoryScreen run={run} score={score} defeatedBossName={null} onNewRun={onNewRun} />)
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(onNewRun).toHaveBeenCalledTimes(1)
  })

  test('does not show boss name when defeatedBossName is null', () => {
    render(<VictoryScreen run={run} score={score} defeatedBossName={null} onNewRun={() => {}} />)
    expect(screen.queryByText(/you defeated/i)).not.toBeInTheDocument()
  })
})
