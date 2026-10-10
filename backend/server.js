
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())
// ==================== SUPABASE CONNECTION ====================

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('Supabase URL:', supabaseUrl)
console.log('Secret key loaded:', supabaseKey.startsWith('sb_secret_'))

// ==================== AUTHENTICATION ====================

async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : ''

  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) {
    console.error('Authentication error:', error?.message)
    return null
  }

  return data.user
}


// ==================== HELPER FUNCTIONS ====================

const isTeamMember = async (teamId, email) => {
  if (!teamId || !email) return false

  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', Number(teamId))
    .ilike('email', String(email).trim())
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Membership check error:', error.message)
    return false
  }

  return Boolean(data)
}

const isTeamAdmin = async (teamId, email) => {
  if (!teamId || !email) return false

  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', Number(teamId))
    .ilike('email', String(email).trim())
    .eq('role', 'admin')
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Admin check error:', error.message)
    return false
  }

  return Boolean(data)
}

async function getProfileForUser(user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, name, email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return {
    user_id: user.id,
    name: data?.name || user.user_metadata?.name || user.email || 'User',
    email: (data?.email || user.email || '').trim().toLowerCase()
  }
}

// ==================== HOME ====================

app.get('/', (req, res) => {
  res.send('TeamHub backend is running')
})

// ==================== SEARCH REGISTERED USERS ====================

app.get('/api/users/search', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req)

    if (!user) {
      return res.status(401).json({
        error: 'Please log in again.'
      })
    }

    const q = String(req.query.q || '').trim()

    if (q.length < 2) {
      return res.json([])
    }

    // Search registered profiles only. Never return passwords or auth secrets.
    const safeQuery = q.replace(/[%,()]/g, ' ').trim()

    if (safeQuery.length < 2) {
      return res.json([])
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .or(
        `name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`
      )
      .neq('user_id', user.id)
      .limit(20)

    if (error) {
      console.error('Search users error:', error.message)
      return res.status(500).json({
        error: 'Unable to search registered users.'
      })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Search users error:', error)
    res.status(500).json({
      error: 'User search failed.'
    })
  }
})

// ==================== GET TEAMS ====================

app.get('/api/teams', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      console.error('Load teams error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Load teams error:', error)
    res.status(500).json({ error: 'Failed to load teams.' })
  }
})

// ==================== CREATE TEAM + ADD SELECTED USERS ====================

app.post('/api/teams', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req)

    if (!user) {
      return res.status(401).json({
        error: 'Please log in again.'
      })
    }

    const {
      name,
      description,
      member_user_ids = []
    } = req.body

    if (!name?.trim()) {
      return res.status(400).json({
        error: 'Team name is required.'
      })
    }

    if (!Array.isArray(member_user_ids)) {
      return res.status(400).json({
        error: 'Invalid member selection.'
      })
    }

    const memberIds = [
      ...new Set(
        member_user_ids.filter(
          id => typeof id === 'string' && id !== user.id
        )
      )
    ]

    const creator = await getProfileForUser(user)

    if (!creator.email) {
      return res.status(400).json({
        error: 'Your account must have an email address.'
      })
    }

    let selectedProfiles = []

    if (memberIds.length > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', memberIds)

      if (error) {
        console.error('Selected profile lookup error:', error.message)
        return res.status(500).json({
          error: 'Could not verify selected users.'
        })
      }

      selectedProfiles = data || []

      if (selectedProfiles.length !== memberIds.length) {
        return res.status(400).json({
          error: 'One or more selected users could not be found.'
        })
      }
    }

    // Generate a unique join code.
    let joinCode = ''
    let codeAvailable = false

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = randomBytes(4)
        .toString('hex')
        .toUpperCase()

      const { data, error } = await supabase
        .from('teams')
        .select('id')
        .eq('join_code', candidate)
        .maybeSingle()

      if (error) {
        console.error('Join code lookup error:', error.message)
        return res.status(500).json({
          error: 'Could not generate a team code.'
        })
      }

      if (!data) {
        joinCode = candidate
        codeAvailable = true
        break
      }
    }

    if (!codeAvailable) {
      return res.status(500).json({
        error: 'Could not generate a unique team code. Try again.'
      })
    }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        description: description?.trim() || '',
        created_by: user.id,
        join_code: joinCode,
        icon: '👥',
        members: 1 + selectedProfiles.length
      })
      .select()
      .single()

    if (teamError) {
      console.error('Create team error:', teamError.message)
      return res.status(500).json({
        error: teamError.message
      })
    }

    const memberRows = [
      {
        team_id: team.id,
        name: creator.name,
        email: creator.email,
        role: 'admin',
        status: 'approved'
      },
      ...selectedProfiles.map(profile => ({
        team_id: team.id,
        name: profile.name || profile.email || 'User',
        email: (profile.email || '').trim().toLowerCase(),
        role: 'member',
        status: 'approved'
      }))
    ]

    const { error: membersError } = await supabase
      .from('team_members')
      .insert(memberRows)

    if (membersError) {
      console.error('Add team members error:', membersError.message)

      // Remove only the new team if its member insertion fails.
      const { error: rollbackMembersError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', team.id)

      if (rollbackMembersError) {
        console.error('Rollback members error:', rollbackMembersError.message)
      }

      const { error: rollbackTeamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id)

      if (rollbackTeamError) {
        console.error('Rollback team error:', rollbackTeamError.message)
      }

      return res.status(500).json({
        error: 'Could not add the team members. Please check the database columns and try again.'
      })
    }

    res.status(201).json({
      ...team,
      join_code: joinCode
    })
  } catch (error) {
    console.error('Create team error:', error)
    res.status(500).json({
      error: error.message || 'Failed to create team.'
    })
  }
})

