import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getFloorLayout, buildRooms, buildRun, loadRun, saveRun, clearRun,
  loadRunScore, saveRunScore, enemyHp, computeRoomsCleared,
  MAX_HP, DAMAGE_PER_WRONG, BASE_DAMAGE_PER_HIT, COINS_PER_ENEMY, COINS_PER_BOSS, HEAL_COST, HEAL_AMOUNT,
} from '../runState'
import type { ClassName } from '../types'

describe('constants', () => {
  it('MAX_HP is 50', () => expect(MAX_HP).toBe(50))
  it('DAMAGE_PER_WRONG is 2', () => expect(DAMAGE_PER_WRONG).toBe(2))
  it('BASE_DAMAGE_PER_HIT is 2', () => {
    expect(BASE_DAMAGE_PER_HIT).toBe(2)
  })
  it('COINS_PER_ENEMY is 5', () => expect(COINS_PER_ENEMY).toBe(5))
  it('COINS_PER_BOSS is 20', () => expect(COINS_PER_BOSS).toBe(20))
  it('HEAL_COST is 10', () => expect(HEAL_COST).toBe(10))
  it('HEAL_AMOUNT is 5', () => expect(HEAL_AMOUNT).toBe(5))
})

describe('getFloorLayout', () => {
  it('floor 1 has rest at index 4, treasure at index 6, shop at index 9, boss at index 11', () => {
    const layout = getFloorLayout(1)
    expect(layout[4]).toBe('rest')
    expect(layout[6]).toBe('treasure')
    expect(layout[9]).toBe('shop')
    expect(layout[11]).toBe('boss')
  })
  it('floor 2 has treasure at index 4, rest at index 6, shop at index 9, boss at index 11', () => {
    const layout = getFloorLayout(2)
    expect(layout[4]).toBe('treasure')
    expect(layout[6]).toBe('rest')
    expect(layout[9]).toBe('shop')
    expect(layout[11]).toBe('boss')
  })
  it('floor 3 layout matches floor 1', () => {
    expect(getFloorLayout(3)).toEqual(getFloorLayout(1))
  })
  it('all layouts have exactly 12 rooms', () => {
    expect(getFloorLayout(1).length).toBe(12)
    expect(getFloorLayout(2).length).toBe(12)
    expect(getFloorLayout(3).length).toBe(12)
  })
})

describe('buildRooms', () => {
  it('creates 12 rooms, all incomplete with null gameId', () => {
    const rooms = buildRooms(1)
    expect(rooms.length).toBe(12)
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
    expect(run.rooms.length).toBe(12)
  })
  it('starts with an empty artifacts array', () => {
    const run = buildRun('berserker')
    expect(run.artifacts).toEqual([])
  })
  it('initialises sessionId to null', () => {
    const run = buildRun('berserker')
    expect(run.sessionId).toBeNull()
  })
  it('initialises bonusDamage to 0', () => {
    const run = buildRun('berserker')
    expect(run.bonusDamage).toBe(0)
  })
})

describe('enemyHp', () => {
  it('returns wordLength * floor * 2', () => {
    expect(enemyHp(5, 1)).toBe(10)
    expect(enemyHp(8, 2)).toBe(32)
    expect(enemyHp(10, 3)).toBe(60)
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
    expect(computeRoomsCleared(run)).toBe(13) // 12 from floor 1 + 1 from floor 2
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
  it('loadRun sets sessionId to null when missing from saved data', () => {
    const run = buildRun('berserker')
    const legacy = { ...run } as Record<string, unknown>
    delete legacy.sessionId
    localStorage.setItem('hangman_run', JSON.stringify(legacy))
    const loaded = loadRun()
    expect(loaded?.sessionId).toBeNull()
  })
  it('loadRun sets bonusDamage to 0 when missing from saved data', () => {
    const run = buildRun('berserker')
    const legacy = { ...run } as Record<string, unknown>
    delete legacy.bonusDamage
    localStorage.setItem('hangman_run', JSON.stringify(legacy))
    const loaded = loadRun()
    expect(loaded?.bonusDamage).toBe(0)
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

  it('archivist starts with 45 HP', () => {
    const run = buildRun('archivist')
    expect(run.hp).toBe(45)
    expect(run.maxHp).toBe(45)
  })

  it('rogue starts with 40 HP', () => {
    const run = buildRun('rogue')
    expect(run.hp).toBe(40)
    expect(run.maxHp).toBe(40)
  })

  it('vowel_mage and berserker start with 50 HP', () => {
    expect(buildRun('vowel_mage').maxHp).toBe(50)
    expect(buildRun('berserker').maxHp).toBe(50)
  })
})
