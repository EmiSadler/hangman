import { useState, useEffect } from 'react'
import type { GameState, Room, RunState, ClassName, ArtifactId } from '../types'
import {
  DAMAGE_PER_WRONG, BASE_DAMAGE_PER_HIT,
  COINS_PER_ENEMY, COINS_PER_BOSS, enemyHp,
  HEAL_AMOUNT, WRONG_SOLVE_PENALTY,
} from '../runState'
import GameBoard from './GameBoard'
import ArtifactShelf from './ArtifactShelf'

interface Props {
  run: RunState
  room: Room
  initialState: GameState
  floor: number
  onCombatEnd: (updatedRun: RunState) => void
}

const CLASS_LABELS: Record<ClassName, string> = {
  vowel_mage: '🧙 Vowel Mage',
  archivist: '📚 Archivist',
  berserker: '🪓 Berserker',
  rogue: '🗡️ Rogue',
}

const ABILITY_NAMES: Record<ClassName, string> = {
  vowel_mage: 'Resonance',
  archivist: 'Cross Reference',
  berserker: 'Bloodletter',
  rogue: 'Backstab',
}

const ABILITY_COOLDOWNS: Record<ClassName, number> = {
  vowel_mage: 3,
  archivist: 0, // once per encounter, tracked separately
  berserker: 4,
  rogue: 3,
}

export const ENEMY_NAMES = [
  'Swamp Monster', 'Skeleton Archer', 'Mutated Bee', 'Cave Troll',
  'Plague Rat', 'Stone Golem', 'Shadow Wraith', 'Bog Witch',
  'Dire Wolf', 'Fungal Horror', 'Cursed Scarecrow', 'Sand Shark',
]

export const BOSS_NAMES = [
  'Death Knight', 'Ancient Vampire', 'The Hollow King',
  'Bone Colossus', 'Plague Bringer', 'Void Serpent',
  'The Undying', 'Abyssal Tyrant',
]

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('')

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

function calcDamageDealt(
  letter: string,
  occurrences: number,
  className: ClassName,
  rage: number,
  combo: number,
  hiddenCount: number,
  isAbilityHit: boolean,
  artifacts: ArtifactId[],
): number {
  let dmgPerOcc = BASE_DAMAGE_PER_HIT

  switch (className) {
    case 'vowel_mage':
      if (VOWELS.has(letter)) dmgPerOcc += 1
      break
    case 'archivist':
      if (hiddenCount >= 5) dmgPerOcc += 1
      break
    case 'berserker':
      dmgPerOcc = BASE_DAMAGE_PER_HIT + rage
      break
    case 'rogue':
      dmgPerOcc = BASE_DAMAGE_PER_HIT + combo
      break
  }

  let total = dmgPerOcc * occurrences
  if (isAbilityHit && (className === 'berserker' || className === 'rogue')) {
    total *= 2
  }
  if (artifacts.includes('short_sword')) total += 1
  return total
}

function calcDamageTaken(
  letter: string,
  className: ClassName,
  isAbilityMiss: boolean,
  shield: number,
  artifacts: ArtifactId[],
): { playerDmg: number; shieldLeft: number } {
  const isConsonant = !VOWELS.has(letter)
  let dmg = DAMAGE_PER_WRONG

  if (className === 'vowel_mage' && isConsonant) dmg += 1
  if (className === 'rogue') dmg += 1
  if (className === 'berserker' && isAbilityMiss) dmg *= 2
  if (artifacts.includes('thick_skin')) dmg = Math.max(1, dmg - 1)

  const absorbed = Math.min(shield, dmg)
  return { playerDmg: dmg - absorbed, shieldLeft: shield - absorbed }
}

