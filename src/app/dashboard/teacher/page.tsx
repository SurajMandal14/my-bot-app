
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckSquare, BookOpen, MessageSquare, CalendarDays, User, Loader2, Info, ChevronRight, FileUp, Users, BarChart2, NotebookText, Contact, BookUser, Home, Users as UsersIcon, Calendar, Heart, ShieldHalf, School, Printer } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { AuthUser, User as AppUser } from "@/types/user";
import { useToast } from "@/hooks/use-toast";
import { getSubjectsForTeacher, type SubjectForTeacher } from "@/app/actions/marks";
import { getClassDetailsById } from "@/app/actions/classes";
import type { SchoolClass } from "@/types/classes";
import { getStudentsByClass } from "@/app/actions/schoolUsers";
import { getStudentMonthlyAttendance } from "@/app/actions/attendance";
import { getStudentMarksForReportCard } from "@/app/actions/marks";
import type { MarkEntry } from "@/types/marks";
import type { MonthlyAttendanceRecord } from "@/types/attendance";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";


interface StudentWithAttendance extends AppUser {
    overallAttendance?: number;
}

const DetailItem = ({ label, value }: { label: string; value?: string | null; }) => {
    if (!value) return null;
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
        </div>
    );
};


export default function TeacherDashboardPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assignedSubjects, setAssignedSubjects] = useState<SubjectForTeacher[]>([]);
  const [primaryClass, setPrimaryClass] = useState<SchoolClass | null>(null);
  const [classStudents, setClassStudents] = useState<StudentWithAttendance[]>([]);
  const { toast } = useToast();
  
  const [studentForReport, setStudentForReport] = useState<AppUser | null>(null);
  const [reportData, setReportData] = useState<{ attendance: MonthlyAttendanceRecord[], marks: MarkEntry[] } | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);


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
  }, [toast]);

  const fetchTeacherData = useCallback(async () => {
      if (!authUser || !authUser.schoolId || !authUser._id) return;

      setIsLoading(true);
      
      const academicYear = new Date().getFullYear().toString(); // Simplified for now
      const subjectsResult = await getSubjectsForTeacher(authUser._id, authUser.schoolId, academicYear);
      setAssignedSubjects(subjectsResult);

      if (authUser.classId) {
          const classResult = await getClassDetailsById(authUser.classId, authUser.schoolId);
          if (classResult.success && classResult.classDetails) {
              setPrimaryClass(classResult.classDetails);
              
              const studentsResult = await getStudentsByClass(authUser.schoolId, authUser.classId, classResult.classDetails.academicYear);

              if (studentsResult.success && studentsResult.users) {
                  const students = studentsResult.users;
                  setClassStudents(students);
              }
          } else {
              toast({variant: "warning", title: "Primary Class", description: "Could not load details for your primary assigned class."})
          }
      }
      setIsLoading(false);
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser) {
        fetchTeacherData();
    } else {
        setIsLoading(false);
    }
  }, [authUser, fetchTeacherData]);
  
  const handleViewReportClick = async (student: AppUser) => {
    if(!student._id || !student.schoolId || !student.academicYear) {
      toast({variant: "destructive", title: "Error", description: "Student data is incomplete."});
      return;
    }
    setStudentForReport(student);
    setIsReportLoading(true);
    
    const [attendanceRes, marksRes] = await Promise.all([
      getStudentMonthlyAttendance(student._id.toString()),
      getStudentMarksForReportCard(student._id.toString(), student.schoolId.toString(), student.academicYear)
    ]);
    
    setReportData({
      attendance: attendanceRes.success ? attendanceRes.records || [] : [],
      marks: marksRes.success ? marksRes.marks || [] : []
    });
    
    setIsReportLoading(false);
  };
  
  const handlePrintReport = () => {
    const printContent = document.getElementById('student-report-printable-area');
    if (printContent && studentForReport) {
      const studentName = studentForReport.name || 'Student';
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Student Summary - ${studentName}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.5; }
                table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.8rem; }
                th { background-color: #f2f2f2; }
                h1, h2, h3 { color: #333; margin-top: 1.5rem; margin-bottom: 0.5rem; }
                h1 { font-size: 1.5rem; text-align: center; }
                h2 { font-size: 1.2rem; }
                h3 { font-size: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
                .grid-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
                .details-section h3 { margin-bottom: 0.5rem; }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
          </html>
        `);
        newWindow.document.close();
        newWindow.focus();
        setTimeout(() => { newWindow.print(); }, 500);
      }
    }
  };
  
  const groupedMarks = useMemo(() => {
    if (!reportData?.marks) return {};
    return reportData.marks.reduce((acc, mark) => {
      // Group by the main assessment type (e.g., "FA1", "SA1")
      const assessmentType = mark.assessmentName.split('-')[0];
      if (!acc[assessmentType]) {
        acc[assessmentType] = [];
      }
      acc[assessmentType].push(mark);
      return acc;
    }, {} as Record<string, MarkEntry[]>);
  }, [reportData]);


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
      
      {primaryClass && (
        <Card>
          <CardHeader>
             <CardTitle className="text-lg">Class Teacher for {primaryClass.name} - {primaryClass.section}</CardTitle>
             <CardDescription>You are the primary contact and attendance marker for these {classStudents.length} students.</CardDescription>
          </CardHeader>
          <CardContent>
             {classStudents.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Admission ID</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {classStudents.map(student => (
                            <TableRow key={student._id}>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                <TableCell>{student.admissionId || 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={() => handleViewReportClick(student)}>
                                          <NotebookText className="mr-2 h-4 w-4"/> View Report
                                        </Button>
                                      </DialogTrigger>
                                      {studentForReport?._id === student._id && (
                                        <DialogContent className="max-w-4xl">
                                          <DialogHeader>
                                            <DialogTitle>Student Summary: {studentForReport.name}</DialogTitle>
                                            <DialogDescription>
                                              Class: {primaryClass.name} - {primaryClass.section} | Adm. No: {studentForReport.admissionId}
                                            </DialogDescription>
                                          </DialogHeader>
                                          <ScrollArea className="max-h-[70vh]">
                                            <div id="student-report-printable-area" className="p-4 space-y-6">
                                            {isReportLoading ? (
                                              <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>
                                            ) : (
                                              <>
                                                <div className="details-section">
                                                    <h3 className="font-semibold text-base mb-2 border-b pb-2">Student Information</h3>
                                                    <div className="grid-container">
                                                        <DetailItem label="Student Name" value={studentForReport.name} />
                                                        <DetailItem label="Admission No." value={studentForReport.admissionId} />
                                                        <DetailItem label="Class" value={`${primaryClass?.name} - ${primaryClass?.section}`} />
                                                        <DetailItem label="Date of Birth" value={studentForReport.dob ? format(new Date(studentForReport.dob), 'PP') : null} />
                                                        <DetailItem label="Gender" value={studentForReport.gender} />
                                                        <DetailItem label="Blood Group" value={studentForReport.bloodGroup} />
                                                        <DetailItem label="Religion" value={studentForReport.religion} />
                                                        <DetailItem label="Caste" value={studentForReport.caste} />
                                                        <DetailItem label="Aadhar No." value={studentForReport.aadharNo} />
                                                        <DetailItem label="Date of Joining" value={studentForReport.dateOfJoining ? format(new Date(studentForReport.dateOfJoining), 'PP') : null} />
                                                    </div>
                                                </div>

                                                <div className="details-section">
                                                    <h3 className="font-semibold text-base mb-2 border-b pb-2">Parent Information</h3>
                                                    <div className="grid-container">
                                                        <DetailItem label="Father's Name" value={studentForReport.fatherName} />
                                                        <DetailItem label="Mother's Name" value={studentForReport.motherName} />
                                                        <DetailItem label="Father's Mobile" value={studentForReport.fatherMobile} />
                                                        <DetailItem label="Mother's Mobile" value={studentForReport.motherMobile} />
                                                    </div>
                                                </div>
                                                <div className="details-section">
                                                     <h3 className="font-semibold text-base mb-2 border-b pb-2">Address</h3>
                                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-medium text-muted-foreground">Present Address</p>
                                                            <p className="text-sm">{Object.values(studentForReport.presentAddress || {}).filter(Boolean).join(', ')}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-medium text-muted-foreground">Permanent Address</p>
                                                            <p className="text-sm">{Object.values(studentForReport.permanentAddress || {}).filter(Boolean).join(', ')}</p>
                                                        </div>
                                                     </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                      <h3 className="font-semibold mb-2 border-b pb-2">Monthly Attendance</h3>
                                                      {reportData?.attendance.length ? (
                                                        <Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Attendance</TableHead></TableRow></TableHeader>
                                                          <TableBody>{reportData.attendance.map(att => <TableRow key={att._id.toString()}><TableCell>{format(new Date(att.year, att.month), 'MMMM yyyy')}</TableCell><TableCell className="text-right">{att.daysPresent} / {att.totalWorkingDays}</TableCell></TableRow>)}</TableBody>
                                                        </Table>
                                                      ) : <p className="text-sm text-muted-foreground">No attendance data found.</p>}
                                                    </div>
                                                    <div>
                                                      <h3 className="font-semibold mb-2 border-b pb-2">Assessment Marks</h3>
                                                      {Object.keys(groupedMarks).length > 0 ? (
                                                          Object.entries(groupedMarks).map(([assessmentName, marks]) => (
                                                            <div key={assessmentName} className="mb-3">
                                                              <h4 className="font-medium text-sm text-primary">{assessmentName}</h4>
                                                              <Table><TableHeader><TableRow><TableHead>Subject</TableHead><TableHead className="text-right">Marks</TableHead></TableRow></TableHeader>
                                                                <TableBody>{marks.map(mark => <TableRow key={mark._id?.toString()}><TableCell>{mark.subjectName}</TableCell><TableCell className="text-right">{mark.marksObtained} / {mark.maxMarks}</TableCell></TableRow>)}</TableBody>
                                                              </Table>
                                                            </div>
                                                          ))
                                                      ) : <p className="text-sm text-muted-foreground">No marks found for this student.</p>}
                                                    </div>
                                                </div>
                                              </>
                                            )}
                                            </div>
                                          </ScrollArea>
                                          <DialogFooter className="print:hidden">
                                            <Button variant="outline" onClick={handlePrintReport}>
                                              <Printer className="mr-2 h-4 w-4"/>Print
                                            </Button>
                                            <Button variant="outline" onClick={() => setStudentForReport(null)}>Close</Button>
                                          </DialogFooter>
                                        </DialogContent>
                                      )}
                                    </Dialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             ) : (
                <p className="text-muted-foreground">No students currently enrolled in this class.</p>
             )}
          </CardContent>
        </Card>
      )}


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CheckSquare className="h-10 w-10 text-primary mb-2" />
                    {primaryClass && <span className="text-sm font-bold bg-green-100 text-green-800 px-2 py-1 rounded-full">Primary Class Duty</span>}
                </div>
                <CardTitle>Attendance</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>You can mark monthly attendance for your primary assigned class, if any.</CardDescription>
                <Button asChild className="mt-4" disabled={!primaryClass}>
                  <Link href="/dashboard/teacher/attendance">Mark Attendance</Link>
                </Button>
            </CardContent>
        </Card>


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
