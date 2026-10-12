
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import '../css/components.css'

const BUCKET = 'profile-photos'

function Sidebar() {
  const [profileName, setProfileName] = useState('User')
  const [avatarPath, setAvatarPath] = useState('')
  const [avatarPreset, setAvatarPreset] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [imageFailed, setImageFailed] = useState(false)

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setProfileName('User')
        setAvatarPath('')
        setAvatarPreset('')
        setAvatarUrl('')
        setImageFailed(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('name, avatar_path, avatar_preset')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Error loading sidebar profile:', error.message)
      }

      const latestName =
        data?.name?.trim() ||
        user.user_metadata?.name?.trim() ||
        user.email?.split('@')[0] ||
        'User'

      setProfileName(latestName)
      setAvatarPreset(data?.avatar_preset || '')
      setAvatarPath(data?.avatar_path || '')
      setAvatarUrl('')
      setImageFailed(false)

      if (data?.avatar_path) {
        const { data: signedData, error: signedError } =
          await supabase.storage
            .from(BUCKET)
            .createSignedUrl(data.avatar_path, 3600)

        if (signedError) {
          console.error('Error loading sidebar photo:', signedError.message)
        } else {
          setAvatarUrl(signedData?.signedUrl || '')
        }
      }
    } catch (error) {
      console.error('Unexpected sidebar profile error:', error)
    }
  }, [])

  useEffect(() => {
    loadProfile()

    const handleProfileUpdated = () => {
      loadProfile()
    }

    window.addEventListener('profile-updated', handleProfileUpdated)

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => {
      window.removeEventListener(
        'profile-updated',
        handleProfileUpdated
      )
      subscription.unsubscribe()
    }
  }, [loadProfile])

  return (
    <aside className="sidebar">
      <h2>TeamHub</h2>

      <nav>
        <Link to="/dashboard">🏠 Dashboard</Link>
        <Link to="/team">👥 Teams</Link>
        <Link to="/chat">💬 Messages</Link>
        <Link to="/tasks">📋 Tasks</Link>
        <Link to="/files">📁 Files</Link>
        <Link to="/profile">👤 Profile</Link>
      </nav>

      <div className="sidebar-profile">
        <div className="avatar sidebar-user-avatar">
          {avatarUrl && !imageFailed ? (
            <img
              src={avatarUrl}
              alt={`${profileName}'s profile`}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span>
              {avatarPreset || profileName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="sidebar-profile-info">
          <strong>{profileName}</strong>
          <small>Workspace Member</small>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
