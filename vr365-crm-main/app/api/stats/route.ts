import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const [guestsRes, bookingsRes] = await Promise.all([
    supabase.from('guests').select('id', { count: 'exact', head: true }),
    supabase.from('bookings').select('amount, check_in, guest_id')
  ])

  const bookings = bookingsRes.data || []
  const totalRevenue = bookings.reduce((s, b) => s + (b.amount || 0), 0)
  const totalBookings = bookings.length

  // Repeat guests = guest_ids that appear more than once
  const guestCounts: Record<string, number> = {}
  bookings.forEach(b => { guestCounts[b.guest_id] = (guestCounts[b.guest_id] || 0) + 1 })
  const repeatGuests = Object.values(guestCounts).filter(c => c > 1).length

  // Revenue by month (last 12)
  const monthMap: Record<string, number> = {}
  bookings.forEach(b => {
    if (!b.check_in) return
    const key = b.check_in.slice(0, 7)
    monthMap[key] = (monthMap[key] || 0) + (b.amount || 0)
  })
  const revenueByMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([k, v]) => ({ month: k, revenue: v }))

  return NextResponse.json({
    totalGuests: guestsRes.count || 0,
    totalRevenue,
    totalBookings,
    repeatGuests,
    revenueByMonth
  })
}
