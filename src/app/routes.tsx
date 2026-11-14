import type { RouteObject } from 'react-router'
import { AdminOnly } from '../features/admin/AdminOnly'
import { ClassDetailPage } from '../features/admin/ClassDetailPage'
import { ClassesPage } from '../features/admin/ClassesPage'
import { ClassNewPage } from '../features/admin/ClassNewPage'
import { DashboardPage } from '../features/admin/DashboardPage'
import { StudentNewPage } from '../features/admin/StudentNewPage'
import { StudentsIndexPage } from '../features/admin/StudentsIndexPage'
import { StudentsPage } from '../features/admin/StudentsPage'
import { TeacherDetailPage } from '../features/admin/TeacherDetailPage'
import { TeacherNewPage } from '../features/admin/TeacherNewPage'
import { TeachersPage } from '../features/admin/TeachersPage'
import { LicensesPage } from '../features/admin/LicensesPage'
import { EntryPage } from '../features/auth/EntryPage'
import { RequireSession } from '../features/auth/RequireSession'
import { TeacherLoginPage } from '../features/auth/TeacherLoginPage'
import { LessonPage } from '../features/player/LessonPage'
import { HomePage } from '../features/student/HomePage'
import { LessonsPage } from '../features/student/LessonsPage'
import { SettingsPage } from '../features/student/SettingsPage'
import { AcademiesPage } from '../features/system/AcademiesPage'
import { AcademyNewPage } from '../features/system/AcademyNewPage'
import { CardsRedirect, WordsPage } from '../features/words/WordsPage'
import { ClassesPage as TeacherClassesPage } from '../features/teacher/ClassesPage'
import { LessonPage as TeacherLessonPage } from '../features/teacher/LessonPage'
import { MatrixPage } from '../features/teacher/MatrixPage'
import { SessionsPage } from '../features/teacher/SessionsPage'
import { StudentPage as TeacherStudentPage } from '../features/teacher/StudentPage'
import { NotFound } from './NotFound'
import { RouteError } from './RouteError'
import { SessionRoot } from './SessionRoot'
import { StaffShell } from './StaffShell'

export const routes: RouteObject[] = [
  {
    element: <SessionRoot />,
    errorElement: <RouteError />,
    children: [
      // S-01·S-02는 화면 하나(#88) — 주소는 둘 다 유지. /rejoin은 저장된 가입 코드가 있을 때 보내는 주소(entry.ts)
      { path: '/join', element: <EntryPage /> },
      { path: '/rejoin', element: <EntryPage /> },
      { path: '/teacher/login', element: <TeacherLoginPage /> },
      {
        element: <RequireSession area="student" />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/lessons', element: <LessonsPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/lessons/:code', element: <LessonPage /> },
          { path: '/lessons/:code/words', element: <WordsPage /> },
          { path: '/lessons/:code/cards', element: <CardsRedirect /> },
        ],
      },
      {
        element: <RequireSession area="staff" />,
        children: [
          {
            element: <StaffShell />,
            children: [
              { path: '/teacher', element: <TeacherClassesPage /> },
              { path: '/teacher/classes/:id', element: <MatrixPage /> },
              {
                path: '/teacher/classes/:id/students/:studentId',
                element: <TeacherStudentPage />,
              },
              { path: '/teacher/classes/:id/lessons/:code', element: <TeacherLessonPage /> },
              { path: '/teacher/classes/:id/sessions', element: <SessionsPage /> },
              {
                element: <AdminOnly />,
                children: [
                  { path: '/admin/classes', element: <ClassesPage /> },
                  { path: '/admin/classes/new', element: <ClassNewPage /> },
                  { path: '/admin/classes/:id', element: <ClassDetailPage /> },
                  { path: '/admin/classes/:id/students', element: <StudentsPage /> },
                  { path: '/admin/classes/:id/students/new', element: <StudentNewPage /> },
                  { path: '/admin/students', element: <StudentsIndexPage /> },
                  { path: '/admin/dashboard', element: <DashboardPage /> },
                  { path: '/admin/teachers', element: <TeachersPage /> },
                  { path: '/admin/teachers/new', element: <TeacherNewPage /> },
                  { path: '/admin/teachers/:id', element: <TeacherDetailPage /> },
                  { path: '/admin/licenses', element: <LicensesPage /> },
                ],
              },
            ],
          },
        ],
      },
      // 운영자(superadmin, 학원 없음) 화면 — 학원 화면과 같은 틀, 메뉴만 다르다(SYS-07)
      {
        element: <RequireSession area="system" />,
        children: [
          {
            element: <StaffShell />,
            children: [
              { path: '/system/academies', element: <AcademiesPage /> },
              { path: '/system/academies/new', element: <AcademyNewPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]
