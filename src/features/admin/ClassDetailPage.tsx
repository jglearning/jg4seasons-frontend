import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { Link, useParams } from 'react-router'
import { errorMessage } from '../../shared/errorMessage'
import { Button } from '../../shared/ui/Button'
import { CheckboxGroup } from '../../shared/ui/CheckboxGroup'
import { SelectField } from '../../shared/ui/SelectField'
import { TextField } from '../../shared/ui/TextField'
import { AdminLoadState } from './AdminLoadState'
import {
  classQuery,
  regenerateAccessCode,
  teachersQuery,
  updateClass,
  type AdminClass,
  type ClassStatus,
  type ClassUpdate,
} from './adminApi'
import { ADMIN_COPY } from './adminCopy'
import {
  bookLabel,
  CLASS_STATUS_OPTIONS,
  classStatusLabel,
  koreaDateTime,
  weekdaysText,
} from './format'
import { useSubmit } from './useSubmit'
import styles from './Admin.module.css'

// A-01 반 상세(GET·PATCH /admin/classes/{id}, 가입 코드 재발급 ADM-03).
// 권·개강일·요일은 바꿀 수 없다(서버가 400) — 보이기만. 바꿀 수 있는 칸은 바뀐 것만 보낸다
const FIELDS = ['name', 'status', 'teacherIds']

export function ClassDetailPage() {
  const id = Number(useParams().id)
  const detail = useQuery(classQuery(id))

  return (
    <>
      <Link to="/admin/classes" className={styles.back}>
        ← 반 관리
      </Link>
      {detail.data ? (
        <ClassBody key={detail.data.id} data={detail.data} />
      ) : (
        <AdminLoadState query={detail} />
      )}
    </>
  )
}

function ClassBody({ data }: { data: AdminClass }) {
  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{data.name}</h1>
          <p className={styles.sub}>
            {classStatusLabel(data.status)} · 학생 {data.studentCount}명
          </p>
        </div>
      </div>
      <dl className={styles.facts}>
        <dt>권</dt>
        <dd>{bookLabel(data.bookCode, data.levelCode, data.season)}</dd>
        <dt>개강일</dt>
        <dd>{data.startDate}</dd>
        <dt>수업 요일</dt>
        <dd>{weekdaysText(data.weekdays)}</dd>
      </dl>
      <AccessCode data={data} />
      <ClassForm data={data} />
    </>
  )
}

/** 가입 코드 보기·재발급 — 확인창 대신 화면 안에서 한 번 더 누른다 */
function AccessCode({ data }: { data: AdminClass }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const submit = useSubmit()

  async function regenerate() {
    const result = await submit.run(() => regenerateAccessCode(data.id))
    setConfirming(false)
    if (result === undefined) return
    queryClient.setQueryData<AdminClass>(classQuery(data.id).queryKey, (before) =>
      before ? { ...before, ...result } : before,
    )
    void queryClient.invalidateQueries({ queryKey: ['admin', 'classes'], exact: true })
  }

  return (
    <section className={styles.section} aria-labelledby="access-code-title">
      <h2 id="access-code-title" className={styles.sectionTitle}>
        가입 코드
      </h2>
      <div className={styles.codeBox}>
        <span className={styles.code}>{data.accessCode}</span>
        <span className={styles.codeMeta}>발급 {koreaDateTime(data.codeIssuedAt)}</span>
        {confirming ? (
          <div className={styles.confirm} role="group" aria-label="재발급 확인">
            <span>새 코드로 바꾸면 옛 코드로는 들어올 수 없음(이미 들어온 학생은 그대로)</span>
            <Button size="teacher" onClick={() => void regenerate()} disabled={submit.pending}>
              {submit.pending ? '재발급 중' : '재발급'}
            </Button>
            <Button variant="secondary" size="teacher" onClick={() => setConfirming(false)}>
              취소
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="teacher" onClick={() => setConfirming(true)}>
            재발급
          </Button>
        )}
      </div>
      {submit.error !== null && (
        <p className={styles.formError} role="alert">
          {errorMessage(submit.error, ADMIN_COPY)}
        </p>
      )}
    </section>
  )
}

function ClassForm({ data }: { data: AdminClass }) {
  const queryClient = useQueryClient()
  const teachers = useQuery(teachersQuery)
  const [name, setName] = useState(data.name)
  const [status, setStatus] = useState<ClassStatus>(data.status)
  const [allowFuture, setAllowFuture] = useState(data.allowFutureLessons)
  const assigned = data.teachers.map((t) => t.id)
  const [teacherIds, setTeacherIds] = useState<number[]>(assigned)
  const [saved, setSaved] = useState(false)
  const submit = useSubmit()

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    setSaved(false)
    const body: ClassUpdate = {}
    if (name.trim() !== data.name) body.name = name.trim()
    if (status !== data.status) body.status = status
    if (allowFuture !== data.allowFutureLessons) body.allowFutureLessons = allowFuture
    if (!sameIds(teacherIds, assigned)) body.teacherIds = [...teacherIds].sort((a, b) => a - b)
    if (Object.keys(body).length === 0) return
    const updated = await submit.run(() => updateClass(data.id, body))
    if (updated === undefined) return
    queryClient.setQueryData(classQuery(data.id).queryKey, updated)
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
    setSaved(true)
  }

  // 새로 넣을 수 있는 교사는 활성만. 이미 담당인 교사는 비활성이어도 목록에 남긴다(서버가 그대로 받음)
  const teacherOptions = (teachers.data?.items ?? [])
    .filter((t) => t.status === 'active' || assigned.includes(t.id))
    .map((t) => ({
      value: t.id,
      label: t.status === 'active' ? t.name : `${t.name}(비활성)`,
    }))
  const generalError = submit.formError(FIELDS)

  return (
    <section className={styles.section} aria-labelledby="class-edit-title">
      <h2 id="class-edit-title" className={styles.sectionTitle}>
        반 정보 수정
      </h2>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          size="teacher"
          label="반 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
          error={submit.fieldError('name')}
        />
        <SelectField
          label="상태"
          options={CLASS_STATUS_OPTIONS}
          value={status}
          onChange={(e) => setStatus(e.target.value as ClassStatus)}
          error={submit.fieldError('status')}
        />
        {status !== 'active' && (
          <p className={styles.muted}>운영 중이 아니면 이 반 가입 코드로 들어올 수 없음</p>
        )}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={allowFuture}
            onChange={(e) => setAllowFuture(e.target.checked)}
          />
          아직 수업하지 않은 회차도 미리 듣기 허용
        </label>
        <CheckboxGroup
          legend="담당 교사"
          options={teacherOptions}
          selected={teacherIds}
          onChange={setTeacherIds}
          empty={teachers.data ? '활성 교사가 없습니다' : '교사 목록 불러오는 중'}
          error={submit.fieldError('teacherIds')}
        />
        {generalError && (
          <p className={styles.formError} role="alert">
            {generalError}
          </p>
        )}
        {saved && (
          <p className={styles.muted} role="status">
            저장됨
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" size="teacher" disabled={submit.pending}>
            {submit.pending ? '저장 중' : '저장'}
          </Button>
        </div>
      </form>
    </section>
  )
}

function sameIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}
