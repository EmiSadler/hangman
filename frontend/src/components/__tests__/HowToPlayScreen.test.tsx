import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import HowToPlayScreen from '../HowToPlayScreen'

describe('HowToPlayScreen', () => {
  it('renders all five sections', () => {
    render(<HowToPlayScreen onDone={vi.fn()} />)
    expect(screen.getByText(/the goal/i)).toBeInTheDocument()
    expect(screen.getByText(/combat/i)).toBeInTheDocument()
    expect(screen.getByText(/room types/i)).toBeInTheDocument()
    expect(screen.getByText(/classes/i)).toBeInTheDocument()
    expect(screen.getAllByText(/artifacts/i).length).toBeGreaterThan(0)
  })

  it('calls onDone when Got it button is clicked', async () => {
    const onDone = vi.fn()
    render(<HowToPlayScreen onDone={onDone} />)
    await userEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
