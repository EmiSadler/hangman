import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'

describe('GameSetup', () => {
  it('renders a Play button', () => {
    render(<GameSetup onStart={vi.fn()} />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  })

  it('calls onStart when Play is clicked', async () => {
    const onStart = vi.fn()
    render(<GameSetup onStart={onStart} />)
    await userEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
