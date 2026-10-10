
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

// ==================== SUPABASE ====================

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('TeamHub Supabase connection configured')

// ==================== AUTHENTICATION ====================

async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : ''

  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) return null

  return data.user
}

async function requireUser(req, res) {
  const user = await getAuthenticatedUser(req)

  if (!user) {
    res.status(401).json({ error: 'Please log in again.' })
    return null
  }

  return user
}

async function getProfileForUser(user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, name, email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return {
    user_id: user.id,
    name: data?.name || user.user_metadata?.name || user.email || 'User',
    email: (data?.email || user.email || '').trim().toLowerCase()
  }
}

// ==================== MEMBERSHIP HELPERS ====================

async function getMembership(teamId, email) {
  if (!teamId || !email) return null

  const { data, error } = await supabase
    .from('team_members')
    .select('id, team_id, email, role, status')
    .eq('team_id', Number(teamId))
    .ilike('email', email.trim())
    .eq('status', 'approved')
    .maybeSingle()

  if (error) {
    console.error('Membership lookup error:', error.message)
    throw new Error('Unable to verify team membership.')
  }

  return data
}

async function isTeamMember(teamId, email) {
  return Boolean(await getMembership(teamId, email))
}

async function isTeamAdmin(teamId, email) {
  const membership = await getMembership(teamId, email)
  return membership?.role === 'admin'
}

async function requireTeamMember(teamId, email, res) {
  if (!Number.isInteger(Number(teamId)) || Number(teamId) <= 0) {
    res.status(400).json({ error: 'A valid team ID is required.' })
    return false
  }

  const member = await isTeamMember(Number(teamId), email)

  if (!member) {
    res.status(403).json({
      error: 'Only approved team members can access this team.'
    })
    return false
  }

  return true
}

// Return IDs of teams the logged-in user can access.
async function getAccessibleTeamIds(user, profile) {
  const { data: memberships, error: membershipError } = await supabase
    .from('team_members')
    .select('team_id')
    .ilike('email', profile.email)
    .eq('status', 'approved')

  if (membershipError) throw new Error(membershipError.message)

  const { data: createdTeams, error: createdError } = await supabase
    .from('teams')
    .select('id')
    .eq('created_by', user.id)

  if (createdError) throw new Error(createdError.message)

  return [
    ...new Set([
      ...(memberships || []).map(row => Number(row.team_id)),
      ...(createdTeams || []).map(row => Number(row.id))
    ])
  ]
}

// ==================== HOME ====================

app.get('/', (req, res) => {
  res.json({ message: 'TeamHub backend is running' })
})

// ==================== SEARCH REGISTERED USERS ====================

