import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import WordDisplay from '../WordDisplay'

describe('WordDisplay', () => {
  it('renders underscores for unrevealed letters', () => {
    render(<WordDisplay maskedWord="_ _ _" />)
    const blanks = screen.getAllByText('_')
    expect(blanks).toHaveLength(3)
  })

  it('renders revealed letters', () => {
    render(<WordDisplay maskedWord="c a _" />)
    expect(screen.getByText('c')).toBeInTheDocument()
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('_')).toBeInTheDocument()
  })

  it('renders all letters when word is fully guessed', () => {
    render(<WordDisplay maskedWord="c a t" />)
    expect(screen.getByText('c')).toBeInTheDocument()
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('t')).toBeInTheDocument()
  })
})
