
import { useEffect, useState, useCallback, useRef } from 'react'
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

  // Approval and notification state
  const [adminTeams, setAdminTeams] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [showApprovals, setShowApprovals] = useState(false)
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [actingOnRequest, setActingOnRequest] = useState(null)
  const [notification, setNotification] = useState('')
  const [approvalError, setApprovalError] = useState('')

  // Used to distinguish new requests from requests already present
  // when the Dashboard first loads.
  const previousRequestIds = useRef(null)

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession()

    if (error) throw error

    if (!session?.access_token) {
      throw new Error('Your session has expired. Please log in again.')
    }

    return session.access_token
  }, [])

  const apiFetch = useCallback(async (path, options = {}) => {
    const token = await getAccessToken()

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`)
    }

    return data
  }, [getAccessToken])

  // Load the logged-in user's name
  const loadUser = useCallback(async () => {
    try {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser()

      if (error) throw error

      if (user) {
        setUserName(
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'User'
        )
      }
    } catch (error) {
      console.error('Error loading user:', error.message)
    }
  }, [])

  // Load message count
  const loadMessageCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
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

  // Load teams, tasks, messages and files
  const loadDashboard = useCallback(async () => {
    setLoading(true)

    try {
      const headers = {
        Authorization: `Bearer ${await getAccessToken()}`
      }

      const teamsResponse = await fetch(`${API_URL}/teams`, { headers })

      if (!teamsResponse.ok) {
        throw new Error(`Failed to load teams: HTTP ${teamsResponse.status}`)
      }

      const teamsData = await teamsResponse.json()

      if (!Array.isArray(teamsData)) {
        throw new Error('Teams API did not return an array.')
      }

      setTeams(teamsData)

      const tasksResponse = await fetch(`${API_URL}/tasks`, { headers })

      if (!tasksResponse.ok) {
        throw new Error(`Failed to load tasks: HTTP ${tasksResponse.status}`)
      }

      const tasksData = await tasksResponse.json()

      if (!Array.isArray(tasksData)) {
        throw new Error('Tasks API did not return an array.')
      }

      setTasks(tasksData)

      const messagesResponse = await fetch(
        `${API_URL}/messages/count`,
        { headers }
      )

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        setMessageCount(messagesData.count ?? 0)
      } else {
        console.error('Unable to load message count.')
      }

      const { data: files, error: fileError } = await supabase.storage
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
  }, [getAccessToken])

  // Find which teams the current user administers and load their
  // pending join requests. Non-admin teams are ignored.
  const loadApprovals = useCallback(async () => {
    try {
      const token = await getAccessToken()
      const headers = {
        Authorization: `Bearer ${token}`
      }

      const teamsResponse = await fetch(`${API_URL}/teams`, { headers })

      if (!teamsResponse.ok) {
        throw new Error('Unable to check team approval requests.')
      }

      const allTeams = await teamsResponse.json()

      if (!Array.isArray(allTeams)) return

      const results = await Promise.all(
        allTeams.map(async team => {
          try {
            const response = await fetch(
              `${API_URL}/teams/${team.id}/join-requests`,
              { headers }
            )

            // The backend returns a forbidden response when the user
            // is not an admin of this team.
            if (response.status === 403) return null

            if (!response.ok) {
              console.error(
                `Could not load requests for ${team.name}:`,
                response.status
              )
              return null
            }

            const data = await response.json()
            const requests = Array.isArray(data)
              ? data
              : Array.isArray(data.requests)
                ? data.requests
                : []

            return {
              team,
              requests: requests.map(request => ({
                ...request,
                team_id: team.id,
                team_name: team.name
              }))
            }
          } catch (error) {
            console.error(
              `Error loading approvals for ${team.name}:`,
              error.message
            )
            return null
          }
        })
      )

      const validResults = results.filter(Boolean)
      const newAdminTeams = validResults.map(result => result.team)

      const allPending = validResults.flatMap(result =>
        result.requests.filter(request =>
          !request.status || request.status === 'pending'
        )
      )

      const newIds = new Set(
        allPending.map(request => String(request.id))
      )

      // Don't show a "new request" notification for requests that
      // were already pending when the page was first opened.
      if (previousRequestIds.current !== null) {
        const newlyArrived = allPending.filter(
          request => !previousRequestIds.current.has(String(request.id))
        )

        if (newlyArrived.length > 0) {
          const first = newlyArrived[0]

          setNotification(
            newlyArrived.length === 1
              ? `New join request for ${first.team_name}.`
              : `${newlyArrived.length} new team join requests received.`
          )
        }
      }

      previousRequestIds.current = newIds
      setAdminTeams(newAdminTeams)
      setPendingRequests(allPending)
      setApprovalError('')
    } catch (error) {
      console.error('Error loading approvals:', error.message)
      setApprovalError(error.message)
    }
  }, [getAccessToken])

  // Approve or reject a request using the existing backend route
  async function handleRequest(request, status) {
    const requestKey = String(request.id)

    setActingOnRequest(requestKey)
    setApprovalError('')

    try {
      await apiFetch(`/join-requests/${request.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })

      setPendingRequests(previous =>
        previous.filter(item => String(item.id) !== requestKey)
      )

      setNotification(
        status === 'approved'
          ? `Approved ${request.email || request.user_email || 'the user'} for ${request.team_name}.`
          : `Rejected the join request for ${request.team_name}.`
      )

      // Reload to get the authoritative backend state.
      await loadApprovals()
      await loadDashboard()
    } catch (error) {
      console.error('Approval action failed:', error.message)
      setApprovalError(error.message)
    } finally {
      setActingOnRequest(null)
    }
  }

  // Initial load and automatic notification polling
  useEffect(() => {
    loadUser()
    loadDashboard()
    loadApprovals()
    loadMessageCount()

    const approvalInterval = setInterval(() => {
      loadApprovals()
    }, 15000)

    const channel = supabase
      .channel('dashboard-messages-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadMessageCount()
        }
      )
      .subscribe()

    return () => {
      clearInterval(approvalInterval)
      supabase.removeChannel(channel)
    }
  }, [loadUser, loadDashboard, loadApprovals, loadMessageCount])

  const activeTasks = tasks.filter(
    task =>
      task.status === 'todo' ||
      task.status === 'in_progress'
  ).length

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

  const getRequesterName = request =>
    request.name ||
    request.user_name ||
    request.full_name ||
    request.email ||
    request.user_email ||
    'User'

  const getRequesterEmail = request =>
    request.email ||
    request.user_email ||
    request.requester_email ||
    ''

  return (
    <div className="dashboard-content">
      <header className="dashboard-header">
        <div>
          <h1>Good morning, {userName} 👋</h1>
          <p>Here's what's happening with your teams today.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {adminTeams.length > 0 && (
            <button
              type="button"
              className="create-button"
              onClick={() => {
                setShowApprovals(previous => !previous)
                setNotification('')
              }}
              style={{ position: 'relative' }}
            >
              🔔 Approvals
              {pendingRequests.length > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    padding: '3px 8px',
                    borderRadius: 20,
                    background: '#dc2626',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            className="create-button"
            onClick={() => {
              loadDashboard()
              loadApprovals()
            }}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </header>

      {/* In-app notification for admins */}
      {notification && adminTeams.length > 0 && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '14px 18px',
            borderRadius: 12,
            border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <span>🔔 {notification}</span>
          <button
            type="button"
            onClick={() => setNotification('')}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Admin-only approvals panel */}
      {showApprovals && adminTeams.length > 0 && (
        <section
          className="dashboard-card"
          style={{ marginBottom: 24 }}
        >
          <div className="card-title">
            <div>
              <h2>Team Join Requests</h2>
              <p>
                Review requests for teams you administer.
              </p>
            </div>

            <button
              type="button"
              onClick={loadApprovals}
              disabled={approvalsLoading}
            >
              ↻ Refresh requests
            </button>
          </div>

          {approvalError && (
            <p role="alert" style={{ color: '#dc2626' }}>
              {approvalError}
            </p>
          )}

          {pendingRequests.length === 0 ? (
            <p style={{ padding: '16px 0', color: '#64748b' }}>
              No pending join requests.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {pendingRequests.map(request => (
                <article
                  key={`${request.team_id}-${request.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                    padding: 16,
                    border: '1px solid #e2e8f0',
                    borderRadius: 12
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 5px' }}>
                      {getRequesterName(request)}
                    </h3>

                    <p style={{ margin: '0 0 5px', color: '#64748b' }}>
                      {getRequesterEmail(request)}
                    </p>

                    <small style={{ color: '#64748b' }}>
                      Requested to join: <strong>{request.team_name}</strong>
                    </small>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      disabled={actingOnRequest === String(request.id)}
                      onClick={() => handleRequest(request, 'approved')}
                      style={{
                        background: '#15803d',
                        color: '#fff',
                        border: 0,
                        borderRadius: 8,
                        padding: '10px 14px',
                        cursor: 'pointer'
                      }}
                    >
                      {actingOnRequest === String(request.id)
                        ? 'Processing...'
                        : '✓ Approve'}
                    </button>

                    <button
                      type="button"
                      disabled={actingOnRequest === String(request.id)}
                      onClick={() => handleRequest(request, 'rejected')}
                      style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 0,
                        borderRadius: 8,
                        padding: '10px 14px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

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

            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
            >
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

            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
            >
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