// ==================== JOIN TEAM USING CODE ====================

app.post('/api/teams/join', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req)

    if (!user) {
      return res.status(401).json({
        error: 'Please log in again.'
      })
    }

    const code = String(req.body.code || '')
      .trim()
      .toUpperCase()

    if (!code) {
      return res.status(400).json({
        error: 'Enter a team join code.'
      })
    }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('join_code', code)
      .maybeSingle()

    if (teamError) {
      return res.status(500).json({ error: teamError.message })
    }

    if (!team) {
      return res.status(404).json({
        error: 'Invalid team join code.'
      })
    }

    const profile = await getProfileForUser(user)

    if (!profile.email) {
      return res.status(400).json({
        error: 'Your account needs an email address.'
      })
    }

    if (await isTeamMember(team.id, profile.email)) {
      return res.status(409).json({
        error: 'You are already a member of this team.'
      })
    }

    const { data: existingRequest, error: requestLookupError } =
      await supabase
        .from('join_requests')
        .select('id, status')
        .eq('team_id', team.id)
        .ilike('email', profile.email)
        .eq('status', 'pending')
        .maybeSingle()

    if (requestLookupError) {
      return res.status(500).json({
        error: requestLookupError.message
      })
    }

    if (existingRequest) {
      return res.status(409).json({
        error: 'You already have a pending request for this team.'
      })
    }

    const { error: insertError } = await supabase
      .from('join_requests')
      .insert({
        team_id: team.id,
        name: profile.name,
        email: profile.email,
        status: 'pending'
      })

    if (insertError) {
      console.error('Join request error:', insertError.message)
      return res.status(500).json({
        error: insertError.message
      })
    }

    res.status(201).json({
      message: `Join request sent to ${team.name}'s admin.`
    })
  } catch (error) {
    console.error('Join by code error:', error)
    res.status(500).json({
      error: error.message || 'Failed to request team membership.'
    })
  }
})

// ==================== REQUEST TO JOIN TEAM BY ID ====================

