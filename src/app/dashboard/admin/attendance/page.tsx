
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckSquare, Loader2, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getMonthlyAttendanceForAdmin } from "@/app/actions/attendance";
import type { MonthlyAttendanceRecord, AuthUser } from "@/types/attendance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";

const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: format(new Date(0, i), 'MMMM') }));
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

interface ClassOption {
  value: string;
  label: string;
}

export default function AdminAttendancePage() {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const [attendanceRecords, setAttendanceRecords] = useState<MonthlyAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [filterClassId, setFilterClassId] = useState<string>("");

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser.role === 'admin' && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        }
      } catch(e) { console.error("Failed to parse authUser in AdminAttendancePage", e); }
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    if (!authUser?.schoolId) return;
    const classes = await getClassesForSchoolAsOptions(authUser.schoolId.toString());
    setClassOptions(classes);
  }, [authUser]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const fetchAttendance = useCallback(async () => {
    if (!authUser || !authUser.schoolId) {
      if (authUser) toast({ variant: "destructive", title: "Error", description: "School information missing for admin." });
      setAttendanceRecords([]);
      return;
    }

    setIsLoading(true);
    const result = await getMonthlyAttendanceForAdmin(authUser.schoolId.toString(), selectedMonth, selectedYear);
    setIsLoading(false);

    if (result.success && result.records) {
      setAttendanceRecords(result.records);
      if (result.records.length === 0) {
        toast({ title: "No Records", description: "No monthly attendance records found for the selected period." });
      }
    } else {
      toast({ variant: "destructive", title: "Failed to load attendance", description: result.error || "Could not fetch attendance data." });
      setAttendanceRecords([]);
    }
  }, [authUser, selectedMonth, selectedYear, toast]);

  useEffect(() => {
    if (authUser?.schoolId) {
      fetchAttendance();
    }
  }, [authUser, selectedMonth, selectedYear, fetchAttendance]);
  
  const handleMonthChange = (direction: 'prev' | 'next') => {
    let newMonth = selectedMonth;
    let newYear = selectedYear;
    if (direction === 'prev') {
        newMonth = newMonth === 0 ? 11 : newMonth - 1;
        newYear = newMonth === 11 ? newYear - 1 : newYear;
    } else {
        newMonth = newMonth === 11 ? 0 : newMonth + 1;
        newYear = newMonth === 0 ? newYear + 1 : newYear;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const handleFilterChange = (value: string) => {
    setFilterClassId(value === "all" ? "" : value);
  };

  const filteredRecords = filterClassId
    ? attendanceRecords.filter(record => record.classId === filterClassId)
    : attendanceRecords;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CheckSquare className="mr-2 h-6 w-6" /> Student Monthly Attendance
          </CardTitle>
          <CardDescription>View submitted monthly attendance totals for your school.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <CardTitle>Monthly Attendance Records</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-lg font-semibold w-32 text-center">{format(new Date(selectedYear, selectedMonth), 'MMM yyyy')}</span>
                  <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <div>
                  <Select onValueChange={handleFilterChange} value={filterClassId || "all"}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filter by class..."/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading attendance...</p>
            </div>
          ) : !authUser ? (
             <p className="text-center text-muted-foreground py-4">Please log in as a school admin.</p>
          ) : filteredRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Days Present</TableHead>
                  <TableHead>Total Working Days</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Marked By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record._id.toString()}>
                    <TableCell>{record.studentName}</TableCell>
                    <TableCell>{record.className}</TableCell>
                    <TableCell>{record.daysPresent}</TableCell>
                    <TableCell>{record.totalWorkingDays}</TableCell>
                    <TableCell>{record.totalWorkingDays > 0 ? `${Math.round((record.daysPresent / record.totalWorkingDays) * 100)}%` : 'N/A'}</TableCell>
                    <TableCell>{record.markedByTeacherName || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
                <Info className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-semibold">No Attendance Data</p>
                <p className="text-muted-foreground">No attendance has been submitted for this month.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
