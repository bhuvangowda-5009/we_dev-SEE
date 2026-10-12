
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
  const [userAvatar, setUserAvatar] = useState('')
  const [userAvatarPreset, setUserAvatarPreset] = useState('')
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [visibleTeamsCount, setVisibleTeamsCount] = useState(5)

  const [adminTeams, setAdminTeams] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [showApprovals, setShowApprovals] = useState(false)
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [actingOnRequest, setActingOnRequest] = useState(null)
  const [notification, setNotification] = useState('')
  const [approvalError, setApprovalError] = useState('')

  const previousRequestIds = useRef(null)
  const approvalRequestRunning = useRef(false)

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
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(
        data.error || `Request failed: HTTP ${response.status}`
      )
    }

    return data
  }, [getAccessToken])

  // Load the logged-in user's name and profile avatar.
  const loadUser = useCallback(async () => {
    try {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser()

      if (error) throw error

      if (!user) return

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name, avatar_path, avatar_preset')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) throw profileError

      const name =
        profile?.name ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'User'

      setUserName(name)
      setUserAvatarPreset(profile?.avatar_preset || '')
      setUserAvatar('')
      setAvatarFailed(false)

      if (profile?.avatar_path) {
        const { data, error: imageError } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(profile.avatar_path, 3600)

        if (imageError) throw imageError

        setUserAvatar(data?.signedUrl || '')
      }
    } catch (error) {
      console.error('Error loading user profile:', error.message)
    }
  }, [])

  const loadMessageCount = useCallback(async () => {
    try {
      const token = await getAccessToken()

      const response = await fetch(`${API_URL}/messages/count`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Unable to load message count.')
      }

      const data = await response.json()
      setMessageCount(Number(data.count) || 0)
    } catch (error) {
      console.error('Message count error:', error.message)
    }
  }, [getAccessToken])

  const loadDashboard = useCallback(async () => {
    setLoading(true)

    try {
      const token = await getAccessToken()

      const headers = {
        Authorization: `Bearer ${token}`
      }

      const [
        teamsResponse,
        tasksResponse,
        messagesResponse,
        filesResponse
      ] = await Promise.all([
        fetch(`${API_URL}/teams`, { headers }),
        fetch(`${API_URL}/tasks`, { headers }),
        fetch(`${API_URL}/messages/count`, { headers }),
        fetch(`${API_URL}/files/count`, { headers })
      ])

      if (!teamsResponse.ok) {
        throw new Error(
          `Failed to load teams: HTTP ${teamsResponse.status}`
        )
      }

      if (!tasksResponse.ok) {
        throw new Error(
          `Failed to load tasks: HTTP ${tasksResponse.status}`
        )
      }

      if (!messagesResponse.ok) {
        throw new Error(
          `Failed to load messages: HTTP ${messagesResponse.status}`
        )
      }

      if (!filesResponse.ok) {
        const errorData = await filesResponse.json().catch(() => ({}))

        throw new Error(
          errorData.error ||
          `Unable to load file count: HTTP ${filesResponse.status}`
        )
      }

      const teamsData = await teamsResponse.json()
      const tasksData = await tasksResponse.json()
      const messagesData = await messagesResponse.json()
      const filesData = await filesResponse.json()

      if (!Array.isArray(teamsData)) {
        throw new Error('Teams API did not return an array.')
      }

      if (!Array.isArray(tasksData)) {
        throw new Error('Tasks API did not return an array.')
      }

      setTeams(teamsData)
      setTasks(tasksData)
      setMessageCount(Number(messagesData.count) || 0)
      setFileCount(Number(filesData.count) || 0)
    } catch (error) {
      console.error('Error loading dashboard:', error.message)
    } finally {
      setLoading(false)
    }
  }, [getAccessToken])

  const loadApprovals = useCallback(async () => {
    if (approvalRequestRunning.current) return

    approvalRequestRunning.current = true
    setApprovalsLoading(true)

    try {
      const token = await getAccessToken()

      const headers = {
        Authorization: `Bearer ${token}`
      }

      const teamsResponse = await fetch(`${API_URL}/teams`, { headers })

      if (teamsResponse.status === 401) {
        throw new Error('Your session has expired. Please log in again.')
      }

      if (!teamsResponse.ok) {
        throw new Error(
          `Unable to load teams for approvals: HTTP ${teamsResponse.status}`
        )
      }

      const allTeams = await teamsResponse.json()

      if (!Array.isArray(allTeams)) {
        throw new Error('Teams API did not return an array.')
      }

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError) throw userError

      const manageableTeams = allTeams.filter(team => {
        const explicitlyAdmin =
          team.is_admin === true ||
          team.isAdmin === true ||
          team.can_manage_requests === true

        const creatorMatches =
          team.created_by &&
          user?.id &&
          String(team.created_by).toLowerCase() ===
            String(user.id).toLowerCase()

        return explicitlyAdmin || Boolean(creatorMatches)
      })

      setAdminTeams(manageableTeams)

      if (manageableTeams.length === 0) {
        setPendingRequests([])
        previousRequestIds.current = new Set()
        setApprovalError('')
        return
      }

      const results = await Promise.all(
        manageableTeams.map(async team => {
          const response = await fetch(
            `${API_URL}/teams/${team.id}/join-requests`,
            { headers }
          )

          if (response.status === 401) {
            throw new Error(
              'Your session has expired. Please log in again.'
            )
          }

          if (response.status === 403) {
            console.warn(
              `Backend denied approval access for team "${team.name}".`
            )

            return { team, requests: [], forbidden: true }
          }

          if (!response.ok) {
            console.error(
              `Could not load join requests for "${team.name}":`,
              response.status
            )

            return { team, requests: [], forbidden: false }
          }

          const data = await response.json()

          const requests = Array.isArray(data)
            ? data
            : Array.isArray(data.requests)
              ? data.requests
              : []

          return {
            team,
            forbidden: false,
            requests: requests.map(request => ({
              ...request,
              team_id: team.id,
              team_name: team.name
            }))
          }
        })
      )

      const authorizedResults = results.filter(
        result => !result.forbidden
      )

      setAdminTeams(authorizedResults.map(result => result.team))

      const allPending = authorizedResults.flatMap(result =>
        result.requests.filter(
          request => !request.status || request.status === 'pending'
        )
      )

      const newIds = new Set(
        allPending.map(request => String(request.id))
      )

      if (previousRequestIds.current !== null) {
        const newlyArrived = allPending.filter(
          request =>
            !previousRequestIds.current.has(String(request.id))
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
      setPendingRequests(allPending)
      setApprovalError('')
    } catch (error) {
      console.error('Error loading approvals:', error.message)
      setApprovalError(error.message)
    } finally {
      approvalRequestRunning.current = false
      setApprovalsLoading(false)
    }
  }, [getAccessToken])

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
          ? `Approved ${
              request.email ||
              request.user_email ||
              'the user'
            } for ${request.team_name}.`
          : `Rejected the join request for ${request.team_name}.`
      )

      await Promise.all([loadApprovals(), loadDashboard()])
    } catch (error) {
      console.error('Approval action failed:', error.message)
      setApprovalError(error.message)
    } finally {
      setActingOnRequest(null)
    }
  }

  useEffect(() => {
    loadUser()
    loadDashboard()
    loadApprovals()
    loadMessageCount()

    // Keep the dashboard avatar in sync with profile edits.
    const handleProfileUpdated = () => loadUser()

    window.addEventListener('profile-updated', handleProfileUpdated)

    const approvalInterval = setInterval(loadApprovals, 15000)

    const channel = supabase
      .channel('dashboard-messages-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        loadMessageCount
      )
      .subscribe()

    return () => {
      clearInterval(approvalInterval)
      window.removeEventListener(
        'profile-updated',
        handleProfileUpdated
      )
      supabase.removeChannel(channel)
    }
  }, [loadUser, loadDashboard, loadApprovals, loadMessageCount])

  const activeTasks = tasks.filter(
    task => task.status === 'todo' || task.status === 'in_progress'
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
        <div className="dashboard-greeting">
          <div className="dashboard-user-avatar">
            {userAvatar && !avatarFailed ? (
              <img
                src={userAvatar}
                alt={`${userName}'s profile`}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span>
                {userAvatarPreset || userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <h1>Good morning, {userName} 👋</h1>
            <p>Here's what's happening with your teams today.</p>
          </div>
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
              loadUser()
            }}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </header>

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

      {showApprovals && adminTeams.length > 0 && (
        <section className="dashboard-card" style={{ marginBottom: 24 }}>
          <div className="card-title">
            <div>
              <h2>Team Join Requests</h2>
              <p>Review requests for teams you administer.</p>
            </div>

            <button
              type="button"
              onClick={loadApprovals}
              disabled={approvalsLoading}
            >
              {approvalsLoading ? 'Loading...' : '↻ Refresh requests'}
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

      <section className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-title">
            <div>
              <h2>My Teams</h2>
              <p className="teams-count">{teams.length} teams in total</p>
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
                      setVisibleTeamsCount(previous =>
                        Math.min(previous + 5, teams.length)
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
