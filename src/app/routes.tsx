import type { RouteObject } from 'react-router'
import { RequireSession } from '../features/auth/RequireSession'
import { NotFound } from './NotFound'
import { StudentHomePlaceholder, TeacherHomePlaceholder } from './Placeholders'
import { SessionRoot } from './SessionRoot'

export const routes: RouteObject[] = [
  {
    element: <SessionRoot />,
    children: [
      {
        element: <RequireSession area="student" />,
        children: [{ path: '/', element: <StudentHomePlaceholder /> }],
      },
      {
        element: <RequireSession area="staff" />,
        children: [{ path: '/teacher', element: <TeacherHomePlaceholder /> }],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]
