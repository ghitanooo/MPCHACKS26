import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const FEATURE_LABELS = {
  tx_velocity_30min: 'Velocity (30 min)',
  tx_velocity_1hr: 'Velocity (1 hr)',
  tx_velocity_1day: 'Velocity (1 day)',
  country_mismatch: 'Country mismatch',
  ip_mismatch: 'IP mismatch',
  is_impossible_travel: 'Impossible travel',
  card_unique_ips_30min: 'Unique IPs (30 min)',
  card_unique_ips_60min: 'Unique IPs (1 hr)',
  card_unique_ips_12h: 'Unique IPs (12 hr)',
  card_unique_ips_24h: 'Unique IPs (24 hr)',
  card_unique_merchant_countries_30min: 'Merchant countries (30 min)',
  card_unique_merchant_countries_60min: 'Merchant countries (1 hr)',
  card_unique_merchant_countries_12h: 'Merchant countries (12 hr)',
  card_unique_merchant_countries_24h: 'Merchant countries (24 hr)',
  card_unique_ip_countries_30min: 'IP countries (30 min)',
  card_unique_ip_countries_60min: 'IP countries (1 hr)',
  card_unique_ip_countries_12h: 'IP countries (12 hr)',
  card_unique_ip_countries_24h: 'IP countries (24 hr)',
  opposite_channel_30min: 'Channel switch (30 min)',
  opposite_channel_60min: 'Channel switch (1 hr)',
  opposite_channel_12h: 'Channel switch (12 hr)',
  opposite_channel_24h: 'Channel switch (24 hr)',
  ip_shared_with_multiple_cards: 'Shared IP',
  device_shared_with_multiple_cards: 'Shared device',
  merchant_unique_cards_1hr: 'Merchant burst (1 hr)',
  amount_vs_avg_ratio: 'Unusual spend amount',
  is_preferred_category: 'Preferred category',
  time_since_last_transaction: 'Time since last tx',
  is_first_transaction: 'First transaction',
  total_tx_count_per_card: 'Card tx count',
  unique_merchants_per_card: 'Unique merchants',
  hour_of_day: 'Hour of day',
}

export default function SHAPChart({ features }) {
  if (!features?.length) return null

  const data = features
    .slice(0, 5)
    .map(f => ({
      label: FEATURE_LABELS[f.feature] ?? f.feature.replace(/_/g, ' '),
      impact: f.impact,
      direction: f.direction,
    }))
    .sort((a, b) => b.impact - a.impact)

  return (
    <div className="space-y-1">
      <div className="text-xs text-white/40 mb-2">Top SHAP feature contributions</div>
      <div className="flex gap-3 text-[10px] text-white/40 mb-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Fraud signal</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> Normal signal</span>
      </div>
      <ResponsiveContainer width="100%" height={data.length * 28 + 10}>
        <BarChart data={data} layout="vertical" barSize={14} margin={{ left: 0, right: 40 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tick={{ fill: '#ffffff80', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
            formatter={(v, n, p) => [p.payload.direction === 'fraud' ? `+${v.toFixed(3)}` : v.toFixed(3), 'SHAP impact']}
          />
          <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.direction === 'fraud' ? '#ef4444' : '#22c55e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
