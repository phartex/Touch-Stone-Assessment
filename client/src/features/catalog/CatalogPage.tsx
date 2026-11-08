import { Search, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/Card';
import { cn } from '../../components/ui/cn';
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/ui/States';
import { useCatalog, useCategories } from '../../lib/queries';
import { CourseCard } from './CourseCard';

function useDebounced<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function CatalogPage() {
  // Filters live in the URL so searches are shareable and survive refresh/back navigation.
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const [search, setSearch] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebounced(search.trim());

  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch) next.set('search', debouncedSearch);
        else next.delete('search');
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, setParams]);

  const setCategory = (value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('category', value);
      else next.delete('category');
      return next;
    });

  const catalog = useCatalog({ search: debouncedSearch || undefined, category: category || undefined });
  const categories = useCategories();
  const hasFilters = Boolean(debouncedSearch || category);

  return (
    <>
      <PageHeader title="Course catalog" description="Browse courses and enroll to start learning." />

      <div className="mb-8 space-y-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <label htmlFor="course-search" className="sr-only">
            Search courses
          </label>
          <input
            id="course-search"
            type="search"
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
          />
        </div>
        {categories.data && categories.data.length > 0 && (
          <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
            {['', ...categories.data].map((value) => (
              <button
                key={value || 'all'}
                type="button"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors',
                  category === value
                    ? 'bg-brand-600 text-white ring-brand-600'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                )}
              >
                {value || 'All'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div aria-live="polite" aria-busy={catalog.isFetching}>
        {catalog.isPending ? (
          <CardGridSkeleton />
        ) : catalog.isError ? (
          <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} title="Couldn't load courses" />
        ) : catalog.data.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-6" aria-hidden />}
            title={hasFilters ? 'No courses match your filters' : 'No courses yet'}
            description={hasFilters ? 'Try a different search term or category.' : 'Check back soon for new content.'}
            action={
              hasFilters && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setParams({});
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <>
            <p className="sr-only">{catalog.data.length} courses found</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.data.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
