import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link, useParams } from 'react-router'
import { BOOK_GROUPS, licenseBookLabel, licenseStatusLabel } from '../../shared/books'
import { shortDate } from '../../shared/dates'
import { BookChecklist } from '../../shared/ui/BookChecklist'
import { Button } from '../../shared/ui/Button'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { Table, type Column } from '../../shared/ui/Table'
import { TextField } from '../../shared/ui/TextField'
import { useSubmit } from '../../shared/useSubmit'
import { academyQuery, setLicense, type AcademyDetail, type License } from './systemApi'
import { academyStatusLabel, licenseModeLabel, SYSTEM_COPY } from './systemCopy'
import styles from './System.module.css'

// O-03 학원 상세·교재 사용권(SYS-07, 7.3·7.4). 상태·남은 날·학생 수는 서버 값 그대로(남은 날은 마지막 날이 1),
// 줄 순서도 서버(레벨·권 순). 지정은 권마다 PUT 하나 — 없으면 만들고 있으면 고친다. 삭제는 없다(종료일을 앞당긴다).
// 학원은 교재를 보통 전부 또는 레벨 한 세트로 사서 여러 권을 체크하고 기간·한도 한 벌로 저장한다(#117).
// 한 번에 지정하는 API가 없어 권마다 차례로 보내고, 첫 실패에서 멈춘다 — 값이 같아 실패는 대개 전체에 해당한다.
// 직영 학원(licenseEnforced false)은 모든 교재가 무제한이라 지정해도 적용되지 않는다 — 안내만, 막지 않는다
const FIELDS = ['startDate', 'endDate', 'seats']

type Draft = { startDate: string; endDate: string; seats: string }
const EMPTY: Draft = { startDate: '', endDate: '', seats: '' }

