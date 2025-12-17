
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusCircle, Edit, Settings, Trash2, Loader2, Info, GraduationCap, SlidersHorizontal } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/user";
import { getSchoolClasses } from "@/app/actions/classes";
import { assessmentSchemeSchema, type AssessmentScheme, type AssessmentSchemeFormData, gradingPatternSchema, type GradingPatternFormData, defaultGrades } from '@/types/assessment';
import { getAssessmentSchemeForClass, updateAssessmentScheme, updateGradingForClass } from '@/app/actions/assessmentConfigurations';
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SchoolClass } from "@/types/classes";


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
          <FormField control={control} name={`assessments.${groupIndex}.tests.${testIndex}.maxMarks`} render={({ field }) => (<FormItem><FormLabel>Max Marks</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>)}/>
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
            <FormField control={control} name={`grades.${index}.minPercentage`} render={({ field }) => (<FormItem><FormLabel>Min %</FormLabel><FormControl><Input type="number" placeholder="91" {...field} onChange={e => field.onChange(Number(e.target.value))}/></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name={`grades.${index}.maxPercentage`} render={({ field }) => (<FormItem><FormLabel>Max %</FormLabel><FormControl><Input type="number" placeholder="100" {...field} onChange={e => field.onChange(Number(e.target.value))}/></FormControl><FormMessage /></FormItem>)}/>
          </div>
           {fields.length > 1 && <Button type="button" variant="link" size="sm" className="text-destructive h-auto p-1 mt-1" onClick={() => remove(index)}>Remove</Button>}
        </Card>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => append({ label: '', minPercentage: 0, maxPercentage: 0 })}>
        <PlusCircle className="mr-2 h-4 w-4" /> Add Grade Row
      </Button>
    </div>
  )
}

interface GroupedClass {
    name: string;
    sections: string[];
    representativeClassId: string;
    originalClass: SchoolClass;
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
  const [schemeTab, setSchemeTab] = useState<'formative' | 'summative'>('formative');
  
  // State for Grading Patterns
  const [isGradingPatternModalOpen, setIsGradingPatternModalOpen] = useState(false);
  const [editingClassForGrading, setEditingClassForGrading] = useState<SchoolClass | null>(null);
  const [isSubmittingGradingPattern, setIsSubmittingGradingPattern] = useState(false);
  
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
      const [classesResult, academicYearsResult] = await Promise.all([
        getSchoolClasses(authUser.schoolId.toString()),
        getAcademicYears(),
      ]);
      
      if(classesResult.success && classesResult.classes) setAllClasses(classesResult.classes);
      
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

  useEffect(() => { if (authUser) fetchData(); }, [authUser, fetchData]);

  const groupedClassesForYear = useMemo(() => {
    if (!selectedAcademicYear) return [];
    
    const classMap = new Map<string, { sections: string[], representativeClassId: string, originalClass: SchoolClass }>();

    allClasses
        .filter(c => c.academicYear === selectedAcademicYear)
        .forEach(c => {
            if (!classMap.has(c.name)) {
                classMap.set(c.name, { sections: [], representativeClassId: c._id, originalClass: c });
            }
            if (c.section) {
                classMap.get(c.name)!.sections.push(c.section);
            }
        });

    return Array.from(classMap.entries()).map(([name, data]) => ({
      name,
      sections: data.sections.sort(),
      representativeClassId: data.representativeClassId,
      originalClass: data.originalClass,
    }));

  }, [allClasses, selectedAcademicYear]);


  // --- Assessment Scheme Logic ---
  const assessmentForm = useForm<AssessmentSchemeFormData>({
    resolver: zodResolver(assessmentSchemeSchema),
  });

  const { fields: assessmentGroups, append: appendAssessmentGroup, remove: removeAssessmentGroup } = useFieldArray({
    control: assessmentForm.control, name: "assessments",
  });

  const handleOpenSchemeDialog = async (groupedClass: GroupedClass) => {
    if (!authUser?.schoolId) return;
    const result = await getAssessmentSchemeForClass(groupedClass.name, authUser.schoolId.toString(), selectedAcademicYear);
    if(result.success && result.scheme) {
      setEditingScheme(result.scheme);
      setCurrentClassLabel(groupedClass.name);
      assessmentForm.reset({ assessments: result.scheme.assessments });
      setIsSchemeModalOpen(true);
    } else {
      toast({variant: 'destructive', title: 'Error', description: result.message || 'Could not load scheme for this class.'});
    }
  };
  
