'use client'
import { useState, useEffect } from 'react'

const C = {
  bg: '#E9ECF2', bgCard: '#FFFFFF', bgInput: '#EEF0F5',
  separator: '#D1D4DC', label: '#1C1C2E', label2: '#2C2C44', label3: '#72728A', label4: '#A0A0BC',
  blue: '#007AFF', green: '#25A244', red: '#E63946', orange: '#F48C06', indigo: '#4C46C8',
  cardShadow: '0 1px 2px rgba(0,0,30,0.06), 0 3px 10px rgba(0,0,30,0.07)',
}

export default function SettingsPage({ currentUser, onClose, onLogout }: any) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('staff')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const [activeSection, setActiveSection] = useState('team')

  // Change password
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/auth/users')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  async function addUser() {
    if (!newUsername || !newPassword) return
    setAdding(true)
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
    })
    const data = await res.json()
    if (data.success) {
      setMsg('✅ User added!')
      setNewUsername(''); setNewPassword(''); setNewRole('staff')
      loadUsers()
    } else {
      setMsg('❌ ' + data.error)
    }
    setAdding(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function removeUser(id: string) {
    if (!confirm('Remove this user?')) return
    await fetch(`/api/auth/users?id=${id}`, { method: 'DELETE' })
    loadUsers()
  }

  async function changeRole(id: string, newRole: string) {
    await fetch('/api/auth/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: newRole })
    })
    loadUsers()
  }

  async function changePassword() {
    if (newPwd !== confirmPwd) { setPwdMsg('❌ Passwords do not match'); return }
    if (newPwd.length < 6) { setPwdMsg('❌ Password must be at least 6 characters'); return }
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, currentPassword: currentPwd, newPassword: newPwd })
    })
    const data = await res.json()
    setPwdMsg(data.success ? '✅ Password changed!' : '❌ ' + data.error)
    if (data.success) { setCurrentPwd(''); setNewPwd(''); setConfirmPwd('') }
    setTimeout(() => setPwdMsg(''), 3000)
  }

  const sections = [
    { id: 'team', label: '👥 Team Members' },
    { id: 'password', label: '🔒 Change Password' },
    { id: 'account', label: '👤 My Account' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ backgroundColor: C.bg, borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.separator}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bgCard }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.label }}>⚙️ Settings</div>
            <div style={{ fontSize: 12, color: C.label3, marginTop: 2 }}>Manage your CRM settings</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 16, border: 'none', backgroundColor: C.bg, color: C.label3, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ width: 180, borderRight: `1px solid ${C.separator}`, padding: '12px 8px', backgroundColor: C.bgCard, flexShrink: 0 }}>
            {sections.map(s => (
              <div key={s.id} onClick={() => setActiveSection(s.id)}
                style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: activeSection === s.id ? 600 : 400, color: activeSection === s.id ? C.blue : C.label2, backgroundColor: activeSection === s.id ? C.blue+'12' : 'transparent', marginBottom: 4, transition: 'all 0.15s' }}>
                {s.label}
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.separator}`, marginTop: 12, paddingTop: 12 }}>
              <div onClick={onLogout}
                style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: C.red, backgroundColor: 'transparent', marginBottom: 4 }}>
                🚪 Sign Out
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

            {activeSection === 'team' && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.label, marginBottom: 4 }}>Team Members</div>
                <div style={{ fontSize: 13, color: C.label3, marginBottom: 20 }}>Add or remove people who can access the CRM.</div>

                {/* Current users */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {loading ? <div style={{ color: C.label3, fontSize: 13 }}>Loading...</div> :
                    users.map(u => (
                      <div key={u.id} style={{ backgroundColor: C.bgCard, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: C.cardShadow }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.label }}>{u.username}</div>
                          <div style={{ fontSize: 11, color: C.label3, marginTop: 2 }}>
                            <span style={{ padding: '1px 8px', borderRadius: 20, backgroundColor: u.role === 'admin' ? C.blue+'18' : u.role === 'supervisor' ? C.orange+'18' : C.green+'18', color: u.role === 'admin' ? C.blue : u.role === 'supervisor' ? C.orange : C.green, fontWeight: 600 }}>{u.role}</span>
                            {u.last_login && <span style={{ marginLeft: 8 }}>Last login: {new Date(u.last_login).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {u.id === currentUser.id && <span style={{ fontSize: 11, color: C.blue, fontWeight: 600 }}>You</span>}
                          {u.id !== currentUser.id && (
                            <>
                            <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                            style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                            <option value="admin">Admin</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="staff">Staff</option>
                          </select>
                          <button onClick={() => removeUser(u.id)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.red}30`, backgroundColor: C.red+'10', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  }
                </div>

                {/* Add user */}
                <div style={{ backgroundColor: C.bgCard, borderRadius: 12, padding: '16px 18px', boxShadow: C.cardShadow }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.label, marginBottom: 14 }}>Add New Member</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.label3, marginBottom: 4 }}>Username</div>
                      <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="e.g. derek"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 13, outline: 'none', boxSizing: 'border-box' as any }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: C.label3, marginBottom: 4 }}>Password</div>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Set a password"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 13, outline: 'none', boxSizing: 'border-box' as any }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: C.label3, marginBottom: 4 }}>Role</div>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 13, outline: 'none' }}>
                      <option value="admin">Admin — full access + settings</option>
                      <option value="supervisor">Supervisor — view + edit, no settings</option>
                      <option value="staff">Staff — view only</option>
                    </select>
                  </div>
                  {msg && <div style={{ fontSize: 13, marginBottom: 10, color: msg.startsWith('✅') ? C.green : C.red }}>{msg}</div>}
                  <button onClick={addUser} disabled={adding || !newUsername || !newPassword}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: C.blue, color: '#fff', fontSize: 13, fontWeight: 600, opacity: adding || !newUsername || !newPassword ? 0.6 : 1 }}>
                    {adding ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'password' && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.label, marginBottom: 4 }}>Change Password</div>
                <div style={{ fontSize: 13, color: C.label3, marginBottom: 20 }}>Update your login password.</div>
                <div style={{ backgroundColor: C.bgCard, borderRadius: 12, padding: '16px 18px', boxShadow: C.cardShadow, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Current Password', value: currentPwd, set: setCurrentPwd },
                    { label: 'New Password', value: newPwd, set: setNewPwd },
                    { label: 'Confirm New Password', value: confirmPwd, set: setConfirmPwd },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 12, color: C.label3, marginBottom: 4 }}>{f.label}</div>
                      <input type="password" value={f.value} onChange={e => f.set(e.target.value)} placeholder="••••••••"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.separator}`, backgroundColor: C.bgInput, color: C.label, fontSize: 13, outline: 'none', boxSizing: 'border-box' as any }} />
                    </div>
                  ))}
                  {pwdMsg && <div style={{ fontSize: 13, color: pwdMsg.startsWith('✅') ? C.green : C.red }}>{pwdMsg}</div>}
                  <button onClick={changePassword} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: C.blue, color: '#fff', fontSize: 13, fontWeight: 600, alignSelf: 'flex-start' }}>
                    Update Password
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'account' && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.label, marginBottom: 20 }}>My Account</div>
                <div style={{ backgroundColor: C.bgCard, borderRadius: 12, padding: '16px 18px', boxShadow: C.cardShadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 28, background: `linear-gradient(135deg, ${C.blue}, ${C.indigo})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff' }}>
                      {currentUser.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.label }}>{currentUser.username}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, backgroundColor: currentUser.role === 'admin' ? C.blue+'18' : currentUser.role === 'supervisor' ? C.orange+'18' : C.green+'18', color: currentUser.role === 'admin' ? C.blue : currentUser.role === 'supervisor' ? C.orange : C.green, fontWeight: 600, fontSize: 11 }}>{currentUser.role}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={onLogout} style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${C.red}30`, backgroundColor: C.red+'10', color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    🚪 Sign Out
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
