import { useState, useEffect, useRef } from 'react'
import type { GameState, Room, RunState, ClassName, ArtifactId, ThemeId } from '../types'
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
  onCombatEnd: (updatedRun: RunState, bossName?: string) => void
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

const ABILITY_DESCRIPTIONS: Record<ClassName, string> = {
  vowel_mage: 'Resonance (3-turn cd): choose a vowel — if in word, reveal all + gain 1 shield per instance; if not, take only 1 damage',
  archivist: 'Cross Reference (once/encounter): reveal 1 random letter OR eliminate 3 non-word letters',
  berserker: 'Bloodletter (4-turn cd): guess blindly — correct = double damage, wrong = double damage taken',
  rogue: 'Backstab (3-turn cd): after 2+ correct in a row — reveal 1 hidden letter + deal double combo damage',
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

const THEME_ENEMY_NAMES: Record<ThemeId, string[]> = {
  space:  ['Void Stalker', 'Nebula Wraith', 'Star Devourer', 'Cosmic Horror',
           'Event Horizon', 'Dark Matter', 'Gravity Well', 'Stellar Parasite'],
  swamp:  ['Bog Witch', 'Mud Golem', 'Fetid Lurker', 'Spore Shambler',
           'Swamp Troll', 'Plague Mosquito', 'Mire Beast', 'Toxic Salamander'],
  desert: ['Sand Wraith', 'Dune Scorpion', 'Heat Mirage', 'Dust Devil',
           'Bone Collector', 'Desert Sphinx', 'Sand Leech', 'Cactus Demon'],
  jungle: ['Vine Strangler', 'Poison Dart Frog', 'Canopy Serpent', 'Thorn Lizard',
           'Feral Hunter', 'Moss Titan', 'Jungle Witch', 'Spore Creeper'],
}

const THEME_BOSS_NAMES: Record<ThemeId, string[]> = {
  space:  ['The Singularity', 'Void Emperor', 'Entropy Lord', 'The Event Horizon'],
  swamp:  ['The Bog Queen', 'Ancient Ooze', 'The Pestilence', 'Swamp Colossus'],
  desert: ['The Sand King', 'The Buried God', 'Eternal Dune', 'The Bone Sovereign'],
  jungle: ['The Canopy Sovereign', 'Apex Predator', 'The Ancient Tree', 'The Green God'],
}

// Bottom-row-first so growVines iterates upward (z-row → a-row → q-row)
const KEYBOARD_ROWS = [
  ['z','x','c','v','b','n','m'],
  ['a','s','d','f','g','h','j','k','l'],
  ['q','w','e','r','t','y','u','i','o','p'],
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
  bonusDamage: number,
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
  total += bonusDamage
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
  const theme: ThemeId = run.floorThemes[floor - 1]
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
  const guessCountRef = useRef(0)
  const [voidLetters, setVoidLetters] = useState<string[]>([])
  const [mudLetters, setMudLetters] = useState<string[]>([])
  const [vinedLetters, setVinedLetters] = useState<string[]>([])
  const [castMessage, setCastMessage] = useState<string | null>(null)
  const enemyHpRef = useRef(maxEnemyHp)
  const [currentGame, setCurrentGame] = useState<GameState>(initialState)
  const [summoningHp, setSummoningHp] = useState<number | null>(null)
  const [nextGame, setNextGame] = useState<GameState | null>(null)

  useEffect(() => {
    if (currentEnemyHp <= 0 && !combatDone) {
      finishCombat(true)
    }
  }, [currentEnemyHp]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (theme !== 'jungle') return
    const bottomRow = KEYBOARD_ROWS[0]
    const shuffled = [...bottomRow].sort(() => Math.random() - 0.5)
    setVinedLetters([shuffled[0], shuffled[1]])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Artifact info-display values (computed once from props) ---
  const vowelCount = run.artifacts.includes('vowel_seeker' as ArtifactId)
    ? [...currentGame.word].filter(l => VOWELS.has(l)).length
    : null

  const showCategoryScroll =
    run.artifacts.includes('category_scroll' as ArtifactId) && run.className !== 'archivist'

  const [enemyName] = useState(() => {
    const pool = room.type === 'boss' ? THEME_BOSS_NAMES[theme] : THEME_ENEMY_NAMES[theme]
    return pool[Math.floor(Math.random() * pool.length)]
  })

  const [crystalBallLetter, setCrystalBallLetter] = useState<string | null>(() => {
    if (!run.artifacts.includes('crystal_ball' as ArtifactId)) return null
    const candidates = [...new Set(initialState.word.split(''))]
      .filter(l => !initialState.guessedLetters.includes(l) && l !== initialState.firstLetter)
    if (candidates.length === 0) return null
    return candidates[Math.floor(Math.random() * candidates.length)]
  })

  // Recompute crystal ball letter when a summoned word replaces the current word mid-combat
  useEffect(() => {
    if (currentGame.gameId === initialState.gameId) return
    if (!run.artifacts.includes('crystal_ball' as ArtifactId)) return
    const candidates = [...new Set(currentGame.word.split(''))]
      .filter(l => !currentGame.guessedLetters.includes(l) && l !== currentGame.firstLetter)
    setCrystalBallLetter(candidates.length === 0 ? null : candidates[Math.floor(Math.random() * candidates.length)])
  }, [currentGame.gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGuessResult(letter: string, correct: boolean, occurrences: number) {
    setCastMessage(null)
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
        currentHidden, isAbilityHit, run.artifacts, run.bonusDamage,
      )
      if (bloodDaggerReady && run.artifacts.includes('blood_dagger')) {
        dmg += 2
        setBloodDaggerReady(false)
      }
      const newEnemyHp = Math.max(0, enemyHpRef.current - dmg)
      enemyHpRef.current = newEnemyHp
      setCurrentEnemyHp(newEnemyHp)
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

      const { playerDmg: rawPlayerDmg, shieldLeft } = calcDamageTaken(
        letter, run.className, isAbilityMiss, displayRun.shield, run.artifacts,
      )
      const playerDmg = (theme === 'swamp' && mudLetters.includes(letter))
        ? rawPlayerDmg * 2
        : rawPlayerDmg
      const newHp = Math.max(0, displayRun.hp - playerDmg)
      setDisplayRun(prev => ({ ...prev, hp: newHp, shield: shieldLeft }))
      if (newHp <= 0) {
        finishCombat(false, newHp)
        return
      }
    }

    if (!wasAbilityMode) setCooldown(prev => Math.max(0, prev - 1))

    // Theme mechanics
    guessCountRef.current += 1
    const count = guessCountRef.current

    if (theme === 'space') {
      if (count % 3 === 2) {
        setCastMessage(`${enemyName} is gathering void energy...`)
      } else if (count % 3 === 0) {
        fireBlackHole()
      }
    } else if (theme === 'swamp') {
      if (count % 2 === 1) {
        setCastMessage(`${enemyName} is winding up...`)
      } else if (count % 2 === 0) {
        throwMud()
      }
    } else if (theme === 'desert' && !correct) {
      blowLetterAway()
    } else if (theme === 'jungle' && correct) {
      growVines(letter)
    }
  }

  async function handleWordSolved() {
    if (enemyHpRef.current > 0) {
      const hp = enemyHpRef.current
      setSummoningHp(hp)
      try {
        const res = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_type: room.type,
            ...(run.sessionId ? { session_id: run.sessionId } : {}),
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          finishCombat(true)
          return
        }
        setNextGame({
          gameId: data.game_id,
          word: data.word,
          maskedWord: data.masked_word,
          category: data.category,
          firstLetter: data.first_letter,
          guessedLetters: data.guessed_letters ?? [],
          status: 'in_progress',
        })
      } catch {
        finishCombat(true)
      }
    } else {
      finishCombat(true)
    }
  }

  function handleSummonContinue() {
    if (nextGame === null) return
    setCurrentGame(nextGame)
    setGuessedLetters([])
    setHiddenCount(nextGame.maskedWord.split(' ').filter(c => c === '_').length)
    setNextGame(null)
    setSummoningHp(null)
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
    const finalRun = pendingRun ?? displayRun
    const bossName = room.type === 'boss' && finalRun.hp > 0 ? enemyName : undefined
    onCombatEnd(finalRun, bossName)
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
    setDisplayRun(prev => ({ ...prev, hp: Math.max(0, prev.hp - WRONG_SOLVE_PENALTY) }))
    if (newHp <= 0) finishCombat(false, newHp)
  }

  function pickRandom(arr: string[], n: number): string[] {
    const pool = [...arr]
    const count = Math.min(n, pool.length)
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, count)
  }

  function getAvailable(): string[] {
    return ALPHABET.filter(l =>
      !guessedLetters.includes(l) &&
      !blockedLetters.includes(l) &&
      !voidLetters.includes(l) &&
      !vinedLetters.includes(l)
    )
  }

  function fireBlackHole() {
    const targets = pickRandom(getAvailable().filter(l => !mudLetters.includes(l)), 3)
    if (targets.length > 0) setVoidLetters(prev => [...prev, ...targets])
    setCastMessage(`${enemyName} casts Black Hole! ${targets.length} letter${targets.length !== 1 ? 's are' : ' is'} sucked into the void!`)
  }

  function throwMud() {
    const targets = pickRandom(getAvailable().filter(l => !mudLetters.includes(l)), 2)
    if (targets.length > 0) setMudLetters(prev => [...prev, ...targets])
    setCastMessage(`${enemyName} hurls mud! ${targets.length} letter${targets.length !== 1 ? 's are' : ' is'} stuck!`)
  }

  function blowLetterAway() {
    const available = getAvailable()
    if (available.length === 0) return
    const blown = available[Math.floor(Math.random() * available.length)]
    setBlockedLetters(prev => [...prev, blown])
    setCastMessage(`${enemyName} stirs the sands! '${blown.toUpperCase()}' blows away!`)
  }

  function growVines(justGuessed: string) {
    if (Math.random() >= 0.5) return
    for (const row of KEYBOARD_ROWS) {
      const available = row.filter(l => !vinedLetters.includes(l) && !guessedLetters.includes(l) && l !== justGuessed)
      if (available.length > 0) {
        const target = available[Math.floor(Math.random() * available.length)]
        setVinedLetters(prev => [...prev, target])
        setCastMessage(`${enemyName} spreads the jungle! Vines creep higher!`)
        return
      }
    }
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
    <div className="combat-view" data-theme={theme}>
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
              data-tooltip={ABILITY_DESCRIPTIONS[run.className]}
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
          <span>Category: {currentGame.category}</span>
          <span>First letter: {currentGame.firstLetter.toUpperCase()}</span>
          <span>{currentGame.word.length} letters</span>
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
            <span>📜 Category: {currentGame.category}</span>
          )}
        </div>
      )}
      {castMessage && (
        <div className="combat-view__cast-message">{castMessage}</div>
      )}
      {summoningHp !== null ? (
        <div className="summoning-screen">
          <p className="summoning-screen__message">
            The enemy survives with {summoningHp} HP!
          </p>
          <p className="summoning-screen__sub">They summon another word...</p>
          <button
            className="btn-leave"
            onClick={handleSummonContinue}
            disabled={nextGame === null}
          >
            Continue
          </button>
        </div>
      ) : (
        <GameBoard
          key={currentGame.gameId}
          initialState={currentGame}
          onGuessResult={handleGuessResult}
          onWordSolved={handleWordSolved}
          onPlayAgain={handleContinue}
          playAgainLabel={playAgainLabel}
          combatOver={combatDone || enemyDead}
          blockedLetters={blockedLetters}
          voidLetters={voidLetters}
          mudLetters={mudLetters}
          vinedLetters={vinedLetters}
          onWrongSolve={handleWrongSolve}
        />
      )}
    </div>
  )
}