  async function onAssessmentSubmit(data: AssessmentSchemeFormData) {
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
  });
  
  const handleOpenGradingDialog = (groupedClass: GroupedClass) => {
    const classItem = groupedClass.originalClass;
    setEditingClassForGrading(classItem);
    const initialValues = classItem.gradingPattern || { patternName: `${classItem.name} Pattern`, grades: defaultGrades };
    gradingPatternForm.reset(initialValues);
    setIsGradingPatternModalOpen(true);
  };
  
  async function onGradingPatternSubmit(data: GradingPatternFormData) {
    if (!authUser?.schoolId || !editingClassForGrading?._id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot save grading pattern. User or class information is missing.' });
      return;
    }
    setIsSubmittingGradingPattern(true);
    const result = await updateGradingForClass(editingClassForGrading._id.toString(), authUser.schoolId.toString(), data);
      
    if (result.success) {
      toast({ title: "Grading Updated", description: result.message });
      fetchData(); // Refetch all data to update the class list
      setIsGradingPatternModalOpen(false);
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error || result.message });
    }
    setIsSubmittingGradingPattern(false);
  }

  
  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><Settings className="mr-2 h-6 w-6" />Configure Report Card</CardTitle><CardDescription>Set up assessment schemes and grading patterns for each class.</CardDescription></CardHeader></Card>
    
      <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Class Configurations</CardTitle>
              <CardDescription>Each class has its own editable scheme and grading pattern, which applies to all sections.</CardDescription>
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
            groupedClassesForYear.length > 0 ? (
              <Table>
                <TableHeader><TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Sections</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>{groupedClassesForYear.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sections.join(', ')}</TableCell>
                      <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenSchemeDialog(item)}>
                              <GraduationCap className="mr-2 h-4 w-4"/> Edit Scheme
                          </Button>
                           <Button variant="outline" size="sm" onClick={() => handleOpenGradingDialog(item)}>
                              <SlidersHorizontal className="mr-2 h-4 w-4"/> Edit Grades
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}</TableBody>
              </Table>
            ) : (<div className="text-center py-6"><Info className="h-10 w-10 mx-auto text-muted-foreground mb-2"/><p className="text-muted-foreground">No classes found for the {selectedAcademicYear} academic year.</p></div>)}
          </CardContent>
      </Card>
      
     <Dialog open={isSchemeModalOpen} onOpenChange={(isOpen) => { if(!isOpen) setEditingScheme(null); setIsSchemeModalOpen(isOpen);}}>
      <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{editingScheme ? `Edit Scheme for Class ${currentClassLabel}` : 'Edit Assessment Scheme'}</DialogTitle><DialogDescription>Define assessments and their tests. Changes will apply to all sections of this class.</DialogDescription></DialogHeader>
        <Form {...assessmentForm}>
          <form onSubmit={assessmentForm.handleSubmit(onAssessmentSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
              <div>
                {/* Tabs to separate Formative vs Summative */}
                <Tabs value={schemeTab} onValueChange={(val) => setSchemeTab(val as 'formative' | 'summative')}>
                  <TabsList className="mb-3">
                    <TabsTrigger value="formative">Formative (FA)</TabsTrigger>
                    <TabsTrigger value="summative">Summative (SA)</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="mt-2 space-y-4">{assessmentGroups
                    .filter((g, idx) => (assessmentForm.getValues(`assessments.${idx}.type`) ?? 'formative') === schemeTab)
                    .map((group) => {
                      const originalIndex = assessmentGroups.findIndex(ag => ag.id === group.id);
                      return (
                      <Card key={group.id} className="p-4 bg-muted/50">
                        <div className="flex items-end gap-3 mb-3">
                          <FormField control={assessmentForm.control} name={`assessments.${originalIndex}.groupName`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Assessment Name (e.g., FA1)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                          <FormField control={assessmentForm.control} name={`assessments.${originalIndex}.type`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <FormControl>
                                <Select value={field.value ?? 'formative'} onValueChange={field.onChange}>
                                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Select type" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="formative">Formative</SelectItem>
                                    <SelectItem value="summative">Summative</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}/>
                          <Button type="button" variant="destructive" size="icon" onClick={() => removeAssessmentGroup(originalIndex)} disabled={assessmentGroups.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                         <AssessmentGroupTests control={assessmentForm.control} groupIndex={originalIndex} />
                       </Card>
                      );
                    })}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => appendAssessmentGroup({ groupName: "", type: schemeTab, tests: [{ testName: "", maxMarks: 10 }] })}>
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
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Grading for {editingClassForGrading?.name}</DialogTitle>
              <DialogDescription>Set the grade labels and percentage ranges for this specific class. This will apply to all sections.</DialogDescription>
            </DialogHeader>
            <Form {...gradingPatternForm}>
                <form onSubmit={gradingPatternForm.handleSubmit(onGradingPatternSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto p-1 pr-4">
                     <FormField control={gradingPatternForm.control} name="patternName" render={({ field }) => (<FormItem><FormLabel>Pattern Name</FormLabel><FormControl><Input placeholder="e.g., Primary Scale" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                     <GradePatternForm control={gradingPatternForm.control}/>
                     <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsGradingPatternModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmittingGradingPattern}>{isSubmittingGradingPattern ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Grades'}</Button>
                     </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </div>
  );
}
