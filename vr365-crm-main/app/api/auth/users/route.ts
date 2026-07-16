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

export async function GET() {
  const { data } = await supabase
    .from('crm_users')
    .select('id, username, role, last_login, created_at')
    .order('created_at')
  return NextResponse.json({ users: data || [] })
}

export async function POST(req: NextRequest) {
  const { username, password, role } = await req.json()
  if (!username || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { error } = await supabase.from('crm_users').insert({
    username: username.toLowerCase().trim(),
    password_hash: hashPassword(password),
    role: role || 'staff'
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const { id, role } = await req.json()
  if (!id || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const { error } = await supabase.from('crm_users').update({ role }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabase.from('crm_users').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
