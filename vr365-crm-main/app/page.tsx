'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import LoginPage from './components/LoginPage'
import SettingsPage from './components/SettingsPage'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function sbFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Range-Unit': 'items',
      'Range': '0-49999',
      Prefer: 'return=representation',
      ...((opts as any)?.headers || {})
    }
  })
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    const txt = await res.text()
    throw new Error(`Supabase error ${res.status}: ${txt}`)
  }
  if (res.status === 204) return []
  return res.json()
}

// ── COLORS ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#E9ECF2', bgCard: '#FFFFFF', bgInput: '#EEF0F5', bgSidebar: '#F2F4F8',
  separator: '#D1D4DC', label: '#1C1C2E', label2: '#2C2C44', label3: '#72728A', label4: '#A0A0BC',
  blue: '#007AFF', green: '#25A244', orange: '#F48C06', red: '#E63946',
  purple: '#9B51E0', teal: '#2EC4B6', indigo: '#4C46C8',
  cardShadow: '0 1px 2px rgba(0,0,30,0.06), 0 3px 10px rgba(0,0,30,0.07)',
  statGrad: ['linear-gradient(135deg,#EEF6FF,#D6EAFF)', 'linear-gradient(135deg,#EDFAF3,#C8EDDA)', 'linear-gradient(135deg,#FFF8EC,#FFE8B8)', 'linear-gradient(135deg,#F5EEFF,#E2CCFF)'],
}
const CHART_COLORS = [C.blue, C.green, C.orange, C.red, C.purple, C.teal]

// ── ALL CHANNELS ──────────────────────────────────────────────────────────────
const ALL_CHANNELS = [
  'VRBO/Homeaway','Vrbo','VRBO','Owner','Airbnb','VR365 - Blue Tent Rez Pro',
  'VR365, LLC - VDS','Our WebSite','Owner Hold','NextPax','Repeat Customer',
  'FlipKey.com (commission) - deactivating','VR365, LLC - BlueTent Cloud',
  'Owner Referral','Expedia','HomeAway','Walk-In','RedAwning.com',
  'Search Engine','Other','Bill Board','Property Manager Tools SmartSync',
  'Guest Referral','Perfect Places Vacation Rental Network','Guest',
  'VacationHomeRentals.com','ClearStay.com: Escapia Consumer',
  'BeachVacationChoices.com','DreamHomeNetwork.com','Chamber of Commerce',
  'EscapiaConnect','Realtor','Brochure','Craigslist','PayByGroup',
  'Aloha Condos and Homes','Homes & Villas by Marriott'
]

// ── UTILS ─────────────────────────────────────────────────────────────────────
const fmt$ = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
const fmtDate = (s: string) => {
  if (!s) return '—'
  try {
    // Parse date parts directly to avoid timezone shifting
    const parts = s.slice(0,10).split('-')
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]))
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return s || '—' }
}
const fmtMonth = (s: string) => { try { return new Date(s + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) } catch { return s } }

// ── COMPONENTS ────────────────────────────────────────────────────────────────
function Avatar({ name, size = 38, index = 0 }: any) {
  const hues = [211, 142, 25, 349, 262, 195, 45, 280]
  const h = hues[index % hues.length]
  const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
  return <div style={{ width: size, height: size, borderRadius: size / 2, background: `linear-gradient(145deg,hsl(${h},70%,52%),hsl(${(h + 30) % 360},65%,42%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 600, color: '#fff', flexShrink: 0 }}>{initials}</div>
}

function Card({ children, style = {}, onClick }: any) {
  const [pressed, setPressed] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseDown={() => onClick && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => onClick && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        backgroundColor: C.bgCard, borderRadius: 13, overflow: 'hidden',
        boxShadow: pressed ? '0 1px 2px rgba(0,0,30,0.04)' : C.cardShadow,
        cursor: onClick ? 'pointer' : 'default',
        transform: pressed ? 'scale(0.985)' : 'scale(1)',
        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
        ...style
      }}
    >
      {children}
    </div>
  )
}

function StatCard({ label, value, sub, color, grad = '' }: any) {
  return <div style={{ background: grad || C.bgCard, borderRadius: 13, padding: '14px 16px', borderTop: `3px solid ${color}`, boxShadow: C.cardShadow }}>
    <div style={{ fontSize: 11, color: C.label3, fontWeight: 500, marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: '-0.4px' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.label4, marginTop: 3 }}>{sub}</div>}
  </div>
}

function Pill({ label, onRemove }: any) {
  const tagColors: any = { VIP: C.orange, 'Hot Tub': C.blue, Holiday: C.purple, Repeat: C.green, 'Long Stay': C.teal, 'Pet Friendly': C.green, Family: C.orange }
  const c = tagColors[label] || C.label3
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, backgroundColor: c + '18', color: c }}>
    {label}
    {onRemove && <span onClick={onRemove} style={{ cursor: 'pointer', fontSize: 14, lineHeight: 1, opacity: 0.5 }}>×</span>}
  </span>
}

function SearchableSelect({ value, onChange, options, placeholder = 'All' }: any) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useState<HTMLDivElement | null>(null)
  const filtered = options.filter((o: string) => o.toLowerCase().includes(q.toLowerCase()))
  const display = value === 'all' ? placeholder : value

  function handleOpen(e: React.MouseEvent<HTMLDivElement>) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropHeight = Math.min(260, filtered.length * 36 + 60)
    const openUp = spaceBelow < dropHeight
    setPos({
      top: openUp ? rect.top - dropHeight : rect.bottom + 4,
      left: rect.left,
      width: rect.width
    })
    setOpen(!open)
    setQ('')
  }

  return (
    <div style={{ position: 'relative' }}>
      <div onClick={handleOpen}
        style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${value !== 'all' ? C.blue : C.separator}`, backgroundColor: C.bgInput, color: value !== 'all' ? C.blue : C.label, fontSize: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: value !== 'all' ? 600 : 400, userSelect: 'none' as any }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as any, maxWidth: 160 }}>{display}</span>
        <span style={{ fontSize: 10, color: C.label4, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
          <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, 220), zIndex: 200, backgroundColor: C.bgCard, border: `1px solid ${C.separator}`, borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,30,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.separator}`, backgroundColor: C.bgInput }}>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search property…"
                onClick={e => e.stopPropagation()}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.separator}`, backgroundColor: C.bgCard, color: C.label, fontSize: 12, outline: 'none', boxSizing: 'border-box' as any }} />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' as any }}>
              <div onClick={() => { onChange('all'); setOpen(false) }}
                style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', backgroundColor: value === 'all' ? C.blue+'12' : 'transparent', color: value === 'all' ? C.blue : C.label, fontWeight: value === 'all' ? 600 : 400 }}>
                {placeholder}
              </div>
              {filtered.map((o: string) => (
                <div key={o} onClick={() => { onChange(o); setOpen(false) }}
                  style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', backgroundColor: value === o ? C.blue+'12' : 'transparent', color: value === o ? C.blue : C.label, fontWeight: value === o ? 600 : 400 }}
                  onMouseEnter={e => { if (value !== o) (e.currentTarget as HTMLElement).style.backgroundColor = C.bgInput }}
                  onMouseLeave={e => { if (value !== o) (e.currentTarget as HTMLElement).style.backgroundColor = value === o ? C.blue+'12' : 'transparent' }}>
                  {o}
                </div>
              ))}
              {filtered.length === 0 && <div style={{ padding: '8px 12px', fontSize: 12, color: C.label4 }}>No results</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SpendBadge({ spent }: any) {
  const t = spent >= 10000 ? { l: 'Platinum', c: C.indigo } : spent >= 5000 ? { l: 'Gold', c: C.orange } : spent >= 2000 ? { l: 'Silver', c: '#8E8E93' } : { l: 'Bronze', c: '#A2845E' }
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, backgroundColor: t.c + '18', color: t.c }}>{t.l}</span>
}

function SkeletonBlock({ w = '100%', h = 16, radius = 6 }: any) {
  return <div style={{ width: w, height: h, borderRadius: radius, background: 'linear-gradient(90deg, #D8DBE6 25%, #E4E7F0 50%, #D8DBE6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.2s infinite' }} />
}

function GuestProfileSkeleton() {
  const shimmer = { background: 'linear-gradient(90deg, #D8DBE6 25%, #E4E7F0 50%, #D8DBE6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.2s infinite' }
  return (
    <div style={{ padding: 24, maxWidth: 660 }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 30, flexShrink: 0, ...shimmer }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          <div style={{ width: '60%', height: 22, borderRadius: 8, ...shimmer }} />
          <div style={{ width: '40%', height: 14, borderRadius: 6, ...shimmer }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[0,1,2].map(i => <div key={i} style={{ height: 80, borderRadius: 13, ...shimmer }} />)}
      </div>
      <div style={{ height: 48, borderRadius: 12, marginBottom: 16, ...shimmer }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0,1,2].map(i => <div key={i} style={{ height: 90, borderRadius: 13, ...shimmer }} />)}
      </div>
    </div>
  )
}
function LoadingBar({ loading }: any) {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (loading) {
      setVisible(true)
      setProgress(0)
      const interval = setInterval(() => {
        setProgress(p => p < 85 ? p + Math.random() * 15 : p)
      }, 150)
      return () => clearInterval(interval)
    } else {
      setProgress(100)
      const t = setTimeout(() => { setVisible(false); setProgress(0) }, 500)
      return () => clearTimeout(t)
    }
  }, [loading])

  if (!visible) return null
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, height: 4, backgroundColor: C.blue+'30' }}>
      <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${C.blue}, ${C.indigo})`, transition: progress === 100 ? 'width 0.3s ease' : 'width 0.4s ease', borderRadius: '0 3px 3px 0', boxShadow: `0 0 12px ${C.blue}` }} />
    </div>
  )
}
function AIInsights({ guest, todayStr, onUpdate, hotHome }: any) {
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState(guest?.ai_insight || '')
  const [winback, setWinback] = useState(guest?.ai_winback || '')
  const [hotBrief, setHotBrief] = useState('')
  const [hotBriefLoading, setHotBriefLoading] = useState(false)
  const [copiedWinback, setCopiedWinback] = useState(false)
  const [copiedBrief, setCopiedBrief] = useState(false)
  const [open, setOpen] = useState(!!(guest?.ai_insight))
  const [tab, setTab] = useState<'insight'|'winback'|'hothome'>('insight')
  const [newTags, setNewTags] = useState<string[]>([])

  const vrboChannelList = ['VRBO/Homeaway','Vrbo','VRBO','HomeAway','NextPax','Expedia']
  // Check if guest has upcoming booking at a Hot Home — VRBO channel only
  const upcomingHotBooking = hotHome && (guest?.bookings || []).find((b: any) => {
    if (!b.check_in || b.check_in.slice(0,10) < todayStr) return false
    return vrboChannelList.some((v: string) => (b.channel || '').includes(v))
  })

  // Reset when guest changes
  useEffect(() => {
    setInsight(guest?.ai_insight || '')
    setWinback(guest?.ai_winback || '')
    setOpen(!!(guest?.ai_insight))
    setLoading(false)
    setTab('insight')
    setNewTags([])
    setHotBrief('')
    setCopiedWinback(false)
    setCopiedBrief(false)
  }, [guest?.id])

  async function generate() {
    setLoading(true)
    setOpen(true)
    setInsight('')
    setWinback('')
    setTab('insight')

    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest: {
          name: guest.name,
          email: guest.email,
          totalSpent: guest.totalSpent,
          bookingCount: guest.bookingCount,
          bookings: guest.bookings
        }, localDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) })
      })
      const data = await res.json()
      if (data.error) {
        setInsight('Error: ' + data.error)
      } else {
        setInsight(data.insight)
        setWinback(data.winback)
        const existingTags = guest.tags || []
        const mergedTags = [...new Set([...existingTags, ...(data.tags || [])])]
        setNewTags(data.tags?.filter((t: string) => !existingTags.includes(t)) || [])
        await sbFetch(`guests?id=eq.${encodeURIComponent(guest.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ ai_insight: data.insight, ai_winback: data.winback, tags: mergedTags })
        })
        if (onUpdate) onUpdate({ ai_insight: data.insight, ai_winback: data.winback, tags: mergedTags })
      }
    } catch (e: any) {
      setInsight('Error: ' + e.message)
    }
    setLoading(false)
  }

  async function generateHotBrief() {
    setHotBriefLoading(true)
    setHotBrief('')
    try {
      const isNotPremier = hotHome.vrbo_premier_status === 'NOT_PREMIER'
      const isGrace = hotHome.vrbo_premier_status === 'PREMIER_GRACE_PERIOD'
      const isNearPremier = (hotHome.vrbo_premier_flags || '').toLowerCase().includes('near premier')
      const isLowRating = hotHome.vrbo_rating > 0 && hotHome.vrbo_rating < 4.7
      const reason = isNotPremier ? 'Not Premier on VRBO'
        : isLowRating ? `Low VRBO rating (${hotHome.vrbo_rating})`
        : isNearPremier ? 'Near Premier status on VRBO — one flag away'
        : isGrace ? 'In Premier Grace Period — recently achieved Premier but on probation'
        : 'Needs attention'

      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotBrief: true, guest: {
          name: guest.name,
          propertyName: hotHome.property_name,
          locationGroup: hotHome.location_group,
          vrboReviews: hotHome.vrbo_reviews,
          vrboRating: hotHome.vrbo_rating,
          premierStatus: hotHome.vrbo_premier_status,
          premierFlags: hotHome.vrbo_premier_flags,
          hotHomeReason: reason,
          bookingChannel: upcomingHotBooking?.channel || 'Unknown',
          checkIn: upcomingHotBooking?.check_in,
          checkOut: upcomingHotBooking?.check_out,
        }})
      })
      const data = await res.json()
      setHotBrief(data.brief || 'Could not generate brief.')
    } catch(e: any) {
      setHotBrief('Error: ' + e.message)
    }
    setHotBriefLoading(false)
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {!open ? (
        <button onClick={generate}
          style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${C.indigo}, ${C.purple})`, color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 2px 8px rgba(88,86,214,0.3)', transition: 'all 0.2s' }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          ✨ Generate AI Guest Insights
        </button>
      ) : (
        <div style={{ backgroundColor: C.bgCard, borderRadius: 13, overflow: 'hidden', boxShadow: C.cardShadow }}>
          {/* Header */}
          <div style={{ padding: '12px 14px', background: `linear-gradient(135deg, ${C.indigo}18, ${C.purple}18)`, borderBottom: `1px solid ${C.separator}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.indigo }}>✨ AI Guest Insights</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setTab('insight')} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, backgroundColor: tab === 'insight' ? C.indigo : 'transparent', color: tab === 'insight' ? '#fff' : C.label3 }}>Insights</button>
              <button onClick={() => setTab('winback')} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, backgroundColor: tab === 'winback' ? C.indigo : 'transparent', color: tab === 'winback' ? '#fff' : C.label3 }}>{upcomingHotBooking || (guest?.bookings||[]).some((b: any) => b.check_in && b.check_in.slice(0,10) >= todayStr) ? '✉️ Pre-Arrival' : '🎯 Win-Back'}</button>
              {upcomingHotBooking && (
                <button onClick={() => { setTab('hothome'); if (!hotBrief && !hotBriefLoading) generateHotBrief() }}
                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, backgroundColor: tab === 'hothome' ? C.red : C.red+'15', color: tab === 'hothome' ? '#fff' : C.red }}>
                  🔥 Hot Home Brief
                </button>
              )}
              <button onClick={generate} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.separator}`, cursor: 'pointer', fontSize: 11, color: C.label3, backgroundColor: 'transparent' }}>↺</button>
              <button onClick={() => setOpen(false)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, color: C.label3, backgroundColor: 'transparent' }}>×</button>
            </div>
          </div>
          {/* Content */}
          <div style={{ padding: '14px 16px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.label3, fontSize: 13 }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, border: `2px solid ${C.indigo}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                Analyzing {guest.name}'s booking patterns...
              </div>
            ) : tab === 'insight' ? (
              <div>
                <div style={{ fontSize: 13, color: C.label2, lineHeight: 1.7 }}>{insight}</div>
                {newTags.length > 0 && (
                  <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, backgroundColor: C.green+'10', border: `1px solid ${C.green}30` }}>
                    <div style={{ fontSize: 11, color: C.green, fontWeight: 600, marginBottom: 6 }}>✅ Auto-tagged:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as any }}>
                      {newTags.map((t: string) => <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, backgroundColor: C.green+'18', color: C.green, fontWeight: 600 }}>{t}</span>)}
                    </div>
                  </div>
                )}
              </div>
            ) : tab === 'winback' ? (
              <div>
                <div style={{ fontSize: 13, color: C.label2, lineHeight: 1.7, marginBottom: 10, padding: '10px 12px', backgroundColor: C.bgInput, borderRadius: 8, fontStyle: 'italic' }}>{winback}</div>
                <button onClick={() => { navigator.clipboard.writeText(winback); setCopiedWinback(true); setTimeout(() => setCopiedWinback(false), 2000) }}
                  style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${copiedWinback ? C.green+'60' : C.blue+'30'}`, backgroundColor: copiedWinback ? C.green+'12' : C.blue+'12', color: copiedWinback ? C.green : C.blue, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                  {copiedWinback ? '✅ Copied!' : '📋 Copy Message'}
                </button>
              </div>
            ) : tab === 'hothome' ? (
              <div>
                {/* Hot Home Status Banner */}
                <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: C.red+'08', border: `1px solid ${C.red}20`, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' as any, gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 4 }}>🔥 {hotHome.property_name}</div>
                      <div style={{ fontSize: 11, color: C.label3 }}>📍 {hotHome.location_group} &nbsp;•&nbsp; Status: <span style={{ fontWeight: 600, color: C.red }}>{hotHome.vrbo_premier_status === 'NOT_PREMIER' ? 'Not Premier' : hotHome.vrbo_premier_status === 'PREMIER_GRACE_PERIOD' ? 'Grace Period' : 'Near Premier'}</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.label4 }}>VRBO</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>{hotHome.vrbo_reviews || 0} reviews</div>
                      <div style={{ fontSize: 11, color: hotHome.vrbo_rating >= 4.7 ? C.green : C.red }}>{hotHome.vrbo_rating ? `${hotHome.vrbo_rating}⭐` : '—'}</div>
                    </div>
                  </div>
                  {upcomingHotBooking && (
                    <div style={{ fontSize: 11, color: C.label3, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.red}15` }}>
                      📅 {guest.name} checks in {fmtDate(upcomingHotBooking.check_in)} → {fmtDate(upcomingHotBooking.check_out)}
                    </div>
                  )}
                </div>

                {/* AI Brief */}
                {hotBriefLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.label3, fontSize: 13 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 8, border: `2px solid ${C.red}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    Generating Hot Home brief...
                  </div>
                ) : hotBrief ? (
                  <div>
                    <div style={{ fontSize: 13, color: C.label2, lineHeight: 1.7, marginBottom: 10 }}>{hotBrief}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { navigator.clipboard.writeText(hotBrief); setCopiedBrief(true); setTimeout(() => setCopiedBrief(false), 2000) }}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${copiedBrief ? C.green+'60' : C.red+'30'}`, backgroundColor: copiedBrief ? C.green+'12' : C.red+'10', color: copiedBrief ? C.green : C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                        {copiedBrief ? '✅ Copied!' : '📋 Copy Brief'}
                      </button>
                      <button onClick={generateHotBrief} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: 'transparent', color: C.label3, fontSize: 12, cursor: 'pointer' }}>↺ Regenerate</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}


