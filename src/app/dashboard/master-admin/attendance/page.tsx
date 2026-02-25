
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Loader2, Info } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getMonthlyAttendanceForAdmin } from "@/app/actions/attendance";
import { getAcademicYears } from "@/app/actions/academicYears";
import type { MonthlyAttendanceRecord, AuthUser } from "@/types/attendance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
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

interface ClassOption {
  value: string;
  label: string;
}


export default function MasterAdminAttendancePage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAY, setSelectedAY] = useState<string>('');
  const [monthSlots, setMonthSlots] = useState<AcademicMonthSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AcademicMonthSlot | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<MonthlyAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [filterClassId, setFilterClassId] = useState<string>('');

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== 'undefined') {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser.role === 'masteradmin' && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        }
      } catch (e) { console.error('Failed to parse authUser in MasterAdminAttendancePage', e); }
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

  const fetchClasses = useCallback(async () => {
    if (!authUser?.schoolId) return;
    const classes = await getClassesForSchoolAsOptions(authUser.schoolId.toString());
    setClassOptions(classes);
  }, [authUser]);

  useEffect(() => {
    if (authUser?.schoolId) fetchClasses();
  }, [authUser, fetchClasses]);

  const fetchAttendance = useCallback(async () => {
    if (!authUser?.schoolId || !selectedSlot) {
      setAttendanceRecords([]);
      return;
    }
    setIsLoading(true);
    const result = await getMonthlyAttendanceForAdmin(authUser.schoolId.toString(), selectedSlot.month, selectedSlot.year);
    setIsLoading(false);
    if (result.success && result.records) {
      setAttendanceRecords(result.records);
    } else {
      toast({ variant: 'destructive', title: 'Failed to load attendance', description: result.error || 'Could not fetch attendance data.' });
      setAttendanceRecords([]);
    }
  }, [authUser, selectedSlot, toast]);

  useEffect(() => {
    if (authUser?.schoolId && selectedSlot) fetchAttendance();
  }, [authUser, selectedSlot, fetchAttendance]);

  const handleFilterChange = (value: string) => {
    setFilterClassId(value === 'all' ? '' : value);
  };

  const filteredRecords = filterClassId
    ? attendanceRecords.filter((record) => record.classId === filterClassId)
    : attendanceRecords;

  if (!authUser) {
    return (
      <Card>
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>Please log in as a Master Admin.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CheckSquare className="mr-2 h-6 w-6" /> Student Monthly Attendance
          </CardTitle>
          <CardDescription>View submitted monthly attendance totals for your assigned school.</CardDescription>
        </CardHeader>
      </Card>

      {/* Academic Year + Month Grid */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg">Select Month</CardTitle>
            <div className="flex items-center gap-4 flex-wrap">
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
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap text-sm text-muted-foreground">Filter by Class</Label>
                <Select onValueChange={handleFilterChange} value={filterClassId || 'all'}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

      {/* Records Table */}
      {selectedSlot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              {selectedSlot.label}
              <Badge variant="secondary">{filteredRecords.length} records</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading attendance...</p>
              </div>
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
                      <TableCell>
                        {record.totalWorkingDays > 0
                          ? `${Math.round((record.daysPresent / record.totalWorkingDays) * 100)}%`
                          : 'N/A'}
                      </TableCell>
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
      )}
    </div>
  );
}

