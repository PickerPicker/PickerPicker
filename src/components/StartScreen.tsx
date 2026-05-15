interface StartScreenProps {
  onRanking: () => void
  onStart: () => void
}

export function StartScreen({ onRanking, onStart }: StartScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <h1 className="text-6xl font-black text-primary tracking-widest">
        PickerPicker
      </h1>
      <div className="flex gap-4">
        <button className="btn btn-outline btn-lg" onClick={onRanking}>
          랭킹
        </button>
        <button className="btn btn-primary btn-lg" onClick={onStart}>
          시작
        </button>
      </div>
    </div>
  )
}
