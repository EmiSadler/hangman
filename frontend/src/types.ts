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

export interface Score {
  wins: number
  losses: number
}
