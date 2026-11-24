import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { levelProps } from '../../shared/level'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { StatusPill } from '../../shared/ui/StatusPill'
import { Table, type Column } from '../../shared/ui/Table'
import { koreaTime } from './format'
import { teacherClassesQuery } from './teacherApi'
import styles from './Teacher.module.css'
import {
  wordTestDetailQuery,
  type TeacherWordTestDetail,
  type TeacherWordTestItem,
} from './wordTestApi'
import { resultLook, statusLook } from './wordTestFormat'

// 단어시험 제출 상세(#175, 1단계 시연용) — 왼쪽 답안지 사진(눌러서 새 탭으로 크게), 오른쪽 문항별 정답·읽은 글자·결과.
// 조회만(정정·검토 없음). 점수·결과는 서버 값 그대로. 문항 순서는 서버 순서(번호순) — 사진과 번호로 맞춰 본다.
// 1280은 두 칸, 좁으면(768) 사진이 위·문항이 아래
export function WordTestDetailPage() {
  const params = useParams()
  const classId = Number(params.id)
  const submissionId = Number(params.submissionId)
  const classes = useQuery(teacherClassesQuery)
  const detail = useQuery(wordTestDetailQuery(submissionId))
  const klass = classes.data?.items.find((c) => c.id === classId)
  const data = detail.data

  return (
    <div {...levelProps(klass?.level.colorHex)}>
      <Link
        to={
          data
            ? `/teacher/classes/${classId}/lessons/${data.lessonCode}`
            : `/teacher/classes/${classId}`
        }
        className={styles.back}
      >
        ← {data ? `${data.lessonCode} 회차 상세` : klass ? `${klass.name} 청취 현황` : '청취 현황'}
      </Link>
      {data ? <DetailBody data={data} /> : <StaffLoadState query={detail} />}
    </div>
  )
}

function DetailBody({ data }: { data: TeacherWordTestDetail }) {
  const look = statusLook(data.status)
  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{data.student.name} 단어시험</h1>
          <p className={styles.sub}>
            {data.lessonCode} · 철자 쓰기 · {data.attemptNo}회째 · {koreaTime(data.submittedAt)}{' '}
            제출
          </p>
        </div>
        <div className={styles.wordTestScore}>
          <StatusPill status={look.status}>{look.text}</StatusPill>
          {data.score !== null && (
            <span className={styles.wordTestScoreValue}>
              {data.score} / {data.total}
            </span>
          )}
        </div>
      </div>

      <div className={styles.wordTestDetail}>
        <Photo data={data} />
        <div className={styles.wordTestItems}>
          <Items data={data} />
        </div>
      </div>
    </>
  )
}

function Photo({ data }: { data: TeacherWordTestDetail }) {
  if (data.imageUrl === null) {
    return (
      <div className={styles.wordTestPhotoEmpty}>
        <p className={styles.muted}>답안지 사진이 지워졌습니다.</p>
      </div>
    )
  }
  return (
    <figure className={styles.wordTestPhoto}>
      {/* 서명 주소라 새 탭에서 브라우저 그대로 크게 본다(확대 창 없이) */}
      <a href={data.imageUrl} target="_blank" rel="noopener noreferrer">
        <img src={data.imageUrl} alt={`${data.student.name} 답안지 사진, 새 탭에서 크게 보기`} />
      </a>
      <figcaption className={styles.muted}>사진을 누르면 새 탭에서 크게 볼 수 있습니다.</figcaption>
    </figure>
  )
}

function Items({ data }: { data: TeacherWordTestDetail }) {
  if (data.status !== 'graded' || data.score === null) {
    return <p className={styles.notice}>{NOT_GRADED[data.status] ?? NOT_GRADED.confirming}</p>
  }
  const items = data.items ?? []
  // 판단 못 함(unclear)과 모르는 결과 값 — 표에서 "확인 필요"로 보이는 문항 수(표시용)
  const unclear = items.filter(
    (item) => item.result !== 'correct' && item.result !== 'wrong' && item.result !== 'blank',
  ).length
  const columns: Column<TeacherWordTestItem>[] = [
    { key: 'no', header: '번호', numeric: true, cell: (r) => r.no },
    { key: 'prompt', header: '뜻', cell: (r) => r.prompt },
    { key: 'answer', header: '정답', cell: (r) => <span lang="en">{r.answer}</span> },
    {
      key: 'written',
      header: '읽은 글자',
      cell: (r) =>
        r.written === '' ? (
          <span className={styles.muted}>(빈칸)</span>
        ) : (
          <span lang="en">{r.written}</span>
        ),
    },
    {
      key: 'result',
      header: '결과',
      cell: (r) => {
        const look = resultLook(r.result)
        return <StatusPill status={look.status}>{look.text}</StatusPill>
      },
    },
  ]
  return (
    <>
      {unclear > 0 && (
        <p className={styles.notice}>
          확인 필요 {unclear}문항은 글자가 흐려 채점하지 못했습니다. 사진을 보고 판단해 주세요.
        </p>
      )}
      <Table
        caption="문항별 정답과 읽은 글자"
        columns={columns}
        rows={items}
        rowKey={(r) => r.no}
        empty="문항이 없습니다"
      />
    </>
  )
}

const NOT_GRADED: Partial<Record<string, string>> = {
  pending: '아직 채점하고 있습니다. 잠시 뒤에 다시 확인해 주세요.',
  grading: '아직 채점하고 있습니다. 잠시 뒤에 다시 확인해 주세요.',
  failed: '사진을 채점하지 못했습니다. 학생이 다시 찍어 올려야 합니다.',
  confirming: '채점 결과를 확인하고 있습니다.',
  graded: '채점은 끝났지만 점수를 받지 못했습니다.',
}
