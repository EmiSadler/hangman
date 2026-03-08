import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RunSetup from '../RunSetup'

const zeroScore = { runsCleared: 0, runsFailed: 0, bestRooms: 0 }

describe('RunSetup', () => {
  it('renders title', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /the hangman's dungeon/i })).toBeInTheDocument()
  })

  it('renders all 4 class cards', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByText(/vowel mage/i)).toBeInTheDocument()
    expect(screen.getByText(/archivist/i)).toBeInTheDocument()
    expect(screen.getByText(/berserker/i)).toBeInTheDocument()
    expect(screen.getByText(/rogue/i)).toBeInTheDocument()
  })

  it('Start Run button is disabled until a class is selected', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start run/i })).toBeDisabled()
  })

  it('Start Run button enables after selecting a class', async () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByText(/berserker/i))
    expect(screen.getByRole('button', { name: /start run/i })).not.toBeDisabled()
  })

  it('calls onStart with className when Start Run clicked', async () => {
    const onStart = vi.fn()
    render(<RunSetup onStart={onStart} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByText(/berserker/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    expect(onStart).toHaveBeenCalledWith('berserker')
  })

  it('calls onStart with vowel_mage when Vowel Mage selected', async () => {
    const onStart = vi.fn()
    render(<RunSetup onStart={onStart} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByText(/vowel mage/i))
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    expect(onStart).toHaveBeenCalledWith('vowel_mage')
  })

  it('shows how-to-play toggle', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /how to play/i })).toBeInTheDocument()
  })

  it('how-to-play content hidden by default', () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    expect(screen.queryByText(/3 floors/i)).not.toBeInTheDocument()
  })

  it('how-to-play content visible after clicking toggle', async () => {
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /how to play/i }))
    expect(screen.getByText(/3 floors/i)).toBeInTheDocument()
  })

  it('shows score', () => {
    render(<RunSetup onStart={vi.fn()} score={{ runsCleared: 2, runsFailed: 5, bestRooms: 18 }} onReset={vi.fn()} />)
    expect(screen.getByText(/2 runs cleared/i)).toBeInTheDocument()
  })

  it('calls onReset when Forget me clicked', async () => {
    const onReset = vi.fn()
    render(<RunSetup onStart={vi.fn()} score={zeroScore} onReset={onReset} />)
    await userEvent.click(screen.getByRole('button', { name: /forget me/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
