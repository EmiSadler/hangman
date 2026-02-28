export type GameStatus = 'in_progress' | 'won' | 'lost'

export interface GameState {
  gameId: string
  maskedWord: string
  maxWrong: number
  wrongGuessesLeft: number
  guessedLetters: string[]
  status: GameStatus
  word?: string
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
}

export interface RunScore {
  runsCleared: number
  runsFailed: number
  bestRooms: number
}
