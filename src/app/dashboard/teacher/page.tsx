
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckSquare, BookOpen, MessageSquare, CalendarDays, User, Loader2, Info, ChevronRight, FileUp, Users, BarChart2, NotebookText, Printer, FileText } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

interface StudentWithAttendance extends AppUser {
    overallAttendance?: number;
    attendanceRecords?: MonthlyAttendanceRecord[];
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
  const [reportType, setReportType] = useState<'info' | 'attendance' | 'marks' | null>(null);
  const [reportData, setReportData] = useState<{ attendance: MonthlyAttendanceRecord[], marks: MarkEntry[] }>({ attendance: [], marks: [] });
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

  const toID = (id: string | { toString(): string } | undefined) => (id? id.toString() : "");

  const fetchTeacherData = useCallback(async () => {
      if (!authUser || !authUser.schoolId || !authUser._id) return;
      setIsLoading(true);

      const teacherId = toID(authUser._id);
      const schoolId = toID(authUser.schoolId);
      const classId = authUser.classId ? toID(authUser.classId) : undefined;
      
      const academicYear = new Date().getFullYear().toString(); // Simplified for now
      const subjectsResult = await getSubjectsForTeacher(teacherId, schoolId, academicYear);
      setAssignedSubjects(subjectsResult);

      if (classId) {
          const classResult = await getClassDetailsById(classId, schoolId);
          if (classResult.success && classResult.classDetails) {
              setPrimaryClass(classResult.classDetails);
              
              const studentsResult = await getStudentsByClass(schoolId, classId, classResult.classDetails.academicYear);

              if (studentsResult.success && studentsResult.users) {
                  const students = studentsResult.users;
                  const studentAttendancePromises = students.map(s => getStudentMonthlyAttendance(s._id!.toString()));
                  const allAttendanceResults = await Promise.all(studentAttendancePromises);
                  
                  const studentsWithAttendance = students.map((student, index) => {
                      const attendanceRes = allAttendanceResults[index];
                      // Ensure _id is defined and stringified to satisfy StudentWithAttendance (_id: string)
                      const ensuredId = student._id ? student._id.toString() : "";
                      if (attendanceRes.success && attendanceRes.records && attendanceRes.records.length > 0) {
                          const totalWorking = attendanceRes.records.reduce((sum, r) => sum + r.totalWorkingDays, 0);
                          const totalPresent = attendanceRes.records.reduce((sum, r) => sum + r.daysPresent, 0);
                          return { 
                              ...student,
                              _id: ensuredId,
                              overallAttendance: totalWorking > 0 ? Math.round((totalPresent / totalWorking) * 100) : 0,
                              attendanceRecords: attendanceRes.records,
                          };
                      }
                      return { ...student, _id: ensuredId, overallAttendance: 0, attendanceRecords: [] };
                  });
                  setClassStudents(studentsWithAttendance as StudentWithAttendance[]);
              }
          } else {
              toast({variant: "default", title: "Primary Class", description: "Could not load details for your primary assigned class."})
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
  
  const handleOpenReport = async (student: AppUser, type: 'info' | 'attendance' | 'marks') => {
    if(!student._id || !student.schoolId || !student.academicYear) {
      toast({variant: "destructive", title: "Error", description: "Student data is incomplete."});
      return;
    }
    setStudentForReport(student);
    setReportType(type);
    
    if (type === 'info') return;

    setIsReportLoading(true);
    setReportData({ attendance: [], marks: [] });

    if(type === 'attendance') {
      const attendanceRes = await getStudentMonthlyAttendance(student._id.toString());
      setReportData(prev => ({ ...prev, attendance: attendanceRes.success ? attendanceRes.records || [] : [] }));
    }
    if(type === 'marks') {
      const marksRes = await getStudentMarksForReportCard(student._id.toString(), student.schoolId!.toString(), student.academicYear);
      setReportData(prev => ({ ...prev, marks: marksRes.success ? marksRes.marks || [] : [] }));
    }
    
    setIsReportLoading(false);
  };
  
  const handlePrintReport = (dialogType: string) => {
    const printContent = document.getElementById(`report-printable-area-${dialogType}`);
    if (printContent && studentForReport) {
      const studentName = studentForReport.name || 'Student';
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>${dialogType.charAt(0).toUpperCase() + dialogType.slice(1)} Report - ${studentName}</title>
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
              <h1>Student Report for ${studentName}</h1>
              <h2>Class: ${primaryClass?.name || ''} - ${primaryClass?.section || ''} | Adm. No: ${studentForReport?.admissionId || 'N/A'}</h2>
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
    // First, group by main assessment type (FA1, FA2, SA1, etc.)
    const groupedBySubject = reportData.marks.reduce((acc, mark) => {
      const subjectName = mark.subjectName;
      if (!acc[subjectName]) {
        acc[subjectName] = [];
      }
      acc[subjectName].push(mark);
      return acc;
    }, {} as Record<string, MarkEntry[]>);
    
    return groupedBySubject;

  }, [reportData]);

  const isBirthday = (dob: string | undefined): boolean => {
    if (!dob) return false;
    const today = new Date();
    // DOB can be in different formats, try to parse it. 'yyyy-MM-dd' is most reliable.
    const birthDate = new Date(dob);
    // Adjust for timezone differences when comparing dates
    const todayMonth = today.getUTCMonth();
    const todayDate = today.getUTCDate();
    const birthMonth = birthDate.getUTCMonth();
    const birthDateOfMonth = birthDate.getUTCDate();
    return todayMonth === birthMonth && todayDate === birthDateOfMonth;
  };


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
        <CardHeader><CardTitle className="flex items-center"><Info className="mr-2 h-6 w-6 text-destructive"/>Access Denied</CardTitle></CardHeader>
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
                            <TableHead>Overall Attendance</TableHead>
                            <TableHead className="text-right">Reports</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {classStudents.map(student => (
                            <TableRow key={student._id?.toString()}>
                                <TableCell className="font-medium flex items-center">
                                  {student.name} {isBirthday(student.dob) && <span className="ml-2">🎂</span>}
                                </TableCell>
                                <TableCell>{student.admissionId || 'N/A'}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Progress value={student.overallAttendance} className="w-24 h-2" />
                                        <span>{student.overallAttendance}%</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                  <Button variant="outline" size="sm" onClick={() => handleOpenReport(student, 'info')}>Info</Button>
                                  <Button variant="outline" size="sm" onClick={() => handleOpenReport(student, 'attendance')}>Attendance</Button>
                                  <Button variant="outline" size="sm" onClick={() => handleOpenReport(student, 'marks')}>Marks</Button>
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

      {/* Dialog for Reports */}
      <Dialog open={!!reportType} onOpenChange={(isOpen) => !isOpen && setReportType(null)}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
            <DialogTitle>
                {reportType === 'info' && `Student Information`}
                {reportType === 'attendance' && `Attendance Report`}
                {reportType === 'marks' && `Marks Report`}
            </DialogTitle>
            <DialogDescription>
                Viewing report for <span className="font-semibold">{studentForReport?.name}</span> (Adm. No: {studentForReport?.admissionId})
            </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
            <div id={`report-printable-area-${reportType}`} className="p-4 space-y-6">
                {isReportLoading ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>
                ) : (
                <>
                {reportType === 'info' && studentForReport && (
                    <div className="details-section space-y-4">
                        <h3 className="font-semibold text-lg mb-2 border-b pb-1">
                          {studentForReport.name} ({primaryClass?.name} - {primaryClass?.section}, Adm. No: {studentForReport.admissionId})
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-md">
                            <DetailItem label="Date of Birth" value={studentForReport.dob ? format(new Date(studentForReport.dob), 'PP') : null} />
                            <DetailItem label="Gender" value={studentForReport.gender} />
                            <DetailItem label="Blood Group" value={studentForReport.bloodGroup} />
                            <DetailItem label="Religion" value={studentForReport.religion} />
                            <DetailItem label="Caste" value={studentForReport.caste} />
                            <DetailItem label="Aadhar No." value={studentForReport.aadharNo} />
                            <DetailItem label="Date of Joining" value={studentForReport.dateOfJoining ? format(new Date(studentForReport.dateOfJoining), 'PP') : null} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md">
                            <DetailItem label="Father's Name" value={studentForReport.fatherName} />
                            <DetailItem label="Mother's Name" value={studentForReport.motherName} />
                            <DetailItem label="Father's Mobile" value={studentForReport.fatherMobile} />
                            <DetailItem label="Mother's Mobile" value={studentForReport.motherMobile} />
                        </div>
                         <div className="p-4 border rounded-md space-y-2">
                           <h4 className="font-medium">Present Address</h4>
                           <p className="text-sm">{Object.values(studentForReport.presentAddress || {}).filter(Boolean).join(', ')}</p>
                        </div>
                    </div>
                )}
                {reportType === 'attendance' && (
                    <div>
                        {reportData?.attendance.length ? (
                        <Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Attendance</TableHead></TableRow></TableHeader>
                            <TableBody>{reportData.attendance.map(att => <TableRow key={att._id.toString()}><TableCell>{format(new Date(att.year, att.month), 'MMMM yyyy')}</TableCell><TableCell className="text-right">{att.daysPresent} / {att.totalWorkingDays}</TableCell></TableRow>)}</TableBody>
                        </Table>
                        ) : <p className="text-sm text-muted-foreground">No attendance data found.</p>}
                    </div>
                )}
                {reportType === 'marks' && (
                  <div className="space-y-4">
                    {Object.keys(groupedMarks).length > 0 ? (
                      Object.entries(groupedMarks).map(([subject, marks]) => (
                        <div key={subject}>
                          <h3 className="font-semibold text-lg mb-2 border-b pb-1">{subject}</h3>
                          <Table>
                            <TableHeader><TableRow><TableHead>Assessment Detail</TableHead><TableHead className="text-right">Marks</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {marks.map(mark => (
                                <TableRow key={mark._id?.toString()}>
                                  <TableCell>{(mark.assessmentName ?? '').split('-').slice(0).join('-') || '—'}</TableCell>
                                  <TableCell className="text-right">{mark.marksObtained} / {mark.maxMarks}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))
                    ) : <p className="text-sm text-muted-foreground">No marks found for this student.</p>}
                  </div>
                )}
                </>
                )}
            </div>
            </ScrollArea>
            <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => handlePrintReport(reportType!)}>
                <Printer className="mr-2 h-4 w-4"/>Print
            </Button>
            <Button variant="secondary" onClick={() => setReportType(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>


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
