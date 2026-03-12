import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Keyboard from '../Keyboard'

describe('Keyboard', () => {
  it('renders 26 letter buttons', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(26)
  })

  it('disables already-guessed letters', () => {
    render(<Keyboard guessedLetters={['a', 'b']} correctLetters={['a']} onGuess={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: 'A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'B' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'C' })).not.toBeDisabled()
  })

  it('calls onGuess with the clicked letter', async () => {
    const onGuess = vi.fn()
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={onGuess} disabled={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(onGuess).toHaveBeenCalledWith('a')
  })

  it('disables all buttons when disabled prop is true', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={true} />)
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled())
  })

  it('renders blocked letters as disabled with key--blocked class', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} blockedLetters={['a', 'b']} />)
    const aBtn = screen.getByRole('button', { name: 'A' })
    expect(aBtn).toBeDisabled()
    expect(aBtn).toHaveClass('key--blocked')
    const bBtn = screen.getByRole('button', { name: 'B' })
    expect(bBtn).toBeDisabled()
    expect(bBtn).toHaveClass('key--blocked')
  })

  it('does not apply key--blocked class when blockedLetters is empty', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} blockedLetters={[]} />)
    screen.getAllByRole('button').forEach(btn => expect(btn).not.toHaveClass('key--blocked'))
  })

  it('disables void letters and applies key--void class', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} voidLetters={['a', 'b']} />)
    const aBtn = screen.getByRole('button', { name: 'A' })
    expect(aBtn).toBeDisabled()
    expect(aBtn).toHaveClass('key--void')
    const bBtn = screen.getByRole('button', { name: 'B' })
    expect(bBtn).toBeDisabled()
    expect(bBtn).toHaveClass('key--void')
    expect(screen.getByRole('button', { name: 'C' })).not.toBeDisabled()
  })

  it('does not disable mud letters but applies key--mud class', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} mudLetters={['a', 'b']} />)
    const aBtn = screen.getByRole('button', { name: 'A' })
    expect(aBtn).not.toBeDisabled()
    expect(aBtn).toHaveClass('key--mud')
    const bBtn = screen.getByRole('button', { name: 'B' })
    expect(bBtn).not.toBeDisabled()
    expect(bBtn).toHaveClass('key--mud')
  })

  it('disables vined letters and applies key--vined class', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} vinedLetters={['z', 'x']} />)
    const zBtn = screen.getByRole('button', { name: 'Z' })
    expect(zBtn).toBeDisabled()
    expect(zBtn).toHaveClass('key--vined')
    const xBtn = screen.getByRole('button', { name: 'X' })
    expect(xBtn).toBeDisabled()
    expect(xBtn).toHaveClass('key--vined')
    expect(screen.getByRole('button', { name: 'C' })).not.toBeDisabled()
  })
})
