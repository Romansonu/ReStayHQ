import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const sortBy = searchParams.get('sort') || 'spent'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 50
  const offset = (page - 1) * limit

  try {
    // Get guests with booking aggregates
    let query = supabase
      .from('guests')
      .select(`
        *,
        bookings (
          id, property, unit_code, check_in, check_out, amount, channel, date_booked, guest_name
        )
      `)

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    // Enrich with computed fields
    const enriched = (data || []).map((g: any) => ({
      ...g,
      totalSpent: g.bookings.reduce((s: number, b: any) => s + (b.amount || 0), 0),
      bookingCount: g.bookings.length,
      lastStay: g.bookings.sort((a: any, b: any) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())[0]?.check_in || '',
      properties: [...new Set(g.bookings.map((b: any) => b.property))]
    }))

    // Sort
    if (sortBy === 'spent') enriched.sort((a, b) => b.totalSpent - a.totalSpent)
    else if (sortBy === 'bookings') enriched.sort((a, b) => b.bookingCount - a.bookingCount)
    else if (sortBy === 'recent') enriched.sort((a, b) => new Date(b.lastStay).getTime() - new Date(a.lastStay).getTime())
    else enriched.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ guests: enriched, total: count })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
