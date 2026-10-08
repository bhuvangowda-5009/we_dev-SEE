import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'

function Team() {

  const [teams, setTeams] = useState([])
  const [teamName, setTeamName] = useState('')
  const [memberCount, setMemberCount] = useState(1)
  const [members, setMembers] = useState({})
  const [expandedTeam, setExpandedTeam] = useState(null)
  const [loading, setLoading] = useState(false)


  // ==================== LOAD TEAMS ====================

  const loadTeams = async () => {

    try {

      const response =
        await fetch('http://localhost:5000/api/teams')

      if (!response.ok) {
        throw new Error('Failed to load teams')
      }

      const data = await response.json()

      setTeams(data)

    } catch (error) {

      console.log('Error loading teams:', error)

      alert('Unable to load teams')

    }
  }


  // ==================== LOAD ON PAGE OPEN ====================

  useEffect(() => {

    loadTeams()

  }, [])


  // ==================== LOAD MEMBERS ====================

  const loadMembers = async (teamId) => {

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('id')

    if (error) {

      console.log('Error loading members:', error)

      alert('Unable to load members')

      return
    }

    setMembers(previous => ({
      ...previous,
      [teamId]: data
    }))

    setExpandedTeam(teamId)
  }


  // ==================== VIEW MEMBERS ====================

  const toggleMembers = async (teamId) => {

    if (expandedTeam === teamId) {

      setExpandedTeam(null)

      return
    }

    await loadMembers(teamId)
  }


  // ==================== CREATE TEAM ====================

  const createTeam = async () => {

    if (!teamName.trim()) {

      alert('Please enter a team name')

      return
    }

    if (memberCount < 1) {

      alert('Number of members must be at least 1')

      return
    }

    setLoading(true)

    try {

      // Get current profile

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('*')
          .limit(1)
          .single()

      if (profileError) {

        throw new Error('Unable to load your profile')

      }


      // Create team

      const response =
        await fetch('http://localhost:5000/api/teams', {

          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            name: teamName,
            members: Number(memberCount),
            icon: '👥'
          })

        })


      if (!response.ok) {

        throw new Error('Failed to create team')

      }


      const newTeam = await response.json()


      // Add current profile as first member

      const { error: memberError } =
        await supabase
          .from('team_members')
          .insert([
            {
              team_id: newTeam.id,
              name: profile.name,
              email: profile.email,
              role: profile.role || 'Team Member'
            }
          ])


      if (memberError) {

        console.log(
          'Error adding team member:',
          memberError
        )

      }


      setTeamName('')
      setMemberCount(1)

      await loadTeams()

      alert('Team created successfully')

    } catch (error) {

      console.log('Error creating team:', error)

      alert(error.message)

    } finally {

      setLoading(false)

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

            <h1>Teams</h1>

            <p>
              Create and manage your teams.
            </p>

          </div>

        </header>


        {/* ==================== CREATE TEAM ==================== */}

        <section className="dashboard-card">

          <div className="card-title">

            <h2>Create Team</h2>

          </div>


          <div className="task-item">

            <input
              type="text"
              placeholder="Enter team name"
              value={teamName}
              onChange={(event) =>
                setTeamName(event.target.value)
              }
            />

            <input
              type="number"
              min="1"
              placeholder="Number of members"
              value={memberCount}
              onChange={(event) =>
                setMemberCount(event.target.value)
              }
            />

            <button
              className="create-button"
              onClick={createTeam}
              disabled={loading}
            >

              {loading
                ? 'Creating...'
                : 'Create Team'}

            </button>

          </div>

        </section>


        {/* ==================== TEAM LIST ==================== */}

        <section className="dashboard-card">

          <div className="card-title">

            <h2>My Teams</h2>

            <button onClick={loadTeams}>
              Refresh
            </button>

          </div>


          {teams.length === 0 ? (

            <p>
              No teams available.
            </p>

          ) : (

            teams.map(team => (

              <div key={team.id}>

                <div className="task-item">

                  <div>

                    <h3>
                      {team.icon || '👥'} {team.name}
                    </h3>

                    <p>
                      {team.members || 0} members
                    </p>

                  </div>


                  <button
                    onClick={() =>
                      toggleMembers(team.id)
                    }
                  >
                    {expandedTeam === team.id
                      ? 'Hide Members'
                      : 'View Members'}
                  </button>

                </div>


                {/* ==================== MEMBERS ==================== */}

                {expandedTeam === team.id && (

                  <div className="dashboard-card">

                    <h3>
                      Team Members
                    </h3>


                    {(!members[team.id] ||
                      members[team.id].length === 0) ? (

                      <p>
                        No members added yet.
                      </p>

                    ) : (

                      members[team.id].map(member => (

                        <div
                          className="team-item"
                          key={member.id}
                        >

                          <div className="team-icon">
                            {member.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>

                            <h3>
                              {member.name}
                            </h3>

                            <p>
                              {member.email}
                            </p>

                            <small>
                              {member.role}
                            </small>

                          </div>

                        </div>

                      ))

                    )}

                  </div>

                )}

              </div>

            ))

          )}

        </section>

      </main>

    </div>

  )
}

export default Team