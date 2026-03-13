interface Props {
  onDone: () => void
}

export default function HowToPlayScreen({ onDone }: Props) {
  return (
    <div className="how-to-play-screen">
      <h1 className="how-to-play-screen__title">How to Play</h1>

      <section className="how-to-play-screen__section">
        <h2>🎯 The Goal</h2>
        <p>Survive 3 floors and defeat the boss on each to win the run. Your HP carries between every room.</p>
      </section>

      <section className="how-to-play-screen__section">
        <h2>⚔️ Combat</h2>
        <p>Guess letters to reveal the hidden word and deal damage to the enemy. Wrong guesses cost you HP. Solve the word (by guessing all letters or typing it in the box) to end the fight.</p>
      </section>

      <section className="how-to-play-screen__section">
        <h2>🗺️ Room Types</h2>
        <ul className="how-to-play-screen__list">
          <li>⚔️ <strong>Enemy</strong> — fight a monster for coins</li>
          <li>💀 <strong>Boss</strong> — harder fight, bigger coin reward, ends the floor</li>
          <li>🛏 <strong>Rest</strong> — spend 10 coins to restore 5 HP</li>
          <li>💎 <strong>Treasure</strong> — choose a free reward</li>
          <li>🪙 <strong>Shop</strong> — buy artifacts with your coins</li>
        </ul>
      </section>

      <section className="how-to-play-screen__section">
        <h2>🧙 Classes</h2>
        <ul className="how-to-play-screen__list">
          <li>🧙 <strong>Vowel Mage</strong> — vowels deal bonus damage; ability reveals all instances of a chosen vowel</li>
          <li>📚 <strong>Archivist</strong> — sees category, first letter, and word length; ability reveals or eliminates letters</li>
          <li>🪓 <strong>Berserker</strong> — builds Rage on wrong guesses for bigger hits; ability bets on a blind guess for double damage</li>
          <li>🗡️ <strong>Rogue</strong> — builds a damage Combo on consecutive correct guesses; ability doubles combo damage and reveals a letter</li>
        </ul>
      </section>

      <section className="how-to-play-screen__section">
        <h2>🎒 Artifacts</h2>
        <p>Found in treasure rooms and shops. Each artifact gives a passive bonus for the rest of the run. Hover or tap any artifact icon to see what it does.</p>
      </section>

      <button className="btn-how-to-play-done" onClick={onDone}>
        Got it →
      </button>
    </div>
  )
}
