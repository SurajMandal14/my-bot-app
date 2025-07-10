
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
import type { School } from "@/types/school";

const ASSESSMENT_TYPES = ["FA1", "FA2", "FA3", "FA4", "SA1", "SA2"];
const FA_ASSESSMENTS = ["FA1", "FA2", "FA3", "FA4"];
const SA_ASSESSMENTS = ["SA1", "SA2"];
const SA_PAPERS = ["Paper1", "Paper2"] as const;
type SaPaperType = (typeof SA_PAPERS)[number];

const FA_TOOLS = [
  { key: 'tool1', label: 'Tool 1', maxMarks: 10 },
  { key: 'tool2', label: 'Tool 2', maxMarks: 10 },
  { key: 'tool3', label: 'Tool 3', maxMarks: 10 },
  { key: 'tool4', label: 'Tool 4', maxMarks: 20 },
] as const;
type FaToolKey = (typeof FA_TOOLS)[number]['key'];

const SA_ASSESSMENT_SKILLS = [
    { key: 'as1', label: 'AS 1' },
    { key: 'as2', label: 'AS 2' },
    { key: 'as3', label: 'AS 3' },
    { key: 'as4', label: 'AS 4' },
    { key: 'as5', label: 'AS 5' },
    { key: 'as6', label: 'AS 6' },
] as const;
type SaAsKey = (typeof SA_ASSESSMENT_SKILLS)[number]['key'];


interface StudentMarksFAState {
  tool1: number | null; maxTool1: number;
  tool2: number | null; maxTool2: number;
  tool3: number | null; maxTool3: number;
  tool4: number | null; maxTool4: number;
}

interface StudentMarksSAState {
  as1: number | null; as1Max: number;
  as2: number | null; as2Max: number;
  as3: number | null; as3Max: number;
  as4: number | null; as4Max: number;
  as5: number | null; as5Max: number;
  as6: number | null; as6Max: number;
}


const getCurrentAcademicYear = (): string => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  if (currentMonth >= 5) {
    return `${currentYear}-${currentYear + 1}`;
  } else {
    return `${currentYear - 1}-${currentYear}`;
  }
};

