import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import '../css/dashboard.css'

function Tasks() {
  const [tasks, setTasks] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = () => {
    fetch('http://localhost:5000/api/tasks')
      .then(response => response.json())
      .then(data => {
        setTasks(data)
      })
      .catch(error => {
        console.log('Error:', error)
      })
  }

  const createTask = (e) => {
    e.preventDefault()

    if (!title.trim()) {
      return
    }

    fetch('http://localhost:5000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        description: description,
        status: 'todo'
      })
    })
      .then(response => response.json())
      .then(data => {
        setTasks([...tasks, data])

        setTitle('')
        setDescription('')
        setShowForm(false)
      })
      .catch(error => {
        console.log('Error:', error)
      })
  }

  const moveTask = (id, newStatus) => {
    fetch(`http://localhost:5000/api/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: newStatus
      })
    })
      .then(response => response.json())
      .then(updatedTask => {
        setTasks(
          tasks.map(task =>
            task.id === id ? updatedTask : task
          )
        )
      })
      .catch(error => {
        console.log('Error:', error)
      })
  }

  const todoTasks = tasks.filter(
    task => task.status === 'todo'
  )

  const progressTasks = tasks.filter(
    task => task.status === 'in_progress'
  )

  const completedTasks = tasks.filter(
    task => task.status === 'completed'
  )

  return (
    <div className="dashboard">

      <Sidebar />

      <main className="dashboard-content">

        <header className="dashboard-header">

          <div>
            <h1>Tasks</h1>
            <p>Track and manage your team's work.</p>
          </div>

          <button
            className="create-button"
            onClick={() => setShowForm(!showForm)}
          >
            + Create Task
          </button>

        </header>

        {showForm && (
          <section className="dashboard-card">

            <div className="card-title">
              <h2>Create New Task</h2>
            </div>

            <form onSubmit={createTask}>

              <input
                type="text"
                placeholder="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <input
                type="text"
                placeholder="Task description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <button
                className="create-button"
                type="submit"
              >
                Create Task
              </button>

            </form>

          </section>
        )}

        <section className="dashboard-grid">

          {/* TO DO */}

          <div className="dashboard-card">

            <div className="card-title">
              <h2>To Do</h2>
              <span>{todoTasks.length} tasks</span>
            </div>

            {todoTasks.map(task => (

              <div className="task-item" key={task.id}>

                <div>
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                </div>

                <div>

                  <span className="status todo">
                    To Do
                  </span>

                  <button
                    onClick={() =>
                      moveTask(task.id, 'in_progress')
                    }
                  >
                    Start
                  </button>

                </div>

              </div>

            ))}

          </div>


          {/* IN PROGRESS */}

          <div className="dashboard-card">

            <div className="card-title">
              <h2>In Progress</h2>
              <span>{progressTasks.length} tasks</span>
            </div>

            {progressTasks.map(task => (

              <div className="task-item" key={task.id}>

                <div>
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                </div>

                <div>

                  <span className="status progress">
                    In Progress
                  </span>

                  <button
                    onClick={() =>
                      moveTask(task.id, 'completed')
                    }
                  >
                    Complete
                  </button>

                </div>

              </div>

            ))}

          </div>


          {/* COMPLETED */}

          <div className="dashboard-card">

            <div className="card-title">
              <h2>Completed</h2>
              <span>{completedTasks.length} tasks</span>
            </div>

            {completedTasks.map(task => (

              <div className="task-item" key={task.id}>

                <div>
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                </div>

                <span className="status completed">
                  Completed
                </span>

              </div>

            ))}

          </div>

        </section>

      </main>

    </div>
  )
}

export default Tasks