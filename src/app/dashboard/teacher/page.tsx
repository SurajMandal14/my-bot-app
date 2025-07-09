
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckSquare, BookOpen, MessageSquare, CalendarDays, User, Loader2, Info, ChevronRight, FileUp } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@/types/user";
import { useToast } from "@/hooks/use-toast";
import { getSubjectsForTeacher, type SubjectForTeacher } from "@/app/actions/marks";
import { getClassDetailsById } from "@/app/actions/classes";
import type { SchoolClass } from "@/types/classes";


export default function TeacherDashboardPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assignedSubjects, setAssignedSubjects] = useState<SubjectForTeacher[]>([]);
  const [primaryClass, setPrimaryClass] = useState<SchoolClass | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role === 'teacher') {
          setAuthUser(parsedUser);
        } else {
          setAuthUser(null);
        }
      } catch(e) {
        console.error("TeacherDashboard: Failed to parse user from localStorage", e);
        setAuthUser(null);
        toast({ variant: "destructive", title: "Session Error", description: "Could not load user data."});
      }
    } else {
      setAuthUser(null);
    }
    setIsLoading(false);
  }, [toast]);

  const fetchTeacherData = useCallback(async () => {
      if (!authUser || !authUser.schoolId) return;

      setIsLoading(true);
      const subjectsResult = await getSubjectsForTeacher(authUser._id, authUser.schoolId);
      setAssignedSubjects(subjectsResult);

      if (authUser.classId) {
          const classResult = await getClassDetailsById(authUser.classId, authUser.schoolId);
          if (classResult.success && classResult.classDetails) {
              setPrimaryClass(classResult.classDetails);
          } else {
              toast({variant: "warning", title: "Primary Class", description: "Could not load details for your primary assigned class."})
          }
      }
      setIsLoading(false);
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser) {
        fetchTeacherData();
    }
  }, [authUser, fetchTeacherData]);


  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Info className="mr-2 h-6 w-6 text-destructive"/>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You must be logged in as a teacher to view this page.</p>
           <Button asChild className="mt-4"><Link href="/">Go to Login</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const teacherName = authUser.name || "Teacher";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Teacher Dashboard</CardTitle>
          <CardDescription>Welcome, {teacherName}. Here is an overview of your responsibilities.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         {primaryClass && (
            <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CheckSquare className="h-10 w-10 text-primary mb-2" />
                        <span className="text-sm font-bold bg-green-100 text-green-800 px-2 py-1 rounded-full">Primary Class</span>
                    </div>
                    <CardTitle>Attendance Duty</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>You are the class teacher for <span className="font-semibold">{primaryClass.name} - {primaryClass.section}</span>. You can mark monthly attendance for these {primaryClass.studentCount || 0} students.</CardDescription>
                    <Button asChild className="mt-4">
                      <Link href="/dashboard/teacher/attendance">Mark Attendance</Link>
                    </Button>
                </CardContent>
            </Card>
         )}

         <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <BookOpen className="h-10 w-10 text-primary mb-2" />
                    <span className="text-sm font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{assignedSubjects.length} Subject(s)</span>
                </div>
                <CardTitle>My Subjects</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>You are assigned to teach the following subjects. Click to enter marks.</CardDescription>
                {isLoading ? <Loader2 className="my-4 h-6 w-6 animate-spin" /> : 
                assignedSubjects.length > 0 ? (
                    <div className="mt-4 space-y-2">
                        {assignedSubjects.map(sub => (
                            <Link href="/dashboard/teacher/marks" key={sub.value} className="flex items-center justify-between p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors">
                                <span>{sub.label}</span>
                                <ChevronRight className="h-5 w-5 text-muted-foreground"/>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="mt-4 text-center text-muted-foreground">No subjects assigned yet.</p>
                )}
            </CardContent>
         </Card>
         
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <FileUp className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Course Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Upload and manage course materials (PDFs) for your subjects.</CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/teacher/courses">Manage Materials</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/teacher/schedule"><CalendarDays className="mr-2 h-5 w-5"/> My Schedule</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/teacher/messages"><MessageSquare className="mr-2 h-5 w-5"/> Communication</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/teacher/profile"><User className="mr-2 h-5 w-5"/> My Profile</Link>
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
