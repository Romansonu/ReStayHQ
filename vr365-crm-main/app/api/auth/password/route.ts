import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'vr365salt').digest('hex')
}

export async function POST(req: NextRequest) {
  const { userId, currentPassword, newPassword } = await req.json()

  const { data } = await supabase
    .from('crm_users')
    .select('*')
    .eq('id', userId)
    .eq('password_hash', hashPassword(currentPassword))
    .single()

  if (!data) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

  const { error } = await supabase
    .from('crm_users')
    .update({ password_hash: hashPassword(newPassword) })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
