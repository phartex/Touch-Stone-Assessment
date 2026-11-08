import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '../../components/layout/AppLayout';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <main className="flex flex-col justify-center px-4 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 to-violet-700 lg:flex lg:items-center lg:justify-center">
        <div className="max-w-md px-12 text-white">
          <h2 className="text-3xl font-bold leading-tight">Learn at your pace. Pick up right where you left off.</h2>
          <ul className="mt-8 space-y-4 text-brand-100">
            {['Focused, bite-sized video lessons', 'Automatic progress and resume', 'Track completion across every course'].map(
              (item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-emerald-300" aria-hidden />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}
