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
  const { username, password } = await req.json()
  if (!username || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })

  const { data, error } = await supabase
    .from('crm_users')
    .select('*')
    .eq('username', username.toLowerCase().trim())
    .eq('password_hash', hashPassword(password))
    .single()

  if (error || !data) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })

  await supabase.from('crm_users').update({ last_login: new Date().toISOString() }).eq('id', data.id)

  return NextResponse.json({
    success: true,
    user: { id: data.id, username: data.username, role: data.role }
  })
}
