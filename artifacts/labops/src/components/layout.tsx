import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, Boxes, Calculator, ChevronRight, Cog, Command, FileDown, Gauge, Menu, Network, Radio, Settings, Terminal, X } from 'lucide-react';

const nav = [
  { href: '/', label: 'Dashboard', icon: Gauge },
  { href: '/devices', label: 'Devices', icon: Boxes },
  { href: '/monitoring', label: 'Monitoring', icon: Activity },
  { href: '/reports', label: 'Reports', icon: FileDown },
  { href: '/config-generator', label: 'Config generator', icon: Terminal },
  { href: '/tools', label: 'Network tools', icon: Calculator },
];
export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation(); const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location]);
  return <div className="noise min-h-[100dvh] bg-background text-foreground">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[76px] items-center justify-between border-b border-sidebar-border px-6">
        <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/.18)]"><Network size={19}/></span>
          <span><span className="block text-[15px] font-extrabold tracking-tight">LAB<span className="text-primary">OPS</span></span><span className="mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">field console</span></span>
        </Link>
        <button className="md:hidden text-muted-foreground" onClick={() => setOpen(false)} aria-label="Close navigation" data-testid="button-close-menu"><X size={18}/></button>
      </div>
      <div className="px-4 pt-7"><p className="mono mb-3 px-3 text-[10px] uppercase tracking-[.18em] text-muted-foreground">Workspace</p>
        <nav className="space-y-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors ${location === href || (href !== '/' && location.startsWith(href)) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}><Icon size={17}/><span>{label}</span>{location === href && <ChevronRight className="ml-auto" size={14}/>}</Link>)}</nav>
      </div>
      <div className="mt-7 px-4"><p className="mono mb-3 px-3 text-[10px] uppercase tracking-[.18em] text-muted-foreground">Utilities</p>
        <nav className="space-y-1"><Link href="/config-generator/saved" data-testid="link-saved-configs" className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold ${location === '/config-generator/saved' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}><Radio size={17}/>Saved configurations</Link><Link href="/settings" data-testid="link-settings" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"><Settings size={17}/>Settings</Link></nav>
      </div>
      <div className="mt-auto p-5"><div className="rounded-lg border border-sidebar-border bg-background/35 p-3"><div className="flex items-center gap-2 text-[11px] font-bold"><span className="size-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"/> Console online</div><div className="mono mt-2 text-[10px] text-muted-foreground">LOCAL SESSION / PHASE 13</div></div></div>
    </aside>
    {open && <button className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} aria-label="Close menu" data-testid="button-overlay"/>}
    <main className="min-h-[100dvh] md:pl-[248px]"><header className="flex h-[76px] items-center justify-between border-b border-border bg-background/75 px-5 backdrop-blur md:px-9"><button className="text-muted-foreground md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} data-testid="button-open-menu"><Menu size={20}/></button><div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><Command size={14}/> <span className="mono">LABOPS /</span><span className="text-foreground">{location === '/' ? 'overview' : location.slice(1).replaceAll('/', ' / ')}</span></div><div className="ml-auto flex items-center gap-4"><span className="mono hidden text-[10px] text-muted-foreground sm:block">UTC {new Date().toISOString().slice(11, 16)}</span><Link href="/settings" aria-label="Open settings" className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-secondary" data-testid="link-header-settings"><Cog size={15}/></Link></div></header><div className="p-5 md:p-9">{children}</div></main>
  </div>;
}
