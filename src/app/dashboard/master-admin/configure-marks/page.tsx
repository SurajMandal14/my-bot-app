
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Edit, Settings, Trash2, Loader2, Info, GraduationCap, SlidersHorizontal } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/user";
import { getSchoolClasses } from "@/app/actions/classes";
import { assessmentSchemeSchema, type AssessmentScheme, type AssessmentSchemeFormData, gradingPatternSchema, type GradingPattern, type GradingPatternFormData } from '@/types/assessment';
import { getAssessmentSchemeForClass, updateAssessmentScheme, getGradingPatterns, createGradingPattern, updateGradingPattern, deleteGradingPattern, assignGradingPatternToClass } from '@/app/actions/assessmentConfigurations';
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertDialogContentElement, AlertDialogDescription as AlertDialogDescriptionElement, AlertDialogHeader as AlertDialogHeaderElement, AlertDialogTitle as AlertDialogTitleElement, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { SchoolClass } from "@/types/classes";


interface ClassWithSchemeInfo extends SchoolClass {
    schemeStatus: string;
}

function AssessmentGroupTests({ control, groupIndex }: { control: Control<Omit<AssessmentSchemeFormData, 'schemeName'>>, groupIndex: number }) {
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

function GradePatternForm({ control }: { control: Control<GradingPatternFormData> }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "grades",
  });
  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <Card key={field.id} className="p-4 bg-muted/50">
          <div className="grid grid-cols-3 gap-2 items-end">
            <FormField control={control} name={`grades.${index}.label`} render={({ field }) => (<FormItem><FormLabel>Grade</FormLabel><FormControl><Input placeholder="A1" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name={`grades.${index}.minPercentage`} render={({ field }) => (<FormItem><FormLabel>Min %</FormLabel><FormControl><Input type="number" placeholder="91" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name={`grades.${index}.maxPercentage`} render={({ field }) => (<FormItem><FormLabel>Max %</FormLabel><FormControl><Input type="number" placeholder="100" {...field} /></FormControl><FormMessage /></FormItem>)}/>
          </div>
          <Button type="button" variant="link" size="sm" className="text-destructive h-auto p-1 mt-1" onClick={() => remove(index)}>Remove</Button>
        </Card>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => append({ label: '', minPercentage: 0, maxPercentage: 0 })}>
        <PlusCircle className="mr-2 h-4 w-4" /> Add Grade Row
      </Button>
    </div>
  )
}

export default function ConfigureMarksPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  
  const [allClasses, setAllClasses] = useState<SchoolClass[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingScheme, setIsSubmittingScheme] = useState(false);

  // State for scheme editing
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<AssessmentScheme | null>(null);
  const [currentClassLabel, setCurrentClassLabel] = useState<string>("");
  
  // State for Grading Patterns
  const [allGradingPatterns, setAllGradingPatterns] = useState<GradingPattern[]>([]);
  const [isGradingPatternModalOpen, setIsGradingPatternModalOpen] = useState(false);
  const [editingGradingPattern, setEditingGradingPattern] = useState<GradingPattern | null>(null);
  const [isSubmittingGradingPattern, setIsSubmittingGradingPattern] = useState(false);
  const [patternToDelete, setPatternToDelete] = useState<GradingPattern | null>(null);
  const [isDeletingPattern, setIsDeletingPattern] = useState(false);

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
      const [classesResult, academicYearsResult, gradingPatternsResult] = await Promise.all([
        getSchoolClasses(authUser.schoolId.toString()),
        getAcademicYears(),
        getGradingPatterns(authUser.schoolId.toString()),
      ]);
      
      if(classesResult.success && classesResult.classes) setAllClasses(classesResult.classes);
      
      if (academicYearsResult.success && academicYearsResult.academicYears) {
        setAcademicYears(academicYearsResult.academicYears);
        const defaultYear = academicYearsResult.academicYears.find(y => y.isDefault);
        if (defaultYear) setSelectedAcademicYear(defaultYear.year);
        else if (academicYearsResult.academicYears.length > 0) setSelectedAcademicYear(academicYearsResult.academicYears[0].year);
      }
      
      if(gradingPatternsResult.success && gradingPatternsResult.patterns) setAllGradingPatterns(gradingPatternsResult.patterns);

    } catch (error) {
      toast({variant: 'destructive', title: 'Error', description: 'Failed to fetch initial configuration data.'})
    } finally {
      setIsLoading(false);
    }
  }, [authUser, toast]);

  useEffect(() => { if (authUser) fetchData(); }, [authUser, fetchData]);

  const classesForSelectedYear = useMemo(() => {
    if (!selectedAcademicYear) return [];
    
    const classMap = new Map<string, { sections: string[]; representativeClassId: string; gradingPatternId: string | null; gradingPatternName: string | undefined }>();

    allClasses
        .filter(c => c.academicYear === selectedAcademicYear)
        .forEach(c => {
            const className = c.name || "Unnamed Class";
            if(!classMap.has(className)) {
                classMap.set(className, { sections: [], representativeClassId: c._id, gradingPatternId: c.gradingPatternId || null, gradingPatternName: c.gradingPatternName });
            }
            if (c.section) {
              classMap.get(className)!.sections.push(c.section);
            }
        });

    return Array.from(classMap.entries()).map(([name, data]) => ({
      name,
      ...data,
      sections: data.sections.join(', '),
    }));
  }, [allClasses, selectedAcademicYear]);


  // --- Assessment Scheme Logic ---
  const assessmentForm = useForm<Omit<AssessmentSchemeFormData, 'schemeName'>>({
    resolver: zodResolver(assessmentSchemeSchema),
  });

  const { fields: assessmentGroups, append: appendAssessmentGroup, remove: removeAssessmentGroup } = useFieldArray({
    control: assessmentForm.control, name: "assessments",
  });

  const handleOpenSchemeDialog = async (representativeClassId: string, className: string) => {
    if (!authUser?.schoolId) return;
    const result = await getAssessmentSchemeForClass(representativeClassId, authUser.schoolId, selectedAcademicYear, className);
    if(result.success && result.scheme) {
      setEditingScheme(result.scheme);
      setCurrentClassLabel(className);
      assessmentForm.reset({ assessments: result.scheme.assessments });
      setIsSchemeModalOpen(true);
    } else {
      toast({variant: 'destructive', title: 'Error', description: result.message || 'Could not load scheme for this class.'});
    }
  };
  
  async function onAssessmentSubmit(data: Omit<AssessmentSchemeFormData, 'schemeName'>) {
    if (!authUser?.schoolId || !editingScheme) return;
    setIsSubmittingScheme(true);
    const result = await updateAssessmentScheme(editingScheme._id.toString(), authUser.schoolId.toString(), data);
    if (result.success) {
      toast({ title: "Scheme Updated", description: result.message });
      setIsSchemeModalOpen(false); setEditingScheme(null);
    } else {
      toast({ variant: 'destructive', title: 'Update Failed', description: result.error || result.message });
    }
    setIsSubmittingScheme(false);
  }

  // --- Grading Pattern Logic ---
  const gradingPatternForm = useForm<GradingPatternFormData>({
    resolver: zodResolver(gradingPatternSchema),
    defaultValues: { patternName: "", grades: [{ label: "A", minPercentage: 91, maxPercentage: 100 }] }
  });
  
  const handleOpenGradingPatternDialog = (pattern: GradingPattern | null) => {
    setEditingGradingPattern(pattern);
    if (pattern) {
      gradingPatternForm.reset(pattern);
    } else {
      gradingPatternForm.reset({ patternName: "", grades: [{ label: "A", minPercentage: 91, maxPercentage: 100 }] });
    }
    setIsGradingPatternModalOpen(true);
  };
  
  async function onGradingPatternSubmit(data: GradingPatternFormData) {
    if (!authUser?.schoolId || !authUser._id) return;
    setIsSubmittingGradingPattern(true);
    const result = editingGradingPattern 
      ? await updateGradingPattern(editingGradingPattern._id.toString(), data, authUser.schoolId)
      : await createGradingPattern(data, authUser._id, authUser.schoolId);
      
    if (result.success) {
      toast({ title: result.message });
      fetchData();
      setIsGradingPatternModalOpen(false);
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.message });
    }
    setIsSubmittingGradingPattern(false);
  }
  
  const onDeleteGradingPattern = async () => {
    if (!patternToDelete || !authUser?.schoolId) return;
    setIsDeletingPattern(true);
    const result = await deleteGradingPattern(patternToDelete._id.toString(), authUser.schoolId);
    if (result.success) {
      toast({ title: result.message });
      fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Deletion Failed', description: result.message });
    }
    setIsDeletingPattern(false);
    setPatternToDelete(null);
  };
  
  const handleAssignPattern = async (classId: string, patternId: string) => {
      if(!authUser?.schoolId) return;
      const result = await assignGradingPatternToClass(classId, patternId === "none" ? null : patternId, authUser.schoolId);
      if(result.success) {
          toast({ title: "Assignment updated." });
          fetchData(); // Re-fetch to update the UI with new pattern name
      } else {
          toast({ variant: 'destructive', title: "Assignment Failed", description: result.message });
      }
  }
  
  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><Settings className="mr-2 h-6 w-6" />Configure Report Card</CardTitle><CardDescription>Set up assessment schemes and grading patterns for each class.</CardDescription></CardHeader></Card>

    <Tabs defaultValue="schemes">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schemes"><GraduationCap className="mr-2 h-4 w-4"/>Assessment Schemes</TabsTrigger>
            <TabsTrigger value="patterns"><SlidersHorizontal className="mr-2 h-4 w-4"/>Grading Patterns</TabsTrigger>
        </TabsList>
        <TabsContent value="schemes">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle>Class Scheme Assignments</CardTitle>
                  <CardDescription>Each class has an independent assessment scheme. Edit the scheme for a class from this table.</CardDescription>
                </div>
                <div className="flex w-full sm:w-auto items-center gap-2">
                      <Select onValueChange={setSelectedAcademicYear} value={selectedAcademicYear} disabled={isLoading}>
                        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Year" /></SelectTrigger>
                        <SelectContent>{academicYears.map(year => <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>)}</SelectContent>
                      </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                classesForSelectedYear.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Sections</TableHead>
                        <TableHead>Grading Pattern</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{classesForSelectedYear.map((item) => (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.sections}</TableCell>
                          <TableCell>
                            <Select 
                                value={item.gradingPatternId || "none"}
                                onValueChange={(patternId) => handleAssignPattern(item.representativeClassId, patternId)}
                            >
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select Pattern"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Not Assigned --</SelectItem>
                                    {allGradingPatterns.map(p => <SelectItem key={p._id} value={p._id}>{p.patternName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => handleOpenSchemeDialog(item.representativeClassId, item.name)}>
                                  <Edit className="mr-2 h-4 w-4"/> Edit Scheme
                              </Button>
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
                        <CardTitle>Grading Pattern Library</CardTitle>
                        <CardDescription>Create and manage reusable grading patterns for your school.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenGradingPatternDialog(null)}><PlusCircle className="mr-2 h-4 w-4"/>Create New Pattern</Button>
                </CardHeader>
                <CardContent>
                     {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                     allGradingPatterns.length > 0 ? (
                        <Table><TableHeader><TableRow><TableHead>Pattern Name</TableHead><TableHead>Grades</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {allGradingPatterns.map(pattern => (
                                <TableRow key={pattern._id}>
                                    <TableCell className="font-medium">{pattern.patternName}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{pattern.grades.map(g => `${g.label} (${g.minPercentage}-${g.maxPercentage}%)`).join(', ')}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenGradingPatternDialog(pattern)}><Edit className="h-4 w-4"/></Button>
                                        <AlertDialog open={patternToDelete?._id === pattern._id} onOpenChange={(open) => !open && setPatternToDelete(null)}>
                                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                          <AlertDialogContentElement>
                                            <AlertDialogHeaderElement><AlertDialogTitleElement>Delete "{pattern.patternName}"?</AlertDialogTitleElement><AlertDialogDescriptionElement>This action cannot be undone. You cannot delete patterns currently assigned to classes.</AlertDialogDescriptionElement></AlertDialogHeaderElement>
                                            <AlertDialogFooter><AlertDialogCancel onClick={() => setPatternToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={onDeleteGradingPattern} disabled={isDeletingPattern}>Delete</AlertDialogAction></AlertDialogFooter>
                                          </AlertDialogContentElement>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                     ) : <p className="text-center text-muted-foreground py-4">No grading patterns created yet.</p>}
                </CardContent>
            </Card>
        </TabsContent>
    </Tabs>

     <Dialog open={isSchemeModalOpen} onOpenChange={(isOpen) => { if(!isOpen) setEditingScheme(null); setIsSchemeModalOpen(isOpen);}}>
      <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{editingScheme ? `Edit Scheme for ${currentClassLabel}` : 'Edit Assessment Scheme'}</DialogTitle><DialogDescription>Define assessments and their tests. Changes will apply to this class.</DialogDescription></DialogHeader>
        <Form {...assessmentForm}>
          <form onSubmit={assessmentForm.handleSubmit(onAssessmentSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
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
                    Save Scheme
                </Button>
              </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    
    <Dialog open={isGradingPatternModalOpen} onOpenChange={setIsGradingPatternModalOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingGradingPattern ? 'Edit' : 'Create'} Grading Pattern</DialogTitle></DialogHeader>
            <Form {...gradingPatternForm}>
                <form onSubmit={gradingPatternForm.handleSubmit(onGradingPatternSubmit)} className="space-y-4">
                     <FormField control={gradingPatternForm.control} name="patternName" render={({ field }) => (<FormItem><FormLabel>Pattern Name</FormLabel><FormControl><Input placeholder="e.g., Primary Scale" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                     <GradePatternForm control={gradingPatternForm.control}/>
                     <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsGradingPatternModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmittingGradingPattern}>{isSubmittingGradingPattern ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Pattern'}</Button>
                     </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </div>
  );
}

    