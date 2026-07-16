'use client'
import { useState } from 'react'

const C = {
  bg: '#E9ECF2', bgCard: '#FFFFFF', bgInput: '#EEF0F5',
  separator: '#D1D4DC', label: '#1C1C2E', label3: '#72728A', label4: '#A0A0BC',
  blue: '#007AFF', red: '#E63946', indigo: '#4C46C8',
  cardShadow: '0 1px 2px rgba(0,0,30,0.06), 0 3px 10px rgba(0,0,30,0.07)',
}

export default function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (data.success) {
        onLogin(data.user)
      } else {
        setError(data.error || 'Invalid username or password')
      }
    } catch (e: any) {
      setError('Connection error. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif", backgroundColor: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="VR 365" style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover', marginBottom: 16, boxShadow: '0 4px 20px rgba(0,0,30,0.15)' }} />
          <div style={{ fontSize: 24, fontWeight: 700, color: C.label, letterSpacing: '-0.4px' }}>VR 365 CRM</div>
          <div style={{ fontSize: 14, color: C.label3, marginTop: 4 }}>Sign in to your account</div>
        </div>

        {/* Login form */}
        <div style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 24, boxShadow: C.cardShadow }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.label, marginBottom: 6 }}>Username</div>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 14, outline: 'none', boxSizing: 'border-box' as any }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.label, marginBottom: 6 }}>Password</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 14, outline: 'none', boxSizing: 'border-box' as any }}
              />
            </div>
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: C.red+'12', color: C.red, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !username || !password}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: `linear-gradient(135deg, ${C.blue}, ${C.indigo})`, color: '#fff', fontSize: 15, fontWeight: 600, opacity: loading || !username || !password ? 0.6 : 1, transition: 'all 0.2s' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: C.label4 }}>
          VR 365 — Internal CRM · vacationrental365.com
        </div>
      </div>
    </div>
  )
}
