import { Info } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { BOOK_OPTIONS } from '../../../shared/books'
import { Button } from '../../../shared/ui/Button'
import { CheckboxGroup, type CheckboxOption } from '../../../shared/ui/CheckboxGroup'
import { RadioGroup } from '../../../shared/ui/RadioGroup'
import { SelectField } from '../../../shared/ui/SelectField'
import { TextField } from '../../../shared/ui/TextField'
import type { AdminClass } from '../adminApi'
import { WEEKDAY_OPTIONS } from '../format'
import {
  groupTitle,
  initialChoice,
  limitProblems,
  missingFields,
  type ClassChoice,
  type Group,
  type NewClassDraft,
} from './build'
import styles from './Roster.module.css'

// A-05 ③ 반 정하기 — 반 이름별 카드. 기존 반(진행 중 반) 또는 새 반(A-01 반 만들기와 같은 값, 교사는 선택).
// 화면에서 먼저 막는 것은 빈 칸과 개수 한도뿐, 나머지 규칙(권·사용권·교사)은 ④ 서버 검사에 맡긴다

type ClassesStepProps = {
  groups: Group[]
  choiceOf: (group: Group) => ClassChoice
  onChoice: (key: string, next: ClassChoice) => void
  activeClasses: AdminClass[]
  teacherOptions: CheckboxOption<number>[]
  teachersLoaded: boolean
  /** ④에서 "반 정하기에서 고치기"로 왔을 때 그 카드 */
  focusKey?: string
  onBack: () => void
  onCheck: () => void
}

const FIELD_ID: Record<string, string> = {
  반: 'existing',
  '반 이름': 'name',
  권: 'book',
  개강일: 'start',
  요일: 'weekdays',
}

