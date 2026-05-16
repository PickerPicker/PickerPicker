interface TutorialBannerProps {
  label: string
  message: string
  progress: string
  cleared: boolean
}

export function TutorialBanner({ label, message, progress, cleared }: TutorialBannerProps) {
  return (
    <div
      className="w-full text-center px-5 py-2.5 border-b-2"
      style={{
        background: 'linear-gradient(180deg, rgba(0,180,255,0.95), rgba(0,180,255,0.85))',
        borderBottomColor: '#00ffaa',
        color: '#001020',
        boxShadow: '0 4px 20px rgba(0,180,255,0.4)',
      }}
    >
      <div className="text-[11px] font-mono font-bold tracking-[2px]" style={{ color: 'rgba(0,30,60,0.7)' }}>
        {label}
      </div>
      <div className="text-sm font-extrabold mt-0.5">
        {cleared ? '✓ 완료! SPACE 또는 → 눌러 다음 STEP' : message}
      </div>
      {progress && (
        <div className="text-[11px] font-mono mt-0.5" style={{ color: 'rgba(0,30,60,0.7)' }}>
          {progress}
        </div>
      )}
    </div>
  )
}
