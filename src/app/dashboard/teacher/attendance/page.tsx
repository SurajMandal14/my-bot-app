
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare, Save, Loader2, Info, User } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getDaysInMonth } from "date-fns";
import { submitMonthlyAttendance, getMonthlyAttendanceForClass } from "@/app/actions/attendance";
import { getStudentsByClass } from "@/app/actions/schoolUsers";
import { getClassDetailsById } from "@/app/actions/classes";
import { getAcademicYears } from "@/app/actions/academicYears";
import type { MonthlyAttendanceEntry } from "@/types/attendance";
import type { AuthUser } from "@/types/user";
import type { SchoolClass } from "@/types/classes";
import type { AcademicYear } from "@/types/academicYear";

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface AcademicMonthSlot {
  month: number;
  year: number;
  label: string;
}

function getAcademicMonthSlots(academicYear: string): AcademicMonthSlot[] {
  const [startStr, endStr] = academicYear.split('-');
  const startYear = parseInt(startStr, 10);
  const endYear = parseInt(endStr, 10);
  const schedule = [
    { month: 5, year: startYear }, { month: 6, year: startYear },
    { month: 7, year: startYear }, { month: 8, year: startYear },
    { month: 9, year: startYear }, { month: 10, year: startYear },
    { month: 11, year: startYear },
    { month: 0, year: endYear }, { month: 1, year: endYear },
    { month: 2, year: endYear }, { month: 3, year: endYear },
    { month: 4, year: endYear },
  ];
  return schedule.map(({ month, year }) => ({
    month,
    year,
    label: `${MONTH_LABELS[month]} ${year}`,
  }));
}



