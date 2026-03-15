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
}
