import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'

describe('GameSetup', () => {
  it('renders three difficulty buttons', () => {
    render(<GameSetup onStart={vi.fn()} />)
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /medium/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hard/i })).toBeInTheDocument()
  })

  it('calls onStart with easy when Easy is clicked', async () => {
    const onStart = vi.fn()
    render(<GameSetup onStart={onStart} />)
    await userEvent.click(screen.getByRole('button', { name: /easy/i }))
    expect(onStart).toHaveBeenCalledWith('easy')
  })

  it('calls onStart with hard when Hard is clicked', async () => {
    const onStart = vi.fn()
    render(<GameSetup onStart={onStart} />)
    await userEvent.click(screen.getByRole('button', { name: /hard/i }))
    expect(onStart).toHaveBeenCalledWith('hard')
  })
})
