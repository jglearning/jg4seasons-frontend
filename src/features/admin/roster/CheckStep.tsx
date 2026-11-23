import { AlertTriangle, Info, LoaderCircle } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../shared/ui/Button'
import { TextField } from '../../../shared/ui/TextField'
import {
  groupTitle,
  placeOf,
  type ClassChoice,
  type Group,
  type RosterRequest,
  type Student,
} from './build'
import type { RosterIssue } from './rosterApi'
import styles from './Roster.module.css'

// A-05 ④ 검사·만들기 (⑤ 만드는 중 포함). 목록은 마지막 검사 결과 그대로 두고, 무엇이든 바뀌면 만들기를 잠그고
// "다시 검사"를 주 버튼으로. 문구는 서버 message 그대로, 위치는 검사 때의 요청 차례(snapshot)로 찾는다

export type CheckSnapshot = {
  body: RosterRequest
  /** 검사 때의 묶음 — field의 classes[i]·students[j]가 가리키는 차례 */
  groups: Group[]
  at: Date
  errors: RosterIssue[]
  warnings: RosterIssue[]
  /** 400 VALIDATION이 전체(개수 한도)를 짚음 */
  tooMany: boolean
}

type CheckStepProps = {
  groups: Group[]
  choices: ReadonlyMap<string, ClassChoice>
  check: CheckSnapshot | null
  stale: boolean
  checking: boolean
  checkError: ReactNode
  confirmed: boolean
  onConfirm: (next: boolean) => void
  /** 만들기 4xx 뒤 다시 검사했을 때 그 문구 */
  recheckNotice: string | null
  creating: boolean
  /** 만들기 응답을 못 받음·5xx — 만들어졌는지 모름 */
  unknown: boolean
  students: Student[]
  onStudents: (next: Student[]) => void
  onFixClass: (groupKey: string) => void
  onPaste: () => void
  onBack: () => void
  onRecheck: () => void
  onCreate: () => void
}

