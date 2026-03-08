import type { Room } from '../types'

interface Props {
  rooms: Room[]
  currentIndex: number
  floor: number
}

const ROOM_LABEL: Record<string, string> = {
  enemy: '👺',
  boss: '☠️',
  rest: '😴',
  treasure: '👑',
}

export default function FloorProgress({ rooms, currentIndex, floor }: Props) {
  return (
    <div className="floor-progress" aria-label={`Floor ${floor} progress`}>
      {rooms.map((room, i) => {
        let cls = 'floor-progress__room'
        if (room.completed) cls += ' floor-progress__room--completed'
        else if (i === currentIndex) cls += ' floor-progress__room--current'
        return (
          <div key={i} className={cls} title={room.type}>
            {ROOM_LABEL[room.type]}
          </div>
        )
      })}
    </div>
  )
}
