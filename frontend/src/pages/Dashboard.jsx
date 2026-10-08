import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'

function Dashboard() {

  const [teams, setTeams] = useState([])
  const [tasks, setTasks] = useState([])
  const [messageCount, setMessageCount] = useState(0)
  const [fileCount, setFileCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [userName, setUserName] = useState('User')


  // ==================== GET LOGGED-IN USER ====================

  const loadUser = async () => {

    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error) {
      console.log('Error loading user:', error)
      return
    }

    if (user) {

      const name =
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'User'

      setUserName(name)

    }
  }


  // ==================== LOAD DASHBOARD ====================

  const loadDashboard = async () => {

    setLoading(true)

    try {

      // ==================== LOAD TEAMS ====================

      const teamsResponse =
        await fetch('http://localhost:5000/api/teams')

      if (!teamsResponse.ok) {
        throw new Error('Failed to load teams')
      }

      const teamsData = await teamsResponse.json()

      setTeams(teamsData)


      // ==================== LOAD TASKS ====================

      const tasksResponse =
        await fetch('http://localhost:5000/api/tasks')

      if (!tasksResponse.ok) {
        throw new Error('Failed to load tasks')
      }

      const tasksData = await tasksResponse.json()

      setTasks(tasksData)


      // ==================== LOAD MESSAGES ====================

      const {
        count: messages,
        error: messageError
      } = await supabase
        .from('messages')
        .select('*', {
          count: 'exact',
          head: true
        })

      if (messageError) {

        console.log(
          'Error loading messages:',
          messageError
        )

      } else {

        setMessageCount(messages || 0)

      }


      // ==================== LOAD FILES ====================

      const {
        data: files,
        error: fileError
      } = await supabase
        .storage
        .from('files')
        .list('', {
          limit: 1000
        })

      if (fileError) {

        console.log(
          'Error loading files:',
          fileError
        )

      } else {

        setFileCount(files?.length || 0)

      }

    } catch (error) {

      console.log(
        'Error loading dashboard:',
        error
      )

    } finally {

      setLoading(false)

    }
  }


  // ==================== LOAD ON PAGE OPEN ====================

  useEffect(() => {

    loadUser()
    loadDashboard()

  }, [])


  // ==================== ACTIVE TASKS ====================

  const activeTasks = tasks.filter(task =>
    task.status === 'todo' ||
    task.status === 'in_progress'
  ).length


  // ==================== RECENT TASKS ====================

  const recentTasks = [...tasks]
    .sort((a, b) => b.id - a.id)
    .slice(0, 3)


  // ==================== STATUS ====================

  const getStatusClass = (status) => {

    if (status === 'completed') {
      return 'completed'
    }

    if (status === 'in_progress') {
      return 'progress'
    }

    return 'todo'
  }


  const getStatusText = (status) => {

    if (status === 'completed') {
      return 'Completed'
    }

    if (status === 'in_progress') {
      return 'In Progress'
    }

    return 'To Do'
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
              Good morning, {userName} 👋
            </h1>

            <p>
              Here's what's happening with your teams today.
            </p>

          </div>


          <button
            className="create-button"
            onClick={loadDashboard}
            disabled={loading}
          >

            {loading
              ? 'Refreshing...'
              : '↻ Refresh'}

          </button>

        </header>


        {/* ==================== STATS ==================== */}

        <section className="stats">


          <div className="stat-card">

            <h2>
              {teams.length}
            </h2>

            <p>
              Teams
            </p>

          </div>


          <div className="stat-card">

            <h2>
              {activeTasks}
            </h2>

            <p>
              Active Tasks
            </p>

          </div>


          <div className="stat-card">

            <h2>
              {messageCount}
            </h2>

            <p>
              Messages
            </p>

          </div>


          <div className="stat-card">

            <h2>
              {fileCount}
            </h2>

            <p>
              Files
            </p>

          </div>


        </section>


        {/* ==================== DASHBOARD GRID ==================== */}

        <section className="dashboard-grid">


          {/* ==================== MY TEAMS ==================== */}

          <div className="dashboard-card">

            <div className="card-title">

              <h2>
                My Teams
              </h2>

              <button
                onClick={loadDashboard}
              >
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
                  className="team-item"
                  key={team.id}
                >

                  <div className="team-icon">

                    {team.icon || '👥'}

                  </div>


                  <div>

                    <h3>
                      {team.name}
                    </h3>

                    <p>
                      {team.members || 0} members
                    </p>

                  </div>

                </div>

              ))

            )}

          </div>


          {/* ==================== RECENT TASKS ==================== */}

          <div className="dashboard-card">

            <div className="card-title">

              <h2>
                Recent Tasks
              </h2>

              <button
                onClick={loadDashboard}
              >
                Refresh
              </button>

            </div>


            {recentTasks.length === 0 ? (

              <p>
                No tasks available.
              </p>

            ) : (

              recentTasks.map(task => (

                <div
                  className="task-item"
                  key={task.id}
                >

                  <div>

                    <h3>
                      {task.title}
                    </h3>

                    <p>
                      Team task
                    </p>

                  </div>


                  <span
                    className={
                      `status ${getStatusClass(task.status)}`
                    }
                  >

                    {getStatusText(task.status)}

                  </span>

                </div>

              ))

            )}

          </div>


        </section>

      </main>

    </div>

  )
}

export default Dashboard