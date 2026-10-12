
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'

const API_ROOT = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '')

const API_URL = API_ROOT.endsWith('/api')
  ? API_ROOT
  : `${API_ROOT}/api`

const BUCKET = 'profile-photos'

function Chat() {
  const [profile, setProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [avatarByEmail, setAvatarByEmail] = useState({})

  useEffect(() => {
    loadProfileAndTeams()
  }, [])

  async function getAuthHeaders(json = false) {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession()

    if (error) throw error

    if (!session?.access_token) {
      throw new Error('Your session has expired. Please log in again.')
    }

    return {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.access_token}`
    }
  }

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

      const { data: profileData, error: profileError } =
        await supabase
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
        role:
          profileData?.role ||
          user.user_metadata?.role ||
          'member'
      }

      setProfile(currentProfile)

      const { data: memberships, error: membershipError } =
        await supabase
          .from('team_members')
          .select('team_id, email, status')
          .ilike('email', email)
          .ilike('status', 'approved')

      if (membershipError) {
        throw new Error(
          'Unable to load memberships: ' +
          membershipError.message
        )
      }

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
        setAvatarByEmail({})
        return
      }

      const { data: teamData, error: teamsError } =
        await supabase
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

  // Load small profile avatars for the message senders.
  async function loadMessageAvatars(messageRows) {
    try {
      const emails = [
        ...new Set(
          (messageRows || [])
            .map(item => item.email || item.sender_email)
            .filter(Boolean)
            .map(email => email.trim().toLowerCase())
        )
      ]

      if (emails.length === 0) return

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('email, name, avatar_path, avatar_preset')
        .in('email', emails)

      if (error) {
        console.error('Unable to load chat avatars:', error.message)
        return
      }

      const avatarUpdates = {}

      for (const person of profiles || []) {
        if (!person.email) continue

        const key = person.email.toLowerCase()
        let photoUrl = ''

        if (person.avatar_path) {
          const { data, error: signedError } =
            await supabase.storage
              .from(BUCKET)
              .createSignedUrl(person.avatar_path, 3600)

          if (!signedError) {
            photoUrl = data?.signedUrl || ''
          } else {
            console.error(
              'Unable to sign profile photo:',
              signedError.message
            )
          }
        }

        avatarUpdates[key] = {
          name: person.name || '',
          photoUrl,
          preset: person.avatar_preset || ''
        }
      }

      setAvatarByEmail(previous => ({
        ...previous,
        ...avatarUpdates
      }))
    } catch (error) {
      console.error('Error loading message avatars:', error)
    }
  }

  async function loadMessages(teamId, emailOverride) {
    if (!teamId) return

    try {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser()

      if (error || !user?.email) {
        throw new Error('Please log in to view messages.')
      }

      const email = (
        emailOverride || user.email
      ).trim().toLowerCase()

      const params = new URLSearchParams({
        team_id: String(teamId),
        email
      })

      const headers = await getAuthHeaders()

      const response = await fetch(
        `${API_URL}/messages?${params.toString()}`,
        { headers }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
          `Unable to load messages (HTTP ${response.status}).`
        )
      }

      const rows = Array.isArray(data) ? data : []

      setMessages(rows)
      await loadMessageAvatars(rows)
    } catch (error) {
      console.error('Error loading messages:', error.message)
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

      const headers = await getAuthHeaders(true)

      const response = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sender: profile.name || profile.email,
          message: trimmedMessage,
          team_id: selectedTeam.id,
          email: profile.email
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
          `Unable to send message (HTTP ${response.status}).`
        )
      }

      const sentMessage = {
        ...data,
        sender: data.sender || profile.name,
        email: data.email || profile.email,
        message: data.message || trimmedMessage
      }

      setMessages(previousMessages => [
        ...previousMessages,
        sentMessage
      ])

      await loadMessageAvatars([sentMessage])
      setMessage('')
    } catch (error) {
      console.error('Error sending message:', error.message)
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

  function getSenderAvatar(item) {
    const email = (
      item.email ||
      item.sender_email ||
      ''
    ).trim().toLowerCase()

    const avatar = avatarByEmail[email]

    if (avatar?.photoUrl) {
      return (
        <img
          className="chat-sender-avatar-image"
          src={avatar.photoUrl}
          alt={`${item.sender || 'User'} profile`}
          onError={event => {
            event.currentTarget.style.display = 'none'
          }}
        />
      )
    }

    const emoji = avatar?.preset

    const initials = (
      item.sender ||
      avatar?.name ||
      email.split('@')[0] ||
      'U'
    ).trim().charAt(0).toUpperCase()

    return (
      <span className="chat-sender-avatar-fallback">
        {emoji || initials || 'U'}
      </span>
    )
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
              <p>No approved team memberships were found for:</p>
              <strong>{profile?.email || 'your account'}</strong>
              <p>
                Check that your email matches the email in
                the team_members table and that your membership
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
            <div className="chat-heading">
              <h2>💻 {selectedTeam.name} Chat</h2>

              <button
                type="button"
                onClick={refreshMessages}
              >
                Refresh
              </button>
            </div>

            <div className="chat-message-list">
              {messages.length === 0 ? (
                <p>No messages yet. Start the conversation!</p>
              ) : (
                messages.map((item, index) => (
                  <div
                    className="chat-message-row"
                    key={item.id ?? `${item.sender}-${index}`}
                  >
                    <div className="chat-sender-avatar">
                      {getSenderAvatar(item)}
                    </div>

                    <div className="chat-message-content">
                      <strong>{item.sender || 'User'}</strong>

                      <p>{item.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              className="chat-message-form"
              onSubmit={sendMessage}
            >
              <input
                type="text"
                placeholder="Type your message..."
                value={message}
                onChange={event => setMessage(event.target.value)}
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
