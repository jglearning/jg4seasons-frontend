import type { RouteObject } from 'react-router'
import { JoinPage } from '../features/auth/JoinPage'
import { RejoinPage } from '../features/auth/RejoinPage'
import { RequireSession } from '../features/auth/RequireSession'
import { NotFound } from './NotFound'
import { StudentHomePlaceholder, TeacherHomePlaceholder } from './Placeholders'
import { SessionRoot } from './SessionRoot'

export const routes: RouteObject[] = [
  {
    element: <SessionRoot />,
    children: [
      { path: '/join', element: <JoinPage /> },
      { path: '/rejoin', element: <RejoinPage /> },
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
