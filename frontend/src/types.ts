export type GameStatus = 'in_progress' | 'won' | 'lost'

export type ClassName = 'vowel_mage' | 'archivist' | 'berserker' | 'rogue'

export type ArtifactId =
  | 'vowel_seeker' | 'crystal_ball' | 'category_scroll'
  | 'short_sword' | 'blood_dagger'
  | 'iron_shield' | 'thick_skin' | 'chainmail'
  | 'healing_salve' | 'gold_tooth'
  | 'battle_scar' | 'shadow_cloak' | 'mana_crystal' | 'ancient_codex'

export interface GameState {
  gameId: string
  maskedWord: string
  guessedLetters: string[]
  status: GameStatus
  word: string
  category: string
  firstLetter: string
}

export type RoomType = 'enemy' | 'boss' | 'rest' | 'treasure'

export interface Room {
  type: RoomType
  completed: boolean
  gameId: string | null
}

export interface RunState {
  hp: number
  maxHp: number
  coins: number
  floor: number        // 1–3
  roomIndex: number    // 0–10
  rooms: Room[]
  status: 'in_progress' | 'won' | 'lost'
  pendingReveal: boolean
  className: ClassName
  shield: number
  artifacts: ArtifactId[]
  sessionId: string | null
}

export interface RunScore {
  runsCleared: number
  runsFailed: number
  bestRooms: number
}
