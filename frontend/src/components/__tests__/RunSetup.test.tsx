import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RunSetup from '../RunSetup'

const zeroScore = { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
const someScore = { runsCleared: 2, runsFailed: 5, bestRooms: 18 }

describe('RunSetup', () => {
  it('renders title', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /dungeon hangman/i })).toBeInTheDocument()
  })

  it('renders Start Run button', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start run/i })).toBeInTheDocument()
  })

  it('renders Forget me button', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /forget me/i })).toBeInTheDocument()
  })

  it('shows zero score correctly', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByText(/0 runs cleared/i)).toBeInTheDocument()
    expect(screen.getByText(/0 failed/i)).toBeInTheDocument()
    expect(screen.getByText(/best: 0 rooms/i)).toBeInTheDocument()
  })

  it('shows non-zero score correctly', () => {
    render(<RunSetup onStart={vi.fn()} score={someScore} onReset={vi.fn()} />)
    expect(screen.getByText(/2 runs cleared/i)).toBeInTheDocument()
    expect(screen.getByText(/5 failed/i)).toBeInTheDocument()
    expect(screen.getByText(/best: 18 rooms/i)).toBeInTheDocument()
  })

  it('calls onStart when Start Run is clicked', async () => {
    const onStart = vi.fn()
    render(<RunSetup onStart={onStart} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('calls onReset when Forget me is clicked', async () => {
    const onReset = vi.fn()
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={onReset} />)
    await userEvent.click(screen.getByRole('button', { name: /forget me/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('uses singular "run" when runsCleared is 1', () => {
    render(<RunSetup onStart={vi.fn()} score={{ runsCleared: 1, runsFailed: 0, bestRooms: 5 }} onReset={vi.fn()} />)
    expect(screen.getByText(/1 run cleared/i)).toBeInTheDocument()
  })
})
