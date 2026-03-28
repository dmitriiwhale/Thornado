import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import defaultAvatar from '../../assets/thornado-hammer.png'
import { useSession } from '../../hooks/useSession.js'

const MAX_UPLOAD_BYTES = 450_000

/**
 * Resize + JPEG blob for gateway (max ~512KB raw; we stay under after base64 overhead).
 */
function fileToJpegBlob(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let w = img.naturalWidth
        let h = img.naturalHeight
        if (!w || !h) {
          reject(new Error('Invalid image dimensions'))
          return
        }
        const maxDim = 256
        const scale = Math.min(1, maxDim / Math.max(w, h))
        w = Math.round(w * scale)
        h = Math.round(h * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas unavailable'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)

        let q = 0.88
        const attempt = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('encode failed'))
                return
              }
              if (blob.size <= MAX_UPLOAD_BYTES || q <= 0.42) {
                resolve(blob)
                return
              }
              q -= 0.06
              attempt()
            },
            'image/jpeg',
            q,
          )
        }
        attempt()
      }
      img.onerror = () => reject(new Error('Could not decode image'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('Read failed'))
    reader.readAsDataURL(file)
  })
}

export default function PortfolioAvatar({ walletAddress, className = '' }) {
  const { data: session, isLoading: sessionLoading } = useSession()
  const fileRef = useRef(null)
  const [blobUrl, setBlobUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState(null)

  const sessionAddr = session?.address?.toLowerCase()
  const wallet = walletAddress ? String(walletAddress).toLowerCase() : ''
  const canAccess =
    !sessionLoading &&
    Boolean(sessionAddr && wallet && sessionAddr === wallet)

  const revokeAndSet = useCallback((next) => {
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return next
    })
  }, [])

  const loadFromServer = useCallback(async () => {
    if (!canAccess) {
      revokeAndSet(null)
      return
    }
    try {
      const r = await fetch('/api/profile/avatar', { credentials: 'include' })
      if (r.ok) {
        const blob = await r.blob()
        revokeAndSet(URL.createObjectURL(blob))
      } else {
        revokeAndSet(null)
      }
    } catch {
      revokeAndSet(null)
    }
  }, [canAccess, revokeAndSet])

  useEffect(() => {
    if (sessionLoading) return
    void loadFromServer()
  }, [sessionLoading, canAccess, loadFromServer])

  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(null), 5000)
    return () => window.clearTimeout(t)
  }, [hint])

  useEffect(
    () => () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    },
    [],
  )

  const onPick = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !canAccess) return
      if (!file.type.startsWith('image/')) {
        setHint('Choose an image file.')
        return
      }
      setBusy(true)
      setHint(null)
      try {
        const jpegBlob = await fileToJpegBlob(file)
        const fd = new FormData()
        fd.append('avatar', jpegBlob, 'avatar.jpg')
        const r = await fetch('/api/profile/avatar', {
          method: 'PUT',
          body: fd,
          credentials: 'include',
        })
        if (r.status === 503) {
          setHint('Avatar storage is not configured on the server.')
          return
        }
        if (!r.ok) {
          const errText = await r.text().catch(() => '')
          setHint(
            errText || `Could not save (${r.status}). Try a smaller image.`,
          )
          return
        }
        await loadFromServer()
      } catch {
        setHint('Could not use this image.')
      } finally {
        setBusy(false)
      }
    },
    [canAccess, loadFromServer],
  )

  const showCustom = Boolean(blobUrl)
  const src = showCustom ? blobUrl : defaultAvatar

  return (
    <div className={`relative flex shrink-0 flex-col gap-0.5 ${className}`}>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={onPick}
        disabled={busy || !walletAddress || !canAccess}
      />
      <button
        type="button"
        disabled={busy || !walletAddress || !canAccess}
        onClick={() => fileRef.current?.click()}
        className="group relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-950/90 ring-1 ring-white/15 transition hover:ring-violet-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50"
        aria-label="Change portfolio avatar"
        title={
          canAccess
            ? 'Change avatar'
            : 'Sign in with this wallet to set an avatar'
        }
      >
        <img
          src={src}
          alt=""
          className={
            showCustom
              ? 'h-full w-full object-cover'
              : 'h-full w-full object-contain p-1.5 opacity-95'
          }
          draggable={false}
        />
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/90" />
          ) : (
            <Camera className="h-4 w-4 text-white/95" strokeWidth={2} />
          )}
        </span>
      </button>
      {hint ? (
        <p className="max-w-[13rem] text-[10px] leading-snug text-amber-200/95 sm:max-w-none">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
