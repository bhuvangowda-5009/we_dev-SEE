import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import '../css/dashboard.css'

function Dashboard() {

  const [teams, setTeams] = useState([])

  useEffect(() => {

    fetch('http://localhost:5000/api/teams')
      .then(response => response.json())
      .then(data => {
        setTeams(data)
      })
      .catch(error => {
        console.log('Error:', error)
      })

  }, [])

  return (
    <div className="dashboard">

      <Sidebar />

      <main className="dashboard-content">

        <header className="dashboard-header">

          <div>
            <h1>Good morning, Bhuvan 👋</h1>
            <p>
              Here's what's happening with your teams today.
            </p>
          </div>

          <button className="create-button">
            + Create
          </button>

        </header>


        <section className="stats">

          <div className="stat-card">
            <h2>{teams.length}</h2>
            <p>Teams</p>
          </div>

          <div className="stat-card">
            <h2>12</h2>
            <p>Active Tasks</p>
          </div>

          <div className="stat-card">
            <h2>24</h2>
            <p>Messages</p>
          </div>

          <div className="stat-card">
            <h2>18</h2>
            <p>Files</p>
          </div>

        </section>


        <section className="dashboard-grid">


          <div className="dashboard-card">

            <div className="card-title">

              <h2>My Teams</h2>

              <button>
                View All
              </button>

            </div>


            {teams.map(team => (

              <div
                className="team-item"
                key={team.id}
              >

                <div className="team-icon">
                  {team.icon}
                </div>

                <div>

                  <h3>
                    {team.name}
                  </h3>

                  <p>
                    {team.members} members
                  </p>

                </div>

              </div>

            ))}

          </div>


          <div className="dashboard-card">

            <div className="card-title">

              <h2>Recent Tasks</h2>

              <button>
                View All
              </button>

            </div>


            <div className="task-item">

              <div>
                <h3>
                  Build Login Page
                </h3>

                <p>
                  Development Team
                </p>
              </div>

              <span className="status progress">
                In Progress
              </span>

            </div>


            <div className="task-item">

              <div>
                <h3>
                  Design Dashboard
                </h3>

                <p>
                  Design Team
                </p>
              </div>

              <span className="status todo">
                To Do
              </span>

            </div>


            <div className="task-item">

              <div>
                <h3>
                  Prepare Presentation
                </h3>

                <p>
                  Marketing Team
                </p>
              </div>

              <span className="status completed">
                Completed
              </span>

            </div>

          </div>


        </section>

      </main>

    </div>
  )
}

export default Dashboard