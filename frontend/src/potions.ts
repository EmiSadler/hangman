import type { PotionId } from './types'

export interface Potion {
  id: PotionId
  name: string
  emoji: string
  description: string
  price: number
}

export const POTIONS: Record<PotionId, Potion> = {
  health_potion: {
    id: 'health_potion',
    name: 'Health Potion',
    emoji: '🧪',
    description: 'Restore 10 HP.',
    price: 10,
  },
  strength_potion: {
    id: 'strength_potion',
    name: 'Potion of Strength',
    emoji: '⚡',
    description: 'Gain +2 damage for this battle.',
    price: 15,
  },
  shielding_potion: {
    id: 'shielding_potion',
    name: 'Potion of Shielding',
    emoji: '🔵',
    description: 'Gain 5 Shield instantly.',
    price: 12,
  },
  archivists_brew: {
    id: 'archivists_brew',
    name: "Archivist's Brew",
    emoji: '📜',
    description: 'Reveal the category of the current word.',
    price: 10,
  },
}
