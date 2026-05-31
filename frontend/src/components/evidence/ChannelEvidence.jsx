const CHANNELS = ['online', 'in_person', 'atm']
const CHANNEL_ICONS = { online: '🌐', in_person: '💳', atm: '🏧' }

export default function ChannelEvidence({ channel: channelData, tx }) {
  if (!channelData) return null

  const current = channelData.channel
  const switchCount = channelData.opposite_count_30min ?? 0

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {CHANNELS.map(ch => {
          const isActive = ch === current
          return (
            <div
              key={ch}
              className="flex-1 rounded-xl px-2 py-2 text-center"
              style={{
                background: isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? '#6366f140' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <div className="text-lg">{CHANNEL_ICONS[ch]}</div>
              <div className="text-[10px] text-white/50 mt-0.5 capitalize">{ch.replace('_', ' ')}</div>
              {isActive && <div className="text-[9px] text-indigo-400 font-bold">CURRENT</div>}
            </div>
          )
        })}
      </div>

      {switchCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b25', color: '#f59e0b' }}
        >
          <span>⚠</span>
          <span>{switchCount} opposite-channel transaction{switchCount > 1 ? 's' : ''} in last 30 min</span>
        </div>
      )}
    </div>
  )
}
