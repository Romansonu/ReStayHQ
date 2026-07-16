import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

    let updated = 0, notFound = 0
    const notFoundList: string[] = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const vals = parseLine(lines[i])
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => row[h] = (vals[idx] || '').replace(/^"|"$/g, '').trim())

      // Support both tab-delimited and comma-delimited
      const propertyName = row.property_name || row.name || ''
      const premierFlags = row.premier_listing_flags || row.flags || ''
      const premierStatus = row.premier_status || row.status || ''
      const vrboRating = parseFloat(row.avg_reviews_rating || row.rating || '0') || 0
      const vrboReviews = parseInt(row.reviews_count || row.reviews || '0') || 0

      if (!propertyName) continue

      // Find matching property using ilike
      const { data: matches } = await supabase
        .from('property_reviews')
        .select('id, property_name')
        .ilike('property_name', `%${propertyName.split(' ')[0]}%`)

      if (!matches || matches.length === 0) {
        notFound++
        notFoundList.push(propertyName)
        continue
      }

      // Find best match
      const best = matches.find(m =>
        m.property_name.toLowerCase() === propertyName.toLowerCase()
      ) || matches.find(m =>
        m.property_name.toLowerCase().includes(propertyName.toLowerCase()) ||
        propertyName.toLowerCase().includes(m.property_name.toLowerCase())
      ) || matches[0]

      const { error } = await supabase
        .from('property_reviews')
        .update({
          vrbo_reviews: vrboReviews,
          vrbo_rating: vrboRating,
          vrbo_premier_status: premierStatus || null,
          vrbo_premier_flags: premierFlags || null,
          last_updated: new Date().toISOString()
        })
        .eq('id', best.id)

      if (!error) updated++
      else { notFound++; notFoundList.push(propertyName) }
    }

    return NextResponse.json({
      success: true,
      updated,
      notFound,
      notFoundList,
      message: `✅ Updated ${updated} properties${notFound > 0 ? `, ${notFound} not matched: ${notFoundList.join(', ')}` : ''}`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
