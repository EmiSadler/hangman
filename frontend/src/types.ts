export type GameStatus = 'in_progress' | 'won' | 'lost'

export type ClassName = 'vowel_mage' | 'archivist' | 'berserker' | 'rogue'

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
}

export interface RunScore {
  runsCleared: number
  runsFailed: number
  bestRooms: number
}
