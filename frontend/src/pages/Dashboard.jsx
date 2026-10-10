
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import '../css/dashboard.css'

function Dashboard() {
  const [teams, setTeams] = useState([])
  const [tasks, setTasks] = useState([])
  const [messageCount, setMessageCount] = useState(0)
  const [fileCount, setFileCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [userName, setUserName] = useState('User')
  const [visibleTeamsCount, setVisibleTeamsCount] = useState(5)

  // Load logged-in user's name
  const loadUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.error('Error loading user:', error)
      return
    }

    if (user) {
      const name =
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'User'

      setUserName(name)
    }
  }

  // Load message count and print detailed debugging information
  const loadMessageCount = useCallback(async () => {
    try {
      const { data, error: readError } = await supabase
        .from('messages')
        .select('*')
        .limit(5)

      console.log(
        'Messages table read test:',
        JSON.stringify(
          {
            rowsReturned: data?.length,
            sampleRows: data,
            error: readError,
          },
          null,
          2
        )
      )

      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })

      console.log(
        'Messages count test:',
        JSON.stringify(
          {
            count,
            error: countError,
          },
          null,
          2
        )
      )

      if (countError) {
        console.error('Message count error:', countError)
        return
      }

      setMessageCount(count ?? 0)
    } catch (error) {
      console.error('Unexpected message count error:', error)
    }
  }, [])

  // Load dashboard data
  const loadDashboard = async () => {
    setLoading(true)

    try {
      // Load teams
      const teamsResponse = await fetch(
        'http://localhost:5000/api/teams'
      )

      if (!teamsResponse.ok) {
        throw new Error('Failed to load teams')
      }

      const teamsData = await teamsResponse.json()
      setTeams(teamsData)

      // Load tasks
      const tasksResponse = await fetch(
        'http://localhost:5000/api/tasks'
      )

      if (!tasksResponse.ok) {
        throw new Error('Failed to load tasks')
      }

      const tasksData = await tasksResponse.json()
      setTasks(tasksData)

      // Load messages count
      await loadMessageCount()

      // Load files count
      const { data: files, error: fileError } = await supabase.storage
        .from('files')
        .list('', { limit: 1000 })

      if (fileError) {
        console.error('Error loading files:', fileError)
      } else {
        setFileCount(files?.length ?? 0)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load and real-time message updates
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
        async (payload) => {
          console.log('Message database change received:', payload)

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
  }, [loadMessageCount])

  // Count active tasks
  const activeTasks = tasks.filter(
    task =>
      task.status === 'todo' ||
      task.status === 'in_progress'
  ).length

  // Show the 5 latest tasks first
  const recentTasks = [...tasks]
    .sort((a, b) => Number(b.id) - Number(a.id))
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
                        Math.min(previousCount + 5, teams.length)
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
                  Showing {Math.min(visibleTeamsCount, teams.length)} of{' '}
                  {teams.length} teams
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

                <span className={`status ${getStatusClass(task.status)}`}>
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