app.get('/api/users/search', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const q = String(req.query.q || '').trim()
    if (q.length < 2) return res.json([])

    const safeQuery = q.replace(/[%,()]/g, ' ').trim()
    if (safeQuery.length < 2) return res.json([])

    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .or(`name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
      .neq('user_id', user.id)
      .limit(20)

    if (error) {
      console.error('User search error:', error.message)
      return res.status(500).json({ error: 'Unable to search users.' })
    }

    res.json(data || [])
  } catch (error) {
    console.error('User search error:', error.message)
    res.status(500).json({ error: 'User search failed.' })
  }
})

// ==================== GET MY TEAMS ====================

app.get('/api/teams', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const profile = await getProfileForUser(user)
    const teamIds = await getAccessibleTeamIds(user, profile)

    if (!teamIds.length) return res.json([])

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds)
      .order('id', { ascending: true })

    if (error) {
      console.error('Load teams error:', error.message)
      return res.status(500).json({ error: 'Unable to load your teams.' })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Load teams error:', error.message)
    res.status(500).json({ error: 'Failed to load your teams.' })
  }
})

// ==================== CREATE TEAM ====================

app.post('/api/teams', async (req, res) => {
  let createdTeamId = null

  try {
    const user = await requireUser(req, res)
    if (!user) return

    const { name, description, member_user_ids = [] } = req.body

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required.' })
    }

    if (
      !Array.isArray(member_user_ids) ||
      member_user_ids.some(id => typeof id !== 'string')
    ) {
      return res.status(400).json({ error: 'Invalid member selection.' })
    }

    if (member_user_ids.length > 100) {
      return res.status(400).json({ error: 'Too many selected members.' })
    }

    const memberIds = [
      ...new Set(member_user_ids.filter(id => id !== user.id))
    ]

    const creator = await getProfileForUser(user)

    if (!creator.email) {
      return res.status(400).json({
        error: 'Your account needs an email address.'
      })
    }

    let selectedProfiles = []

    if (memberIds.length) {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', memberIds)

      if (error) {
        console.error('Selected profile error:', error.message)
        return res.status(500).json({
          error: 'Could not verify selected users.'
        })
      }

      selectedProfiles = data || []

      if (
        selectedProfiles.length !== memberIds.length ||
        selectedProfiles.some(profile => !profile.email)
      ) {
        return res.status(400).json({
          error: 'One or more selected users could not be verified.'
        })
      }
    }

    let joinCode = ''
    let codeAvailable = false

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = randomBytes(4).toString('hex').toUpperCase()

      const { data, error } = await supabase
        .from('teams')
        .select('id')
        .eq('join_code', candidate)
        .maybeSingle()

      if (error) {
        console.error('Join code check error:', error.message)
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
        error: 'Could not generate a unique team code.'
      })
    }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        description: typeof description === 'string'
          ? description.trim()
          : '',
        created_by: user.id,
        join_code: joinCode,
        icon: '👥',
        members: 1 + selectedProfiles.length
      })
      .select()
      .single()

    if (teamError) {
      console.error('Create team error:', teamError.message)
      return res.status(500).json({ error: 'Failed to create team.' })
    }

    createdTeamId = team.id

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
        email: profile.email.trim().toLowerCase(),
        role: 'member',
        status: 'approved'
      }))
    ]

    const { error: membersError } = await supabase
      .from('team_members')
      .insert(memberRows)

    if (membersError) {
      console.error('Create team members error:', membersError.message)

      await supabase.from('team_members').delete().eq('team_id', team.id)
      await supabase.from('teams').delete().eq('id', team.id)

      return res.status(500).json({
        error: 'Could not add team members. Team creation was rolled back.'
      })
    }

    createdTeamId = null
    res.status(201).json(team)
  } catch (error) {
    console.error('Create team error:', error.message)

    if (createdTeamId !== null) {
      await supabase.from('team_members').delete().eq('team_id', createdTeamId)
      await supabase.from('teams').delete().eq('id', createdTeamId)
    }

    res.status(500).json({ error: 'Failed to create team.' })
  }
})

// ==================== REQUEST TO JOIN BY CODE ====================

app.post('/api/teams/join', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const code = String(req.body.code || '').trim().toUpperCase()

    if (!code) {
      return res.status(400).json({ error: 'Enter a team join code.' })
    }

    const { data: team, error } = await supabase
      .from('teams')
      .select('id, name')
      .eq('join_code', code)
      .maybeSingle()

    if (error) {
      return res.status(500).json({ error: 'Unable to check the join code.' })
    }

    if (!team) {
      return res.status(404).json({ error: 'Invalid team join code.' })
    }

    const profile = await getProfileForUser(user)

    if (await isTeamMember(team.id, profile.email)) {
      return res.status(409).json({
        error: 'You are already a member of this team.'
      })
    }

    const { data: existing, error: lookupError } = await supabase
      .from('join_requests')
      .select('id, status')
      .eq('team_id', team.id)
      .ilike('email', profile.email)
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (lookupError) {
      return res.status(500).json({
        error: 'Unable to check your existing request.'
      })
    }

    if (existing?.status === 'approved') {
      return res.status(409).json({
        error: 'You are already approved for this team.'
      })
    }

    if (existing) {
      return res.status(409).json({
        error: 'You already have a pending request.'
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
        error: 'Failed to send join request.'
      })
    }

    res.status(201).json({
      message: `Join request sent to ${team.name}'s admin.`
    })
  } catch (error) {
    console.error('Join team error:', error.message)
    res.status(500).json({
      error: 'Failed to request team membership.'
    })
  }
})

// ==================== REQUEST TO JOIN BY TEAM ID ====================

app.post('/api/teams/:teamId/join-request', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const teamId = Number(req.params.teamId)

    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'Invalid team ID.' })
    }

    const profile = await getProfileForUser(user)

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .maybeSingle()

    if (teamError) {
      return res.status(500).json({ error: 'Unable to find team.' })
    }

    if (!team) {
      return res.status(404).json({ error: 'Team not found.' })
    }

    if (await isTeamMember(teamId, profile.email)) {
      return res.status(409).json({
        error: 'You are already a member of this team.'
      })
    }

    const { data: existing, error: lookupError } = await supabase
      .from('join_requests')
      .select('id')
      .eq('team_id', teamId)
      .ilike('email', profile.email)
      .eq('status', 'pending')
      .maybeSingle()

    if (lookupError) {
      return res.status(500).json({
        error: 'Unable to check existing requests.'
      })
    }

    if (existing) {
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
      console.error('Join request error:', error.message)
      return res.status(500).json({
        error: 'Failed to send join request.'
      })
    }

    res.status(201).json(data)
  } catch (error) {
    console.error('Join request error:', error.message)
    res.status(500).json({ error: 'Failed to send join request.' })
  }
})

