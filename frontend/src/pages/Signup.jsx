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

    if (!name || !email || !password || !role) {
      alert('Please fill all fields')
      return
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {

      // ==================== CREATE SUPABASE ACCOUNT ====================

      const { data, error } =
        await supabase.auth.signUp({

          email: email.trim(),

          password: password,

          options: {

            // User will return to the login page
            // after clicking the verification link.
            emailRedirectTo:
              window.location.origin + '/login',

            // Store name and role in Supabase Auth metadata.
            data: {
              name: name.trim(),
              role: role.trim()
            }

          }

        })


      // ==================== SIGNUP ERROR ====================

      if (error) {

        console.log(
          'Signup error:',
          error
        )

        alert(error.message)

        setLoading(false)

        return
      }


      // ==================== CREATE PROFILE ====================

      if (data.user) {

        const { error: profileError } =
          await supabase
            .from('profiles')
            .insert([
              {
                name: name.trim(),
                email: email.trim(),
                role: role.trim()
              }
            ])


        if (profileError) {

          console.log(
            'Profile creation error:',
            profileError
          )

          alert(
            'Account created, but profile could not be created: ' +
            profileError.message
          )

          setLoading(false)

          return
        }
      }


      // ==================== SUCCESS ====================

      alert(
        'Account created successfully!\n\n' +
        'Please check your email and click the verification link before logging in.'
      )

      setLoading(false)

      navigate('/login')

    } catch (error) {

      console.log(
        'Signup error:',
        error
      )

      alert(error.message)

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
          Create your account
        </p>


        <form onSubmit={handleSubmit}>

          {/* ==================== NAME ==================== */}

          <label>
            Name
          </label>

          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
          />


          {/* ==================== EMAIL ==================== */}

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


          {/* ==================== PASSWORD ==================== */}

          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />


          {/* ==================== ROLE ==================== */}

          <label>
            Role
          </label>

          <input
            type="text"
            placeholder="Developer / Designer / Manager"
            value={role}
            onChange={(e) =>
              setRole(e.target.value)
            }
          />


          {/* ==================== SIGNUP BUTTON ==================== */}

          <button
            type="submit"
            disabled={loading}
          >

            {loading
              ? 'Creating account...'
              : 'Sign Up'}

          </button>

        </form>


        {/* ==================== LOGIN ==================== */}

        <p className="signup-text">

          Already have an account?{' '}

          <span
            onClick={() =>
              navigate('/login')
            }
            style={{
              cursor: 'pointer'
            }}
          >
            Login
          </span>

        </p>

      </div>

    </div>

  )
}

export default Signup