export default function CombatView({ run, room, initialState, floor, onCombatEnd }: Props) {
  const maxEnemyHp = enemyHp(initialState.word.length, floor)
  const [currentEnemyHp, setCurrentEnemyHp] = useState(maxEnemyHp)
  const [displayRun, setDisplayRun] = useState<RunState>(() =>
    run.artifacts.includes('iron_shield' as ArtifactId)
      ? { ...run, shield: run.shield + 2 }
      : run
  )
  const [combatDone, setCombatDone] = useState(false)
  const [pendingRun, setPendingRun] = useState<RunState | null>(null)

  // Per-encounter state
  const [rage, setRage] = useState(() => run.artifacts.includes('battle_scar' as ArtifactId) ? 1 : 0)
  const [combo, setCombo] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const [abilityUsesLeft, setAbilityUsesLeft] = useState(() =>
    run.className === 'archivist' && run.artifacts.includes('ancient_codex') ? 2 : 1
  )
  const [abilityMode, setAbilityMode] = useState(false)
  const [bloodDaggerReady, setBloodDaggerReady] = useState(false)
  const [hiddenCount, setHiddenCount] = useState(
    () => initialState.maskedWord.split(' ').filter(c => c === '_').length
  )
  const [blockedLetters, setBlockedLetters] = useState<string[]>([])
  const [guessedLetters, setGuessedLetters] = useState<string[]>(initialState.guessedLetters)

  useEffect(() => {
    if (currentEnemyHp <= 0 && !combatDone) {
      finishCombat(true)
    }
  }, [currentEnemyHp]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Artifact info-display values (computed once from props) ---
  const vowelCount = run.artifacts.includes('vowel_seeker' as ArtifactId)
    ? [...initialState.word].filter(l => VOWELS.has(l)).length
    : null

  const showCategoryScroll =
    run.artifacts.includes('category_scroll' as ArtifactId) && run.className !== 'archivist'

  const [enemyName] = useState(() => {
    const pool = room.type === 'boss' ? BOSS_NAMES : ENEMY_NAMES
    return pool[Math.floor(Math.random() * pool.length)]
  })

  const [crystalBallLetter] = useState<string | null>(() => {
    if (!run.artifacts.includes('crystal_ball' as ArtifactId)) return null
    const candidates = [...new Set(initialState.word.split(''))]
      .filter(l => !initialState.guessedLetters.includes(l) && l !== initialState.firstLetter)
    if (candidates.length === 0) return null
    return candidates[Math.floor(Math.random() * candidates.length)]
  })

  function handleGuessResult(letter: string, correct: boolean, occurrences: number) {
    const isAbilityHit = abilityMode && correct
    const isAbilityMiss = abilityMode && !correct
    const wasAbilityMode = abilityMode

    setGuessedLetters(prev => [...prev, letter])

    if (wasAbilityMode) {
      setAbilityMode(false)
      if (run.className === 'vowel_mage' || run.className === 'berserker' || run.className === 'rogue') {
        const baseCooldown = ABILITY_COOLDOWNS[run.className]
        setCooldown(Math.max(0, baseCooldown - (run.artifacts.includes('mana_crystal') ? 1 : 0)))
      }
      if (run.className === 'archivist') setAbilityUsesLeft(prev => Math.max(0, prev - 1))
    }

    if (correct) {
      const currentHidden = hiddenCount
      const currentCombo = combo
      let dmg = calcDamageDealt(
        letter, occurrences, run.className, rage, currentCombo,
        currentHidden, isAbilityHit, run.artifacts,
      )
      if (bloodDaggerReady && run.artifacts.includes('blood_dagger')) {
        dmg += 2
        setBloodDaggerReady(false)
      }
      setCurrentEnemyHp(prev => Math.max(0, prev - dmg))
      setHiddenCount(prev => Math.max(0, prev - occurrences))
      if (run.className === 'rogue') setCombo(prev => prev + 1)
      if (run.className === 'vowel_mage' && isAbilityHit && VOWELS.has(letter)) {
        setDisplayRun(prev => ({ ...prev, shield: prev.shield + occurrences }))
      }
    } else {
      if (run.className === 'rogue') {
        setCombo(run.artifacts.includes('shadow_cloak') ? Math.max(1, combo) : 0)
      }
      if (run.className === 'berserker') setRage(prev => prev + 1)
      if (run.artifacts.includes('blood_dagger')) setBloodDaggerReady(true)

      const { playerDmg, shieldLeft } = calcDamageTaken(
        letter, run.className, isAbilityMiss, displayRun.shield, run.artifacts,
      )
      const newHp = Math.max(0, displayRun.hp - playerDmg)
      setDisplayRun(prev => ({ ...prev, hp: newHp, shield: shieldLeft }))
      if (newHp <= 0) {
        finishCombat(false, newHp)
        return
      }
    }

    if (!wasAbilityMode) setCooldown(prev => Math.max(0, prev - 1))
  }

  function handleWordSolved() {
    finishCombat(true)
  }

  function finishCombat(won: boolean, hpOverride?: number) {
    let coinsEarned = won ? (room.type === 'boss' ? COINS_PER_BOSS : COINS_PER_ENEMY) : 0
    let effectiveHp = hpOverride ?? displayRun.hp

    if (won) {
      if (run.artifacts.includes('healing_salve')) {
        effectiveHp = Math.min(displayRun.maxHp, effectiveHp + 3)
      }
      if (run.artifacts.includes('gold_tooth')) {
        coinsEarned += 5
      }
    }

    const updated: RunState = {
      ...displayRun,
      hp: effectiveHp,
      coins: displayRun.coins + coinsEarned,
      status: effectiveHp <= 0 ? 'lost' : run.status,
    }
    setPendingRun(updated)
    setDisplayRun(updated)
    setCombatDone(true)
  }

  function handleContinue() {
    onCombatEnd(pendingRun ?? displayRun)
  }

  function handleAbility() {
    setAbilityMode(true)
  }

  function handleHeal() {
    const available = ALPHABET.filter(l => !guessedLetters.includes(l) && !blockedLetters.includes(l))
    if (available.length === 0) return
    const blocked = available[Math.floor(Math.random() * available.length)]
    setBlockedLetters(prev => [...prev, blocked])
    setDisplayRun(prev => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + HEAL_AMOUNT) }))
  }

  function handleWrongSolve() {
    const newHp = Math.max(0, displayRun.hp - WRONG_SOLVE_PENALTY)
    setDisplayRun(prev => ({ ...prev, hp: newHp }))
    if (newHp <= 0) finishCombat(false, newHp)
  }

  const enemyDead = currentEnemyHp <= 0 && !combatDone

  const playAgainLabel = displayRun.hp <= 0 ? 'Play Again' : 'Continue'

  const abilityName = ABILITY_NAMES[run.className]
  const abilityAvailable = run.className === 'archivist'
    ? abilityUsesLeft > 0
    : cooldown === 0
  const abilityDisabled = !abilityAvailable || abilityMode || combatDone || enemyDead
  const abilityLabel = abilityMode
    ? `${abilityName} — choose a letter`
    : cooldown > 0
    ? `${abilityName} (${cooldown})`
    : abilityUsesLeft === 0 && run.className === 'archivist'
    ? `${abilityName} (used)`
    : abilityName

  return (
    <div className="combat-view">
      <p className="combat-view__floor">Floor {floor}</p>
      <div className="combat-view__arena">
        <div className="combat-view__player">
          <div className="combat-view__class-label">{CLASS_LABELS[run.className]}</div>
          <div className="combat-view__player-sprite-row">
            <ArtifactShelf artifacts={run.artifacts} vertical />
            <div className="combat-view__player-sprite-placeholder" aria-hidden="true" />
          </div>
          <div className="combat-view__player-hp-bar">
            <div
              className="combat-view__player-hp-fill"
              style={{ width: `${Math.max(0, (displayRun.hp / displayRun.maxHp) * 100)}%` }}
            />
          </div>
          <div className="combat-view__stats">
            <span className="combat-view__hp">
              HP: {displayRun.hp} / {displayRun.maxHp}
              {displayRun.shield > 0 && <span className="combat-view__shield"> 🛡 {displayRun.shield}</span>}
            </span>
            <span className="combat-view__coins">Coins: {displayRun.coins}</span>
          </div>
          {!combatDone && !enemyDead && (
            <button
              className="btn-ability"
              onClick={handleAbility}
              disabled={abilityDisabled}
            >
              {abilityLabel}
            </button>
          )}
          {!combatDone && !enemyDead && (
            <button
              className="btn-heal"
              onClick={handleHeal}
              disabled={displayRun.hp >= displayRun.maxHp || ALPHABET.every(l => guessedLetters.includes(l) || blockedLetters.includes(l))}
            >
              🩹 Heal (+5 HP)
            </button>
          )}
        </div>
        <div className="combat-view__enemy">
          <div className="combat-view__enemy-name">{enemyName}</div>
          <div className="combat-view__enemy-sprite-placeholder" aria-hidden="true" />
          <div className="combat-view__enemy-hp-label">
            Enemy HP: {Math.max(0, currentEnemyHp)} / {maxEnemyHp}
          </div>
          <div className="combat-view__enemy-hp-bar">
            <div
              className="combat-view__enemy-hp-fill"
              style={{ width: `${Math.max(0, (currentEnemyHp / maxEnemyHp) * 100)}%` }}
            />
          </div>
        </div>
      </div>
      {run.className === 'archivist' && (
        <div className="combat-view__archivist-info">
          <span>Category: {initialState.category}</span>
          <span>First letter: {initialState.firstLetter.toUpperCase()}</span>
          <span>{initialState.word.length} letters</span>
        </div>
      )}
      {(vowelCount !== null || crystalBallLetter !== null || showCategoryScroll) && (
        <div className="combat-view__artifact-info">
          {vowelCount !== null && (
            <span>🔍 {vowelCount} {vowelCount === 1 ? 'vowel' : 'vowels'} in this word</span>
          )}
          {crystalBallLetter !== null && (
            <span>🔮 {crystalBallLetter.toUpperCase()} is in this word</span>
          )}
          {showCategoryScroll && (
            <span>📜 Category: {initialState.category}</span>
          )}
        </div>
      )}
      <GameBoard
        initialState={initialState}
        onGuessResult={handleGuessResult}
        onWordSolved={handleWordSolved}
        onPlayAgain={handleContinue}
        playAgainLabel={playAgainLabel}
        combatOver={combatDone || enemyDead}
        blockedLetters={blockedLetters}
        onWrongSolve={handleWrongSolve}
      />
    </div>
  )
}
