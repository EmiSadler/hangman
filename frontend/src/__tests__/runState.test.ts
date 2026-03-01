import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getFloorLayout, buildRooms, buildRun, loadRun, saveRun, clearRun,
  loadRunScore, saveRunScore, enemyHp, computeRoomsCleared,
  MAX_HP, DAMAGE_PER_WRONG, COINS_PER_ENEMY, COINS_PER_BOSS, HEAL_COST, HEAL_AMOUNT,
} from '../runState'
import type { ClassName } from '../types'

describe('constants', () => {
  it('MAX_HP is 50', () => expect(MAX_HP).toBe(50))
  it('DAMAGE_PER_WRONG is 2', () => expect(DAMAGE_PER_WRONG).toBe(2))
  it('COINS_PER_ENEMY is 5', () => expect(COINS_PER_ENEMY).toBe(5))
  it('COINS_PER_BOSS is 20', () => expect(COINS_PER_BOSS).toBe(20))
  it('HEAL_COST is 10', () => expect(HEAL_COST).toBe(10))
  it('HEAL_AMOUNT is 5', () => expect(HEAL_AMOUNT).toBe(5))
})

describe('getFloorLayout', () => {
  it('floor 1 has rest at index 4, treasure at index 6, boss at index 10', () => {
    const layout = getFloorLayout(1)
    expect(layout[4]).toBe('rest')
    expect(layout[6]).toBe('treasure')
    expect(layout[10]).toBe('boss')
  })
  it('floor 2 has treasure at index 4, rest at index 6, boss at index 10', () => {
    const layout = getFloorLayout(2)
    expect(layout[4]).toBe('treasure')
    expect(layout[6]).toBe('rest')
    expect(layout[10]).toBe('boss')
  })
  it('floor 3 layout matches floor 1', () => {
    expect(getFloorLayout(3)).toEqual(getFloorLayout(1))
  })
  it('all layouts have exactly 11 rooms', () => {
    expect(getFloorLayout(1).length).toBe(11)
    expect(getFloorLayout(2).length).toBe(11)
    expect(getFloorLayout(3).length).toBe(11)
  })
})

describe('buildRooms', () => {
  it('creates 11 rooms, all incomplete with null gameId', () => {
    const rooms = buildRooms(1)
    expect(rooms.length).toBe(11)
    expect(rooms.every(r => !r.completed)).toBe(true)
    expect(rooms.every(r => r.gameId === null)).toBe(true)
  })
  it('room types match floor layout', () => {
    const rooms = buildRooms(2)
    expect(rooms[4].type).toBe('treasure')
    expect(rooms[6].type).toBe('rest')
  })
})

describe('buildRun', () => {
  it('starts with correct defaults', () => {
    const run = buildRun('berserker')
    expect(run.hp).toBe(MAX_HP)
    expect(run.maxHp).toBe(MAX_HP)
    expect(run.coins).toBe(0)
    expect(run.floor).toBe(1)
    expect(run.roomIndex).toBe(0)
    expect(run.status).toBe('in_progress')
    expect(run.pendingReveal).toBe(false)
    expect(run.rooms.length).toBe(11)
  })
})

describe('enemyHp', () => {
  it('returns wordLength * floor', () => {
    expect(enemyHp(5, 1)).toBe(5)
    expect(enemyHp(8, 2)).toBe(16)
    expect(enemyHp(10, 3)).toBe(30)
  })
})

describe('computeRoomsCleared', () => {
  it('returns completed room count plus previous floors', () => {
    const run = buildRun('berserker')
    run.rooms[0] = { ...run.rooms[0], completed: true }
    run.rooms[1] = { ...run.rooms[1], completed: true }
    expect(computeRoomsCleared(run)).toBe(2)
  })
  it('accounts for floor offset', () => {
    const run = buildRun('berserker')
    run.floor = 2
    run.rooms[0] = { ...run.rooms[0], completed: true }
    expect(computeRoomsCleared(run)).toBe(12) // 11 from floor 1 + 1 from floor 2
  })
})

describe('localStorage helpers', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('loadRun returns null when nothing stored', () => {
    expect(loadRun()).toBeNull()
  })
  it('saveRun and loadRun round-trip', () => {
    const run = buildRun('berserker')
    saveRun(run)
    expect(loadRun()).toEqual(run)
  })
  it('clearRun removes saved run', () => {
    saveRun(buildRun('berserker'))
    clearRun()
    expect(loadRun()).toBeNull()
  })
  it('loadRun returns null on invalid JSON', () => {
    localStorage.setItem('hangman_run', 'not-json')
    expect(loadRun()).toBeNull()
  })
  it('loadRunScore returns zeros when nothing stored', () => {
    expect(loadRunScore()).toEqual({ runsCleared: 0, runsFailed: 0, bestRooms: 0 })
  })
  it('saveRunScore and loadRunScore round-trip', () => {
    const score = { runsCleared: 2, runsFailed: 5, bestRooms: 18 }
    saveRunScore(score)
    expect(loadRunScore()).toEqual(score)
  })
  it('loadRunScore returns zeros on invalid JSON', () => {
    localStorage.setItem('hangman_score', 'bad')
    expect(loadRunScore()).toEqual({ runsCleared: 0, runsFailed: 0, bestRooms: 0 })
  })
})

describe('buildRun with className', () => {
  it('stores className on RunState', () => {
    const run = buildRun('vowel_mage')
    expect(run.className).toBe('vowel_mage')
  })

  it('initialises shield to 0', () => {
    const run = buildRun('berserker')
    expect(run.shield).toBe(0)
  })

  it('accepts all four class names', () => {
    const classes: ClassName[] = ['vowel_mage', 'archivist', 'berserker', 'rogue']
    for (const cls of classes) {
      expect(() => buildRun(cls)).not.toThrow()
    }
  })
})
