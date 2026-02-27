interface Props {
  maskedWord: string
}

export default function WordDisplay({ maskedWord }: Props) {
  const letters = maskedWord.split(' ')
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '2rem', fontFamily: 'monospace' }}>
      {letters.map((letter, i) => (
        <span key={i} style={{ borderBottom: '2px solid black', minWidth: '1ch', textAlign: 'center' }}>
          {letter}
        </span>
      ))}
    </div>
  )
}
