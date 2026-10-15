import { ChartColumn, ScrollText, Swords, Users } from 'lucide-react'
import { createBrowserRouter, NavLink, Outlet, RouterProvider } from 'react-router'
import { GameScreen } from './screens/game/GameScreen'
import { GameDetail } from './screens/GameDetail'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { NewGame } from './screens/NewGame'
import { DeckPage, PlayerPage, Pod } from './screens/Pod'
import { Onboarding } from './screens/Onboarding'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'
import { SyncProvider } from './sync/SyncProvider'

const router = createBrowserRouter([
  {
    element: <TabLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/games', element: <History /> },
      { path: '/stats', element: <Stats /> },
      { path: '/pod', element: <Pod /> },
    ],
  },
  { path: '/new', element: <NewGame /> },
  { path: '/game/:id', element: <GameScreen /> },
  { path: '/games/:id', element: <GameDetail /> },
  { path: '/pod/player/:id', element: <PlayerPage /> },
  { path: '/pod/deck/:id', element: <DeckPage /> },
  { path: '/settings', element: <Settings /> },
  { path: '*', element: <Home /> },
])

export function App() {
  return (
    <SyncProvider>
      <Onboarding>
        <RouterProvider router={router} />
      </Onboarding>
    </SyncProvider>
  )
}

const TABS = [
  { to: '/', label: 'Play', icon: Swords },
  { to: '/games', label: 'Games', icon: ScrollText },
  { to: '/stats', label: 'Stats', icon: ChartColumn },
  { to: '/pod', label: 'Pod', icon: Users },
]

function TabLayout() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <main className="flex-1 pb-24">
        <Outlet />
      </main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${isActive ? 'text-gold' : 'text-faint'}`}
            >
              <Icon className="size-6" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
