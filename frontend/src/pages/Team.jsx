import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import '../css/dashboard.css'

function Team() {

  const [teams, setTeams] = useState([])
  const [teamName, setTeamName] = useState('')
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


  // ==================== CREATE TEAM ====================

  const createTeam = async () => {

    if (!teamName.trim()) {

      alert('Please enter a team name')

      return
    }

    setLoading(true)

    try {

      const response =
        await fetch('http://localhost:5000/api/teams', {

          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            name: teamName,
            members: 1,
            icon: '👥'
          })

        })

      if (!response.ok) {

        throw new Error('Failed to create team')

      }

      setTeamName('')

      await loadTeams()

      alert('Team created successfully')

    } catch (error) {

      console.log('Error creating team:', error)

      alert('Unable to create team')

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

              <div
                className="task-item"
                key={team.id}
              >

                <div>

                  <h3>
                    {team.icon || '👥'} {team.name}
                  </h3>

                  <p>
                    {team.members || 0} members
                  </p>

                </div>

              </div>

            ))

          )}

        </section>


      </main>

    </div>

  )
}

export default Team