// ==================== GET JOIN REQUESTS (ADMIN ONLY) ====================

app.get('/api/teams/:teamId/join-requests', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const teamId = Number(req.params.teamId)
    const profile = await getProfileForUser(user)

    if (!(await isTeamAdmin(teamId, profile.email))) {
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
      return res.status(500).json({
        error: 'Unable to load join requests.'
      })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Load join requests error:', error.message)
    res.status(500).json({ error: 'Failed to load join requests.' })
  }
})

// ==================== APPROVE / REJECT JOIN REQUEST ====================

app.patch('/api/join-requests/:requestId', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const requestId = Number(req.params.requestId)
    const status = req.body.status

    if (
      !Number.isInteger(requestId) ||
      requestId <= 0 ||
      !['approved', 'rejected'].includes(status)
    ) {
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
      return res.status(500).json({
        error: 'Unable to load join request.'
      })
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
      const existingMember = await isTeamMember(
        request.team_id,
        request.email
      )

      if (!existingMember) {
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
          console.error('Approve member error:', memberError.message)
          return res.status(500).json({
            error: 'Could not approve this member.'
          })
        }

        const { data: members, error: countError } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', request.team_id)
          .eq('status', 'approved')

        if (!countError) {
          await supabase
            .from('teams')
            .update({ members: (members || []).length })
            .eq('id', request.team_id)
        }
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('join_requests')
      .update({ status })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (updateError || !updated) {
      return res.status(500).json({
        error: 'Failed to update join request.'
      })
    }

    res.json({
      message: status === 'approved'
        ? 'User approved successfully.'
        : 'Join request rejected.'
    })
  } catch (error) {
    console.error('Process request error:', error.message)
    res.status(500).json({
      error: 'Failed to process join request.'
    })
  }
})

// ==================== GET TEAM MEMBERS ====================

app.get('/api/teams/:teamId/members', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const teamId = Number(req.params.teamId)
    const profile = await getProfileForUser(user)

    if (!(await requireTeamMember(teamId, profile.email, res))) return

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, created_by')
      .eq('id', teamId)
      .maybeSingle()

    if (teamError) {
      return res.status(500).json({
        error: 'Unable to load team details.'
      })
    }

    if (!team) {
      return res.status(404).json({ error: 'Team not found.' })
    }

    const { data: leader, error: leaderError } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', team.created_by)
      .maybeSingle()

    if (leaderError) {
      return res.status(500).json({
        error: 'Unable to load team leader.'
      })
    }

    const leaderEmail = (leader?.email || '').trim().toLowerCase()

    const { data, error } = await supabase
      .from('team_members')
      .select('id, team_id, name, email, role, status')
      .eq('team_id', teamId)
      .eq('status', 'approved')
      .order('id', { ascending: true })

    if (error) {
      return res.status(500).json({
        error: 'Unable to load team members.'
      })
    }

    res.json((data || []).map(member => ({
      ...member,
      is_leader:
        Boolean(leaderEmail) &&
        (member.email || '').trim().toLowerCase() === leaderEmail
    })))
  } catch (error) {
    console.error('Load members error:', error.message)
    res.status(500).json({
      error: 'Failed to load team members.'
    })
  }
})

// ==================== GET TASKS ====================

app.get('/api/tasks', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const profile = await getProfileForUser(user)
    const teamIds = await getAccessibleTeamIds(user, profile)

    if (!teamIds.length) return res.json([])

    let query = supabase
      .from('tasks')
      .select('*')
      .in('team_id', teamIds)

    if (req.query.team_id !== undefined) {
      const requestedTeamId = Number(req.query.team_id)

      if (
        !Number.isInteger(requestedTeamId) ||
        requestedTeamId <= 0 ||
        !teamIds.includes(requestedTeamId)
      ) {
        return res.status(403).json({
          error: 'You do not have access to this team.'
        })
      }

      query = query.eq('team_id', requestedTeamId)
    }

    const { data, error } = await query.order('id', { ascending: false })

    if (error) {
      console.error('Load tasks error:', error.message)
      return res.status(500).json({ error: 'Unable to load tasks.' })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Load tasks error:', error.message)
    res.status(500).json({ error: 'Failed to load tasks.' })
  }
})

