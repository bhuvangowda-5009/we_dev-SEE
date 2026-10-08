
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

    if (!email.trim() || !password) {
      alert('Please enter email and password')
      return
    }

    setLoading(true)

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password
        })

      if (error) {
        console.log('Login error:', error.message)

        alert(
          'Login failed: ' +
          error.message
        )

        setLoading(false)
        return
      }

      console.log(
        'Login successful:',
        data.user.email
      )

      setLoading(false)

      navigate('/dashboard')

    } catch (error) {
      console.log(
        'Unexpected login error:',
        error
      )

      alert(
        'Something went wrong. Please try again.'
      )

      setLoading(false)
    }
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
              cursor: 'pointer',
              textDecoration: 'underline'
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
