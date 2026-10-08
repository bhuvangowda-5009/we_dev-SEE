import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../supabase'
import '../css/dashboard.css'

function Files() {

  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [downloading, setDownloading] = useState(null)


  // ==================== LOAD FILES ====================

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {

    setRefreshing(true)

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

      console.log('Error loading files:', error)

      alert(error.message)

      setRefreshing(false)

      return
    }

    const fileList = data
      .filter(file => file.name)
      .map(file => {

        const { data: urlData } =
          supabase
            .storage
            .from('files')
            .getPublicUrl(file.name)

        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0
        }

      })

    setFiles(fileList)

    setRefreshing(false)
  }


  // ==================== SELECT FILE ====================

  const handleFileChange = (event) => {

    const file = event.target.files[0]

    if (file) {

      setSelectedFile(file)

    }
  }


  // ==================== UPLOAD FILE ====================

  const uploadFile = async () => {

    if (!selectedFile) {

      alert('Please select a file first')

      return
    }

    setLoading(true)

    const fileName =
      Date.now() + '-' + selectedFile.name

    const { error } =
      await supabase
        .storage
        .from('files')
        .upload(
          fileName,
          selectedFile,
          {
            contentType: selectedFile.type,
            upsert: false
          }
        )

    if (error) {

      console.log('Upload error:', error)

      alert(error.message)

      setLoading(false)

      return
    }

    alert('File uploaded successfully')

    setSelectedFile(null)

    document.getElementById('fileInput').value = ''

    await loadFiles()

    setLoading(false)
  }


  // ==================== DOWNLOAD FILE ====================

  const downloadFile = async (file) => {

    try {

      setDownloading(file.name)

      const { data, error } =
        await supabase
          .storage
          .from('files')
          .download(file.name)

      if (error) {

        console.log('Download error:', error)

        alert(error.message)

        return
      }

      const downloadUrl =
        window.URL.createObjectURL(data)

      const link =
        document.createElement('a')

      link.href = downloadUrl

      link.download = file.name

      document.body.appendChild(link)

      link.click()

      document.body.removeChild(link)

      window.URL.revokeObjectURL(downloadUrl)

    } catch (error) {

      console.log('Download error:', error)

      alert('Unable to download the file')

    } finally {

      setDownloading(null)

    }
  }


  // ==================== PAGE ====================

  return (

    <div className="dashboard">

      <Sidebar />

      <main className="dashboard-content">


        {/* ==================== HEADER ==================== */}

        <header className="dashboard-header">

          <div>

            <h1>Files</h1>

            <p>
              Share and manage files with your team.
            </p>

          </div>


          <label className="create-button">

            + Upload File

            <input
              id="fileInput"
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

          </label>

        </header>


        {/* ==================== SELECTED FILE ==================== */}

        {selectedFile && (

          <section className="dashboard-card">

            <div className="card-title">

              <h2>Selected File</h2>

            </div>


            <div className="task-item">

              <div>

                <h3>
                  {selectedFile.name}
                </h3>

                <p>
                  {(
                    selectedFile.size /
                    1024 /
                    1024
                  ).toFixed(2)} MB
                </p>

              </div>


              <button
                className="create-button"
                onClick={uploadFile}
                disabled={loading}
              >

                {loading
                  ? 'Uploading...'
                  : 'Upload'}

              </button>

            </div>

          </section>

        )}


        {/* ==================== SHARED FILES ==================== */}

        <section className="dashboard-card">

          <div className="card-title">

            <h2>Shared Files</h2>

            <button
              onClick={loadFiles}
              disabled={refreshing}
            >

              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}

            </button>

          </div>


          {files.length === 0 ? (

            <p>
              No files uploaded yet.
            </p>

          ) : (

            files.map(file => (

              <div
                className="task-item"
                key={file.name}
              >

                <div>

                  <h3>
                    {file.name}
                  </h3>

                  <p>
                    Uploaded by Bhuvan
                  </p>

                </div>


                <button
                  onClick={() =>
                    downloadFile(file)
                  }
                  disabled={downloading !== null}
                >

                  {downloading === file.name
                    ? 'Downloading...'
                    : 'Download'}

                </button>

              </div>

            ))

          )}

        </section>


      </main>

    </div>

  )
}

export default Files