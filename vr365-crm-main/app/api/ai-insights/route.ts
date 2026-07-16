import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Handle chat messages
    if (body.chat) {
      const { context, history, question } = body
      const messages = history && history.length > 0 ? history : [{ role: 'user', content: question }]
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: context,
          messages
        })
      })
      const data = await res.json()
      return NextResponse.json({ answer: data.content?.[0]?.text?.trim() || 'Could not answer that.' })
    }

    const { guest } = body
    if (!guest) return NextResponse.json({ error: 'No guest data' }, { status: 400 })

    const bookings = (guest.bookings || [])
      .sort((a: any, b: any) => (a.check_in || '').localeCompare(b.check_in || ''))
      .map((b: any) => `- ${b.check_in?.slice(0,10)} to ${b.check_out?.slice(0,10)} at ${b.unit_code || b.property} ($${b.amount}) via ${b.channel}`)
      .join('\n')

    const today = body.localDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    const lastStay = (guest.bookings || [])
      .filter((b: any) => b.check_out && b.check_out.slice(0,10) <= today)
      .sort((a: any, b: any) => b.check_out > a.check_out ? 1 : -1)[0]?.check_out?.slice(0,10) || 'unknown'
    const monthsGone = lastStay !== 'unknown'
      ? Math.floor((Date.now() - new Date(lastStay).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : null
    const futureBookings = (guest.bookings || [])
      .filter((b: any) => b.check_in && b.check_in.slice(0,10) >= today)
      .sort((a: any, b: any) => a.check_in > b.check_in ? 1 : -1)
    const nextBooking = futureBookings[0]
    const daysUntilArrival = nextBooking
      ? Math.ceil((new Date(nextBooking.check_in).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Handle hot home brief
    if (body.hotBrief) {
      const { guest } = body
      const channel = guest.bookingChannel || 'Unknown'
      const isVrboChannel = channel.toLowerCase().includes('vrbo') || channel.toLowerCase().includes('homeaway') || channel.toLowerCase().includes('expedia') || channel.toLowerCase().includes('nextpax')
      const isNotPremier = guest.premierStatus === 'NOT_PREMIER'
      const isGrace = guest.premierStatus === 'PREMIER_GRACE_PERIOD'
      const isNearPremier = (guest.hotHomeReason || '').toLowerCase().includes('near premier')
      const vrboLowRating = guest.vrboRating > 0 && guest.vrboRating < 4.7

      // Always ask for VRBO review — that's the only platform we track
      const reviewPlatform = 'VRBO'

      const briefPrompt = `You are a hospitality manager for VR 365, a vacation rental company in Cle Elum/Suncadia, Washington.

Write a 3-sentence internal brief for the team about this Hot Home guest.

Property: ${guest.propertyName} (${guest.locationGroup})
Hot Home Reason: ${guest.hotHomeReason}
VRBO: ${guest.vrboReviews || 0} reviews, ${guest.vrboRating || 'no'} rating
Guest: ${guest.name}
Booking Platform: ${channel}
Stay: ${guest.checkIn ? `${guest.checkIn} to ${guest.checkOut}` : 'upcoming'}

STRICT RULES:
- ONLY mention VRBO. Do NOT mention Airbnb at all.
- Focus ONLY on: why flagged on VRBO, what to do during stay, ask for VRBO review after checkout.
- Be direct and specific. Exactly 3 sentences.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: briefPrompt }] })
      })
      const data = await res.json()
      return NextResponse.json({ brief: data.content?.[0]?.text?.trim() || 'Could not generate brief.' })
    }

    // Handle lead follow-up message
    if (guest.bookingCount === 0 && guest.leadProperty !== undefined) {
      const leadPrompt = `You are a follow-up assistant for VR 365, a vacation rental company in Cle Elum/Suncadia, Washington.

Write a short, warm, personalized follow-up message (2-3 sentences) to send to a potential guest who inquired but hasn't booked yet. Use their first name, reference the property they were interested in, and create urgency. Do not use placeholders.

Guest name: ${guest.name}
Property interested in: ${guest.leadProperty || 'one of our properties'}
Channel: ${guest.leadChannel || 'unknown'}
Notes: ${guest.leadNotes || 'none'}

Respond with ONLY the follow-up message, nothing else.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 300, messages: [{ role: 'user', content: leadPrompt }] })
      })
      const data = await res.json()
      return NextResponse.json({ winback: data.content?.[0]?.text?.trim() || 'Could not generate message.', insight: '', tags: [] })
    }

    const prompt = `You are a vacation rental CRM assistant for VR 365, a vacation rental company in Cle Elum/Suncadia, Washington.

Analyze this guest and provide THREE things:

1. INSIGHT: A 2-3 sentence smart analysis of their booking patterns, favorite seasons, preferred properties, and any notable behavior. Be specific and actionable for the property manager. IMPORTANT: If the guest has an upcoming booking, do NOT write as if they have already stayed — acknowledge their upcoming stay and what to prepare.

2. WINBACK: ${futureBookings.length > 0
  ? `This guest has an upcoming booking. Write a short warm pre-arrival message (2-3 sentences) welcoming them back and building excitement for their upcoming stay. Use their first name and reference their upcoming property.`
  : `A short warm personalized message (2-3 sentences) to re-engage them. Use their first name, reference their favorite property or season, and create urgency.`} Do not use placeholders like [name] — use their actual name.

3. TAGS: Pick ALL relevant tags from this list that apply to this guest based on their booking history. Only include tags that clearly apply:
VIP (5+ stays or $10k+ spent), Hot Tub (books hot tub properties), Holiday (books around Christmas/New Year/holidays), Repeat (2+ stays), Long Stay (stays 7+ nights regularly), Pet Friendly (needs pet friendly), Family (books multiple units or large groups), Owner (books via Owner channel)

Guest: ${guest.name}
Email: ${guest.email}
Total spent: $${guest.totalSpent}
Total bookings: ${guest.bookingCount}
Last stay: ${lastStay} (${monthsGone !== null ? monthsGone + ' months ago' : 'unknown'})
Today: ${today}
Upcoming bookings: ${futureBookings.length > 0 ? futureBookings.map((b: any) => `${b.check_in?.slice(0,10)} to ${b.check_out?.slice(0,10)} at ${b.unit_code || b.property} via ${b.channel} (${daysUntilArrival === 0 ? 'arriving TODAY' : daysUntilArrival === 1 ? 'arriving TOMORROW' : `arriving in ${daysUntilArrival} days`})`).join(', ') : 'None'}
IMPORTANT: Today is exactly ${today}. Do not guess or approximate dates — use only the exact dates provided above.

Booking history (oldest to newest):
${bookings || 'No bookings found'}

Respond in this EXACT format with no extra text:
INSIGHT: [your insight here]
WINBACK: [your message here]
TAGS: [comma separated tags, e.g. VIP, Repeat, Holiday]`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error?.message || 'API error' }, { status: 500 })

    const text = data.content?.[0]?.text || ''
    const insightMatch = text.match(/INSIGHT:\s*([\s\S]*?)(?=WINBACK:|$)/)
    const winbackMatch = text.match(/WINBACK:\s*([\s\S]*?)(?=TAGS:|$)/)
    const tagsMatch = text.match(/TAGS:\s*([\s\S]*)/)

    const VALID_TAGS = ['VIP', 'Hot Tub', 'Holiday', 'Repeat', 'Long Stay', 'Pet Friendly', 'Family', 'Owner']
    const suggestedTags = tagsMatch?.[1]
      ?.split(',')
      .map((t: string) => t.trim())
      .filter((t: string) => VALID_TAGS.includes(t)) || []

    return NextResponse.json({
      insight: insightMatch?.[1]?.trim() || 'Could not generate insight.',
      winback: winbackMatch?.[1]?.trim() || 'Could not generate win-back message.',
      tags: suggestedTags
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
