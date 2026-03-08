import { describe, it, expect } from 'vitest'
import { ARTIFACTS, sampleArtifacts } from '../artifacts'
import type { ArtifactId } from '../types'

describe('ARTIFACTS', () => {
  it('has 14 entries', () => {
    expect(Object.keys(ARTIFACTS).length).toBe(14)
  })

  it('each artifact has id, name, emoji, and description', () => {
    for (const artifact of Object.values(ARTIFACTS)) {
      expect(artifact.id).toBeTruthy()
      expect(artifact.name).toBeTruthy()
      expect(artifact.emoji).toBeTruthy()
      expect(artifact.description).toBeTruthy()
    }
  })

  it('every artifact has a price > 0', () => {
    for (const art of Object.values(ARTIFACTS)) {
      expect(art.price, `${art.name} should have price > 0`).toBeGreaterThan(0)
    }
  })

  it('info artifacts cost 10 coins', () => {
    expect(ARTIFACTS.vowel_seeker.price).toBe(10)
    expect(ARTIFACTS.crystal_ball.price).toBe(10)
    expect(ARTIFACTS.category_scroll.price).toBe(10)
  })

  it('combat artifacts cost 15 coins', () => {
    expect(ARTIFACTS.short_sword.price).toBe(15)
    expect(ARTIFACTS.blood_dagger.price).toBe(15)
    expect(ARTIFACTS.thick_skin.price).toBe(15)
    expect(ARTIFACTS.iron_shield.price).toBe(15)
    expect(ARTIFACTS.healing_salve.price).toBe(15)
    expect(ARTIFACTS.gold_tooth.price).toBe(15)
  })

  it('strong/synergy artifacts cost 20 coins', () => {
    expect(ARTIFACTS.chainmail.price).toBe(20)
    expect(ARTIFACTS.mana_crystal.price).toBe(20)
    expect(ARTIFACTS.battle_scar.price).toBe(20)
    expect(ARTIFACTS.shadow_cloak.price).toBe(20)
    expect(ARTIFACTS.ancient_codex.price).toBe(20)
  })
})

describe('sampleArtifacts', () => {
  it('returns the requested count of valid Artifact objects', () => {
    const result = sampleArtifacts([], 3)
    expect(result.length).toBe(3)
    for (const artifact of result) {
      expect(artifact.id).toBeTruthy()
      expect(artifact.name).toBeTruthy()
      expect(artifact.emoji).toBeTruthy()
      expect(artifact.description).toBeTruthy()
    }
  })

  it('excludes already-owned artifacts', () => {
    const owned: ArtifactId[] = ['short_sword', 'iron_shield', 'healing_salve']
    const result = sampleArtifacts(owned, 3)
    for (const artifact of result) {
      expect(owned).not.toContain(artifact.id)
    }
  })

  it('returns fewer than count when pool is smaller than count', () => {
    const owned: ArtifactId[] = [
      'vowel_seeker', 'crystal_ball', 'category_scroll',
      'short_sword', 'blood_dagger', 'iron_shield', 'thick_skin', 'chainmail',
      'healing_salve', 'gold_tooth', 'battle_scar', 'shadow_cloak', 'mana_crystal',
    ]
    expect(sampleArtifacts(owned, 3).length).toBe(1)
  })

  it('returns no duplicate artifacts', () => {
    const result = sampleArtifacts([], 5)
    const ids = result.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
