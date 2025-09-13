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
import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/user";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { cn } from "@/lib/utils";

interface ClassOption {
  value: string;
  label: string;
}

// Mock data for display purposes
const mockConfigurations = [
  { id: "1", grade: "Class 10", assessments: 5, scheme: "Standard CBSE", lastUpdated: "2023-10-26" },
  { id: "2", grade: "Class 9", assessments: 5, scheme: "Standard CBSE", lastUpdated: "2023-10-25" },
  { id: "3", grade: "Class 1", assessments: 3, scheme: "Primary Fun-based", lastUpdated: "2023-09-01" },
];

const assessmentSchema = z.object({
  name: z.string().min(1, "Assessment name is required."),
  maxMarks: z.coerce.number().min(1, "Max marks must be at least 1."),
});

const configurationSchema = z.object({
  schemeName: z.string().min(3, "Scheme name is required."),
  classIds: z.array(z.string()).min(1, "At least one class must be selected."),
  assessments: z.array(assessmentSchema).min(1, "At least one assessment is required."),
});

type ConfigurationFormData = z.infer<typeof configurationSchema>;

const gradeRowSchema = z.object({
  label: z.string().min(1, "Grade label is required."),
  minPercentage: z.coerce.number().min(0).max(100),
  maxPercentage: z.coerce.number().min(0).max(100),
});

const gradingPatternSchema = z.object({
  patternName: z.string().min(3, "Pattern name is required."),
  grades: z.array(gradeRowSchema).min(1, "At least one grade row is required."),
});

type GradingPatternFormData = z.infer<typeof gradingPatternSchema>;

