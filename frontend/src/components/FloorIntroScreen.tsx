import type { RunState } from '../types'
import type { ThemeId } from '../types'

interface FloorIntroScreenProps {
  run: RunState
  defeatedBossName: string | null
  onContinue: () => void
}

const FLOOR_INTRO_DATA: Record<ThemeId, { title: string; tagline: string; mechanicHint: string }> = {
  space: {
    title: 'The Void Depths',
    tagline: 'Stars die here. The silence between them is hungry.',
    mechanicHint: 'Every 3 guesses, your enemy tears letters into the void — unplayable, gone.',
  },
  swamp: {
    title: 'The Festering Mire',
    tagline: 'The water does not move. Neither do the things beneath it.',
    mechanicHint: 'Every 2 guesses, mud is hurled at your keyboard — wrong guesses on stuck letters deal double damage.',
  },
  desert: {
    title: 'The Endless Dune',
    tagline: 'The wind remembers every traveller who did not make it.',
    mechanicHint: 'Each wrong guess, the wind steals another letter from you.',
  },
  jungle: {
    title: 'The Canopy Dark',
    tagline: 'The light that reaches the floor has forgotten what it came from.',
    mechanicHint: 'Correct guesses invite vines — they creep up your keyboard with every letter you find.',
  },
}

export default function FloorIntroScreen({ run, defeatedBossName, onContinue }: FloorIntroScreenProps) {
  const theme = run.floorThemes[run.floor - 1]
  const data = FLOOR_INTRO_DATA[theme]

  return (
    <div className="floor-intro" data-theme={theme}>
      {defeatedBossName && (
        <p className="floor-intro__victory">You defeated {defeatedBossName}!</p>
      )}
      <p className="floor-intro__floor-label">Floor {run.floor}</p>
      <h1 className="floor-intro__title">{data.title}</h1>
      <p className="floor-intro__tagline">{data.tagline}</p>
      <p className="floor-intro__hint">{data.mechanicHint}</p>
      <button className="btn btn-primary floor-intro__btn" onClick={onContinue}>
        Enter Floor {run.floor}
      </button>
    </div>
  )
}
