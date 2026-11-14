import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link, useParams } from 'react-router'
import { BOOK_OPTIONS, licenseBookLabel, licenseStatusLabel } from '../../shared/books'
import { shortDate } from '../../shared/dates'
import { Button } from '../../shared/ui/Button'
import { SelectField } from '../../shared/ui/SelectField'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { Table, type Column } from '../../shared/ui/Table'
import { TextField } from '../../shared/ui/TextField'
import { useSubmit } from '../../shared/useSubmit'
import { academyQuery, setLicense, type AcademyDetail, type License } from './systemApi'
import { academyStatusLabel, licenseModeLabel, SYSTEM_COPY } from './systemCopy'
import styles from './System.module.css'

// O-03 학원 상세·교재 사용권(SYS-07, 7.3·7.4). 상태·남은 날·학생 수는 서버 값 그대로(남은 날은 마지막 날이 1),
// 줄 순서도 서버(레벨·권 순). 지정은 PUT 하나 — 없으면 만들고 있으면 고친다. 삭제는 없다(종료일을 앞당긴다).
// 직영 학원(licenseEnforced false)은 모든 교재가 무제한이라 지정해도 적용되지 않는다 — 안내만, 막지 않는다
const BOOK_CHOICES = [{ value: '', label: '교재 고르기' }, ...BOOK_OPTIONS]
const FIELDS = ['startDate', 'endDate', 'seats']

type Draft = { bookCode: string; startDate: string; endDate: string; seats: string }
const EMPTY: Draft = { bookCode: '', startDate: '', endDate: '', seats: '' }

export function AcademyPage() {
  const id = Number(useParams().id)
  const detail = useQuery(academyQuery(id))
  const data = detail.data

  return (
    <>
      <Link to="/system/academies" className={styles.back}>
        ← 학원 관리
      </Link>
      {data ? <AcademyBody key={id} id={id} data={data} /> : <StaffLoadState query={detail} />}
    </>
  )
}

