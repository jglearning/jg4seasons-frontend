import { StudentLayout } from '../shared/ui/StudentLayout'

// 임시 — 학생 홈(S-03)과 교사 반 목록(T-02) 이슈에서 실제 화면으로 바꾼다
export function StudentHomePlaceholder() {
  return (
    <StudentLayout>
      <h1 style={{ marginTop: 'var(--space-8)', fontSize: 22 }}>홈 화면은 준비 중이에요</h1>
    </StudentLayout>
  )
}

// 교사·관리자 틀(StaffShell)이 <main>을 그린다
export function TeacherHomePlaceholder() {
  return <h1 style={{ margin: 0, fontSize: 20 }}>반 목록 화면 준비 중</h1>
}
