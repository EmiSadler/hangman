interface Props {
  onStart: () => void
}

export default function GameSetup({ onStart }: Props) {
  return (
    <div className="game-setup">
      <h1>Hangman</h1>
      <p className="game-setup__subtitle">Press Play to begin</p>
      <div className="game-setup__buttons">
        <button className="btn-difficulty" onClick={onStart}>
          Play
        </button>
      </div>
    </div>
  )
}
