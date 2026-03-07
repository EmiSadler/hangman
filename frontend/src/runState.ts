import type { Room, RunState, RunScore, RoomType, ClassName } from './types'

export const MAX_HP = 50
export const DAMAGE_PER_WRONG = 2
export const BASE_DAMAGE_PER_HIT = 2
export const COINS_PER_ENEMY = 5
export const COINS_PER_BOSS = 20
export const HEAL_COST = 10
export const HEAL_AMOUNT = 5
export const WRONG_SOLVE_PENALTY = 5

export const RUN_KEY = 'hangman_run'
export const SCORE_KEY = 'hangman_score'

const LAYOUT_A: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'rest',
  'enemy', 'treasure', 'enemy', 'enemy', 'enemy', 'boss',
]
const LAYOUT_B: RoomType[] = [
  'enemy', 'enemy', 'enemy', 'enemy', 'treasure',
  'enemy', 'rest', 'enemy', 'enemy', 'enemy', 'boss',
]

export function getFloorLayout(floor: number): RoomType[] {
  return floor === 2 ? LAYOUT_B : LAYOUT_A
}

export function buildRooms(floor: number): Room[] {
  return getFloorLayout(floor).map(type => ({ type, completed: false, gameId: null }))
}

export function buildRun(className: ClassName): RunState {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    coins: 0,
    floor: 1,
    roomIndex: 0,
    rooms: buildRooms(1),
    status: 'in_progress',
    pendingReveal: false,
    className,
    shield: 0,
    artifacts: [],
  }
}

export function enemyHp(wordLength: number, floor: number): number {
  return wordLength * floor * 2
}

export function computeRoomsCleared(run: RunState): number {
  return (run.floor - 1) * 11 + run.rooms.filter(r => r.completed).length
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RunState
    if (!parsed.artifacts) parsed.artifacts = []
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
