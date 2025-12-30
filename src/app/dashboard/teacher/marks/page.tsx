
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookCopy, Loader2, Save, Info, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser, User as AppUser } from "@/types/user";
import type { StudentMarkInput, MarksSubmissionPayload } from "@/types/marks";
import { getSubjectsForTeacher, submitMarks, getMarksForAssessment, type SubjectForTeacher } from "@/app/actions/marks";
import { getStudentsByClass } from "@/app/actions/schoolUsers";
import { getSchoolById } from "@/app/actions/schools";
import { getClassDetailsById } from "@/app/actions/classes";
import type { School, AssessmentLocks } from "@/types/school";
import { getAcademicYears } from '@/app/actions/academicYears';
import type { AcademicYear } from '@/types/academicYear';
import { getAssessmentSchemeForClass } from '@/app/actions/assessmentConfigurations';
import type { AssessmentScheme } from '@/types/assessment';
import { ScrollArea } from '@/components/ui/scroll-area';


// STATE INTERFACES
interface StudentMarksCustomState { [assessmentName: string]: number | null }


const getCurrentAcademicYear = (): string => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  if (currentMonth >= 5) { return `${currentYear}-${currentYear + 1}`; } 
  else { return `${currentYear - 1}-${currentYear}`; }
};

export default function TeacherMarksEntryPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [allTaughtSubjects, setAllTaughtSubjects] = useState<SubjectForTeacher[]>([]);
  const [availableClasses, setAvailableClasses] = useState<{ value: string; label: string; }[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>("");
  const [subjectMarks, setSubjectMarks] = useState<Record<string, Record<string, StudentMarksCustomState>>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});
  
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  
  const [assessmentScheme, setAssessmentScheme] = useState<AssessmentScheme | null>(null);
  const [selectedAssessmentName, setSelectedAssessmentName] = useState<string>("");
  
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");

  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [studentsForMarks, setStudentsForMarks] = useState<AppUser[]>([]);
  const [studentMarks, setStudentMarks] = useState<Record<string, StudentMarksCustomState | {}>>({});
  // selectedStudentIds kept as a single selection applied across all subject tables

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudentsAndMarks, setIsLoadingStudentsAndMarks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clampMarks = (valueStr: string, max: number): number | null => {
    if (valueStr === '' || valueStr === undefined || valueStr === null) return null;
    const n = parseInt(valueStr, 10);
    if (Number.isNaN(n)) return null;
    if (n < 0) return 0;
    if (n > max) return max;
    return n;
  };
  
  const currentAssessmentConfig = assessmentScheme?.assessments.find(a => a.groupName === selectedAssessmentName);
  
  const isMarksEntryLocked = selectedAssessmentName && selectedAcademicYear && schoolDetails?.marksEntryLocks?.[selectedAcademicYear]?.[selectedAssessmentName as keyof AssessmentLocks] === true;

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        if (parsedUser && parsedUser.role === 'teacher' && parsedUser._id && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        }
      } catch (e) { console.error("Marks Entry: Failed to parse user", e); }
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!authUser || !authUser._id || !authUser.schoolId) return;
    setIsLoading(true);
    const [schoolResult, academicYearsResult] = await Promise.all([
      getSchoolById(authUser.schoolId.toString()),
      getAcademicYears()
    ]);
    
    if (schoolResult.success && schoolResult.school) {
        setSchoolDetails(schoolResult.school);
        let activeYear = schoolResult.school.activeAcademicYear;
        if (!activeYear && academicYearsResult.success && academicYearsResult.academicYears) {
             activeYear = academicYearsResult.academicYears.find(y => y.isDefault)?.year || academicYearsResult.academicYears[0]?.year || "";
        }
        setSelectedAcademicYear(activeYear || getCurrentAcademicYear());
    } else {
        setSelectedAcademicYear(getCurrentAcademicYear());
    }

    if(academicYearsResult.success && academicYearsResult.academicYears) {
        setAcademicYears(academicYearsResult.academicYears);
    }
    setIsLoading(false);
  }, [authUser]);

  useEffect(() => { if (authUser) fetchInitialData(); }, [authUser, fetchInitialData]);

  const fetchSubjectsForYear = useCallback(async () => {
      if (!authUser || !authUser._id || !authUser.schoolId || !selectedAcademicYear) return;
      setIsLoading(true);
      const subjectsResult = await getSubjectsForTeacher(authUser._id, authUser.schoolId, selectedAcademicYear);
      setAllTaughtSubjects(subjectsResult);
      
      const uniqueClasses = Array.from(new Map(subjectsResult.map(s => [s.classId, {value: s.classId, label: s.label.split('(')[1].replace(')', '') }])).values());
      setAvailableClasses(uniqueClasses);
      
      // Reset selections if they become invalid
      if (!uniqueClasses.some(c => c.value === selectedClassId)) {
        setSelectedClassId("");
        setAssessmentScheme(null);
        setSelectedAssessmentName("");
        setSelectedSubjectName("");
      }
      
      setIsLoading(false);
  }, [authUser, selectedAcademicYear, selectedClassId]);

  useEffect(() => {
    if (selectedAcademicYear && authUser) fetchSubjectsForYear();
  }, [selectedAcademicYear, authUser, fetchSubjectsForYear]);

  // Update available subjects from class details (show all subjects for class)
  useEffect(() => {
    const loadClassSubjects = async () => {
      if (!selectedClassId || !authUser?.schoolId) {
        setAvailableSubjects([]);
        setSubjectMarks({});
        setSelectedSubjectName("");
        return;
      }
      const classRes = await getClassDetailsById(selectedClassId, authUser.schoolId.toString());
      if (classRes && 'classDetails' in classRes && classRes.success && classRes.classDetails) {
        const subjectsForClass = (classRes.classDetails.subjects || []).map((s: any) => s.name);
        const unique = Array.from(new Set(subjectsForClass));
        setAvailableSubjects(unique);
        setSubjectMarks({});
        // Preserve selection if still valid, otherwise default to first subject
        setSelectedSubjectName((prev) => (prev && unique.includes(prev)) ? prev : (unique[0] || ""));
      } else {
        setAvailableSubjects([]);
        setSubjectMarks({});
        setSelectedSubjectName("");
      }
    };
    loadClassSubjects();
  }, [selectedClassId, authUser?.schoolId]);

  // Fetch assessment scheme when class changes
  useEffect(() => {
    const fetchScheme = async () => {
      const selectedClassInfo = allTaughtSubjects.find(s => s.classId === selectedClassId);
      if (selectedClassId && authUser?.schoolId && selectedAcademicYear && selectedClassInfo?.className) {
        const schemeResult = await getAssessmentSchemeForClass(selectedClassInfo.className, authUser.schoolId, selectedAcademicYear);
        if (schemeResult.success && schemeResult.scheme) {
          setAssessmentScheme(schemeResult.scheme);
        } else {
            toast({ variant: 'destructive', title: 'Scheme Error', description: schemeResult.message || "Could not fetch assessment scheme for this class." });
            setAssessmentScheme(null);
        }
      } else {
        setAssessmentScheme(null);
      }
      setSelectedAssessmentName(""); // Reset assessment selection
      setSelectedSubjectName("");
    };
    fetchScheme();
  }, [selectedClassId, allTaughtSubjects, authUser?.schoolId, selectedAcademicYear, toast]);


  const fetchStudentsAndMarks = useCallback(async () => {
    const isReadyForFetch = selectedClassId && selectedAssessmentName && selectedAcademicYear && authUser?.schoolId && selectedSubjectName;
    if (!isReadyForFetch || !currentAssessmentConfig) {
      setStudentsForMarks([]); setSubjectMarks({}); setSelectedStudentIds({}); return;
    }
    if (isMarksEntryLocked) {
      setStudentsForMarks([]); setSubjectMarks({}); setSelectedStudentIds({}); return;
    }

    setIsLoadingStudentsAndMarks(true);
    try {
      const studentsResult = await getStudentsByClass(authUser!.schoolId!, selectedClassId, selectedAcademicYear);
      if (!studentsResult.success || !studentsResult.users) {
        toast({ variant: "destructive", title: "Error", description: studentsResult.message || "Failed to load students." });
        setIsLoadingStudentsAndMarks(false); return;
      }
      setStudentsForMarks(studentsResult.users);
      setSelectedStudentIds(studentsResult.users.reduce((acc, s) => ({...acc, [s._id!]: true}), {}));

      // Initialize marks for the selected subject only
      const baseMarksBySubject: Record<string, Record<string, StudentMarksCustomState>> = {};
      {
        const subject = selectedSubjectName;
        const perStudent: Record<string, StudentMarksCustomState> = {};
        studentsResult.users.forEach(student => {
          const studentIdStr = student._id!.toString();
          perStudent[studentIdStr] = currentAssessmentConfig.tests.reduce((acc, test) => {
            (acc as any)[test.testName] = null;
            return acc;
          }, {} as any);
        });
        baseMarksBySubject[subject] = perStudent;
      }

      // Fetch existing marks for selected subject and merge (robust to whitespace/case)
      {
        const subject = selectedSubjectName;
        const result = await getMarksForAssessment(
          authUser!.schoolId!, selectedClassId, subject,
          selectedAssessmentName, selectedAcademicYear
        );
        if (result.success && result.marks) {
          const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
          const prefix = `${selectedAssessmentName}-`;
          // Map normalized test name -> actual scheme test name
          const testNameMap = new Map<string, string>();
          currentAssessmentConfig.tests.forEach(t => testNameMap.set(normalize(t.testName), t.testName));
          result.marks.forEach(mark => {
            const studentIdStr = mark.studentId.toString();
            const an = mark.assessmentName || '';
            if (!an.startsWith(prefix)) return;
            const testNameRaw = an.slice(prefix.length);
            const normKey = normalize(testNameRaw);
            const schemeKey = testNameMap.get(normKey);
            if (schemeKey && baseMarksBySubject[subject]?.[studentIdStr]) {
              if (Object.prototype.hasOwnProperty.call(baseMarksBySubject[subject][studentIdStr], schemeKey)) {
                // Keep the first (latest, due to server sort) and ignore older duplicates
                const currVal = (baseMarksBySubject[subject][studentIdStr] as StudentMarksCustomState)[schemeKey];
                if (currVal === null || currVal === undefined) {
                  (baseMarksBySubject[subject][studentIdStr] as StudentMarksCustomState)[schemeKey] = mark.marksObtained;
                }
              }
            }
          });
        }
      }
      setSubjectMarks(baseMarksBySubject);

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsLoadingStudentsAndMarks(false);
    }
  }, [authUser, selectedClassId, selectedAssessmentName, selectedAcademicYear, selectedSubjectName, toast, isMarksEntryLocked, currentAssessmentConfig, availableSubjects]);

  useEffect(() => { fetchStudentsAndMarks(); }, [fetchStudentsAndMarks]);


  const handleMarksChange = (subjectName: string, studentId: string, fieldKey: string, value: string, max: number) => {
    const numValue = clampMarks(value, max);
    setSubjectMarks(prev => ({
      ...prev,
      [subjectName]: {
        ...(prev[subjectName] || {}),
        [studentId]: { ...((prev[subjectName] || {})[studentId]), [fieldKey]: numValue }
      }
    }));
  };

  const handleSelectAllChange = (checked: boolean | 'indeterminate') => {
    if (checked === 'indeterminate') return;
    setSelectedStudentIds(studentsForMarks.reduce((acc, s) => ({ ...acc, [s._id!]: checked }), {}));
  };
  
  const allStudentsSelected = studentsForMarks.length > 0 && studentsForMarks.every(s => selectedStudentIds[s._id!.toString()]);
  const someStudentsSelected = studentsForMarks.some(s => selectedStudentIds[s._id!.toString()]);
  const selectAllCheckboxState = allStudentsSelected ? true : (someStudentsSelected ? 'indeterminate' : false);

  const handleSubmitSubject = async (subjectName: string) => {
    const classInfo = allTaughtSubjects.find(s => s.classId === selectedClassId);
    if (!authUser || !selectedClassId || !selectedAssessmentName || !selectedAcademicYear || !currentAssessmentConfig || !classInfo) return;

    const finalSelectedStudentIds = Object.keys(selectedStudentIds).filter(id => selectedStudentIds[id]);
    if (finalSelectedStudentIds.length === 0) { toast({ variant: "info", title: "No Students Selected" }); return; }

    setIsSubmitting(true);
    const marksToSubmit: StudentMarkInput[] = [];
    const studentsToProcess = studentsForMarks.filter(student => finalSelectedStudentIds.includes(student._id!.toString()));
    
    for (const student of studentsToProcess) {
      const studentIdStr = student._id!.toString();
      const marksState = subjectMarks[subjectName]?.[studentIdStr];
      if (!marksState) continue;
      for (const test of currentAssessmentConfig.tests) {
        const marksObtained = (marksState as StudentMarksCustomState)?.[test.testName];
        if(marksObtained === null || marksObtained === undefined) continue;
        if (marksObtained > test.maxMarks) {
          toast({ variant: "destructive", title: "Marks Exceed Max", description: `Marks for ${student.name} (${test.testName}: ${marksObtained}) exceed max marks (${test.maxMarks}).`});
          setIsSubmitting(false); return;
        }
        marksToSubmit.push({ studentId: studentIdStr, studentName: student.name || "N/A", assessmentName: `${selectedAssessmentName}-${test.testName}`, marksObtained, maxMarks: test.maxMarks });
      }
    }

    if (marksToSubmit.length === 0) { toast({ variant: "info", title: "No Marks to Submit" }); setIsSubmitting(false); return; }

    const payload: MarksSubmissionPayload = {
      classId: selectedClassId,
      className: classInfo.className,
      subjectId: subjectName,
      subjectName: subjectName,
      academicYear: selectedAcademicYear,
      markedByTeacherId: authUser._id.toString(),
      schoolId: authUser.schoolId.toString(),
      studentMarks: marksToSubmit,
    };
    const result = await submitMarks(payload);
    toast({ title: result.success ? "Marks Submitted" : "Submission Failed", description: result.message || result.error, variant: result.success ? "default" : "destructive" });
    if(result.success) fetchStudentsAndMarks();
    setIsSubmitting(false);
  };
  
  if (!authUser) {
    return <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent><p>Please log in as a teacher.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><BookCopy className="mr-2 h-6 w-6" /> Enter Student Marks</CardTitle><CardDescription>Select the class, subject, assessment, and academic year to enter marks.</CardDescription></CardHeader></Card>

      <Card>
        <CardHeader><CardTitle>Selection Criteria</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
           <div><Label htmlFor="academic-year-select">Academic Year</Label><Select onValueChange={setSelectedAcademicYear} value={selectedAcademicYear} disabled={isLoading || academicYears.length === 0}><SelectTrigger id="academic-year-select"><SelectValue placeholder="Select year"/></SelectTrigger><SelectContent>{academicYears.map(year => <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>)}</SelectContent></Select></div>
           <div><Label htmlFor="class-select">Class</Label><Select onValueChange={setSelectedClassId} value={selectedClassId} disabled={isLoading || availableClasses.length === 0}><SelectTrigger id="class-select"><SelectValue placeholder={isLoading ? "Loading..." : "Select class"} /></SelectTrigger><SelectContent>{availableClasses.map(cls => <SelectItem key={cls.value} value={cls.value}>{cls.label}</SelectItem>)}</SelectContent></Select></div>
           <div><Label htmlFor="assessment-select">Assessment</Label><Select onValueChange={setSelectedAssessmentName} value={selectedAssessmentName} disabled={!selectedClassId || !assessmentScheme}><SelectTrigger id="assessment-select"><SelectValue placeholder="Select assessment" /></SelectTrigger><SelectContent>{(assessmentScheme?.assessments || []).map(a => <SelectItem key={a.groupName} value={a.groupName}>{a.groupName}</SelectItem>)}</SelectContent></Select></div>
           <div><Label htmlFor="subject-select">Subject</Label><Select onValueChange={setSelectedSubjectName} value={selectedSubjectName} disabled={!selectedClassId || availableSubjects.length === 0}><SelectTrigger id="subject-select"><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{availableSubjects.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent></Select></div>
        </CardContent>
      </Card>
      
      {selectedAssessmentName && isMarksEntryLocked && (
        <Alert variant="destructive"><Lock className="h-4 w-4" /><AlertTitle>Marks Entry Locked</AlertTitle><AlertDescription>The administrator has locked marks entry for <strong>{selectedAssessmentName}</strong> for this academic year.</AlertDescription></Alert>
      )}

      {(studentsForMarks.length > 0 || isLoadingStudentsAndMarks) && !isMarksEntryLocked && (
        <Card>
          <CardHeader><CardTitle>Enter Marks for: {availableClasses.find(c=>c.value === selectedClassId)?.label} - {selectedAssessmentName}{selectedSubjectName ? ` - ${selectedSubjectName}` : ''}</CardTitle></CardHeader>
          <CardContent>
            {/* Inline Subject selector for quick switching */}
            <div className="flex items-end justify-end mb-4">
              <div className="w-full sm:w-[240px]">
                <Label htmlFor="subject-select-inline">Subject</Label>
                <Select onValueChange={setSelectedSubjectName} value={selectedSubjectName} disabled={!selectedClassId || availableSubjects.length === 0}>
                  <SelectTrigger id="subject-select-inline"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map(sub => <SelectItem key={`${sub}-inline`} value={sub}>{sub}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isLoadingStudentsAndMarks ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading...</p></div>
            ) : (
              <div className="space-y-8">
                {selectedSubjectName ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSubmitSubject(selectedSubjectName); }}>
                    <h3 className="font-semibold mb-2">{selectedSubjectName}</h3>
                    <ScrollArea className="h-[50vh]">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 sticky left-0 bg-card z-20"><Checkbox checked={selectAllCheckboxState} onCheckedChange={handleSelectAllChange} /></TableHead>
                              <TableHead className="sticky left-12 bg-card z-30 min-w-[150px]">Student Name</TableHead>
                              <TableHead>Admission ID</TableHead>
                              {currentAssessmentConfig?.tests.map(test => (
                                <TableHead key={`${selectedSubjectName}-${test.testName}`} className="w-28 text-center">{test.testName} ({test.maxMarks}M)</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentsForMarks.map(student => {
                              const studentIdStr = student._id!.toString();
                              const currentMarks = subjectMarks[selectedSubjectName]?.[studentIdStr];
                              return (
                                <TableRow key={`${selectedSubjectName}-${studentIdStr}`}>
                                  <TableCell className="sticky left-0 bg-card z-10"><Checkbox checked={!!selectedStudentIds[studentIdStr]} onCheckedChange={c => setSelectedStudentIds(p => ({...p, [studentIdStr]: !!c}))} /></TableCell>
                                  <TableCell className="sticky left-12 bg-card z-20 font-medium">{student.name}</TableCell>
                                  <TableCell>{student.admissionId || 'N/A'}</TableCell>
                                  {currentAssessmentConfig?.tests.map(test => (
                                    <TableCell key={`${selectedSubjectName}-${studentIdStr}-${test.testName}`}>
                                      <Input
                                        type="number"
                                        value={(currentMarks as StudentMarksCustomState)?.[test.testName] ?? ""}
                                        onChange={e => handleMarksChange(selectedSubjectName, studentIdStr, test.testName, e.target.value, test.maxMarks)}
                                        onBlur={e => handleMarksChange(selectedSubjectName, studentIdStr, test.testName, e.target.value, test.maxMarks)}
                                        disabled={isSubmitting}
                                        max={test.maxMarks}
                                        min={0}
                                        className="mx-auto w-24"
                                        inputMode="numeric"
                                      />
                                    </TableCell>
                                  ))}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                    <div className="mt-4 flex justify-end">
                      <Button type="submit" disabled={isSubmitting || isLoadingStudentsAndMarks}><Save className="mr-2 h-4 w-4" /> Save Marks</Button>
                    </div>
                  </form>
                ) : (
                  <p className="text-muted-foreground">Select a subject to enter marks.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

        {!isMarksEntryLocked && !isLoadingStudentsAndMarks && studentsForMarks.length === 0 && (
          <p className="text-center text-muted-foreground py-4">{`No students for the selected class in ${selectedAcademicYear}.`}</p>
      )}
    </div>
  );
}

