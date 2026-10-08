import { useNavigate } from 'react-router-dom'
import '../css/login.css'

function Login() {

  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    navigate('/dashboard')
  }

  return (
    <div className="login-page">

      <div className="login-box">

        <h1>TeamHub</h1>
        <p>Team Collaboration Platform</p>

        <form onSubmit={handleSubmit}>

          <label>Email</label>

          <input
            type="email"
            placeholder="Enter your email"
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter your password"
          />

          <button type="submit">
            Login
          </button>

        </form>

        <p className="signup-text">
          Don't have an account? <span>Sign up</span>
        </p>

      </div>

    </div>
  )
}

export default Login