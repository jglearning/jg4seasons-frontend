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
import { JoinPage } from '../features/auth/JoinPage'
import { RejoinPage } from '../features/auth/RejoinPage'
import { RequireSession } from '../features/auth/RequireSession'
import { TeacherLoginPage } from '../features/auth/TeacherLoginPage'
import { LessonPage } from '../features/player/LessonPage'
import { HomePage } from '../features/student/HomePage'
import { LessonsPage } from '../features/student/LessonsPage'
import { CardsPage } from '../features/words/CardsPage'
import { WordsPage } from '../features/words/WordsPage'
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
      { path: '/join', element: <JoinPage /> },
      { path: '/rejoin', element: <RejoinPage /> },
      { path: '/teacher/login', element: <TeacherLoginPage /> },
      {
        element: <RequireSession area="student" />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/lessons', element: <LessonsPage /> },
          { path: '/lessons/:code', element: <LessonPage /> },
          { path: '/lessons/:code/words', element: <WordsPage /> },
          { path: '/lessons/:code/cards', element: <CardsPage /> },
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
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]
