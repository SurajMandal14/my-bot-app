
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Edit, Settings, Trash2, Loader2, Palette, XCircle, Info, Star } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/user";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { cn } from "@/lib/utils";
import { assessmentSchemeSchema, type AssessmentScheme, type AssessmentSchemeFormData, gradingPatternSchema, type GradingPattern, type GradingPatternFormData } from '@/types/assessment';
import { getAssessmentSchemes, updateAssessmentScheme, createGradingPattern, getGradingPatterns, updateGradingPattern, deleteGradingPattern, assignSchemeToClasses } from '@/app/actions/assessmentConfigurations';
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";


interface ClassOption {
  value: string; 
  label: string; 
  academicYear: string;
}

interface ClassWithScheme {
  classId: string;
  className: string;
  academicYear: string;
  isAssigned: boolean;
}

function AssessmentGroupTests({ control, groupIndex }: { control: Control<AssessmentSchemeFormData>, groupIndex: number }) {
  const { fields: testFields, append: appendTest, remove: removeTest } = useFieldArray({
    control: control,
    name: `assessments.${groupIndex}.tests`,
  });

  return (
    <div className="pl-4 border-l-2 space-y-2">
      {testFields.map((test, testIndex) => (
        <div key={test.id} className="flex items-end gap-2">
          <FormField control={control} name={`assessments.${groupIndex}.tests.${testIndex}.testName`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Test Name</FormLabel><FormControl><Input placeholder="e.g., Tool 1" {...field} /></FormControl><FormMessage /></FormItem>)}/>
          <FormField control={control} name={`assessments.${groupIndex}.tests.${testIndex}.maxMarks`} render={({ field }) => (<FormItem><FormLabel>Max Marks</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>)}/>
          <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeTest(testIndex)} disabled={testFields.length <= 1}><Trash2 className="h-4 w-4"/></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => appendTest({ testName: "", maxMarks: 10 })}>
        <PlusCircle className="mr-2 h-4 w-4"/> Add Test
      </Button>
    </div>
  );
}

