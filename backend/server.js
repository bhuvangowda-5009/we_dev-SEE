
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

const supabase = createClient(
  supabaseUrl,
  supabaseKey
)


// ==================================================
// HOME
// ==================================================

app.get('/', (req, res) => {
  res.send('TeamHub backend is running')
})


// ==================================================
// HELPER - CHECK TEAM MEMBERSHIP
// ==================================================

const isTeamMember = async (teamId, email) => {
  if (!teamId || !email) {
    return false
  }

  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', Number(teamId))
    .eq('email', email)
    .eq('status', 'approved')
    .maybeSingle()

  if (error) {
    console.error('Membership check error:', error)
    return false
  }

  return !!data
}


// ==================================================
// TEAMS
// ==================================================

app.get('/api/teams', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('id', {
        ascending: true
      })

    if (error) {
      console.error(error)

      return res.status(500).json({
        error: error.message
      })
    }

    res.json(data)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to load teams'
    })
  }
})


app.post('/api/teams', async (req, res) => {
  try {
    const {
      name,
      description,
      email
    } = req.body

    if (!name || !email) {
      return res.status(400).json({
        error: 'Team name and email are required'
      })
    }

    const { data: team, error: teamError } =
      await supabase
        .from('teams')
        .insert([
          {
            name: name.trim(),
            description: description || ''
          }
        ])
        .select()
        .single()

    if (teamError) {
      console.error(teamError)

      return res.status(500).json({
        error: teamError.message
      })
    }

    // Creator automatically becomes admin
    const { error: memberError } =
      await supabase
        .from('team_members')
        .insert([
          {
            team_id: team.id,
            email: email,
            role: 'admin',
            status: 'approved'
          }
        ])

    if (memberError) {
      console.error(memberError)

      return res.status(500).json({
        error: memberError.message
      })
    }

    res.status(201).json(team)

  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to create team'
    })
  }
})


// ==================================================
// REQUEST TO JOIN TEAM
// ==================================================

app.post('/api/teams/:teamId/join-request', async (req, res) => {
  try {
    const teamId = Number(req.params.teamId)

    const {
      name,
      email
    } = req.body

    if (!teamId || !name || !email) {
      return res.status(400).json({
        error: 'Team, name and email are required'
      })
    }

    // Check whether already a member
    const alreadyMember = await isTeamMember(
      teamId,
      email
    )

    if (alreadyMember) {
      return res.status(400).json({
        error: 'You are already a member of this team'
      })
    }

    // Check existing pending request
    const { data: existingRequest } =
      await supabase
        .from('join_requests')
        .select('*')
        .eq('team_id', teamId)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle()

    if (existingRequest) {
      return res.status(400).json({
        error: 'Join request already sent'
      })
    }

    const { data, error } =
      await supabase
        .from('join_requests')
        .insert([
          {
            team_id: teamId,
            name: name.trim(),
            email: email.trim(),
            status: 'pending'
          }
        ])
        .select()
        .single()

    if (error) {
      console.error(error)

      return res.status(500).json({
        error: error.message
      })
    }

    res.status(201).json(data)

  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to send join request'
    })
  }
})


// ==================================================
// GET JOIN REQUESTS FOR ADMIN
// ==================================================

app.get('/api/teams/:teamId/join-requests', async (req, res) => {
  try {
    const teamId = Number(req.params.teamId)
    const { email } = req.query

    if (!teamId || !email) {
      return res.status(400).json({
        error: 'Team ID and email are required'
      })
    }

    const { data: admin } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('email', email)
      .eq('role', 'admin')
      .eq('status', 'approved')
      .maybeSingle()

    if (!admin) {
      return res.status(403).json({
        error: 'Only team admins can view join requests'
      })
    }

    const { data, error } =
      await supabase
        .from('join_requests')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .order('created_at', {
          ascending: true
        })

    if (error) {
      console.error(error)

      return res.status(500).json({
        error: error.message
      })
    }

    res.json(data)

  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to load join requests'
    })
  }
})


// ==================================================
// APPROVE / REJECT JOIN REQUEST
// ==================================================

