import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Sidebar from '../components/Sidebar'
import '../css/dashboard.css'

function Profile() {
  const navigate = useNavigate()

  const [profile, setProfile] = useState({
    name: '',
    email: ''
  })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      navigate('/login')
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('email', user.email)
      .maybeSingle()

    if (error) {
      console.log('Error loading profile:', error)

      setProfile({
        name: user.user_metadata?.name || 'Bhuvan',
        email: user.email
      })

      setName(user.user_metadata?.name || 'Bhuvan')
      setLoading(false)

      return
    }

    if (!data) {
      setProfile({
        name: user.user_metadata?.name || 'Bhuvan',
        email: user.email
      })

      setName(user.user_metadata?.name || 'Bhuvan')
      setLoading(false)

      return
    }

    setProfile({
      name: data.name,
      email: data.email || user.email
    })

    setName(data.name)
    setLoading(false)
  }

  const handleSave = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      navigate('/login')
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: name
      })
      .eq('email', user.email)
      .select()

    if (error) {
      alert(error.message)
      return
    }

    if (!data || data.length === 0) {
      alert('Profile record not found')
      return
    }

    setProfile({
      ...profile,
      name: name
    })

    setEditing(false)

    alert('Profile updated successfully')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="dashboard">
        <Sidebar />

        <main className="dashboard-content">
          <h1>Loading profile...</h1>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard">

      <Sidebar />

      <main className="dashboard-content">

        <header className="dashboard-header">

          <div>
            <h1>My Profile</h1>

            <p>
              Manage your account information.
            </p>
          </div>

        </header>

        <section className="dashboard-card">

          <div className="card-title">
            <h2>Profile Information</h2>
          </div>

          <div style={{ marginTop: '20px' }}>

            <h3>Name</h3>

            {editing ? (

              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />

            ) : (

              <p>{profile.name}</p>

            )}

          </div>

          <div style={{ marginTop: '20px' }}>

            <h3>Email</h3>

            <p>{profile.email}</p>

          </div>

          <div style={{ marginTop: '25px' }}>

            {editing ? (

              <>
                <button
                  onClick={handleSave}
                  className="create-button"
                >
                  Save Changes
                </button>

                <button
                  onClick={() => {
                    setName(profile.name)
                    setEditing(false)
                  }}
                  style={{ marginLeft: '10px' }}
                >
                  Cancel
                </button>
              </>

            ) : (

              <button
                onClick={() => setEditing(true)}
                className="create-button"
              >
                Edit Profile
              </button>

            )}

            <button
              onClick={handleLogout}
              style={{ marginLeft: '10px' }}
            >
              Logout
            </button>

          </div>

        </section>

      </main>

    </div>
  )
}

export default Profile