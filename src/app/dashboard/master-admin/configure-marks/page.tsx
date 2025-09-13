"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PlusCircle, Edit, Settings, Trash2, Loader2, ChevronsUpDown } from "lucide-react";
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


  const form = useForm<ConfigurationFormData>({
    resolver: zodResolver(configurationSchema),
    defaultValues: {
      schemeName: "",
      classIds: [],
      assessments: [{ name: "", maxMarks: 10 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "assessments",
  });

  const selectedClasses = form.watch("classIds");

  function onSubmit(data: ConfigurationFormData) {
    // This is where you would handle the form submission to the backend.
    console.log(data);
    toast({
      title: "Configuration Submitted (Mock)",
      description: "Check the browser console to see the form data.",
    });
    setIsModalOpen(false);
    form.reset();
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Existing Configurations</CardTitle>
            <CardDescription>
              Manage the report card configurations for different classes or grades.
            </CardDescription>
          </div>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => form.reset({ schemeName: "", classIds: [], assessments: [{ name: "", maxMarks: 10 }] })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Configuration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Create New Assessment Configuration</DialogTitle>
                <DialogDescription>
                  Define the assessments, maximum marks, and the classes this scheme applies to.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
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
                        control={form.control}
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
                    {fields.map((item, index) => (
                      <div key={item.id} className="flex items-end gap-3 p-3 border rounded-md">
                        <FormField
                          control={form.control}
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
                          control={form.control}
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
                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    </div>
                     <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => append({ name: "", maxMarks: 10 })}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Assessment
                    </Button>
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Save Configuration</Button>
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
    </div>
  );
}
