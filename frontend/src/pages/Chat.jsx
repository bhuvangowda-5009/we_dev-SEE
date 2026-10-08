
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'

function Chat() {

  const [messages, setMessages] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)

  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState(null)

  const [loading, setLoading] = useState(false)


  // ==================== LOAD PROFILE ====================

  const loadProfile = async () => {

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)
      .single()

    if (error) {

      console.log(
        'Error loading profile:',
        error
      )

      return
    }

    setProfile(data)

  }


  // ==================== LOAD TEAMS ====================

  const loadTeams = async () => {

    const { data: profileData, error: profileError } =
      await supabase
        .from('profiles')
        .select('*')
        .limit(1)
        .single()

    if (profileError) {

      console.log(
        'Error loading profile:',
        profileError
      )

      return
    }


    const { data: memberData, error: memberError } =
      await supabase
        .from('team_members')
        .select('team_id')
        .eq('email', profileData.email)

    if (memberError) {

      console.log(
        'Error loading team membership:',
        memberError
      )

      return
    }


    if (!memberData || memberData.length === 0) {

      setTeams([])

      return
    }


    const teamIds =
      memberData.map(member => member.team_id)


    const { data: teamData, error: teamError } =
      await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('id')


    if (teamError) {

      console.log(
        'Error loading teams:',
        teamError
      )

      return
    }


    setTeams(teamData || [])


    if (teamData && teamData.length > 0) {

      setSelectedTeam(teamData[0])

    }

  }


  // ==================== LOAD MESSAGES ====================

  const loadMessages = async (teamId) => {

    if (!teamId) {

      setMessages([])

      return
    }


    setLoading(true)


    try {

      const response =
        await fetch(
          `http://localhost:5000/api/messages?team_id=${teamId}`
        )


      if (!response.ok) {

        throw new Error(
          'Unable to load messages'
        )

      }


      const data =
        await response.json()


      setMessages(data)

    } catch (error) {

      console.log(
        'Error loading messages:',
        error
      )

      setMessages([])

    } finally {

      setLoading(false)

    }

  }


  // ==================== PAGE LOAD ====================

  useEffect(() => {

    loadProfile()
    loadTeams()

  }, [])


  // ==================== TEAM CHANGE ====================

  useEffect(() => {

    if (selectedTeam) {

      loadMessages(selectedTeam.id)

    }

  }, [selectedTeam])


  // ==================== SEND MESSAGE ====================

  const sendMessage = async (e) => {

    e.preventDefault()


    if (!message.trim()) {

      return

    }


    if (!selectedTeam) {

      alert(
        'Please select a team first'
      )

      return

    }


    if (!profile) {

      alert(
        'Profile not loaded'
      )

      return

    }


    try {

      const response =
        await fetch(
          'http://localhost:5000/api/messages',
          {

            method: 'POST',

            headers: {
              'Content-Type': 'application/json'
            },

            body: JSON.stringify({

              sender: profile.name,

              message: message,

              team_id: selectedTeam.id,

              email: profile.email

            })

          }
        )


      if (!response.ok) {

        const errorData =
          await response.json()

        throw new Error(
          errorData.error ||
          'Unable to send message'
        )

      }


      const data =
        await response.json()


      setMessages(previous => [
        ...previous,
        data
      ])


      setMessage('')

    } catch (error) {

      console.log(
        'Error sending message:',
        error
      )

      alert(error.message)

    }

  }


  // ==================== PAGE ====================

  return (

    <div className="dashboard">

      <Sidebar />

      <main className="dashboard-content">


        {/* ==================== HEADER ==================== */}

        <header className="dashboard-header">

          <div>

            <h1>
              Messages
            </h1>

            <p>
              Communicate with your team.
            </p>

          </div>

        </header>


        {/* ==================== TEAM SELECTOR ==================== */}

        <section className="dashboard-card">

          <div className="card-title">

            <h2>
              Select Team
            </h2>

          </div>


          {teams.length === 0 ? (

            <p>
              You are not a member of any team.
            </p>

          ) : (

            <select
              value={selectedTeam?.id || ''}
              onChange={(e) => {

                const team =
                  teams.find(
                    item =>
                      item.id === Number(e.target.value)
                  )

                setSelectedTeam(team)

              }}
            >

              {teams.map(team => (

                <option
                  key={team.id}
                  value={team.id}
                >

                  {team.icon || '👥'} {team.name}

                </option>

              ))}

            </select>

          )}

        </section>


        {/* ==================== CHAT ==================== */}

        {selectedTeam && (

          <section className="dashboard-card">

            <div className="card-title">

              <h2>
                {selectedTeam.icon || '👥'}{' '}
                {selectedTeam.name} Chat
              </h2>

              <button
                onClick={() =>
                  loadMessages(selectedTeam.id)
                }
                disabled={loading}
              >

                {loading
                  ? 'Refreshing...'
                  : 'Refresh'}

              </button>

            </div>


            <div className="chat-messages">

              {messages.length === 0 ? (

                <p>
                  No messages yet. Start the conversation!
                </p>

              ) : (

                messages.map(msg => (

                  <div
                    className="task-item"
                    key={msg.id}
                  >

                    <div>

                      <h3>
                        {msg.sender}
                      </h3>

                      <p>
                        {msg.message}
                      </p>

                    </div>

                  </div>

                ))

              )}

            </div>


            {/* ==================== SEND ==================== */}

            <form onSubmit={sendMessage}>

              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
              />

              <button
                className="create-button"
                type="submit"
              >
                Send
              </button>

            </form>

          </section>

        )}

      </main>

    </div>

  )
}

export default Chat
