import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet'

const COUNTRY_COORDS = {
  US: [37.09, -95.71], CA: [56.13, -106.35], GB: [55.38, -3.44],
  FR: [46.23, 2.21],  DE: [51.17, 10.45],  RU: [61.52, 105.32],
  CN: [35.86, 104.19], JP: [36.20, 138.25], AU: [-25.27, 133.78],
  BR: [-14.24, -51.93], MX: [23.63, -102.55], IN: [20.59, 78.96],
  ZA: [-30.56, 22.94], NG: [9.08, 8.68],    KE: [-0.02, 37.91],
  SG: [1.35, 103.82],  HK: [22.32, 114.17], AE: [23.42, 53.85],
  NL: [52.13, 5.29],   IT: [41.87, 12.57],  ES: [40.46, -3.75],
  PL: [51.92, 19.15],  RO: [45.94, 24.97],  UA: [48.38, 31.17],
  TR: [38.96, 35.24],  IL: [31.05, 34.85],  SA: [23.89, 45.08],
  EG: [26.82, 30.80],  AR: [-38.42, -63.62], CO: [4.57, -74.30],
  VN: [14.06, 108.28], TH: [15.87, 100.99], ID: [-0.79, 113.92],
  MY: [4.21, 101.98],  PH: [12.88, 121.77], PK: [30.38, 69.35],
  BD: [23.68, 90.36],  LK: [7.87, 80.77],   NP: [28.39, 84.12],
  CH: [46.82, 8.23],   SE: [60.13, 18.64],  NO: [60.47, 8.47],
  DK: [56.26, 9.50],   FI: [61.92, 25.75],  PT: [39.40, -8.22],
  CZ: [49.82, 15.47],  HU: [47.16, 19.50],  GR: [39.07, 21.82],
}

function getCoords(code) {
  return COUNTRY_COORDS[code] ?? null
}

export default function GeoMap({ geo }) {
  if (!geo) return null

  const { cardholder_country, merchant_country, ip_country, country_mismatch, ip_mismatch, impossible_travel } = geo
  const cardCoords     = getCoords(cardholder_country)
  const merchantCoords = getCoords(merchant_country)
  const ipCoords       = ip_country ? getCoords(ip_country) : null

  const center = cardCoords ?? [20, 0]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
          <span className="text-white/60">Cardholder: <strong className="text-white/90">{cardholder_country}</strong></span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
          <span className="text-white/60">Merchant: <strong className="text-white/90">{merchant_country}</strong></span>
        </span>
        {ip_country && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
            <span className="text-white/60">IP: <strong className="text-white/90">{ip_country}</strong></span>
          </span>
        )}
        {country_mismatch && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
            Country mismatch
          </span>
        )}
        {ip_mismatch && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
            IP mismatch
          </span>
        )}
        {impossible_travel && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
            ⚠ Impossible travel
          </span>
        )}
      </div>

      <div style={{ height: 180, borderRadius: 10, overflow: 'hidden' }}>
        <MapContainer
          center={center}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {cardCoords && (
            <CircleMarker center={cardCoords} radius={8} pathOptions={{ color: '#60a5fa', fillColor: '#3b82f6', fillOpacity: 0.8 }}>
              <Tooltip permanent direction="top" offset={[0, -8]} className="text-xs">
                {cardholder_country}
              </Tooltip>
            </CircleMarker>
          )}

          {merchantCoords && merchant_country !== cardholder_country && (
            <CircleMarker center={merchantCoords} radius={8} pathOptions={{ color: '#4ade80', fillColor: '#22c55e', fillOpacity: 0.8 }}>
              <Tooltip permanent direction="top" offset={[0, -8]} className="text-xs">
                {merchant_country}
              </Tooltip>
            </CircleMarker>
          )}

          {ipCoords && ip_country !== cardholder_country && (
            <CircleMarker center={ipCoords} radius={8} pathOptions={{ color: '#f87171', fillColor: '#ef4444', fillOpacity: 0.8 }}>
              <Tooltip permanent direction="top" offset={[0, -8]} className="text-xs">
                IP: {ip_country}
              </Tooltip>
            </CircleMarker>
          )}

          {cardCoords && merchantCoords && country_mismatch && (
            <Polyline positions={[cardCoords, merchantCoords]} pathOptions={{ color: '#ef4444', weight: 1.5, dashArray: '4 4' }} />
          )}

          {cardCoords && ipCoords && ip_mismatch && (
            <Polyline positions={[cardCoords, ipCoords]} pathOptions={{ color: '#f59e0b', weight: 1.5, dashArray: '4 4' }} />
          )}
        </MapContainer>
      </div>
    </div>
  )
}
