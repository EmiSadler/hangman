import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RunResult from '../RunResult'

const zeroScore = { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
const someScore = { runsCleared: 3, runsFailed: 2, bestRooms: 22 }

describe('RunResult', () => {
  it('shows "Dungeon Cleared!" when won', () => {
    render(<RunResult won={true} roomsCleared={33} score={zeroScore} onNewRun={vi.fn()} />)
    expect(screen.getByText(/dungeon cleared/i)).toBeInTheDocument()
  })

  it('shows "You Died" when lost', () => {
    render(<RunResult won={false} roomsCleared={7} score={zeroScore} onNewRun={vi.fn()} />)
    expect(screen.getByText(/you died/i)).toBeInTheDocument()
  })

  it('shows rooms cleared count', () => {
    render(<RunResult won={false} roomsCleared={12} score={zeroScore} onNewRun={vi.fn()} />)
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })

  it('shows updated score', () => {
    render(<RunResult won={true} roomsCleared={33} score={someScore} onNewRun={vi.fn()} />)
    expect(screen.getByText(/3 runs cleared/i)).toBeInTheDocument()
    expect(screen.getByText(/2 failed/i)).toBeInTheDocument()
    expect(screen.getByText(/best: 22 rooms/i)).toBeInTheDocument()
  })

  it('renders Start New Run button', () => {
    render(<RunResult won={false} roomsCleared={5} score={zeroScore} onNewRun={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start new run/i })).toBeInTheDocument()
  })

  it('calls onNewRun when button is clicked', async () => {
    const onNewRun = vi.fn()
    render(<RunResult won={false} roomsCleared={5} score={zeroScore} onNewRun={onNewRun} />)
    await userEvent.click(screen.getByRole('button', { name: /start new run/i }))
    expect(onNewRun).toHaveBeenCalledOnce()
  })
})
