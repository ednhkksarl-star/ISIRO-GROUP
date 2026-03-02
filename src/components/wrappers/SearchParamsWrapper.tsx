'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SearchParamsContent({ children }: { children: (searchParams: URLSearchParams) => React.ReactNode }) {
  const searchParams = useSearchParams();
  return <>{children(searchParams)}</>;
}

export function SearchParamsWrapper({ children }: { children: (searchParams: URLSearchParams | null) => React.ReactNode }) {
  return (
    <Suspense fallback={<>{children(null)}</>}>
      <SearchParamsContent>
        {(searchParams) => children(searchParams)}
      </SearchParamsContent>
    </Suspense>
  );
}