app.patch('/api/join-requests/:requestId', async (req, res) => {
  try {
    const requestId = Number(req.params.requestId)

    const {
      status,
      admin_email
    } = req.body

    if (
      !requestId ||
      !status ||
      !admin_email
    ) {
      return res.status(400).json({
        error: 'Request ID, status and admin email are required'
      })
    }

    if (
      status !== 'approved' &&
      status !== 'rejected'
    ) {
      return res.status(400).json({
        error: 'Invalid status'
      })
    }

    // Get request
    const { data: request, error: requestError } =
      await supabase
        .from('join_requests')
        .select('*')
        .eq('id', requestId)
        .single()

    if (requestError || !request) {
      return res.status(404).json({
        error: 'Join request not found'
      })
    }

    // Check admin
    const { data: admin } =
      await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', request.team_id)
        .eq('email', admin_email)
        .eq('role', 'admin')
        .eq('status', 'approved')
        .maybeSingle()

    if (!admin) {
      return res.status(403).json({
        error: 'Only team admins can approve requests'
      })
    }

    // Update request
    const { error: updateError } =
      await supabase
        .from('join_requests')
        .update({
          status: status
        })
        .eq('id', requestId)

    if (updateError) {
      console.error(updateError)

      return res.status(500).json({
        error: updateError.message
      })
    }

    // If approved, add member
    if (status === 'approved') {

      const { error: memberError } =
        await supabase
          .from('team_members')
          .insert([
            {
              team_id: request.team_id,
              email: request.email,
              role: 'member',
              status: 'approved'
            }
          ])

      if (memberError) {
        console.error(memberError)

        return res.status(500).json({
          error: memberError.message
        })
      }
    }

    res.json({
      message:
        status === 'approved'
          ? 'User approved successfully'
          : 'Join request rejected'
    })

  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to process join request'
    })
  }
})


// ==================================================
// GET TEAM MEMBERS
// ==================================================

app.get('/api/teams/:teamId/members', async (req, res) => {
  try {
    const teamId = Number(req.params.teamId)

    if (!teamId) {
      return res.status(400).json({
        error: 'Team ID is required'
      })
    }

    const { data, error } =
      await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'approved')

    if (error) {
      console.error(error)

      return res.status(500).json({
        error: error.message
      })
    }

    res.json(data)

  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to load team members'
    })
  }
})


// ==================================================
// TASKS
// ==================================================

app.get('/api/tasks', async (req, res) => {
  try {
    const {
      team_id,
      email
    } = req.query

    if (team_id && email) {
      const member = await isTeamMember(
        team_id,
        email
      )

      if (!member) {
        return res.status(403).json({
          error: 'You are not a member of this team'
        })
      }
    }

    let query = supabase
      .from('tasks')
      .select('*')
      .order('id', {
        ascending: true
      })

    if (team_id) {
      query = query.eq(
        'team_id',
        Number(team_id)
      )
    }

    const { data, error } = await query

    if (error) {
      console.error(error)

      return res.status(500).json({
        error: error.message
      })
    }

    res.json(data)

  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to load tasks'
    })
  }
})


app.post('/api/tasks', async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      team_id,
      email
    } = req.body

    if (!title || !team_id || !email) {
      return res.status(400).json({
        error:
          'Title, team_id and email are required'
      })
    }

    const member = await isTeamMember(
      team_id,
      email
    )

    if (!member) {
      return res.status(403).json({
        error: 'You are not a member of this team'
      })
    }

    const { data, error } =
      await supabase
        .from('tasks')
        .insert([
          {
            title: title.trim(),
            description: description || '',
            status: status || 'todo',
            priority: priority || 'medium',
            team_id: Number(team_id)
          }
        ])
        .select()
        .single()

    if (error) {
      console.error(error)

      return res.status(500).json({
        error: error.message
      })
    }

    res.status(201).json(data)

  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to create task'
    })
  }
})


// ==================================================
// MESSAGES
// ==================================================

app.get('/api/messages', async (req, res) => {
  try {
    const {
      team_id,
      email
    } = req.query

    if (!team_id || !email) {
      return res.status(400).json({
        error: 'team_id and email are required'
      })
    }

    const member = await isTeamMember(
      team_id,
      email
    )

    if (!member) {
      return res.status(403).json({
        error: 'You are not a member of this team'
      })
    }

    const { data, error } =
      await supabase
        .from('messages')
        .select('*')
        .eq(
          'team_id',
          Number(team_id)
        )
        .order('id', {
          ascending: true
        })

    if (error) {
      console.error(error)

      return res.status(500).json({
        error: error.message
      })
    }

    res.json(data)

  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to load messages'
    })
  }
})


app.post('/api/messages', async (req, res) => {
  try {
    const {
      sender,
      message,
      team_id,
      email
    } = req.body

    if (
      !sender ||
      !message ||
      !team_id ||
      !email
    ) {
      return res.status(400).json({
        error:
          'Sender, message, team_id and email are required'
      })
    }

    const member = await isTeamMember(
      team_id,
      email
    )

    if (!member) {
      return res.status(403).json({
        error: 'You are not a member of this team'
      })
    }

    const { data, error } =
      await supabase
        .from('messages')
        .insert([
          {
            sender: sender,
            message: message.trim(),
            team_id: Number(team_id),
            email: email
          }
        ])
        .select()
        .single()

    if (error) {
      console.error(error)

      return res.status(500).json({
        error: error.message
      })
    }

    res.status(201).json(data)

  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to send message'
    })
  }
})


// ==================================================
// START SERVER
// ==================================================

const PORT = 5000

app.listen(PORT, () => {
  console.log(
    `Backend running on http://localhost:${PORT}`
  )
})
