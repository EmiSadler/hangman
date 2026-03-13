import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import ArtifactShelf from '../ArtifactShelf'

describe('ArtifactShelf', () => {
  it('renders nothing when artifacts is empty', () => {
    const { container } = render(<ArtifactShelf artifacts={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders an icon for each artifact', () => {
    render(<ArtifactShelf artifacts={['short_sword', 'iron_shield']} />)
    expect(screen.getByRole('img', { name: /short sword/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /iron shield/i })).toBeInTheDocument()
  })

  it('shows tooltip with name and description on hover', async () => {
    render(<ArtifactShelf artifacts={['short_sword']} />)
    await userEvent.hover(screen.getByRole('img', { name: /short sword/i }))
    expect(screen.getByText('Short Sword')).toBeInTheDocument()
    expect(screen.getByText(/\+1 bonus damage/i)).toBeInTheDocument()
  })

  it('hides tooltip after mouse leaves', async () => {
    render(<ArtifactShelf artifacts={['short_sword']} />)
    const item = screen.getByRole('img', { name: /short sword/i })
    await userEvent.hover(item)
    await userEvent.unhover(item)
    expect(screen.queryByText(/\+1 bonus damage/i)).not.toBeInTheDocument()
  })

  it('applies vertical modifier class when vertical prop is true', () => {
    const { container } = render(<ArtifactShelf artifacts={['short_sword']} vertical />)
    expect(container.firstChild).toHaveClass('artifact-shelf')
    expect(container.firstChild).toHaveClass('artifact-shelf--vertical')
  })

  it('does not apply vertical modifier class by default', () => {
    const { container } = render(<ArtifactShelf artifacts={['short_sword']} />)
    expect(container.firstChild).toHaveClass('artifact-shelf')
    expect(container.firstChild).not.toHaveClass('artifact-shelf--vertical')
  })

  it('applies two-col modifier when vertical and more than 3 artifacts', () => {
    const { container } = render(
      <ArtifactShelf artifacts={['short_sword', 'iron_shield', 'crystal_ball', 'blood_dagger']} vertical />
    )
    expect(container.firstChild).toHaveClass('artifact-shelf--two-col')
  })

  it('does not apply two-col modifier when 3 or fewer artifacts', () => {
    const { container } = render(
      <ArtifactShelf artifacts={['short_sword', 'iron_shield', 'crystal_ball']} vertical />
    )
    expect(container.firstChild).not.toHaveClass('artifact-shelf--two-col')
  })
})
