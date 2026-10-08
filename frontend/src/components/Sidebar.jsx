import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import '../css/components.css'

function Sidebar() {

  const [profileName, setProfileName] = useState('Bhuvan')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {

    const { data, error } = await supabase
      .from('profiles')
      .select('name')
      .limit(1)
      .single()

    if (error) {
      console.log('Error loading profile:', error)
      return
    }

    setProfileName(data.name)
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