// ==================== CREATE TASK ====================

app.post('/api/tasks', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const profile = await getProfileForUser(user)
    const { title, description, status, team_id } = req.body
    const teamId = Number(team_id)

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' })
    }

    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'A valid team_id is required.' })
    }

    if (!(await requireTeamMember(teamId, profile.email, res))) return

    const taskStatus = status || 'todo'

    if (!['todo', 'in_progress', 'completed'].includes(taskStatus)) {
      return res.status(400).json({ error: 'Invalid task status.' })
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        description: typeof description === 'string'
          ? description.trim()
          : '',
        status: taskStatus,
        team_id: teamId
      })
      .select()
      .single()

    if (error) {
      console.error('Create task error:', error.message)
      return res.status(500).json({ error: 'Failed to create task.' })
    }

    res.status(201).json(data)
  } catch (error) {
    console.error('Create task error:', error.message)
    res.status(500).json({ error: 'Failed to create task.' })
  }
})

// ==================== UPDATE TASK STATUS ====================

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const profile = await getProfileForUser(user)
    const taskId = Number(req.params.id)
    const teamId = Number(req.body.team_id)
    const { status } = req.body

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ error: 'Invalid task ID.' })
    }

    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'Invalid team ID.' })
    }

    if (!['todo', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid task status.' })
    }

    if (!(await requireTeamMember(teamId, profile.email, res))) return

    const { data: existing, error: findError } = await supabase
      .from('tasks')
      .select('id, team_id')
      .eq('id', taskId)
      .maybeSingle()

    if (findError) {
      return res.status(500).json({ error: 'Unable to find task.' })
    }

    if (!existing) {
      return res.status(404).json({ error: 'Task not found.' })
    }

    if (Number(existing.team_id) !== teamId) {
      return res.status(403).json({
        error: 'This task does not belong to the selected team.'
      })
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId)
      .eq('team_id', teamId)
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: 'Failed to update task.' })
    }

    res.json(data)
  } catch (error) {
    console.error('Update task error:', error.message)
    res.status(500).json({ error: 'Failed to update task.' })
  }
})

// ==================== GET TEAM MESSAGES ====================

app.get('/api/messages', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const profile = await getProfileForUser(user)
    const teamId = Number(req.query.team_id)

    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({
        error: 'A valid team_id is required.'
      })
    }

    if (!(await requireTeamMember(teamId, profile.email, res))) return

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('team_id', teamId)
      .order('id', { ascending: true })

    if (error) {
      console.error('Load messages error:', error.message)
      return res.status(500).json({ error: 'Unable to load messages.' })
    }

    res.json(data || [])
  } catch (error) {
    console.error('Load messages error:', error.message)
    res.status(500).json({ error: 'Failed to load messages.' })
  }
})

// ==================== COUNT MESSAGES FOR DASHBOARD ====================

app.get('/api/messages/count', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const profile = await getProfileForUser(user)
    const teamIds = await getAccessibleTeamIds(user, profile)

    if (!teamIds.length) return res.json({ count: 0 })

    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds)

    if (error) {
      console.error('Message count error:', error.message)
      return res.status(500).json({ error: 'Unable to count messages.' })
    }

    res.json({ count: count ?? 0 })
  } catch (error) {
    console.error('Message count error:', error.message)
    res.status(500).json({ error: 'Failed to count messages.' })
  }
})

// ==================== SEND TEAM MESSAGE ====================

app.post('/api/messages', async (req, res) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const profile = await getProfileForUser(user)
    const { sender, message, team_id } = req.body
    const teamId = Number(team_id)

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' })
    }

    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'A valid team_id is required.' })
    }

    if (!(await requireTeamMember(teamId, profile.email, res))) return

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender: profile.name || sender || profile.email,
        message: message.trim(),
        team_id: teamId,
        email: profile.email
      })
      .select()
      .single()

    if (error) {
      console.error('Send message error:', error.message)
      return res.status(500).json({ error: 'Failed to send message.' })
    }

    res.status(201).json(data)
  } catch (error) {
    console.error('Send message error:', error.message)
    res.status(500).json({ error: 'Failed to send message.' })
  }
})

// ==================== START SERVER (ONLY ONCE) ====================

app.listen(PORT, () => {
  console.log(`TeamHub backend running on http://localhost:${PORT}`)
})