// ── LEAD AI ───────────────────────────────────────────────────────────────────
function LeadAI({ lead }: any) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => { setMessage(''); setOpen(false) }, [lead?.id])

  async function generate() {
    setLoading(true); setOpen(true); setMessage('')
    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: true, guest: {
          name: lead.name, email: lead.email,
          bookings: [],
          totalSpent: 0, bookingCount: 0,
          leadProperty: lead.property,
          leadChannel: lead.channel,
          leadNotes: lead.notes
        }})
      })
      const data = await res.json()
      setMessage(data.winback || data.insight || 'Could not generate message.')
    } catch(e: any) { setMessage('Error: ' + e.message) }
    setLoading(false)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {!open ? (
        <button onClick={generate} style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 2px 8px rgba(88,86,214,0.3)' }}>
          ✨ Generate AI Follow-up Message
        </button>
      ) : (
        <Card style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.indigo }}>✨ AI Follow-up Message</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={generate} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.separator}`, cursor: 'pointer', fontSize: 11, color: C.label3, backgroundColor: 'transparent' }}>↺ Regenerate</button>
              <button onClick={() => setOpen(false)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, color: C.label3, backgroundColor: 'transparent' }}>×</button>
            </div>
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.label3, fontSize: 13 }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, border: `2px solid ${C.indigo}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              Generating follow-up message...
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: C.label2, lineHeight: 1.7, padding: '10px 12px', backgroundColor: C.bgInput, borderRadius: 8, fontStyle: 'italic', marginBottom: 10 }}>{message}</div>
              <button onClick={() => navigator.clipboard.writeText(message).then(() => { const btn = document.activeElement as HTMLButtonElement; if (btn) { btn.textContent = '✅ Copied!'; btn.style.color = C.green; btn.style.borderColor = C.green+'60'; btn.style.backgroundColor = C.green+'12'; setTimeout(() => { btn.textContent = '📋 Copy Message'; btn.style.color = C.blue; btn.style.borderColor = C.blue+'30'; btn.style.backgroundColor = C.blue+'12' }, 2000) } })} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.blue}30`, backgroundColor: C.blue+'12', color: C.blue, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                📋 Copy Message
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ── AI CHAT PANEL ─────────────────────────────────────────────────────────────
function AIChatPanel({ guests, open, onToggle, currentUser }: any) {
  const [sessions, setSessions] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load sessions when opened
  useEffect(() => {
    if (open && currentUser) loadSessions()
  }, [open, currentUser])

  async function loadSessions() {
    try {
      const data = await sbFetch(`chat_sessions?user_id=eq.${encodeURIComponent(currentUser.username)}&order=updated_at.desc&limit=20`)
      if (Array.isArray(data)) setSessions(data)
    } catch {}
  }

  function newChat() {
    setActiveSession(null)
    setMessages([{ role: 'assistant', text: "Hi! I'm your VR 365 AI assistant. Ask me anything about your guests, bookings, or revenue.\n\n• Who is Mike Bay?\n• How many arrivals this week?\n• Which property has the most bookings?" }])
    setHistory([])
    setInput('')
  }

  async function openSession(session: any) {
    setActiveSession(session)
    const msgs = session.messages || []
    // Reconstruct display messages from stored history
    const displayMsgs = [{ role: 'assistant', text: "Hi! I'm your VR 365 AI assistant. Ask me anything about your guests, bookings, or revenue." }]
    msgs.forEach((m: any) => displayMsgs.push({ role: m.role === 'user' ? 'user' : 'assistant', text: m.content }))
    setMessages(displayMsgs)
    setHistory(msgs)
  }

  // Initialize with new chat when first opened
  useEffect(() => {
    if (open && !activeSession && messages.length === 0) newChat()
  }, [open])

  async function send() {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setLoading(true)

    const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

    // Pre-calculate arrivals/departures for common date ranges
    const getDateStr = (daysFromNow: number) => {
      const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    }
    const tomorrow = getDateStr(1)
    const nextWeekStart = getDateStr(1)
    const nextWeekEnd = getDateStr(7)
    const next30End = getDateStr(30)
    const next7Arrivals = guests.filter((g: any) => (g.bookings||[]).some((b: any) => b.check_in?.slice(0,10) >= todayStr && b.check_in?.slice(0,10) <= nextWeekEnd)).length
    const next7Departures = guests.filter((g: any) => (g.bookings||[]).some((b: any) => b.check_out?.slice(0,10) >= todayStr && b.check_out?.slice(0,10) <= nextWeekEnd)).length
    const next30Arrivals = guests.filter((g: any) => (g.bookings||[]).some((b: any) => b.check_in?.slice(0,10) >= todayStr && b.check_in?.slice(0,10) <= next30End)).length
    const tomorrowArrivals = guests.filter((g: any) => (g.bookings||[]).some((b: any) => b.check_in?.slice(0,10) === tomorrow)).length
    const tomorrowDepartures = guests.filter((g: any) => (g.bookings||[]).some((b: any) => b.check_out?.slice(0,10) === tomorrow)).length
    const totalRevenue = guests.reduce((s: number, g: any) => s + g.totalSpent, 0)
    const arrivingToday = guests.filter((g: any) => (g.bookings||[]).some((b: any) => b.check_in?.slice(0,10) === todayStr)).length
    const departingToday = guests.filter((g: any) => (g.bookings||[]).some((b: any) => b.check_out?.slice(0,10) === todayStr)).length
    const channelMap: any = {}
    guests.forEach((g: any) => (g.bookings||[]).forEach((b: any) => { if (b.channel) channelMap[b.channel] = (channelMap[b.channel]||0)+1 }))
    const topChannels = Object.entries(channelMap).sort(([,a],[,b]) => (b as number)-(a as number)).slice(0,8).map(([k,v]) => `${k}: ${v}`).join(', ')
    const propMap: any = {}
    guests.forEach((g: any) => (g.bookings||[]).forEach((b: any) => { if (b.property) propMap[b.property] = (propMap[b.property]||0)+1 }))
    const topProps = Object.entries(propMap).sort(([,a],[,b]) => (b as number)-(a as number)).slice(0,15).map(([k,v]) => `${k}: ${v}`).join(', ')
    const top50 = [...guests].sort((a: any, b: any) => b.totalSpent - a.totalSpent).slice(0, 50).map((g: any) => {
      const lastBooking = [...(g.bookings||[])].sort((a: any, b: any) => b.check_in?.localeCompare(a.check_in))[0]
      return `${g.name} | $${g.totalSpent.toFixed(0)} | ${g.bookingCount} stays | email: ${g.email || 'n/a'} | checkin: ${lastBooking?.check_in?.slice(0,10) || 'n/a'} | checkout: ${lastBooking?.check_out?.slice(0,10) || 'n/a'} | property: ${lastBooking?.unit_code || lastBooking?.property || 'n/a'} | channel: ${lastBooking?.channel || 'n/a'}`
    })

    // Smart guest lookup
    const recentNames = history.slice(-4).map((m: any) => m.content).join(' ')
    const allText = recentNames + ' ' + question
    let guestDetails = ''
    guests.forEach((g: any) => {
      if (g.name && allText.toLowerCase().includes(g.name.toLowerCase().split(' ')[0].toLowerCase()) && g.name.split(' ')[0].length > 2) {
        const bookings = [...(g.bookings||[])].sort((a: any, b: any) => b.check_in?.localeCompare(a.check_in))
        const bookingDetails = bookings.slice(0, 10).map((b: any) => `  - ${b.check_in?.slice(0,10)} to ${b.check_out?.slice(0,10)} at ${b.unit_code || b.property} | $${b.amount} | ${b.channel}`).join('\n')
        guestDetails += `\nFULL PROFILE - ${g.name}:\n  Email: ${g.email || 'n/a'} | Phone: ${g.phone || 'n/a'}\n  Total spent: $${g.totalSpent} | Total stays: ${g.bookingCount}\n  Tags: ${(g.tags||[]).join(', ') || 'none'} | Notes: ${g.notes || 'none'}\n  All bookings:\n${bookingDetails}\n`
      }
    })

    const systemPrompt = `You are an AI assistant for VR 365, a vacation rental CRM in Cle Elum/Suncadia, Washington.
