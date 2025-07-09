import { Header } from "@/components/layout/Header";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CampusFlow Dashboard',
  description: 'Manage your campus activities.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-background">
        {children}
      </main>
    </div>
  );
}