export default function TeacherAttendancePage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAY, setSelectedAY] = useState<string>('');
  const [monthSlots, setMonthSlots] = useState<AcademicMonthSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AcademicMonthSlot | null>(null);
  const [totalWorkingDays, setTotalWorkingDays] = useState<number | string>('');
  const [studentEntries, setStudentEntries] = useState<MonthlyAttendanceEntry[]>([]);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [assignedClassDetails, setAssignedClassDetails] = useState<SchoolClass | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
      try { setAuthUser(JSON.parse(storedUser)); } catch (e) { setAuthUser(null); }
    }
  }, []);

  // Load academic years
  useEffect(() => {
    getAcademicYears().then((result) => {
      if (result.success && result.academicYears) {
        setAcademicYears(result.academicYears);
        const def = result.academicYears.find((y) => y.isDefault) ?? result.academicYears[0];
        if (def) setSelectedAY(def.year);
      }
    });
  }, []);

  // Build month slots when AY changes
  useEffect(() => {
    if (!selectedAY) return;
    const slots = getAcademicMonthSlots(selectedAY);
    setMonthSlots(slots);
    const now = new Date();
    const match = slots.find((s) => s.month === now.getMonth() && s.year === now.getFullYear());
    setSelectedSlot(match ?? slots[0]);
  }, [selectedAY]);

  const fetchClassAndStudents = useCallback(async () => {
    if (!authUser || !authUser.schoolId || !authUser.classId || !selectedSlot) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const classResult = await getClassDetailsById(authUser.classId, authUser.schoolId.toString());
    if (classResult.success && classResult.classDetails) {
      setAssignedClassDetails(classResult.classDetails);
      const studentsResult = await getStudentsByClass(authUser.schoolId.toString(), classResult.classDetails._id, selectedAY);
      if (studentsResult.success && studentsResult.users) {
        const studentList = studentsResult.users.map((student) => ({
          studentId: student._id!.toString(),
          studentName: student.name || 'Unknown Student',
          daysPresent: null,
        }));
        setStudentEntries(studentList);
      } else {
        toast({ variant: 'destructive', title: 'Error Loading Students', description: studentsResult.message });
        setStudentEntries([]);
      }
    } else {
      toast({ variant: 'destructive', title: 'Class Not Found', description: 'Your assigned class could not be found.' });
      setStudentEntries([]);
    }
    setIsLoading(false);
  }, [authUser, toast, selectedSlot, selectedAY]);

  useEffect(() => {
    if (authUser?.classId && selectedSlot) {
      fetchClassAndStudents();
    } else if (authUser && !authUser.classId) {
      setIsLoading(false);
    }
  }, [authUser, fetchClassAndStudents, selectedSlot]);

  const fetchExistingData = useCallback(async () => {
    if (!assignedClassDetails || !selectedSlot) return;
    const existingRecordsResult = await getMonthlyAttendanceForClass(
      assignedClassDetails.schoolId,
      assignedClassDetails._id,
      selectedSlot.month,
      selectedSlot.year
    );
    if (existingRecordsResult.success && existingRecordsResult.records) {
      const records = existingRecordsResult.records;
      if (records.length > 0) {
        setTotalWorkingDays(records[0].totalWorkingDays);
        setStudentEntries((prevEntries) =>
          prevEntries.map((entry) => {
            const foundRecord = records.find((r) => r.studentId === entry.studentId);
            return foundRecord ? { ...entry, daysPresent: foundRecord.daysPresent } : entry;
          })
        );
      } else {
        setTotalWorkingDays(getDaysInMonth(new Date(selectedSlot.year, selectedSlot.month)));
        setStudentEntries((prev) => prev.map((e) => ({ ...e, daysPresent: null })));
      }
    }
  }, [assignedClassDetails, selectedSlot]);

  useEffect(() => {
    fetchExistingData();
  }, [fetchExistingData]);

  const handleAttendanceChange = (studentId: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10);
    const validatedValue = isNaN(numValue as number) ? null : numValue;
    setStudentEntries((prev) => prev.map((s) => (s.studentId === studentId ? { ...s, daysPresent: validatedValue } : s)));
  };

  const handleSubmitAttendance = async () => {
    if (!authUser || !authUser._id || !assignedClassDetails || !selectedSlot) return;
    if (totalWorkingDays === '' || +totalWorkingDays <= 0 || +totalWorkingDays > 31) {
      toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please enter a valid number of total working days (1-31).' });
      return;
    }
    setIsSubmitting(true);
    const result = await submitMonthlyAttendance({
      classId: assignedClassDetails._id,
      schoolId: authUser.schoolId!.toString(),
      month: selectedSlot.month,
      year: selectedSlot.year,
      totalWorkingDays: +totalWorkingDays,
      entries: studentEntries,
      markedByTeacherId: authUser._id.toString(),
    });
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: 'Attendance Submitted', description: result.message });
    } else {
      toast({ variant: 'destructive', title: 'Submission Failed', description: result.error || result.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading your class details...</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <Card>
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>Please log in as a teacher.</p></CardContent>
      </Card>
    );
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
          <CardDescription>Enter the number of days present for each student for the selected month.</CardDescription>
        </CardHeader>
      </Card>

      {/* Academic Year + Month Grid */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">Select Month</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap text-sm text-muted-foreground">Academic Year</Label>
              <Select value={selectedAY} onValueChange={setSelectedAY}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select year…" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((ay) => (
                    <SelectItem key={ay._id?.toString()} value={ay.year}>
                      {ay.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {monthSlots.map((slot) => {
              const isActive = selectedSlot?.month === slot.month && selectedSlot?.year === slot.year;
              return (
                <button
                  key={slot.label}
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-md border px-2 py-3 text-center text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-accent hover:text-accent-foreground border-input'
                  }`}
                >
                  <span className="block font-semibold">{MONTH_LABELS[slot.month]}</span>
                  <span className="block text-xs opacity-70">{slot.year}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      {selectedSlot && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-xl">{selectedSlot.label}</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Label htmlFor="working-days" className="whitespace-nowrap">Total Working Days:</Label>
                <Input
                  id="working-days"
                  type="number"
                  className="w-24"
                  value={totalWorkingDays}
                  onChange={(e) => setTotalWorkingDays(e.target.value)}
                  max={31}
                  min={0}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {studentEntries.length > 0 ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSubmitAttendance(); }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="w-48 text-right">Days Present</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentEntries.map((student) => (
                      <TableRow key={student.studentId}>
                        <TableCell className="font-medium flex items-center">
                          <User className="mr-2 h-4 w-4 text-muted-foreground" />{student.studentName}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={student.daysPresent ?? ''}
                            onChange={(e) => handleAttendanceChange(student.studentId, e.target.value)}
                            disabled={isSubmitting || totalWorkingDays === ''}
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
                  <Button type="submit" disabled={isSubmitting || totalWorkingDays === ''}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" /> Save Attendance for {selectedSlot.label}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No students found in your assigned class for the {selectedAY} academic year.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

