import { SoundButton } from '../../components/common/SoundButton'

const CREDITS = [
  { role: 'PM', name: '이하경' },
  { role: 'DESIGN', name: '배나현' },
  { role: 'BACKEND', name: '황시선' },
  { role: 'FRONT', name: '이건희' },
  { role: 'LEAD', name: '서새찬' },
]

export function CreditsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="flex flex-col items-center gap-1">
        <h2
          className="text-2xl font-black tracking-widest text-primary"
          style={{ textShadow: '0 0 12px rgba(0,180,255,0.7)' }}
        >
          ─ CREDITS ─
        </h2>
        <p className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
          2026 INTERCON
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        {CREDITS.map(({ role, name }) => (
          <div
            key={role}
            className="flex items-center justify-between px-4 py-2 rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span
              className="text-xs font-black tracking-widest"
              style={{ color: 'rgba(0,180,255,0.7)', minWidth: '80px' }}
            >
              [{role}]
            </span>
            <span className="text-base font-bold tracking-wider" style={{ color: '#e2e8f0' }}>
              {name}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs tracking-widest text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
        © 2026 PickerPicker Team
      </p>

      <SoundButton
        className="btn btn-sm w-full"
        style={{
          background: 'rgba(60,80,120,0.45)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
        onClick={onBack}
      >
        ← BACK
      </SoundButton>
    </div>
  )
}
