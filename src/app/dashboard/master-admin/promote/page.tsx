
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, ArrowRight, Loader2, Info, Users, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { User as AppUser, AuthUser } from "@/types/user";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { getStudentsByClass } from "@/app/actions/schoolUsers";
import { promoteStudents, discontinueStudents } from "@/app/actions/promoteStudents"; 
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";

interface ClassOption {
  value: string; // class _id
  label: string; // "ClassName - Section"
  name?: string;
}

const getSortableClassValue = (className: string = ""): number => {
    if (className.toLowerCase().includes("lkg")) return -1;
    if (className.toLowerCase().includes("ukg")) return 0;
    
    const romanMap: { [key: string]: number } = {
        'I': 1, 'V': 5, 'X': 10,
    };
    
    // Check for Roman numerals first (up to X)
    let romanValue = 0;
    let tempClassName = className.toUpperCase();
    if (tempClassName.startsWith('X')) { romanValue = 10; tempClassName = tempClassName.substring(1); }
    if (tempClassName.startsWith('IX')) { romanValue = 9; tempClassName = tempClassName.substring(2); }
    if (tempClassName.startsWith('V')) { romanValue = 5; tempClassName = tempClassName.substring(1); }
    if (tempClassName.startsWith('IV')) { romanValue = 4; tempClassName = tempClassName.substring(2); }
    while (tempClassName.startsWith('I')) { romanValue++; tempClassName = tempClassName.substring(1); }

    if (romanValue > 0) return romanValue;

    // Check for Arabic numerals
    const match = className.match(/\d+/);
    if (match) return parseInt(match[0], 10);
    
    return 99; // Default for non-standard names
};

