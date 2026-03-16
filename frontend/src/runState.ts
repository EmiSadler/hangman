import type { Room, RunState, RunScore, RoomType, ClassName, ThemeId, PotionId } from './types'

export const MAX_HP = 50

export const CLASS_MAX_HP: Record<import('./types').ClassName, number> = {
  vowel_mage: 50,
  berserker: 50,
  archivist: 45,
  rogue: 40,
}
export const DAMAGE_PER_WRONG = 2
export const BASE_DAMAGE_PER_HIT = 2
export const COINS_PER_ENEMY = 5
export const COINS_PER_BOSS = 20
export const POTION_HEAL_AMOUNT = 10
export const POTION_STRENGTH_BONUS = 2
export const POTION_SHIELD_AMOUNT = 5
export const MAX_POTION_SLOTS = 4
export const WRONG_SOLVE_PENALTY = 5
export const MAX_INVENTORY = 8

export const RUN_KEY = 'hangman_run'
export const SCORE_KEY = 'hangman_score'

export function pickFloorThemes(): [ThemeId, ThemeId, ThemeId] {
  const all: ThemeId[] = ['space', 'swamp', 'desert', 'jungle']
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]]
  }
  return [all[0], all[1], all[2]]
}

const LAYOUT_A: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'rest',
  'enemy', 'treasure', 'enemy', 'enemy', 'shop', 'enemy', 'boss',
]
const LAYOUT_B: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'treasure',
  'enemy', 'rest', 'enemy', 'enemy', 'shop', 'enemy', 'boss',
]

export function getFloorLayout(floor: number): RoomType[] {
  return floor === 2 ? LAYOUT_B : LAYOUT_A
}

export function buildRooms(floor: number): Room[] {
  return getFloorLayout(floor).map(type => ({ type, completed: false, gameId: null }))
}

export function buildRun(className: ClassName, floorThemes?: [ThemeId, ThemeId, ThemeId]): RunState {
  const maxHp = CLASS_MAX_HP[className]
  return {
    hp: maxHp,
    maxHp,
    coins: 0,
    floor: 1,
    roomIndex: 0,
    rooms: buildRooms(1),
    status: 'in_progress',
    pendingReveal: false,
    className,
    shield: 0,
    artifacts: [],
    potions: [] as PotionId[],
    sessionId: null,
    bonusDamage: 0,
    usedWords: [],
    floorThemes: floorThemes ?? ['space', 'swamp', 'desert'],
  }
}

export function enemyHp(wordLength: number, floor: number): number {
  return wordLength * floor * 2
}

export function computeRoomsCleared(run: RunState): number {
  return (run.floor - 1) * 12 + run.rooms.filter(r => r.completed).length
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RunState
    if (!parsed.artifacts) parsed.artifacts = []
    if (parsed.sessionId === undefined) parsed.sessionId = null
    if (parsed.bonusDamage === undefined) parsed.bonusDamage = 0
    if (!Array.isArray(parsed.usedWords)) parsed.usedWords = []
    if (!Array.isArray(parsed.potions)) parsed.potions = []
    if (!Array.isArray(parsed.floorThemes) || parsed.floorThemes.length !== 3) {
      parsed.floorThemes = pickFloorThemes()
    }
    return parsed
  } catch {
    return null
  }
}

export function saveRun(run: RunState): void {
  localStorage.setItem(RUN_KEY, JSON.stringify(run))
}

export function clearRun(): void {
  localStorage.removeItem(RUN_KEY)
}

export function loadRunScore(): RunScore {
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (!raw) return { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
    return JSON.parse(raw) as RunScore
  } catch {
    return { runsCleared: 0, runsFailed: 0, bestRooms: 0 }
  }
}

export function saveRunScore(score: RunScore): void {
  localStorage.setItem(SCORE_KEY, JSON.stringify(score))
}
