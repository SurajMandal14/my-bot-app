
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, Settings, BarChart3, Loader2, TicketPercent, GraduationCap, School, BookCopy, CalendarClock, Lock, UserCog, CheckSquare, FileQuestion, UserSearch } from "lucide-react";
import { useState, useEffect } from "react";
import type { AuthUser } from "@/types/user";

export default function MasterAdminDashboardPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role === 'masteradmin') {
          setAuthUser(parsedUser);
        }
      } catch (e) { console.error("MasterAdminDashboard: Failed to parse user", e); }
    }
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Master Admin Dashboard</CardTitle>
          <CardDescription>Oversee schools, admins, and platform-wide settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Welcome, Master Administrator. From here you can manage school admins, student promotions, concessions, and key operational settings.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <UserSearch className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Student Report</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Search for a student to view their complete academic report.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/reports/student">View Student Report</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <Users className="h-10 w-10 text-primary mb-2" />
            <CardTitle>School Admin Management</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Create and manage administrator accounts for each school.</CardDescription>
            <Button asChild className="mt-4">
              <Link href="/dashboard/master-admin/admins">Manage School Admins</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <TicketPercent className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Fee Concessions</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Apply and manage fee concessions for students across schools.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/master-admin/concessions">Manage Concessions</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <GraduationCap className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Promote Students</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Promote students from one class to the next for the new academic year.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/master-admin/promote">Student Promotion</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <BookCopy className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Manage Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Manage the master list of subjects available for all schools.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/master-admin/subjects">Manage Subjects</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <School className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Course Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Upload PDF links for subjects to be displayed in student dashboards.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/master-admin/courses">Manage Courses</Link>
            </Button>
          </CardContent>
        </Card>
        
         <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <FileQuestion className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Question Papers</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>Upload and manage previous years' question papers for students.</CardDescription>
                <Button asChild className="mt-4" variant="outline">
                    <Link href="/dashboard/master-admin/question-papers">Manage Papers</Link>
                </Button>
            </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CheckSquare className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Attendance Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>View and monitor student attendance for your assigned school.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/master-admin/attendance">View Attendance</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <Settings className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Operational Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>Manage tuition fees, academic year, marks entry locks, and other school settings.</CardDescription>
                <Button asChild className="mt-4" variant="outline">
                    <Link href="/dashboard/master-admin/settings">Go to Settings</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
