import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HangmanSvg from '../HangmanSvg'

describe('HangmanSvg', () => {
  it('renders an svg element', () => {
    const { container } = render(<HangmanSvg wrongCount={0} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('shows head after 1 wrong guess', () => {
    const { container } = render(<HangmanSvg wrongCount={1} />)
    expect(container.querySelector('[data-part="head"]')).toBeInTheDocument()
  })

  it('does not show head with 0 wrong guesses', () => {
    const { container } = render(<HangmanSvg wrongCount={0} />)
    expect(container.querySelector('[data-part="head"]')).not.toBeInTheDocument()
  })

  it('shows body after 2 wrong guesses', () => {
    const { container } = render(<HangmanSvg wrongCount={2} />)
    expect(container.querySelector('[data-part="body"]')).toBeInTheDocument()
  })

  it('shows all parts after 6 wrong guesses', () => {
    const { container } = render(<HangmanSvg wrongCount={6} />)
    const parts = ['head', 'body', 'left-arm', 'right-arm', 'left-leg', 'right-leg']
    parts.forEach((part) => {
      expect(container.querySelector(`[data-part="${part}"]`)).toBeInTheDocument()
    })
  })
})
