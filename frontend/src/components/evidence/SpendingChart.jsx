import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'

export default function SpendingChart({ spending }) {
  if (!spending) return null

  const { amount, card_avg, ratio } = spending
  const data = [
    { label: 'This Tx', value: amount },
    { label: 'Card Avg', value: card_avg },
  ]

  const ratioColor = ratio > 10 ? '#ef4444' : ratio > 3 ? '#f59e0b' : '#22c55e'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-white/40">Spending vs baseline</div>
        <div className="text-sm font-bold font-mono" style={{ color: ratioColor }}>
          {ratio.toFixed(1)}× normal
        </div>
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={data} barSize={36}>
          <XAxis dataKey="label" tick={{ fill: '#ffffff60', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`$${v.toFixed(2)} CAD`, '']}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            <Cell fill={ratioColor} />
            <Cell fill="#6366f1" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