export function ClassesStep({
  groups,
  choiceOf,
  onChoice,
  activeClasses,
  teacherOptions,
  teachersLoaded,
  focusKey,
  onBack,
  onCheck,
}: ClassesStepProps) {
  const baseId = useId()
  const [attempted, setAttempted] = useState(false)
  // ④에서 "반 정하기에서 고치기"로 왔으면 그 카드 제목으로 초점(들어올 때 한 번)
  const [focusTarget, setFocusTarget] = useState<{ id: string; seq: number } | null>(() => {
    const at = focusKey === undefined ? -1 : groups.findIndex((g) => g.key === focusKey)
    return at < 0 ? null : { id: `${baseId}-${at}-title`, seq: 0 }
  })
  const limits = limitProblems(groups)
  const missing = groups.map((g) => missingFields(choiceOf(g)))
  const newCount = groups.filter((g) => choiceOf(g).mode === 'new').length
  const studentCount = groups.reduce((sum, g) => sum + g.students.length, 0)

  useEffect(() => {
    if (focusTarget === null) return
    const target = document.getElementById(focusTarget.id)
    const focusable = target?.matches('input, select, textarea, [tabindex]')
      ? target
      : target?.querySelector<HTMLElement>('input, select')
    focusable?.focus()
    focusable?.scrollIntoView?.({ block: 'center' })
  }, [focusTarget])

  function check() {
    const first = missing.findIndex((m) => m.length > 0)
    if (first >= 0) {
      // 버튼은 잠그지 않는다 — 왜 안 되는지 보이고 첫 빈 칸으로
      setAttempted(true)
      const field = FIELD_ID[missing[first]![0]!] ?? 'name'
      setFocusTarget({ id: `${baseId}-${first}-${field}`, seq: Date.now() })
      return
    }
    if (limits.length > 0) return
    onCheck()
  }

  return (
    <>
      <div className={styles.cards}>
        {groups.map((g, i) => (
          <ClassCard
            key={g.key}
            id={`${baseId}-${i}`}
            group={g}
            choice={choiceOf(g)}
            onChoice={(next) => onChoice(g.key, next)}
            activeClasses={activeClasses}
            teacherOptions={teacherOptions}
            teachersLoaded={teachersLoaded}
            missing={attempted ? missing[i]! : []}
          />
        ))}
      </div>
      {limits.length > 0 && (
        <div className={styles.limitBox} role="alert">
          <p className={styles.limitTitle}>
            <Info size={16} aria-hidden="true" />
            한도를 넘어 검사할 수 없습니다
          </p>
          <ul>
            {limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.footer}>
        <Button variant="secondary" size="teacher" onClick={onBack}>
          ← 열 고르기
        </Button>
        <div className={styles.footerEnd}>
          <span className={styles.muted}>
            기존 반 {groups.length - newCount} · 새 반 {newCount} · 학생 {studentCount}명
          </span>
          <Button size="teacher" onClick={check}>
            검사하기
          </Button>
        </div>
      </div>
    </>
  )
}

type ClassCardProps = {
  id: string
  group: Group
  choice: ClassChoice
  onChoice: (next: ClassChoice) => void
  activeClasses: AdminClass[]
  teacherOptions: CheckboxOption<number>[]
  teachersLoaded: boolean
  missing: string[]
}

function ClassCard({
  id,
  group,
  choice,
  onChoice,
  activeClasses,
  teacherOptions,
  teachersLoaded,
  missing,
}: ClassCardProps) {
  const [open, setOpen] = useState(false)
  const title = groupTitle(group)
  const draft = (patch: Partial<NewClassDraft>) =>
    onChoice({ ...choice, draft: { ...choice.draft, ...patch } })
  const invalid = (field: string) => (missing.includes(field) ? true : undefined)
  const picked = activeClasses.find((c) => c.id === choice.existingId)
  const missingId = `${id}-missing`

  return (
    <section
      className={styles.card}
      data-invalid={missing.length > 0 || undefined}
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <h2 id={`${id}-title`} className={styles.cardTitle} tabIndex={-1}>
            {title}
          </h2>
          <span className={styles.muted}>학생 {group.students.length}명</span>
          <button
            type="button"
            className={styles.textButton}
            aria-expanded={open}
            aria-controls={`${id}-list`}
            onClick={() => setOpen(!open)}
          >
            명단 {open ? '접기' : '보기'}
          </button>
        </div>
        <RadioGroup
          legend={<span className={styles.srOnly}>{title} 넣을 곳</span>}
          options={[
            { value: 'existing', label: '기존 반에 넣기' },
            { value: 'new', label: '새 반 만들기' },
          ]}
          value={choice.mode}
          onChange={(mode) => onChoice({ ...choice, mode })}
        />
      </div>
      {open && (
        <ol id={`${id}-list`} className={styles.nameList}>
          {group.students.map((s) => (
            <li key={s.line}>
              <span className={styles.muted}>{s.line}</span> {s.name || '(빈 칸)'}
            </li>
          ))}
        </ol>
      )}
      {choice.mode === 'existing' ? (
        <div className={styles.existingRow}>
          <SelectField
            id={`${id}-existing`}
            label="넣을 반"
            options={[
              { value: '', label: '고르기' },
              ...activeClasses.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
            value={choice.existingId === null ? '' : String(choice.existingId)}
            onChange={(e) =>
              onChoice({
                ...choice,
                existingId: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            aria-invalid={invalid('반')}
            aria-describedby={missing.length > 0 ? missingId : undefined}
          />
          {picked && (
            <span className={styles.muted}>
              {initialChoice(group, activeClasses).existingId === picked.id
                ? '같은 이름의 진행 중인 반을 미리 골라 두었습니다 · '
                : ''}
              지금 학생 {picked.studentCount}명
            </span>
          )}
        </div>
      ) : (
        <div className={styles.newGrid}>
          <TextField
            id={`${id}-name`}
            size="teacher"
            label="반 이름"
            value={choice.draft.name}
            onChange={(e) => draft({ name: e.target.value })}
            maxLength={50}
            aria-invalid={invalid('반 이름')}
            aria-describedby={missing.length > 0 ? missingId : undefined}
          />
          <SelectField
            id={`${id}-book`}
            label="권"
            options={[{ value: '', label: '고르기' }, ...BOOK_OPTIONS]}
            value={choice.draft.bookCode}
            onChange={(e) => draft({ bookCode: e.target.value })}
            aria-invalid={invalid('권')}
            aria-describedby={missing.length > 0 ? missingId : undefined}
          />
          <TextField
            id={`${id}-start`}
            size="teacher"
            type="date"
            label="개강일"
            value={choice.draft.startDate}
            onChange={(e) => draft({ startDate: e.target.value })}
            aria-invalid={invalid('개강일')}
            aria-describedby={missing.length > 0 ? missingId : undefined}
          />
          <div id={`${id}-weekdays`} className={styles.weekdays}>
            <CheckboxGroup
              legend="요일"
              options={WEEKDAY_OPTIONS}
              selected={choice.draft.weekdays}
              onChange={(weekdays) => draft({ weekdays })}
            />
          </div>
          <div className={styles.teachers}>
            <CheckboxGroup
              legend="교사 (선택)"
              options={teacherOptions}
              selected={choice.draft.teacherIds}
              onChange={(teacherIds) => draft({ teacherIds })}
              empty={teachersLoaded ? '활성 교사가 없습니다' : '교사 목록 불러오는 중'}
            />
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <p id={missingId} className={styles.missing}>
          <Info size={16} aria-hidden="true" />
          {missing.join(' · ')}을 정해 주세요
        </p>
      )}
    </section>
  )
}
