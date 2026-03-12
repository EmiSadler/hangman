import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import FloorIntroScreen from '../FloorIntroScreen'
import { buildRun } from '../../runState'
import type { ThemeId } from '../../types'

function makeRun(floor: number, themes: [ThemeId, ThemeId, ThemeId]) {
  return { ...buildRun('berserker', themes), floor }
}

describe('FloorIntroScreen', () => {
  test('shows floor title for space theme', () => {
    const run = makeRun(1, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />)
    expect(screen.getByText('The Void Depths')).toBeInTheDocument()
  })

  test('shows floor number label', () => {
    const run = makeRun(2, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />)
    expect(screen.getByText('Floor 2')).toBeInTheDocument()
  })

  test('shows mechanic hint for swamp theme', () => {
    const run = makeRun(2, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />)
    expect(screen.getByText(/mud is hurled/i)).toBeInTheDocument()
  })

  test('shows victory line when defeatedBossName is provided', () => {
    const run = makeRun(2, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName="Void Emperor" onContinue={() => {}} />)
    expect(screen.getByText('You defeated Void Emperor!')).toBeInTheDocument()
  })

  test('does not show victory line when defeatedBossName is null', () => {
    const run = makeRun(1, ['space', 'swamp', 'desert'])
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />)
    expect(screen.queryByText(/you defeated/i)).not.toBeInTheDocument()
  })

  test('calls onContinue when Enter Floor button is clicked', () => {
    const run = makeRun(1, ['space', 'swamp', 'desert'])
    const onContinue = vi.fn()
    render(<FloorIntroScreen run={run} defeatedBossName={null} onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button', { name: /enter floor 1/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  test('applies data-theme attribute from the floor theme', () => {
    const run = makeRun(1, ['jungle', 'swamp', 'desert'])
    const { container } = render(
      <FloorIntroScreen run={run} defeatedBossName={null} onContinue={() => {}} />
    )
    expect(container.firstChild).toHaveAttribute('data-theme', 'jungle')
  })
})