type Result = 'saved' | 'failed' | 'unsent'
const RESULT_LABEL: Record<Result, string> = {
  saved: '저장함',
  failed: '실패',
  unsent: '안 보냄',
}

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
  const [selected, setSelected] = useState<string[]>([])
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [missing, setMissing] = useState<{ books?: string; seats?: string }>({})
  const [results, setResults] = useState<Record<string, Result>>({})
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [saved, setSaved] = useState<string>()
  const submit = useSubmit(SYSTEM_COPY)
  const formRef = useRef<HTMLFormElement>(null)

  // 실패 뒤 포커스: 서버 칸 오류(400)면 첫 오류 칸, 칸에 붙지 않는 오류면 저장 버튼
  // (보내는 동안 버튼이 비활성화되어 포커스가 body로 빠진다)
  useEffect(() => {
    if (submit.error === null) return
    const form = formRef.current
    ;(
      form?.querySelector<HTMLElement>('input[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>('button[type="submit"]')
    )?.focus()
  }, [submit.error])

  const existing = (code: string) => licenses.find((l) => l.book.code === code)

  // 값을 바꾸면 지난 저장 결과·안내는 지운다
  function clearOutcome() {
    setResults({})
    setSaved(undefined)
  }

  function edit(next: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...next }))
    if ('seats' in next) setMissing((m) => ({ ...m, seats: undefined }))
    clearOutcome()
  }

  function choose(next: string[]) {
    setSelected(next)
    setMissing((m) => ({ ...m, books: undefined }))
    clearOutcome()
  }

  const bookBox = (code?: string) =>
    formRef.current?.querySelector<HTMLInputElement>(
      code ? `input[type="checkbox"][value="${code}"]` : 'input[type="checkbox"]',
    )

  // 줄의 [고치기] — 그 권 하나만 체크하고 지금 값을 채운 뒤 그 체크 칸으로(포커스가 그 칸을 화면에 보이게 스크롤한다).
  // 기간이 조금 다른 권은 한 번에 지정한 뒤 이렇게 하나씩 고친다
  function startEdit(row: License) {
    setSelected([row.book.code])
    setDraft({ startDate: row.startDate, endDate: row.endDate, seats: String(row.seats) })
    setMissing({})
    clearOutcome()
    submit.reset()
    bookBox(row.book.code)?.focus()
  }

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (submit.pending) return
    // 교재(경로)와 한도(빈 칸이 0으로 바뀌지 않게)는 화면에서 막는다. 날짜·범위 규칙은 서버가 판정
    const lack: { books?: string; seats?: string } = {}
    if (selected.length === 0) lack.books = '교재를 고르세요'
    if (draft.seats.trim() === '') lack.seats = '학생 수 한도를 입력하세요'
    if (lack.books || lack.seats) {
      setMissing(lack)
      clearOutcome()
      const target = lack.books
        ? bookBox()
        : formRef.current?.querySelector<HTMLInputElement>('input[type="number"]')
      target?.focus()
      return
    }
    const codes = selected
    const body = {
      startDate: draft.startDate,
      endDate: draft.endDate,
      seats: Number(draft.seats),
    }
    let started = false
    let done = 0
    const finished = await submit.run(async () => {
      started = true
      setResults({})
      setSaved(undefined)
      setProgress({ done: 0, total: codes.length })
      for (const code of codes) {
        await setLicense(id, code, body)
        done += 1
        setProgress({ done, total: codes.length })
      }
      return true
    })
    // 진행 중이라 무시된 두 번째 제출 — 아무것도 바꾸지 않는다
    if (!started) return
    setProgress(undefined)
    // 줄 자리(레벨·권 순)와 상태는 서버가 정한다 — 한 권이라도 저장됐으면 다시 받는다
    if (done > 0) void queryClient.invalidateQueries({ queryKey: academyQuery(id).queryKey })
    const outcome: Record<string, Result> = {}
    codes.forEach((code, i) => {
      outcome[code] = i < done ? 'saved' : i === done ? 'failed' : 'unsent'
    })
    setResults(outcome)
    if (finished) {
      setSelected([])
      setDraft(EMPTY)
      setSaved(`${codes.length}권 저장함`)
      // 다음 교재를 바로 고를 수 있게(저장 중 버튼이 비활성화되어 포커스가 빠졌다)
      bookBox()?.focus()
    } else {
      // 남은 권만 체크를 남긴다 — 다시 저장하면 남은 권만 보낸다
      setSelected(codes.slice(done))
      setSaved(`${codes.length}권 중 ${done}권 저장함 · ${codes.length - done}권 남음`)
    }
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
      header: '학생 수 / 한도',
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

  // 권 옆 글자: 방금 저장 결과가 있으면 그것, 없으면 지정된 권의 지금 기간·한도
  function bookNote(code: string) {
    const result = results[code]
    if (result) return RESULT_LABEL[result]
    const row = existing(code)
    return row ? `지정됨 ${row.startDate} ~ ${row.endDate} · 한도 ${row.seats}` : undefined
  }

  const overwriting = selected.filter((code) => existing(code) !== undefined).length
  const generalError = submit.formError(FIELDS)
  const sending = progress ? Math.min(progress.done + 1, progress.total) : 0

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
          <BookChecklist
            legend="교재"
            groups={BOOK_GROUPS}
            selected={selected}
            onChange={choose}
            note={bookNote}
            error={missing.books}
          />
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
            label="학생 수 한도(산 교재 부수)"
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
          {overwriting > 0 && (
            <p className={styles.done}>이미 지정된 {overwriting}권은 기간·한도를 바꿈</p>
          )}
          {generalError && (
            <p className={styles.formError} role="alert">
              {generalError}
            </p>
          )}
          {/* 저장 안내는 버튼 옆 — 늘 있는 알림 자리(비어 있어도 폼 간격을 차지하지 않게) */}
          <div className={styles.actions}>
            <Button type="submit" size="teacher" disabled={submit.pending}>
              {progress
                ? `저장 중 ${sending} / ${progress.total}`
                : selected.length > 0
                  ? `${selected.length}권 저장`
                  : '저장'}
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
