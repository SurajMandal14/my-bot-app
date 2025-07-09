
"use client";

import type { ReactNode } from 'react';
import { StudentDataProvider } from '@/contexts/StudentDataContext';

export default function StudentDashboardPagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <StudentDataProvider>
      {children}
    </StudentDataProvider>
  );
}
