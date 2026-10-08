
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'

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

  const loadProfileAndTeams = async () => {
    try {
      setLoading(true)

      // Get logged-in user
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        console.log('User not found:', userError)
        setLoading(false)
        return
      }

      // Get profile of logged-in user
      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select('*')
          .eq('email', user.email)
          .single()

      if (profileError) {
        console.log('Profile error:', profileError)
        setLoading(false)
        return
      }

      setProfile(profileData)

      // Get teams of logged-in user
      const {
        data: teamMembers,
        error: teamMemberError
      } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('email', user.email)

      if (teamMemberError) {
        console.log(
          'Error loading team memberships:',
          teamMemberError
        )
      }

      let teamData = []

      if (teamMembers && teamMembers.length > 0) {
        const teamIds = teamMembers.map(
          (member) => member.team_id
        )

        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .in('id', teamIds)
          .order('id', {
            ascending: true
          })

        if (error) {
          console.log(
            'Error loading teams:',
            error
          )
        } else {
          teamData = data || []
        }
      }

      // If no team membership found,
      // show all teams
      if (teamData.length === 0) {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .order('id', {
            ascending: true
          })

        if (error) {
          console.log(
            'Error loading all teams:',
            error
          )
        } else {
          teamData = data || []
        }
      }

      setTeams(teamData)

      if (teamData.length > 0) {
        setSelectedTeam(teamData[0])
        await loadMessages(teamData[0].id)
      }

    } catch (error) {
      console.log(
        'Unexpected error:',
        error
      )
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (teamId) => {
    if (!teamId) {
      return
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/messages?team_id=${teamId}`
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to load messages'
        )
      }

      setMessages(data)

    } catch (error) {
      console.log(
        'Error loading messages:',
        error
      )
    }
  }

  const handleTeamChange = async (e) => {
    const teamId = Number(e.target.value)

    const team = teams.find(
      (item) => item.id === teamId
    )

    if (!team) {
      return
    }

    setSelectedTeam(team)

    await loadMessages(team.id)
  }

  const sendMessage = async (e) => {
    e.preventDefault()

    if (
      !message.trim() ||
      !selectedTeam ||
      !profile
    ) {
      return
    }

    try {
      setSending(true)

      const response = await fetch(
        'http://localhost:5000/api/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: profile.name,
            message: message.trim(),
            team_id: selectedTeam.id,
            email: profile.email
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to send message'
        )
      }

      setMessages((previousMessages) => [
        ...previousMessages,
        data
      ])

      setMessage('')

    } catch (error) {
      console.log(
        'Error sending message:',
        error
      )

      alert(
        'Unable to send message: ' +
        error.message
      )
    } finally {
      setSending(false)
    }
  }

  const refreshMessages = async () => {
    if (selectedTeam) {
      await loadMessages(selectedTeam.id)
    }
  }

  return (
    <div className="dashboard-layout">

      <Sidebar />

      <main className="dashboard-content">

        <div className="dashboard-header">

          <div>
            <h1>Messages</h1>

            <p>
              Communicate with your team.
            </p>
          </div>

        </div>

        {/* SELECT TEAM */}

        <div className="dashboard-card">

          <h3>Select Team</h3>

          {loading ? (
            <p>Loading teams...</p>
          ) : teams.length === 0 ? (
            <p>No teams available.</p>
          ) : (
            <select
              value={
                selectedTeam
                  ? selectedTeam.id
                  : ''
              }
              onChange={handleTeamChange}
            >
              {teams.map((team) => (
                <option
                  key={team.id}
                  value={team.id}
                >
                  {team.name}
                </option>
              ))}
            </select>
          )}

        </div>

        {/* CHAT */}

        {selectedTeam && (

          <div className="dashboard-card">

            {/* CHAT HEADER */}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
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

            {/* MESSAGES AREA */}

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

                <p>
                  No messages yet. Start the
                  conversation!
                </p>

              ) : (

                messages.map((item) => (

                  <div
                    key={item.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#f0f0f0',
                      flexShrink: 0
                    }}
                  >

                    <strong>
                      {item.sender}
                    </strong>

                    <p
                      style={{
                        margin: '5px 0 0 0',
                        wordBreak: 'break-word'
                      }}
                    >
                      {item.message}
                    </p>

                  </div>

                ))

              )}

            </div>

            {/* MESSAGE INPUT */}

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
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                style={{
                  flex: 1,
                  minWidth: 0
                }}
              />

              <button
                type="submit"
                disabled={sending}
              >
                {sending
                  ? 'Sending...'
                  : 'Send'}
              </button>

            </form>

          </div>

        )}

      </main>

    </div>
  )
}

export default Chat
