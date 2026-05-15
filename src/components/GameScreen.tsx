interface GameScreenProps {
  nickname: string
  isNewPlayer: boolean
}

export function GameScreen({ nickname, isNewPlayer }: GameScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-2xl font-bold text-primary">{nickname}</h2>
      <p className="text-base-content/60">
        {isNewPlayer ? '신규 플레이어' : '기존 플레이어'}
      </p>
      <p className="text-base-content/40 text-sm">게임 화면 (미구현)</p>
    </div>
  )
}
