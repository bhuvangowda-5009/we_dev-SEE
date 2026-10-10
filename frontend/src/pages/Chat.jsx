
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'
const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`

function Chat() {
  const [profile, setProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadProfileAndTeams()
  }, [])

  async function loadProfileAndTeams() {
    try {
      setLoading(true)

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user?.email) {
        throw new Error('Please log in to access team chat.')
      }

      const email = user.email.trim().toLowerCase()

      console.log('Logged-in email:', email)

      // Load the user's profile.
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, role, user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) {
        throw new Error(
          'Unable to load profile: ' + profileError.message
        )
      }

      const currentProfile = {
        id: profileData?.id ?? null,
        user_id: user.id,
        name:
          profileData?.name ||
          user.user_metadata?.name ||
          email.split('@')[0],
        email,
        role: profileData?.role || user.user_metadata?.role || 'member'
      }

      setProfile(currentProfile)

      // Load approved memberships.
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id, email, status')
        .ilike('email', email)
        .ilike('status', 'approved')

      if (membershipError) {
        throw new Error(
          'Unable to load memberships: ' + membershipError.message
        )
      }

      console.log('Approved memberships:', memberships)

      const teamIds = [
        ...new Set(
          (memberships || [])
            .map(member => member.team_id)
            .filter(id => id !== null && id !== undefined)
        )
      ]

      if (teamIds.length === 0) {
        setTeams([])
        setSelectedTeam(null)
        setMessages([])
        return
      }

      // Load the teams the user belongs to.
      const { data: teamData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('id', { ascending: true })

      if (teamsError) {
        throw new Error(
          'Unable to load teams: ' + teamsError.message
        )
      }

      const availableTeams = teamData || []

      console.log('Available teams:', availableTeams)

      setTeams(availableTeams)

      if (availableTeams.length > 0) {
        setSelectedTeam(availableTeams[0])
        await loadMessages(availableTeams[0].id, email)
      } else {
        setSelectedTeam(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Error loading profile and teams:', error)
      alert(error.message || 'Unable to load your teams.')
      setTeams([])
      setSelectedTeam(null)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(teamId, emailOverride) {
    if (!teamId) return

    try {
      let email = emailOverride

      if (!email) {
        const {
          data: { user },
          error
        } = await supabase.auth.getUser()

        if (error || !user?.email) {
          throw new Error('Please log in to view messages.')
        }

        email = user.email.trim().toLowerCase()
      }

      const params = new URLSearchParams({
        team_id: String(teamId),
        email
      })

      const response = await fetch(
        `${API_URL}/messages?${params.toString()}`
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load messages.')
      }

      setMessages(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessages([])
    }
  }

  async function handleTeamChange(event) {
    const teamId = Number(event.target.value)

    const team = teams.find(
      item => Number(item.id) === teamId
    )

    if (!team) return

    setSelectedTeam(team)
    setMessages([])

    await loadMessages(team.id, profile?.email)
  }

  async function sendMessage(event) {
    event.preventDefault()

    const trimmedMessage = message.trim()

    if (!trimmedMessage || !selectedTeam || !profile?.email) {
      return
    }

    try {
      setSending(true)

      const response = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: profile.name || profile.email,
          message: trimmedMessage,
          team_id: selectedTeam.id,
          email: profile.email
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to send message.')
      }

      setMessages(previousMessages => [
        ...previousMessages,
        data
      ])

      setMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Unable to send message: ' + error.message)
    } finally {
      setSending(false)
    }
  }

  async function refreshMessages() {
    if (selectedTeam && profile?.email) {
      await loadMessages(selectedTeam.id, profile.email)
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1>Messages</h1>
            <p>Communicate with your team.</p>
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Select Team</h3>

          {loading ? (
            <p>Loading teams...</p>
          ) : teams.length === 0 ? (
            <div>
              <p>
                No approved team memberships were found for:
              </p>

              <strong>{profile?.email || 'your account'}</strong>

              <p>
                Check that this email matches the email in
                the team_members table and that the membership
                status is approved.
              </p>

              <button
                type="button"
                onClick={loadProfileAndTeams}
              >
                Try Again
              </button>
            </div>
          ) : (
            <select
              value={selectedTeam?.id ?? ''}
              onChange={handleTeamChange}
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedTeam && (
          <div className="dashboard-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '15px'
              }}
            >
              <h2 style={{ margin: 0 }}>
                💻 {selectedTeam.name} Chat
              </h2>

              <button
                type="button"
                onClick={refreshMessages}
              >
                Refresh
              </button>
            </div>

            <div
              style={{
                height: '400px',
                overflowY: 'auto',
                marginBottom: '15px',
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                background: '#fafafa',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxSizing: 'border-box'
              }}
            >
              {messages.length === 0 ? (
                <p>No messages yet. Start the conversation!</p>
              ) : (
                messages.map((item, index) => (
                  <div
                    key={item.id ?? `${item.sender}-${index}`}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#f0f0f0',
                      flexShrink: 0
                    }}
                  >
                    <strong>{item.sender}</strong>

                    <p
                      style={{
                        margin: '5px 0 0',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {item.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={sendMessage}
              style={{
                display: 'flex',
                gap: '10px',
                width: '100%'
              }}
            >
              <input
                type="text"
                placeholder="Type your message..."
                value={message}
                onChange={event => setMessage(event.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0
                }}
                disabled={sending}
              />

              <button
                type="submit"
                disabled={sending || !message.trim()}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

export default Chat
