
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusCircle, Edit, Settings, Trash2, Loader2, Info, Star } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/user";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { assessmentSchemeSchema, type AssessmentScheme, type AssessmentSchemeFormData } from '@/types/assessment';
import { getAssessmentSchemeForClass, updateAssessmentScheme } from '@/app/actions/assessmentConfigurations';
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface ClassOption {
  value: string; 
  label: string; 
  academicYear: string;
  name?: string;
  section?: string;
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
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingScheme, setIsSubmittingScheme] = useState(false);

  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<AssessmentScheme | null>(null);
  const [currentClassLabel, setCurrentClassLabel] = useState<string>("");

  const classesForSelectedYear = useMemo(() => {
    if (!selectedAcademicYear) return [];
    
    const classMap = new Map<string, ClassOption[]>();
    allClassOptions
        .filter(c => c.academicYear === selectedAcademicYear)
        .forEach(c => {
            const className = c.name || "Unnamed Class";
            if(!classMap.has(className)) {
                classMap.set(className, []);
            }
            classMap.get(className)!.push(c);
        });

    return Array.from(classMap.entries()).map(([name, classes]) => ({
      name,
      // Use the first class's ID for the edit action, assuming schemes are per-class-name
      representativeClassId: classes[0].value, 
      sections: classes.map(c => c.section).filter(Boolean).join(', '),
    }));
  }, [allClassOptions, selectedAcademicYear]);


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
        getClassesForSchoolAsOptions(authUser.schoolId.toString()),
        getAcademicYears(),
      ]);
      
      setAllClassOptions(classesResult);
      
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

  const assessmentForm = useForm<AssessmentSchemeFormData>({
    resolver: zodResolver(assessmentSchemeSchema),
  });

  const { fields: assessmentGroups, append: appendAssessmentGroup, remove: removeAssessmentGroup } = useFieldArray({
    control: assessmentForm.control, name: "assessments",
  });

  const handleOpenSchemeDialog = async (representativeClassId: string, className: string) => {
    if (!authUser?.schoolId) return;
    
    // Fetch the specific scheme for this class
    const result = await getAssessmentSchemeForClass(representativeClassId, authUser.schoolId, selectedAcademicYear, className);

    if(result.success && result.scheme) {
      setEditingScheme(result.scheme);
      setCurrentClassLabel(className);
      assessmentForm.reset({
          schemeName: result.scheme.schemeName,
          assessments: result.scheme.assessments,
      });
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
      setIsSchemeModalOpen(false);
      setEditingScheme(null);
    } else {
      toast({ variant: 'destructive', title: 'Update Failed', description: result.error || result.message });
    }
    setIsSubmittingScheme(false);
  }
  
  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><Settings className="mr-2 h-6 w-6" />Configure Report Card</CardTitle><CardDescription>Set up assessment schemes for each class. Each class has its own editable scheme.</CardDescription></CardHeader></Card>

      <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Class-Specific Assessment Schemes</CardTitle>
              <CardDescription>Each class has its own independent assessment scheme. Edit the scheme for a class directly from this table.</CardDescription>
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
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>{classesForSelectedYear.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.sections}</TableCell>
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


     <Dialog open={isSchemeModalOpen} onOpenChange={(isOpen) => { if(!isOpen) setEditingScheme(null); setIsSchemeModalOpen(isOpen);}}>
      <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{editingScheme ? `Edit Scheme for ${currentClassLabel}` : 'Edit Assessment Scheme'}</DialogTitle><DialogDescription>Define assessments and their tests. Changes will apply to this class.</DialogDescription></DialogHeader>
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
                    Save Scheme
                </Button>
              </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </div>
  );
}
