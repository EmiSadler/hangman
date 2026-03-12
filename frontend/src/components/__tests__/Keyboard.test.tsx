import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Keyboard from '../Keyboard'

describe('Keyboard', () => {
  it('disables void letters', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} voidLetters={['a', 'b']} />)
    expect(screen.getByRole('button', { name: 'A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'B' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'C' })).not.toBeDisabled()
  })

  it('does not disable mud letters', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} mudLetters={['a', 'b']} />)
    expect(screen.getByRole('button', { name: 'A' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'B' })).not.toBeDisabled()
  })

  it('disables vined letters', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} vinedLetters={['z', 'x']} />)
    expect(screen.getByRole('button', { name: 'Z' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'X' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'C' })).not.toBeDisabled()
  })
})
