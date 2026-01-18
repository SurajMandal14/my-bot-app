
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserSearch, Loader2, Info, User, School, Search, Printer, AlertTriangle, BookUser, Contact, Home, Users } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { User as AppUser, AuthUser } from "@/types/user";
import type { MonthlyAttendanceRecord } from "@/types/attendance";
import type { MarkEntry } from "@/types/marks";
import type { AcademicYear } from "@/types/academicYear";
import type { SchoolClass } from "@/types/classes";
import { getStudentDetailsForReportCard } from "@/app/actions/schoolUsers";
import { getStudentMonthlyAttendance } from "@/app/actions/attendance";
import { getStudentMarksForReportCard } from "@/app/actions/marks";
import { getAcademicYears } from "@/app/actions/academicYears";
import { getClassDetailsById } from "@/app/actions/classes";
import { format } from "date-fns";

const ProfileDetailItem = ({ label, value }: { label: string; value: string | undefined | null }) => (
  value ? (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-base">{value}</p>
    </div>
  ) : null
);

export default function StudentReportPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  
  const [admissionIdInput, setAdmissionIdInput] = useState("");
  const [academicYearInput, setAcademicYearInput] = useState("");
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [student, setStudent] = useState<AppUser | null>(null);
  const [studentClass, setStudentClass] = useState<SchoolClass | null>(null);
  const [attendance, setAttendance] = useState<MonthlyAttendanceRecord[]>([]);
  const [marks, setMarks] = useState<MarkEntry[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined") {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.role === 'admin' || parsedUser.role === 'masteradmin') {
            setAuthUser(parsedUser);
        }
      } catch (e) { console.error(e); }
    }
    
    getAcademicYears().then(res => {
      if (res.success && res.academicYears) {
        setAcademicYears(res.academicYears);
        const defaultYear = res.academicYears.find(y => y.isDefault);
        if (defaultYear) {
          setAcademicYearInput(defaultYear.year);
        }
      }
    });
  }, []);
  
  const handleSearch = async () => {
    if (!admissionIdInput || !academicYearInput || !authUser?.schoolId) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please provide Admission ID and select an Academic Year." });
      return;
    }
    setIsLoading(true);
    setStudent(null);
    setStudentClass(null);
    setAttendance([]);
    setMarks([]);

    try {
      const studentRes = await getStudentDetailsForReportCard(admissionIdInput, authUser.schoolId.toString(), academicYearInput);
      if (!studentRes.success || !studentRes.student) {
        toast({ variant: "destructive", title: "Student Not Found", description: studentRes.message || "Could not find student." });
        return;
      }
      setStudent(studentRes.student as AppUser);
      
      const studentId = studentRes.student._id.toString();
      const [classRes, attendanceRes, marksRes] = await Promise.all([
        studentRes.student.classId ? getClassDetailsById(studentRes.student.classId, authUser.schoolId.toString()) : Promise.resolve({ success: false }),
        getStudentMonthlyAttendance(studentId),
        getStudentMarksForReportCard(studentId, authUser.schoolId.toString(), academicYearInput),
      ]);
      
      if (classRes && 'classDetails' in classRes && classRes.success && classRes.classDetails) setStudentClass(classRes.classDetails as SchoolClass);
      if(attendanceRes.success && attendanceRes.records) setAttendance(attendanceRes.records);
      if(marksRes.success && marksRes.marks) setMarks(marksRes.marks);

    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred during search." });
    } finally {
      setIsLoading(false);
    }
  };
  
  const groupedMarks = useMemo(() => {
    // Normalize assessment names by trimming, collapsing whitespace, and lowercasing
    const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    
    // Filter and sort marks to prefer most recent entries
    const sortedMarks = [...marks].sort((a: any, b: any) => {
      const aTime = new Date((a.updatedAt || a.createdAt || 0) as any).getTime();
      const bTime = new Date((b.updatedAt || b.createdAt || 0) as any).getTime();
      return bTime - aTime;
    });

    // Group by subject and deduplicate by assessment (keep most recent)
    const grouped = sortedMarks.reduce((acc, mark) => {
      const subject = mark.subjectName;
      if (!acc[subject]) acc[subject] = [];
      
      // Check if this assessment already exists
      const assessmentNorm = normalize(mark.assessmentName || '');
      const existingIndex = acc[subject].findIndex(m => normalize(m.assessmentName || '') === assessmentNorm);
      
      if (existingIndex === -1) {
        // New assessment, add it
        acc[subject].push(mark);
      } else if (new Date((mark.updatedAt || mark.createdAt || 0) as any).getTime() > 
                 new Date((acc[subject][existingIndex].updatedAt || acc[subject][existingIndex].createdAt || 0) as any).getTime()) {
        // Newer entry, replace the old one
        acc[subject][existingIndex] = mark;
      }
      
      return acc;
    }, {} as Record<string, MarkEntry[]>);

    // Sort assessments within each subject by normalized name for consistency
    Object.keys(grouped).forEach(subject => {
      grouped[subject].sort((a, b) => normalize(a.assessmentName || '').localeCompare(normalize(b.assessmentName || '')));
    });

    return grouped;
  }, [marks]);
  
  const handlePrint = () => {
    const printContent = document.getElementById('student-report-printable');
    if (printContent && student) {
      const studentName = student.name || 'Student';
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`<html><head><title>Report for ${studentName}</title><style>
          body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9rem; }
          th { background-color: #f2f2f2; } h1, h2, h3 { margin-bottom: 0.5rem; }
          .grid-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
          .no-print { display: none; }
        </style></head><body><h1>Student Report: ${studentName}</h1>${printContent.innerHTML}</body></html>`);
        newWindow.document.close();
        setTimeout(() => { newWindow.print(); }, 500);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <UserSearch className="mr-2 h-6 w-6" /> Student Master Report
          </CardTitle>
          <CardDescription>
            Search for a student by their Admission ID and Academic Year to view a complete report.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-end gap-2">
            <div className="w-full sm:w-auto flex-grow"><Label htmlFor="admissionId">Admission ID</Label><Input id="admissionId" value={admissionIdInput} onChange={e => setAdmissionIdInput(e.target.value)} /></div>
            <div className="w-full sm:w-auto"><Label htmlFor="academicYear">Academic Year</Label><Select value={academicYearInput} onValueChange={setAcademicYearInput}><SelectTrigger id="academicYear"><SelectValue placeholder="Select Year" /></SelectTrigger><SelectContent>{academicYears.map(y => <SelectItem key={y._id} value={y.year}>{y.year}</SelectItem>)}</SelectContent></Select></div>
            <Button onClick={handleSearch} disabled={isLoading} className="w-full sm:w-auto">{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>} Search</Button>
        </CardContent>
      </Card>
      
      {isLoading && <div className="text-center p-8"><Loader2 className="h-10 w-10 animate-spin text-primary"/></div>}

      {!isLoading && !student && (
        <Card className="text-center py-10">
          <Info className="mx-auto h-12 w-12 text-muted-foreground" />
          <CardHeader><CardTitle>No Student Loaded</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Please search for a student to view their report.</p></CardContent>
        </Card>
      )}

      {!isLoading && student && (
        <>
          <div className="flex justify-end no-print">
            <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
          </div>
          <div id="student-report-printable" className="space-y-6" key={student?._id?.toString() || 'no-student'}>
          <Card>
            <CardHeader><CardTitle className="flex items-center"><User className="mr-2 h-5 w-5"/> Student Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <ProfileDetailItem label="Full Name" value={student.name} />
                <ProfileDetailItem label="Admission No." value={student.admissionId} />
                <ProfileDetailItem label="Class" value={`${studentClass?.name || 'N/A'} - ${student.section || 'N/A'}`} />
                <ProfileDetailItem label="Roll No." value={student.rollNo} />
                <ProfileDetailItem label="Date of Birth" value={student.dob ? format(new Date(student.dob), 'PPP') : 'N/A'} />
                <ProfileDetailItem label="Gender" value={student.gender} />
                <ProfileDetailItem label="Aadhar Number" value={student.aadharNo} />
                <ProfileDetailItem label="Date of Joining" value={student.dateOfJoining ? format(new Date(student.dateOfJoining), 'PPP') : null} />
                <ProfileDetailItem label="Father's Name" value={student.fatherName} />
                <ProfileDetailItem label="Mother's Name" value={student.motherName} />
                <ProfileDetailItem label="Father's Mobile" value={student.fatherMobile} />
                <ProfileDetailItem label="Mother's Mobile" value={student.motherMobile} />
              </div>
            </CardContent>
          </Card>
          
          <Card><CardHeader><CardTitle>Attendance Report</CardTitle></CardHeader><CardContent>
            {attendance.length > 0 ? (
            <Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Attendance</TableHead></TableRow></TableHeader>
            <TableBody>{attendance.map(att => <TableRow key={att._id.toString()}><TableCell>{format(new Date(att.year, att.month), 'MMMM yyyy')}</TableCell><TableCell className="text-right">{att.daysPresent} / {att.totalWorkingDays}</TableCell></TableRow>)}</TableBody>
            </Table>
            ) : <p className="text-muted-foreground">No attendance data found.</p>}
          </CardContent></Card>
          
          <Card><CardHeader><CardTitle>Marks Report</CardTitle></CardHeader><CardContent className="space-y-4">
              {Object.keys(groupedMarks).length > 0 ? (
                Object.entries(groupedMarks).map(([subject, marks]) => (
                  <div key={subject}>
                    <h3 className="font-semibold mb-2">{subject}</h3>
                    <Table><TableHeader><TableRow><TableHead>Assessment</TableHead><TableHead className="text-right">Marks</TableHead></TableRow></TableHeader>
                      <TableBody>{marks.map(mark => <TableRow key={mark._id?.toString()}><TableCell>{mark.assessmentName ? mark.assessmentName.split('-').slice(0).join('-') : 'N/A'}</TableCell><TableCell className="text-right">{mark.marksObtained} / {mark.maxMarks}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </div>
                ))
              ) : <p className="text-muted-foreground">No marks data found.</p>}
          </CardContent></Card>
          </div>
        </>
      )}
    </div>
  );
}

    