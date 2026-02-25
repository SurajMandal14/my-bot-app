
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckSquare, Loader2, Info, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getMonthlyAttendanceForAdmin } from "@/app/actions/attendance";
import type { MonthlyAttendanceRecord, AuthUser } from "@/types/attendance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";

interface ClassOption {
  value: string;
  label: string;
}

interface AcademicMonthSlot {
  month: number;   // 0–11
  year: number;
  label: string;   // e.g. "Jun 2024"
}

/** 
 * For an academic year string like "2024-2025" generate the 12 month
 * slots in school-year order: June(startYear) → May(endYear).
 */
function getAcademicMonthSlots(academicYear: string): AcademicMonthSlot[] {
  const parts = academicYear.split('-');
  if (parts.length !== 2) return [];
  const startYear = parseInt(parts[0], 10);
  const endYear   = parseInt(parts[1], 10);
  const schedule = [
    { month: 5,  year: startYear },
    { month: 6,  year: startYear },
    { month: 7,  year: startYear },
    { month: 8,  year: startYear },
    { month: 9,  year: startYear },
    { month: 10, year: startYear },
    { month: 11, year: startYear },
    { month: 0,  year: endYear   },
    { month: 1,  year: endYear   },
    { month: 2,  year: endYear   },
    { month: 3,  year: endYear   },
    { month: 4,  year: endYear   },
  ];
  return schedule.map(s => ({
    ...s,
    label: format(new Date(s.year, s.month, 1), 'MMM yyyy'),
  }));
}

export default function AdminAttendancePage() {
  const { toast } = useToast();

  const [authUser, setAuthUser]             = useState<AuthUser | null>(null);
  const [academicYears, setAcademicYears]   = useState<AcademicYear[]>([]);
  const [selectedAY, setSelectedAY]         = useState<string>('');
  const [monthSlots, setMonthSlots]         = useState<AcademicMonthSlot[]>([]);
  const [selectedSlot, setSelectedSlot]     = useState<AcademicMonthSlot | null>(null);
  const [classOptions, setClassOptions]     = useState<ClassOption[]>([]);
  const [filterClassId, setFilterClassId]   = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<MonthlyAttendanceRecord[]>([]);
  const [isLoading, setIsLoading]           = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  /* ── auth ── */
  useEffect(() => {
    const stored = localStorage.getItem('loggedInUser');
    if (stored && stored !== 'undefined') {
      try {
        const u: AuthUser = JSON.parse(stored);
        if (u.role === 'admin' && u.schoolId) setAuthUser(u);
      } catch { /* ignore */ }
    }
  }, []);

  /* ── load academic years + classes once auth is ready ── */
  useEffect(() => {
    if (!authUser?.schoolId) return;
    (async () => {
      const [ayRes, classes] = await Promise.all([
        getAcademicYears(),
        getClassesForSchoolAsOptions(authUser.schoolId!.toString()),
      ]);
      setClassOptions(classes);

      if (ayRes.success && ayRes.academicYears?.length) {
        const sorted = [...ayRes.academicYears].sort((a, b) => b.year.localeCompare(a.year));
        setAcademicYears(sorted);

        // pick default or most-recent academic year
        const defaultAY = sorted.find(a => a.isDefault) ?? sorted[0];
        setSelectedAY(defaultAY.year);
      }
      setIsBootstrapping(false);
    })();
  }, [authUser]);

  /* ── whenever academic year changes, rebuild month slots + auto-select current/nearest month ── */
  useEffect(() => {
    if (!selectedAY) return;
    const slots = getAcademicMonthSlots(selectedAY);
    setMonthSlots(slots);
    setAttendanceRecords([]);

    // Auto-select: find today's slot inside this academic year, else pick first
    const today = new Date();
    const todayM = today.getMonth();
    const todayY = today.getFullYear();
    const match = slots.find(s => s.month === todayM && s.year === todayY);
    setSelectedSlot(match ?? slots[0] ?? null);
  }, [selectedAY]);

  /* ── fetch attendance whenever selected slot changes ── */
  const fetchAttendance = useCallback(async () => {
    if (!authUser?.schoolId || !selectedSlot) return;
    setIsLoading(true);
    const res = await getMonthlyAttendanceForAdmin(
      authUser.schoolId.toString(),
      selectedSlot.month,
      selectedSlot.year,
    );
    setIsLoading(false);
    if (res.success && res.records) {
      setAttendanceRecords(res.records);
    } else {
      toast({ variant: 'destructive', title: 'Failed to load attendance', description: res.error ?? 'Could not fetch data.' });
      setAttendanceRecords([]);
    }
  }, [authUser, selectedSlot, toast]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const filteredRecords = filterClassId
    ? attendanceRecords.filter(r => r.classId === filterClassId)
    : attendanceRecords;

  const isCurrentSlot = (slot: AcademicMonthSlot) =>
    selectedSlot?.month === slot.month && selectedSlot?.year === slot.year;

  /* ─────────────── render ─────────────── */
  return (
    <div className="space-y-6">
      {/* ── page header ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CheckSquare className="mr-2 h-6 w-6" /> Student Monthly Attendance
          </CardTitle>
          <CardDescription>
            View submitted monthly attendance totals for your school. Select an academic year
            and click any month to load its records.
          </CardDescription>
        </CardHeader>
      </Card>

      {isBootstrapping ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading…</p>
        </div>
      ) : (
        <>
          {/* ── filters row ── */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Academic year selector */}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={selectedAY} onValueChange={v => { setSelectedAY(v); setFilterClassId(''); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(ay => (
                    <SelectItem key={ay._id} value={ay.year}>{ay.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class filter */}
            <Select value={filterClassId || 'all'} onValueChange={v => setFilterClassId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filter by class…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedSlot && (
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} — {selectedSlot.label}
              </Badge>
            )}
          </div>

          {/* ── month grid ── */}
          {monthSlots.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Academic Year {selectedAY} — Select a Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {monthSlots.map(slot => (
                    <button
                      key={slot.label}
                      onClick={() => setSelectedSlot(slot)}
                      className={[
                        'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
                        isCurrentSlot(slot)
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background hover:bg-muted border-border text-foreground',
                      ].join(' ')}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── attendance table ── */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedSlot
                  ? `Attendance — ${selectedSlot.label}`
                  : 'Attendance Records'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2">Loading attendance…</p>
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
                    {filteredRecords.map(record => (
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
                  <p className="text-muted-foreground">
                    {selectedSlot
                      ? `No attendance has been submitted for ${selectedSlot.label}.`
                      : 'Select a month above to view records.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
