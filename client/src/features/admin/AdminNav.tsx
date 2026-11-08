import { NavLink } from 'react-router';
import { cn } from '../../components/ui/cn';

const tabs = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/courses', label: 'Courses', end: false },
  { to: '/admin/learners', label: 'Learners', end: false },
];

export function AdminNav() {
  return (
    <nav aria-label="Admin sections" className="mb-8 border-b border-slate-200">
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'inline-block border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap',
                  isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800',
                )
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
