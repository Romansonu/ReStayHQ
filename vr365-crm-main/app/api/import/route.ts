import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const INTERNAL_EMAILS = new Set([
  'fredscott4625@gmail.com', 'fredscott9625@gmail.com', 'fredscott6925@gmail.com',
  'fredscott@myvr365.com', 'fredscott9265@gmail.com',
  'amanda1bannon@gmail.com', 'amanda@myvr365.com', 'absartisticantics@gmail.com'
])

function parseLine(line: string): string[] {
  const vals: string[] = []
  let cur = '', inQ = false
  for (const c of line) {
    if (c === '"') inQ = !inQ
    else if (c === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
    else cur += c
  }
  vals.push(cur.trim())
  return vals
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const text = (await file.text()).replace(/^\uFEFF/, '')
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return NextResponse.json({ error: 'Empty file' }, { status: 400 })

    const rawHeaders = parseLine(lines[0])
    const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))

    const guestMap: Record<string, any> = {}
    const emailIndex: Record<string, string> = {}
    const newBookings: any[] = []

    // Parse CSV into guest + booking records
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const vals = parseLine(lines[i])
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => row[h] = (vals[idx] || '').replace(/^"|"$/g, '').trim())

      const firstName = row.first_name || row.firstname || ''
      const lastName = row.last_name || row.lastname || ''
      const fullName = (firstName + ' ' + lastName).trim() || 'Unknown'
      const email = (row.email || '').trim()
      const normEmail = email.toLowerCase()

      const amount = parseFloat((row.bookingrenttotal || row.booking_rent_total || row.total || '0').replace(/[$,]/g, '')) || 0
      const bookingNum = row.booking_number || `B${Math.random().toString(36).slice(2, 7)}`
      const unitCode = row.unit_code || row.unit || ''
      const channel = row.sourceorchannel || row.source_code || ''
      const dateBooked = row.creation_date || row.date_booked || ''
      const checkIn = row.start_date || row.arrival_date || ''
      const checkOut = row.departure_date || row.departure || ''

      const hasValidEmail = normEmail && normEmail.length > 3 && normEmail !== 'da' && normEmail.includes('@') && !INTERNAL_EMAILS.has(normEmail)

      let key: string | null = hasValidEmail && emailIndex[normEmail] ? emailIndex[normEmail] : null

      if (key) {
        const g = guestMap[key]
        if (fullName !== g.name && !g.aliases.includes(fullName)) g.aliases.push(fullName)
        if (fullName.length > g.name.length) g.name = fullName
      } else {
        key = hasValidEmail ? normEmail : `guest_${i}`
        guestMap[key] = {
          id: key,
          name: fullName,
          email: hasValidEmail ? email : '',
          aliases: []
        }
        if (hasValidEmail) emailIndex[normEmail] = key
      }

      newBookings.push({
        id: bookingNum,
        guest_id: key,
        property: unitCode || 'Unknown',
        unit_code: unitCode,
        check_in: checkIn || null,
        check_out: checkOut || null,
        amount,
        channel,
        date_booked: dateBooked || null,
        guest_name: fullName,
        guest_email: email
      })
    }

    const guestList = Object.values(guestMap)
    let newGuests = 0, updatedGuests = 0, newBookingCount = 0, skippedBookings = 0

    // Get ALL existing booking IDs in batches to avoid row limit
    const existingBookingIds = new Set<string>()
    let offset = 0
    while (true) {
      const { data } = await supabase.from('bookings').select('id').range(offset, offset + 999)
      if (!data || data.length === 0) break
      data.forEach((b: any) => existingBookingIds.add(b.id))
      if (data.length < 1000) break
      offset += 1000
    }

    // Get ALL existing guests in batches
    const existingGuestMap: Record<string, any> = {}
    offset = 0
    while (true) {
      const { data } = await supabase.from('guests').select('id, name, aliases').range(offset, offset + 999)
      if (!data || data.length === 0) break
      data.forEach((g: any) => { existingGuestMap[g.id] = g })
      if (data.length < 1000) break
      offset += 1000
    }

    // Upsert guests — preserve notes and tags, update name/aliases only
    for (let i = 0; i < guestList.length; i += 500) {
      const batch = guestList.slice(i, i + 500)
      for (const g of batch) {
        const existing = existingGuestMap[g.id]
        if (existing) {
          // Merge aliases, update name if longer — never touch notes/tags
          const mergedAliases = [...new Set([...(existing.aliases || []), ...g.aliases])]
          const { error } = await supabase
            .from('guests')
            .update({
              name: g.name.length > (existing.name || '').length ? g.name : existing.name,
              aliases: mergedAliases
            })
            .eq('id', g.id)
          if (!error) updatedGuests++
        } else {
          // New guest — insert with empty notes/tags
          const { error } = await supabase
            .from('guests')
            .insert({ ...g, phone: '', notes: '', tags: [] })
          if (!error) newGuests++
        }
      }
    }

    // Insert only new bookings — skip ones we already have
    const bookingsToInsert = newBookings.filter(b => !existingBookingIds.has(b.id))
    skippedBookings = newBookings.length - bookingsToInsert.length

    for (let i = 0; i < bookingsToInsert.length; i += 500) {
      const { error } = await supabase
        .from('bookings')
        .insert(bookingsToInsert.slice(i, i + 500))
      if (!error) newBookingCount += Math.min(500, bookingsToInsert.length - i)
    }

    return NextResponse.json({
      success: true,
      newGuests,
      updatedGuests,
      newBookings: newBookingCount,
      skippedBookings,
      message: `${newGuests} new guests, ${updatedGuests} updated, ${newBookingCount} new bookings added, ${skippedBookings} already existed`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
