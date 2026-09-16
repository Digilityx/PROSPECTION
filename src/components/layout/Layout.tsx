import { useState } from 'react'
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { FeedbackButton } from '@/components/FeedbackButton'

export function Layout() {
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sidebar-collapsed') === 'true'
  )

  function toggleSidebar() {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <div className="h-full min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <MobileNav />
      <main className={collapsed ? 'md:pl-14' : 'md:pl-64'} style={reducedMotion ? undefined : { transition: 'padding-left 200ms ease' }}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <FeedbackButton />
    </div>
  )
}
