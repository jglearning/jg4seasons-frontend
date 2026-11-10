import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '../../shared/ui/Button'
import { Table, type Column } from '../../shared/ui/Table'
import { TextField } from '../../shared/ui/TextField'
import { shortDate } from './format'
import {
  cancelSession,
  sessionsQuery,
  teacherClassesQuery,
  updateSession,
  type SessionItem,
} from './teacherApi'
import { TeacherLoadState } from './TeacherLoadState'
import { useSubmit } from './useSubmit'
import styles from './Teacher.module.css'

// T-06 진도표(03 §4.5~§4.7, 백엔드 ADR-30). 1차는 날짜 바꾸기(이후 수업도 같이 밀기)·휴강·메모만 —
// 보강(날짜 추가)·회차 순서 바꾸기는 2차. 날짜 밀기는 서버가 하고 화면은 응답(진도표 전체, seq 다시 매김)을 그대로 그린다.
// 메모는 모든 행(지난 수업·휴강 행도 서버가 받음). 날짜·휴강은 서버 status가 예정인 행만 —
// "지난 수업"은 서버가 날짜로 판정해 409 SESSION_PAST로 거절하므로 화면은 날짜로 판단하지 않고 그 문구를 보인다
const STATUS_LABEL: Record<SessionItem['status'], string> = {
  scheduled: '예정',
  done: '지난 수업',
  cancelled: '휴강',
}

type Action = { kind: 'date' | 'cancel' | 'note'; session: SessionItem }

const ACTION_TITLE: Record<Action['kind'], string> = {
  date: '날짜 바꾸기',
  cancel: '휴강',
  note: '메모',
}

