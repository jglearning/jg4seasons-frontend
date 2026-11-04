import { StudentLayout } from '../shared/ui/StudentLayout'

// 임시 — 학생 홈(S-03)과 교사 반 목록(T-02) 이슈에서 실제 화면으로 바꾼다
export function StudentHomePlaceholder() {
  return (
    <StudentLayout>
      <h1 style={{ marginTop: 'var(--space-8)', fontSize: 22 }}>홈 화면은 준비 중이에요</h1>
    </StudentLayout>
  )
}

export function TeacherHomePlaceholder() {
  return (
    <main style={{ padding: 'var(--space-8) var(--gutter-teacher)' }}>
      <h1 style={{ fontSize: 20 }}>반 목록 화면 준비 중</h1>
    </main>
  )
}
