
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        navigate('/login')
        return
      }

      // Find the profile belonging to this authenticated user.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Profile lookup error:', error)
        throw error
      }

      const currentName =
        data?.name ||
        user.user_metadata?.name ||
        user.email.split('@')[0]

      setProfile({
        name: currentName,
        email: user.email
      })

      setName(currentName)
    } catch (error) {
      console.error('Unable to load profile:', error)
      alert('Unable to load your profile: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

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
        navigate('/login')
        return
      }

      // Update the display name in Supabase Auth.
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

      // Check whether this user already has a profile row.
      const { data: existingProfile, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (lookupError) {
        throw new Error(
          'Unable to check profile record: ' + lookupError.message
        )
      }

      if (existingProfile) {
        // Update the existing profile.
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ name: trimmedName })
          .eq('user_id', user.id)

        if (updateError) {
          throw new Error(
            'Account name updated, but profile update failed: ' +
            updateError.message
          )
        }
      } else {
        // Create a profile only for the currently authenticated user.
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
            'Account name updated, but the profile could not be created. ' +
            'Supabase may be blocking the insert through Row Level Security (RLS). ' +
            insertError.message
          )
        }
      }

      setProfile({
        name: trimmedName,
        email: user.email
      })

      setEditing(false)
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
