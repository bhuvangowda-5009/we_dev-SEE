
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Sidebar from '../components/Sidebar'
import '../css/dashboard.css'

function Profile() {
  const navigate = useNavigate()

  const [profile, setProfile] = useState({
    name: '',
    email: ''
  })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        navigate('/login', { replace: true })
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        throw error
      }

      const currentName =
        data?.name?.trim() ||
        user.user_metadata?.name?.trim() ||
        user.email?.split('@')[0] ||
        'User'

      const currentProfile = {
        name: currentName,
        email: data?.email || user.email || ''
      }

      setProfile(currentProfile)
      setName(currentName)

      // Keep the sidebar in sync with the saved profile.
      window.dispatchEvent(
        new CustomEvent('profile-updated', {
          detail: { name: currentName }
        })
      )
    } catch (error) {
      console.error('Unable to load profile:', error)
      alert('Unable to load your profile: ' + error.message)
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
      alert('Please enter your name.')
      return
    }

    try {
      setSaving(true)

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        navigate('/login', { replace: true })
        return
      }

      // Save the name in Supabase Auth metadata.
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          name: trimmedName
        }
      })

      if (authError) {
        throw new Error(
          'Unable to update account name: ' + authError.message
        )
      }

      // Check whether a profile row already exists for this user.
      const { data: existingProfile, error: lookupError } =
        await supabase
          .from('profiles')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle()

      if (lookupError) {
        throw new Error(
          'Unable to check profile record: ' + lookupError.message
        )
      }

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            name: trimmedName,
            email: user.email
          })
          .eq('user_id', user.id)

        if (updateError) {
          throw new Error(
            'Unable to update profile: ' + updateError.message
          )
        }
      } else {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            name: trimmedName,
            email: user.email,
            role: user.user_metadata?.role || 'member'
          })

        if (insertError) {
          throw new Error(
            'Unable to create profile: ' + insertError.message
          )
        }
      }

      const updatedProfile = {
        name: trimmedName,
        email: user.email || ''
      }

      setProfile(updatedProfile)
      setName(trimmedName)
      setEditing(false)

      // Immediately update the sidebar name and avatar.
      window.dispatchEvent(
        new CustomEvent('profile-updated', {
          detail: { name: trimmedName }
        })
      )

      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Save profile error:', error)
      alert(error.message || 'Unable to save your profile.')
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
        <main className="dashboard-content">
          <h1>Loading profile...</h1>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <Sidebar />

      <main className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <h1>My Profile</h1>
            <p>Manage your account information.</p>
          </div>
        </header>

        <section className="dashboard-card">
          <div className="card-title">
            <h2>Profile Information</h2>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h3>Name</h3>

            {editing ? (
              <input
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Enter your name"
                maxLength={100}
                disabled={saving}
              />
            ) : (
              <p>{profile.name}</p>
            )}
          </div>

          <div style={{ marginTop: '20px' }}>
            <h3>Email</h3>
            <p>{profile.email}</p>
          </div>

          <div style={{ marginTop: '25px' }}>
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  className="create-button"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setName(profile.name)
                    setEditing(false)
                  }}
                  style={{ marginLeft: '10px' }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="create-button"
              >
                Edit Profile
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              style={{ marginLeft: '10px' }}
              disabled={saving}
            >
              Logout
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Profile
