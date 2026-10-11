
import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate
} from 'react-router-dom'

import { supabase } from './supabase'

import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Team from './pages/Team'
import Chat from './pages/Chat'
import Tasks from './pages/Tasks'
import Files from './pages/Files'
import Profile from './pages/Profile'
import Sidebar from './components/Sidebar'

import './css/components.css'

function AppLayout() {
  const location = useLocation()
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    let mounted = true

    const initializeSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Unable to get session:', error.message)
      }

      if (mounted) {
        setSession(data?.session ?? null)
      }
    }

    initializeSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (session === undefined) {
    return <p>Loading...</p>
  }

  const isAuthPage =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/signup'

  const isResetPasswordPage =
    location.pathname === '/reset-password'

  // Allow password recovery to open without an existing session.
  // Supabase establishes a recovery session when the reset link is valid.
  if (isResetPasswordPage) {
    return (
      <Routes>
        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />
        <Route
          path="*"
          element={<Navigate to="/reset-password" replace />}
        />
      </Routes>
    )
  }

  // Protect all application pages.
  if (!session && !isAuthPage) {
    return <Navigate to="/login" replace />
  }

  // Redirect logged-in users away from login and signup.
  if (session && isAuthPage) {
    return <Navigate to="/dashboard" replace />
  }

  // Public authentication pages.
  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    )
  }

  // Main application with sidebar.
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/team" element={<Team />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/files" element={<Files />} />
          <Route path="/profile" element={<Profile />} />

          <Route
            path="*"
            element={<Navigate to="/dashboard" replace />}
          />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
