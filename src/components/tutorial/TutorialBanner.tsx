interface TutorialBannerProps {
  label: string
  progress: string
}

/** 상단 미니멀 진행 표시 — STEP 번호와 진행도만. 안내 메시지는 키보드 위에 별도 표시. */
export function TutorialBanner({ label, progress }: TutorialBannerProps) {
  return (
    <div className="flex items-center justify-center gap-4 px-5 py-2 border-b border-primary/30 bg-base-200/70 font-mono">
      <span className="text-xs font-bold tracking-[2px] text-primary">{label}</span>
      {progress && (
        <>
          <span className="text-xs text-base-content/30">|</span>
          <span className="text-xs text-base-content/70 tracking-wider">{progress}</span>
        </>
      )}
    </div>
  )
}