export default function TeacherMarksEntryPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [availableSubjects, setAvailableSubjects] = useState<SubjectForTeacher[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectForTeacher | null>(null);

  const [selectedAssessment, setSelectedAssessment] = useState<string>("");
  const [selectedPaper, setSelectedPaper] = useState<SaPaperType | "">("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(getCurrentAcademicYear());

  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [studentsForMarks, setStudentsForMarks] = useState<AppUser[]>([]);
  const [studentMarks, setStudentMarks] = useState<Record<string, StudentMarksFAState | StudentMarksSAState>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});

  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingStudentsAndMarks, setIsLoadingStudentsAndMarks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isCurrentAssessmentFA = FA_ASSESSMENTS.includes(selectedAssessment);
  const isCurrentAssessmentSA = SA_ASSESSMENTS.includes(selectedAssessment);
  
  const isMarksEntryLocked = selectedAssessment && selectedAcademicYear && schoolDetails?.marksEntryLocks?.[selectedAcademicYear]?.[selectedAssessment as keyof School['marksEntryLocks']] === true;


  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        if (parsedUser && parsedUser.role === 'teacher' && parsedUser._id && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        } else {
          setAuthUser(null);
          if(parsedUser?.role !== 'teacher') toast({ variant: "destructive", title: "Access Denied" });
        }
      } catch (e) { setAuthUser(null); }
    } else { setAuthUser(null); }
  }, [toast]);

  const fetchInitialData = useCallback(async () => {
    if (!authUser || !authUser._id || !authUser.schoolId) {
      setIsLoadingSubjects(false);
      return;
    }
    setIsLoadingSubjects(true);
    const [subjectsResult, schoolResult] = await Promise.all([
      getSubjectsForTeacher(authUser._id.toString(), authUser.schoolId.toString()),
      getSchoolById(authUser.schoolId.toString()),
    ]);
    
    if (subjectsResult.length > 0) {
      setAvailableSubjects(subjectsResult);
    } else {
      toast({ variant: "info", title: "No Subjects", description: "No subjects assigned to you for marks entry." });
      setAvailableSubjects([]);
    }

    if (schoolResult.success && schoolResult.school) {
        setSchoolDetails(schoolResult.school);
        if (schoolResult.school.activeAcademicYear) {
            setSelectedAcademicYear(schoolResult.school.activeAcademicYear);
        }
    } else {
        toast({ variant: "destructive", title: "Error", description: "Could not load school settings for marks entry."});
        setSchoolDetails(null);
    }
    
    setIsLoadingSubjects(false);
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser) fetchInitialData();
  }, [authUser, fetchInitialData]);

  const fetchStudentsAndMarks = useCallback(async () => {
    const shouldFetchFA = selectedSubject && isCurrentAssessmentFA && selectedAcademicYear && authUser?.schoolId;
    const shouldFetchSA = selectedSubject && isCurrentAssessmentSA && selectedPaper && selectedAcademicYear && authUser?.schoolId;

    if (!shouldFetchFA && !shouldFetchSA) {
        setStudentsForMarks([]);
        setStudentMarks({});
        setSelectedStudentIds({});
        return;
    }
    if (isMarksEntryLocked) {
        setStudentsForMarks([]);
        setStudentMarks({});
        setSelectedStudentIds({});
        return;
    }

    setIsLoadingStudentsAndMarks(true);
    try {
      const studentsResult = await getStudentsByClass(authUser!.schoolId!.toString(), selectedSubject!.classId, selectedAcademicYear);
      if (studentsResult.success && studentsResult.users) {
        setStudentsForMarks(studentsResult.users);
        
        const initialSelections: Record<string, boolean> = {};
        studentsResult.users.forEach(student => {
            initialSelections[student._id!.toString()] = true; // Pre-select all
        });
        setSelectedStudentIds(initialSelections);
        
        // Fetch existing marks
        const marksResult = await getMarksForAssessment(
          authUser!.schoolId!.toString(),
          selectedSubject!.classId,
          selectedSubject!.subjectName,
          selectedAssessment,
          selectedAcademicYear,
          isCurrentAssessmentSA ? selectedPaper as SaPaperType : undefined
        );

        const initialMarks: Record<string, StudentMarksFAState | StudentMarksSAState> = {};

        if (isCurrentAssessmentFA) {
            studentsResult.users.forEach(student => {
                const studentIdStr = student._id!.toString();
                initialMarks[studentIdStr] = {
                    tool1: null, maxTool1: 10,
                    tool2: null, maxTool2: 10,
                    tool3: null, maxTool3: 10,
                    tool4: null, maxTool4: 20,
                };
            });
            if (marksResult.success && marksResult.marks) {
                 marksResult.marks.forEach(mark => {
                    const studentIdStr = mark.studentId.toString();
                    const assessmentNameParts = mark.assessmentName.split('-');
                    if (assessmentNameParts.length === 2) {
                        const faBaseName = assessmentNameParts[0];
                        const toolKeyRaw = assessmentNameParts[1];
                        const toolKey = toolKeyRaw.toLowerCase().replace('tool', 'tool') as FaToolKey;

                        if (faBaseName === selectedAssessment && initialMarks[studentIdStr] && toolKey in initialMarks[studentIdStr]!) {
                           (initialMarks[studentIdStr] as StudentMarksFAState)[toolKey] = mark.marksObtained;
                           (initialMarks[studentIdStr] as StudentMarksFAState)[`max${toolKey.charAt(0).toUpperCase() + toolKey.slice(1)}` as keyof StudentMarksFAState] = mark.maxMarks;
                        }
                    }
                });
            }
        } else if (isCurrentAssessmentSA) {
            studentsResult.users.forEach(student => {
                const studentIdStr = student._id!.toString();
                 initialMarks[studentIdStr] = {
                    as1: null, as1Max: 20, as2: null, as2Max: 20, as3: null, as3Max: 20,
                    as4: null, as4Max: 20, as5: null, as5Max: 20, as6: null, as6Max: 20,
                };
            });
            if (marksResult.success && marksResult.marks) {
                marksResult.marks.forEach(mark => {
                    const studentIdStr = mark.studentId.toString();
                    const assessmentNameParts = mark.assessmentName.split('-'); // e.g., ["SA1", "Paper1", "AS1"]
                    if (assessmentNameParts.length === 3) {
                        const saBaseName = assessmentNameParts[0];
                        const paperName = assessmentNameParts[1];
                        const asKey = assessmentNameParts[2].toLowerCase() as SaAsKey;

                        if (saBaseName === selectedAssessment && paperName === selectedPaper && initialMarks[studentIdStr] && asKey in initialMarks[studentIdStr]!) {
                            (initialMarks[studentIdStr] as StudentMarksSAState)[asKey] = mark.marksObtained;
                            (initialMarks[studentIdStr] as StudentMarksSAState)[`${asKey}Max`] = mark.maxMarks;
                        }
                    }
                });
            }
        }
        setStudentMarks(initialMarks);

      } else {
        toast({ variant: "destructive", title: "Error", description: studentsResult.message || "Failed to load students."});
        setStudentsForMarks([]);
        setStudentMarks({});
        setSelectedStudentIds({});
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred fetching students or marks."});
      console.error("Error in fetchStudentsAndMarks:", error);
      setStudentsForMarks([]);
      setStudentMarks({});
      setSelectedStudentIds({});
    } finally {
      setIsLoadingStudentsAndMarks(false);
    }
  }, [authUser, selectedSubject, selectedAssessment, selectedPaper, selectedAcademicYear, toast, isCurrentAssessmentFA, isCurrentAssessmentSA, isMarksEntryLocked]);

  useEffect(() => {
    fetchStudentsAndMarks();
  }, [fetchStudentsAndMarks]);


  const handleSubjectChange = (value: string) => {
    const subjectInfo = availableSubjects.find(s => s.value === value);
    setSelectedSubject(subjectInfo || null);
    setSelectedAssessment("");
    setSelectedPaper("");
    setStudentsForMarks([]);
    setStudentMarks({});
    setSelectedStudentIds({});
  };

  const handleAssessmentChange = (value: string) => {
    setSelectedAssessment(value);
    setSelectedPaper(""); // Reset paper selection when assessment changes
  };

  const handleMarksChange = (studentId: string, fieldKey: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10);
    const validatedValue = isNaN(numValue as number) ? null : numValue;
  
    setStudentMarks(prev => {
      const currentStudentMarks = { ...(prev[studentId] || {}) };
      (currentStudentMarks as any)[fieldKey] = validatedValue;
      return { ...prev, [studentId]: currentStudentMarks };
    });
  };

  const handleSelectAllChange = (checked: boolean | 'indeterminate') => {
    if (checked === 'indeterminate') return; 
    const newSelections: Record<string, boolean> = {};
    studentsForMarks.forEach(student => {
        newSelections[student._id!.toString()] = checked as boolean;
    });
    setSelectedStudentIds(newSelections);
  };

  const handleStudentSelectionChange = (studentId: string, checked: boolean | 'indeterminate') => {
    if (checked === 'indeterminate') return;
    setSelectedStudentIds(prev => ({
        ...prev,
        [studentId]: checked as boolean,
    }));
  };
  
  const allStudentsSelected = studentsForMarks.length > 0 && studentsForMarks.every(s => selectedStudentIds[s._id!.toString()]);
  const someStudentsSelected = studentsForMarks.some(s => selectedStudentIds[s._id!.toString()]);
  const selectAllCheckboxState = allStudentsSelected ? true : (someStudentsSelected ? 'indeterminate' : false);


  const handleSubmit = async () => {
    if (!authUser || !authUser._id || !authUser.schoolId || !selectedSubject || !selectedAssessment || !selectedAcademicYear) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please select all filter fields." });
      return;
    }
     if (isCurrentAssessmentSA && !selectedPaper) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please select a paper for the SA exam." });
      return;
    }
    
    const finalSelectedStudentIds = Object.entries(selectedStudentIds)
        .filter(([, isSelected]) => isSelected)
        .map(([id]) => id);

    if (finalSelectedStudentIds.length === 0) {
        toast({ variant: "info", title: "No Students Selected", description: "Please select students to submit marks for." });
        return;
    }
    
    setIsSubmitting(true);

    const marksToSubmit: StudentMarkInput[] = [];
    const studentsToProcess = studentsForMarks.filter(student => finalSelectedStudentIds.includes(student._id!.toString()));


    for (const student of studentsToProcess) {
      const studentIdStr = student._id!.toString();
      const currentStudentMarkState = studentMarks[studentIdStr];

      if (!currentStudentMarkState) continue;

      if (isCurrentAssessmentFA) {
        const faData = currentStudentMarkState as StudentMarksFAState;
        for (const tool of FA_TOOLS) {
          const marksObtained = faData[tool.key];
          const maxMarks = faData[`max${tool.key.charAt(0).toUpperCase() + tool.key.slice(1)}` as keyof StudentMarksFAState] as number;

          if (marksObtained === null) continue; // Skip empty fields

          if (typeof marksObtained !== 'number' || marksObtained < 0) {
            toast({ variant: "destructive", title: "Invalid Marks", description: `Marks for ${student.name} (${tool.label}) must be a positive number.`});
            setIsSubmitting(false); return;
          }
          if (marksObtained > maxMarks) {
            toast({ variant: "destructive", title: "Marks Exceed Max", description: `Marks for ${student.name} (${tool.label}: ${marksObtained}) exceed max marks (${maxMarks}).`});
            setIsSubmitting(false); return;
          }
          marksToSubmit.push({
            studentId: studentIdStr,
            studentName: student.name || "N/A",
            marksObtained: marksObtained,
            maxMarks: maxMarks,
            assessmentName: `${selectedAssessment}-${tool.key.charAt(0).toUpperCase() + tool.key.slice(1)}`,
          });
        }
      } else if (isCurrentAssessmentSA && selectedPaper) {
        const saData = currentStudentMarkState as StudentMarksSAState;
        for (const skill of SA_ASSESSMENT_SKILLS) {
          const marksObtained = saData[skill.key];
          const maxMarks = saData[`${skill.key}Max`];

          if (marksObtained === null) continue; // Skip empty fields

          if (typeof marksObtained !== 'number' || marksObtained < 0) {
            toast({ variant: "destructive", title: "Invalid Marks", description: `Marks for ${student.name} (${skill.label}) must be a positive number.`});
            setIsSubmitting(false); return;
          }
           if (marksObtained > maxMarks) {
            toast({ variant: "destructive", title: "Marks Exceed Max", description: `Marks for ${student.name} (${skill.label}: ${marksObtained}) exceed max marks (${maxMarks}).`});
            setIsSubmitting(false); return;
          }
          marksToSubmit.push({
              studentId: studentIdStr, studentName: student.name || "N/A",
              marksObtained: marksObtained, maxMarks: maxMarks,
              assessmentName: `${selectedAssessment}-${selectedPaper}-${skill.key.toUpperCase()}`,
          });
        }
      }
    }

    if (marksToSubmit.length === 0) {
        toast({ variant: "info", title: "No Marks to Submit", description: "No marks were entered for the selected students." });
        setIsSubmitting(false);
        return;
    }

    const payload: MarksSubmissionPayload = {
      classId: selectedSubject.classId,
      className: selectedSubject.className,
      subjectId: selectedSubject.subjectName,
      subjectName: selectedSubject.subjectName,
      academicYear: selectedAcademicYear,
      markedByTeacherId: authUser._id.toString(),
      schoolId: authUser.schoolId.toString(),
      studentMarks: marksToSubmit,
    };

    const result = await submitMarks(payload);
    if (result.success) {
      toast({ title: "Marks Submitted", description: result.message });
      fetchStudentsAndMarks(); // Refresh marks
    } else {
      toast({ variant: "destructive", title: "Submission Failed", description: result.error || result.message });
    }
    setIsSubmitting(false);
  };


  if (!authUser) {
    return (
      <Card className="mt-6">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>Please log in as a teacher to enter marks.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <BookCopy className="mr-2 h-6 w-6" /> Enter Student Marks
          </CardTitle>
          <CardDescription>
            Select the subject, assessment, and academic year to enter marks for students.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selection Criteria</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label htmlFor="subject-select">Subject (Class)</Label>
            <Select onValueChange={handleSubjectChange} value={selectedSubject?.value || ""} disabled={isLoadingSubjects || availableSubjects.length === 0}>
              <SelectTrigger id="subject-select">
                <SelectValue placeholder={isLoadingSubjects ? "Loading subjects..." : (availableSubjects.length === 0 ? "No subjects assigned" : "Select subject")} />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.map(subject => (
                  <SelectItem key={subject.value} value={subject.value}>{subject.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="assessment-select">Assessment</Label>
            <Select onValueChange={handleAssessmentChange} value={selectedAssessment} disabled={!selectedSubject}>
              <SelectTrigger id="assessment-select"><SelectValue placeholder="Select assessment" /></SelectTrigger>
              <SelectContent>
                {ASSESSMENT_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isCurrentAssessmentSA && (
            <div>
                <Label htmlFor="paper-select">Paper</Label>
                <Select onValueChange={(v) => setSelectedPaper(v as SaPaperType)} value={selectedPaper} disabled={!isCurrentAssessmentSA}>
                <SelectTrigger id="paper-select"><SelectValue placeholder="Select paper" /></SelectTrigger>
                <SelectContent>
                    {SA_PAPERS.map(paper => <SelectItem key={paper} value={paper}>{paper}</SelectItem>)}
                </SelectContent>
                </Select>
            </div>
          )}
           <div>
            <Label htmlFor="academic-year-input">Academic Year</Label>
            <Input
                id="academic-year-input"
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                placeholder="e.g., 2023-2024"
                disabled={!selectedSubject}
            />
          </div>
        </CardContent>
      </Card>
      
      {selectedAssessment && isMarksEntryLocked && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Marks Entry Locked</AlertTitle>
          <AlertDescription>
            The administrator has locked marks entry for <strong>{selectedAssessment}</strong> for the academic year {selectedAcademicYear}. Please contact your school admin if this is a mistake.
          </AlertDescription>
        </Alert>
      )}

      {(studentsForMarks.length > 0 || isLoadingStudentsAndMarks) && !isMarksEntryLocked && (
        <Card>
          <CardHeader>
            <CardTitle>Enter Marks for: {selectedSubject?.label} - {selectedAssessment}{isCurrentAssessmentSA && selectedPaper && ` - ${selectedPaper}`}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStudentsAndMarks ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading...</p></div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                 <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 sticky left-0 bg-card z-10">
                        <Checkbox 
                            checked={selectAllCheckboxState} 
                            onCheckedChange={handleSelectAllChange}
                            aria-label="Select all students"
                        />
                      </TableHead>
                      <TableHead className="sticky left-12 bg-card z-10 min-w-[150px]">Student Name</TableHead>
                      <TableHead>Admission ID</TableHead>
                      {isCurrentAssessmentFA && FA_TOOLS.map(tool => <TableHead key={tool.key} className="w-28 text-center">{tool.label} ({tool.maxMarks}M)</TableHead>)}
                      {isCurrentAssessmentSA && SA_ASSESSMENT_SKILLS.map(skill => (
                          <React.Fragment key={skill.key}>
                            <TableHead className="w-28 text-center">{skill.label}</TableHead>
                            <TableHead className="w-28 text-center">{skill.label} (Max)</TableHead>
                          </React.Fragment>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsForMarks.map(student => {
                      const studentIdStr = student._id!.toString();
                      const currentMarksState = studentMarks[studentIdStr];
                      return (
                        <TableRow key={studentIdStr}>
                          <TableCell className="sticky left-0 bg-card z-10">
                            <Checkbox 
                                checked={!!selectedStudentIds[studentIdStr]}
                                onCheckedChange={(checked) => handleStudentSelectionChange(studentIdStr, checked)}
                                aria-label={`Select ${student.name}`}
                            />
                          </TableCell>
                          <TableCell className="sticky left-12 bg-card z-10 font-medium">{student.name}</TableCell>
                          <TableCell>{student.admissionId || 'N/A'}</TableCell>
                          
                          {isCurrentAssessmentFA && currentMarksState && (
                            FA_TOOLS.map(tool => {
                              const faData = currentMarksState as StudentMarksFAState;
                              const toolValue = faData ? faData[tool.key] : null;
                              return (
                                <TableCell key={tool.key} className="text-center">
                                  <Input
                                    type="number"
                                    value={toolValue ?? ""}
                                    onChange={e => handleMarksChange(studentIdStr, tool.key, e.target.value)}
                                    disabled={isSubmitting || isMarksEntryLocked}
                                    max={tool.maxMarks}
                                    min="0"
                                    className="mx-auto"
                                  />
                                </TableCell>
                              );
                            })
                          )}

                          {isCurrentAssessmentSA && currentMarksState && (
                            SA_ASSESSMENT_SKILLS.map(skill => {
                                const saData = currentMarksState as StudentMarksSAState;
                                return (
                                    <React.Fragment key={skill.key}>
                                        <TableCell className="text-center">
                                            <Input
                                                type="number"
                                                value={saData[skill.key] ?? ""}
                                                onChange={e => handleMarksChange(studentIdStr, skill.key, e.target.value)}
                                                disabled={isSubmitting || isMarksEntryLocked}
                                                max={saData[`${skill.key}Max`]}
                                                min="0"
                                                className="mx-auto"
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Input
                                                type="number"
                                                value={saData[`${skill.key}Max`]}
                                                onChange={e => handleMarksChange(studentIdStr, `${skill.key}Max`, e.target.value)}
                                                disabled={isSubmitting || isMarksEntryLocked}
                                                min="1"
                                                className="mx-auto"
                                            />
                                        </TableCell>
                                    </React.Fragment>
                                );
                            })
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button type="submit" disabled={isSubmitting || isLoadingStudentsAndMarks || studentsForMarks.length === 0 || isMarksEntryLocked}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" /> Submit Marks
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {!isMarksEntryLocked && !isLoadingStudentsAndMarks && studentsForMarks.length === 0 && selectedSubject && (
          <p className="text-center text-muted-foreground py-4">
            {isCurrentAssessmentSA && !selectedPaper ? "Please select a paper to load students." : `No students found for class ${selectedSubject.className} in academic year ${selectedAcademicYear}.`}
          </p>
      )}
    </div>
  );
}
