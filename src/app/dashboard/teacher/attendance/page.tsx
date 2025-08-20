
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare, Save, Loader2, Info, ChevronLeft, ChevronRight, User } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, getDaysInMonth } from "date-fns";
import { submitMonthlyAttendance, getMonthlyAttendanceForClass } from "@/app/actions/attendance";
import { getStudentsByClass } from "@/app/actions/schoolUsers";
import { getClassDetailsById } from "@/app/actions/classes"; 
import type { MonthlyAttendanceEntry } from "@/types/attendance";
import type { AuthUser, User as AppUser } from "@/types/user";
import type { SchoolClass } from "@/types/classes";

const months = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: format(new Date(0, i), 'MMMM'),
}));
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);


export default function TeacherAttendancePage() {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [totalWorkingDays, setTotalWorkingDays] = useState<number | string>("");

  const [studentEntries, setStudentEntries] = useState<MonthlyAttendanceEntry[]>([]);

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [assignedClassDetails, setAssignedClassDetails] = useState<SchoolClass | null>(null);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
        try {
            setAuthUser(JSON.parse(storedUser));
        } catch(e) { setAuthUser(null); }
    }
  }, []); 

  const getAcademicYearForMonth = (month: number, year: number): string => {
    // Academic year starts in June (month index 5)
    if (month >= 5) { 
        return `${year}-${year + 1}`;
    } else { // Jan-May
        return `${year - 1}-${year}`;
    }
  };


  const fetchClassAndStudents = useCallback(async () => {
    if (!authUser || !authUser.schoolId || !authUser.classId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const classResult = await getClassDetailsById(authUser.classId, authUser.schoolId.toString());
    if (classResult.success && classResult.classDetails) {
      setAssignedClassDetails(classResult.classDetails);
      const academicYearForRoster = getAcademicYearForMonth(selectedMonth, selectedYear);
      const studentsResult = await getStudentsByClass(authUser.schoolId.toString(), classResult.classDetails._id, academicYearForRoster);
      if (studentsResult.success && studentsResult.users) {
        const studentList = studentsResult.users.map(student => ({
          studentId: student._id!.toString(),
          studentName: student.name || 'Unknown Student',
          daysPresent: null,
        }));
        setStudentEntries(studentList);
      } else {
        toast({ variant: "destructive", title: "Error Loading Students", description: studentsResult.message });
        setStudentEntries([]);
      }
    } else {
      toast({ variant: "destructive", title: "Class Not Found", description: `Your assigned class could not be found.` });
      setStudentEntries([]);
    }
    setIsLoading(false);
  }, [authUser, toast, selectedMonth, selectedYear]);

  useEffect(() => {
    if(authUser?.classId) {
        fetchClassAndStudents();
    } else {
        setIsLoading(false);
    }
  }, [authUser, fetchClassAndStudents]);


  const fetchExistingData = useCallback(async () => {
    if (!assignedClassDetails) return;
    
    const existingRecordsResult = await getMonthlyAttendanceForClass(assignedClassDetails.schoolId, assignedClassDetails._id, selectedMonth, selectedYear);
    if(existingRecordsResult.success && existingRecordsResult.records) {
      const records = existingRecordsResult.records;
      if (records.length > 0) {
        setTotalWorkingDays(records[0].totalWorkingDays);
        setStudentEntries(prevEntries => 
            prevEntries.map(entry => {
                const foundRecord = records.find(r => r.studentId === entry.studentId);
                return foundRecord ? {...entry, daysPresent: foundRecord.daysPresent } : entry;
            })
        );
      } else {
         // Reset on month change if no data exists
         setTotalWorkingDays(getDaysInMonth(new Date(selectedYear, selectedMonth)));
         setStudentEntries(prev => prev.map(e => ({...e, daysPresent: null})));
      }
    }
  }, [assignedClassDetails, selectedMonth, selectedYear]);


  useEffect(() => {
     fetchExistingData();
  }, [fetchExistingData]);


  const handleAttendanceChange = (studentId: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10);
    const validatedValue = isNaN(numValue as number) ? null : numValue;
    setStudentEntries(prev => prev.map(s => (s.studentId === studentId ? { ...s, daysPresent: validatedValue } : s)));
  };

  const handleSubmitAttendance = async () => {
    if (!authUser || !authUser._id || !assignedClassDetails) return;

    if (totalWorkingDays === "" || +totalWorkingDays <= 0 || +totalWorkingDays > 31) {
        toast({ variant: "destructive", title: "Invalid Input", description: "Please enter a valid number of total working days (1-31)."});
        return;
    }

    setIsSubmitting(true);
    const result = await submitMonthlyAttendance({
        classId: assignedClassDetails._id,
        schoolId: authUser.schoolId!.toString(),
        month: selectedMonth,
        year: selectedYear,
        totalWorkingDays: +totalWorkingDays,
        entries: studentEntries,
        markedByTeacherId: authUser._id.toString(),
    });

    setIsSubmitting(false);

    if (result.success) {
      toast({ title: "Attendance Submitted", description: result.message });
    } else {
      toast({ variant: "destructive", title: "Submission Failed", description: result.error || result.message });
    }
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    let newMonth = selectedMonth;
    let newYear = selectedYear;
    if (direction === 'prev') {
        if (newMonth === 0) {
            newMonth = 11;
            newYear -= 1;
        } else {
            newMonth -= 1;
        }
    } else {
        if (newMonth === 11) {
            newMonth = 0;
            newYear += 1;
        } else {
            newMonth += 1;
        }
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  }

  
  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading your class details...</p></div>;
  }
  
  if (!authUser) {
     return <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent><p>Please log in as a teacher.</p></CardContent></Card>;
  }
  
  if (!assignedClassDetails) {
     return (
        <Card className="text-center py-10">
            <Info className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardHeader><CardTitle>Not Assigned to a Class</CardTitle></CardHeader>
            <CardContent>
                <p className="text-muted-foreground">You are not currently assigned to a class. Please contact your school administrator.</p>
            </CardContent>
        </Card>
     );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CheckSquare className="mr-2 h-6 w-6" /> Monthly Attendance
          </CardTitle>
          <CardDescription>
            Enter the number of days present for each student for the selected month.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                    <CardTitle className="text-xl text-center min-w-[150px]">{format(new Date(selectedYear, selectedMonth), 'MMMM yyyy')}</CardTitle>
                    <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')}><ChevronRight className="h-4 w-4" /></Button>
                 </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label htmlFor="working-days" className="whitespace-nowrap">Total Working Days:</Label>
                    <Input 
                        id="working-days" 
                        type="number" 
                        className="w-24"
                        value={totalWorkingDays}
                        onChange={(e) => setTotalWorkingDays(e.target.value)}
                        max={31} min={0}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {studentEntries.length > 0 ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSubmitAttendance(); }}>
              <Table>
                <TableHeader><TableRow><TableHead>Student Name</TableHead><TableHead className="w-48 text-right">Days Present</TableHead></TableRow></TableHeader>
                <TableBody>
                  {studentEntries.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground"/>{student.studentName}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={student.daysPresent ?? ""}
                          onChange={(e) => handleAttendanceChange(student.studentId, e.target.value)}
                          disabled={isSubmitting || totalWorkingDays === ""}
                          max={+totalWorkingDays}
                          min={0}
                          className="w-24 inline-block"
                        />
                         <span className="ml-2 text-muted-foreground"> / {totalWorkingDays || '...'}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={isSubmitting || totalWorkingDays === ""}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> Save Attendance for {format(new Date(selectedYear, selectedMonth), 'MMMM')}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-center text-muted-foreground py-4">No students found in your assigned class for the {getAcademicYearForMonth(selectedMonth, selectedYear)} academic year.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
