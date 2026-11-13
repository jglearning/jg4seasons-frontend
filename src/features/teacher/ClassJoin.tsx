import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { qrClassJoinUrl } from '../../shared/qrJoin'
import { Button } from '../../shared/ui/Button'
import { QrSvg } from '../../shared/ui/QrCode'
import { useQrLibrary } from '../../shared/ui/useQrLibrary'
import styles from './ClassJoin.module.css'

// T-02 반 카드의 입장 QR·링크 복사(#71, BE #52·#53 ADR 0033). 주소는 # 뒤 가입 코드만(서버·CDN 로그에 남지 않게).
// 찍으면 학생은 개인 코드 4자리만 친다(S-01 반 QR). QR은 화면에서 바로 만든다 — 외부 서비스에 코드를 보내지 않는다
type ClassJoinProps = { className: string; accessCode: string }

const COPIED_MS = 3000

export function ClassJoinActions({ className, accessCode }: ClassJoinProps) {
  const [open, setOpen] = useState(false)
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const url = qrClassJoinUrl(window.location.origin, accessCode)

  useEffect(() => {
    if (copy !== 'copied') return
    const timer = setTimeout(() => setCopy('idle'), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copy])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopy('copied')
    } catch {
      // 권한 거부·http 등 — 링크를 글자로 보여 직접 복사하게
      setCopy('failed')
    }
  }

  return (
    <>
      <div className={styles.actions}>
        <Button
          size="teacher"
          variant="secondary"
          aria-label={`${className} 입장 QR`}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          입장 QR
        </Button>
        <Button
          size="teacher"
          variant="secondary"
          aria-label={`${className} 입장 링크 복사`}
          onClick={() => void copyLink()}
        >
          입장 링크 복사
        </Button>
      </div>
      <p className={styles.copyLine} role="status">
        {copy === 'copied' && '링크를 복사함'}
        {copy === 'failed' && (
          <>
            복사하지 못함 — <span className={styles.url}>{url}</span>
          </>
        )}
      </p>
      {open && (
        <ClassQrDialog
          className={className}
          accessCode={accessCode}
          url={url}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** 교실 화면에 크게 띄우는 반 QR — 화면 전체를 덮는다. Esc·닫기로 닫고, 포커스는 연 버튼으로 */
function ClassQrDialog({
  className,
  accessCode,
  url,
  onClose,
}: ClassJoinProps & { url: string; onClose: () => void }) {
  const titleId = useId()
  const qr = useQrLibrary()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => opener?.focus?.()
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    // Tab은 창 안에서만
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button') ?? [])]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={panelRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
    >
      <div className={styles.top}>
        <h2 id={titleId} className={styles.title}>
          {className} <span className={styles.titleSub}>입장 QR</span>
        </h2>
        <Button ref={closeRef} size="teacher" variant="secondary" onClick={onClose}>
          <X size={18} strokeWidth={2} aria-hidden />
          닫기
        </Button>
      </div>
      <div className={styles.body}>
        {qr.status === 'ready' && (
          <QrSvg
            className={styles.qr}
            create={qr.create}
            text={url}
            label={`${className} 입장 QR 코드`}
          />
        )}
        {qr.status === 'failed' && <p className={styles.url}>{url}</p>}
        {/* 코드 글자는 이름 없이(간단하게) — QR을 못 읽는 폰은 이것을 보고 친다(동섭 11/14) */}
        <p className={styles.code}>
          {accessCode.slice(0, 4)} {accessCode.slice(4)}
        </p>
        {/* 교실 화면에 띄우면 학생이 읽는다 — 학생 말투 */}
        <p className={styles.hint}>폰 카메라로 찍고 개인 코드 4자리를 입력해요</p>
      </div>
    </div>
  )
}
