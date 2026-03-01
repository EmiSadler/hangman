import type { ArtifactId } from './types'

export interface Artifact {
  id: ArtifactId
  name: string
  description: string
  emoji: string
}

export const ARTIFACTS: Record<ArtifactId, Artifact> = {
  vowel_seeker: {
    id: 'vowel_seeker', name: 'Vowel Seeker', emoji: '🔍',
    description: 'At combat start, shows how many vowels are in the word.',
  },
  crystal_ball: {
    id: 'crystal_ball', name: 'Crystal Ball', emoji: '🔮',
    description: 'At combat start, reveals a random letter that is in the word.',
  },
  category_scroll: {
    id: 'category_scroll', name: 'Category Scroll', emoji: '📜',
    description: 'At combat start, shows the word\'s category.',
  },
  short_sword: {
    id: 'short_sword', name: 'Short Sword', emoji: '⚔️',
    description: 'Each correct guess deals +1 bonus damage.',
  },
  blood_dagger: {
    id: 'blood_dagger', name: 'Blood Dagger', emoji: '🗡️',
    description: 'After a wrong guess, your next correct hit deals +2 bonus damage.',
  },
  iron_shield: {
    id: 'iron_shield', name: 'Iron Shield', emoji: '🛡️',
    description: 'Start each combat with +2 shield.',
  },
  thick_skin: {
    id: 'thick_skin', name: 'Thick Skin', emoji: '🪨',
    description: 'Take 1 less damage per wrong guess (minimum 1).',
  },
  chainmail: {
    id: 'chainmail', name: 'Chainmail', emoji: '🧲',
    description: 'Permanently gain +5 max HP when picked up.',
  },
  healing_salve: {
    id: 'healing_salve', name: 'Healing Salve', emoji: '🧪',
    description: 'Restore +3 HP after each combat victory.',
  },
  gold_tooth: {
    id: 'gold_tooth', name: 'Gold Tooth', emoji: '🪙',
    description: 'Earn +5 bonus coins after each combat victory.',
  },
  battle_scar: {
    id: 'battle_scar', name: 'Battle Scar', emoji: '🩹',
    description: 'Start each combat with 1 rage already built up. (Berserker synergy)',
  },
  shadow_cloak: {
    id: 'shadow_cloak', name: 'Shadow Cloak', emoji: '🌑',
    description: 'After a wrong guess, combo drops to 1 instead of 0. (Rogue synergy)',
  },
  mana_crystal: {
    id: 'mana_crystal', name: 'Mana Crystal', emoji: '💎',
    description: 'Your ability cooldown is reduced by 1.',
  },
  ancient_codex: {
    id: 'ancient_codex', name: 'Ancient Codex', emoji: '📖',
    description: 'Cross Reference can be used twice per encounter. (Archivist synergy)',
  },
}

/**
 * Returns up to `count` random artifacts not already in `owned`.
 * May return fewer than `count` if the available pool is smaller.
 */
export function sampleArtifacts(owned: ArtifactId[], count: number): Artifact[] {
  const pool = (Object.keys(ARTIFACTS) as ArtifactId[]).filter(id => !owned.includes(id))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(id => ARTIFACTS[id])
}
