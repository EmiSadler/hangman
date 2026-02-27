interface Props {
  maskedWord: string
}

export default function WordDisplay({ maskedWord }: Props) {
  const letters = maskedWord.split(' ')
  return (
    <div className="word-display">
      {letters.map((letter, i) => (
        <span key={i} className={`letter-tile${letter === '_' ? ' letter-tile--blank' : ''}`}>
          {letter}
        </span>
      ))}
    </div>
  )
}
