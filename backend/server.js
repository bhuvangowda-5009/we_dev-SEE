
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

const app = express()

app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)


// ==================== HOME ====================

app.get('/', (req, res) => {
  res.json({
    message: 'TeamHub backend is running'
  })
})


// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Backend is connected'
  })
})


// ==================== TEAMS ====================

app.get('/api/teams', async (req, res) => {

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('id')

  if (error) {
    return res.status(500).json({
      error: error.message
    })
  }

  res.json(data)
})


app.post('/api/teams', async (req, res) => {

  const { name, members, icon } = req.body

  if (!name) {
    return res.status(400).json({
      error: 'Team name is required'
    })
  }

  const { data, error } = await supabase
    .from('teams')
    .insert([
      {
        name: name,
        members: members || 0,
        icon: icon || '👥'
      }
    ])
    .select()

  if (error) {
    return res.status(500).json({
      error: error.message
    })
  }

  res.status(201).json(data[0])
})


// ==================== TASKS ====================

app.get('/api/tasks', async (req, res) => {

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('id')

  if (error) {
    return res.status(500).json({
      error: error.message
    })
  }

  res.json(data)
})


app.post('/api/tasks', async (req, res) => {

  const { title, description, status } = req.body

  if (!title) {
    return res.status(400).json({
      error: 'Task title is required'
    })
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert([
      {
        title: title,
        description: description || '',
        status: status || 'todo'
      }
    ])
    .select()

  if (error) {
    return res.status(500).json({
      error: error.message
    })
  }

  res.status(201).json(data[0])
})


app.put('/api/tasks/:id', async (req, res) => {

  const { id } = req.params
  const { status } = req.body

  if (!status) {
    return res.status(400).json({
      error: 'Task status is required'
    })
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({
      status: status
    })
    .eq('id', id)
    .select()

  if (error) {
    return res.status(500).json({
      error: error.message
    })
  }

  if (!data || data.length === 0) {
    return res.status(404).json({
      error: 'Task not found'
    })
  }

  res.json(data[0])
})


// ==================== MESSAGES ====================

app.get('/api/messages', async (req, res) => {

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at')

  if (error) {
    return res.status(500).json({
      error: error.message
    })
  }

  res.json(data)
})


app.post('/api/messages', async (req, res) => {

  const { sender, message } = req.body

  if (!sender || !message) {
    return res.status(400).json({
      error: 'Sender and message are required'
    })
  }

  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        sender: sender,
        message: message
      }
    ])
    .select()

  if (error) {
    return res.status(500).json({
      error: error.message
    })
  }

  res.status(201).json(data[0])
})


// ==================== FILES ====================

// Get uploaded files

app.get('/api/files', async (req, res) => {

  const { data, error } = await supabase
    .storage
    .from('files')
    .list('', {
      limit: 100,
      sortBy: {
        column: 'created_at',
        order: 'desc'
      }
    })

  if (error) {
    return res.status(500).json({
      error: error.message
    })
  }

  const files = data.map(file => {

    const { data: publicData } =
      supabase
        .storage
        .from('files')
        .getPublicUrl(file.name)

    return {
      name: file.name,
      url: publicData.publicUrl,
      created_at: file.created_at
    }

  })

  res.json(files)
})


// Upload file

app.post('/api/files/upload', async (req, res) => {

  try {

    const chunks = []

    req.on('data', chunk => {
      chunks.push(chunk)
    })

    req.on('end', async () => {

      const body = Buffer.concat(chunks)

      const contentType =
        req.headers['content-type'] || ''

      const boundaryMatch =
        contentType.match(/boundary=(.+)/)

      if (!boundaryMatch) {
        return res.status(400).json({
          error: 'Invalid file upload'
        })
      }

      const boundary =
        Buffer.from('--' + boundaryMatch[1])

      const parts = splitMultipart(body, boundary)

      let fileBuffer = null
      let fileName = null

      for (const part of parts) {

        const headerEnd =
          part.indexOf(
            Buffer.from('\r\n\r\n')
          )

        if (headerEnd === -1) {
          continue
        }

        const headers =
          part
            .slice(0, headerEnd)
            .toString()

        const content =
          part.slice(headerEnd + 4)

        const nameMatch =
          headers.match(
            /filename="([^"]+)"/
          )

        if (nameMatch) {

          fileName = nameMatch[1]

          fileBuffer = content

          if (
            fileBuffer
              .slice(-2)
              .toString() === '\r\n'
          ) {
            fileBuffer =
              fileBuffer.slice(0, -2)
          }

          break
        }
      }

      if (!fileBuffer || !fileName) {
        return res.status(400).json({
          error: 'No file selected'
        })
      }

      const filePath =
        Date.now() + '-' + fileName

      const { error } =
        await supabase
          .storage
          .from('files')
          .upload(
            filePath,
            fileBuffer,
            {
              contentType:
                req.headers['content-type'],
              upsert: false
            }
          )

      if (error) {
        return res.status(500).json({
          error: error.message
        })
      }

      const { data: publicData } =
        supabase
          .storage
          .from('files')
          .getPublicUrl(filePath)

      res.status(201).json({
        name: fileName,
        url: publicData.publicUrl
      })

    })

  } catch (error) {

    res.status(500).json({
      error: error.message
    })

  }

})


// Split multipart data

function splitMultipart(buffer, boundary) {

  const parts = []

  let start = 0

  while (true) {

    const index =
      buffer.indexOf(boundary, start)

    if (index === -1) {
      break
    }

    if (index > start) {

      parts.push(
        buffer.slice(start, index)
      )

    }

    start =
      index + boundary.length

  }

  return parts
}


// ==================== SERVER ====================

const PORT = 5000

app.listen(PORT, () => {

  console.log(
    `Server running on http://localhost:${PORT}`
  )

})
