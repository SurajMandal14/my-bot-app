
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, DollarSign, CheckSquare, BarChart2, Settings, Briefcase, BookOpen, Percent, Loader2, BookCopy, BookUser, FileQuestion } from "lucide-react";
import { useState, useEffect } from "react";
import type { AuthUser } from "@/types/user";
import type { School } from "@/types/school";
import { getSchoolUserRoleCounts, type SchoolUserRoleCounts } from "@/app/actions/schoolUsers";
import { getMonthlyAttendanceForAdmin } from "@/app/actions/attendance";
import { getSchoolById } from "@/app/actions/schools";
import { useToast } from "@/hooks/use-toast";

interface MonthlyAttendanceOverview {
  totalPresentDays: number;
  totalWorkingDays: number;
  percentage: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  isLoading: boolean;
  description?: string;
  link?: string;
  linkText?: string;
}

function StatCard({ title, value, icon: Icon, isLoading, description, link, linkText }: StatCardProps) {
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
        {description && !isLoading && <p className="text-xs text-muted-foreground">{description}</p>}
        {link && linkText && !isLoading && (
          <Link href={link} className="text-xs text-primary hover:underline mt-1 block">
            {linkText}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [userCounts, setUserCounts] = useState<SchoolUserRoleCounts | null>(null);
  const [attendanceOverview, setAttendanceOverview] = useState<MonthlyAttendanceOverview | null>(null);

  const [isLoadingSchoolName, setIsLoadingSchoolName] = useState(true);
  const [isLoadingUserCounts, setIsLoadingUserCounts] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role === 'admin' && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        } else {
          setAuthUser(null);
           toast({ variant: "destructive", title: "Access Denied", description: "Not authorized for admin dashboard."});
        }
      } catch(e) {
        setAuthUser(null);
         toast({ variant: "destructive", title: "Session Error", description: "Failed to load user data."});
      }
    } else {
        setAuthUser(null);
    }
  }, [toast]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!authUser || !authUser.schoolId) {
        setIsLoadingSchoolName(false);
        setIsLoadingUserCounts(false);
        setIsLoadingAttendance(false);
        return;
      }

      setIsLoadingSchoolName(true);
      setIsLoadingUserCounts(true);
      setIsLoadingAttendance(true);

      getSchoolById(authUser.schoolId.toString()).then(result => {
        if (result.success && result.school) {
          setSchoolDetails(result.school);
        } else {
          toast({ variant: "warning", title: "School Info", description: "Could not load school name."});
        }
        setIsLoadingSchoolName(false);
      });

      getSchoolUserRoleCounts(authUser.schoolId.toString()).then(result => {
        if (result.success && result.counts) {
          setUserCounts(result.counts);
        } else {
          toast({ variant: "warning", title: "User Stats", description: result.message || "Could not load user counts."});
        }
        setIsLoadingUserCounts(false);
      });
      
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      getMonthlyAttendanceForAdmin(authUser.schoolId.toString(), currentMonth, currentYear).then(result => {
        if (result.success && result.records) {
            const records = result.records;
            if (records.length > 0) {
                const totalPresentDays = records.reduce((sum, r) => sum + r.daysPresent, 0);
                const totalWorkingDays = records.reduce((sum, r) => sum + r.totalWorkingDays, 0);
                const percentage = totalWorkingDays > 0 ? Math.round((totalPresentDays / totalWorkingDays) * 100) : 0;
                setAttendanceOverview({
                    totalPresentDays,
                    totalWorkingDays,
                    percentage,
                });
            } else {
                setAttendanceOverview({ totalPresentDays: 0, totalWorkingDays: 0, percentage: 0 });
            }
        } else {
            toast({ variant: "warning", title: "Attendance Stats", description: result.message || "Could not load this month's attendance overview."});
            setAttendanceOverview(null);
        }
        setIsLoadingAttendance(false);
      });
    }

    if (authUser && authUser.schoolId) {
      fetchDashboardData();
    } else {
      setIsLoadingSchoolName(false);
      setIsLoadingUserCounts(false);
      setIsLoadingAttendance(false);
    }
  }, [authUser, toast]);

  const schoolNameDisplay = schoolDetails?.schoolName || (isLoadingSchoolName ? "Loading..." : "Your School");
  const adminName = authUser?.name || "Administrator";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Admin Dashboard - {schoolNameDisplay}</CardTitle>
          <CardDescription>Welcome, {adminName}. Manage student information, fees, attendance, and staff for {schoolNameDisplay}.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
            title="Total Students"
            value={userCounts?.students ?? 'N/A'}
            icon={BookOpen}
            isLoading={isLoadingUserCounts}
            link="/dashboard/admin/students"
            linkText="Manage Students"
        />
        <StatCard
            title="Total Teachers"
            value={userCounts?.teachers ?? 'N/A'}
            icon={Briefcase}
            isLoading={isLoadingUserCounts}
            link="/dashboard/admin/teachers"
            linkText="Manage Teachers"
        />
        <StatCard
            title="This Month's Attendance"
            value={`${attendanceOverview?.percentage ?? 'N/A'}%`}
            icon={Percent}
            isLoading={isLoadingAttendance}
            description={attendanceOverview ? `${attendanceOverview.totalPresentDays} / ${attendanceOverview.totalWorkingDays} cumulative days` : "No data this month"}
            link="/dashboard/admin/attendance"
            linkText="View Details"
        />
      </div>


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <BookUser className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Student Management</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Add, edit, and manage student accounts and details.</CardDescription>
            <Button asChild className="mt-4">
              <Link href="/dashboard/admin/students">Manage Students</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <Briefcase className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Teacher Management</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Add, edit, and manage teacher accounts and assignments.</CardDescription>
            <Button asChild className="mt-4">
              <Link href="/dashboard/admin/teachers">Manage Teachers</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <BookCopy className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Class Management</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Define classes, assign class teachers, and manage subjects.</CardDescription>
            <Button asChild className="mt-4">
              <Link href="/dashboard/admin/classes">Manage Classes</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <DollarSign className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Fee Management</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Track student fee payments, generate receipts, and manage fee structures.</CardDescription>
            <Button asChild className="mt-4">
              <Link href="/dashboard/admin/fees">Manage Fees</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CheckSquare className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>View and monitor student attendance records submitted by teachers.</CardDescription>
            <Button asChild className="mt-4">
              <Link href="/dashboard/admin/attendance">View Attendance</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <BarChart2 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>School Reports</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>Generate reports on student performance, fees, and attendance.</CardDescription>
                <Button asChild className="mt-4" variant="outline">
                    <Link href="/dashboard/admin/reports">View Reports</Link>
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
                    <Link href="/dashboard/admin/question-papers">Manage Papers</Link>
                </Button>
            </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <Settings className="h-10 w-10 text-primary mb-2" />
                <CardTitle>School Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>Configure academic years, terms, and other school-specific settings.</CardDescription>
                <Button asChild className="mt-4" variant="outline">
                    <Link href="/dashboard/admin/settings">School Settings</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
