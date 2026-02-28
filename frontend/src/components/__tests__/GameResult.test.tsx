import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import GameResult from '../GameResult'

describe('GameResult', () => {
  it('shows win message on won status', () => {
    render(<GameResult status="won" word="python" onPlayAgain={vi.fn()} />)
    expect(screen.getByText(/you won/i)).toBeInTheDocument()
  })

  it('shows lose message on lost status', () => {
    render(<GameResult status="lost" word="python" onPlayAgain={vi.fn()} />)
    expect(screen.getByText(/game over/i)).toBeInTheDocument()
  })

  it('always reveals the word', () => {
    render(<GameResult status="won" word="python" onPlayAgain={vi.fn()} />)
    expect(screen.getByText(/python/i)).toBeInTheDocument()
  })

  it('calls onPlayAgain when Play Again is clicked', async () => {
    const onPlayAgain = vi.fn()
    render(<GameResult status="won" word="cat" onPlayAgain={onPlayAgain} />)
    await userEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(onPlayAgain).toHaveBeenCalled()
  })

  it('shows custom buttonLabel when provided', () => {
    render(<GameResult status="lost" word="python" onPlayAgain={vi.fn()} buttonLabel="Continue" />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })
})
