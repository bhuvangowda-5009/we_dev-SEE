
import { useEffect, useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'
import '../css/tasks.css'

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`

function normalizeStatus(status) {
  const value = String(status || 'todo')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (['completed', 'complete', 'done'].includes(value)) {
    return 'completed'
  }

  if (['in_progress', 'inprogress', 'progress'].includes(value)) {
    return 'in_progress'
  }

  if (['todo', 'to_do', 'pending'].includes(value)) {
    return 'todo'
  }

  return value
}

function Tasks() {
  const [profile, setProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [tasks, setTasks] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState(null)

  const getRequestHeaders = useCallback(async () => {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession()

    if (error) {
      throw new Error(error.message)
    }

    if (!session?.user?.email) {
      throw new Error('Your session has expired. Please log in again.')
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    }
  }, [])

  const loadTasks = useCallback(async (teamId, email) => {
    if (!teamId || !email) {
      setTasks([])
      return
    }

    try {
      const headers = await getRequestHeaders()
      const params = new URLSearchParams({
        team_id: String(teamId),
        email
      })

      const response = await fetch(
        `${API_URL}/tasks?${params.toString()}`,
        { headers }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load tasks.')
      }

      const taskList = Array.isArray(data)
        ? data
        : Array.isArray(data.tasks)
          ? data.tasks
          : []

      setTasks(
        taskList.map(task => ({
          ...task,
          status: normalizeStatus(task.status)
        }))
      )
    } catch (error) {
      console.error('Error loading tasks:', error)
      setTasks([])
      alert(`Unable to load tasks: ${error.message}`)
    }
  }, [getRequestHeaders])

  const initializeTasks = useCallback(async () => {
    try {
      setLoading(true)

      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()

      if (authError || !user?.email) {
        throw new Error('Please log in to manage tasks.')
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) {
        throw new Error(
          `Unable to load your profile: ${profileError.message}`
        )
      }

      const currentProfile = {
        ...(profileData || {}),
        user_id: user.id,
        email: user.email,
        name:
          profileData?.name ||
          user.user_metadata?.name ||
          user.email.split('@')[0]
      }

      setProfile(currentProfile)

      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('email', user.email)
        .eq('status', 'approved')

      if (membershipError) {
        throw new Error(
          `Unable to load team memberships: ${membershipError.message}`
        )
      }

      const teamIds = [
        ...new Set((memberships || []).map(member => member.team_id))
      ]

      if (teamIds.length === 0) {
        setTeams([])
        setSelectedTeam('')
        setTasks([])
        return
      }

      const { data: teamData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('id', { ascending: true })

      if (teamsError) {
        throw new Error(`Unable to load teams: ${teamsError.message}`)
      }

      const availableTeams = teamData || []
      setTeams(availableTeams)

      if (availableTeams.length > 0) {
        const firstTeamId = String(availableTeams[0].id)
        setSelectedTeam(firstTeamId)
        await loadTasks(firstTeamId, user.email)
      } else {
        setSelectedTeam('')
        setTasks([])
      }
    } catch (error) {
      console.error('Error initializing tasks:', error)
      alert(error.message || 'Unable to load tasks.')
    } finally {
      setLoading(false)
    }
  }, [loadTasks])

  useEffect(() => {
    initializeTasks()
  }, [initializeTasks])

  const handleTeamChange = async event => {
    const teamId = event.target.value
    setSelectedTeam(teamId)
    setTasks([])

    if (teamId && profile?.email) {
      await loadTasks(teamId, profile.email)
    }
  }

  const createTask = async event => {
    event.preventDefault()

    if (!title.trim()) {
      alert('Please enter a task title.')
      return
    }

    if (!selectedTeam || !profile?.email) {
      alert('Please select a team first.')
      return
    }

    try {
      setSaving(true)

      const headers = await getRequestHeaders()

      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          status: 'todo',
          team_id: Number(selectedTeam),
          email: profile.email
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create task.')
      }

      const newTask = data.task || data

      if (newTask?.id) {
        setTasks(previous => [
          ...previous,
          { ...newTask, status: normalizeStatus(newTask.status) }
        ])
      } else {
        await loadTasks(selectedTeam, profile.email)
      }

      setTitle('')
      setDescription('')
      setShowForm(false)
    } catch (error) {
      console.error('Error creating task:', error)
      alert(`Unable to create task: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const moveTask = async (task, newStatus) => {
    if (!profile?.email || !selectedTeam) {
      alert('Please select a team first.')
      return
    }

    try {
      setUpdatingTaskId(task.id)

      const headers = await getRequestHeaders()

      const response = await fetch(
        `${API_URL}/tasks/${task.id}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            status: newStatus,
            team_id: Number(selectedTeam),
            email: profile.email
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update the task.')
      }

      const updatedTask = data.task || data

      if (updatedTask.status) {
        setTasks(previous =>
          previous.map(item =>
            String(item.id) === String(task.id)
              ? { ...item, ...updatedTask, status: normalizeStatus(updatedTask.status) }
              : item
          )
        )
      } else {
        await loadTasks(selectedTeam, profile.email)
      }
    } catch (error) {
      console.error('Error updating task:', error)
      alert(`Unable to update task: ${error.message}`)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const todoTasks = tasks.filter(
    task => normalizeStatus(task.status) === 'todo'
  )

  const progressTasks = tasks.filter(
    task => normalizeStatus(task.status) === 'in_progress'
  )

  const completedTasks = tasks.filter(
    task => normalizeStatus(task.status) === 'completed'
  )

  const renderTask = (task, actionLabel, nextStatus) => (
    <div className="task-item" key={task.id}>
      <div>
        <h3>{task.title}</h3>
        <p>{task.description || 'No description'}</p>
      </div>

      <button
        type="button"
        disabled={updatingTaskId === task.id}
        onClick={() => moveTask(task, nextStatus)}
      >
        {updatingTaskId === task.id ? 'Updating...' : actionLabel}
      </button>
    </div>
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
            type="button"
            className="create-button"
            disabled={!selectedTeam || loading}
            onClick={() => setShowForm(previous => !previous)}
          >
            + Create Task
          </button>
        </header>

        <section className="dashboard-card">
          <h2>Select Team</h2>

          {loading ? (
            <p>Loading teams...</p>
          ) : teams.length === 0 ? (
            <p>
              You are not an approved member of any team yet.
              Ask your team manager to approve your membership.
            </p>
          ) : (
            <select value={selectedTeam} onChange={handleTeamChange}>
              {teams.map(team => (
                <option key={team.id} value={String(team.id)}>
                  {team.name}
                </option>
              ))}
            </select>
          )}
        </section>

        {showForm && (
          <section className="dashboard-card">
            <h2>Create New Task</h2>

            <form onSubmit={createTask}>
              <input
                type="text"
                placeholder="Task title"
                value={title}
                onChange={event => setTitle(event.target.value)}
                required
              />

              <input
                type="text"
                placeholder="Task description"
                value={description}
                onChange={event => setDescription(event.target.value)}
              />

              <button
                className="create-button"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create Task'}
              </button>
            </form>
          </section>
        )}

        <section className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-title">
              <h2>To Do</h2>
              <span>{todoTasks.length} tasks</span>
            </div>

            {todoTasks.length === 0 && <p>No tasks to do.</p>}

            {todoTasks.map(task =>
              renderTask(task, 'Start', 'in_progress')
            )}
          </div>

          <div className="dashboard-card">
            <div className="card-title">
              <h2>In Progress</h2>
              <span>{progressTasks.length} tasks</span>
            </div>

            {progressTasks.length === 0 && <p>No tasks in progress.</p>}

            {progressTasks.map(task =>
              renderTask(task, 'Complete', 'completed')
            )}
          </div>

          <div className="dashboard-card">
            <div className="card-title">
              <h2>Completed</h2>
              <span>{completedTasks.length} tasks</span>
            </div>

            {completedTasks.length === 0 && <p>No completed tasks.</p>}

            {completedTasks.map(task => (
              <div className="task-item" key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.description || 'No description'}</p>
                </div>

                <span className="status completed">Completed</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default Tasks
