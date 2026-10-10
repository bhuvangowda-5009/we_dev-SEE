
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'
import '../css/teams.css'

const API_URL = 'http://localhost:5000/api'

function Team() {
  const [teams, setTeams] = useState([])
  const [profiles, setProfiles] = useState([])
  const [teamName, setTeamName] = useState('')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [members, setMembers] = useState({})
  const [joinCode, setJoinCode] = useState('')
  const [expandedTeam, setExpandedTeam] = useState(null)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [searching, setSearching] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [createdCode, setCreatedCode] = useState('')

  useEffect(() => {
    initialize()
  }, [])

  async function initialize() {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error || !user) {
      alert('Please log in first.')
      return
    }

    setCurrentUser(user)
    await loadTeams()
  }

  async function getAccessToken() {
    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('Your session has expired. Please log in again.')
    }

    return session.access_token
  }

  async function loadTeams() {
    try {
      const response = await fetch(`${API_URL}/teams`)

      if (!response.ok) {
        throw new Error('Unable to load teams.')
      }

      const data = await response.json()
      setTeams(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Load teams error:', error)
      alert(error.message)
    }
  }

  async function loadProfiles() {
    if (!search.trim()) {
      alert('Enter a name or email to search.')
      return
    }

    setSearching(true)

    try {
      const token = await getAccessToken()

      const response = await fetch(
        `${API_URL}/users/search?q=${encodeURIComponent(search.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to search registered users.')
      }

      setProfiles(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Search users error:', error)
      setProfiles([])
      alert(error.message)
    } finally {
      setSearching(false)
    }
  }

  function toggleMember(profile) {
    setSelectedMembers(previous => {
      const exists = previous.some(
        item => item.user_id === profile.user_id
      )

      return exists
        ? previous.filter(item => item.user_id !== profile.user_id)
        : [...previous, profile]
    })
  }

  async function createTeam() {
    if (!teamName.trim()) {
      alert('Enter a team name.')
      return
    }

    if (!currentUser) {
      alert('Please log in again.')
      return
    }

    setLoading(true)

    try {
      const token = await getAccessToken()

      const response = await fetch(`${API_URL}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: teamName.trim(),
          description: description.trim(),
          member_user_ids: selectedMembers.map(member => member.user_id)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create team.')
      }

      setTeamName('')
      setDescription('')
      setSelectedMembers([])
      setSearch('')
      setProfiles([])
      setCreatedCode(data.join_code || '')

      await loadTeams()

      alert(
        data.join_code
          ? `Team created! Join code: ${data.join_code}`
          : 'Team created successfully.'
      )
    } catch (error) {
      console.error('Create team error:', error)
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function joinUsingCode() {
    if (!joinCode.trim()) {
      alert('Enter a team join code.')
      return
    }

    setJoining(true)

    try {
      const token = await getAccessToken()

      const response = await fetch(`${API_URL}/teams/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: joinCode.trim().toUpperCase()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to request team membership.')
      }

      setJoinCode('')
      alert(data.message || 'Join request submitted.')
      await loadTeams()
    } catch (error) {
      console.error('Join team error:', error)
      alert(error.message)
    } finally {
      setJoining(false)
    }
  }

  async function loadMembers(teamId) {
    try {
      const token = await getAccessToken()

      const response = await fetch(
        `${API_URL}/teams/${teamId}/members`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load team members.')
      }

      setMembers(previous => ({
        ...previous,
        [teamId]: Array.isArray(data) ? data : []
      }))

      setExpandedTeam(teamId)
    } catch (error) {
      console.error('Load members error:', error)
      alert(error.message)
    }
  }

  async function toggleMembers(teamId) {
    if (expandedTeam === teamId) {
      setExpandedTeam(null)
    } else {
      await loadMembers(teamId)
    }
  }

  function getTeamIcon(team) {
    if (team.icon) return team.icon

    const name = (team.name || '').toLowerCase()

    if (name.includes('develop') || name.includes('code')) return '💻'
    if (name.includes('design')) return '🎨'
    if (name.includes('market')) return '📢'
    if (name.includes('test') || name.includes('qa')) return '🧪'
    if (name.includes('data')) return '📊'
    if (name.includes('project')) return '📋'

    return '👥'
  }

  return (
    <div className="dashboard teams-page">
      <Sidebar />

      <main className="dashboard-content teams-content">
        <header className="dashboard-header teams-header">
          <div>
            <span className="teams-eyebrow">
              TEAM WORKSPACE
            </span>

            <h1>Teams</h1>

            <p>
              Bring people together, organize projects, and collaborate.
            </p>
          </div>

          <button
            type="button"
            className="teams-refresh"
            onClick={loadTeams}
          >
            ↻ Refresh
          </button>
        </header>

        <div className="teams-workspace">
          {/* CREATE TEAM */}
          <section className="dashboard-card teams-panel create-team-panel">
            <div className="teams-section-heading">
              <div className="teams-heading-icon purple-icon">
                ＋
              </div>

              <div>
                <h2>Create a team</h2>
                <p>Start a workspace and invite your teammates.</p>
              </div>
            </div>

            <div className="teams-form">
              <div className="teams-field">
                <label htmlFor="team-name">Team name</label>

                <input
                  id="team-name"
                  type="text"
                  value={teamName}
                  onChange={event => setTeamName(event.target.value)}
                  placeholder="e.g. Web Development Team"
                  maxLength={100}
                />
              </div>

              <div className="teams-field">
                <label htmlFor="team-description">
                  Description <span>(optional)</span>
                </label>

                <textarea
                  id="team-description"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder="What will your team work on?"
                  rows={3}
                />
              </div>

              <div className="teams-field">
                <label htmlFor="user-search">
                  Add existing users
                </label>

                <div className="teams-search-row">
                  <input
                    id="user-search"
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        loadProfiles()
                      }
                    }}
                    placeholder="Search by name or email"
                  />

                  <button
                    type="button"
                    className="teams-secondary-button"
                    onClick={loadProfiles}
                    disabled={searching}
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {profiles.length > 0 && (
                <div className="teams-user-list">
                  {profiles
                    .filter(profile => profile.user_id !== currentUser?.id)
                    .map(profile => (
                      <label
                        className="teams-user-option"
                        key={profile.user_id}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.some(
                            item => item.user_id === profile.user_id
                          )}
                          onChange={() => toggleMember(profile)}
                        />

                        <span className="teams-avatar">
                          {(profile.name || profile.email || '?')
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <span className="teams-user-info">
                          <strong>{profile.name || 'User'}</strong>
                          <small>{profile.email}</small>
                        </span>

                        <span className="teams-select-label">
                          {selectedMembers.some(
                            item => item.user_id === profile.user_id
                          ) ? 'Selected' : 'Add'}
                        </span>
                      </label>
                    ))}
                </div>
              )}

              {search && profiles.length === 0 && !searching && (
                <p className="teams-empty-search">
                  No users found yet. Select Search to look for registered users.
                </p>
              )}

              {selectedMembers.length > 0 && (
                <p className="teams-selected-count">
                  ✓ {selectedMembers.length} teammate(s) selected
                </p>
              )}

              <button
                type="button"
                className="teams-primary-button"
                onClick={createTeam}
                disabled={loading}
              >
                {loading ? 'Creating team...' : '+ Create Team'}
              </button>

              {createdCode && (
                <div className="teams-created-code">
                  <span>Your latest team join code</span>
                  <strong>{createdCode}</strong>
                </div>
              )}
            </div>
          </section>

          {/* JOIN TEAM */}
          <section className="dashboard-card teams-panel join-team-panel">
            <div className="teams-section-heading">
              <div className="teams-heading-icon teal-icon">
                ↗
              </div>

              <div>
                <h2>Join a team</h2>
                <p>Have an invitation code? Join a workspace.</p>
              </div>
            </div>

            <div className="teams-field">
              <label htmlFor="join-code">Invitation code</label>

              <input
                id="join-code"
                type="text"
                value={joinCode}
                onChange={event =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                onKeyDown={event => {
                  if (event.key === 'Enter') joinUsingCode()
                }}
                placeholder="Enter your team code"
                maxLength={20}
              />
            </div>

            <button
              type="button"
              className="teams-join-button"
              onClick={joinUsingCode}
              disabled={joining}
            >
              {joining ? 'Submitting request...' : 'Join Using Code →'}
            </button>

            <div className="teams-info-note">
              <span>🔒</span>
              <p>
                If approval is required, the team administrator will review
                your request.
              </p>
            </div>
          </section>
        </div>

        {/* MY TEAMS */}
        <section className="teams-list-section">
          <div className="teams-list-heading">
            <div>
              <span className="teams-eyebrow">YOUR WORKSPACES</span>
              <h2>My Teams</h2>
              <p>
                Explore team workspaces and see who's collaborating.
              </p>
            </div>

            <span className="teams-count">
              {teams.length} {teams.length === 1 ? 'team' : 'teams'}
            </span>
          </div>

          {teams.length === 0 ? (
            <div className="teams-empty-state">
              <div className="teams-empty-icon">👥</div>
              <h3>No teams to display</h3>
              <p>Create a team or join one using an invitation code.</p>
            </div>
          ) : (
            <div className="teams-grid">
              {teams.map((team, index) => (
                <article className="teams-team-card" key={team.id}>
                  <div className={`teams-team-icon teams-color-${index % 6}`}>
                    {getTeamIcon(team)}
                  </div>

                  <div className="teams-team-details">
                    <h3>{team.name}</h3>
                    <p>{team.description || 'No description added yet.'}</p>
                  </div>

                  <div className="teams-team-card-footer">
                    <span className="teams-workspace-label">
                      <span className="teams-status-dot" />
                      Workspace
                    </span>

                    <button
                      type="button"
                      className="teams-view-button"
                      onClick={() => toggleMembers(team.id)}
                    >
                      {expandedTeam === team.id
                        ? 'Hide members ↑'
                        : 'View members →'}
                    </button>
                  </div>

                  {expandedTeam === team.id && (
                    <div className="teams-members-panel">
                      <h4>Team members</h4>

                      {(members[team.id] || []).length === 0 ? (
                        <p className="teams-no-members">
                          No members found.
                        </p>
                      ) : (
                        members[team.id].map((member, memberIndex) => (
                          <div
                            className="teams-member-row"
                            key={member.id || member.email || memberIndex}
                          >
                            <span className="teams-avatar">
                              {(member.name || member.email || '?')
                                .charAt(0)
                                .toUpperCase()}
                            </span>

                            <div className="teams-user-info">
                              <strong>{member.name || 'Team member'}</strong>
                              <small>{member.email}</small>
                              <small className="teams-member-role">
                                {member.role || 'Member'}
                                {member.status ? ` · ${member.status}` : ''}
                              </small>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default Team
