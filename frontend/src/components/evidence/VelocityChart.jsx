import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts'

function barColor(val) {
  if (val > 5) return '#ef4444'
  if (val > 2) return '#f59e0b'
  return '#22c55e'
}

export default function VelocityChart({ velocity }) {
  if (!velocity) return null

  const data = [
    { label: '30 min', value: velocity.last_30min ?? 0 },
    { label: '1 hr',   value: velocity.last_1hr ?? 0 },
    { label: '1 day',  value: velocity.last_day ?? 0 },
  ]

  return (
    <div className="space-y-1">
      <div className="text-xs text-white/40 mb-2">Transactions from this card</div>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={data} barSize={28}>
          <XAxis dataKey="label" tick={{ fill: '#ffffff60', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#fff' }}
            itemStyle={{ color: '#6366f1' }}
            formatter={(v) => [v, 'transactions']}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={barColor(d.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
