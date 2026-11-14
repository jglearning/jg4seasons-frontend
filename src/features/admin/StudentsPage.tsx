import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { errorMessage } from '../../shared/errorMessage'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { SelectField } from '../../shared/ui/SelectField'
import { Table, type Column } from '../../shared/ui/Table'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { classesQuery, classQuery, type AdminClass } from './adminApi'
import { ADMIN_COPY } from './adminCopy'
import { CodeCards } from './CodeCards'
import { koreaShortDateTime, studentStatusLabel } from './format'
import {
  moveStudent,
  regeneratePersonalCodes,
  setStudentStatus,
  studentsQuery,
  type AdminStudent,
  type PersonalCodeItem,
} from './studentsApi'
import { useSubmit } from '../../shared/useSubmit'
import styles from './Admin.module.css'

// A-02 학생 명단(03 §5.2): 명단 표, 여러 명 개인 코드 재발급(AUTH-05 묶음), 반 이동·퇴원(ADM-06 최소).
// 명단은 지금 이 반 학생만 온다(BE #30) — 퇴원하면 명단에서 빠지고, 퇴원생 찾기·복귀는 학원 전체 검색과 함께 2차.
// 확인창 대신 화면 안에서 한 번 더 누른다(A-01 가입 코드 재발급과 같은 방식)
export function StudentsPage() {
  const classId = Number(useParams().id)
  const klass = useQuery(classQuery(classId))
  const roster = useQuery(studentsQuery(classId))

  return (
    <>
      <Link to={`/admin/classes/${classId}`} className={styles.back}>
        ← {klass.data?.name ?? '반 상세'}
      </Link>
      {klass.data && roster.data ? (
        <Roster klass={klass.data} students={roster.data.items} />
      ) : (
        <StaffLoadState query={klass.isError ? klass : roster} />
      )}
    </>
  )
}

type RowAction = { kind: 'move' | 'withdraw'; student: AdminStudent }

