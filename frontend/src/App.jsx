import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Team from './pages/Team'
import Chat from './pages/Chat'
import Tasks from './pages/Tasks'
import Files from './pages/Files'
import Profile from './pages/Profile'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Login />} />

        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<Signup />} />

        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/team" element={<Team />} />

        <Route path="/chat" element={<Chat />} />

        <Route path="/tasks" element={<Tasks />} />

        <Route path="/files" element={<Files />} />

        <Route path="/profile" element={<Profile />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App