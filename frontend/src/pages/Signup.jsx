
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import '../css/login.css'

function Signup() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()
    const cleanRole = role.trim()

    if (!cleanName || !cleanEmail || !password || !cleanRole) {
      alert('Please fill all fields')
      return
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/login',
          data: {
            name: cleanName,
            role: cleanRole
          }
        }
      })

      if (error) {
        alert(error.message)
        return
      }

      if (!data.user) {
        alert('Account creation could not be confirmed. Please try again.')
        return
      }

      if (!data.session) {
        alert(
          'Account created successfully!\n\n' +
          'Please verify your email, then log in.'
        )
        navigate('/login')
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          name: cleanName,
          email: cleanEmail,
          role: cleanRole
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        alert(
          'Account created, but profile creation failed: ' +
          profileError.message
        )
        return
      }

      alert('Account and profile created successfully!')
      navigate('/login')

    } catch (error) {
      console.error('Signup error:', error)
      alert(error.message || 'Something went wrong during signup')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>TeamHub</h1>
        <p>Create your account</p>

        <form onSubmit={handleSubmit} autoComplete="off">
          <label>Name</label>
          <input
            type="text"
            name="signup-name"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />

          <label>Email</label>
          <input
            type="email"
            name="signup-email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />

          <label>Password</label>
          <input
            type="password"
            name="signup-password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          <label>Role</label>
          <input
            type="text"
            name="signup-role"
            placeholder="Developer / Designer / Manager"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            autoComplete="off"
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="signup-text">
          Already have an account?{' '}
          <span
            onClick={() => navigate('/login')}
            style={{ cursor: 'pointer' }}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  )
}

export default Signup
