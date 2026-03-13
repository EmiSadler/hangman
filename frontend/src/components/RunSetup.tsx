import { useState } from 'react'
import type { RunScore, ClassName } from '../types'
import { CLASS_MAX_HP } from '../runState'

interface Props {
  onStart: (className: ClassName) => void
  score: RunScore
  onReset: () => void
  onShowHelp: () => void
}

const CLASSES: {
  id: ClassName
  emoji: string
  name: string
  passive: string
  active: string
  con: string
}[] = [
  {
    id: 'vowel_mage',
    emoji: '🧙',
    name: 'Vowel Mage',
    passive: 'Vowels deal +1 damage per occurrence',
    active: 'Resonance (3-turn cd): choose a vowel — if in word, reveal all + gain 1 shield per instance; if not, take only 1 damage',
    con: 'Wrong consonant guesses deal +1 damage to you',
  },
  {
    id: 'archivist',
    emoji: '📚',
    name: 'The Archivist',
    passive: 'See word category, first letter, and length; +1 damage per occurrence if 5+ letters still hidden',
    active: 'Cross Reference (once/encounter): reveal 1 random letter OR eliminate 3 non-word letters',
    con: 'Cannot deal bonus burst damage; -5 max HP',
  },
  {
    id: 'berserker',
    emoji: '🪓',
    name: 'Berserker',
    passive: 'Each wrong guess: +1 permanent damage this encounter (Rage). Correct guesses deal base + Rage.',
    active: 'Bloodletter (4-turn cd): guess blindly — correct = double damage, wrong = double damage taken',
    con: 'Cannot use reveal abilities or gain shield',
  },
  {
    id: 'rogue',
    emoji: '🗡️',
    name: 'Rogue',
    passive: 'Combo: each consecutive correct guess adds +1 stacking damage. Resets on wrong guess.',
    active: 'Backstab (3-turn cd): after 2+ correct in a row — reveal 1 hidden letter + deal double combo damage',
    con: 'Wrong guesses deal +1 damage to you; lowest max HP (40)',
  },
]

export default function RunSetup({ onStart, score, onReset, onShowHelp }: Props) {
  const [selected, setSelected] = useState<ClassName | null>(null)

  return (
    <div className="run-setup">
      <h1>The Hangman's Dungeon</h1>
      <p className="run-setup__score">
        {score.runsCleared} run{score.runsCleared !== 1 ? 's' : ''} cleared / {score.runsFailed} failed
        {' • '}best: {score.bestRooms} room{score.bestRooms !== 1 ? 's' : ''}
      </p>

      <h2 className="run-setup__choose-heading">Choose your class</h2>
      <div className="class-grid">
        {CLASSES.map(cls => (
          <button
            key={cls.id}
            className={`class-card${selected === cls.id ? ' class-card--selected' : ''}`}
            onClick={() => setSelected(cls.id)}
          >
            <div className="class-card__header">
              <span className="class-card__emoji">{cls.emoji}</span>
              <span className="class-card__name">{cls.name}</span>
              <span className="class-card__hp">{CLASS_MAX_HP[cls.id]} HP</span>
            </div>
            <p className="class-card__passive">{cls.passive}</p>
            <p className="class-card__active">{cls.active}</p>
            <p className="class-card__con">{cls.con}</p>
          </button>
        ))}
      </div>

      <button
        className="btn-start-run"
        onClick={() => selected && onStart(selected)}
        disabled={!selected}
      >
        Start Run
      </button>

      <button
        className="btn-how-to-play"
        onClick={onShowHelp}
      >
        How to play ?
      </button>

      <button className="btn-forget" onClick={onReset}>Forget me</button>
    </div>
  )
}
