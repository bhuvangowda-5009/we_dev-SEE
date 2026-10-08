import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'

function Profile() {

  const [profile, setProfile] = useState(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')

  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)


  // ==================== LOAD PROFILE ====================

  const loadProfile = async () => {

    setLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)
      .single()

    if (error) {

      console.log('Error loading profile:', error)

      setLoading(false)

      return
    }

    setProfile(data)

    setName(data.name)
    setEmail(data.email)
    setRole(data.role)

    setLoading(false)
  }


  // ==================== LOAD ON PAGE OPEN ====================

  useEffect(() => {

    loadProfile()

  }, [])


  // ==================== EDIT PROFILE ====================

  const handleEdit = () => {

    setEditing(true)

  }


  // ==================== SAVE PROFILE ====================

  const handleSave = async () => {

    if (!profile) {
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: name,
        email: email,
        role: role
      })
      .eq('id', profile.id)
      .select()
      .single()

    if (error) {

      console.log('Error updating profile:', error)

      alert(error.message)

      setLoading(false)

      return
    }

    setProfile(data)

    setName(data.name)
    setEmail(data.email)
    setRole(data.role)

    setEditing(false)

    setLoading(false)

    alert('Profile updated successfully')
  }


  // ==================== LOADING ====================

  if (loading && !profile) {

    return (

      <div className="dashboard">

        <Sidebar />

        <main className="dashboard-content">

          <h1>Loading profile...</h1>

        </main>

      </div>

    )
  }


  // ==================== PAGE ====================

  return (

    <div className="dashboard">

      <Sidebar />

      <main className="dashboard-content">


        {/* ==================== HEADER ==================== */}

        <header className="dashboard-header">

          <div>

            <h1>My Profile</h1>

            <p>
              View and manage your profile information.
            </p>

          </div>


          {!editing ? (

            <button
              className="create-button"
              onClick={handleEdit}
              disabled={loading}
            >
              Edit Profile
            </button>

          ) : (

            <button
              className="create-button"
              onClick={handleSave}
              disabled={loading}
            >

              {loading
                ? 'Saving...'
                : 'Save Profile'}

            </button>

          )}

        </header>


        {/* ==================== PROFILE ==================== */}

        <section className="dashboard-grid">


          {/* ==================== PERSONAL INFORMATION ==================== */}

          <div className="dashboard-card">

            <div className="card-title">

              <h2>Personal Information</h2>

            </div>


            <div className="team-item">

              <div className="team-icon">
                👤
              </div>


              <div>

                {editing ? (

                  <input
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                  />

                ) : (

                  <h3>{name}</h3>

                )}

                <p>Team Member</p>

              </div>

            </div>


            {/* ==================== EMAIL ==================== */}

            <div className="task-item">

              <div>

                <h3>Email</h3>

                {editing ? (

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                  />

                ) : (

                  <p>{email}</p>

                )}

              </div>

            </div>


            {/* ==================== ROLE ==================== */}

            <div className="task-item">

              <div>

                <h3>Role</h3>

                {editing ? (

                  <input
                    type="text"
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value)
                    }
                  />

                ) : (

                  <p>{role}</p>

                )}

              </div>

            </div>

          </div>


          {/* ==================== ACTIVITY ==================== */}

          <div className="dashboard-card">

            <div className="card-title">

              <h2>My Activity</h2>

            </div>


            <div className="task-item">

              <div>

                <h3>Active Tasks</h3>

                <p>
                  12 tasks currently assigned
                </p>

              </div>

              <span className="status progress">
                12
              </span>

            </div>


            <div className="task-item">

              <div>

                <h3>Completed Tasks</h3>

                <p>
                  18 tasks completed
                </p>

              </div>

              <span className="status completed">
                18
              </span>

            </div>


            <div className="task-item">

              <div>

                <h3>Shared Files</h3>

                <p>
                  8 files uploaded
                </p>

              </div>

              <span className="status todo">
                8
              </span>

            </div>

          </div>


        </section>

      </main>

    </div>

  )
}

export default Profile