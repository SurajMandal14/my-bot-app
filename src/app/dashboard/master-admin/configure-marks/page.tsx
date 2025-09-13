"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Edit, Settings, Trash2, Loader2, ChevronsUpDown, Palette } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/user";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { cn } from "@/lib/utils";
import { assessmentSchemeSchema, type AssessmentScheme, type AssessmentSchemeFormData, gradingPatternSchema, type GradingPattern, type GradingPatternFormData } from '@/types/assessment';
import { createAssessmentScheme, getAssessmentSchemes, updateAssessmentScheme, deleteAssessmentScheme, createGradingPattern, getGradingPatterns, updateGradingPattern, deleteGradingPattern } from '@/app/actions/assessmentConfigurations';
import { format } from "date-fns";


interface ClassOption {
  value: string; 
  label: string; 
  academicYear: string;
}

export default function ConfigureMarksPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  
  // Data State
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [assessmentSchemes, setAssessmentSchemes] = useState<AssessmentScheme[]>([]);
  const [gradingPatterns, setGradingPatterns] = useState<GradingPattern[]>([]);
  
  // Loading & Action State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingScheme, setIsSubmittingScheme] = useState(false);
  const [isSubmittingPattern, setIsSubmittingPattern] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Modal & Editing State
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<AssessmentScheme | null>(null);
  const [schemeToDelete, setSchemeToDelete] = useState<AssessmentScheme | null>(null);
  
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<GradingPattern | null>(null);
  const [patternToDelete, setPatternToDelete] = useState<GradingPattern | null>(null);


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
      const [classesResult, schemesResult, patternsResult] = await Promise.all([
        getClassesForSchoolAsOptions(authUser.schoolId.toString()),
        getAssessmentSchemes(authUser.schoolId.toString()),
        getGradingPatterns(authUser.schoolId.toString())
      ]);
      
      const uniqueClasses = classesResult.map(c => ({
          value: `${c.name}-${c.academicYear}`,
          label: `${c.name} (${c.academicYear})`,
          academicYear: c.academicYear,
      }));
      setClassOptions(uniqueClasses);
      
      if(schemesResult.success && schemesResult.schemes) {
        setAssessmentSchemes(schemesResult.schemes);
      } else {
        toast({variant: 'warning', title: 'Could not load schemes', description: schemesResult.message});
      }
      
      if(patternsResult.success && patternsResult.patterns) {
        setGradingPatterns(patternsResult.patterns);
      } else {
        toast({variant: 'warning', title: 'Could not load patterns', description: patternsResult.message});
      }

    } catch (error) {
      toast({variant: 'destructive', title: 'Error', description: 'Failed to fetch initial configuration data.'})
    } finally {
      setIsLoading(false);
    }
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser) {
      fetchData();
    }
  }, [authUser, fetchData]);

  // Form for Assessment Schemes
  const assessmentForm = useForm<AssessmentSchemeFormData>({
    resolver: zodResolver(assessmentSchemeSchema),
    defaultValues: { classIds: [], assessments: [{ name: "", maxMarks: 10 }] },
  });

  const { fields: assessmentFields, append: appendAssessment, remove: removeAssessment } = useFieldArray({
    control: assessmentForm.control,
    name: "assessments",
  });
  const selectedClasses = assessmentForm.watch("classIds");
  
  const handleEditScheme = (scheme: AssessmentScheme) => {
    if (scheme._id === 'default_cbse_state') {
        toast({title: "Default Scheme", description: "The default scheme cannot be edited directly. Please create a new scheme to customize it."});
        return;
    }
    setEditingScheme(scheme);
    assessmentForm.reset({
      schemeName: scheme.schemeName,
      classIds: scheme.classIds.map(id => id.toString()),
      assessments: scheme.assessments,
    });
    setIsSchemeModalOpen(true);
  };

  async function onAssessmentSubmit(data: AssessmentSchemeFormData) {
    if (!authUser?._id || !authUser?.schoolId) return;
    setIsSubmittingScheme(true);
    
    // The classIds from the form are "ClassName-AcademicYear", we only need ClassName
    const payload: AssessmentSchemeFormData = {
        ...data,
        classIds: data.classIds.map(id => id.split('-')[0])
    };

    const result = editingScheme 
      ? await updateAssessmentScheme(editingScheme._id.toString(), payload, authUser.schoolId.toString())
      : await createAssessmentScheme(payload, authUser._id.toString(), authUser.schoolId.toString());

    if (result.success) {
      toast({ title: editingScheme ? "Scheme Updated" : "Scheme Created", description: result.message });
      fetchData();
      setIsSchemeModalOpen(false);
      setEditingScheme(null);
      assessmentForm.reset();
    } else {
      toast({ variant: 'destructive', title: 'Submission Failed', description: result.error || result.message });
    }
    setIsSubmittingScheme(false);
  }

  async function onDeleteScheme() {
    if(!schemeToDelete || !authUser?.schoolId) return;
     if (schemeToDelete._id === 'default_cbse_state') {
        toast({variant: "destructive", title: "Action Not Allowed", description: "The default scheme cannot be deleted."});
        setSchemeToDelete(null);
        return;
    }
    setIsDeleting(schemeToDelete._id.toString());
    const result = await deleteAssessmentScheme(schemeToDelete._id.toString(), authUser.schoolId.toString());
    if(result.success) {
      toast({title: 'Scheme Deleted', description: result.message});
      fetchData();
    } else {
      toast({variant: 'destructive', title: 'Deletion Failed', description: result.message});
    }
    setSchemeToDelete(null);
    setIsDeleting(null);
  }


  // Form for Grading Patterns
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
    gradingForm.reset({
      patternName: pattern.patternName,
      grades: pattern.grades
    });
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


  const getSelectedClassesLabel = (classIds: string[] = []) => {
    if (classIds.length === 0) return "Select classes...";
    if (classOptions.length > 0 && classIds.length === classOptions.length) return "All Classes";
    if (classIds.length > 2) return `${classIds.length} classes selected`;
    return classOptions
      .filter(opt => classIds.includes(opt.value))
      .map(opt => opt.label)
      .join(', ');
  };
  
  const PREVIEW_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center"><Settings className="mr-2 h-6 w-6" />Configure Report Card</CardTitle>
          <CardDescription>Set up assessment schemes, grading patterns, and other report card configurations for your school.</CardDescription>
        </CardHeader>
      </Card>

    <Tabs defaultValue="schemes">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schemes">Assessment Schemes</TabsTrigger>
            <TabsTrigger value="patterns">Grading Patterns</TabsTrigger>
        </TabsList>
        <TabsContent value="schemes">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle>Existing Assessment Schemes</CardTitle>
                    <CardDescription>Manage the assessments for different classes or grades.</CardDescription>
                </div>
                <Dialog open={isSchemeModalOpen} onOpenChange={(isOpen) => { if(!isOpen) setEditingScheme(null); setIsSchemeModalOpen(isOpen); }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => { assessmentForm.reset({ classIds: [], assessments: [{ name: "FA1 - Tool 1", maxMarks: 10 }] }); setEditingScheme(null); setIsSchemeModalOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Create New Scheme
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>{editingScheme ? 'Edit Assessment Scheme' : 'Create New Assessment Scheme'}</DialogTitle>
                        <DialogDescription>Define assessments, max marks, and the classes this scheme applies to.</DialogDescription>
                      </DialogHeader>
                      <Form {...assessmentForm}>
                        <form onSubmit={assessmentForm.handleSubmit(onAssessmentSubmit)} className="space-y-6">
                        
                          <FormField control={assessmentForm.control} name="classIds" render={({ field }) => (<FormItem><FormLabel>Apply to Classes</FormLabel><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between">{getSelectedClassesLabel(selectedClasses)}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">{isLoading ? <DropdownMenuItem disabled>Loading...</DropdownMenuItem> : classOptions.map(option => (<DropdownMenuItem key={option.value} onSelect={(e) => e.preventDefault()}><Checkbox checked={field.value.includes(option.value)} onCheckedChange={(checked) => { return checked ? field.onChange([...field.value, option.value]) : field.onChange(field.value.filter(v => v !== option.value))}} className="mr-2"/>{option.label}</DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu><FormMessage /></FormItem>)}/>
                        
                        <div>
                            <FormLabel>Assessments</FormLabel>
                            <div className="space-y-3 mt-2 max-h-[40vh] overflow-y-auto pr-2">{assessmentFields.map((item, index) => (<div key={item.id} className="flex items-end gap-3 p-3 border rounded-md"><FormField control={assessmentForm.control} name={`assessments.${index}.name`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Assessment Name</FormLabel><FormControl><Input placeholder="e.g., FA1 - Tool 1" {...field} /></FormControl><FormMessage /></FormItem>)}/><FormField control={assessmentForm.control} name={`assessments.${index}.maxMarks`} render={({ field }) => (<FormItem><FormLabel>Max Marks</FormLabel><FormControl><Input type="number" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem>)}/><Button type="button" variant="destructive" size="icon" onClick={() => removeAssessment(index)} disabled={assessmentFields.length <= 1}><Trash2 className="h-4 w-4" /></Button></div>))}</div>
                            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => appendAssessment({ name: "", maxMarks: 10 })}><PlusCircle className="mr-2 h-4 w-4" /> Add Assessment Row</Button>
                        </div>
                        <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmittingScheme}>{isSubmittingScheme && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Scheme</Button></DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                </Dialog>
                </CardHeader>
                <CardContent>
                  {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                  assessmentSchemes.length > 0 ? (
                    <Table>
                      <TableHeader><TableRow><TableHead>Applied to Class(es)</TableHead><TableHead>Scheme Name</TableHead><TableHead>Last Updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>{assessmentSchemes.map((scheme) => (
                          <TableRow key={scheme._id.toString()}>
                            <TableCell>{getSelectedClassesLabel(scheme.classIds.map(id => id.toString()))}</TableCell>
                            <TableCell className="font-medium">{scheme.schemeName}</TableCell>
                            <TableCell>{format(new Date(scheme.updatedAt), "PP")}</TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEditScheme(scheme)} disabled={!!isDeleting || scheme._id === 'default_cbse_state'}><Edit className="h-4 w-4" /></Button>
                              <AlertDialog open={schemeToDelete?._id === scheme._id} onOpenChange={(open) => !open && setSchemeToDelete(null)}>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setSchemeToDelete(scheme)} disabled={!!isDeleting || scheme._id === 'default_cbse_state'}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Scheme?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete the scheme "{scheme.schemeName}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onDeleteScheme} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}</TableBody>
                    </Table>
                  ) : (<p className="text-center text-muted-foreground py-4">No assessment schemes created yet.</p>)}
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
                  <Dialog open={isPatternModalOpen} onOpenChange={(isOpen) => { if(!isOpen) setEditingPattern(null); setIsPatternModalOpen(isOpen); }}>
                    <DialogTrigger asChild><Button onClick={() => { gradingForm.reset(); setEditingPattern(null); setIsPatternModalOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/>Create New Pattern</Button></DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader><DialogTitle>{editingPattern ? 'Edit Grading Pattern' : 'Create New Grading Pattern'}</DialogTitle><DialogDescription>Define grade labels and their corresponding percentage ranges.</DialogDescription></DialogHeader>
                      <Form {...gradingForm}>
                          <form onSubmit={gradingForm.handleSubmit(onGradingSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
                              <div className="lg:col-span-2 space-y-6">
                                  <FormField control={gradingForm.control} name="patternName" render={({ field }) => (<FormItem><FormLabel>Grading Pattern Name</FormLabel><FormControl><Input placeholder="e.g., CBSE 9-10 Scheme" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                  <div>
                                      <FormLabel>Grade Rows</FormLabel>
                                      <div className="mt-2 space-y-3 max-h-[40vh] overflow-y-auto pr-2">{gradeFields.map((item, index) => (<div key={item.id} className="flex items-end gap-3 p-3 border rounded-lg"><FormField control={gradingForm.control} name={`grades.${index}.label`} render={({field}) => (<FormItem><FormLabel>Grade</FormLabel><FormControl><Input placeholder="A1" {...field}/></FormControl><FormMessage/></FormItem>)}/> <FormField control={gradingForm.control} name={`grades.${index}.minPercentage`} render={({field}) => (<FormItem><FormLabel>Min %</FormLabel><FormControl><Input type="number" placeholder="91" {...field}/></FormControl><FormMessage/></FormItem>)}/> <FormField control={gradingForm.control} name={`grades.${index}.maxPercentage`} render={({field}) => (<FormItem><FormLabel>Max %</FormLabel><FormControl><Input type="number" placeholder="100" {...field}/></FormControl><FormMessage/></FormItem>)}/> <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeGrade(index)} disabled={gradeFields.length <= 1}><Trash2 className="h-4 w-4"/></Button></div>))}</div>
                                      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => appendGrade({ label: "", minPercentage: 0, maxPercentage: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Add Grade Row</Button>
                                  </div>
                              </div>
                              <div className="lg:col-span-1"><h4 className="font-semibold mb-2">Live Preview</h4><Card className="p-4 space-y-2"><p className="text-sm font-medium">{gradingForm.watch('patternName') || "Your Pattern Name"}</p><div className="w-full flex h-8 rounded-full overflow-hidden border">{watchedGrades.map((grade, index) => {const width = Math.max(0, (grade.maxPercentage || 0) - (grade.minPercentage || 0)); if (width === 0) return null; return (<div key={index} title={`${grade.label}: ${grade.minPercentage}% - ${grade.maxPercentage}%`} className={cn("flex items-center justify-center text-white text-xs font-bold", PREVIEW_COLORS[index % PREVIEW_COLORS.length])} style={{ width: `${width}%` }}>{width > 5 && grade.label}</div>)})}</div><ul className="text-xs space-y-1 mt-2">{watchedGrades.map((grade, index) => (<li key={index} className="flex items-center"><span className={cn("w-3 h-3 rounded-sm mr-2", PREVIEW_COLORS[index % PREVIEW_COLORS.length])}></span><span className="font-bold w-10">{grade.label || "N/A"}:</span><span>{grade.minPercentage || 0}% to {grade.maxPercentage || 0}%</span></li>))}</ul></Card></div>
                              <DialogFooter className="lg:col-span-3"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmittingPattern}>{isSubmittingPattern && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Pattern</Button></DialogFooter>
                          </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                  gradingPatterns.length > 0 ? (
                     <Table>
                      <TableHeader><TableRow><TableHead>Pattern Name</TableHead><TableHead>Grades</TableHead><TableHead>Last Updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>{gradingPatterns.map((pattern) => (
                          <TableRow key={pattern._id.toString()}>
                            <TableCell className="font-medium">{pattern.patternName}</TableCell>
                            <TableCell>{pattern.grades.map(g => g.label).join(', ')}</TableCell>
                            <TableCell>{format(new Date(pattern.updatedAt), "PP")}</TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEditPattern(pattern)} disabled={!!isDeleting}><Edit className="h-4 w-4" /></Button>
                              <AlertDialog open={patternToDelete?._id === pattern._id} onOpenChange={(open) => !open && setPatternToDelete(null)}>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setPatternToDelete(pattern)} disabled={!!isDeleting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
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
    </div>
  );
}
