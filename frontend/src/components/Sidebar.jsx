
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import '../css/components.css'

function Sidebar() {
  const [profileName, setProfileName] = useState('User')

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setProfileName('User')
        return
      }

      // Look up the profile using the authenticated user's ID.
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Error loading sidebar profile:', error.message)
      }

      const latestName =
        data?.name?.trim() ||
        user.user_metadata?.name?.trim() ||
        user.email?.split('@')[0] ||
        'User'

      setProfileName(latestName)
    } catch (error) {
      console.error('Unexpected sidebar profile error:', error)
    }
  }, [])

  useEffect(() => {
    // Load the current name when the sidebar appears.
    loadProfile()

    // Update immediately after a profile edit.
    const handleProfileUpdated = event => {
      if (event.detail?.name) {
        setProfileName(event.detail.name)
      } else {
        loadProfile()
      }
    }

    window.addEventListener('profile-updated', handleProfileUpdated)

    // Reload the name when the authentication session changes.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => {
      window.removeEventListener(
        'profile-updated',
        handleProfileUpdated
      )
      subscription.unsubscribe()
    }
  }, [loadProfile])

  return (
    <aside className="sidebar">
      <h2>TeamHub</h2>

      <nav>
        <Link to="/dashboard">🏠 Dashboard</Link>
        <Link to="/team">👥 Teams</Link>
        <Link to="/chat">💬 Messages</Link>
        <Link to="/tasks">📋 Tasks</Link>
        <Link to="/files">📁 Files</Link>
        <Link to="/profile">👤 Profile</Link>
      </nav>

      <div className="sidebar-profile">
        <div className="avatar">
          {profileName.charAt(0).toUpperCase()}
        </div>

        <div>
          <strong>{profileName}</strong>
          <small>Workspace Member</small>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
