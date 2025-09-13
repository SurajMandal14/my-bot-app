
"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import type { School, AssessmentLocks } from "@/types/school";
import { getAcademicYears } from '@/app/actions/academicYears';
import type { AcademicYear } from '@/types/academicYear';
import { getAssessmentSchemeForClass } from '@/app/actions/assessmentConfigurations';
import type { AssessmentScheme } from '@/types/assessment';


// DEFAULT FALLBACK DATA
const LEGACY_ASSESSMENT_TYPES = ["FA1", "FA2", "FA3", "FA4", "SA1", "SA2"];
const LEGACY_FA_ASSESSMENTS = ["FA1", "FA2", "FA3", "FA4"];
const LEGACY_SA_ASSESSMENTS = ["SA1", "SA2"];
const LEGACY_SA_PAPERS = ["Paper1", "Paper2"] as const;
type LegacySaPaperType = (typeof LEGACY_SA_PAPERS)[number];

const LEGACY_FA_TOOLS = [
  { key: 'tool1', label: 'Tool 1', maxMarks: 10 },
  { key: 'tool2', label: 'Tool 2', maxMarks: 10 },
  { key: 'tool3', label: 'Tool 3', maxMarks: 10 },
  { key: 'tool4', label: 'Tool 4', maxMarks: 20 },
] as const;
type LegacyFaToolKey = (typeof LEGACY_FA_TOOLS)[number]['key'];

const LEGACY_SA_ASSESSMENT_SKILLS = [
    { key: 'as1', label: 'AS 1' }, { key: 'as2', label: 'AS 2' },
    { key: 'as3', label: 'AS 3' }, { key: 'as4', label: 'AS 4' },
    { key: 'as5', label: 'AS 5' }, { key: 'as6', label: 'AS 6' },
] as const;
type LegacySaAsKey = (typeof LEGACY_SA_ASSESSMENT_SKILLS)[number]['key'];