export default function ConfigureMarksPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  
  const [allClassOptions, setAllClassOptions] = useState<ClassOption[]>([]);
  const [defaultScheme, setDefaultScheme] = useState<AssessmentScheme | null>(null);
  const [gradingPatterns, setGradingPatterns] = useState<GradingPattern[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingScheme, setIsSubmittingScheme] = useState(false);
  const [isSubmittingPattern, setIsSubmittingPattern] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const [isSchemeFormOpen, setIsSchemeFormOpen] = useState(false);
  
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<GradingPattern | null>(null);
  const [patternToDelete, setPatternToDelete] = useState<GradingPattern | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<Record<string, boolean>>({});

  const classesWithSchemes = useMemo((): ClassWithScheme[] => {
    const yearClasses = allClassOptions.filter(c => c.academicYear === selectedAcademicYear);
    return yearClasses.map(cls => ({
      classId: cls.value,
      className: cls.label,
      academicYear: cls.academicYear,
      isAssigned: defaultScheme?.classIds.includes(cls.value) ?? false,
    }));
  }, [allClassOptions, defaultScheme, selectedAcademicYear]);
  
  const allInYearSelected = useMemo(() => {
    const yearClasses = classesWithSchemes;
    if (yearClasses.length === 0) return false;
    return yearClasses.every(c => selectedClasses[c.classId]);
  }, [selectedClasses, classesWithSchemes]);


  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined") {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        if (parsedUser.role === 'masteradmin' && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        }
      } catch (e) { console.error(e); }
    }
  }, []);
  
  const fetchData = useCallback(async () => {
    if (!authUser?.schoolId) return;
    setIsLoading(true);
    try {
      const [classesResult, schemesResult, patternsResult, academicYearsResult] = await Promise.all([
        getClassesForSchoolAsOptions(authUser.schoolId.toString()),
        getAssessmentSchemes(authUser.schoolId.toString()),
        getGradingPatterns(authUser.schoolId.toString()),
        getAcademicYears(),
      ]);
      
      setAllClassOptions(classesResult);
      
      if(schemesResult.success && schemesResult.schemes && schemesResult.schemes[0]) {
        setDefaultScheme(schemesResult.schemes[0]);
      } else {
        toast({variant: 'warning', title: 'Could not load the default scheme', description: schemesResult.message});
      }
      
      if(patternsResult.success && patternsResult.patterns) {
        setGradingPatterns(patternsResult.patterns);
      } else {
        toast({variant: 'warning', title: 'Could not load patterns', description: patternsResult.message});
      }

      if (academicYearsResult.success && academicYearsResult.academicYears) {
        setAcademicYears(academicYearsResult.academicYears);
        const defaultYear = academicYearsResult.academicYears.find(y => y.isDefault);
        if (defaultYear) setSelectedAcademicYear(defaultYear.year);
        else if (academicYearsResult.academicYears.length > 0) setSelectedAcademicYear(academicYearsResult.academicYears[0].year);
      }
    } catch (error) {
      toast({variant: 'destructive', title: 'Error', description: 'Failed to fetch initial configuration data.'})
    } finally {
      setIsLoading(false);
    }
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser) fetchData();
  }, [authUser, fetchData]);
  
  useEffect(() => {
    setSelectedClasses({});
  }, [selectedAcademicYear]);


  const assessmentForm = useForm<AssessmentSchemeFormData>({
    resolver: zodResolver(assessmentSchemeSchema),
  });

  const { fields: assessmentGroups, append: appendAssessmentGroup, remove: removeAssessmentGroup } = useFieldArray({
    control: assessmentForm.control, name: "assessments",
  });

  const handleOpenSchemeDialog = () => {
    if (defaultScheme) {
        assessmentForm.reset({
            schemeName: defaultScheme.schemeName,
            assessments: defaultScheme.assessments,
        });
    } else {
        assessmentForm.reset({ schemeName: "", assessments: [] });
    }
    setIsSchemeFormOpen(true);
  };
  
  async function onAssessmentSubmit(data: AssessmentSchemeFormData) {
    if (!authUser?.schoolId) return;
    setIsSubmittingScheme(true);
    
    const result = await updateAssessmentScheme(authUser.schoolId.toString(), data);

    if (result.success) {
      toast({ title: "Default Scheme Updated", description: result.message });
      fetchData();
      setIsSchemeFormOpen(false);
    } else {
      toast({ variant: 'destructive', title: 'Update Failed', description: result.error || result.message });
    }
    setIsSubmittingScheme(false);
  }
  
  const handleAssignmentAction = async (assign: boolean) => {
      const classIdsToUpdate = Object.keys(selectedClasses).filter(id => selectedClasses[id]);
      if (classIdsToUpdate.length === 0) {
          toast({variant: 'info', title: 'No Classes Selected', description: 'Please select classes from the table first.'});
          return;
      }
      if (!authUser?.schoolId) return;

      setIsAssigning(true);
      const result = await assignSchemeToClasses(classIdsToUpdate, authUser.schoolId, assign);
      if(result.success) {
        toast({ title: 'Assignment Updated', description: result.message });
        fetchData();
        setSelectedClasses({});
      } else {
        toast({ variant: 'destructive', title: 'Assignment Failed', description: result.message });
      }
      setIsAssigning(false);
  };
  
  const gradingForm = useForm<GradingPatternFormData>({
    resolver: zodResolver(gradingPatternSchema),
    defaultValues: { patternName: "", grades: [{ label: "A1", minPercentage: 91, maxPercentage: 100 }] },
  });

  const { fields: gradeFields, append: appendGrade, remove: removeGrade } = useFieldArray({
    control: gradingForm.control, name: "grades"
  });
  const watchedGrades = gradingForm.watch("grades");

  const handleEditPattern = (pattern: GradingPattern) => {
    setEditingPattern(pattern);
    gradingForm.reset({ patternName: pattern.patternName, grades: pattern.grades });
    setIsPatternModalOpen(true);
  };
  
  async function onGradingSubmit(data: GradingPatternFormData) {
    if (!authUser?._id || !authUser?.schoolId) return;
    setIsSubmittingPattern(true);

    const result = editingPattern
      ? await updateGradingPattern(editingPattern._id.toString(), data, authUser.schoolId.toString())
      : await createGradingPattern(data, authUser._id.toString(), authUser.schoolId.toString());
    
    if(result.success) {
      toast({title: editingPattern ? 'Pattern Updated' : 'Pattern Created', description: result.message});
      fetchData();
      setIsPatternModalOpen(false);
      setEditingPattern(null);
      gradingForm.reset();
    } else {
      toast({variant: 'destructive', title: 'Submission Failed', description: result.error || result.message});
    }
    setIsSubmittingPattern(false);
  }
  
  async function onDeletePattern() {
    if(!patternToDelete || !authUser?.schoolId) return;
    setIsDeleting(patternToDelete._id.toString());
    const result = await deleteGradingPattern(patternToDelete._id.toString(), authUser.schoolId.toString());
     if(result.success) {
      toast({title: 'Pattern Deleted', description: result.message});
      fetchData();
    } else {
      toast({variant: 'destructive', title: 'Deletion Failed', description: result.message});
    }
    setPatternToDelete(null);
    setIsDeleting(null);
  }
  
  const PREVIEW_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><Settings className="mr-2 h-6 w-6" />Configure Report Card</CardTitle><CardDescription>Set up assessment schemes, grading patterns, and other report card configurations for your school.</CardDescription></CardHeader></Card>

    <Tabs defaultValue="schemes">
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="schemes">Assessment Schemes</TabsTrigger><TabsTrigger value="patterns">Grading Patterns</TabsTrigger></TabsList>
        <TabsContent value="schemes" className="space-y-6">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle>Default Assessment Scheme</CardTitle>
                    <CardDescription>Edit the single default assessment scheme for your school. Assign or unassign it to classes below.</CardDescription>
                  </div>
                  <Button onClick={handleOpenSchemeDialog}><Edit className="mr-2 h-4 w-4"/> Edit Default Scheme</Button>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle>Class Scheme Assignments</CardTitle>
                    <CardDescription>Apply the default scheme to classes for the selected academic year.</CardDescription>
                  </div>
                  <div className="flex w-full sm:w-auto items-center gap-2">
                        <Select onValueChange={setSelectedAcademicYear} value={selectedAcademicYear} disabled={isLoading}>
                          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Year" /></SelectTrigger>
                          <SelectContent>{academicYears.map(year => <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>)}</SelectContent>
                        </Select>
                  </div>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end gap-2 mb-4">
                         <Button onClick={() => handleAssignmentAction(true)} disabled={isAssigning} variant="outline">
                             {isAssigning ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Assign to Selected'}
                        </Button>
                        <Button onClick={() => handleAssignmentAction(false)} disabled={isAssigning} variant="destructive">
                            {isAssigning ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Unassign from Selected'}
                        </Button>
                    </div>
                  {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                  classesWithSchemes.length > 0 ? (
                    <Table>
                      <TableHeader><TableRow>
                          <TableHead className="w-12"><Checkbox checked={allInYearSelected} onCheckedChange={(checked) => {
                              const newSelected: Record<string, boolean> = {};
                              if(checked) { classesWithSchemes.forEach(c => newSelected[c.classId] = true); }
                              setSelectedClasses(newSelected);
                          }}/></TableHead>
                          <TableHead>Class</TableHead><TableHead>Scheme Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>{classesWithSchemes.map((item) => (
                          <TableRow key={item.classId} data-state={selectedClasses[item.classId] ? "selected" : ""}>
                            <TableCell><Checkbox checked={selectedClasses[item.classId] || false} onCheckedChange={(checked) => setSelectedClasses(prev => ({...prev, [item.classId]: !!checked}))} /></TableCell>
                            <TableCell className="font-medium">{item.className}</TableCell>
                            <TableCell>
                                {item.isAssigned ? <span className="text-green-600 font-semibold flex items-center gap-1"><Star className="h-4 w-4"/>Assigned</span> : <span className="text-muted-foreground">Not Assigned</span>}
                            </TableCell>
                          </TableRow>
                        ))}</TableBody>
                    </Table>
                  ) : (<div className="text-center py-6"><Info className="h-10 w-10 mx-auto text-muted-foreground mb-2"/><p className="text-muted-foreground">No classes found for the {selectedAcademicYear} academic year.</p></div>)}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="patterns">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5"/>Grading Patterns</CardTitle>
                    <CardDescription>Manage reusable grading patterns for your school.</CardDescription>
                  </div>
                  <Button onClick={() => { setEditingPattern(null); gradingForm.reset(); setIsPatternModalOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Create New Pattern
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                  gradingPatterns.length > 0 ? (
                     <Table>
                      <TableHeader><TableRow><TableHead>Pattern Name</TableHead><TableHead>Grades</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>{gradingPatterns.map((pattern) => (
                          <TableRow key={pattern._id.toString()}>
                            <TableCell className="font-medium">{pattern.patternName}</TableCell>
                            <TableCell>{pattern.grades.map(g => g.label).join(', ')}</TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEditPattern(pattern)} disabled={!!isDeleting}><Edit className="h-4 w-4" /></Button>
                              <AlertDialog open={patternToDelete?._id === pattern._id} onOpenChange={(open) => !open && setPatternToDelete(null)}>
                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Pattern?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete the pattern "{pattern.patternName}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onDeletePattern} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}</TableBody>
                    </Table>
                  ) : (<p className="text-center text-muted-foreground py-4">No grading patterns created yet.</p>)}
                </CardContent>
            </Card>
        </TabsContent>
    </Tabs>

     <Dialog open={isSchemeFormOpen} onOpenChange={setIsSchemeFormOpen}>
      <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Edit Default Assessment Scheme</DialogTitle><DialogDescription>Define assessments and their tests. Changes will apply to all classes assigned this scheme.</DialogDescription></DialogHeader>
        <Form {...assessmentForm}>
          <form onSubmit={assessmentForm.handleSubmit(onAssessmentSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
              <FormField control={assessmentForm.control} name="schemeName" render={({ field }) => (<FormItem><FormLabel>Scheme Name</FormLabel><FormControl><Input placeholder="e.g., Primary Wing Scheme, CBSE Standard" {...field}/></FormControl><FormMessage/></FormItem>)}/>
              <div><FormLabel>Assessments</FormLabel>
                <div className="mt-2 space-y-4">{assessmentGroups.map((group, groupIndex) => (
                      <Card key={group.id} className="p-4 bg-muted/50">
                        <div className="flex items-end gap-3 mb-3">
                          <FormField control={assessmentForm.control} name={`assessments.${groupIndex}.groupName`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Assessment Name (e.g., FA1)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                          <Button type="button" variant="destructive" size="icon" onClick={() => removeAssessmentGroup(groupIndex)} disabled={assessmentGroups.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <AssessmentGroupTests control={assessmentForm.control} groupIndex={groupIndex} />
                      </Card>))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => appendAssessmentGroup({ groupName: "", tests: [{ testName: "", maxMarks: 10 }] })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Assessment Group
                </Button>
              </div>
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingScheme}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmittingScheme}>
                    {isSubmittingScheme && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Save Default Scheme
                </Button>
              </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

     <Dialog open={isPatternModalOpen} onOpenChange={(isOpen) => { if(!isOpen) setEditingPattern(null); setIsPatternModalOpen(isOpen); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{editingPattern ? 'Edit Grading Pattern' : 'Create New Grading Pattern'}</DialogTitle><DialogDescription>Define grade labels and their corresponding percentage ranges.</DialogDescription></DialogHeader>
          <Form {...gradingForm}>
              <form onSubmit={gradingForm.handleSubmit(onGradingSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
                  <div className="lg:col-span-2 space-y-6">
                      <FormField control={gradingForm.control} name="patternName" render={({ field }) => (<FormItem><FormLabel>Grading Pattern Name</FormLabel><FormControl><Input placeholder="e.g., CBSE 9-10 Scheme" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <div>
                          <FormLabel>Grade Rows</FormLabel>
                          <div className="mt-2 space-y-3 max-h-[40vh] overflow-y-auto pr-2">{gradeFields.map((item, index) => (<div key={item.id} className="flex items-end gap-3 p-3 border rounded-lg"><FormField control={gradingForm.control} name={`grades.${index}.label`} render={({field}) => (<FormItem><FormLabel>Grade</FormLabel><FormControl><Input placeholder="A1" {...field}/></FormControl><FormMessage/></FormItem>)}/> <FormField control={gradingForm.control} name={`grades.${index}.minPercentage`} render={({field}) => (<FormItem><FormLabel>Min %</FormLabel><FormControl><Input type="number" placeholder="91" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}/></FormControl><FormMessage/></FormItem>)}/> <FormField control={gradingForm.control} name={`grades.${index}.maxPercentage`} render={({field}) => (<FormItem><FormLabel>Max %</FormLabel><FormControl><Input type="number" placeholder="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}/></FormControl><FormMessage/></FormItem>)}/> <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeGrade(index)} disabled={gradeFields.length <= 1}><Trash2 className="h-4 w-4"/></Button></div>))}</div>
                          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => appendGrade({ label: "", minPercentage: 0, maxPercentage: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Add Grade Row</Button>
                      </div>
                  </div>
                  <div className="lg:col-span-1"><h4 className="font-semibold mb-2">Live Preview</h4><Card className="p-4 space-y-2"><p className="text-sm font-medium">{gradingForm.watch('patternName') || "Your Pattern Name"}</p><div className="w-full flex h-8 rounded-full overflow-hidden border">{watchedGrades.map((grade, index) => {const width = Math.max(0, (grade.maxPercentage || 0) - (grade.minPercentage || 0)); if (width === 0) return null; return (<div key={index} title={`${grade.label}: ${grade.minPercentage}% - ${grade.maxPercentage}%`} className={cn("flex items-center justify-center text-white text-xs font-bold", PREVIEW_COLORS[index % PREVIEW_COLORS.length])} style={{ width: `${width}%` }}>{width > 5 && grade.label}</div>)})}</div><ul className="text-xs space-y-1 mt-2">{watchedGrades.map((grade, index) => (<li key={index} className="flex items-center"><span className={cn("w-3 h-3 rounded-sm mr-2", PREVIEW_COLORS[index % PREVIEW_COLORS.length])}></span><span className="font-bold w-10">{grade.label || "N/A"}:</span><span>{grade.minPercentage || 0}% to {grade.maxPercentage || 0}%</span></li>))}</ul></Card></div>
                  <DialogFooter className="lg:col-span-3"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmittingPattern}>{isSubmittingPattern && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Pattern</Button></DialogFooter>
              </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