function Roster({ klass, students }: { klass: AdminClass; students: AdminStudent[] }) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<number[]>([])
  const [confirming, setConfirming] = useState(false)
  const [issued, setIssued] = useState<PersonalCodeItem[] | null>(null)
  const [action, setAction] = useState<RowAction | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const regen = useSubmit(ADMIN_COPY)

  const active = students.filter((s) => s.status === 'active')
  // 퇴원했거나 다른 반으로 간 학생은 선택에서 뺀다
  const selectedActive = selected.filter((id) => active.some((s) => s.id === id))

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  function toggle(id: number, on: boolean) {
    setSelected((before) => (on ? [...before, id] : before.filter((x) => x !== id)))
  }

  async function regenerate() {
    const items = await regen.run(() => regeneratePersonalCodes(klass.id, selectedActive))
    setConfirming(false)
    if (items === undefined) return
    setIssued(items)
    setSelected([])
    setDone(null)
    refresh()
  }

  function openAction(next: RowAction) {
    setAction(next)
    setDone(null)
  }

  const columns: Column<AdminStudent>[] = [
    {
      key: 'select',
      header: '선택',
      cell: (s) =>
        s.status === 'active' ? (
          <input
            type="checkbox"
            className={styles.rowCheck}
            aria-label={`${s.name} 선택`}
            checked={selectedActive.includes(s.id)}
            onChange={(e) => toggle(s.id, e.target.checked)}
          />
        ) : null,
    },
    { key: 'name', header: '이름', cell: (s) => s.name },
    { key: 'school', header: '학교', cell: (s) => s.school ?? '' },
    { key: 'grade', header: '학년', cell: (s) => s.grade ?? '' },
    {
      key: 'issued',
      header: '코드 발급',
      cell: (s) => (s.codeIssuedAt ? koreaShortDateTime(s.codeIssuedAt) : '없음'),
    },
    {
      key: 'login',
      header: '최근 접속',
      cell: (s) => (s.lastLoginAt ? koreaShortDateTime(s.lastLoginAt) : '없음'),
    },
    { key: 'status', header: '상태', cell: (s) => studentStatusLabel(s.status) },
    {
      key: 'actions',
      header: '관리',
      cell: (s) =>
        s.status === 'active' ? (
          <div className={styles.rowActions}>
            <Button
              variant="secondary"
              size="teacher"
              aria-label={`${s.name} 반 이동`}
              onClick={() => openAction({ kind: 'move', student: s })}
            >
              반 이동
            </Button>
            <Button
              variant="secondary"
              size="teacher"
              aria-label={`${s.name} 퇴원`}
              onClick={() => openAction({ kind: 'withdraw', student: s })}
            >
              퇴원
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{klass.name} 학생 명단</h1>
          <p className={styles.sub}>재원 {active.length}명</p>
        </div>
        <ButtonLink to={`/admin/classes/${klass.id}/students/new`} size="teacher">
          학생 추가
        </ButtonLink>
      </div>

      {issued && (
        <CodeCards title={`재발급 결과 ${issued.length}명`} klass={klass} items={issued} />
      )}

      {done && (
        <p className={styles.done} role="status">
          {done}
        </p>
      )}

      {action && (
        <ActionPanel
          key={`${action.kind}-${action.student.id}`}
          action={action}
          klass={klass}
          onClose={() => setAction(null)}
          onDone={(message) => {
            // 결과 상자는 닫기 버튼 없이, 명단에서 다른 처리가 끝나면 사라진다(인쇄 전에 실수로 닫지 않게 — 11/8)
            setIssued(null)
            setAction(null)
            setDone(message)
            refresh()
          }}
        />
      )}

      <div className={styles.toolbar} role="group" aria-label="선택한 학생">
        <span>선택 {selectedActive.length}명</span>
        {/* 재발급 확인 중에는 숨긴다 — 확인 문구와 "N명 재발급"만 남긴다(11/8 와이어프레임) */}
        {!confirming && (
          <Button
            variant="secondary"
            size="teacher"
            onClick={() =>
              setSelected(selectedActive.length === active.length ? [] : active.map((s) => s.id))
            }
            disabled={active.length === 0}
          >
            {selectedActive.length === active.length && active.length > 0
              ? '선택 해제'
              : '재원 전체 선택'}
          </Button>
        )}
        {confirming ? (
          <>
            <span>새 코드를 받으면 옛 코드로 들어온 기기는 로그아웃됨</span>
            <Button size="teacher" onClick={() => void regenerate()} disabled={regen.pending}>
              {regen.pending ? '재발급 중' : `${selectedActive.length}명 재발급`}
            </Button>
            <Button variant="secondary" size="teacher" onClick={() => setConfirming(false)}>
              취소
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="teacher"
            onClick={() => setConfirming(true)}
            disabled={selectedActive.length === 0}
          >
            개인 코드 재발급
          </Button>
        )}
      </div>
      {regen.error !== null && (
        <p className={styles.formError} role="alert">
          {errorMessage(regen.error, ADMIN_COPY)}
        </p>
      )}

      <Table
        caption="학생 명단"
        columns={columns}
        rows={students}
        rowKey={(s) => s.id}
        empty="등록한 학생 없음"
      />
    </>
  )
}

const ACTION_TITLE = { move: '반 이동', withdraw: '퇴원' } as const

/** 한 학생의 반 이동·퇴원 확인 칸 */
function ActionPanel({
  action,
  klass,
  onClose,
  onDone,
}: {
  action: RowAction
  klass: AdminClass
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { kind, student } = action
  const classes = useQuery({ ...classesQuery, enabled: kind === 'move' })
  const targets = (classes.data?.items ?? []).filter(
    (c) => c.status === 'active' && c.id !== klass.id,
  )
  const [toClassId, setToClassId] = useState('')
  const submit = useSubmit(ADMIN_COPY)

  async function confirm() {
    if (kind === 'move') {
      const target = targets.find((c) => String(c.id) === toClassId)
      if (!target) return
      const moved = await submit.run(() => moveStudent(student.id, target.id))
      if (moved !== undefined) onDone(`${student.name} → ${target.name} 이동함`)
      return
    }
    const updated = await submit.run(() => setStudentStatus(student.id, 'inactive'))
    if (updated !== undefined) onDone(`${student.name} 퇴원 처리함`)
  }

  const title = `${student.name} ${ACTION_TITLE[kind]}`
  const generalError = submit.formError(['toClassId'])
  return (
    <section className={styles.panel} aria-label={title}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {kind === 'move' && (
        <SelectField
          label="옮길 반"
          options={[
            { value: '', label: classes.data ? '반 고르기' : '반 목록 불러오는 중' },
            ...targets.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
          value={toClassId}
          onChange={(e) => setToClassId(e.target.value)}
          error={submit.fieldError('toClassId')}
        />
      )}
      {kind === 'withdraw' && (
        <p className={styles.notice}>
          퇴원하면 명단에서 빠지고 이 학생은 들어올 수 없음. 이 화면에서는 되돌릴 수 없음(듣기
          기록은 남음)
        </p>
      )}
      {kind === 'move' && <p className={styles.muted}>옮긴 뒤에는 옮긴 반 가입 코드로 들어옴</p>}
      {generalError && (
        <p className={styles.formError} role="alert">
          {generalError}
        </p>
      )}
      <div className={styles.actions}>
        <Button
          size="teacher"
          onClick={() => void confirm()}
          disabled={submit.pending || (kind === 'move' && toClassId === '')}
        >
          {submit.pending ? '처리 중' : ACTION_TITLE[kind]}
        </Button>
        <Button variant="secondary" size="teacher" onClick={onClose}>
          취소
        </Button>
      </div>
    </section>
  )
}