export function SessionsPage() {
  const classId = Number(useParams().id)
  const queryClient = useQueryClient()
  const classes = useQuery(teacherClassesQuery)
  const sessions = useQuery(sessionsQuery(classId))
  const klass = classes.data?.items.find((c) => c.id === classId)
  const [action, setAction] = useState<Action | null>(null)
  const [done, setDone] = useState<string | null>(null)

  function open(next: Action) {
    setDone(null)
    setAction(next)
  }

  function applied(items: SessionItem[], message: string) {
    // 응답이 바뀐 진도표 전체 — 바로 그리고, 매트릭스·반 목록(다음 수업·지금 회차)도 다시 받게 한다
    queryClient.setQueryData(sessionsQuery(classId).queryKey, { items })
    void queryClient.invalidateQueries({ queryKey: ['teacher'] })
    setAction(null)
    setDone(message)
  }

  const columns: Column<SessionItem>[] = [
    { key: 'seq', header: '회차', numeric: true, cell: (s) => `${s.seq}회` },
    { key: 'date', header: '날짜', cell: (s) => shortDate(s.scheduledDate) },
    {
      key: 'lesson',
      header: '내용',
      cell: (s) => (
        <>
          {s.lesson.title} <span className={styles.lessonCode}>{s.lesson.code}</span>
        </>
      ),
    },
    { key: 'status', header: '상태', cell: (s) => STATUS_LABEL[s.status] },
    { key: 'note', header: '메모', cell: (s) => s.note ?? '—' },
    {
      key: 'actions',
      header: '바꾸기',
      cell: (s) => (
        <div className={styles.rowActions}>
          {s.status === 'scheduled' && (
            <>
              <Button
                variant="secondary"
                size="teacher"
                aria-label={`${s.seq}회 날짜 바꾸기`}
                onClick={() => open({ kind: 'date', session: s })}
              >
                날짜
              </Button>
              <Button
                variant="secondary"
                size="teacher"
                aria-label={`${s.seq}회 휴강`}
                onClick={() => open({ kind: 'cancel', session: s })}
              >
                휴강
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="teacher"
            aria-label={`${s.seq}회 메모`}
            onClick={() => open({ kind: 'note', session: s })}
          >
            메모
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Link to={`/teacher/classes/${classId}`} className={styles.back}>
        ← {klass ? `${klass.name} 청취 현황` : '청취 현황'}
      </Link>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{klass ? `${klass.name} 진도표` : '진도표'}</h1>
          <p className={styles.sub}>날짜를 바꾸거나 휴강하면 뒤 수업 날짜가 밀립니다</p>
        </div>
      </div>
      {done && (
        <p className={styles.done} role="status">
          {done}
        </p>
      )}
      {action && (
        <ActionPanel
          key={`${action.kind}-${action.session.seq}`}
          classId={classId}
          action={action}
          onClose={() => setAction(null)}
          onApplied={applied}
        />
      )}
      {sessions.data ? (
        <Table
          caption="진도표"
          columns={columns}
          rows={sessions.data.items}
          rowKey={(s) => s.seq}
          empty="수업이 없습니다"
          // 휴강 행은 회색 배경 + 상태 "휴강" — 줄 긋기는 "그 회차가 없어짐"으로 읽혀서 쓰지 않는다(회차는 다음 행으로 밀림)
          mutedRow={(s) => s.status === 'cancelled'}
        />
      ) : (
        <TeacherLoadState query={sessions} />
      )}
    </>
  )
}

function ActionPanel({
  classId,
  action,
  onClose,
  onApplied,
}: {
  classId: number
  action: Action
  onClose: () => void
  onApplied: (items: SessionItem[], message: string) => void
}) {
  const { kind, session } = action
  const [date, setDate] = useState(session.scheduledDate)
  const [shift, setShift] = useState(true)
  const [note, setNote] = useState(session.note ?? '')
  const submit = useSubmit()
  const title = `${session.seq}회 ${ACTION_TITLE[kind]}`

  async function save() {
    // 메모 칸은 지금 메모로 채워 둔다. 4.6·4.7 모두 note를 안 보내면 원래 메모, 빈 글자 = 지움(BE #42)이라
    // 날짜 바꾸기·휴강은 메모를 바꿨을 때만 같이 보낸다
    const trimmed = note.trim()
    const noteChanged = trimmed !== (session.note ?? '')
    if (kind === 'cancel') {
      const cancelNote = noteChanged ? trimmed : undefined
      const result = await submit.run(() => cancelSession(classId, session.seq, cancelNote))
      if (result) onApplied(result.items, `${session.seq}회(${session.lesson.title}) 휴강함`)
      return
    }
    const body =
      kind === 'date'
        ? { scheduledDate: date, shiftFollowing: shift, ...(noteChanged ? { note: trimmed } : {}) }
        : { note: trimmed }
    const result = await submit.run(() => updateSession(classId, session.seq, body))
    if (result)
      onApplied(
        result.items,
        kind === 'date'
          ? `${session.seq}회 날짜를 ${shortDate(date)}로 바꿈`
          : `${session.seq}회 메모 저장함`,
      )
  }

  // 패널은 표 위에 열린다 — 아래쪽 행에서 눌러도 보이게 제목으로 포커스를 옮긴다(화면이 그쪽으로 스크롤)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const error = submit.formError(['scheduledDate', 'note'])
  return (
    <section className={styles.panel} aria-label={title}>
      <h2 className={styles.panelTitle} ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      <p className={styles.muted}>
        {session.lesson.title} · 지금 날짜 {shortDate(session.scheduledDate)}
      </p>
      {kind === 'date' && (
        <>
          <TextField
            size="teacher"
            type="date"
            label="새 날짜"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={submit.fieldError('scheduledDate')}
          />
          <label className={styles.check}>
            <input type="checkbox" checked={shift} onChange={(e) => setShift(e.target.checked)} />
            이후 수업도 같이 밀기
          </label>
        </>
      )}
      {kind === 'cancel' && (
        <p className={styles.notice}>
          휴강하면 이 회차부터 뒤 수업 날짜가 모두 다음 수업일로 밀립니다
        </p>
      )}
      <TextField
        size="teacher"
        label={kind === 'cancel' ? '메모(휴강 이유)' : '메모'}
        value={note}
        maxLength={100}
        onChange={(e) => setNote(e.target.value)}
        error={submit.fieldError('note')}
      />
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button
          size="teacher"
          onClick={() => void save()}
          disabled={submit.pending || (kind === 'date' && date === '')}
        >
          {submit.pending ? '저장 중' : kind === 'cancel' ? '휴강하기' : '저장'}
        </Button>
        <Button variant="secondary" size="teacher" onClick={onClose}>
          취소
        </Button>
      </div>
    </section>
  )
}