function AcademyBody({ id, data }: { id: number; data: AcademyDetail }) {
  const queryClient = useQueryClient()
  const { academy, licenses, today } = data
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [missing, setMissing] = useState<Partial<Record<keyof Draft, string>>>({})
  const [saved, setSaved] = useState<string>()
  const submit = useSubmit(SYSTEM_COPY)
  const formRef = useRef<HTMLFormElement>(null)
  const bookRef = useRef<HTMLSelectElement>(null)

  // 실패 뒤 포커스: 서버 칸 오류(400)면 첫 오류 칸, 칸에 붙지 않는 오류면 저장 버튼
  // (보내는 동안 버튼이 비활성화되어 포커스가 body로 빠진다)
  useEffect(() => {
    if (submit.error === null) return
    const form = formRef.current
    ;(
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>('button[type="submit"]')
    )?.focus()
  }, [submit.error])

  const existing = (code: string) => licenses.find((l) => l.book.code === code)

  function edit(next: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...next }))
    setMissing((m) => {
      const rest = { ...m }
      for (const key of Object.keys(next)) delete rest[key as keyof Draft]
      return rest
    })
    setSaved(undefined)
  }

  function fillFrom(row: License) {
    edit({
      bookCode: row.book.code,
      startDate: row.startDate,
      endDate: row.endDate,
      seats: String(row.seats),
    })
    submit.reset()
  }

  function chooseBook(code: string) {
    // 이미 지정된 교재를 고르면 지금 값을 채워 고치기로
    const row = existing(code)
    if (row) fillFrom(row)
    else edit({ bookCode: code })
  }

  // 줄의 [고치기] — 아래 폼에 그 줄 값을 채우고 교재 칸으로(포커스가 그 칸을 화면에 보이게 스크롤한다)
  function startEdit(row: License) {
    fillFrom(row)
    bookRef.current?.focus()
  }

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (submit.pending) return
    // 교재(경로)와 학생 수(빈 칸이 0으로 바뀌지 않게)는 화면에서 막는다. 날짜·범위 규칙은 서버가 판정
    const lack: Partial<Record<keyof Draft, string>> = {}
    if (draft.bookCode === '') lack.bookCode = '교재를 고르세요'
    if (draft.seats.trim() === '') lack.seats = '학생 수를 입력하세요'
    if (Object.keys(lack).length > 0) {
      setMissing(lack)
      setSaved(undefined)
      const target = lack.bookCode
        ? bookRef.current
        : formRef.current?.querySelector<HTMLInputElement>('input[type="number"]')
      target?.focus()
      return
    }
    const bookCode = draft.bookCode
    const row = await submit.run(() =>
      setLicense(id, bookCode, {
        startDate: draft.startDate,
        endDate: draft.endDate,
        seats: Number(draft.seats),
      }),
    )
    if (row === undefined) return
    const key = academyQuery(id).queryKey
    if (existing(bookCode)) {
      // 응답(바뀐 줄 하나)으로 그 줄만 바꾼다
      queryClient.setQueryData(key, (old) =>
        old
          ? { ...old, licenses: old.licenses.map((l) => (l.book.code === bookCode ? row : l)) }
          : old,
      )
    } else {
      // 새 줄은 자리(레벨·권 순)를 서버가 정한다 — 다시 받는다
      void queryClient.invalidateQueries({ queryKey: key })
    }
    setDraft(EMPTY)
    setSaved(`저장함 — ${licenseBookLabel(row.book.code, row.book.season)}`)
    // 다음 교재를 바로 고를 수 있게(저장 중 버튼이 비활성화되어 포커스가 빠졌다)
    bookRef.current?.focus()
  }

  const columns: Column<License>[] = [
    { key: 'book', header: '교재', cell: (l) => licenseBookLabel(l.book.code, l.book.season) },
    { key: 'period', header: '기간', cell: (l) => `${l.startDate} ~ ${l.endDate}` },
    { key: 'status', header: '상태', cell: (l) => licenseStatusLabel(l.status) },
    {
      key: 'daysLeft',
      header: '남은 날',
      cell: (l) => (l.daysLeft === null ? '—' : `${l.daysLeft}일`),
    },
    {
      key: 'seats',
      header: '학생 수',
      cell: (l) =>
        l.usedSeats > l.seats ? (
          <span className={styles.over}>
            {l.usedSeats} / {l.seats} <TriangleAlert size={16} strokeWidth={2} aria-hidden />
            한도 넘음
          </span>
        ) : (
          `${l.usedSeats} / ${l.seats}`
        ),
    },
    {
      key: 'edit',
      header: <span className={styles.srOnly}>고치기</span>,
      cell: (l) => (
        <Button
          variant="secondary"
          size="teacher"
          onClick={() => startEdit(l)}
          aria-label={`${licenseBookLabel(l.book.code, l.book.season)} 고치기`}
        >
          고치기
        </Button>
      ),
    },
  ]

  const editing = draft.bookCode !== '' && existing(draft.bookCode) !== undefined
  const generalError = submit.formError(FIELDS)

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{academy.name}</h1>
          <p className={styles.sub}>기준일 {shortDate(today)}</p>
        </div>
      </div>
      <dl className={styles.facts}>
        <dt>학원 주소</dt>
        <dd className={styles.mono}>{academy.slug}</dd>
        <dt>타임존</dt>
        <dd>{academy.timezone}</dd>
        <dt>사용권</dt>
        <dd>{licenseModeLabel(academy.licenseEnforced)}</dd>
        <dt>상태</dt>
        <dd>{academyStatusLabel(academy.status)}</dd>
      </dl>

      <section className={styles.section} aria-labelledby="licenses-title">
        <h2 id="licenses-title" className={styles.sectionTitle}>
          교재 사용권
        </h2>
        {!academy.licenseEnforced && (
          <p className={styles.notice}>
            직영 학원 — 모든 교재 제한 없이 사용(지정한 사용권은 적용되지 않음)
          </p>
        )}
        <Table
          caption="교재 사용권"
          columns={columns}
          rows={licenses}
          rowKey={(l) => l.book.code}
          empty="지정된 교재 없음"
        />
      </section>

      <section className={styles.section} aria-labelledby="license-form-title">
        <h2 id="license-form-title" className={styles.sectionTitle}>
          사용권 지정
        </h2>
        <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
          <SelectField
            ref={bookRef}
            label="교재"
            options={BOOK_CHOICES}
            value={draft.bookCode}
            onChange={(e) => chooseBook(e.target.value)}
            error={missing.bookCode}
          />
          {editing && <p className={styles.done}>지정된 교재 — 저장하면 기간·학생 수를 고침</p>}
          <TextField
            size="teacher"
            type="date"
            label="시작일"
            value={draft.startDate}
            onChange={(e) => edit({ startDate: e.target.value })}
            required
            error={submit.fieldError('startDate')}
          />
          <TextField
            size="teacher"
            type="date"
            label="종료일"
            hint="시작일·종료일 모두 포함. 끝내려면 종료일을 앞당김(삭제 없음)"
            value={draft.endDate}
            onChange={(e) => edit({ endDate: e.target.value })}
            required
            error={submit.fieldError('endDate')}
          />
          <TextField
            size="teacher"
            type="number"
            label="학생 수"
            hint="0~10000. 지금 학생보다 낮추면 새 등록·반 이동만 막힘"
            value={draft.seats}
            onChange={(e) => edit({ seats: e.target.value })}
            min={0}
            max={10000}
            step={1}
            inputMode="numeric"
            required
            error={missing.seats ?? submit.fieldError('seats')}
          />
          {generalError && (
            <p className={styles.formError} role="alert">
              {generalError}
            </p>
          )}
          {/* 저장 안내는 버튼 옆 — 늘 있는 알림 자리(비어 있어도 폼 간격을 차지하지 않게) */}
          <div className={styles.actions}>
            <Button type="submit" size="teacher" disabled={submit.pending}>
              {submit.pending ? '저장 중' : '저장'}
            </Button>
            <p className={styles.done} role="status">
              {saved}
            </p>
          </div>
        </form>
      </section>
    </>
  )
}
