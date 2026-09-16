import { NavLink } from 'react-router-dom'
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { DigiIcon } from '@/components/icons/DigiIcon'
import { useAuth, isAdmin } from '@/lib/auth'

const allNavItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, restricted: false },
  { to: '/entreprises', label: 'Entreprises', icon: Building2, restricted: true },
  { to: '/contacts', label: 'Contacts', icon: Users, restricted: true },
  { to: '/membres', label: 'Membres Digi', icon: DigiIcon, restricted: false },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { membre, signOut } = useAuth()
  const fullAccess = isAdmin(membre?.role)

  const navItems = fullAccess
    ? allNavItems
    : allNavItems.filter(item => item.restricted)

  return (
    <aside
      className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r border-sidebar-border overflow-hidden ${collapsed ? 'md:w-14' : 'md:w-64'}`}
      style={{
        background: 'linear-gradient(160deg, rgba(208,48,48,0.10) 0%, transparent 38%), #050d2b',
        transition: reducedMotion ? undefined : 'width 200ms ease',
      }}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header / Logo */}
        <div className={`flex items-center h-16 border-b border-sidebar-border shrink-0 ${collapsed ? 'justify-center' : 'gap-3 px-5'}`}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="#f44242"/>
            <path fill="white" transform="translate(6,6.4) scale(0.417)" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
          </svg>
          {!collapsed && (
            <span className="text-[15px] font-extrabold tracking-tight text-white whitespace-nowrap">
              Digi<span className="text-sidebar-accent-foreground">Leads</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => {
                const layout = collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                const color = isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                return `flex items-center rounded-lg text-sm font-medium transition-colors ${layout} ${color}`
              }}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className={`py-4 border-t border-sidebar-border space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {membre && !collapsed && (
            <div className="px-3 pb-2">
              <p className="text-sm font-medium text-white truncate">{membre.full_name}</p>
              <p className="text-xs text-sidebar-foreground capitalize">{membre.role}</p>
            </div>
          )}
          <button
            onClick={signOut}
            aria-label="Se déconnecter"
            title={collapsed ? 'Se déconnecter' : undefined}
            className={`flex items-center rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors w-full ${collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2'}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && 'Se déconnecter'}
          </button>
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Développer le menu' : 'Réduire le menu'}
            title={collapsed ? 'Développer le menu' : 'Réduire le menu'}
            className={`flex items-center rounded-lg text-sm font-medium text-sidebar-foreground/40 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors w-full ${collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2'}`}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronLeft className="h-4 w-4 shrink-0" />}
            {!collapsed && <span className="text-xs">Réduire</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
