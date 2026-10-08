
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import '../css/components.css'

function Sidebar() {
  const [profileName, setProfileName] = useState('User')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      // Get currently logged-in user
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        console.log('User not found:', userError)
        return
      }

      // Get profile belonging to logged-in user's email
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('email', user.email)
        .single()

      if (error) {
        console.log('Error loading profile:', error)
        return
      }

      setProfileName(data.name)
    } catch (error) {
      console.log('Unexpected profile error:', error)
    }
  }

  return (
    <aside className="sidebar">

      <h2>TeamHub</h2>

      <nav>
        <Link to="/dashboard">
          🏠 Dashboard
        </Link>

        <Link to="/team">
          👥 Teams
        </Link>

        <Link to="/chat">
          💬 Messages
        </Link>

        <Link to="/tasks">
          📋 Tasks
        </Link>

        <Link to="/files">
          📁 Files
        </Link>

        <Link to="/profile">
          👤 Profile
        </Link>
      </nav>

      <div className="sidebar-profile">

        <div className="avatar">
          {profileName.charAt(0).toUpperCase()}
        </div>

        <div>
          <strong>{profileName}</strong>
          <small>Team Member</small>
        </div>

      </div>

    </aside>
  )
}

export default Sidebar