export default function MasterAdminPromoteStudentsPage() {
    const { toast } = useToast();
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [classesInSchool, setClassesInSchool] = useState<ClassOption[]>([]);
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    
    const [fromAcademicYear, setFromAcademicYear] = useState("");
    const [toAcademicYear, setToAcademicYear] = useState("");

    const [fromClassId, setFromClassId] = useState("");
    const [toClassId, setToClassId] = useState("");

    const [students, setStudents] = useState<AppUser[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({});

    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [isPromoting, setIsPromoting] = useState(false);
    const [isDiscontinuing, setIsDiscontinuing] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser && storedUser !== 'undefined') {
            try {
                const parsedUser: AuthUser = JSON.parse(storedUser);
                if (parsedUser.role === 'masteradmin' && parsedUser.schoolId) {
                    setAuthUser(parsedUser);
                }
            } catch (e) { console.error(e); }
        }
    }, []);

    const fetchOptions = useCallback(async (schoolId: string) => {
        setIsLoadingOptions(true);
        const [classOptionsResult, academicYearsResult] = await Promise.all([
            getClassesForSchoolAsOptions(schoolId),
            getAcademicYears()
        ]);
        
        setClassesInSchool(classOptionsResult);

        if (academicYearsResult.success && academicYearsResult.academicYears) {
            setAcademicYears(academicYearsResult.academicYears);
            const defaultYear = academicYearsResult.academicYears.find(y => y.isDefault);
            let from = "";
            if (defaultYear) {
                from = defaultYear.year;
            } else if (academicYearsResult.academicYears.length > 0) {
                from = academicYearsResult.academicYears[0].year;
            }

            if (from) {
                const fromParts = from.split('-').map(Number);
                const prospectiveToYear = `${fromParts[0] + 1}-${fromParts[1] + 1}`;
                setFromAcademicYear(from);
                setToAcademicYear(prospectiveToYear);
            }
        } else {
             toast({ variant: "destructive", title: "Error", description: "Could not load academic years." });
        }
        
        setIsLoadingOptions(false);
    }, [toast]);

    useEffect(() => {
        if (authUser?.schoolId) {
            fetchOptions(authUser.schoolId.toString());
        }
    }, [authUser, fetchOptions]);


    const handleLoadStudents = useCallback(async () => {
        if (!fromClassId || !authUser?.schoolId || !fromAcademicYear) {
            toast({ variant: 'warning', title: 'Selection Missing', description: 'Please select a "From" class and academic year.' });
            return;
        }
        setIsLoadingStudents(true);
        const result = await getStudentsByClass(authUser.schoolId.toString(), fromClassId, fromAcademicYear);
        if (result.success && result.users) {
            // Backend now filters by academic year and active status
            const activeStudents = result.users.filter(u => u.status !== 'discontinued');
            setStudents(activeStudents);
            const initialSelections: Record<string, boolean> = {};
            activeStudents.forEach(s => {
                if(s._id) initialSelections[s._id.toString()] = true; // Default to all selected
            });
            setSelectedStudents(initialSelections);
             if (activeStudents.length === 0) {
                toast({ variant: 'info', title: 'No Students Found', description: `No active students found in this class for the ${fromAcademicYear} academic year.` });
            }
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load students for the selected class.' });
            setStudents([]);
        }
        setIsLoadingStudents(false);
    }, [fromClassId, fromAcademicYear, authUser, toast]);

    const { selectedIds, unselectedIds } = useMemo(() => {
        const studentIds = students.map(s => s._id!.toString());
        const selected = studentIds.filter(id => selectedStudents[id]);
        const unselected = studentIds.filter(id => !selectedStudents[id]);
        return { selectedIds: selected, unselectedIds: unselected };
    }, [students, selectedStudents]);


    const handlePromote = async () => {
        if (selectedIds.length === 0 || !authUser?.schoolId) {
            toast({ variant: "info", title: "No students selected", description: "Please select students to promote."});
            return;
        }
        if (!toClassId) {
            toast({ variant: "destructive", title: "Destination class not selected", description: "Please select a 'To' class."});
            return;
        }
        setIsPromoting(true);
        const result = await promoteStudents({
            schoolId: authUser.schoolId.toString(),
            toClassId: toClassId,
            studentIds: selectedIds,
            academicYear: toAcademicYear,
        });

        if (result.success) {
            toast({ title: "Promotion Successful", description: result.message });
            handleLoadStudents();
        } else {
            toast({ variant: "destructive", title: "Promotion Failed", description: result.error || result.message });
        }
        setIsPromoting(false);
    };

    const handleDiscontinue = async () => {
        if (unselectedIds.length === 0 || !authUser?.schoolId) {
            toast({ variant: "info", title: "No students to discontinue", description: "All students are selected for promotion."});
            return;
        }
        setIsDiscontinuing(true);
        const result = await discontinueStudents({
            schoolId: authUser.schoolId.toString(),
            studentIds: unselectedIds,
        });
        if (result.success) {
            toast({ title: "Update Successful", description: result.message });
            handleLoadStudents();
        } else {
             toast({ variant: "destructive", title: "Update Failed", description: result.error || result.message });
        }
        setIsDiscontinuing(false);
    };

    const handleSelectAll = (checked: boolean) => {
        const newSelections: Record<string, boolean> = {};
        students.forEach(s => {
            if(s._id) newSelections[s._id.toString()] = checked;
        });
        setSelectedStudents(newSelections);
    };

    const allSelected = useMemo(() => students.length > 0 && selectedIds.length === students.length, [students, selectedIds]);

    const filteredToClassOptions = useMemo(() => {
        if (!fromClassId) return classesInSchool;
        const fromClass = classesInSchool.find(c => c.value === fromClassId);
        if (!fromClass || !fromClass.name) return classesInSchool;

        const fromClassValue = getSortableClassValue(fromClass.name);
        return classesInSchool.filter(c => getSortableClassValue(c.name) > fromClassValue);
    }, [fromClassId, classesInSchool]);

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
            <GraduationCap className="mr-2 h-6 w-6" /> Student Promotion Module
          </CardTitle>
          <CardDescription>
            Promote students to the next class and manage academic year transitions for your assigned school.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>Promotion Setup</CardTitle>
              <CardDescription>Select the classes and academic years for the promotion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   <div>
                      <Label>From Academic Year</Label>
                      <Select onValueChange={setFromAcademicYear} value={fromAcademicYear} disabled={isLoadingOptions}>
                          <SelectTrigger><SelectValue placeholder="Select 'from' year"/></SelectTrigger>
                          <SelectContent>{academicYears.map(y => <SelectItem key={y._id} value={y.year}>{y.year}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
                  <div>
                      <Label>To Academic Year</Label>
                      <Select onValueChange={setToAcademicYear} value={toAcademicYear} disabled={isLoadingOptions}>
                          <SelectTrigger><SelectValue placeholder="Select 'to' year"/></SelectTrigger>
                          <SelectContent>{academicYears.map(y => <SelectItem key={y._id} value={y.year}>{y.year}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
                  <div/>
                  <div>
                      <Label>From Class</Label>
                      <Select onValueChange={(value) => { setFromClassId(value); setToClassId(""); }} value={fromClassId} disabled={isLoadingOptions}>
                          <SelectTrigger><SelectValue placeholder="Select 'from' class"/></SelectTrigger>
                          <SelectContent>{classesInSchool.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
                   <div>
                      <Label>To Class</Label>
                       <Select onValueChange={setToClassId} value={toClassId} disabled={isLoadingOptions || !fromClassId}>
                          <SelectTrigger><SelectValue placeholder={fromClassId ? "Select 'to' class" : "Select 'from' class first"}/></SelectTrigger>
                          <SelectContent>{filteredToClassOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
                  <div className="self-end">
                    <Button onClick={handleLoadStudents} disabled={!fromClassId || isLoadingStudents} className="w-full">
                        {isLoadingStudents ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Users className="mr-2 h-4 w-4"/>} Load Students
                    </Button>
                  </div>
              </div>
          </CardContent>
      </Card>

      {students.length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle>Students for Promotion</CardTitle>
                <CardDescription>
                    Select students to promote from "{classesInSchool.find(c => c.value === fromClassId)?.label}" to "{classesInSchool.find(c => c.value === toClassId)?.label || '...'}" for the {toAcademicYear} academic year.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12"><Checkbox onCheckedChange={(checked) => handleSelectAll(!!checked)} checked={allSelected} /></TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Admission ID</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.map(student => (
                            <TableRow key={student._id}>
                                <TableCell><Checkbox checked={!!selectedStudents[student._id!.toString()]} onCheckedChange={(checked) => setSelectedStudents(prev => ({...prev, [student._id!.toString()]: !!checked}))}/></TableCell>
                                <TableCell>{student.name}</TableCell>
                                <TableCell>{student.admissionId}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                        {selectedIds.length} of {students.length} student(s) selected.
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleDiscontinue} disabled={isDiscontinuing || unselectedIds.length === 0}>
                            {isDiscontinuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserX className="mr-2 h-4 w-4"/>} Discontinue Unselected ({unselectedIds.length})
                        </Button>
                        <Button onClick={handlePromote} disabled={isPromoting || !toClassId || selectedIds.length === 0}>
                            {isPromoting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserCheck className="mr-2 h-4 w-4"/>} Promote Selected ({selectedIds.length})
                        </Button>
                    </div>
                </div>
                {!toClassId && <p className="text-destructive text-sm text-right mt-2">Please select a "To" class to enable promotion.</p>}
            </CardContent>
        </Card>
      )}
    </div>
  );
}

    