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
})

describe('sampleArtifacts', () => {
  it('returns the requested count', () => {
    expect(sampleArtifacts([], 3).length).toBe(3)
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