app.post('/api/teams/:teamId/join-request', async (req, res) => {
  try {
    const teamId = Number(req.params.teamId)
    const user = await getAuthenticatedUser(req)

    if (!user) {
      return res.status(401).json({ error: 'Please log in again.' })
    }

    if (!teamId) {
      return res.status(400).json({ error: 'Invalid team ID.' })
    }

    const profile = await getProfileForUser(user)

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .maybeSingle()

    if (teamError) {
      return res.status(500).json({ error: teamError.message })
    }

    if (!team) {
      return res.status(404).json({ error: 'Team not found.' })
    }

    if (await isTeamMember(teamId, profile.email)) {
      return res.status(409).json({
        error: 'You are already a member of this team.'
      })
    }

    const { data: existingRequest, error: lookupError } = await supabase
      .from('join_requests')
      .select('id')
      .eq('team_id', teamId)
      .ilike('email', profile.email)
      .eq('status', 'pending')
      .maybeSingle()

    if (lookupError) {
      return res.status(500).json({ error: lookupError.message })
    }

    if (existingRequest) {
      return res.status(409).json({
        error: 'Join request already sent.'
      })
    }

    const { data, error } = await supabase
      .from('join_requests')
      .insert({
        team_id: teamId,
        name: profile.name,
        email: profile.email,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.status(201).json(data)
  } catch (error) {
    console.error('Join request error:', error)
    res.status(500).json({ error: 'Failed to send join request.' })
  }
})

// ==================== GET TEAM JOIN REQUESTS ====================

app.get('/api/teams/:teamId/join-requests', async (req, res) => {
  try {
    const teamId = Number(req.params.teamId)
    const user = await getAuthenticatedUser(req)

    if (!user) {
      return res.status(401).json({ error: 'Please log in again.' })
    }

    const profile = await getProfileForUser(user)

    if (!teamId || !(await isTeamAdmin(teamId, profile.email))) {
      return res.status(403).json({
        error: 'Only team admins can view join requests.'
      })
    }

    const { data, error } = await supabase
      .from('join_requests')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Load join requests error:', error)
    res.status(500).json({ error: 'Failed to load join requests.' })
  }
})

// ==================== APPROVE OR REJECT JOIN REQUEST ====================

app.patch('/api/join-requests/:requestId', async (req, res) => {
  try {
    const requestId = Number(req.params.requestId)
    const { status } = req.body
    const user = await getAuthenticatedUser(req)

    if (!user) {
      return res.status(401).json({ error: 'Please log in again.' })
    }

    if (!requestId || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: 'Valid request ID and status are required.'
      })
    }

    const profile = await getProfileForUser(user)

    const { data: request, error: requestError } = await supabase
      .from('join_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle()

    if (requestError) {
      return res.status(500).json({ error: requestError.message })
    }

    if (!request) {
      return res.status(404).json({ error: 'Join request not found.' })
    }

    if (!(await isTeamAdmin(request.team_id, profile.email))) {
      return res.status(403).json({
        error: 'Only team admins can process requests.'
      })
    }

    if (request.status !== 'pending') {
      return res.status(409).json({
        error: 'This request has already been processed.'
      })
    }

    if (status === 'approved') {
      const alreadyMember = await isTeamMember(
        request.team_id,
        request.email
      )

      if (!alreadyMember) {
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            team_id: request.team_id,
            name: request.name,
            email: request.email.trim().toLowerCase(),
            role: 'member',
            status: 'approved'
          })

        if (memberError) {
          return res.status(500).json({ error: memberError.message })
        }

        const { data: currentTeam, error: countError } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', request.team_id)
          .eq('status', 'approved')

        if (!countError) {
          await supabase
            .from('teams')
            .update({ members: (currentTeam || []).length })
            .eq('id', request.team_id)
        }
      }
    }

    const { error: updateError } = await supabase
      .from('join_requests')
      .update({ status })
      .eq('id', requestId)
      .eq('status', 'pending')

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }

    res.json({
      message: status === 'approved'
        ? 'User approved successfully.'
        : 'Join request rejected.'
    })
  } catch (error) {
    console.error('Process join request error:', error)
    res.status(500).json({
      error: 'Failed to process join request.'
    })
  }
})

// ==================== GET TEAM MEMBERS ====================

app.get('/api/teams/:teamId/members', async (req, res) => {
  try {
    const teamId = Number(req.params.teamId)
    const user = await getAuthenticatedUser(req)

    if (!user) {
      return res.status(401).json({ error: 'Please log in again.' })
    }

    const profile = await getProfileForUser(user)

    if (!teamId || !(await isTeamMember(teamId, profile.email))) {
      return res.status(403).json({
        error: 'Only approved team members can view members.'
      })
    }

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'approved')
      .order('id', { ascending: true })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Load members error:', error)
    res.status(500).json({ error: 'Failed to load team members.' })
  }
})

