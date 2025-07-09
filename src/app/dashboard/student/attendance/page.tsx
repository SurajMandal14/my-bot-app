
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Percent, Loader2, CalendarClock } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getStudentMonthlyAttendance } from "@/app/actions/attendance";
import type { MonthlyAttendanceRecord, AuthUser } from "@/types/attendance";

export default function StudentAttendancePage() {
  const [attendanceRecords, setAttendanceRecords] = useState<MonthlyAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role === 'student' && parsedUser._id) {
          setAuthUser(parsedUser);
        }
      } catch (e) { console.error("Failed to parse user from localStorage:", e); }
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    if (!authUser || !authUser._id) {
      setIsLoading(false);
      setAttendanceRecords([]);
      if (authUser) toast({ variant: "destructive", title: "Error", description: "Student information missing." });
      return;
    }

    setIsLoading(true);
    const result = await getStudentMonthlyAttendance(authUser._id.toString());
    setIsLoading(false);

    if (result.success && result.records) {
      setAttendanceRecords(result.records);
    } else {
      toast({ variant: "destructive", title: "Failed to Load Attendance", description: result.error || "Could not fetch your attendance data." });
    }
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser?._id) {
      fetchAttendance();
    } else {
      setIsLoading(false);
    }
  }, [authUser, fetchAttendance]);

  const calculateOverallSummary = () => {
    if (attendanceRecords.length === 0) {
      return { percentage: 0, totalWorking: 0, totalPresent: 0 };
    }
    const totalWorking = attendanceRecords.reduce((sum, r) => sum + r.totalWorkingDays, 0);
    const totalPresent = attendanceRecords.reduce((sum, r) => sum + r.daysPresent, 0);
    const percentage = totalWorking > 0 ? Math.round((totalPresent / totalWorking) * 100) : 0;
    return { percentage, totalWorking, totalPresent };
  };

  const summary = calculateOverallSummary();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CalendarClock className="mr-2 h-6 w-6" /> My Attendance Record
          </CardTitle>
          <CardDescription>View your monthly attendance summary.</CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading...</p>
          </CardContent>
        </Card>
      ) : !authUser ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">Please log in as a student.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Overall Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-1 rounded-lg border p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Overall Percentage</p>
                  <Percent className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{summary.percentage}%</p>
                <Progress value={summary.percentage} className="h-2 mt-1" />
                <p className="text-xs text-muted-foreground">{summary.totalPresent} / {summary.totalWorking} days attended across all months</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Monthly Attendance Log</CardTitle></CardHeader>
            <CardContent>
              {attendanceRecords.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Days Present</TableHead><TableHead>Total Working Days</TableHead><TableHead>Percentage</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record) => (
                      <TableRow key={record._id.toString()}>
                        <TableCell>{format(new Date(record.year, record.month), "MMMM yyyy")}</TableCell>
                        <TableCell>{record.daysPresent}</TableCell>
                        <TableCell>{record.totalWorkingDays}</TableCell>
                        <TableCell>{record.totalWorkingDays > 0 ? `${Math.round((record.daysPresent / record.totalWorkingDays) * 100)}%` : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No attendance records found.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
