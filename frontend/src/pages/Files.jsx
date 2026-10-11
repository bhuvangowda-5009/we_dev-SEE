
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import '../css/dashboard.css'

const API_ROOT = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '')

const API_URL = API_ROOT.endsWith('/api')
  ? API_ROOT
  : `${API_ROOT}/api`

function Files() {
  const [teams, setTeams] = useState([])
  const [filesByTeam, setFilesByTeam] = useState({})
  const [selectedFiles, setSelectedFiles] = useState({})
  const [loadingTeam, setLoadingTeam] = useState(null)
  const [uploadingTeam, setUploadingTeam] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const getHeaders = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()

    if (error) throw error

    const token = data.session?.access_token

    if (!token) {
      throw new Error('Your session has expired. Please log in again.')
    }

    return { Authorization: `Bearer ${token}` }
  }, [])

  const loadTeamFiles = useCallback(async (teamId) => {
    setLoadingTeam(String(teamId))

    try {
      const headers = await getHeaders()
      const params = new URLSearchParams({
        team_id: String(teamId)
      })

      const response = await fetch(
        `${API_URL}/files?${params}`,
        { headers }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load team files.')
      }

      setFilesByTeam(previous => ({
        ...previous,
        [teamId]: Array.isArray(data) ? data : []
      }))
    } catch (err) {
      setError(err.message || 'Unable to load files.')
    } finally {
      setLoadingTeam(null)
    }
  }, [getHeaders])

  const loadTeamsAndFiles = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const headers = await getHeaders()

      const response = await fetch(`${API_URL}/teams`, { headers })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load teams.')
      }

      const teamList = Array.isArray(data) ? data : []
      setTeams(teamList)

      const results = await Promise.all(
        teamList.map(async team => {
          try {
            const params = new URLSearchParams({
              team_id: String(team.id)
            })

            const fileResponse = await fetch(
              `${API_URL}/files?${params}`,
              { headers }
            )

            const fileData = await fileResponse.json()

            if (!fileResponse.ok) {
              return {
                id: team.id,
                files: [],
                error: fileData.error || 'Unable to load files.'
              }
            }

            return {
              id: team.id,
              files: Array.isArray(fileData) ? fileData : [],
              error: ''
            }
          } catch {
            return {
              id: team.id,
              files: [],
              error: 'Unable to load this team’s files.'
            }
          }
        })
      )

      const grouped = {}

      results.forEach(result => {
        grouped[result.id] = result.files
      })

      setFilesByTeam(grouped)

      const failed = results.find(result => result.error)

      if (failed) setError(failed.error)
    } catch (err) {
      setError(err.message || 'Unable to load teams.')
    } finally {
      setLoading(false)
    }
  }, [getHeaders])

  useEffect(() => {
    loadTeamsAndFiles()
  }, [loadTeamsAndFiles])

  const handleFileChange = (teamId, event) => {
    const file = event.target.files?.[0] || null

    setSelectedFiles(previous => ({
      ...previous,
      [teamId]: file
    }))
  }

  const uploadFile = async team => {
    const file = selectedFiles[team.id]

    if (!file) {
      setError(`Select a file for ${team.name} first.`)
      return
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('Maximum file size is 25 MB.')
      return
    }

    setUploadingTeam(String(team.id))
    setError('')

    try {
      const headers = await getHeaders()
      headers['Content-Type'] = 'application/octet-stream'

      const params = new URLSearchParams({
        team_id: String(team.id),
        name: file.name
      })

      const response = await fetch(`${API_URL}/files?${params}`, {
        method: 'POST',
        headers,
        body: file
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'File upload failed.')
      }

      setSelectedFiles(previous => ({
        ...previous,
        [team.id]: null
      }))

      const input = document.getElementById(`file-input-${team.id}`)

      if (input) input.value = ''

      await loadTeamFiles(team.id)
    } catch (err) {
      setError(err.message || 'Unable to upload file.')
    } finally {
      setUploadingTeam(null)
    }
  }

  const downloadFile = async (team, file) => {
    const downloadKey = `${team.id}-${file.name}`

    setDownloading(downloadKey)
    setError('')

    try {
      const headers = await getHeaders()

      const response = await fetch(
        `${API_URL}/files/${team.id}/${encodeURIComponent(file.name)}`,
        { headers }
      )

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Download failed.')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      link.remove()

      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message || 'Unable to download file.')
    } finally {
      setDownloading(null)
    }
  }

  const formatSize = bytes => {
    if (bytes < 1024) return `${bytes} B`

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  if (loading) {
    return (
      <main className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <h1>Team Files</h1>
            <p>Files organized by team.</p>
          </div>
        </header>

        <section className="dashboard-card">
          <p>Loading your teams and files...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard-content">
      <header className="dashboard-header">
        <div>
          <h1>Team Files</h1>
          <p>Upload, organize and download files for each team.</p>
        </div>

        <button
          className="create-button"
          onClick={loadTeamsAndFiles}
          disabled={loadingTeam !== null || uploadingTeam !== null}
        >
          ↻ Refresh
        </button>
      </header>

      {error && (
        <section className="dashboard-card" role="alert">
          <p>{error}</p>
        </section>
      )}

      {teams.length === 0 ? (
        <section className="dashboard-card">
          <h2>No teams available</h2>
          <p>Join or create a team to start sharing files.</p>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {teams.map(team => {
            const files = filesByTeam[team.id] || []
            const selectedFile = selectedFiles[team.id]
            const isUploading = uploadingTeam === String(team.id)

            return (
              <section
                className="dashboard-card"
                key={team.id}
              >
                <div
                  className="card-title"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <h2>📁 {team.name}</h2>

                    <p>
                      {files.length}{' '}
                      {files.length === 1 ? 'file' : 'files'}
                      {' · '}Team Code: {team.join_code || 'Not available'}
                    </p>
                  </div>

                  <button
                    onClick={() => loadTeamFiles(team.id)}
                    disabled={loadingTeam === String(team.id)}
                  >
                    {loadingTeam === String(team.id)
                      ? 'Refreshing...'
                      : 'Refresh files'}
                  </button>
                </div>

                <div style={{ margin: '16px 0' }}>
                  <label
                    htmlFor={`file-input-${team.id}`}
                    style={{
                      display: 'block',
                      marginBottom: '8px'
                    }}
                  >
                    Upload to {team.name}
                  </label>

                  <input
                    id={`file-input-${team.id}`}
                    type="file"
                    onChange={event => handleFileChange(team.id, event)}
                    disabled={isUploading}
                  />

                  {selectedFile && (
                    <div
                      className="task-item"
                      style={{ marginTop: '12px' }}
                    >
                      <div>
                        <h3>{selectedFile.name}</h3>
                        <p>{formatSize(selectedFile.size)}</p>
                      </div>

                      <button
                        className="create-button"
                        onClick={() => uploadFile(team)}
                        disabled={isUploading}
                      >
                        {isUploading ? 'Uploading...' : 'Upload file'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="card-title">
                  <h3>Shared files</h3>
                </div>

                {loadingTeam === String(team.id) ? (
                  <p>Loading files...</p>
                ) : files.length === 0 ? (
                  <p>No files uploaded to this team yet.</p>
                ) : (
                  files.map(file => {
                    const key = `${team.id}-${file.name}`

                    return (
                      <div className="task-item" key={key}>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ overflowWrap: 'anywhere' }}>
                            📄 {file.name}
                          </h3>

                          <p>{formatSize(file.size)}</p>
                        </div>

                        <button
                          onClick={() => downloadFile(team, file)}
                          disabled={downloading !== null}
                        >
                          {downloading === key
                            ? 'Downloading...'
                            : 'Download'}
                        </button>
                      </div>
                    )
                  })
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default Files
