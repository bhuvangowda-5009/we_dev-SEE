
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Sidebar from '../components/Sidebar'
import AvatarPicker from '../components/AvatarPicker'
import '../css/dashboard.css'
import '../css/profile.css'
import '../components/AvatarPicker.css'

function Profile() {
  const navigate = useNavigate()

  const [profile, setProfile] = useState({ name: '', email: '' })
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()

      if (authError || !user) {
        navigate('/login', { replace: true })
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error

      const currentName =
        data?.name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'User'

      const currentProfile = {
        name: currentName,
        email: data?.email || user.email || ''
      }

      setProfile(currentProfile)
      setName(currentProfile.name)
    } catch (error) {
      console.error('Error loading profile:', error)
      alert('Unable to load profile: ' + error.message)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function handleSave() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      alert('Please enter your username.')
      return
    }

    try {
      setSaving(true)

      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()

      if (authError || !user) {
        navigate('/login', { replace: true })
        return
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          name: trimmedName
        }
      })

      if (metadataError) throw metadataError

      const { data: existing, error: lookupError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (lookupError) throw lookupError

      if (existing) {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: trimmedName,
            email: user.email
          })
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            name: trimmedName,
            email: user.email,
            role: user.user_metadata?.role || 'member'
          })

        if (error) throw error
      }

      setProfile({
        name: trimmedName,
        email: user.email || ''
      })

      setName(trimmedName)
      setEditing(false)

      window.dispatchEvent(
        new CustomEvent('profile-updated', {
          detail: { name: trimmedName }
        })
      )

      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Unable to update profile: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      alert('Unable to log out: ' + error.message)
      return
    }

    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="dashboard">
        <Sidebar />
        <main className="dashboard-content profile-page">
          <p>Loading profile...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <Sidebar />

      <main className="dashboard-content profile-page">
        <div className="profile-container">

          <header className="profile-header">
            <h1>My Profile</h1>
            <p>Manage your account information and profile picture.</p>
          </header>

          <section className="profile-information">

            <h2>Profile Information</h2>

            {/* Profile picture comes first */}
            <div className="profile-photo-section">
              <h3>Profile Picture</h3>
              <p className="profile-description">
                Personalize your account picture.
              </p>

              <div className="profile-avatar-area">
                <AvatarPicker />
              </div>
            </div>

            {/* Username */}
            <div className="profile-field">
              <label htmlFor="profile-name">Username</label>

              {editing ? (
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your username"
                  maxLength={100}
                  disabled={saving}
                />
              ) : (
                <div className="profile-value">{profile.name}</div>
              )}
            </div>

            {/* Gmail */}
            <div className="profile-field">
              <label htmlFor="profile-email">Gmail</label>
              <div id="profile-email" className="profile-value">
                {profile.email}
              </div>
            </div>

            {/* Edit and Logout */}
            <div className="profile-actions">
              {editing ? (
                <>
                  <button
                    type="button"
                    className="profile-edit-button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>

                  <button
                    type="button"
                    className="profile-cancel-button"
                    onClick={() => {
                      setName(profile.name)
                      setEditing(false)
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="profile-edit-button"
                  onClick={() => setEditing(true)}
                >
                  Edit Profile
                </button>
              )}

              <button
                type="button"
                className="profile-logout-button"
                onClick={handleLogout}
                disabled={saving}
              >
                Logout
              </button>
            </div>

          </section>
        </div>
      </main>
    </div>
  )
}

export default Profile
