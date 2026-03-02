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
    expect(screen.getByRole('button', { name: 'B' })).toBeDisabled()
  })

  it('does not apply key--blocked class when blockedLetters is empty', () => {
    render(<Keyboard guessedLetters={[]} correctLetters={[]} onGuess={vi.fn()} disabled={false} />)
    screen.getAllByRole('button').forEach(btn => expect(btn).not.toHaveClass('key--blocked'))
  })
})
