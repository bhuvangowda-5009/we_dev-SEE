
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import './AvatarPicker.css'

const BUCKET = 'profile-photos'

const PRESET_AVATARS = [
  '😀', '😎', '🤓', '🧑‍💻',
  '👨‍💻', '👩‍💻', '🦊', '🐼',
  '🐱', '🦁', '🚀', '🌟'
]

export default function AvatarPicker() {
  const [user, setUser] = useState(null)
  const [preset, setPreset] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [editingPhoto, setEditingPhoto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [imageFailed, setImageFailed] = useState(false)

  const loadAvatar = useCallback(async () => {
    setLoading(true)

    try {
      const {
        data: { user: currentUser },
        error: authError
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!currentUser) throw new Error('Please log in first.')

      setUser(currentUser)

      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_path, avatar_preset')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (error) throw error

      setPreset(data?.avatar_preset || '')
      setPhotoUrl('')
      setImageFailed(false)

      if (data?.avatar_path) {
        const { data: signedData, error: signedError } =
          await supabase.storage
            .from(BUCKET)
            .createSignedUrl(data.avatar_path, 3600)

        if (signedError) throw signedError

        setPhotoUrl(signedData.signedUrl)
      }
    } catch (error) {
      console.error('Load avatar error:', error)
      setMessage(error.message || 'Unable to load profile photo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAvatar()
  }, [loadAvatar])

  async function saveChoice(values) {
    if (!user) throw new Error('Please log in again.')

    const { data: existing, error: findError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError) throw findError

    if (existing) {
      const { error } = await supabase
        .from('profiles')
        .update(values)
        .eq('user_id', user.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          email: user.email,
          name:
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'User',
          ...values
        })

      if (error) throw error
    }
  }

  async function handleUpload(event) {
    const input = event.target
    const file = input.files?.[0]
    input.value = ''

    if (!file || !user) return

    if (!file.type.startsWith('image/')) {
      setMessage('Please choose a valid image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('Please choose an image smaller than 5 MB.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const extension = (
        file.name.split('.').pop() || 'jpg'
      ).toLowerCase()

      const safeExtension = /^[a-z0-9]+$/.test(extension)
        ? extension
        : 'jpg'

      const path = `${user.id}/${Date.now()}.${safeExtension}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type
        })

      if (uploadError) throw uploadError

      await saveChoice({
        avatar_path: path,
        avatar_preset: null
      })

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600)

      if (error) throw error

      setPhotoUrl(data.signedUrl)
      setPreset('')
      setImageFailed(false)
      setEditingPhoto(false)
      setMessage('Profile photo updated successfully.')
    } catch (error) {
      console.error('Photo upload error:', error)
      setMessage(`Upload failed: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handlePreset(emoji) {
    setSaving(true)
    setMessage('')

    try {
      await saveChoice({
        avatar_path: null,
        avatar_preset: emoji
      })

      setPhotoUrl('')
      setPreset(emoji)
      setImageFailed(false)
      setEditingPhoto(false)
      setMessage('Profile avatar updated.')
    } catch (error) {
      console.error('Avatar save error:', error)
      setMessage(error.message || 'Unable to save avatar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="profile-avatar-loading">Loading profile...</div>
  }

  return (
    <section className="profile-avatar-section">
      <div className="profile-avatar-row">
        <div className="profile-avatar-circle">
          {photoUrl && !imageFailed ? (
            <img
              src={photoUrl}
              alt="Profile"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span>{preset || '👤'}</span>
          )}
        </div>

        <div className="profile-avatar-details">
          <h3>Profile Photo</h3>
          <p>Personalize your account picture.</p>
        </div>

        <button
          type="button"
          className="profile-avatar-edit"
          onClick={() => {
            setEditingPhoto(value => !value)
            setMessage('')
          }}
          disabled={saving}
        >
          {editingPhoto ? 'Cancel' : 'Edit Photo'}
        </button>
      </div>

      {editingPhoto && (
        <div className="profile-avatar-editor">
          <label className="profile-upload-button">
            {saving ? 'Saving...' : 'Upload Photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleUpload}
              disabled={saving}
              hidden
            />
          </label>

          <p className="profile-avatar-subtitle">Or choose an avatar</p>

          <div className="profile-avatar-presets">
            {PRESET_AVATARS.map(emoji => (
              <button
                key={emoji}
                type="button"
                className={
                  preset === emoji
                    ? 'profile-avatar-preset selected'
                    : 'profile-avatar-preset'
                }
                onClick={() => handlePreset(emoji)}
                disabled={saving}
                aria-label={`Choose ${emoji} avatar`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {message && (
        <p className="profile-avatar-message" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