Today: ${todayStr}. Total guests: ${guests.length}, Revenue: $${totalRevenue.toFixed(0)}, Bookings: ${guests.reduce((s: number, g: any) => s + g.bookingCount, 0)}, Repeat guests: ${guests.filter((g: any) => g.bookingCount > 1).length}.
Arriving today: ${arrivingToday} | Departing today: ${departingToday}
Arriving tomorrow: ${tomorrowArrivals} | Departing tomorrow: ${tomorrowDepartures}
Arriving next 7 days (including today): ${next7Arrivals} | Departing next 7 days: ${next7Departures}
Arriving next 30 days: ${next30Arrivals}
Top channels: ${topChannels} | Top properties: ${topProps}
Top 50 guests: ${top50.join(' || ')}
${guestDetails ? 'DETAILED PROFILES:\n' + guestDetails : ''}
Remember conversation context. If user says "him/her/they/he/she", refer back to who was just discussed. Use the pre-calculated stats above to answer date range questions accurately.`

    // Only send last 6 messages to save tokens
    const newHistory = [...history, { role: 'user', content: question }]
    const recentHistory = newHistory.slice(-6)

    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: true, context: systemPrompt, history: recentHistory })
      })
      const data = await res.json()
      const answer = data.answer || 'Sorry, could not answer that.'
      setMessages(prev => [...prev, { role: 'assistant', text: answer }])
      const fullHistory = [...newHistory, { role: 'assistant', content: answer }]
      setHistory(fullHistory)

      // Save to Supabase
      const title = activeSession?.title || question.slice(0, 50)
      if (activeSession) {
        await sbFetch(`chat_sessions?id=eq.${activeSession.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ messages: fullHistory, updated_at: new Date().toISOString() })
        })
      } else {
        const newSession = await sbFetch('chat_sessions', {
          method: 'POST',
          body: JSON.stringify({ user_id: currentUser.username, title, messages: fullHistory })
        })
        if (Array.isArray(newSession) && newSession[0]) setActiveSession(newSession[0])
      }
      loadSessions()
    } catch(e: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Error: ' + e.message }])
    }
    setLoading(false)
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await sbFetch(`chat_sessions?id=eq.${id}`, { method: 'DELETE' })
    if (activeSession?.id === id) newChat()
    loadSessions()
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
      {open && (
        <div style={{ width: showSidebar ? 680 : 380, height: 560, backgroundColor: C.bgCard, borderRadius: 18, boxShadow: '0 8px 40px rgba(0,0,30,0.2)', display: 'flex', overflow: 'hidden', border: `1px solid ${C.separator}`, transition: 'width 0.2s' }}>

          {/* Sidebar */}
          {showSidebar && (
            <div style={{ width: 220, borderRight: `1px solid ${C.separator}`, display: 'flex', flexDirection: 'column', backgroundColor: C.bgInput, flexShrink: 0 }}>
              <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.separator}` }}>
                <button onClick={newChat} style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.blue}30`, backgroundColor: C.blue+'12', color: C.blue, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ✏️ New Chat
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
                <div style={{ fontSize: 10, color: C.label4, fontWeight: 600, textTransform: 'uppercase' as any, letterSpacing: '0.06em', padding: '4px 6px 6px' }}>Recent</div>
                {sessions.length === 0 && <div style={{ fontSize: 11, color: C.label4, padding: '8px 6px' }}>No chats yet</div>}
                {sessions.map(s => (
                  <div key={s.id} onClick={() => openSession(s)}
                    style={{ padding: '8px 8px', borderRadius: 8, cursor: 'pointer', backgroundColor: activeSession?.id === s.id ? C.blue+'12' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: activeSession?.id === s.id ? C.blue : C.label, fontWeight: activeSession?.id === s.id ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as any }}>{s.title}</div>
                      <div style={{ fontSize: 10, color: C.label4, marginTop: 1 }}>{new Date(s.updated_at).toLocaleDateString()}</div>
                    </div>
                    <button onClick={e => deleteSession(s.id, e)} style={{ width: 18, height: 18, borderRadius: 9, border: 'none', backgroundColor: 'transparent', color: C.label4, cursor: 'pointer', fontSize: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.separator}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg,${C.indigo},${C.purple})`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setShowSidebar(!showSidebar)} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', backgroundColor: 'rgba(255,255,255,0.2)', cursor: 'pointer', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>☰</button>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>✨ AI Assistant</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={newChat} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', backgroundColor: 'rgba(255,255,255,0.2)', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 600 }}>New Chat</button>
                <button onClick={onToggle} style={{ width: 24, height: 24, borderRadius: 12, border: 'none', backgroundColor: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 14, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '85%', padding: '9px 12px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', backgroundColor: m.role === 'user' ? C.indigo : C.bgInput, color: m.role === 'user' ? '#fff' : C.label, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' as any }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', backgroundColor: C.bgInput, display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.indigo, animation: `bounce 1s ease ${i*0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.separator}`, display: 'flex', gap: 8, flexShrink: 0 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} placeholder="Ask about your guests..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }} />
              <button onClick={send} disabled={!input.trim() || loading}
                style={{ width: 34, height: 34, borderRadius: 17, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !input.trim() || loading ? 0.5 : 1, flexShrink: 0 }}>↑</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button onClick={onToggle} style={{ width: 64, height: 64, borderRadius: 32, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, boxShadow: '0 4px 20px rgba(88,86,214,0.5)', transition: 'transform 0.2s', transform: open ? 'scale(0.95)' : 'scale(1)' }}>
        <span style={{ fontSize: 22 }}>{open ? '×' : '✨'}</span>
        {!open && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.9)' }}>ASK</span>}
      </button>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)} }`}</style>
    </div>
  )
}

// ── PROPERTY MATCHING ────────────────────────────────────────────────────────
function matchProperty(hotHomes: any[], propName: string): any {
  const prop = propName.toLowerCase().trim()
  if (!prop) return null
  return hotHomes.find((h: any) => {
    const hn = h.property_name.toLowerCase()
    // 1. Unit codes — most accurate
    if (h.unit_codes?.some((c: string) => {
      const cl = c.toLowerCase()
      return prop === cl || prop.startsWith(cl) || cl.startsWith(prop)
    })) return true
    // 2. Exact match
    if (prop === hn) return true
    // 3. One fully contains the other
    if (prop.length > 5 && (prop.includes(hn) || hn.includes(prop))) return true
    // 4. ALL significant words must match (prevents single-word false matches)
    const words = hn.split(' ').filter((w: string) => w.length > 4)
    if (words.length >= 2) return words.every((w: string) => prop.includes(w))
    return false
  }) || null
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Check localStorage for saved session
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('crm_user') : null
      if (saved) {
        setCurrentUser(JSON.parse(saved))
      }
    } catch {}
    setAuthChecked(true)
  }, [])

  function handleLogin(user: any) {
    setCurrentUser(user)
    localStorage.setItem('crm_user', JSON.stringify(user))
  }

  function handleLogout() {
    setCurrentUser(null)
    localStorage.removeItem('crm_user')
    setShowSettings(false)
  }

  const [guests, setGuests] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  function selectGuest(g: any) {
    setProfileLoading(true)
    setSelected(g)
    setTimeout(() => setProfileLoading(false), 150)
  }
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('spent')
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '')
      return ['dashboard','guests','repeat','winback','leads','hothomes','analytics'].includes(hash) ? hash : 'dashboard'
    }
    return 'dashboard'
  })
  const [tabLoading, setTabLoading] = useState(false)

  // Handle browser back/forward buttons
  useEffect(() => {
    function handlePopState() {
      const hash = window.location.hash.replace('#', '')
      const tab = ['dashboard','guests','repeat','winback','leads','hothomes','analytics'].includes(hash) ? hash : 'dashboard'
      setTabLoading(true)
      requestAnimationFrame(() => {
        setActiveTab(tab)
        setTimeout(() => setTabLoading(false), 50)
      })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function switchTab(id: string) {
    if (id === activeTab) return
    setTabLoading(true)
    window.history.pushState(null, '', `#${id}`)
    requestAnimationFrame(() => {
      setActiveTab(id)
      setTimeout(() => setTabLoading(false), 50)
    })
  }
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [lastImport, setLastImport] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filterChannel, setFilterChannel] = useState('all')
  const [filterTier, setFilterTier] = useState('all')
  const [filterTag, setFilterTag] = useState('all')
  const [newTag, setNewTag] = useState('')
  // Leads
  const [leads, setLeads] = useState<any[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  // Hot Homes
  const [hotHomes, setHotHomes] = useState<any[]>([])
  const [hotHomesLoading, setHotHomesLoading] = useState(false)
  const [hotHomesSearch, setHotHomesSearch] = useState('')
  const [hotHomesGroup, setHotHomesGroup] = useState('all')
  const [hotHomesStatus, setHotHomesStatus] = useState('all')
  const [editingHome, setEditingHome] = useState<any>(null)
  const [vrboImporting, setVrboImporting] = useState(false)
  const [vrboImportMsg, setVrboImportMsg] = useState('')
  const vrboFileRef = useRef<HTMLInputElement>(null)
  const [showAddLead, setShowAddLead] = useState(false)
  const [leadFilter, setLeadFilter] = useState('all')
  const [leadSearch, setLeadSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [newLead, setNewLead] = useState({ name: '', email: '', phone: '', property: '', channel: '', notes: '', source: 'manual' })
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const in7days = (() => { const d = new Date(Date.now() + 7*24*60*60*1000); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const [dashDateFrom, setDashDateFrom] = useState(todayStr)
  const [dashDateTo, setDashDateTo] = useState(todayStr)
  const [dashView, setDashView] = useState('arrivals')
  const [dashFilter, setDashFilter] = useState('all')
  // Win-back filters
  const [wbPriority, setWbPriority] = useState('all')
  const [wbMonths, setWbMonths] = useState('all')
  const [wbMinValue, setWbMinValue] = useState('')
  const [wbMaxValue, setWbMaxValue] = useState('')
  const [wbChannel, setWbChannel] = useState('all')
  const [wbMinBookings, setWbMinBookings] = useState('1')
  const [wbMaxBookings, setWbMaxBookings] = useState('100')
  // Repeat guest filters
  const [rpSearch, setRpSearch] = useState('')
  const [rpChannel, setRpChannel] = useState('all')
  const [rpProperty, setRpProperty] = useState('all')
  const [rpMinStays, setRpMinStays] = useState('2')
  const [rpSort, setRpSort] = useState('spent')
  const [rpTier, setRpTier] = useState('all')
  const [rpTag, setRpTag] = useState('all')
  const [rpSelected, setRpSelected] = useState<any>(null)
  const [visibleCount, setVisibleCount] = useState(50)
  const fileRef = useRef<HTMLInputElement>(null)

  const TODAY_MS = Date.now()

  // Load stats — lightweight, just aggregates
  const loadHotHomes = useCallback(async () => {
    setHotHomesLoading(true)
    const data = await sbFetch('property_reviews?select=*&order=property_name.asc')
    if (Array.isArray(data)) setHotHomes(data.map(h => ({
      ...h,
      totalReviews: h.vrbo_reviews || 0,
      blendedRating: h.vrbo_rating || 0,
      isHotHome: (
        // NOT_PREMIER → always Hot Home
        h.vrbo_premier_status === 'NOT_PREMIER' ||
        // PREMIER_GRACE_PERIOD → Hot Home
        h.vrbo_premier_status === 'PREMIER_GRACE_PERIOD' ||
        // Near Premier flag → Hot Home
        (h.vrbo_premier_flags || '').toLowerCase().includes('near premier') ||
        // VRBO rating strictly below 4.7 → Hot Home
        (h.vrbo_rating > 0 && h.vrbo_rating < 4.7)
      )
    })))
    setHotHomesLoading(false)
  }, [])

  async function updateHotHome(id: string, patch: any) {
    await sbFetch(`property_reviews?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...patch, last_updated: new Date().toISOString() })
    })
    loadHotHomes()
  }

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true)
    const data = await sbFetch('leads?select=*&order=created_at.desc')
    if (Array.isArray(data)) setLeads(data)
    setLeadsLoading(false)
  }, [])

  async function addLead() {
    if (!newLead.name) return
    const lead = { ...newLead, status: 'new', created_at: new Date().toISOString() }
    const res = await sbFetch('leads', { method: 'POST', body: JSON.stringify(lead) })
    setShowAddLead(false)
    setNewLead({ name: '', email: '', phone: '', property: '', channel: '', notes: '', source: 'manual' })
    loadLeads()
  }

  async function updateLead(id: string, patch: any) {
    await sbFetch(`leads?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    if (selectedLead?.id === id) setSelectedLead((prev: any) => ({ ...prev, ...patch }))
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete this lead?')) return
    await sbFetch(`leads?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
    setLeads(prev => prev.filter(l => l.id !== id))
    if (selectedLead?.id === id) setSelectedLead(null)
  }

  const loadStats = useCallback(async () => {
    const data = await sbFetch('bookings?select=amount,check_in,guest_id')
    if (!Array.isArray(data)) return
    const totalRevenue = data.reduce((s: number, b: any) => s + (b.amount || 0), 0)
    const guestCounts: any = {}
    data.forEach((b: any) => { guestCounts[b.guest_id] = (guestCounts[b.guest_id] || 0) + 1 })
    const repeatGuests = Object.values(guestCounts).filter((c: any) => c > 1).length
    const monthMap: any = {}
    data.forEach((b: any) => {
      if (!b.check_in) return
      const k = b.check_in.slice(0, 7)
      monthMap[k] = (monthMap[k] || 0) + (b.amount || 0)
    })
    const revenueByMonth = Object.entries(monthMap).sort(([a], [b]) => (a as string).localeCompare(b as string)).slice(-12).map(([k, v]) => ({ month: fmtMonth(k as string), revenue: v }))
    setStats({ totalRevenue, totalBookings: data.length, repeatGuests, revenueByMonth })
  }, [])

  // Enrich a guest record with computed fields
  function enrich(g: any) {
    const bookings = g.bookings || []
    return {
      ...g,
      totalSpent: bookings.reduce((s: number, b: any) => s + (b.amount || 0), 0),
      bookingCount: bookings.length,
      lastStay: [...bookings].sort((a: any, b: any) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())[0]?.check_in || '',
      properties: [...new Set(bookings.map((b: any) => b.property))]
    }
  }

  // Load first 50 guests instantly, then load the rest in background
  const loadGuests = useCallback(async () => {
    setLoading(true)

    // Load first 50 immediately for fast display
    const first = await sbFetch(`guests?select=*,bookings(id,property,unit_code,check_in,check_out,amount,channel,date_booked,guest_name,guest_email)&order=name.asc&limit=50`)
    if (!Array.isArray(first)) { setLoading(false); return }
    setGuests(first.map(enrich))
    setLoading(false)

    // Load the rest in background batches of 500
    let offset = 50
    while (true) {
      const batch = await sbFetch(`guests?select=*,bookings(id,property,unit_code,check_in,check_out,amount,channel,date_booked,guest_name,guest_email)&order=name.asc&limit=500&offset=${offset}`)
      if (!Array.isArray(batch) || batch.length === 0) break
      setGuests(prev => [...prev, ...batch.map(enrich)])
      offset += batch.length
      if (batch.length < 500) break
    }
  }, [])

  useEffect(() => {
    loadGuests(); loadStats(); loadLeads(); loadHotHomes()
    // Load last import timestamp
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lastImport') : null
    if (saved) setLastImport(saved)
  }, [])

  const allChannels = useMemo(() => {
    const set = new Set<string>()
    guests.forEach(g => (g.bookings || []).forEach((b: any) => { if (b.channel) set.add(b.channel) }))
    return [...set].sort()
  }, [guests])

  // Property analytics
  const [propSearch, setPropSearch] = useState('')
  const [propSort, setPropSort] = useState('revenue')
  const propertyStats = useMemo(() => {
    const map: Record<string, any> = {}
    guests.forEach(g => (g.bookings || []).forEach((b: any) => {
      const p = b.property || 'Unknown'
      if (!map[p]) map[p] = { name: p, revenue: 0, bookings: 0, guests: new Set() }
      map[p].revenue += (b.amount || 0)
      map[p].bookings += 1
      map[p].guests.add(g.id)
    }))
    let list = Object.values(map).map(p => ({ ...p, uniqueGuests: p.guests.size }))
    const q = propSearch.toLowerCase()
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q))
    if (propSort === 'revenue') list.sort((a, b) => b.revenue - a.revenue)
    else if (propSort === 'bookings') list.sort((a, b) => b.bookings - a.bookings)
    else if (propSort === 'guests') list.sort((a, b) => b.uniqueGuests - a.uniqueGuests)
    else list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [guests, propSearch, propSort])

  const filtered = useMemo(() => {
    let list = guests.filter(g => {
      const q = search.toLowerCase()
      const ms = !q || g.name?.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q) ||
        (g.aliases || []).some((a: string) => a.toLowerCase().includes(q)) ||
        (g.bookings || []).some((b: any) => (b.guest_name || '').toLowerCase().includes(q) || (b.guest_email || '').toLowerCase().includes(q) || (b.id || '').toLowerCase().includes(q))
      const mc = filterChannel === 'all' || (g.bookings || []).some((b: any) => b.channel === filterChannel)
      const mt = filterTier === 'all' ||
        (filterTier === 'platinum' && g.totalSpent >= 10000) ||
        (filterTier === 'gold' && g.totalSpent >= 5000 && g.totalSpent < 10000) ||
        (filterTier === 'silver' && g.totalSpent >= 2000 && g.totalSpent < 5000) ||
        (filterTier === 'bronze' && g.totalSpent < 2000) ||
        (filterTier === 'superguest' && g.bookingCount >= 10) ||
        (filterTier === 'vipguest' && g.bookingCount >= 5) ||
        (filterTier === 'repeat' && g.bookingCount >= 2) ||
        (filterTier === 'firsttime' && g.bookingCount === 1)
      const mtag = filterTag === 'all' || (g.tags || []).includes(filterTag)
      return ms && mc && mt && mtag
    })
    if (sortBy === 'spent') list.sort((a, b) => b.totalSpent - a.totalSpent)
    else if (sortBy === 'bookings') list.sort((a, b) => b.bookingCount - a.bookingCount)
    else if (sortBy === 'recent') list.sort((a, b) => new Date(b.lastStay).getTime() - new Date(a.lastStay).getTime())
    else list.sort((a, b) => a.name?.localeCompare(b.name))
    return list
  }, [guests, search, sortBy, filterChannel, filterTier, filterTag])

  const winbackList = useMemo(() => guests
    .filter(g => g.lastStay && (TODAY_MS - new Date(g.lastStay).getTime()) / (1000 * 60 * 60 * 24 * 30) >= 12)
    .map(g => ({ ...g, monthsGone: Math.floor((TODAY_MS - new Date(g.lastStay).getTime()) / (1000 * 60 * 60 * 24 * 30)), priority: g.totalSpent >= 8000 ? 'High' : g.totalSpent >= 3000 ? 'Medium' : 'Low' }))
    .sort((a, b) => b.totalSpent - a.totalSpent), [guests])

  const filteredWinback = useMemo(() => winbackList.filter(g => {
    if (wbPriority !== 'all' && g.priority !== wbPriority) return false
    if (wbMonths === '12-24' && (g.monthsGone < 12 || g.monthsGone > 24)) return false
    if (wbMonths === '24-36' && (g.monthsGone < 24 || g.monthsGone > 36)) return false
    if (wbMonths === '36+' && g.monthsGone < 36) return false
    if (wbMinValue && g.totalSpent < parseFloat(wbMinValue)) return false
    if (wbMaxValue && g.totalSpent > parseFloat(wbMaxValue)) return false
    if (wbChannel !== 'all' && !(g.bookings||[]).some((b: any) => b.channel === wbChannel)) return false
    if (g.bookingCount < parseInt(wbMinBookings||'1')) return false
    if (g.bookingCount > parseInt(wbMaxBookings||'100')) return false
    return true
  }), [winbackList, wbPriority, wbMonths, wbMinValue, wbMaxValue, wbChannel, wbMinBookings, wbMaxBookings])

  // Dashboard data
  const today = todayStr
  const dashData = useMemo(() => {
    const todayArrivals: any[] = []
    const todayDepartures: any[] = []
    const rangeArrivals: any[] = []
    const rangeDepartures: any[] = []

    guests.forEach(g => {
      ;(g.bookings || []).forEach((b: any) => {
        const ci = b.check_in ? b.check_in.slice(0,10) : null
        const co = b.check_out ? b.check_out.slice(0,10) : null
        const gInfo = { ...g, booking: b }

        if (ci === today) todayArrivals.push(gInfo)
        if (co === today) todayDepartures.push(gInfo)
        if (ci && ci >= dashDateFrom && ci <= dashDateTo) rangeArrivals.push(gInfo)
        if (co && co >= dashDateFrom && co <= dashDateTo) rangeDepartures.push(gInfo)
      })
    })

    const ownerChannels = ['Owner', 'Owner Hold', 'Owner Referral']
    const isOwner = (g: any) => {
      const ownerBookings = (g.bookings||[]).filter((b: any) => ownerChannels.includes(b.channel)).length
      return ownerBookings > 0 && ownerBookings >= (g.bookings||[]).length * 0.5
    }

    const sortGuests = (list: any[]) => {
      const owners = list.filter(g => isOwner(g)).sort((a, b) => b.bookingCount - a.bookingCount)
      const repeatGuests = list.filter(g => !isOwner(g) && g.bookingCount > 1).sort((a, b) => b.bookingCount - a.bookingCount)
      const firstTimers = list.filter(g => !isOwner(g) && g.bookingCount === 1)
      return [...repeatGuests, ...firstTimers, ...owners]
    }

    return {
      todayArrivals: sortGuests(todayArrivals),
      todayDepartures: sortGuests(todayDepartures),
      rangeArrivals: sortGuests(rangeArrivals),
      rangeDepartures: sortGuests(rangeDepartures),
    }
  }, [guests, dashDateFrom, dashDateTo, today])

  const revenueByProperty = useMemo(() => {
    const map: any = {}
    guests.forEach(g => (g.bookings || []).forEach((b: any) => { map[b.property] = (map[b.property] || 0) + (b.amount || 0) }))
    return Object.entries(map).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10).map(([name, value]) => ({ name, value }))
  }, [guests])

  // All unique properties for filter dropdowns
  const allProperties = useMemo(() => {
    const set = new Set<string>()
    guests.forEach(g => (g.bookings || []).forEach((b: any) => { if (b.property && b.property !== 'Unknown') set.add(b.property) }))
    return [...set].sort()
  }, [guests])

  // Repeat guests tab
  const repeatGuests_list = useMemo(() => {
    let list = guests
      .filter(g => g.bookingCount >= parseInt(rpMinStays || '2'))
      .map(g => {
        const bookings = g.bookings || []
        const propCount: Record<string, number> = {}
        bookings.forEach((b: any) => { propCount[b.property] = (propCount[b.property] || 0) + 1 })
        const favProperty = Object.entries(propCount).sort(([,a],[,b]) => (b as number)-(a as number))[0]?.[0] || ''
        const avgSpend = g.bookingCount > 0 ? g.totalSpent / g.bookingCount : 0
        const firstBooking = [...bookings].sort((a: any, b: any) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime())[0]?.check_in || ''
        const channels = [...new Set(bookings.map((b: any) => b.channel).filter(Boolean))]
        const futureBookings = bookings.filter((b: any) => b.check_in && b.check_in.slice(0,10) > todayStr)
        return { ...g, favProperty, avgSpend, firstBooking, channels, futureBookings }
      })

    // Apply filters
    const q = rpSearch.toLowerCase()
    if (q) list = list.filter(g => g.name?.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q) || (g.bookings||[]).some((b: any) => (b.id||'').toLowerCase().includes(q)))
    if (rpChannel !== 'all') list = list.filter(g => g.channels.includes(rpChannel))
    if (rpProperty !== 'all') list = list.filter(g => (g.bookings||[]).some((b: any) => b.property === rpProperty))
    if (rpTier !== 'all') list = list.filter(g =>
      (rpTier === 'platinum' && g.totalSpent >= 10000) ||
      (rpTier === 'gold' && g.totalSpent >= 5000 && g.totalSpent < 10000) ||
      (rpTier === 'silver' && g.totalSpent >= 2000 && g.totalSpent < 5000) ||
      (rpTier === 'bronze' && g.totalSpent < 2000) ||
      (rpTier === 'superguest' && g.bookingCount >= 10) ||
      (rpTier === 'vipguest' && g.bookingCount >= 5)
    )
    if (rpTag !== 'all') list = list.filter(g => (g.tags || []).includes(rpTag))

    // Sort
    if (rpSort === 'spent') list.sort((a, b) => b.totalSpent - a.totalSpent)
    else if (rpSort === 'stays') list.sort((a, b) => b.bookingCount - a.bookingCount)
    else if (rpSort === 'recent') list.sort((a, b) => new Date(b.lastStay).getTime() - new Date(a.lastStay).getTime())
    else if (rpSort === 'avg') list.sort((a, b) => b.avgSpend - a.avgSpend)
    else list.sort((a, b) => a.name?.localeCompare(b.name))

    return list
  }, [guests, rpMinStays, rpSearch, rpChannel, rpProperty, rpSort, rpTier, rpTag])

  async function updateGuest(id: string, patch: any) {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g))
    if (selected?.id === id) setSelected((prev: any) => ({ ...prev, ...patch }))
    await sbFetch(`guests?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }

  async function handleImport(file: File) {
    setImporting(true)
    setImportMsg('Uploading...')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) {
        const now = new Date().toISOString()
        setImportMsg(`✅ ${data.message}`)
        setLastImport(now)
        localStorage.setItem('lastImport', now)
        await loadGuests()
        await loadStats()
      } else {
        setImportMsg(`❌ Error: ${data.error}`)
      }
    } catch (e: any) {
      setImportMsg(`❌ ${e.message}`)
    }
    setImporting(false)
    setTimeout(() => setImportMsg(''), 8000)
  }

if (!authChecked) return null
  if (!currentUser) return <LoginPage onLogin={handleLogin} />
  const totalGuests = guests.length
  const totalRevenue = guests.reduce((s, g) => s + g.totalSpent, 0)
  const totalBookings = guests.reduce((s, g) => s + g.bookingCount, 0)
  const repeatGuests = guests.filter(g => g.bookingCount > 1).length

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',sans-serif", backgroundColor: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: C.label }}>
      {showSettings && <SettingsPage currentUser={currentUser} onClose={() => setShowSettings(false)} onLogout={handleLogout} />}
      <AIChatPanel guests={guests} open={showChat} onToggle={() => setShowChat(!showChat)} currentUser={currentUser} />
      <LoadingBar loading={loading || tabLoading} />

      {/* HEADER */}
      <div style={{ background: 'linear-gradient(180deg,#F4F6FB 0%,#E9ECF2 100%)', borderBottom: `1px solid ${C.separator}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 1px 0 rgba(0,0,30,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/logo.png" alt="VR 365" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>VR 365 CRM</div>
            <div style={{ fontSize: 11, color: C.label3 }}>vacationrental365.com</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,30,0.08)', borderRadius: 9, padding: 2, gap: 2 }}>
            {[{ id: 'dashboard', label: '🏡 Dashboard' }, { id: 'guests', label: '👤 Guests' }, { id: 'repeat', label: `🔁 Repeat Guests (${repeatGuests_list.length})` }, { id: 'winback', label: `🎯 Win-Back (${winbackList.length})` }, { id: 'leads', label: `💼 Leads (${leads.length})` }, { id: 'hothomes', label: `🔥 Hot Homes (${hotHomes.filter(h => h.isHotHome).length})` }, { id: 'analytics', label: '📊 Analytics' }].map(t => (
              <button key={t.id} onClick={() => switchTab(t.id)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, backgroundColor: activeTab === t.id ? C.bgCard : 'transparent', color: activeTab === t.id ? C.label : C.label3, boxShadow: activeTab === t.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' as any, transform: 'scale(1)' }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >{t.label}</button>
            ))}
          </div>
          {importMsg && <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>{importMsg}</span>}
          {currentUser?.role === 'admin' && lastImport && !importMsg && (
            <span style={{ fontSize: 11, color: C.label, backgroundColor: C.blue+'12', padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.blue}30`, fontWeight: 600 }}>
              🕐 Last sync: {new Date(lastImport).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(lastImport).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          )}
          {currentUser?.role === 'admin' && (
            <button onClick={() => setShowSettings(true)} style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.label3 }} title="Settings">⚙️</button>
          )}
          {currentUser?.role === 'admin' && (
            <label style={{ cursor: importing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: C.blue, padding: '7px 14px', borderRadius: 8, backgroundColor: C.blue + '14', border: `1px solid ${C.blue}30`, opacity: importing ? 0.6 : 1 }}>
              {importing ? 'Importing...' : 'Import CSV'}
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
            </label>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, backgroundColor: C.bgInput, border: `1px solid ${C.separator}` }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.label }}>{currentUser?.username}</span>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, backgroundColor: currentUser?.role === 'admin' ? C.blue+'18' : currentUser?.role === 'supervisor' ? C.orange+'18' : C.green+'18', color: currentUser?.role === 'admin' ? C.blue : currentUser?.role === 'supervisor' ? C.orange : C.green, fontWeight: 600 }}>{currentUser?.role}</span>
            <button onClick={handleLogout} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.separator}`, backgroundColor: 'transparent', color: C.label3, cursor: 'pointer', fontWeight: 500 }}>Sign Out</button>
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.separator, borderBottom: `1px solid ${C.separator}`, flexShrink: 0 }}>
        {[
          { label: 'Total Guests', value: totalGuests.toLocaleString(), sub: `${filtered.length} shown`, color: C.blue, grad: C.statGrad[0] },
          { label: 'All-Time Revenue', value: currentUser?.role === 'admin' ? fmt$(totalRevenue) : '——', sub: 'across all properties', color: C.green, grad: C.statGrad[1] },
          { label: 'Total Bookings', value: totalBookings.toLocaleString(), sub: 'reservations', color: C.orange, grad: C.statGrad[2] },
          { label: 'Repeat Guests', value: repeatGuests.toLocaleString(), sub: totalGuests ? `${Math.round(repeatGuests / totalGuests * 100)}% retention` : '', color: C.purple, grad: C.statGrad[3] },
        ].map((s, i) => (
          <div key={i} style={{ background: s.grad, padding: '12px 18px' }}>
            <div style={{ fontSize: 11, color: C.label3, fontWeight: 500, marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.4px' }}>{loading ? '...' : s.value}</div>
            <div style={{ fontSize: 10, color: C.label4, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tabLoading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, border: `4px solid ${C.blue}30`, borderTopColor: C.blue, animation: 'spin 0.7s linear infinite' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: C.label3 }}>Loading...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
      {activeTab === 'dashboard' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>

            {/* Today summary */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 13, color: C.label3 }}>Daily briefing for VR 365</div>
            </div>

            {/* Today cards — clickable filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { id: 'arriving-today', label: 'Arriving Today', value: dashData.todayArrivals.length, sub: 'always today', color: C.green, grad: C.statGrad[1] },
                { id: 'departing-today', label: 'Departing Today', value: dashData.todayDepartures.length, sub: 'always today', color: C.orange, grad: C.statGrad[2] },
                { id: 'repeat', label: 'Repeat Arrivals', value: dashData.rangeArrivals.filter(g => g.bookingCount > 1).length, sub: dashDateFrom === dashDateTo ? 'arriving today' : 'in date range', color: C.blue, grad: C.statGrad[0] },
                { id: 'firsttime', label: 'First Timers', value: dashData.rangeArrivals.filter(g => g.bookingCount === 1).length, sub: dashDateFrom === dashDateTo ? 'arriving today' : 'in date range', color: C.purple, grad: C.statGrad[3] },
                { id: 'hothome', label: '🔥 VRBO Hot Homes', value: dashData.rangeArrivals.filter(g => {
                  const ch = g.booking?.channel || ''
                  if (!['VRBO/Homeaway','Vrbo','VRBO','HomeAway','NextPax','Expedia'].some(v => ch.includes(v))) return false
                  const prop = g.booking?.unit_code || g.booking?.property || ''
                  const match = matchProperty(hotHomes, prop)
                  return match?.isHotHome === true
                }).length, sub: dashDateFrom === dashDateTo ? 'arriving today' : 'in date range', color: C.red, grad: 'linear-gradient(135deg,#FFF0F0,#FFD6D6)' },
              ].map(s => (
                <div key={s.id} onClick={() => {
                  setDashFilter(dashFilter === s.id ? 'all' : s.id)
                  if (s.id === 'departing-today') { setDashView('departures'); setDashDateFrom(todayStr); setDashDateTo(todayStr) }
                  else if (s.id === 'arriving-today') { setDashView('arrivals'); setDashDateFrom(todayStr); setDashDateTo(todayStr) }
                  else setDashView('arrivals')
                }}
                  style={{ background: s.grad, borderRadius: 13, padding: '14px 16px', borderTop: `3px solid ${s.color}`, boxShadow: dashFilter === s.id ? `0 0 0 3px ${s.color}` : C.cardShadow, cursor: 'pointer', transform: dashFilter === s.id ? 'scale(0.97)' : 'scale(1)', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 11, color: C.label3, fontWeight: 500, marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color, letterSpacing: '-0.4px' }}>{s.value}</div>
                  {s.sub && <div style={{ fontSize: 11, color: C.label4, marginTop: 3 }}>{s.sub}</div>}
                  {dashFilter === s.id && <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 4 }}>● Filtering</div>}
                </div>
              ))}
            </div>

            {/* Date range picker */}
            <Card style={{ padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as any }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.label }}>Date Range</div>
                <input type="date" value={dashDateFrom} onChange={e => { setDashDateFrom(e.target.value); setDashFilter('all') }}
                  style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }} />
                <span style={{ color: C.label3, fontSize: 13 }}>to</span>
                <input type="date" value={dashDateTo} onChange={e => { setDashDateTo(e.target.value); setDashFilter('all') }}
                  style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }} />
                {/* Quick range buttons */}
                {[
                  { label: 'Today', from: today, to: today },
                  { label: 'This Week', from: today, to: (() => { const d = new Date(Date.now()+6*24*60*60*1000); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })() },
                  { label: 'Next 30', from: today, to: (() => { const d = new Date(Date.now()+30*24*60*60*1000); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })() },
                ].map(r => {
                  const isActive = dashDateFrom === r.from && dashDateTo === r.to
                  return (
                    <button key={r.label} onClick={() => { setDashDateFrom(r.from); setDashDateTo(r.to); setDashFilter('all') }}
                      style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${isActive ? C.blue : C.blue+'30'}`, backgroundColor: isActive ? C.blue : C.blue+'12', color: isActive ? '#fff' : C.blue, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', transform: isActive ? 'scale(0.97)' : 'scale(1)' }}>
                      {r.label}
                    </button>
                  )
                })}
              </div>

              {/* Inline revenue summary */}
              {(() => {
                const list = dashView === 'arrivals' ? dashData.rangeArrivals : dashData.rangeDepartures
                const rev = list.reduce((s, g) => s + (g.booking?.amount || 0), 0)
                const avg = list.length > 0 ? rev / list.length : 0
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.separator}` }}>
                    {/* Stats on the left */}
                    <div style={{ display: 'flex', gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 10, color: C.label4, fontWeight: 500 }}>Total Revenue</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>{currentUser?.role === 'admin' ? fmt$(rev) : '——'}</div>
                      </div>
                      <div style={{ width: 1, backgroundColor: C.separator }} />
                      <div>
                        <div style={{ fontSize: 10, color: C.label4, fontWeight: 500 }}>Bookings</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.orange }}>{list.length}</div>
                      </div>
                      <div style={{ width: 1, backgroundColor: C.separator }} />
                      <div>
                        <div style={{ fontSize: 10, color: C.label4, fontWeight: 500 }}>Avg per Booking</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.blue }}>{currentUser?.role === 'admin' ? fmt$(avg) : '——'}</div>
                      </div>
                    </div>
                    {/* Toggle on the right */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,30,0.06)', borderRadius: 8, padding: 2, gap: 2 }}>
                        {(['arrivals', 'departures'] as const).map(v => (
                          <button key={v} onClick={() => { setDashView(v); setDashFilter('all') }}
                            style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, backgroundColor: dashView === v ? C.bgCard : 'transparent', color: dashView === v ? C.label : C.label3, boxShadow: dashView === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', textTransform: 'capitalize' as any }}>
                            {v === 'arrivals' ? `✈️ Arrivals (${dashData.rangeArrivals.length})` : `🏁 Departures (${dashData.rangeDepartures.length})`}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => {
                        // Build the same filtered list as displayed
                        let printList = dashView === 'arrivals' ? dashData.rangeArrivals : dashData.rangeDepartures
                        if (dashFilter === 'arriving-today') printList = dashData.todayArrivals
                        if (dashFilter === 'departing-today') printList = dashData.todayDepartures
                        if (dashFilter === 'repeat') printList = dashData.rangeArrivals.filter((g: any) => g.bookingCount > 1)
                        if (dashFilter === 'firsttime') printList = dashData.rangeArrivals.filter((g: any) => g.bookingCount === 1)
                        if (dashFilter === 'hothome') printList = dashData.rangeArrivals.filter((g: any) => {
                          const ch = g.booking?.channel || ''
                          if (!['VRBO/Homeaway','Vrbo','VRBO','HomeAway','NextPax','Expedia'].some((v: string) => ch.includes(v))) return false
                          const match = matchProperty(hotHomes, g.booking?.unit_code || g.booking?.property || '')
                          return match?.isHotHome === true
                        })
                        const filterLabel = dashFilter === 'hothome' ? 'VRBO Hot Homes' : dashFilter === 'repeat' ? 'Repeat Guests' : dashFilter === 'firsttime' ? 'First Timers' : dashView === 'arrivals' ? 'Arrivals' : 'Departures'
                        const title = `VR 365 — ${filterLabel} Report`
                        const dateRange = dashDateFrom === dashDateTo ? fmtDate(dashDateFrom) : `${fmtDate(dashDateFrom)} – ${fmtDate(dashDateTo)}`
                        const isAdmin = currentUser?.role === 'admin'
                        const totalRev = printList.reduce((s: number, g: any) => s + (g.booking?.amount || 0), 0)
                        const html = `<!DOCTYPE html><html><head><title>${title}</title>
                        <style>
                          body { font-family: -apple-system, sans-serif; padding: 32px; color: #1C1C2E; }
                          h1 { font-size: 22px; margin-bottom: 4px; }
                          .meta { font-size: 13px; color: #72728A; margin-bottom: 20px; }
                          .summary { display: flex; gap: 32px; margin-bottom: 24px; padding: 16px; background: #F4F6FB; border-radius: 10px; }
                          .summary-item label { font-size: 11px; color: #72728A; display: block; margin-bottom: 4px; }
                          .summary-item span { font-size: 20px; font-weight: 700; }
                          table { width: 100%; border-collapse: collapse; font-size: 12px; }
                          th { background: #F4F6FB; padding: 10px 12px; text-align: left; font-size: 11px; color: #72728A; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #D1D4DC; }
                          td { padding: 10px 12px; border-bottom: 1px solid #EEF0F5; vertical-align: top; }
                          tr:hover td { background: #F9FAFC; }
                          .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; }
                          .repeat { background: #E8F7EE; color: #25A244; }
                          .first { background: #E8F0FF; color: #007AFF; }
                          .owner { background: #FFF3E0; color: #F48C06; }
                          .footer { margin-top: 24px; font-size: 11px; color: #A0A0BC; text-align: center; }
                          @media print { body { padding: 16px; } }
                        </style></head><body>
                        <h1>${title}</h1>
                        <div class="meta">Date Range: ${dateRange} &nbsp;•&nbsp; Generated: ${new Date().toLocaleString()} &nbsp;•&nbsp; By: ${currentUser?.username}</div>
                        <div class="summary">
                          <div class="summary-item"><label>Total ${filterLabel}</label><span>${printList.length}</span></div>
                          <div class="summary-item"><label>Repeat Guests</label><span>${printList.filter((g: any) => g.bookingCount > 1).length}</span></div>
                          <div class="summary-item"><label>First Timers</label><span>${printList.filter((g: any) => g.bookingCount === 1).length}</span></div>
                          ${isAdmin ? `<div class="summary-item"><label>Total Revenue</label><span style="color:#25A244">${fmt$(totalRev)}</span></div>` : ''}
                        </div>
                        <table>
                          <thead><tr>
                            <th>#</th><th>Guest</th><th>Email</th><th>Property</th>
                            <th>${dashView === 'arrivals' ? 'Check-In' : 'Check-Out'}</th>
                            <th>${dashView === 'arrivals' ? 'Check-Out' : 'Check-In'}</th>
                            <th>Channel</th><th>Type</th>
                            ${dashFilter === 'hothome' ? '<th>Hot Home Status</th>' : ''}
                            ${isAdmin ? '<th>Amount</th>' : ''}
                          </tr></thead>
                          <tbody>
                          ${printList.map((g: any, i: number) => {
                            const b = g.booking
                            const ownerBookings = (g.bookings||[]).filter((bk: any) => ['Owner','Owner Hold','Owner Referral'].includes(bk.channel)).length
                            const isOwner = ownerBookings > 0 && ownerBookings >= (g.bookings||[]).length * 0.5
                            const badge = isOwner ? '<span class="badge owner">Owner</span>' : g.bookingCount > 1 ? `<span class="badge repeat">Repeat (${g.bookingCount}x)</span>` : '<span class="badge first">First Timer</span>'
                            const hh = matchProperty(hotHomes, b.unit_code || b.property || '')
                            const isNotPremier = hh?.vrbo_premier_status === 'NOT_PREMIER'
                            const isGrace = hh?.vrbo_premier_status === 'PREMIER_GRACE_PERIOD'
                            const isNearPremier = (hh?.vrbo_premier_flags || '').toLowerCase().includes('near premier')
                            const isLowRating = hh?.vrbo_rating > 0 && hh?.vrbo_rating < 4.7
                            const hotParts: string[] = []
                            if (isNotPremier) hotParts.push('Not Premier')
                            if (isGrace) hotParts.push('Grace Period')
                            if (isNearPremier) hotParts.push('Near Premier')
                            if (isLowRating) hotParts.push('Low Rating')
                            const hotStatus = hotParts.length > 0 ? `🔥 ${hotParts.join(' · ')}` : '🔥 Hot Home'
                            const hotColor = (isNotPremier || isLowRating) ? '#FF3B30' : '#FF9500'
                            return `<tr>
                              <td>${i+1}</td>
                              <td><strong>${g.name}</strong></td>
                              <td>${g.email || '—'}</td>
                              <td>${b.unit_code || b.property || '—'}</td>
                              <td>${fmtDate(dashView === 'arrivals' ? b.check_in : b.check_out)}</td>
                              <td>${fmtDate(dashView === 'arrivals' ? b.check_out : b.check_in)}</td>
                              <td>${b.channel || '—'}</td>
                              <td>${badge}</td>
                              ${dashFilter === 'hothome' ? `<td style="color:${hotColor};font-weight:600;font-size:11px">${hotStatus}</td>` : ''}
                              ${isAdmin ? `<td><strong>$${(b.amount||0).toLocaleString()}</strong></td>` : ''}
                            </tr>`
                          }).join('')}
                          </tbody>
                        </table>
                        <div class="footer">VR 365 CRM &nbsp;•&nbsp; vacationrental365.com &nbsp;•&nbsp; ${printList.length} records</div>
                        </body></html>`
                        const w = window.open('', '_blank')
                        if (w) { w.document.write(html); w.document.close(); w.print() }
                      }} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        🖨️ Print
                      </button>
                    </div>
                  </div>
                )
              })()}
            </Card>

            {/* Guest list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                let list = dashView === 'arrivals' ? dashData.rangeArrivals : dashData.rangeDepartures
                if (dashFilter === 'arriving-today') list = dashData.todayArrivals
                if (dashFilter === 'departing-today') list = dashData.todayDepartures
                if (dashFilter === 'repeat') list = dashData.rangeArrivals.filter(g => g.bookingCount > 1)
                if (dashFilter === 'firsttime') list = dashData.rangeArrivals.filter(g => g.bookingCount === 1)
                if (dashFilter === 'hothome') list = dashData.rangeArrivals.filter(g => {
                  const ch = g.booking?.channel || ''
                  if (!['VRBO/Homeaway','Vrbo','VRBO','HomeAway','NextPax','Expedia'].some(v => ch.includes(v))) return false
                  const match = matchProperty(hotHomes, g.booking?.unit_code || g.booking?.property || '')
                  return match?.isHotHome === true
                })

                const totalRevenue = list.reduce((s, g) => s + (g.booking?.amount || 0), 0)
                const totalBookings = list.length
                const uniqueGuests = new Set(list.map(g => g.id)).size

                return (
                  <>
                    {list.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 60, color: C.label3, fontSize: 14 }}>
                        No {dashView} found for this date range.<br/>
                        <span style={{ fontSize: 12, color: C.label4 }}>Make sure your CSV includes future bookings.</span>
                      </div>
                    ) : list.map((g, i) => {
                const isRepeat = g.bookingCount > 1
                const ownerChannels = ['Owner', 'Owner Hold', 'Owner Referral']
                const ownerBookings = (g.bookings||[]).filter((b: any) => ownerChannels.includes(b.channel)).length
                const isOwner = ownerBookings > 0 && ownerBookings >= (g.bookings||[]).length * 0.5
                const guestLabel = isOwner
                  ? { text: `Owner — ${g.bookingCount} stays`, bg: C.orange+'18', color: C.orange }
                  : isRepeat
                  ? { text: `Repeat Guest — ${g.bookingCount} stays`, bg: C.green+'18', color: C.green }
                  : { text: 'First Timer', bg: C.blue+'18', color: C.blue }
                const b = g.booking
                const propName = (b.unit_code || b.property || '').toLowerCase()
                const hotHome = matchProperty(hotHomes, propName)
                const isHotHome = hotHome?.isHotHome && ['VRBO/Homeaway','Vrbo','VRBO','HomeAway','NextPax','Expedia'].some(v => (b.channel || '').includes(v))
                return (
                  <Card key={`${g.id}-${b.id}`} style={{ padding: '14px 16px', borderLeft: (isHotHome && !isOwner) ? `3px solid ${C.red}` : '3px solid transparent' }} onClick={() => { selectGuest(g); setActiveTab('guests') }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <Avatar name={g.name} size={44} index={i} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as any }}>
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{g.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, backgroundColor: guestLabel.bg, color: guestLabel.color }}>{guestLabel.text}</span>
                          {/* Hot Home badge — VRBO channel only */}
                          {['VRBO/Homeaway','Vrbo','VRBO','HomeAway','NextPax','Expedia'].some(v => (b.channel || '').includes(v)) && hotHome && hotHome.isHotHome && (() => {
                            const isNotPremier = hotHome.vrbo_premier_status === 'NOT_PREMIER'
                            const isGrace = hotHome.vrbo_premier_status === 'PREMIER_GRACE_PERIOD'
                            const isNearPremier = (hotHome.vrbo_premier_flags || '').toLowerCase().includes('near premier')
                            const isLowRating = hotHome.vrbo_rating > 0 && hotHome.vrbo_rating < 4.7
                            const parts: string[] = ['Hot Home']
                            if (isNotPremier) parts.push('Not Premier')
                            if (isGrace) parts.push('Grace Period')
                            if (isNearPremier) parts.push('Near Premier')
                            if (isLowRating) parts.push('Low Rating')
                            const color = (isNotPremier || isLowRating) ? C.red : C.orange
                            return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, backgroundColor: color+'18', color }}>🔥 {parts.join(' · ')}</span>
                          })()}
                          {/* Location — always show for every single booking */}
                          {(() => {
                            const match = matchProperty(hotHomes, b.unit_code || b.property || '')
                            const group = match?.location_group
                            return group ? <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, backgroundColor: C.teal+'18', color: C.teal }}>📍 {group}</span> : null
                          })()}
                        </div>
                        <div style={{ fontSize: 12, color: C.label3, marginBottom: 4 }}>{g.email}</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as any }}>
                          <span style={{ fontSize: 12, color: C.label3 }}>🏠 <b style={{ color: C.label }}>{b.unit_code || b.property}</b></span>
                          <span style={{ fontSize: 12, color: C.label3 }}>📅 Arrival: <b style={{ color: C.label }}>{fmtDate(b.check_in)}</b></span>
                          <span style={{ fontSize: 12, color: C.label3 }}>🏁 Departure: <b style={{ color: C.label }}>{fmtDate(b.check_out)}</b></span>
                          {b.channel && <span style={{ fontSize: 12, color: C.blue }}>{b.channel}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: C.green }}>{fmt$(b.amount)}</div>
                        <div style={{ fontSize: 10, color: C.label4 }}>this booking</div>
                        {isRepeat && <div style={{ fontSize: 11, color: C.label3, marginTop: 2 }}>{fmt$(g.totalSpent)} lifetime</div>}
                      </div>
                    </div>
                  </Card>
                )
                })}
                  </>
                )}
              )()}
            </div>
          </div>
        </div>

      ) : activeTab === 'winback' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px' }}>Win-Back List</div>
              <div style={{ fontSize: 13, color: C.label3, marginTop: 2 }}>Guests with no booking in 12+ months, sorted by lifetime value.</div>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              <StatCard label="Showing" value={filteredWinback.length} sub={`of ${winbackList.length} lapsed`} color={C.red} grad={C.statGrad[3]} />
              <StatCard label="High Priority" value={filteredWinback.filter(g => g.priority === 'High').length} color={C.orange} grad={C.statGrad[2]} />
              <StatCard label="Revenue at Risk" value={fmt$(filteredWinback.reduce((s, g) => s + g.totalSpent, 0))} color={C.green} grad={C.statGrad[1]} />
            </div>

            {/* Filters */}
            <div style={{ backgroundColor: C.bgCard, borderRadius: 13, padding: '14px 16px', marginBottom: 16, boxShadow: C.cardShadow }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.06em', marginBottom: 12 }}>Filters</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {/* Priority */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Priority</div>
                  <select value={wbPriority} onChange={e => setWbPriority(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">All Priorities</option>
                    <option value="High">High ($8k+)</option>
                    <option value="Medium">Medium ($3k-$8k)</option>
                    <option value="Low">Low (under $3k)</option>
                  </select>
                </div>
                {/* Months lapsed */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Months Since Last Stay</div>
                  <select value={wbMonths} onChange={e => setWbMonths(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">Any Time</option>
                    <option value="12-24">12–24 months</option>
                    <option value="24-36">24–36 months</option>
                    <option value="36+">36+ months</option>
                  </select>
                </div>
                {/* Channel */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Booking Channel</div>
                  <select value={wbChannel} onChange={e => setWbChannel(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">All Channels</option>
                    {allChannels.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Min value */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Min Lifetime Value ($)</div>
                  <input type="number" value={wbMinValue} onChange={e => setWbMinValue(e.target.value)} placeholder="e.g. 5000" style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none', boxSizing: 'border-box' as any }} />
                </div>
                {/* Max value */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Max Lifetime Value ($)</div>
                  <input type="number" value={wbMaxValue} onChange={e => setWbMaxValue(e.target.value)} placeholder="e.g. 50000" style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none', boxSizing: 'border-box' as any }} />
                </div>
                {/* Bookings range */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Number of Bookings ({wbMinBookings}–{wbMaxBookings})</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select value={wbMinBookings} onChange={e => setWbMinBookings(e.target.value)} style={{ flex: 1, padding: '7px 6px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                      {Array.from({length: 100}, (_,i) => i+1).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span style={{ fontSize: 11, color: C.label4 }}>to</span>
                    <select value={wbMaxBookings} onChange={e => setWbMaxBookings(e.target.value)} style={{ flex: 1, padding: '7px 6px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                      {Array.from({length: 100}, (_,i) => i+1).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {/* Clear filters */}
              {(wbPriority !== 'all' || wbMonths !== 'all' || wbChannel !== 'all' || wbMinValue || wbMaxValue || wbMinBookings !== '1' || wbMaxBookings !== '100') && (
                <button onClick={() => { setWbPriority('all'); setWbMonths('all'); setWbChannel('all'); setWbMinValue(''); setWbMaxValue(''); setWbMinBookings('1'); setWbMaxBookings('100') }}
                  style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.red}40`, backgroundColor: C.red + '10', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Clear Filters
                </button>
              )}
            </div>

            {/* Guest list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredWinback.slice(0, 200).map((g, i) => {
                const pc = g.priority === 'High' ? C.red : g.priority === 'Medium' ? C.orange : C.label3
                return (
                  <Card key={g.id} style={{ padding: 16 }} onClick={() => { selectGuest(g); setActiveTab('guests') }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <Avatar name={g.name} size={46} index={i} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{g.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, backgroundColor: pc + '18', color: pc }}>{g.priority} Priority</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.label3, marginBottom: 4 }}>{g.email}</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as any }}>
                          <span style={{ fontSize: 12, color: C.label3 }}>Last stay: <b style={{ color: C.label }}>{fmtDate(g.lastStay)}</b></span>
                          <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>{g.monthsGone} months ago</span>
                          <span style={{ fontSize: 12, color: C.label3 }}>{g.bookingCount} booking{g.bookingCount !== 1 ? 's' : ''}</span>
                          {(g.bookings||[]).slice(0,1).map((b: any) => b.channel).filter(Boolean).map((ch: string) => (
                            <span key={ch} style={{ fontSize: 12, color: C.blue }}>{ch}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{fmt$(g.totalSpent)}</div>
                        <div style={{ fontSize: 10, color: C.label4, marginTop: 2 }}>lifetime value</div>
                      </div>
                    </div>
                  </Card>
                )
              })}
              {filteredWinback.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: C.label3 }}>No guests match these filters</div>}
            </div>
          </div>
        </div>

      ) : activeTab === 'repeat' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left — list */}
          <div style={{ width: rpSelected ? 420 : '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)', transition: 'width 0.2s' }}>
            <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
              <div style={{ maxWidth: rpSelected ? '100%' : 900, margin: '0 auto' }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px' }}>Repeat Guests</div>
                  <div style={{ fontSize: 13, color: C.label3, marginTop: 2 }}>Guests who have booked more than once — your most loyal customers.</div>
                </div>

                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                  <StatCard label="Showing" value={repeatGuests_list.length} sub="repeat guests" color={C.blue} grad={C.statGrad[0]} />
                  <StatCard label="Total Revenue" value={fmt$(repeatGuests_list.reduce((s,g) => s+g.totalSpent,0))} color={C.green} grad={C.statGrad[1]} />
                  <StatCard label="Total Stays" value={repeatGuests_list.reduce((s,g) => s+g.bookingCount,0).toLocaleString()} color={C.orange} grad={C.statGrad[2]} />
                  <StatCard label="Avg per Guest" value={fmt$(repeatGuests_list.length ? repeatGuests_list.reduce((s,g) => s+g.totalSpent,0) / repeatGuests_list.length : 0)} color={C.purple} grad={C.statGrad[3]} />
                </div>

            {/* Filters */}
            <Card style={{ padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.06em', marginBottom: 12 }}>Filters</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                {/* Search */}
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.label3, fontSize: 13 }}>🔍</span>
                    <input value={rpSearch} onChange={e => setRpSearch(e.target.value)} placeholder="Search by name, email, booking #…"
                      style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 9, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 13, outline: 'none', boxSizing: 'border-box' as any }} />
                  </div>
                </div>
                {/* Min stays */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Min Bookings</div>
                  <select value={rpMinStays} onChange={e => setRpMinStays(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="2">2+ stays</option>
                    <option value="3">3+ stays</option>
                    <option value="5">5+ stays</option>
                    <option value="10">10+ stays</option>
                    <option value="20">20+ stays</option>
                  </select>
                </div>
                {/* Channel */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Channel</div>
                  <select value={rpChannel} onChange={e => setRpChannel(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">All Channels</option>
                    {ALL_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Property */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Property</div>
                  <select value={rpProperty} onChange={e => setRpProperty(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">All Properties</option>
                    {allProperties.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {/* Sort */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Sort By</div>
                  <select value={rpSort} onChange={e => setRpSort(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="spent">Lifetime Value</option>
                    <option value="stays">Most Stays</option>
                    <option value="recent">Most Recent</option>
                    <option value="avg">Avg Spend per Stay</option>
                    <option value="name">Name A-Z</option>
                  </select>
                </div>
                {/* Spend Tier */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Spend Tier</div>
                  <select value={rpTier} onChange={e => setRpTier(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">All Tiers</option>
                    <option value="platinum">Platinum ($10k+)</option>
                    <option value="gold">Gold ($5k–$10k)</option>
                    <option value="silver">Silver ($2k–$5k)</option>
                    <option value="bronze">Bronze (under $2k)</option>
                    <option value="superguest">Super Guest (10+ stays)</option>
                    <option value="vipguest">VIP Guest (5+ stays)</option>
                  </select>
                </div>
                {/* Tags */}
                <div>
                  <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>Tag</div>
                  <select value={rpTag} onChange={e => setRpTag(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">All Tags</option>
                    {['VIP','Hot Tub','Holiday','Repeat','Long Stay','Pet Friendly','Family'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {(rpSearch || rpChannel !== 'all' || rpProperty !== 'all' || rpMinStays !== '2' || rpTier !== 'all' || rpTag !== 'all') && (
                <button onClick={() => { setRpSearch(''); setRpChannel('all'); setRpProperty('all'); setRpMinStays('2'); setRpSort('spent'); setRpTier('all'); setRpTag('all') }}
                  style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.red}40`, backgroundColor: C.red+'10', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Clear Filters
                </button>
              )}
            </Card>

            {/* Guest list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {repeatGuests_list.slice(0, 200).map((g, i) => (
                <Card key={g.id} style={{ padding: 16, borderLeft: rpSelected?.id === g.id ? `3px solid ${C.blue}` : '3px solid transparent', backgroundColor: rpSelected?.id === g.id ? C.blue+'08' : C.bgCard }} onClick={() => setRpSelected(rpSelected?.id === g.id ? null : g)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Avatar name={g.name} size={46} index={i} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as any }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{g.name}</span>
                        <SpendBadge spent={g.totalSpent} />
                        {g.bookingCount >= 10 && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, backgroundColor: C.purple+'18', color: C.purple }}>Super Guest</span>}
                        {g.futureBookings?.length > 0 && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, backgroundColor: C.green+'18', color: C.green }}>📅 {g.futureBookings.length} upcoming</span>}
                      </div>
                      <div style={{ fontSize: 12, color: C.label3, marginBottom: 5 }}>{g.email}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,auto)', gap: '4px 20px', width: 'fit-content' }}>
                        <span style={{ fontSize: 11, color: C.label3 }}>🏠 Fav: <b style={{ color: C.label }}>{g.favProperty || '—'}</b></span>
                        <span style={{ fontSize: 11, color: C.label3 }}>📅 First: <b style={{ color: C.label }}>{fmtDate(g.firstBooking)}</b></span>
                        <span style={{ fontSize: 11, color: C.label3 }}>📊 Avg: <b style={{ color: C.green }}>{fmt$(g.avgSpend)}</b>/stay</span>
                        <span style={{ fontSize: 11, color: C.label3 }}>📡 <b style={{ color: C.blue }}>{(g.channels[0] || '—').replace('Repeat Customer', 'Repeat Guest')}</b></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{fmt$(g.totalSpent)}</div>
                      <div style={{ fontSize: 12, color: C.blue, fontWeight: 600, marginTop: 2 }}>{g.bookingCount} stays</div>
                      <div style={{ fontSize: 10, color: C.label4 }}>lifetime value</div>
                    </div>
                  </div>
                </Card>
              ))}
              {repeatGuests_list.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: C.label3 }}>No repeat guests match these filters</div>}
            </div>
          </div>
        </div>
        </div>

          {/* Right — guest detail panel */}
          {rpSelected && (
            <div style={{ flex: 1, overflowY: 'auto', borderLeft: `1px solid ${C.separator}`, background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)' }}>
              <div style={{ padding: 24, maxWidth: 660 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                  <Avatar name={rpSelected.name} size={60} index={repeatGuests_list.findIndex((x: any) => x.id === rpSelected.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' as any }}>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px' }}>{rpSelected.name}</h2>
                      <SpendBadge spent={rpSelected.totalSpent} />
                    </div>
                    <div style={{ color: C.label3, fontSize: 13 }}>{rpSelected.email}</div>
                    {rpSelected.aliases?.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap' as any, gap: 5 }}>
                        <span style={{ fontSize: 11, color: C.label4 }}>Also booked as:</span>
                        {rpSelected.aliases.map((a: string, i: number) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, backgroundColor: C.blue+'12', color: C.blue }}>{a}</span>)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setRpSelected(null)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: 'transparent', color: C.label3, cursor: 'pointer', fontSize: 13 }}>×</button>
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                  <StatCard label="Total Spent" value={fmt$(rpSelected.totalSpent)} color={C.green} grad={C.statGrad[1]} />
                  <StatCard label="Total Bookings" value={rpSelected.bookingCount} sub={rpSelected.bookingCount >= 10 ? 'Super Guest' : rpSelected.bookingCount >= 5 ? 'VIP Guest' : 'Repeat Guest'} color={rpSelected.bookingCount >= 10 ? C.purple : rpSelected.bookingCount >= 5 ? C.orange : C.green} grad={C.statGrad[0]} />
                  <StatCard label="Properties" value={rpSelected.properties?.length || 0} color={C.orange} grad={C.statGrad[2]} />
                </div>

                {/* AI Insights */}
                <AIInsights guest={rpSelected} todayStr={todayStr} onUpdate={(patch: any) => { updateGuest(rpSelected.id, patch); setRpSelected((prev: any) => ({ ...prev, ...patch })) }} hotHome={(() => {
                  const upcoming = (rpSelected.bookings||[]).find((b: any) => b.check_in && b.check_in.slice(0,10) >= todayStr)
                  if (!upcoming) return null
                  const propName = upcoming.unit_code || upcoming.property || ''
                  const m = matchProperty(hotHomes, propName)
                  return m?.isHotHome ? m : null
                })()} />

                {/* Tags */}
                <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.07em', padding: '18px 0 6px' }}>Tags</div>
                <Card style={{ padding: '12px 14px', marginBottom: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as any, gap: 6, marginBottom: 8 }}>
                    {(rpSelected.tags || []).map((t: string) => <Pill key={t} label={t} onRemove={() => { updateGuest(rpSelected.id, { tags: rpSelected.tags.filter((x: string) => x !== t) }); setRpSelected((prev: any) => ({ ...prev, tags: prev.tags.filter((x: string) => x !== t) })) }} />)}
                    {!rpSelected.tags?.length && <span style={{ fontSize: 12, color: C.label4 }}>No tags yet</span>}
                  </div>
                </Card>

                {/* Notes */}
                <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.07em', padding: '18px 0 6px' }}>Notes</div>
                <Card style={{ marginBottom: 1 }}>
                  <textarea value={rpSelected.notes || ''} onChange={e => { updateGuest(rpSelected.id, { notes: e.target.value }); setRpSelected((prev: any) => ({ ...prev, notes: e.target.value })) }} placeholder="Add notes about this guest…" rows={3}
                    style={{ width: '100%', border: 'none', padding: '12px 14px', color: C.label, fontSize: 13, outline: 'none', resize: 'vertical' as any, boxSizing: 'border-box' as any, fontFamily: 'inherit', lineHeight: 1.6, backgroundColor: 'transparent', borderRadius: 12 }} />
                </Card>

                {/* Upcoming Bookings */}
                {(() => {
                  const upcoming = (rpSelected.bookings || []).filter((b: any) => b.check_in && b.check_in.slice(0,10) > todayStr).sort((a: any, b: any) => a.check_in.localeCompare(b.check_in))
                  if (upcoming.length === 0) return null
                  return (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.green, textTransform: 'uppercase' as any, letterSpacing: '0.07em', padding: '18px 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        📅 Upcoming Bookings <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, backgroundColor: C.green+'18', color: C.green }}>{upcoming.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                        {upcoming.map((b: any, i: number) => (
                          <div key={i} style={{ backgroundColor: C.green+'08', borderRadius: 13, padding: '13px 14px', border: `1.5px solid ${C.green}30`, boxShadow: C.cardShadow }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{b.unit_code || b.property}</div>
                              <div style={{ fontSize: 17, fontWeight: 700, color: C.green }}>{fmt$(b.amount)}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 11 }}>
                              <div style={{ color: C.label3 }}>📅 Arrival: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.check_in)}</span></div>
                              <div style={{ color: C.label3 }}>🏁 Departure: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.check_out)}</span></div>
                              {b.channel && <div style={{ color: C.label3 }}>📡 <span style={{ color: C.blue, fontWeight: 500 }}>{b.channel}</span></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}

                {/* Booking History */}
                <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.07em', padding: '18px 0 6px' }}>Booking History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...(rpSelected.bookings || [])].sort((a: any, b: any) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime()).map((b: any, i: number) => (
                    <Card key={i} style={{ padding: '13px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{b.guest_name || rpSelected.name}</div>
                          {b.unit_code && <div style={{ fontSize: 11, color: C.label4 }}>Unit: {b.unit_code}</div>}
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: C.green }}>{fmt$(b.amount)}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 11 }}>
                        <div style={{ color: C.label3 }}>📅 Arrival: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.check_in)}</span></div>
                        <div style={{ color: C.label3 }}>🏁 Departure: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.check_out)}</span></div>
                        {b.date_booked && <div style={{ color: C.label3 }}>🗓 Booked: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.date_booked)}</span></div>}
                        {b.channel && <div style={{ color: C.label3 }}>📡 <span style={{ color: C.blue, fontWeight: 500 }}>{b.channel}</span></div>}
                        <div style={{ color: C.label3 }}>🔖 #{b.id}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      ) : activeTab === 'analytics' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Card style={{ gridColumn: '1/-1', padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Revenue Over Time</div>
              <div style={{ fontSize: 12, color: C.label3, marginBottom: 16 }}>Last 12 months</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats?.revenueByMonth || []}>
                  <XAxis dataKey="month" tick={{ fill: C.label3, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.label3, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${((v as number) / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: C.bgCard, border: `1px solid ${C.separator}`, borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [fmt$(v), 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke={C.blue} strokeWidth={2.5} dot={{ fill: C.blue, r: 3, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card style={{ gridColumn: '1/-1', padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Revenue by Property (Top 10)</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenueByProperty} layout="vertical">
                  <XAxis type="number" tick={{ fill: C.label3, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${((v as number) / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: C.label2, fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: C.bgCard, border: `1px solid ${C.separator}`, borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [fmt$(v), 'Revenue']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {revenueByProperty.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card style={{ gridColumn: '1/-1', padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Top Guests by Revenue</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...guests].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10).map((g, i) => {
                  const max = guests[0]?.totalSpent || 1
                  return (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => { selectGuest(g); setActiveTab('guests') }}>
                      <span style={{ fontSize: 12, color: C.label4, width: 20, textAlign: 'right', fontWeight: 600 }}>#{i + 1}</span>
                      <Avatar name={g.name} size={30} index={i} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{fmt$(g.totalSpent)}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, backgroundColor: C.bg, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(g.totalSpent / max) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 2 }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Property breakdown */}
            <Card style={{ gridColumn: '1/-1', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap' as any, gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>All Properties ({propertyStats.length})</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.label3 }}>🔍</span>
                    <input value={propSearch} onChange={e => setPropSearch(e.target.value)} placeholder="Search property…"
                      style={{ padding: '6px 10px 6px 26px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none', width: 160 }} />
                  </div>
                  <select value={propSort} onChange={e => setPropSort(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="revenue">By Revenue</option>
                    <option value="bookings">By Bookings</option>
                    <option value="guests">By Guests</option>
                    <option value="name">By Name</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 0 }}>
                {/* Header */}
                {['Property', 'Revenue', 'Bookings', 'Guests'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.06em', padding: '6px 10px', backgroundColor: C.bgInput, borderBottom: `1px solid ${C.separator}` }}>{h}</div>
                ))}
                {/* Rows */}
                {propertyStats.map((p, i) => (
                  <>
                    <div key={p.name+'-n'} style={{ fontSize: 13, fontWeight: 600, color: C.label, padding: '10px 10px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: i % 2 === 0 ? 'transparent' : C.bgInput + '80' }}>{p.name}</div>
                    <div key={p.name+'-r'} style={{ fontSize: 13, fontWeight: 700, color: C.green, padding: '10px 10px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: i % 2 === 0 ? 'transparent' : C.bgInput + '80' }}>{fmt$(p.revenue)}</div>
                    <div key={p.name+'-b'} style={{ fontSize: 13, color: C.label2, padding: '10px 10px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: i % 2 === 0 ? 'transparent' : C.bgInput + '80' }}>{p.bookings}</div>
                    <div key={p.name+'-g'} style={{ fontSize: 13, color: C.label2, padding: '10px 10px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: i % 2 === 0 ? 'transparent' : C.bgInput + '80' }}>{p.uniqueGuests}</div>
                  </>
                ))}
              </div>
            </Card>
          </div>
        </div>

      ) : activeTab === 'guests' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* SIDEBAR */}
          <div style={{ width: 320, borderRight: `1px solid ${C.separator}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(180deg,#F4F6FB,#EEF0F6)', boxShadow: '2px 0 8px rgba(0,0,30,0.05)' }}>
            <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.separator}` }}>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.label3, fontSize: 13 }}>🔍</span>
                <input value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(50) }} placeholder="Search name, email, booking #…"
                  style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 10, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 13, outline: 'none', boxSizing: 'border-box' as any }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {[['spent', '$ Spent'], ['bookings', 'Stays'], ['recent', 'Recent'], ['name', 'Name']].map(([val, label]) => (
                  <button key={val} onClick={() => setSortBy(val)} style={{ flex: 1, padding: '5px 2px', borderRadius: 7, border: `1px solid ${sortBy === val ? C.blue : C.separator}`, cursor: 'pointer', fontSize: 10, fontWeight: 600, backgroundColor: sortBy === val ? C.blue + '14' : 'transparent', color: sortBy === val ? C.blue : C.label3 }}>{label}</button>
                ))}
              </div>
              <button onClick={() => setShowFilters(!showFilters)} style={{ width: '100%', padding: 7, borderRadius: 9, border: `1px solid ${[filterChannel!=='all',filterTier!=='all',filterTag!=='all'].filter(Boolean).length > 0 ? C.blue : C.separator}`, cursor: 'pointer', fontSize: 11, fontWeight: 600, backgroundColor: [filterChannel!=='all',filterTier!=='all',filterTag!=='all'].filter(Boolean).length > 0 ? C.blue+'10' : 'transparent', color: [filterChannel!=='all',filterTier!=='all',filterTag!=='all'].filter(Boolean).length > 0 ? C.blue : C.label3 }}>
                ⚙ Filters {[filterChannel!=='all',filterTier!=='all',filterTag!=='all'].filter(Boolean).length > 0 ? `(${[filterChannel!=='all',filterTier!=='all',filterTag!=='all'].filter(Boolean).length} active)` : ''}
              </button>
              {showFilters && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={{ padding: '7px 10px', borderRadius: 9, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">All Channels</option>
                    {ALL_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={filterTier} onChange={e => setFilterTier(e.target.value)} style={{ padding: '7px 10px', borderRadius: 9, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">All Spend Tiers</option>
                    <option value="platinum">Platinum ($10k+)</option>
                    <option value="gold">Gold ($5k–$10k)</option>
                    <option value="silver">Silver ($2k–$5k)</option>
                    <option value="bronze">Bronze (under $2k)</option>
                    <option value="superguest">Super Guest (10+ stays)</option>
                    <option value="vipguest">VIP Guest (5+ stays)</option>
                    <option value="repeat">Repeat Guest (2+ stays)</option>
                    <option value="firsttime">First Timers (1 stay)</option>
                  </select>
                  <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ padding: '7px 10px', borderRadius: 9, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                    <option value="all">All Tags</option>
                    {['VIP','Hot Tub','Holiday','Repeat','Long Stay','Pet Friendly','Family'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {[filterChannel!=='all',filterTier!=='all',filterTag!=='all'].some(Boolean) && (
                    <button onClick={() => { setFilterChannel('all'); setFilterTier('all'); setFilterTag('all') }} style={{ padding: '6px', borderRadius: 9, border: `1px solid ${C.red}40`, cursor: 'pointer', fontSize: 11, fontWeight: 600, backgroundColor: C.red+'10', color: C.red }}>Clear All Filters</button>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '6px 12px 2px', fontSize: 11, color: C.label3 }}>
              {loading ? 'Loading...' : `${filtered.length.toLocaleString()} guests`}
              {!loading && guests.length < 16000 && <span style={{ color: C.orange }}> (loading more...)</span>}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }} onScroll={e => {
              const el = e.currentTarget
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
                setVisibleCount(v => Math.min(v + 50, filtered.length))
              }
            }}>
              {filtered.slice(0, visibleCount).map((g, i) => (
                <div key={g.id} onClick={() => selectGuest(g)}
                  style={{ padding: '10px 12px', borderBottom: `1px solid ${C.separator}40`, cursor: 'pointer', backgroundColor: selected?.id === g.id ? C.blue + '12' : 'transparent', borderLeft: `3px solid ${selected?.id === g.id ? C.blue : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s' }}
                  onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <Avatar name={g.name} size={36} index={i} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{g.name}</span>
                      <SpendBadge spent={g.totalSpent} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: C.label3 }}>
                        {g.bookingCount} stay{g.bookingCount !== 1 ? 's' : ''}
                        {g.bookingCount >= 2 && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 10, backgroundColor: C.green + '18', color: C.green }}>Repeat</span>}
                        {g.bookingCount >= 5 && <span style={{ marginLeft: 3, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 10, backgroundColor: C.orange + '18', color: C.orange }}>VIP</span>}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{fmt$(g.totalSpent)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {visibleCount < filtered.length && (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: C.label4 }}>
                  Scroll for more ({filtered.length - visibleCount} remaining)
                </div>
              )}
            </div>
          </div>

          {/* DETAIL */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)' }}>
            {!selected ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
                <div style={{ fontSize: 48 }}>👤</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.label3 }}>Select a guest</div>
                <div style={{ fontSize: 13, color: C.label4 }}>Or import your Escapia CSV to get started</div>
              </div>
            ) : profileLoading ? (
              <GuestProfileSkeleton />
            ) : (
              <div style={{ padding: 24, maxWidth: 660 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                  <Avatar name={selected.name} size={60} index={filtered.indexOf(selected)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' as any }}>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px' }}>{selected.name}</h2>
                      <SpendBadge spent={selected.totalSpent} />
                    </div>
                    <div style={{ color: C.label3, fontSize: 13 }}>{selected.email}</div>
                    {selected.aliases?.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap' as any, gap: 5, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: C.label4 }}>Also booked as:</span>
                        {selected.aliases.map((a: string, i: number) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, backgroundColor: C.blue + '12', color: C.blue }}>{a}</span>)}
                      </div>
                    )}
                  </div>
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                  <StatCard label="Total Spent" value={fmt$(selected.totalSpent)} color={C.green} grad={C.statGrad[1]} />
                  <StatCard label="Total Bookings" value={selected.bookingCount} sub={selected.bookingCount >= 5 ? 'VIP Guest' : selected.bookingCount >= 2 ? 'Repeat Guest' : 'First-timer'} color={selected.bookingCount >= 5 ? C.orange : selected.bookingCount >= 2 ? C.green : C.blue} grad={C.statGrad[0]} />
                  <StatCard label="Properties" value={selected.properties?.length || 0} color={C.orange} grad={C.statGrad[2]} />
                </div>

                {/* AI Insights */}
                <AIInsights guest={selected} todayStr={todayStr} onUpdate={(patch: any) => updateGuest(selected.id, patch)} hotHome={(() => {
                  const upcoming = (selected.bookings||[]).find((b: any) => b.check_in && b.check_in.slice(0,10) >= todayStr)
                  if (!upcoming) return null
                  const propName = upcoming.unit_code || upcoming.property || ''
                  const m = matchProperty(hotHomes, propName)
                  return m?.isHotHome ? m : null
                })()} />

                {/* Tags */}
                <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.07em', padding: '18px 0 6px' }}>Tags</div>
                <Card style={{ padding: '12px 14px', marginBottom: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as any, gap: 6, marginBottom: 8 }}>
                    {(selected.tags || []).map((t: string) => <Pill key={t} label={t} onRemove={() => updateGuest(selected.id, { tags: selected.tags.filter((x: string) => x !== t) })} />)}
                    {!selected.tags?.length && <span style={{ fontSize: 12, color: C.label4 }}>No tags yet</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as any }}>
                    {['VIP', 'Hot Tub', 'Holiday', 'Repeat', 'Long Stay', 'Pet Friendly', 'Family'].filter(t => !(selected.tags || []).includes(t)).map(t => (
                      <button key={t} onClick={() => updateGuest(selected.id, { tags: [...(selected.tags || []), t] })} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: `1px dashed ${C.separator}`, backgroundColor: 'transparent', color: C.label3, cursor: 'pointer' }}>+ {t}</button>
                    ))}
                    <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { updateGuest(selected.id, { tags: [...(selected.tags || []), newTag.trim()] }); setNewTag('') } }} placeholder="Custom…" style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: `1px dashed ${C.separator}`, backgroundColor: 'transparent', color: C.label, outline: 'none', width: 80 }} />
                  </div>
                </Card>

                {/* Notes */}
                <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.07em', padding: '18px 0 6px' }}>Notes</div>
                <Card style={{ marginBottom: 1 }}>
                  <textarea value={selected.notes || ''} onChange={e => updateGuest(selected.id, { notes: e.target.value })} placeholder="Add notes about this guest…" rows={3}
                    style={{ width: '100%', border: 'none', padding: '12px 14px', color: C.label, fontSize: 13, outline: 'none', resize: 'vertical' as any, boxSizing: 'border-box' as any, fontFamily: 'inherit', lineHeight: 1.6, backgroundColor: 'transparent', borderRadius: 12 }} />
                </Card>

                {/* Upcoming Bookings */}
                {(() => {
                  const upcoming = (selected.bookings || []).filter((b: any) => b.check_in && b.check_in.slice(0,10) > todayStr).sort((a: any, b: any) => a.check_in.localeCompare(b.check_in))
                  if (upcoming.length === 0) return null
                  return (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.green, textTransform: 'uppercase' as any, letterSpacing: '0.07em', padding: '18px 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        📅 Upcoming Bookings <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, backgroundColor: C.green+'18', color: C.green }}>{upcoming.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                        {upcoming.map((b: any, i: number) => (
                          <div key={i} style={{ backgroundColor: C.green+'08', borderRadius: 13, padding: '13px 14px', border: `1.5px solid ${C.green}30`, boxShadow: C.cardShadow }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{b.guest_name || selected.name}</div>
                                {b.unit_code && <div style={{ fontSize: 11, color: C.label4 }}>Unit: {b.unit_code}</div>}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{fmt$(b.amount)}</div>
                                <div style={{ fontSize: 10, color: C.green, fontWeight: 600, marginTop: 2 }}>● Upcoming</div>
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                              <div style={{ fontSize: 11, color: C.label3 }}>📅 Arrival: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.check_in)}</span></div>
                              <div style={{ fontSize: 11, color: C.label3 }}>🏁 Departure: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.check_out)}</span></div>
                              {b.date_booked && <div style={{ fontSize: 11, color: C.label3 }}>🗓 Booked: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.date_booked)}</span></div>}
                              {b.channel && <div style={{ fontSize: 11, color: C.label3 }}>📡 Channel: <span style={{ color: C.blue, fontWeight: 500 }}>{b.channel}</span></div>}
                              <div style={{ fontSize: 11, color: C.label3 }}>🔖 Booking #: <span style={{ color: C.label, fontWeight: 500 }}>{b.id}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}

                {/* Booking History */}
                <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.07em', padding: '18px 0 6px' }}>Booking History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...(selected.bookings || [])].sort((a: any, b: any) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime()).map((b: any, i: number) => (
                    <Card key={i} style={{ padding: '13px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{b.guest_name || selected.name}</div>
                          {b.unit_code && <div style={{ fontSize: 11, color: C.label4 }}>Unit: {b.unit_code}</div>}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{fmt$(b.amount)}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                        <div style={{ fontSize: 11, color: C.label3 }}>📅 Arrival: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.check_in)}</span></div>
                        <div style={{ fontSize: 11, color: C.label3 }}>🏁 Departure: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.check_out)}</span></div>
                        {b.date_booked && <div style={{ fontSize: 11, color: C.label3 }}>🗓 Booked: <span style={{ color: C.label, fontWeight: 500 }}>{fmtDate(b.date_booked)}</span></div>}
                        {b.channel && <div style={{ fontSize: 11, color: C.label3 }}>📡 Channel: <span style={{ color: C.blue, fontWeight: 500 }}>{b.channel}</span></div>}
                        <div style={{ fontSize: 11, color: C.label3 }}>🔖 Booking #: <span style={{ color: C.label, fontWeight: 500 }}>{b.id}</span></div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'leads' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left — leads list */}
          <div style={{ width: selectedLead ? 420 : '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)', transition: 'width 0.2s' }}>
            <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
              <div style={{ maxWidth: selectedLead ? '100%' : 900, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px' }}>Leads</div>
                    <div style={{ fontSize: 13, color: C.label3, marginTop: 2 }}>Guests who inquired but haven't booked yet.</div>
                  </div>
                  <button onClick={() => setShowAddLead(true)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${C.blue},${C.indigo})`, color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 2px 8px rgba(0,122,255,0.3)' }}>
                    + Add Lead
                  </button>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'New', value: leads.filter(l => l.status === 'new').length, color: C.blue, grad: C.statGrad[0] },
                    { label: 'Contacted', value: leads.filter(l => l.status === 'contacted').length, color: C.orange, grad: C.statGrad[2] },
                    { label: 'Follow-up', value: leads.filter(l => l.status === 'followup').length, color: C.purple, grad: C.statGrad[3] },
                    { label: 'Converted', value: leads.filter(l => l.status === 'converted').length, color: C.green, grad: C.statGrad[1] },
                  ].map(s => <StatCard key={s.label} label={s.label} value={s.value} color={s.color} grad={s.grad} />)}
                </div>

                {/* Search + Filter */}
                <Card style={{ padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as any }}>
                    <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.label3 }}>🔍</span>
                      <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Search by name, email, property…"
                        style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none', boxSizing: 'border-box' as any }} />
                    </div>
                    {['all','new','contacted','followup','converted','lost'].map(s => (
                      <button key={s} onClick={() => setLeadFilter(s)}
                        style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, backgroundColor: leadFilter === s ? C.blue : C.bgInput, color: leadFilter === s ? '#fff' : C.label3, textTransform: 'capitalize' as any }}>
                        {s === 'all' ? 'All' : s === 'followup' ? 'Follow-up' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Add Lead Form */}
                {showAddLead && (
                  <Card style={{ padding: 16, marginBottom: 14, border: `2px solid ${C.blue}30` }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.blue }}>New Lead</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      {[
                        { label: 'Name *', key: 'name', placeholder: 'Guest name' },
                        { label: 'Email', key: 'email', placeholder: 'email@example.com' },
                        { label: 'Phone', key: 'phone', placeholder: '+1 206...' },
                        { label: 'Property Interested In', key: 'property', placeholder: 'e.g. Dreamin Lodge' },
                      ].map(f => (
                        <div key={f.key}>
                          <div style={{ fontSize: 11, color: C.label3, marginBottom: 4 }}>{f.label}</div>
                          <input value={(newLead as any)[f.key]} onChange={e => setNewLead(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none', boxSizing: 'border-box' as any }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: C.label3, marginBottom: 4 }}>Channel</div>
                      <select value={newLead.channel} onChange={e => setNewLead(prev => ({ ...prev, channel: e.target.value }))} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                        <option value="">Select channel</option>
                        {ALL_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: C.label3, marginBottom: 4 }}>Notes</div>
                      <textarea value={newLead.notes} onChange={e => setNewLead(prev => ({ ...prev, notes: e.target.value }))} placeholder="What are they looking for?" rows={2}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none', resize: 'vertical' as any, boxSizing: 'border-box' as any, fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={addLead} disabled={!newLead.name} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: C.blue, color: '#fff', fontSize: 13, fontWeight: 600, opacity: !newLead.name ? 0.6 : 1 }}>Save Lead</button>
                      <button onClick={() => setShowAddLead(false)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.separator}`, cursor: 'pointer', backgroundColor: 'transparent', color: C.label3, fontSize: 13 }}>Cancel</button>
                    </div>
                  </Card>
                )}

                {/* Lead cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {leads
                    .filter(l => leadFilter === 'all' || l.status === leadFilter)
                    .filter(l => !leadSearch || l.name?.toLowerCase().includes(leadSearch.toLowerCase()) || l.email?.toLowerCase().includes(leadSearch.toLowerCase()) || l.property?.toLowerCase().includes(leadSearch.toLowerCase()))
                    .map((l, i) => {
                      const statusColors: any = { new: C.blue, contacted: C.orange, followup: C.purple, converted: C.green, lost: C.label3 }
                      const sc = statusColors[l.status] || C.label3
                      return (
                        <Card key={l.id} style={{ padding: 14, borderLeft: selectedLead?.id === l.id ? `3px solid ${C.blue}` : '3px solid transparent', backgroundColor: selectedLead?.id === l.id ? C.blue+'08' : C.bgCard }}
                          onClick={() => setSelectedLead(selectedLead?.id === l.id ? null : l)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Avatar name={l.name || '?'} size={42} index={i} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as any }}>
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{l.name}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, backgroundColor: sc+'18', color: sc, textTransform: 'capitalize' as any }}>{l.status === 'followup' ? 'Follow-up' : l.status}</span>
                              </div>
                              <div style={{ fontSize: 12, color: C.label3 }}>{l.email}</div>
                              <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' as any }}>
                                {l.property && <span style={{ fontSize: 11, color: C.label3 }}>🏠 {l.property}</span>}
                                {l.channel && <span style={{ fontSize: 11, color: C.blue }}>{l.channel}</span>}
                                {l.phone && <span style={{ fontSize: 11, color: C.label3 }}>📞 {l.phone}</span>}
                                <span style={{ fontSize: 11, color: C.label4 }}>{new Date(l.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  {leads.filter(l => leadFilter === 'all' || l.status === leadFilter).length === 0 && (
                    <div style={{ textAlign: 'center', padding: 60, color: C.label3 }}>
                      No leads yet. Click "Add Lead" to create one!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right — lead detail */}
          {selectedLead && (
            <div style={{ flex: 1, overflowY: 'auto', borderLeft: `1px solid ${C.separator}`, background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)' }}>
              <div style={{ padding: 24, maxWidth: 600 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                  <Avatar name={selectedLead.name || '?'} size={56} index={0} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 2 }}>{selectedLead.name}</div>
                    <div style={{ fontSize: 13, color: C.label3 }}>{selectedLead.email}</div>
                    {selectedLead.phone && <div style={{ fontSize: 13, color: C.label3 }}>{selectedLead.phone}</div>}
                  </div>
                  <button onClick={() => setSelectedLead(null)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: 'transparent', color: C.label3, cursor: 'pointer', fontSize: 13 }}>×</button>
                </div>

                {/* Status */}
                <Card style={{ padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, marginBottom: 10, textTransform: 'uppercase' as any, letterSpacing: '0.06em' }}>Status</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as any }}>
                    {[
                      { id: 'new', label: 'New', color: C.blue },
                      { id: 'contacted', label: 'Contacted', color: C.orange },
                      { id: 'followup', label: 'Follow-up', color: C.purple },
                      { id: 'converted', label: 'Converted ✓', color: C.green },
                      { id: 'lost', label: 'Lost', color: C.label3 },
                    ].map(s => (
                      <button key={s.id} onClick={() => updateLead(selectedLead.id, { status: s.id })}
                        style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${selectedLead.status === s.id ? s.color : s.color+'40'}`, cursor: 'pointer', fontSize: 12, fontWeight: 600, backgroundColor: selectedLead.status === s.id ? s.color : 'transparent', color: selectedLead.status === s.id ? '#fff' : s.color, transition: 'all 0.15s' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Details */}
                <Card style={{ padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, marginBottom: 12, textTransform: 'uppercase' as any, letterSpacing: '0.06em' }}>Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Property', key: 'property', placeholder: 'Property interested in' },
                      { label: 'Channel', key: 'channel', placeholder: 'Where they came from' },
                    ].map(f => (
                      <div key={f.key}>
                        <div style={{ fontSize: 11, color: C.label4, marginBottom: 4 }}>{f.label}</div>
                        <input value={selectedLead[f.key] || ''} onChange={e => updateLead(selectedLead.id, { [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none', boxSizing: 'border-box' as any }} />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Notes */}
                <div style={{ fontSize: 12, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.07em', padding: '4px 0 6px' }}>Notes</div>
                <Card style={{ marginBottom: 14 }}>
                  <textarea value={selectedLead.notes || ''} onChange={e => updateLead(selectedLead.id, { notes: e.target.value })}
                    placeholder="Add notes about this lead…" rows={4}
                    style={{ width: '100%', border: 'none', padding: '12px 14px', color: C.label, fontSize: 13, outline: 'none', resize: 'vertical' as any, boxSizing: 'border-box' as any, fontFamily: 'inherit', lineHeight: 1.6, backgroundColor: 'transparent', borderRadius: 12 }} />
                </Card>

                {/* AI Follow-up */}
                <LeadAI lead={selectedLead} />

                {/* Danger zone */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.separator}` }}>
                  <button onClick={() => deleteLead(selectedLead.id)} style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${C.red}30`, backgroundColor: C.red+'10', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    🗑 Delete Lead
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'hothomes' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' as any, gap: 10 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px' }}>🔥 Hot Homes Tracker</div>
                  <div style={{ fontSize: 13, color: C.label3, marginTop: 2 }}>Track reviews per property. Target: 4.7+ rating.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {vrboImportMsg && <span style={{ fontSize: 11, color: vrboImportMsg.startsWith('✅') ? C.green : C.red, fontWeight: 600, maxWidth: 300 }}>{vrboImportMsg}</span>}
                  <label style={{ cursor: vrboImporting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: C.blue, padding: '7px 14px', borderRadius: 8, backgroundColor: C.blue+'14', border: `1px solid ${C.blue}30`, opacity: vrboImporting ? 0.6 : 1, whiteSpace: 'nowrap' as any }}>
                    {vrboImporting ? '⏳ Importing...' : '📥 Import VRBO CSV'}
                    <input type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} ref={vrboFileRef} onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setVrboImporting(true)
                      setVrboImportMsg('')
                      try {
                        const fd = new FormData()
                        fd.append('file', file)
                        const res = await fetch('/api/import-vrbo', { method: 'POST', body: fd })
                        const data = await res.json()
                        setVrboImportMsg(data.success ? data.message : `❌ ${data.error}`)
                        if (data.success) loadHotHomes()
                      } catch(err: any) {
                        setVrboImportMsg(`❌ ${err.message}`)
                      }
                      setVrboImporting(false)
                      if (vrboFileRef.current) vrboFileRef.current.value = ''
                      setTimeout(() => setVrboImportMsg(''), 10000)
                    }} />
                  </label>
                </div>
              </div>
            </div>

            {/* Summary cards — sticky + clickable */}
            <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'linear-gradient(160deg,#EDF0F7,#E4E8F0)', paddingBottom: 12, marginBottom: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[
                  { label: '🔴 Urgent', value: hotHomes.filter(h => h.vrbo_premier_status === 'NOT_PREMIER' || (h.vrbo_rating > 0 && h.vrbo_rating < 4.7)).length, color: C.red, grad: C.statGrad[3], filter: 'urgent' },                  { label: '🔥 Hot Homes', value: hotHomes.filter(h => h.isHotHome).length, color: C.orange, grad: C.statGrad[2], filter: 'hot' },
                  { label: '🟢 On Target', value: hotHomes.filter(h => !h.isHotHome).length, color: C.green, grad: C.statGrad[1], filter: 'meeting' },
                  { label: '📊 Total Properties', value: hotHomes.length, color: C.blue, grad: C.statGrad[0], filter: 'all' },
                ].map(s => (
                  <div key={s.label} onClick={() => setHotHomesStatus(hotHomesStatus === s.filter ? 'all' : s.filter)}
                    style={{ background: s.grad, borderRadius: 13, padding: '14px 16px', borderTop: `3px solid ${s.color}`, boxShadow: hotHomesStatus === s.filter ? `0 0 0 3px ${s.color}` : C.cardShadow, cursor: 'pointer', transform: hotHomesStatus === s.filter ? 'scale(0.97)' : 'scale(1)', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 11, color: C.label3, fontWeight: 500, marginBottom: 5 }}>{s.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color, letterSpacing: '-0.4px' }}>{s.value}</div>
                    {hotHomesStatus === s.filter && <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 4 }}>● Filtering</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Filters */}
            <Card style={{ padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as any }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.label3 }}>🔍</span>
                  <input value={hotHomesSearch} onChange={e => setHotHomesSearch(e.target.value)} placeholder="Search property..."
                    style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none', boxSizing: 'border-box' as any }} />
                </div>
                <select value={hotHomesGroup} onChange={e => setHotHomesGroup(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                  <option value="all">All Groups</option>
                  {[...new Set(hotHomes.map(h => h.location_group).filter(Boolean))].sort().map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={hotHomesStatus} onChange={e => setHotHomesStatus(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }}>
                  <option value="all">All Status</option>
                  <option value="hot">🔥 Hot Homes Only</option>
                  <option value="urgent">🔴 Urgent (below 4.5)</option>
                  <option value="meeting">🟢 Meeting Target</option>
                </select>
              </div>
            </Card>

            {/* Property table */}
            <Card style={{ overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.5fr 80px', gap: 0 }}>
                {['Property', 'Group', 'VRBO Reviews', 'VRBO Upcoming', 'VRBO Rating', 'Status', ''].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 600, color: C.label3, textTransform: 'uppercase' as any, letterSpacing: '0.06em', padding: '10px 12px', backgroundColor: C.bgInput, borderBottom: `1px solid ${C.separator}`, position: 'sticky' as any, top: 0, zIndex: 10 }}>{h}</div>
                ))}
                {hotHomes
                  .filter(h => !hotHomesSearch || h.property_name?.toLowerCase().includes(hotHomesSearch.toLowerCase()))
                  .filter(h => hotHomesGroup === 'all' || h.location_group === hotHomesGroup)
                  .filter(h => {
                    if (hotHomesStatus === 'hot') return h.isHotHome
                    if (hotHomesStatus === 'urgent') return h.vrbo_premier_status === 'NOT_PREMIER' || (h.vrbo_rating > 0 && h.vrbo_rating < 4.7)
                    if (hotHomesStatus === 'meeting') return !h.isHotHome && h.vrbo_reviews > 0
                    return true
                  })
                  .map((h, i) => {
                    const isUrgent = h.vrbo_rating > 0 && h.vrbo_rating < 4.7
                    const isNotPremier = h.vrbo_premier_status === 'NOT_PREMIER'
                    const isGrace = h.vrbo_premier_status === 'PREMIER_GRACE_PERIOD'
                    const isNearPremier = (h.vrbo_premier_flags || '').toLowerCase().includes('near premier')
                    const isLowRating = isUrgent
                    const statusColor = (isNotPremier || isLowRating) ? C.red : (isNearPremier || isGrace) ? C.orange : h.isHotHome ? C.orange : C.green
                    const statusLabel = isNotPremier ? '🔴 Not Premier'
                      : isLowRating ? '🔴 Low Rating'
                      : isNearPremier ? '⚠️ Near Premier'
                      : isGrace ? '🔥 Grace Period'
                      : h.isHotHome ? '🔥 Hot Home'
                      : '🟢 On Target'
                    const bg = i % 2 === 0 ? 'transparent' : C.bgInput + '60'
                    const editing = editingHome?.id === h.id

                    // Calculate upcoming VRBO bookings only
                    const todayStr2 = new Date().toISOString().slice(0,10)
                    const vrboChannels = ['VRBO/Homeaway','Vrbo','VRBO','HomeAway','NextPax','Expedia']
                    let upcomingVrbo = 0
                    guests.forEach((g: any) => {
                      ;(g.bookings||[]).forEach((b: any) => {
                        const propName = b.unit_code || b.property || ''
                        const matched = matchProperty([h], propName)
                        if (!matched) return
                        if (!b.check_in || b.check_in.slice(0,10) < todayStr2) return
                        if (vrboChannels.some((c: string) => b.channel?.includes(c))) upcomingVrbo++
                      })
                    })
                    return editing ? (
                      <>
                        <div key={h.id+'-name-e'} style={{ padding: '10px 12px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: C.blue+'08', gridColumn: '1/-1', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as any }}>
                          <span style={{ fontSize: 13, fontWeight: 600, flex: '0 0 180px' }}>{h.property_name}</span>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as any, flex: 1 }}>
                            {[
                              { label: 'VRBO Reviews', key: 'vrbo_reviews', type: 'number' },
                              { label: 'VRBO Rating', key: 'vrbo_rating', type: 'number', step: '0.1', max: '5' },
                            ].map(f => (
                              <div key={f.key}>
                                <div style={{ fontSize: 10, color: C.label4, marginBottom: 2 }}>{f.label}</div>
                                <input type={f.type} step={(f as any).step} max={(f as any).max} value={(editingHome as any)[f.key] || ''} onChange={e => setEditingHome((prev: any) => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))}
                                  style={{ width: 80, padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.blue}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }} />
                              </div>
                            ))}
                            <div>
                              <div style={{ fontSize: 10, color: C.label4, marginBottom: 2 }}>Notes</div>
                              <input value={editingHome.notes || ''} onChange={e => setEditingHome((prev: any) => ({ ...prev, notes: e.target.value }))} placeholder="Optional notes"
                                style={{ width: 160, padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={async () => { await updateHotHome(h.id, { vrbo_reviews: editingHome.vrbo_reviews, vrbo_rating: editingHome.vrbo_rating, notes: editingHome.notes }); setEditingHome(null) }}
                              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', backgroundColor: C.blue, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditingHome(null)} style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.separator}`, backgroundColor: 'transparent', color: C.label3, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div key={h.id+'-n'} style={{ fontSize: 13, fontWeight: 600, padding: '10px 12px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: bg, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {h.property_name}
                          {h.notes && <span title={h.notes} style={{ fontSize: 10, color: C.label4, cursor: 'help' }}>📝</span>}
                        </div>
                        <div key={h.id+'-g'} style={{ fontSize: 11, color: C.label3, padding: '10px 12px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: bg }}>{h.location_group || '—'}</div>
                        <div key={h.id+'-vr'} style={{ padding: '10px 12px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: bg }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.label }}>{h.vrbo_reviews || 0}</div>
                        </div>
                        <div key={h.id+'-vup'} style={{ padding: '10px 12px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: bg }}>
                          {upcomingVrbo > 0
                            ? <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>{upcomingVrbo}<div style={{ fontSize: 10, color: C.label4, fontWeight: 400 }}>upcoming</div></div>
                            : <div style={{ fontSize: 11, color: C.label4 }}>—</div>}
                        </div>
                        <div key={h.id+'-vrr'} style={{ fontSize: 13, fontWeight: 600, padding: '10px 12px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: bg, color: (h.vrbo_rating||0) >= 4.7 ? C.green : (h.vrbo_rating||0) > 0 && (h.vrbo_rating||0) < 4.7 ? C.red : C.label3 }}>
                          {h.vrbo_rating ? h.vrbo_rating.toFixed(1) : '—'} {h.vrbo_rating ? '⭐' : ''}
                        </div>
                        <div key={h.id+'-s'} style={{ padding: '10px 12px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: bg }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, backgroundColor: statusColor+'18', color: statusColor }}>{statusLabel}</span>
                          {h.last_updated && <div style={{ fontSize: 10, color: C.label4, marginTop: 3 }}>Updated {new Date(h.last_updated).toLocaleDateString()}</div>}
                        </div>
                        <div key={h.id+'-e'} style={{ padding: '10px 12px', borderBottom: `1px solid ${C.separator}40`, backgroundColor: bg }}>
                          <button onClick={() => setEditingHome({ ...h })} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.blue}30`, backgroundColor: C.blue+'12', color: C.blue, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                        </div>
                      </>
                    )
                  })}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
      </div>  
    </div>
  )
}

