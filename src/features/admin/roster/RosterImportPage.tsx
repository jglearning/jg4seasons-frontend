import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../../api/errors'
import { Steps } from '../../../shared/ui/Steps'
import { useSubmit } from '../../../shared/useSubmit'
import { activeTeacherOptions, classesQuery, teachersQuery } from '../adminApi'
import { ADMIN_COPY } from '../adminCopy'
import styles from '../Admin.module.css'
import {
  buildRequest,
  groupStudents,
  initialChoice,
  toStudents,
  type ClassChoice,
  type Group,
  type Student,
} from './build'
import { CheckStep, type CheckSnapshot } from './CheckStep'
import { ClassesStep } from './ClassesStep'
import { ColumnsStep, PasteStep } from './InputSteps'
import { guessRoles, looksLikeHeader, parseTable, type ColumnRole, type ParsedRow } from './parse'
import { ResultView } from './ResultView'
import { checkRoster, createRoster, type RosterResult } from './rosterApi'
import roster from './Roster.module.css'

// A-05 명단 가져오기(BE #67, ADR 0036 / 와이어프레임 A05_RosterImport). 주소 하나에 단계 ①~④, 만든 뒤 ⑥ 결과.
// 붙여넣은 글·학생 줄·반 선택은 이 화면 state에만(새로고침하면 사라짐). 만들기 응답의 개인 코드도 ResultView의 지역 state로만.
// 서버 검사(check)는 늘 만들기 전에 — 만들기는 한 트랜잭션이고 멱등 키가 없어 버튼 잠금으로 두 번 보내지 않는다

const STEPS = ['붙여넣기', '열 고르기', '반 정하기', '검사·만들기']
const SUBS = [
  '기존 학원의 반·학생 명단을 붙여넣으면 반과 학생을 한 번에 만듭니다',
  "열마다 무엇인지 골라 주세요. '쓰지 않음' 열은 서버로 보내지 않습니다",
  '반 이름별로 묶었습니다. 반마다 기존 반에 넣을지, 새 반을 만들지 골라 주세요',
  '서버에서 검사합니다. 아직 아무것도 만들지 않았습니다',
]

type Table = { source: string; rows: ParsedRow[]; header: string[] | undefined }

