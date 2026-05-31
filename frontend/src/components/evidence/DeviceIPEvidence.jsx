function SharedBadge({ label, icon, shared, count }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 flex-1"
      style={{
        background: shared ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.07)',
        border: `1px solid ${shared ? '#ef444430' : '#22c55e25'}`,
      }}
    >
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-xs font-semibold text-white/80">{label}</div>
        <div className="text-[11px]" style={{ color: shared ? '#ef4444' : '#22c55e' }}>
          {shared ? `Used by ${count} cards` : 'Not shared'}
        </div>
      </div>
    </div>
  )
}

export default function DeviceIPEvidence({ device_ip }) {
  if (!device_ip) return null

  return (
    <div className="flex gap-2">
      <SharedBadge
        label="Device"
        icon="💻"
        shared={device_ip.device_shared}
        count={device_ip.unique_cards_on_device}
      />
      <SharedBadge
        label="IP Address"
        icon="🌐"
        shared={device_ip.ip_shared}
        count={device_ip.unique_cards_on_ip}
      />
    </div>
  )
}
