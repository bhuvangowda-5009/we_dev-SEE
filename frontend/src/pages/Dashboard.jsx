
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import '../css/dashboard.css'

const API_ROOT = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '')

const API_URL = API_ROOT.endsWith('/api')
  ? API_ROOT
  : `${API_ROOT}/api`

function Dashboard() {
  const [teams, setTeams] = useState([])
  const [tasks, setTasks] = useState([])
  const [messageCount, setMessageCount] = useState(0)
  const [fileCount, setFileCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [userName, setUserName] = useState('User')
  const [visibleTeamsCount, setVisibleTeamsCount] = useState(5)

  // Load the logged-in user's name
  const loadUser = useCallback(async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error) throw error

      if (user) {
        const name =
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'User'

        setUserName(name)
      }
    } catch (error) {
      console.error('Error loading user:', error.message)
    }
  }, [])

  // Load message count
  const loadMessageCount = useCallback(async () => {
    try {
      const {
        count,
        error,
      } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.error('Message count error:', error.message)
        return
      }

      setMessageCount(count ?? 0)
    } catch (error) {
      console.error('Unexpected message count error:', error.message)
    }
  }, [])

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    setLoading(true)

    try {
      // Get the current logged-in user's session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!session?.access_token) {
        throw new Error('No active session. Please log in again.')
      }

      // Send authentication token to the Node.js backend
      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      }

      // Load the logged-in user's teams
      const teamsResponse = await fetch(`${API_URL}/teams`, {
        headers,
      })

      if (!teamsResponse.ok) {
        throw new Error(
          `Failed to load teams: HTTP ${teamsResponse.status}`
        )
      }

      const teamsData = await teamsResponse.json()

      if (!Array.isArray(teamsData)) {
        throw new Error('Teams API did not return an array.')
      }

      setTeams(teamsData)

      // Load tasks
      const tasksResponse = await fetch(`${API_URL}/tasks`, {
        headers,
      })

      if (!tasksResponse.ok) {
        throw new Error(
          `Failed to load tasks: HTTP ${tasksResponse.status}`
        )
      }

      const tasksData = await tasksResponse.json()

      if (!Array.isArray(tasksData)) {
        throw new Error('Tasks API did not return an array.')
      }

      setTasks(tasksData)

      // Load message count
     const messagesResponse = await fetch(
  `${API_URL}/messages/count`,
  { headers }
)

if (!messagesResponse.ok) {
  throw new Error(
    `Failed to load message count: HTTP ${messagesResponse.status}`
  )
}

const messagesData = await messagesResponse.json()
setMessageCount(messagesData.count ?? 0)

      // Load files count
      const { data: files, error: fileError } =
        await supabase.storage
          .from('files')
          .list('', { limit: 1000 })

      if (fileError) {
        console.error('Error loading files:', fileError.message)
      } else {
        setFileCount(files?.length ?? 0)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error.message)
    } finally {
      setLoading(false)
    }
  }, [loadMessageCount])

  // Initial dashboard load and real-time message updates
  useEffect(() => {
    loadUser()
    loadDashboard()

    let isMounted = true

    const channel = supabase
      .channel('dashboard-messages-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        async () => {
          if (isMounted) {
            await loadMessageCount()
          }
        }
      )
      .subscribe((status, error) => {
        console.log('Messages realtime status:', status)

        if (error) {
          console.error('Messages realtime error:', error)
        }
      })

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [loadUser, loadDashboard, loadMessageCount])

  // Count active tasks
  const activeTasks = tasks.filter(
    task =>
      task.status === 'todo' ||
      task.status === 'in_progress'
  ).length

  // Show the 5 latest tasks first
  const recentTasks = [...tasks]
    .sort((a, b) => {
      const dateA = a.created_at
        ? new Date(a.created_at).getTime()
        : Number(a.id) || 0

      const dateB = b.created_at
        ? new Date(b.created_at).getTime()
        : Number(b.id) || 0

      return dateB - dateA
    })
    .slice(0, 5)

  const getStatusClass = status => {
    if (status === 'completed') return 'completed'
    if (status === 'in_progress') return 'progress'
    return 'todo'
  }

  const getStatusText = status => {
    if (status === 'completed') return 'Completed'
    if (status === 'in_progress') return 'In Progress'
    return 'To Do'
  }

  return (
    <div className="dashboard-content">
      {/* Dashboard header */}
      <header className="dashboard-header">
        <div>
          <h1>Good morning, {userName} 👋</h1>
          <p>Here's what's happening with your teams today.</p>
        </div>

        <button
          className="create-button"
          onClick={loadDashboard}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </header>

      {/* Statistics */}
      <section className="stats">
        <div className="stat-card">
          <h2>{teams.length}</h2>
          <p>Teams</p>
        </div>

        <div className="stat-card">
          <h2>{activeTasks}</h2>
          <p>Active Tasks</p>
        </div>

        <div className="stat-card">
          <h2>{messageCount}</h2>
          <p>Messages</p>
        </div>

        <div className="stat-card">
          <h2>{fileCount}</h2>
          <p>Files</p>
        </div>
      </section>

      {/* Main dashboard panels */}
      <section className="dashboard-grid">
        {/* My Teams */}
        <div className="dashboard-card">
          <div className="card-title">
            <div>
              <h2>My Teams</h2>
              <p className="teams-count">
                {teams.length} teams in total
              </p>
            </div>

            <button onClick={loadDashboard} disabled={loading}>
              {loading ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>

          {teams.length === 0 ? (
            <p>No teams available.</p>
          ) : (
            <>
              {[...teams]
                .reverse()
                .slice(0, visibleTeamsCount)
                .map((team, index) => (
                  <div className="team-item" key={team.id}>
                    <div className="team-icon">
                      {team.icon ||
                        (index === 0
                          ? '💻'
                          : index === 1
                            ? '🎨'
                            : index === 2
                              ? '📢'
                              : '👥')}
                    </div>

                    <div className="team-details">
                      <h3>{team.name}</h3>
                      <p>
                        {team.members ??
                          team.member_count ??
                          team.members_count ??
                          0}{' '}
                        members
                      </p>
                    </div>
                  </div>
                ))}

              <div className="show-more-container">
                {visibleTeamsCount < teams.length ? (
                  <button
                    type="button"
                    className="show-more-teams"
                    onClick={() =>
                      setVisibleTeamsCount(previousCount =>
                        Math.min(
                          previousCount + 5,
                          teams.length
                        )
                      )
                    }
                  >
                    Show More <span aria-hidden="true">↓</span>
                  </button>
                ) : (
                  teams.length > 5 && (
                    <button
                      type="button"
                      className="show-more-teams"
                      onClick={() => setVisibleTeamsCount(5)}
                    >
                      Show Less <span aria-hidden="true">↑</span>
                    </button>
                  )
                )}

                <p>
                  Showing {Math.min(
                    visibleTeamsCount,
                    teams.length
                  )}{' '}
                  of {teams.length} teams
                </p>
              </div>
            </>
          )}
        </div>

        {/* Recent Tasks */}
        <div className="dashboard-card">
          <div className="card-title">
            <div>
              <h2>Recent Tasks</h2>
              <p className="tasks-description">
                Your 5 latest tasks across teams
              </p>
            </div>

            <button onClick={loadDashboard} disabled={loading}>
              {loading ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <p>No tasks available.</p>
          ) : (
            recentTasks.map(task => (
              <div className="task-item" key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <p>Team task</p>
                </div>

                <span
                  className={`status ${getStatusClass(task.status)}`}
                >
                  {getStatusText(task.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default Dashboard