export function RosterImportPage() {
  const queryClient = useQueryClient()
  const classes = useQuery(classesQuery)
  const teachers = useQuery(teachersQuery)
  const titleRef = useRef<HTMLHeadingElement>(null)

  const [step, setStep] = useState(0)
  const [text, setText] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const headerTouched = useRef(false)
  const [table, setTable] = useState<Table | null>(null)
  const [roles, setRoles] = useState<ColumnRole[]>([])
  const [oneClass, setOneClass] = useState(false)
  const [students, setStudents] = useState<{ source: string; list: Student[] }>({
    source: '',
    list: [],
  })
  const [choices, setChoices] = useState<ReadonlyMap<string, ClassChoice>>(new Map())
  const [check, setCheck] = useState<CheckSnapshot | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [recheckNotice, setRecheckNotice] = useState<string | null>(null)
  const [unknown, setUnknown] = useState(false)
  const [result, setResult] = useState<RosterResult | null>(null)
  // ④ "반 정하기에서 고치기"로 ③에 갈 때 그 카드
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined)
  // 만들기가 성공했거나 결과를 모르면 다시 보내지 않는다(state가 화면에 반영되기 전 클릭도 — #114와 같은 이유)
  const createBlocked = useRef(false)
  const checkSubmit = useSubmit(ADMIN_COPY)
  const createSubmit = useSubmit(ADMIN_COPY)

  const activeClasses = useMemo(
    () => (classes.data?.items ?? []).filter((c) => c.status === 'active'),
    [classes.data],
  )
  const groups = useMemo(() => groupStudents(students.list), [students.list])
  const choiceOf = (g: Group) => choices.get(g.key) ?? initialChoice(g, activeClasses)
  const allChoices = new Map(groups.map((g) => [g.key, choiceOf(g)]))
  const body = buildRequest(groups, allChoices)
  const stale = check !== null && JSON.stringify(check.body) !== JSON.stringify(body)
  const creating = createSubmit.pending

  // 만드는 중·결과 화면에서 새로고침·탭 닫기 → 브라우저 기본 확인(결과의 개인 코드는 다시 볼 수 없다)
  const guardUnload = creating || result !== null
  useEffect(() => {
    if (!guardUnload) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [guardUnload])

  // 단계가 바뀌면 제목으로 초점(①은 붙여넣기 칸이 받는다)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    // "반 정하기에서 고치기"로 ③에 가면 그 카드 제목이 초점을 받는다(ClassesStep)
    if (step > 0 && !(step === 2 && focusKey !== undefined)) titleRef.current?.focus()
  }, [step, focusKey])

  function onText(next: string) {
    setText(next)
    // "첫 줄은 제목"을 직접 바꾸지 않았으면 첫 줄 글자로 추정
    if (!headerTouched.current) {
      const first = parseTable(next)[0]
      if (first) setHasHeader(looksLikeHeader(first.cells))
    }
  }

  function onHeader(next: boolean) {
    headerTouched.current = true
    setHasHeader(next)
  }

  function toColumns() {
    const source = `${hasHeader ? 'h' : 'n'}|${text}`
    if (table?.source !== source) {
      const rows = parseTable(text)
      const header = hasHeader ? rows[0]?.cells : undefined
      const data = hasHeader ? rows.slice(1) : rows
      const width = rows[0]?.cells.length ?? 0
      setTable({ source, rows: data, header })
      setRoles(guessRoles(header, width))
      setOneClass(false)
    }
    setStep(1)
  }

  function toClasses() {
    if (!table) return
    const source = JSON.stringify([table.source, roles, oneClass])
    if (students.source !== source) {
      setStudents({ source, list: toStudents(table.rows, roles, oneClass) })
    }
    setStep(2)
  }

  function setChoice(key: string, next: ClassChoice) {
    setChoices((before) => new Map(before).set(key, next))
  }

  /** notice: 만들기 4xx 뒤 다시 검사할 때 그 문구(목록 위에 함께 보인다) */
  async function runCheck(notice: string | null = null) {
    setStep(3)
    setRecheckNotice(notice)
    const snapshotGroups = groups
    const sent = body
    const checked = await checkSubmit.run(() =>
      checkRoster(sent).then(
        (r) => ({ errors: r.errors, warnings: r.warnings, tooMany: false }),
        (error: unknown) => {
          // 형식 위반(400 VALIDATION)도 위치가 있으면 검사 목록처럼 보인다. 전체(classes)면 맨 위 한 줄
          if (error instanceof ApiError && error.status === 400 && error.code === 'VALIDATION') {
            const located = error.fieldErrors.filter((f) => f.field !== 'classes')
            return {
              errors: located.map((f) => ({ code: 'VALIDATION', ...f })),
              warnings: [],
              tooMany: located.length !== error.fieldErrors.length || located.length === 0,
            }
          }
          throw error
        },
      ),
    )
    if (checked === undefined) return
    setCheck({ body: sent, groups: snapshotGroups, at: new Date(), ...checked })
    setConfirmed(false)
  }

  async function runCreate() {
    if (createBlocked.current) return
    let failure: unknown
    const sent = body
    const created = await createSubmit.run(
      () =>
        createRoster(sent).catch((error: unknown) => {
          failure = error
          throw error
        }),
      { lockOnSuccess: true },
    )
    if (created !== undefined) {
      createBlocked.current = true
      setResult(created)
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      return
    }
    if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500) {
      // 아무것도 만들어지지 않았다 — 검사 뒤 바뀐 것(다른 관리자의 등록 등)을 다시 검사해 보인다
      await runCheck(failure.title)
      return
    }
    // 응답을 못 받았거나 5xx: 서버가 만들었을 수 있다(멱등 키 없음) — 다시 누르지 못하게.
    // 5xx 롤백 보장은 백엔드 답을 기다린다(handoff [FE · 2026-11-24])
    createBlocked.current = true
    setUnknown(true)
  }

  if (result) {
    return (
      <>
        <Link to="/admin/classes" className={styles.back}>
          ← 반 관리
        </Link>
        <ResultView result={result} />
      </>
    )
  }

  const locked = creating || unknown

  return (
    <>
      <Link to="/admin/classes" className={styles.back}>
        ← 반 관리
      </Link>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
            명단 가져오기
          </h1>
          <p className={styles.sub}>{SUBS[step]}</p>
        </div>
      </div>
      <div className={roster.steps}>
        <Steps
          steps={STEPS}
          current={step}
          onGo={(i) => {
            setFocusKey(undefined)
            setStep(i)
          }}
          locked={locked}
        />
      </div>
      {step === 0 && (
        <PasteStep
          text={text}
          onText={onText}
          hasHeader={hasHeader}
          onHeader={onHeader}
          onNext={toColumns}
        />
      )}
      {step === 1 && table && (
        <ColumnsStep
          table={table}
          roles={roles}
          onRoles={setRoles}
          oneClass={oneClass}
          onOneClass={setOneClass}
          onBack={() => setStep(0)}
          onNext={toClasses}
        />
      )}
      {step === 2 && (
        <ClassesStep
          groups={groups}
          choiceOf={choiceOf}
          onChoice={setChoice}
          activeClasses={activeClasses}
          teacherOptions={activeTeacherOptions(teachers.data?.items)}
          teachersLoaded={teachers.data !== undefined}
          focusKey={focusKey}
          onBack={() => setStep(1)}
          onCheck={() => void runCheck()}
        />
      )}
      {step === 3 && (
        <CheckStep
          groups={groups}
          choices={allChoices}
          check={check}
          stale={stale}
          checking={checkSubmit.pending}
          checkError={checkSubmit.formError([])}
          confirmed={confirmed}
          onConfirm={setConfirmed}
          recheckNotice={recheckNotice}
          creating={creating}
          unknown={unknown}
          students={students.list}
          onStudents={(list) => setStudents((before) => ({ ...before, list }))}
          onFixClass={(key) => {
            setFocusKey(key)
            setStep(2)
          }}
          onPaste={() => setStep(0)}
          onBack={() => {
            setFocusKey(undefined)
            setStep(2)
          }}
          onRecheck={() => void runCheck()}
          onCreate={() => void runCreate()}
        />
      )}
    </>
  )
}
