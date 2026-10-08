import { Link } from 'react-router-dom'
import '../css/components.css'

function Sidebar() {
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
          B
        </div>

        <div>
          <strong>Bhuvan</strong>
          <small>Team Member</small>
        </div>

      </div>

    </aside>
  )
}

export default Sidebar