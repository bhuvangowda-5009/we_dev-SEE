
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import '../css/login.css'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail || !password) {
      alert('Please enter email and password')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      })

      if (error) {
        console.error('Login error:', error.message)
        alert('Login failed: ' + error.message)
        return
      }

      console.log('Login successful:', data.user.email)
      navigate('/dashboard')
    } catch (error) {
      console.error('Unexpected login error:', error)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      alert('Please enter your registered email address first.')
      return
    }

    setResetLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`
        }
      )

      if (error) {
        console.error('Password reset error:', error.message)
        alert('Unable to send reset email: ' + error.message)
        return
      }

      alert('If an account exists for this email, a password reset link will be sent. Please check your inbox and spam folder.')
    } catch (error) {
      console.error('Unexpected password reset error:', error)
      alert('Something went wrong. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>TeamHub</h1>
        <p>Team Collaboration Platform</p>

        <form onSubmit={handleSubmit} autoComplete="off">
          <label htmlFor="login-email">Email</label>

          <input
            id="login-email"
            type="email"
            name="login-email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            required
          />

          <label htmlFor="login-password">Password</label>

          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            name="login-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            spellCheck={false}
            required
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '8px'
            }}
          >
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#2563eb',
                textDecoration: 'underline',
                cursor: resetLoading ? 'wait' : 'pointer',
                fontSize: '14px'
              }}
            >
              {resetLoading ? 'Sending reset link...' : 'Forgot Password?'}
            </button>
          </div>

          <div style={{ marginTop: '8px', marginBottom: '12px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Show password
            </label>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="signup-text">
          Don't have an account?{' '}
          <span
            onClick={() => navigate('/signup')}
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
