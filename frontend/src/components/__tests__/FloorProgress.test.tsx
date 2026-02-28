import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FloorProgress from '../FloorProgress'
import { buildRooms } from '../../runState'

describe('FloorProgress', () => {
  it('renders 11 room cells', () => {
    const rooms = buildRooms(1)
    render(<FloorProgress rooms={rooms} currentIndex={0} floor={1} />)
    expect(screen.getAllByText(/^[ERTB]$/).length).toBe(11)
  })

  it('has accessible label with floor number', () => {
    render(<FloorProgress rooms={buildRooms(1)} currentIndex={0} floor={2} />)
    expect(screen.getByLabelText(/floor 2/i)).toBeInTheDocument()
  })

  it('marks current room with current modifier class', () => {
    const rooms = buildRooms(1)
    const { container } = render(<FloorProgress rooms={rooms} currentIndex={3} floor={1} />)
    const cells = container.querySelectorAll('.floor-progress__room')
    expect(cells[3].classList.contains('floor-progress__room--current')).toBe(true)
    expect(cells[2].classList.contains('floor-progress__room--current')).toBe(false)
  })

  it('marks completed rooms with completed modifier class', () => {
    const rooms = buildRooms(1)
    rooms[0] = { ...rooms[0], completed: true }
    rooms[1] = { ...rooms[1], completed: true }
    const { container } = render(<FloorProgress rooms={rooms} currentIndex={2} floor={1} />)
    const cells = container.querySelectorAll('.floor-progress__room')
    expect(cells[0].classList.contains('floor-progress__room--completed')).toBe(true)
    expect(cells[1].classList.contains('floor-progress__room--completed')).toBe(true)
    expect(cells[2].classList.contains('floor-progress__room--completed')).toBe(false)
  })

  it('boss room shows "B"', () => {
    const rooms = buildRooms(1)  // index 10 is boss
    render(<FloorProgress rooms={rooms} currentIndex={0} floor={1} />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('rest room shows "R"', () => {
    render(<FloorProgress rooms={buildRooms(1)} currentIndex={0} floor={1} />)
    expect(screen.getByText('R')).toBeInTheDocument()
  })

  it('treasure room shows "T"', () => {
    render(<FloorProgress rooms={buildRooms(1)} currentIndex={0} floor={1} />)
    expect(screen.getByText('T')).toBeInTheDocument()
  })
})