export default function ConfigureMarksPage() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);

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

  const fetchClasses = useCallback(async () => {
    if (!authUser?.schoolId) return;
    setIsLoadingClasses(true);
    const result = await getClassesForSchoolAsOptions(authUser.schoolId);
    setClassOptions(result);
    setIsLoadingClasses(false);
  }, [authUser]);

  useEffect(() => {
    if (authUser) {
      fetchClasses();
    }
  }, [authUser, fetchClasses]);

  // Form for Assessment Schemes
  const assessmentForm = useForm<ConfigurationFormData>({
    resolver: zodResolver(configurationSchema),
    defaultValues: {
      schemeName: "",
      classIds: [],
      assessments: [{ name: "", maxMarks: 10 }],
    },
  });

  const { fields: assessmentFields, append: appendAssessment, remove: removeAssessment } = useFieldArray({
    control: assessmentForm.control,
    name: "assessments",
  });
  const selectedClasses = assessmentForm.watch("classIds");

  // Form for Grading Patterns
  const gradingForm = useForm<GradingPatternFormData>({
      resolver: zodResolver(gradingPatternSchema),
      defaultValues: {
        patternName: "",
        grades: [{ label: "A1", minPercentage: 91, maxPercentage: 100 }],
      }
  });

  const { fields: gradeFields, append: appendGrade, remove: removeGrade } = useFieldArray({
      control: gradingForm.control,
      name: "grades"
  });

  const watchedGrades = gradingForm.watch("grades");

  function onAssessmentSubmit(data: ConfigurationFormData) {
    console.log("Assessment Scheme Data:", data);
    toast({
      title: "Assessment Scheme Submitted (Mock)",
      description: "Check the browser console to see the form data.",
    });
    setIsModalOpen(false);
    assessmentForm.reset();
  }

  function onGradingSubmit(data: GradingPatternFormData) {
    console.log("Grading Pattern Data:", data);
    toast({
      title: "Grading Pattern Submitted (Mock)",
      description: "Check the browser console to see the form data.",
    });
    // gradingForm.reset(); // Optionally reset form after submission
  }

  const getSelectedClassesLabel = () => {
    if (selectedClasses.length === 0) return "Select classes...";
    if (selectedClasses.length === classOptions.length) return "All Classes";
    if (selectedClasses.length > 2) return `${selectedClasses.length} classes selected`;
    return classOptions
      .filter(opt => selectedClasses.includes(opt.value))
      .map(opt => opt.label)
      .join(', ');
  };
  
  const PREVIEW_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Settings className="mr-2 h-6 w-6" />
            Configure Report Card
          </CardTitle>
          <CardDescription>
            Set up assessment schemes, grading patterns, and other report card configurations for your school.
          </CardDescription>
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
                    <CardDescription>
                    Manage the assessments for different classes or grades.
                    </CardDescription>
                </div>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                    <Button onClick={() => assessmentForm.reset({ schemeName: "", classIds: [], assessments: [{ name: "", maxMarks: 10 }] })}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create New Scheme
                    </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Create New Assessment Scheme</DialogTitle>
                        <DialogDescription>
                        Define the assessments, maximum marks, and the classes this scheme applies to.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...assessmentForm}>
                        <form onSubmit={assessmentForm.handleSubmit(onAssessmentSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={assessmentForm.control}
                                name="schemeName"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Scheme Name</FormLabel>
                                    <FormControl>
                                    <Input placeholder="e.g., Senior Secondary Scheme" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={assessmentForm.control}
                                name="classIds"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Apply to Classes</FormLabel>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between">
                                            {getSelectedClassesLabel()}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                        {isLoadingClasses ? <DropdownMenuItem disabled>Loading...</DropdownMenuItem> :
                                        classOptions.map(option => (
                                            <DropdownMenuItem key={option.value} onSelect={(e) => e.preventDefault()}>
                                            <Checkbox
                                                checked={field.value.includes(option.value)}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                        ? field.onChange([...field.value, option.value])
                                                        : field.onChange(field.value.filter(v => v !== option.value))
                                                }}
                                                className="mr-2"
                                                />
                                            {option.label}
                                            </DropdownMenuItem>
                                        ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>

                        <div>
                            <FormLabel>Assessments</FormLabel>
                            <div className="space-y-3 mt-2">
                            {assessmentFields.map((item, index) => (
                            <div key={item.id} className="flex items-end gap-3 p-3 border rounded-md">
                                <FormField
                                control={assessmentForm.control}
                                name={`assessments.${index}.name`}
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                    <FormLabel>Assessment Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Unit Test 1" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={assessmentForm.control}
                                name={`assessments.${index}.maxMarks`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Max Marks</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="25" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <Button type="button" variant="destructive" size="icon" onClick={() => removeAssessment(index)} disabled={assessmentFields.length <= 1}>
                                <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => appendAssessment({ name: "", maxMarks: 10 })}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Assessment
                            </Button>
                        </div>

                        <DialogFooter>
                            <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit">Save Scheme</Button>
                        </DialogFooter>
                        </form>
                    </Form>
                    </DialogContent>
                </Dialog>
                </CardHeader>
                <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Class/Grade</TableHead>
                        <TableHead>Number of Assessments</TableHead>
                        <TableHead>Grading Scheme Name</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {mockConfigurations.map((config) => (
                        <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.grade}</TableCell>
                        <TableCell>{config.assessments}</TableCell>
                        <TableCell>{config.scheme}</TableCell>
                        <TableCell>{config.lastUpdated}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="patterns">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5"/>Create New Grading Pattern</CardTitle>
                    <CardDescription>Define grade labels and their corresponding percentage ranges.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...gradingForm}>
                        <form onSubmit={gradingForm.handleSubmit(onGradingSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <FormField
                                    control={gradingForm.control}
                                    name="patternName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Grading Pattern Name</FormLabel>
                                            <FormControl><Input placeholder="e.g., CBSE 9-10 Scheme" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div>
                                    <FormLabel>Grade Rows</FormLabel>
                                    <div className="mt-2 space-y-3">
                                        {gradeFields.map((item, index) => (
                                            <div key={item.id} className="flex items-end gap-3 p-3 border rounded-lg">
                                                <FormField control={gradingForm.control} name={`grades.${index}.label`} render={({field}) => (<FormItem><FormLabel>Grade</FormLabel><FormControl><Input placeholder="A1" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                                                <FormField control={gradingForm.control} name={`grades.${index}.minPercentage`} render={({field}) => (<FormItem><FormLabel>Min %</FormLabel><FormControl><Input type="number" placeholder="91" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                                                <FormField control={gradingForm.control} name={`grades.${index}.maxPercentage`} render={({field}) => (<FormItem><FormLabel>Max %</FormLabel><FormControl><Input type="number" placeholder="100" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                                                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeGrade(index)} disabled={gradeFields.length <= 1}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        ))}
                                    </div>
                                     <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => appendGrade({ label: "", minPercentage: 0, maxPercentage: 0 })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Grade Row
                                    </Button>
                                </div>
                                <Button type="submit">Save Grading Pattern</Button>
                            </div>
                            <div className="lg:col-span-1">
                                <h4 className="font-semibold mb-2">Live Preview</h4>
                                <Card className="p-4 space-y-2">
                                     <p className="text-sm font-medium">{gradingForm.watch('patternName') || "Your Pattern Name"}</p>
                                     <div className="w-full flex h-8 rounded-full overflow-hidden border">
                                        {watchedGrades.map((grade, index) => {
                                            const width = Math.max(0, grade.maxPercentage - grade.minPercentage);
                                            if (width === 0) return null;
                                            return (
                                                <div key={index} title={`${grade.label}: ${grade.minPercentage}% - ${grade.maxPercentage}%`}
                                                     className={cn("flex items-center justify-center text-white text-xs font-bold", PREVIEW_COLORS[index % PREVIEW_COLORS.length])}
                                                     style={{ width: `${width}%` }}>
                                                   {width > 5 && grade.label}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <ul className="text-xs space-y-1 mt-2">
                                        {watchedGrades.map((grade, index) => (
                                            <li key={index} className="flex items-center">
                                                <span className={cn("w-3 h-3 rounded-sm mr-2", PREVIEW_COLORS[index % PREVIEW_COLORS.length])}></span>
                                                <span className="font-bold w-10">{grade.label || "N/A"}:</span>
                                                <span>{grade.minPercentage}% to {grade.maxPercentage}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                </Card>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </TabsContent>
    </Tabs>
    </div>
  );
}
