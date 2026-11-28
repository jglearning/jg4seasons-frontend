import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/errors'
import { Button } from '../../shared/ui/Button'
import { SelectField } from '../../shared/ui/SelectField'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { Table, type Column } from '../../shared/ui/Table'
import { TextField } from '../../shared/ui/TextField'
import { useSubmit } from '../../shared/useSubmit'
import {
  academyQuery,
  setTalkStudents,
  talkStudentsQuery,
  type TalkStudent,
  type TalkStudentListResponse,
} from './systemApi'
import { TALK_COPY } from './systemCopy'
import styles from './System.module.css'

// O-04 학생별 프리토킹 켜기·끄기(BE #97). 줄 버튼은 한 명, 묶음 바는 고른 여러 명 — 둘 다 PUT 한 번, 확인 창 없음.
// 목록은 재원생 전체가 한 번에 오고(페이지 없음) 거르기는 화면 안에서만. 순서는 서버 그대로.
// 저장 뒤에는 응답(바뀐 학생)을 목록에 합친다 — 다시 받지 않아도 서버 값 그대로다.
// 학원 스위치(features.talk)는 응답에 없어 상태를 단정하지 않고 안내 한 줄만 둔다
const ALL_CLASSES = 'all'
const NO_CLASS = 'none'

export function TalkStudentsPage() {
  const id = Number(useParams().id)
  const detail = useQuery(academyQuery(id))
  const list = useQuery(talkStudentsQuery(id))
  const name = detail.data?.academy.name

  return (
    <>
      <Link to={`/system/academies/${id}`} className={styles.back}>
        ← {name ?? '학원 상세'}
      </Link>
      {name !== undefined && list.data ? (
        <TalkStudents key={id} id={id} academyName={name} students={list.data.items} />
      ) : (
        <StaffLoadState query={detail.isError ? detail : list} />
      )}
    </>
  )
}