// ==================== GET TASKS ====================

app.get('/api/tasks', async (req, res) => {
  try {
    const { team_id, email } = req.query

    if (team_id && !email) {
      return res.status(400).json({
        error: 'Email is required when loading team tasks.'
      })
    }

    if (team_id && !(await isTeamMember(team_id, email))) {
      return res.status(403).json({
        error: 'You are not an approved member of this team.'
      })
    }

    let query = supabase
      .from('tasks')
      .select('*')
      .order('id', { ascending: true })

    if (team_id) {
      query = query.eq('team_id', Number(team_id))
    }

    const { data, error } = await query

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Load tasks error:', error)
    res.status(500).json({ error: 'Failed to load tasks.' })
  }
})

// ==================== CREATE TASK ====================

app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, status, team_id, email } = req.body

    if (!title?.trim() || !team_id || !email?.trim()) {
      return res.status(400).json({
        error: 'Title, team_id and email are required.'
      })
    }

    if (!(await isTeamMember(team_id, email))) {
      return res.status(403).json({
        error: 'You are not an approved member of this team.'
      })
    }

    const allowedStatuses = ['todo', 'in_progress', 'completed']
    const taskStatus = status || 'todo'

    if (!allowedStatuses.includes(taskStatus)) {
      return res.status(400).json({ error: 'Invalid task status.' })
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        description: description?.trim() || '',
        status: taskStatus,
        team_id: Number(team_id)
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.status(201).json(data)
  } catch (error) {
    console.error('Create task error:', error)
    res.status(500).json({ error: 'Failed to create task.' })
  }
})

// ==================== UPDATE TASK STATUS ====================

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = Number(req.params.id)
    const { status, team_id, email } = req.body

    if (!taskId || !status || !team_id || !email?.trim()) {
      return res.status(400).json({
        error: 'Task ID, status, team_id and email are required.'
      })
    }

    if (!['todo', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid task status.' })
    }

    if (!(await isTeamMember(team_id, email))) {
      return res.status(403).json({
        error: 'You are not an approved member of this team.'
      })
    }

    const { data: existingTask, error: findError } = await supabase
      .from('tasks')
      .select('id, team_id')
      .eq('id', taskId)
      .maybeSingle()

    if (findError) {
      return res.status(500).json({ error: findError.message })
    }

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found.' })
    }

    if (Number(existingTask.team_id) !== Number(team_id)) {
      return res.status(403).json({
        error: 'This task does not belong to the selected team.'
      })
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId)
      .eq('team_id', Number(team_id))
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json(data)
  } catch (error) {
    console.error('Update task error:', error)
    res.status(500).json({ error: 'Failed to update task.' })
  }
})

// ==================== GET MESSAGES ====================

app.get('/api/messages', async (req, res) => {
  try {
    const { team_id, email } = req.query

    if (!team_id || !email) {
      return res.status(400).json({
        error: 'team_id and email are required.'
      })
    }

    if (!(await isTeamMember(team_id, email))) {
      return res.status(403).json({
        error: 'You are not an approved member of this team.'
      })
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('team_id', Number(team_id))
      .order('id', { ascending: true })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Load messages error:', error)
    res.status(500).json({ error: 'Failed to load messages.' })
  }
})

// ==================== SEND MESSAGE ====================

app.post('/api/messages', async (req, res) => {
  try {
    const { sender, message, team_id, email } = req.body

    if (
      !sender?.trim() ||
      !message?.trim() ||
      !team_id ||
      !email?.trim()
    ) {
      return res.status(400).json({
        error: 'Sender, message, team_id and email are required.'
      })
    }

    if (!(await isTeamMember(team_id, email))) {
      return res.status(403).json({
        error: 'You are not an approved member of this team.'
      })
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender: sender.trim(),
        message: message.trim(),
        team_id: Number(team_id),
        email: email.trim().toLowerCase()
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.status(201).json(data)
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ error: 'Failed to send message.' })
  }
})

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
