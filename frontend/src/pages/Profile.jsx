
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import '../css/login.css'

function Login() {

  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {

    e.preventDefault()

    if (!email || !password) {
      alert('Please enter email and password')
      return
    }

    setLoading(true)

    const {
      error
    } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })

    if (error) {

      alert(error.message)

      setLoading(false)

      return
    }

    setLoading(false)

    navigate('/dashboard')
  }

  return (
    <div className="login-page">

      <div className="login-box">

        <h1>
          TeamHub
        </h1>

        <p>
          Team Collaboration Platform
        </p>

        <form onSubmit={handleSubmit}>

          <label>
            Email
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Logging in...'
              : 'Login'}
          </button>

        </form>

        <p className="signup-text">

          Don't have an account?{' '}

          <span
            onClick={() =>
              navigate('/signup')
            }
            style={{
              cursor: 'pointer'
            }}
          >
            Sign up
          </span>

        </p>

      </div>

    </div>
  )
}

export default Login