function TalkStudents({
  id,
  academyName,
  students,
}: {
  id: number
  academyName: string
  students: TalkStudent[]
}) {
  const queryClient = useQueryClient()
  const [classFilter, setClassFilter] = useState(ALL_CLASSES)
  const [search, setSearch] = useState('')
  const [onlyOn, setOnlyOn] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [done, setDone] = useState<string>()
  const submit = useSubmit(TALK_COPY)
  const allBox = useRef<HTMLInputElement | null>(null)

  // 반 고르기: 목록에 나온 반(서버 순서) + 반 없는 학생이 있으면 "반 없음"
  const classOptions = [{ value: ALL_CLASSES, label: '전체 반' }]
  for (const s of students) {
    if (s.class && !classOptions.some((o) => o.value === String(s.class?.id))) {
      classOptions.push({ value: String(s.class.id), label: s.class.name })
    }
  }
  if (students.some((s) => s.class === null))
    classOptions.push({ value: NO_CLASS, label: '반 없음' })

  const query = search.trim()
  const visible = students.filter(
    (s) =>
      (classFilter === ALL_CLASSES ||
        (classFilter === NO_CLASS ? s.class === null : String(s.class?.id) === classFilter)) &&
      (query === '' || s.name.includes(query)) &&
      (!onlyOn || s.talkEnabled),
  )
  // 거르기로 안 보이게 된 학생은 고른 것에서 뺀다 — 보이지 않는 학생이 묶음에 섞이지 않게
  const picked = selected.filter((sid) => visible.some((s) => s.id === sid))
  const allPicked = visible.length > 0 && picked.length === visible.length
  const onCount = students.filter((s) => s.talkEnabled).length

  function toggle(sid: number, on: boolean) {
    setSelected((before) => (on ? [...before, sid] : before.filter((x) => x !== sid)))
  }

  async function save(ids: number[], enabled: boolean, label: string, fromBulk = false) {
    setDone(undefined)
    const result = await submit.run(async () => {
      try {
        return await setTalkStudents(id, { studentIds: ids, enabled })
      } catch (reason) {
        // 재원생이 아닌 학생이 섞였다(그사이 퇴원 등) — 서버는 아무것도 바꾸지 않았다. 지금 명단을 다시 받는다
        if (reason instanceof ApiError && reason.code === 'NOT_FOUND') {
          void queryClient.invalidateQueries({ queryKey: talkStudentsQuery(id).queryKey })
        }
        throw reason
      }
    })
    if (result === undefined) return
    queryClient.setQueryData<TalkStudentListResponse>(talkStudentsQuery(id).queryKey, (before) =>
      before
        ? {
            items: before.items.map((s) => result.items.find((r) => r.id === s.id) ?? s),
          }
        : before,
    )
    // 묶음으로 바꾸면 묶음 바가 사라져 포커스가 빠진다 — 머리 체크 칸으로 옮긴다
    if (fromBulk) allBox.current?.focus()
    setSelected((before) => before.filter((sid) => !ids.includes(sid)))
    setDone(`${label} 프리토킹을 ${enabled ? '켰습니다' : '껐습니다'}`)
  }

  const columns: Column<TalkStudent>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          className={styles.rowCheck}
          ref={(el) => {
            allBox.current = el
            if (el) el.indeterminate = picked.length > 0 && !allPicked
          }}
          aria-label="보이는 학생 모두 선택"
          checked={allPicked}
          onChange={(e) => setSelected(e.target.checked ? visible.map((s) => s.id) : [])}
          disabled={visible.length === 0}
        />
      ),
      cell: (s) => (
        <input
          type="checkbox"
          className={styles.rowCheck}
          aria-label={`${s.name} 선택`}
          checked={picked.includes(s.id)}
          onChange={(e) => toggle(s.id, e.target.checked)}
        />
      ),
    },
    {
      key: 'class',
      header: '반',
      cell: (s) => (s.class ? s.class.name : <span className={styles.muted}>반 없음</span>),
    },
    {
      key: 'name',
      header: '이름',
      cell: (s) => (
        <>
          {s.name}
          {s.class === null && <span className={styles.tag}>반이 생겨야 사용 가능</span>}
        </>
      ),
    },
    {
      key: 'talk',
      header: '프리토킹',
      cell: (s) => (
        <span className={s.talkEnabled ? styles.on : styles.off}>
          {s.talkEnabled ? '켜짐' : '꺼짐'}
        </span>
      ),
    },
    {
      key: 'action',
      header: <span className={styles.srOnly}>켜기·끄기</span>,
      cell: (s) => (
        <Button
          variant="secondary"
          size="teacher"
          // 보내는 동안에도 비활성화하지 않는다 — 비활성화하면 누른 버튼에서 포커스가 빠진다(키보드).
          // 두 번째 누르기는 useSubmit이 무시한다
          aria-label={`${s.name} 프리토킹 ${s.talkEnabled ? '끄기' : '켜기'}`}
          onClick={() => void save([s.id], !s.talkEnabled, s.name)}
        >
          {s.talkEnabled ? '끄기' : '켜기'}
        </Button>
      ),
    },
  ]

  const error = submit.formError([])

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>프리토킹 학생</h1>
          <p className={styles.sub}>
            {academyName} · 켜짐 {onCount}명 / 재원생 {students.length}명
          </p>
        </div>
      </div>
      <p className={styles.panel}>
        학원 프리토킹이 꺼져 있으면 켜 둔 학생도 쓸 수 없습니다. 꺼진 학생 화면에는 프리토킹이
        보이지 않습니다.
      </p>

      <div className={styles.filters}>
        <SelectField
          className={styles.classSelect}
          label="반"
          options={classOptions}
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        />
        <TextField
          size="teacher"
          type="search"
          label="이름"
          placeholder="이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className={styles.check}>
          <input type="checkbox" checked={onlyOn} onChange={(e) => setOnlyOn(e.target.checked)} />
          켜진 학생만
        </label>
      </div>

      {picked.length > 0 && (
        <div className={styles.bulk} role="group" aria-label="고른 학생">
          <strong>{picked.length}명 선택</strong>
          <Button
            size="teacher"
            onClick={() => void save(picked, true, `${picked.length}명`, true)}
          >
            {picked.length}명 켜기
          </Button>
          <Button
            variant="secondary"
            size="teacher"
            onClick={() => void save(picked, false, `${picked.length}명`, true)}
          >
            {picked.length}명 끄기
          </Button>
          <button type="button" className={styles.textButton} onClick={() => setSelected([])}>
            선택 해제
          </button>
        </div>
      )}

      <div className={styles.talkTable}>
        <Table
          caption="프리토킹 학생"
          columns={columns}
          rows={visible}
          rowKey={(s) => s.id}
          empty={students.length === 0 ? '재원생 없음' : '조건에 맞는 학생 없음'}
        />
      </div>
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <p className={styles.note} role="status">
        {done}
      </p>
    </>
  )
}
