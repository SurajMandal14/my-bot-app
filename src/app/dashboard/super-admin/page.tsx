
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { School, Users, Settings, BarChart3, Loader2, TicketPercent, UserCog, CalendarFold } from "lucide-react";
import { useState, useEffect } from "react";
import { getSchoolsCount } from "@/app/actions/schools";
import { getMasterAdminsCount } from "@/app/actions/masterAdmins";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  isLoading: boolean;
  link?: string;
  linkText?: string;
}

function StatCard({ title, value, icon: Icon, isLoading, link, linkText }: StatCardProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
        {link && linkText && !isLoading && (
          <Link href={link} className="text-xs text-muted-foreground hover:text-primary transition-colors mt-1 block">
            {linkText}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function SuperAdminDashboardPage() {
  const [schoolCount, setSchoolCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setIsLoadingSchools(true);
      const schoolsResult = await getSchoolsCount();
      if (schoolsResult.success && schoolsResult.count !== undefined) {
        setSchoolCount(schoolsResult.count);
      }
      setIsLoadingSchools(false);

      setIsLoadingAdmins(true);
      const adminsResult = await getMasterAdminsCount();
      if (adminsResult.success && adminsResult.count !== undefined) {
        setAdminCount(adminsResult.count);
      }
      setIsLoadingAdmins(false);
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Super Admin Dashboard</CardTitle>
          <CardDescription>Oversee and manage the entire SCHOLR ecosystem.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Welcome, Super Administrator. From here you can manage schools, master admins, and view platform analytics.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard 
            title="Total Registered Schools" 
            value={schoolCount} 
            icon={School} 
            isLoading={isLoadingSchools}
            link="/dashboard/super-admin/schools"
            linkText="Manage Schools"
        />
        <StatCard 
            title="Total Master Administrators" 
            value={adminCount} 
            icon={UserCog} 
            isLoading={isLoadingAdmins}
            link="/dashboard/super-admin/master-admins"
            linkText="Manage Master Admins"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <School className="h-10 w-10 text-primary mb-2" />
            <CardTitle>School Management</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Create new schools, manage existing ones, and configure fee structures.</CardDescription>
            <Button asChild className="mt-4">
              <Link href="/dashboard/super-admin/schools">Manage Schools</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <UserCog className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Master Admin Management</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Manage Master Administrator accounts for the platform.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/super-admin/master-admins">Manage Master Admins</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CalendarFold className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Academic Years</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Manage the global academic years used across the platform.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/super-admin/academic-years">Manage Years</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <Settings className="h-10 w-10 text-primary mb-2" />
            <CardTitle>System Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Configure global platform settings and parameters.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/super-admin/settings">Platform Settings</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow md:col-span-2">
            <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Platform Analytics</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>View overall platform usage statistics and reports.</CardDescription>
                <Button asChild className="mt-4" variant="outline">
                    <Link href="/dashboard/super-admin/analytics">View Analytics</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