// STATE INTERFACES
interface StudentMarksCustomState { [assessmentName: string]: number | null }
interface StudentMarksLegacyFAState {
  tool1: number | null; maxTool1: number; tool2: number | null; maxTool2: number;
  tool3: number | null; maxTool3: number; tool4: number | null; maxTool4: number;
}
interface StudentMarksLegacySAState {
  as1: number | null; as1Max: number; as2: number | null; as2Max: number;
  as3: number | null; as3Max: number; as4: number | null; as4Max: number;
  as5: number | null; as5Max: number; as6: number | null; as6Max: number;
}


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

  const [availableSubjects, setAvailableSubjects] = useState<SubjectForTeacher[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectForTeacher | null>(null);

  const [assessmentScheme, setAssessmentScheme] = useState<AssessmentScheme | null>(null);
  const [selectedAssessmentName, setSelectedAssessmentName] = useState<string>("");

  const [selectedLegacyPaper, setSelectedLegacyPaper] = useState<LegacySaPaperType | "">("");
  
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");

  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [studentsForMarks, setStudentsForMarks] = useState<AppUser[]>([]);
  const [studentMarks, setStudentMarks] = useState<Record<string, StudentMarksCustomState | StudentMarksLegacyFAState | StudentMarksLegacySAState | {}>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});

  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingStudentsAndMarks, setIsLoadingStudentsAndMarks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isLegacyFA = !assessmentScheme && LEGACY_FA_ASSESSMENTS.includes(selectedAssessmentName);
  const isLegacySA = !assessmentScheme && LEGACY_SA_ASSESSMENTS.includes(selectedAssessmentName);
  const isCustomScheme = !!assessmentScheme && !!assessmentScheme.assessments.find(a => a.groupName === selectedAssessmentName);


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
    setIsLoadingSubjects(true);
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
    setIsLoadingSubjects(false);
  }, [authUser]);
  
  const fetchSubjectsForYear = useCallback(async () => {
      if (!authUser || !authUser._id || !authUser.schoolId || !selectedAcademicYear) return;
      setIsLoadingSubjects(true);
      const subjectsResult = await getSubjectsForTeacher(authUser._id, authUser.schoolId, selectedAcademicYear);
      setAvailableSubjects(subjectsResult);
      if (!subjectsResult.some(s => s.value === selectedSubject?.value)) {
        setSelectedSubject(null);
      }
      setIsLoadingSubjects(false);
  }, [authUser, selectedAcademicYear, selectedSubject]);

  useEffect(() => { if (authUser) fetchInitialData(); }, [authUser, fetchInitialData]);
  useEffect(() => { if (selectedAcademicYear && authUser) fetchSubjectsForYear(); }, [selectedAcademicYear, authUser, fetchSubjectsForYear]);

  const fetchStudentsAndMarks = useCallback(async () => {
    const isReadyForFetch = selectedSubject && selectedAssessmentName && selectedAcademicYear && authUser?.schoolId;
    if (!isReadyForFetch || (isLegacySA && !selectedLegacyPaper)) {
      setStudentsForMarks([]); setStudentMarks({}); setSelectedStudentIds({}); return;
    }
    if (isMarksEntryLocked) {
      setStudentsForMarks([]); setStudentMarks({}); setSelectedStudentIds({}); return;
    }

    setIsLoadingStudentsAndMarks(true);
    try {
      const studentsResult = await getStudentsByClass(authUser!.schoolId!, selectedSubject!.classId, selectedAcademicYear);
      if (!studentsResult.success || !studentsResult.users) {
        toast({ variant: "destructive", title: "Error", description: studentsResult.message || "Failed to load students." });
        setIsLoadingStudentsAndMarks(false); return;
      }
      setStudentsForMarks(studentsResult.users);
      setSelectedStudentIds(studentsResult.users.reduce((acc, s) => ({...acc, [s._id!]: true}), {}));

      const marksResult = await getMarksForAssessment(
        authUser!.schoolId!, selectedSubject!.classId, selectedSubject!.subjectName,
        selectedAssessmentName, selectedAcademicYear, isLegacySA ? selectedLegacyPaper : undefined
      );

      const initialMarks: Record<string, any> = {};

      studentsResult.users.forEach(student => {
        const studentIdStr = student._id!.toString();
        if (isCustomScheme) {
          initialMarks[studentIdStr] = (assessmentScheme?.assessments.find(a => a.groupName === selectedAssessmentName)?.tests || []).reduce((acc, test) => {
              acc[test.testName] = null;
              return acc;
          }, {} as Record<string, null>);
        } else if (isLegacyFA) {
          initialMarks[studentIdStr] = LEGACY_FA_TOOLS.reduce((acc, tool) => ({...acc, [tool.key]: null, [`max${tool.key.charAt(0).toUpperCase() + tool.key.slice(1)}`]: tool.maxMarks }), {});
        } else if (isLegacySA) {
          initialMarks[studentIdStr] = LEGACY_SA_ASSESSMENT_SKILLS.reduce((acc, skill) => ({...acc, [skill.key]: null, [`${skill.key}Max`]: 20 }), {});
        }
      });
      
      if (marksResult.success && marksResult.marks) {
        marksResult.marks.forEach(mark => {
          const studentIdStr = mark.studentId.toString();
          if (!initialMarks[studentIdStr]) return;
            const [assessmentGroup, testName] = mark.assessmentName.split('-');

            if (isCustomScheme && assessmentGroup === selectedAssessmentName && testName) {
                (initialMarks[studentIdStr] as StudentMarksCustomState)[testName] = mark.marksObtained;
            }
          else if (isLegacyFA) {
            const toolKey = testName?.toLowerCase().replace('tool', 'tool') as LegacyFaToolKey;
            if (assessmentGroup.startsWith(selectedAssessmentName) && toolKey) {
              (initialMarks[studentIdStr] as StudentMarksLegacyFAState)[toolKey] = mark.marksObtained;
            }
          } else if (isLegacySA) {
            const [, paperName, asKeyRaw] = mark.assessmentName.split('-');
            const asKey = asKeyRaw?.toLowerCase() as LegacySaAsKey;
            if (assessmentGroup.startsWith(selectedAssessmentName) && paperName === selectedLegacyPaper && asKey) {
              (initialMarks[studentIdStr] as StudentMarksLegacySAState)[asKey] = mark.marksObtained;
              (initialMarks[studentIdStr] as StudentMarksLegacySAState)[`${asKey}Max`] = mark.maxMarks;
            }
          }
        });
      }
      setStudentMarks(initialMarks);

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsLoadingStudentsAndMarks(false);
    }
  }, [authUser, selectedSubject, selectedAssessmentName, selectedLegacyPaper, selectedAcademicYear, toast, isLegacyFA, isLegacySA, isCustomScheme, isMarksEntryLocked, assessmentScheme]);

  useEffect(() => { fetchStudentsAndMarks(); }, [fetchStudentsAndMarks]);

  const handleSubjectChange = async (value: string) => {
    const subjectInfo = availableSubjects.find(s => s.value === value);
    setSelectedSubject(subjectInfo || null);
    setSelectedAssessmentName("");
    setAssessmentScheme(null);
    if (subjectInfo && authUser?.schoolId) {
      const schemeResult = await getAssessmentSchemeForClass(subjectInfo.classId, authUser.schoolId);
      if (schemeResult.success && schemeResult.scheme) {
        setAssessmentScheme(schemeResult.scheme);
      }
    }
  };

  const handleMarksChange = (studentId: string, fieldKey: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10);
    setStudentMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], [fieldKey]: numValue }}));
  };

  const handleSelectAllChange = (checked: boolean | 'indeterminate') => {
    if (checked === 'indeterminate') return;
    setSelectedStudentIds(studentsForMarks.reduce((acc, s) => ({ ...acc, [s._id!]: checked }), {}));
  };
  
  const allStudentsSelected = studentsForMarks.length > 0 && studentsForMarks.every(s => selectedStudentIds[s._id!.toString()]);
  const someStudentsSelected = studentsForMarks.some(s => selectedStudentIds[s._id!.toString()]);
  const selectAllCheckboxState = allStudentsSelected ? true : (someStudentsSelected ? 'indeterminate' : false);

  const handleSubmit = async () => {
    if (!authUser || !selectedSubject || !selectedAssessmentName || !selectedAcademicYear) return;
    if (isLegacySA && !selectedLegacyPaper) { toast({ variant: "destructive", title: "Missing Information", description: "Please select a paper for the SA exam." }); return; }
    
    const finalSelectedStudentIds = Object.keys(selectedStudentIds).filter(id => selectedStudentIds[id]);
    if (finalSelectedStudentIds.length === 0) { toast({ variant: "info", title: "No Students Selected" }); return; }
    
    setIsSubmitting(true);
    const marksToSubmit: StudentMarkInput[] = [];
    const studentsToProcess = studentsForMarks.filter(student => finalSelectedStudentIds.includes(student._id!.toString()));

    for (const student of studentsToProcess) {
      const studentIdStr = student._id!.toString();
      const marksState = studentMarks[studentIdStr];
      if (!marksState) continue;

      if (isCustomScheme) {
        const assessmentConfig = assessmentScheme!.assessments.find(a => a.groupName === selectedAssessmentName);
        if (!assessmentConfig) continue;

        for (const test of assessmentConfig.tests) {
            const marksObtained = (marksState as StudentMarksCustomState)[test.testName];
            if(marksObtained === null || marksObtained === undefined) continue;

            if (marksObtained > test.maxMarks) {
                toast({ variant: "destructive", title: "Marks Exceed Max", description: `Marks for ${student.name} (${test.testName}: ${marksObtained}) exceed max marks (${test.maxMarks}).`});
                setIsSubmitting(false); return;
            }
            marksToSubmit.push({ studentId: studentIdStr, studentName: student.name || "N/A", assessmentName: `${selectedAssessmentName}-${test.testName}`, marksObtained, maxMarks: test.maxMarks });
        }
      } else if (isLegacyFA) { // Legacy FA
        for (const tool of LEGACY_FA_TOOLS) {
          const marksObtained = (marksState as StudentMarksLegacyFAState)[tool.key];
          if (marksObtained === null || marksObtained === undefined) continue;
          if (marksObtained > tool.maxMarks) { toast({ variant: "destructive", title: "Marks Exceed Max", description: `Marks for ${student.name} (${tool.label}: ${marksObtained}) exceed max marks (${tool.maxMarks}).`}); setIsSubmitting(false); return; }
          marksToSubmit.push({ studentId: studentIdStr, studentName: student.name || "N/A", assessmentName: `${selectedAssessmentName}-${tool.key.charAt(0).toUpperCase() + tool.key.slice(1)}`, marksObtained, maxMarks: tool.maxMarks });
        }
      } else if (isLegacySA) { // Legacy SA
         for (const skill of LEGACY_SA_ASSESSMENT_SKILLS) {
          const marksObtained = (marksState as StudentMarksLegacySAState)[skill.key];
          const maxMarks = (marksState as StudentMarksLegacySAState)[`${skill.key}Max`];
          if (marksObtained === null || marksObtained === undefined) continue;
          if (marksObtained > maxMarks) { toast({ variant: "destructive", title: "Marks Exceed Max", description: `Marks for ${student.name} (${skill.label}: ${marksObtained}) exceed max marks (${maxMarks}).`}); setIsSubmitting(false); return; }
          marksToSubmit.push({ studentId: studentIdStr, studentName: student.name || "N/A", assessmentName: `${selectedAssessmentName}-${selectedLegacyPaper}-${skill.key.toUpperCase()}`, marksObtained, maxMarks });
        }
      }
    }

    if (marksToSubmit.length === 0) { toast({ variant: "info", title: "No Marks to Submit" }); setIsSubmitting(false); return; }

    const payload: MarksSubmissionPayload = {
      classId: selectedSubject.classId, className: selectedSubject.className, subjectId: selectedSubject.subjectName,
      subjectName: selectedSubject.subjectName, academicYear: selectedAcademicYear,
      markedByTeacherId: authUser._id.toString(), schoolId: authUser.schoolId.toString(),
      studentMarks: marksToSubmit,
    };

    const result = await submitMarks(payload);
    toast({ title: result.success ? "Marks Submitted" : "Submission Failed", description: result.message || result.error, variant: result.success ? "default" : "destructive" });
    if(result.success) fetchStudentsAndMarks();
    setIsSubmitting(false);
  };
  
  const currentAssessmentConfig = isCustomScheme ? assessmentScheme?.assessments.find(a => a.groupName === selectedAssessmentName) : null;

  if (!authUser) {
    return <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent><p>Please log in as a teacher.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><BookCopy className="mr-2 h-6 w-6" /> Enter Student Marks</CardTitle><CardDescription>Select the subject, assessment, and academic year to enter marks.</CardDescription></CardHeader></Card>

      <Card>
        <CardHeader><CardTitle>Selection Criteria</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
           <div><Label htmlFor="academic-year-select">Academic Year</Label><Select onValueChange={setSelectedAcademicYear} value={selectedAcademicYear} disabled={isLoadingSubjects || academicYears.length === 0}><SelectTrigger id="academic-year-select"><SelectValue placeholder="Select year"/></SelectTrigger><SelectContent>{academicYears.map(year => <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>)}</SelectContent></Select></div>
           <div><Label htmlFor="subject-select">Subject (Class)</Label><Select onValueChange={handleSubjectChange} value={selectedSubject?.value || ""} disabled={isLoadingSubjects || availableSubjects.length === 0}><SelectTrigger id="subject-select"><SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select subject"} /></SelectTrigger><SelectContent>{availableSubjects.map(subject => <SelectItem key={subject.value} value={subject.value}>{subject.label}</SelectItem>)}</SelectContent></Select></div>
           <div><Label htmlFor="assessment-select">Assessment</Label><Select onValueChange={setSelectedAssessmentName} value={selectedAssessmentName} disabled={!selectedSubject}><SelectTrigger id="assessment-select"><SelectValue placeholder="Select assessment" /></SelectTrigger><SelectContent>{(assessmentScheme?.assessments.map(a => a.groupName) || LEGACY_ASSESSMENT_TYPES).map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
           {isLegacySA && <div><Label htmlFor="paper-select">Paper</Label><Select onValueChange={(v) => setSelectedLegacyPaper(v as LegacySaPaperType)} value={selectedLegacyPaper} disabled={!isLegacySA}><SelectTrigger id="paper-select"><SelectValue placeholder="Select paper" /></SelectTrigger><SelectContent>{LEGACY_SA_PAPERS.map(paper => <SelectItem key={paper} value={paper}>{paper}</SelectItem>)}</SelectContent></Select></div>}
        </CardContent>
      </Card>
      
      {selectedAssessmentName && isMarksEntryLocked && (
        <Alert variant="destructive"><Lock className="h-4 w-4" /><AlertTitle>Marks Entry Locked</AlertTitle><AlertDescription>The administrator has locked marks entry for <strong>{selectedAssessmentName}</strong> for this academic year.</AlertDescription></Alert>
      )}

      {(studentsForMarks.length > 0 || isLoadingStudentsAndMarks) && !isMarksEntryLocked && (
        <Card>
          <CardHeader><CardTitle>Enter Marks for: {selectedSubject?.label} - {selectedAssessmentName}{isLegacySA && selectedLegacyPaper && ` - ${selectedLegacyPaper}`}</CardTitle></CardHeader>
          <CardContent>
            {isLoadingStudentsAndMarks ? <div className="flex items-center justify-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading...</p></div>
            : <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}><div className="overflow-x-auto"><Table>
                  <TableHeader><TableRow>
                      <TableHead className="w-12 sticky left-0 bg-card z-10"><Checkbox checked={selectAllCheckboxState} onCheckedChange={handleSelectAllChange} /></TableHead>
                      <TableHead className="sticky left-12 bg-card z-10 min-w-[150px]">Student Name</TableHead>
                      <TableHead>Admission ID</TableHead>
                      {isCustomScheme && currentAssessmentConfig?.tests.map(test => <TableHead key={test.testName} className="w-28 text-center">{test.testName} ({test.maxMarks}M)</TableHead>)}
                      {isLegacyFA && LEGACY_FA_TOOLS.map(tool => <TableHead key={tool.key} className="w-28 text-center">{tool.label} ({tool.maxMarks}M)</TableHead>)}
                      {isLegacySA && LEGACY_SA_ASSESSMENT_SKILLS.map(skill => <React.Fragment key={skill.key}><TableHead className="w-28 text-center">{skill.label}</TableHead><TableHead className="w-28 text-center">{skill.label} (Max)</TableHead></React.Fragment>)}
                  </TableRow></TableHeader>
                  <TableBody>{studentsForMarks.map(student => {
                      const studentIdStr = student._id!.toString();
                      const currentMarks = studentMarks[studentIdStr];
                      return (<TableRow key={studentIdStr}>
                          <TableCell className="sticky left-0 bg-card z-10"><Checkbox checked={!!selectedStudentIds[studentIdStr]} onCheckedChange={c => setSelectedStudentIds(p => ({...p, [studentIdStr]: !!c}))} /></TableCell>
                          <TableCell className="sticky left-12 bg-card z-10 font-medium">{student.name}</TableCell>
                          <TableCell>{student.admissionId || 'N/A'}</TableCell>
                          {isCustomScheme && currentAssessmentConfig?.tests.map(test => <TableCell key={test.testName}><Input type="number" value={(currentMarks as StudentMarksCustomState)?.[test.testName] ?? ""} onChange={e => handleMarksChange(studentIdStr, test.testName, e.target.value)} disabled={isSubmitting} max={test.maxMarks} min="0" className="mx-auto w-24"/></TableCell>)}
                          {isLegacyFA && LEGACY_FA_TOOLS.map(tool => <TableCell key={tool.key}><Input type="number" value={(currentMarks as StudentMarksLegacyFAState)?.[tool.key] ?? ""} onChange={e => handleMarksChange(studentIdStr, tool.key, e.target.value)} disabled={isSubmitting} max={tool.maxMarks} min="0" className="mx-auto w-24"/></TableCell>)}
                          {isLegacySA && LEGACY_SA_ASSESSMENT_SKILLS.map(skill => <React.Fragment key={skill.key}><TableCell><Input type="number" value={(currentMarks as StudentMarksLegacySAState)?.[skill.key] ?? ""} onChange={e => handleMarksChange(studentIdStr, skill.key, e.target.value)} disabled={isSubmitting} max={(currentMarks as StudentMarksLegacySAState)?.[`${skill.key}Max`]} min="0" className="mx-auto w-24" /></TableCell><TableCell><Input type="number" value={(currentMarks as StudentMarksLegacySAState)?.[`${skill.key}Max`]} onChange={e => handleMarksChange(studentIdStr, `${skill.key}Max`, e.target.value)} disabled={isSubmitting} min="1" className="mx-auto w-24"/></TableCell></React.Fragment>)}
                      </TableRow>);
                  })}</TableBody>
              </Table></div><div className="mt-6 flex justify-end"><Button type="submit" disabled={isSubmitting || isLoadingStudentsAndMarks}><Save className="mr-2 h-4 w-4" /> Submit Marks</Button></div></form>}
          </CardContent>
        </Card>
      )}

      {!isMarksEntryLocked && !isLoadingStudentsAndMarks && studentsForMarks.length === 0 && selectedSubject && (
          <p className="text-center text-muted-foreground py-4">{isLegacySA && !selectedLegacyPaper ? "Please select a paper." : `No students for ${selectedSubject.className} in ${selectedAcademicYear}.`}</p>
      )}
    </div>
  );
}