const TIME = new Intl.DateTimeFormat('ko-KR', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function checkedAt(at: Date): string {
  const parts = Object.fromEntries(TIME.formatToParts(at).map((p) => [p.type, p.value]))
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`
}

export function CheckStep(props: CheckStepProps) {
  const { groups, choices, check, stale, checking, creating, unknown, confirmed } = props
  const confirmId = useId()
  const newCount = groups.filter((g) => choices.get(g.key)?.mode === 'new').length
  const studentCount = groups.reduce((sum, g) => sum + g.students.length, 0)
  const errors = check?.errors ?? []
  const warnings = check?.warnings ?? []
  const locked = creating || unknown
  const canCreate =
    check !== null &&
    !stale &&
    !checking &&
    !check.tooMany &&
    errors.length === 0 &&
    (warnings.length === 0 || confirmed) &&
    !locked
  const recheckFirst = check === null || stale
  const createLabel =
    newCount > 0
      ? `반 ${newCount}개 · 학생 ${studentCount}명 만들기`
      : `학생 ${studentCount}명 만들기`

  return (
    <>
      <div className={styles.tiles}>
        <dl className={styles.tile}>
          <dt>새로 만들 반</dt>
          <dd>{newCount}개</dd>
        </dl>
        <dl className={styles.tile}>
          <dt>기존 반에 넣기</dt>
          <dd>{groups.length - newCount}개</dd>
        </dl>
        <dl className={styles.tile}>
          <dt>새로 만들 학생</dt>
          <dd>{studentCount}명</dd>
        </dl>
      </div>

      {creating ? (
        <div className={styles.statusBox} role="status">
          <LoaderCircle className={styles.spinner} size={20} aria-hidden="true" />
          <div>
            <p className={styles.statusTitle}>
              {newCount > 0 ? `반 ${newCount}개 · ` : ''}학생 {studentCount}명을 만들고 있습니다
            </p>
            <p className={styles.muted}>
              몇 초 걸릴 수 있습니다. 이 화면을 닫거나 새로고침하지 마세요
            </p>
          </div>
        </div>
      ) : unknown ? (
        <div className={styles.unknownBox} role="alert">
          <p className={styles.statusTitle}>
            <AlertTriangle size={18} aria-hidden="true" />
            만들어졌는지 확인하지 못했습니다
          </p>
          <p>
            서버의 응답을 받지 못했습니다. 반 관리에서 반과 학생이 생겼는지 확인해 주세요. 다시
            만들면 학생이 두 번 생길 수 있어서 이 화면에서는 다시 만들 수 없습니다
          </p>
          <Link to="/admin/classes" className={styles.textLink}>
            반 관리에서 확인하기
          </Link>
        </div>
      ) : (
        <>
          {checking && (
            <p className={styles.statusLine} role="status">
              검사하고 있습니다
            </p>
          )}
          {/* 다시 검사해도 화면 모양이 비슷할 수 있어 결과 수를 읽어 준다(audit — 결과 변경 알림) */}
          <p className={styles.srOnly} role="status">
            {check && !checking
              ? `검사를 마쳤습니다. 고칠 것 ${errors.length}개, 확인할 것 ${warnings.length}개`
              : ''}
          </p>
          {props.recheckNotice && !checking && (
            <p className={styles.alertLine} role="alert">
              {props.recheckNotice}. 아무것도 만들지 않았습니다. 다시 검사한 결과를 아래에서 확인해
              주세요
            </p>
          )}
          {props.checkError && (
            <p className={styles.alertLine} role="alert">
              {props.checkError}
            </p>
          )}
          {check?.tooMany && (
            <p className={styles.alertLine} role="alert">
              한 번에 반 30개, 학생 500명까지 가져올 수 있습니다. 나눠서 가져와 주세요{' '}
              <button type="button" className={styles.textButton} onClick={props.onPaste}>
                붙여넣기로 돌아가기
              </button>
            </p>
          )}
          {check && stale && !checking && (
            <p className={styles.staleLine} role="status">
              <Info size={16} aria-hidden="true" />
              검사한 뒤 명단이 바뀌었습니다. 다시 검사해야 만들 수 있습니다
            </p>
          )}
          {check && errors.length > 0 && (
            <IssueBox kind="error" count={errors.length}>
              {errors.map((issue, i) => (
                <IssueRow key={i} kind="error" issue={issue} {...props} snapshot={check} />
              ))}
            </IssueBox>
          )}
          {check && !check.tooMany && errors.length === 0 && (
            <p className={styles.okLine}>
              <strong>오류가 없습니다</strong>
              <span className={styles.muted}> · {checkedAt(check.at)}에 검사했습니다</span>
            </p>
          )}
          {check && warnings.length > 0 && (
            <IssueBox kind="warning" count={warnings.length}>
              {warnings.map((issue, i) => (
                <IssueRow key={i} kind="warning" issue={issue} {...props} snapshot={check} />
              ))}
              <label className={`${styles.check} ${styles.confirm}`} htmlFor={confirmId}>
                <input
                  id={confirmId}
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => props.onConfirm(e.target.checked)}
                />
                위 {warnings.length}개를 확인했고 그대로 만듭니다
              </label>
            </IssueBox>
          )}
          {check && errors.length === 0 && !check.tooMany && (
            <p className={styles.note}>
              만든 뒤에는 되돌릴 수 없습니다. 잘못 만든 학생은 학생 관리에서 한 명씩 퇴원 처리해
              주세요
            </p>
          )}
        </>
      )}

      <div className={styles.footer}>
        <Button variant="secondary" size="teacher" onClick={props.onBack} disabled={locked}>
          ← 반 정하기
        </Button>
        <div className={styles.footerEnd}>
          <Button
            variant={recheckFirst ? 'primary' : 'secondary'}
            size="teacher"
            onClick={props.onRecheck}
            disabled={locked || checking}
          >
            다시 검사
          </Button>
          <Button
            variant={recheckFirst ? 'secondary' : 'primary'}
            size="teacher"
            onClick={props.onCreate}
            disabled={!canCreate}
          >
            {creating ? '만드는 중' : createLabel}
          </Button>
        </div>
      </div>
    </>
  )
}

function IssueBox({
  kind,
  count,
  children,
}: {
  kind: 'error' | 'warning'
  count: number
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className={styles.issueBox} data-kind={kind} aria-labelledby={id}>
      <h2 id={id} className={styles.issueTitle}>
        <strong>{kind === 'error' ? `고칠 것 ${count}개` : `확인할 것 ${count}개`}</strong>
        <span className={styles.muted}>
          {kind === 'error'
            ? ' 모두 고쳐야 만들 수 있습니다'
            : ' 확인만 하면 그대로 만들 수 있습니다'}
        </span>
      </h2>
      <ul className={styles.issueList}>{children}</ul>
    </section>
  )
}

type IssueRowProps = CheckStepProps & {
  kind: 'error' | 'warning'
  issue: RosterIssue
  snapshot: CheckSnapshot
}

function IssueRow({
  kind,
  issue,
  snapshot,
  students,
  onStudents,
  onFixClass,
  creating,
  unknown,
}: IssueRowProps) {
  const place = placeOf(issue.field)
  const group = place.kind === 'all' ? undefined : snapshot.groups[place.group]
  const line = place.kind === 'student' ? group?.students[place.student]?.line : undefined
  const where =
    group === undefined
      ? '전체'
      : line !== undefined
        ? `${groupTitle(group)} · ${line}번 줄`
        : `${groupTitle(group)} · 반 설정`
  const current = line === undefined ? undefined : students.find((s) => s.line === line)
  const locked = creating || unknown

  let fix: ReactNode = null
  if (kind === 'error' && line !== undefined) {
    fix = current ? (
      <div className={styles.fix}>
        <TextField
          size="teacher"
          label={`${line}번 줄 이름`}
          labelHidden
          value={current.name}
          onChange={(e) =>
            onStudents(students.map((s) => (s.line === line ? { ...s, name: e.target.value } : s)))
          }
          maxLength={30}
          autoComplete="off"
          aria-invalid={current.name.trim() === '' ? true : undefined}
          disabled={locked}
        />
        <Button
          variant="secondary"
          size="teacher"
          aria-label={`${line}번 줄 빼기`}
          onClick={() => onStudents(students.filter((s) => s.line !== line))}
          disabled={locked}
        >
          이 줄 빼기
        </Button>
      </div>
    ) : (
      <span className={styles.muted}>이 줄은 뺐습니다</span>
    )
  } else if (kind === 'error' && group !== undefined) {
    fix = (
      <button
        type="button"
        className={styles.textButton}
        onClick={() => onFixClass(group.key)}
        disabled={locked}
      >
        반 정하기에서 고치기
      </button>
    )
  }

  return (
    <li className={styles.issueRow}>
      <span className={styles.issueKind} data-kind={kind}>
        {kind === 'error' ? '오류' : '경고'}
      </span>
      <span className={styles.muted}>{where}</span>
      <span>{issue.message}</span>
      <span className={styles.issueFix}>{fix}</span>
    </li>
  )
}
