
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookCopy, PlusCircle, Edit3, Trash2, Loader2, UserCheck, FilePlus, XCircle, Info, Users, Languages, School as SchoolIcon, CalendarFold } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
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
import { createSchoolClass, getSchoolClasses, updateSchoolClass, deleteSchoolClass } from "@/app/actions/classes";
import { getSchoolUsers } from "@/app/actions/schoolUsers"; 
import { getSchoolById } from "@/app/actions/schools";
import { getSubjects } from "@/app/actions/subjects";
import { getAcademicYears } from "@/app/actions/academicYears";
import type { Subject } from "@/types/subject";
import type { SchoolClass, CreateClassFormData } from '@/types/classes';
import { createClassFormSchema } from '@/types/classes';
import type { AuthUser, User as AppUser } from "@/types/user";
import type { School, ClassTuitionFeeConfig } from "@/types/school";
import type { AcademicYear } from "@/types/academicYear";
import { useEffect, useState, useCallback } from "react";

const NONE_TEACHER_VALUE = "__NONE_TEACHER_OPTION__";
const NONE_SUBJECT_VALUE = "__NONE_SUBJECT_OPTION__";
const NONE_CLASS_NAME_VALUE = "__NONE_CLASS_NAME_OPTION__";

const getCurrentAcademicYear = (): string => {
  const today = new Date();
  const currentMonth = today.getMonth();
  if (currentMonth >= 5) {
    return `${today.getFullYear()}-${today.getFullYear() + 1}`;
  } else {
    return `${today.getFullYear() - 1}-${today.getFullYear()}`;
  }
};


export default function AdminClassManagementPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<AppUser[]>([]);
  const [masterSubjects, setMasterSubjects] = useState<Subject[]>([]);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [availableClassNamesForSchool, setAvailableClassNamesForSchool] = useState<string[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [classToDelete, setClassToDelete] = useState<SchoolClass | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const form = useForm<CreateClassFormData>({
    resolver: zodResolver(createClassFormSchema),
    defaultValues: {
      name: "",
      section: "",
      academicYear: "",
      classTeacherId: "", 
      subjects: [{ name: "", teacherId: "" }],
      secondLanguageSubjectName: "",
    },
  });

  const { fields: subjectFields, append: appendSubject, remove: removeSubject } = useFieldArray({
    control: form.control,
    name: "subjects",
  });
  const currentSubjects = form.watch("subjects");

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        if (parsedUser && parsedUser.role === 'admin' && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        } else {
          setAuthUser(null);
          toast({ variant: "destructive", title: "Access Denied", description: "You must be a school admin." });
        }
      } catch (e) { setAuthUser(null); }
    } else { setAuthUser(null); }
  }, [toast]);

  const fetchInitialData = useCallback(async () => {
    if (!authUser || !authUser.schoolId) {
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    try {
      const [classesResult, teachersResult, schoolDetailsResult, masterSubjectsResult, academicYearsResult] = await Promise.all([
        getSchoolClasses(authUser.schoolId.toString()),
        getSchoolUsers(authUser.schoolId.toString()),
        getSchoolById(authUser.schoolId.toString()),
        getSubjects(authUser.schoolId.toString()),
        getAcademicYears()
      ]);

      if (classesResult.success && classesResult.classes) {
        setSchoolClasses(classesResult.classes);
      } else {
        toast({ variant: "destructive", title: "Error", description: classesResult.message || "Failed to load classes." });
      }

      if (teachersResult.success && teachersResult.users) {
        setAvailableTeachers(teachersResult.users.filter(u => u.role === 'teacher'));
      } else {
         toast({ variant: "warning", title: "Teacher Info", description: teachersResult.message || "Failed to load teachers for dropdown." });
      }

      if (schoolDetailsResult.success && schoolDetailsResult.school) {
        setSchoolDetails(schoolDetailsResult.school);
        const classNamesFromTuition = Array.from(new Set(schoolDetailsResult.school.tuitionFees
          .map((tf: ClassTuitionFeeConfig) => tf.className)
          .filter(Boolean) as string[]));
        setAvailableClassNamesForSchool(classNamesFromTuition);
      } else {
        toast({ variant: "destructive", title: "School Details Error", description: schoolDetailsResult.message || "Failed to load school configuration for class names."});
        setSchoolDetails(null);
        setAvailableClassNamesForSchool([]);
      }
      
      if (masterSubjectsResult.success && masterSubjectsResult.subjects) {
        setMasterSubjects(masterSubjectsResult.subjects);
      } else {
         toast({ variant: "warning", title: "Subjects", description: masterSubjectsResult.message || "Failed to load subjects list for this school." });
      }

      if (academicYearsResult.success && academicYearsResult.academicYears) {
        setAcademicYears(academicYearsResult.academicYears);
        const defaultYear = academicYearsResult.academicYears.find(y => y.isDefault)?.year || academicYearsResult.academicYears[0]?.year || getCurrentAcademicYear();
        form.setValue("academicYear", defaultYear);
      } else {
        toast({ variant: "warning", title: "Academic Years", description: "Could not load academic years." });
        form.setValue("academicYear", getCurrentAcademicYear());
      }


    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Unexpected error fetching initial data." });
    } finally {
      setIsLoadingData(false);
    }
  }, [authUser, toast, form]);

  useEffect(() => {
    if (authUser?.schoolId) fetchInitialData();
    else { setIsLoadingData(false); setSchoolClasses([]); setAvailableTeachers([]); setSchoolDetails(null); setAvailableClassNamesForSchool([]);}
  }, [authUser, fetchInitialData]);

  useEffect(() => {
    if (isFormOpen && editingClass) {
      form.reset({
        name: editingClass.name,
        section: editingClass.section || "",
        academicYear: editingClass.academicYear || "",
        classTeacherId: editingClass.classTeacherId?.toString() || "",
        subjects: editingClass.subjects.length > 0 
          ? editingClass.subjects.map(s => ({ name: s.name, teacherId: s.teacherId?.toString() || "" })) 
          : [{ name: "", teacherId: "" }],
        secondLanguageSubjectName: editingClass.secondLanguageSubjectName || "",
      });
    }
  }, [editingClass, isFormOpen, form]);

  async function onSubmit(values: CreateClassFormData) {
    if (!authUser?.schoolId) return;
    setIsSubmitting(true);
    
    const result = editingClass
      ? await updateSchoolClass(editingClass._id.toString(), authUser.schoolId.toString(), values)
      : await createSchoolClass(authUser.schoolId.toString(), values);
    
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: editingClass ? "Class Updated" : "Class Created", description: result.message });
      handleCancelClick();
      fetchInitialData();
    } else {
      toast({ variant: "destructive", title: `Error ${editingClass ? "Updating" : "Creating"} Class`, description: result.error || result.message });
    }
  }

  const handleEditClick = (cls: SchoolClass) => {
    setEditingClass(cls);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddClick = () => {
    setEditingClass(null);
    const defaultYear = academicYears.find(y => y.isDefault)?.year || academicYears[0]?.year || getCurrentAcademicYear();
    form.reset({ name: "", section: "", academicYear: defaultYear, classTeacherId: "", subjects: [{ name: "", teacherId: "" }], secondLanguageSubjectName: "" });
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelClick = () => {
    setIsFormOpen(false);
    setEditingClass(null);
    form.reset();
  };

  const handleDeleteClick = (cls: SchoolClass) => setClassToDelete(cls);

  const handleConfirmDelete = async () => {
    if (!classToDelete?._id || !authUser?.schoolId) return;
    setIsDeleting(true);
    const result = await deleteSchoolClass(classToDelete._id.toString(), authUser.schoolId.toString());
    setIsDeleting(false);
    if (result.success) {
      toast({ title: "Class Deleted", description: result.message });
      fetchInitialData();
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.error || result.message });
    }
    setClassToDelete(null);
  };
  
  if (!authUser && !isLoadingData) { 
    return (
      <Card>
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>Please log in as an admin.</p></CardContent>
      </Card>
    );
  }

  const classDisplayName = (cls: SchoolClass) => `${cls.name}${cls.section ? ` - ${cls.section}` : ''}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <BookCopy className="mr-2 h-6 w-6" /> Class Management
          </CardTitle>
          <CardDescription>
            Create and manage classes, assign class teachers, and define subjects for specific academic years.
          </CardDescription>
        </CardHeader>
      </Card>

      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{editingClass ? `Edit Class: ${classDisplayName(editingClass)}` : "Add New Class"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <FormField 
                    control={form.control} 
                    name="name" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><SchoolIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Class Name</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === NONE_CLASS_NAME_VALUE ? "" : value)}
                          value={field.value || ""}
                          disabled={isSubmitting || isLoadingData || availableClassNamesForSchool.length === 0}
                        >
                          <FormControl><SelectTrigger>
                              <SelectValue placeholder={
                                  availableClassNamesForSchool.length > 0 
                                  ? "Select class name" 
                                  : (isLoadingData ? "Loading names..." : "No class names in tuition config")
                              } />
                          </SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value={NONE_CLASS_NAME_VALUE}>-- Select Class Name --</SelectItem>
                            {availableClassNamesForSchool.map(className => (
                              <SelectItem key={className} value={className}>{className}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">Class names are based on Super Admin's tuition fee configurations for this school.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="section" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Section (e.g., A)</FormLabel>
                      <FormControl><Input placeholder="e.g., A" {...field} disabled={isSubmitting} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField
                    control={form.control}
                    name="academicYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><CalendarFold className="mr-2 h-4 w-4 text-muted-foreground"/>Academic Year</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || isLoadingData || academicYears.length === 0}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Academic Year" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {academicYears.map(year => (
                              <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="classTeacherId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><UserCheck className="mr-2 h-4 w-4 text-muted-foreground"/>Assign Class Teacher (Optional)</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value === NONE_TEACHER_VALUE ? "" : value);
                        }}
                        value={field.value || ""} 
                        disabled={isSubmitting || isLoadingData || availableTeachers.length === 0}
                      >
                        <FormControl><SelectTrigger>
                            <SelectValue placeholder={availableTeachers.length > 0 ? "Select a teacher" : "No teachers available"} />
                        </SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_TEACHER_VALUE}>None</SelectItem>
                          {availableTeachers.map(teacher => (
                            <SelectItem key={teacher._id!.toString()} value={teacher._id!.toString()}>{teacher.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">The class teacher can mark attendance for this class.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}/>
                </div>

                <div className="space-y-3">
                  <FormLabel className="text-lg font-semibold">Subjects Offered</FormLabel>
                  {subjectFields.map((subjectItem, index) => (
                    <Card key={subjectItem.id} className="p-4 border-dashed">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
                        <FormField control={form.control} name={`subjects.${index}.name`} render={({ field }) => (
                          <FormItem className="md:col-span-1">
                            <FormLabel htmlFor={`subject-name-${index}`}>Subject Name {index + 1}</FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(value === NONE_SUBJECT_VALUE ? "" : value)}
                              value={field.value || ""}
                              disabled={isSubmitting || isLoadingData || masterSubjects.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger id={`subject-name-${index}`}>
                                  <SelectValue placeholder={masterSubjects.length > 0 ? "Select subject" : "No subjects configured"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NONE_SUBJECT_VALUE}>-- Select Subject --</SelectItem>
                                {masterSubjects.map(subject => (
                                  <SelectItem key={subject._id} value={subject.name}>{subject.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        <FormField control={form.control} name={`subjects.${index}.teacherId`} render={({ field }) => (
                          <FormItem className="md:col-span-1">
                            <FormLabel htmlFor={`subject-teacher-${index}`} className="flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground"/>Assign Subject Teacher</FormLabel>
                            <Select
                                onValueChange={(value) => field.onChange(value === NONE_TEACHER_VALUE ? "" : value)}
                                value={field.value || ""}
                                disabled={isSubmitting || isLoadingData || availableTeachers.length === 0}
                              >
                                <FormControl><SelectTrigger id={`subject-teacher-${index}`}>
                                    <SelectValue placeholder={availableTeachers.length > 0 ? "Select teacher" : "No teachers"} />
                                </SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value={NONE_TEACHER_VALUE}>-- None --</SelectItem>
                                  {availableTeachers.map(teacher => (
                                    <SelectItem key={teacher._id!.toString()} value={teacher._id!.toString()}>{teacher.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        {subjectFields.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeSubject(index)} disabled={isSubmitting} className="text-destructive hover:bg-destructive/10 self-end justify-self-start md:justify-self-center">
                            <Trash2 className="mr-1 h-4 w-4" />Remove Subject
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => appendSubject({ name: "", teacherId: "" })} disabled={isSubmitting}>
                    <FilePlus className="mr-2 h-4 w-4"/>Add Subject
                  </Button>
                </div>
                
                <FormField
                    control={form.control}
                    name="secondLanguageSubjectName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Languages className="mr-2 h-4 w-4 text-muted-foreground"/>Designated Second Language (Optional)</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === NONE_SUBJECT_VALUE ? "" : value)}
                          value={field.value || ""}
                          disabled={isSubmitting || currentSubjects.length === 0}
                        >
                          <FormControl><SelectTrigger>
                              <SelectValue placeholder={currentSubjects.filter(s => s.name?.trim()).length > 0 ? "Select from offered subjects" : "Add subjects first"} />
                          </SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value={NONE_SUBJECT_VALUE}>-- None --</SelectItem>
                            {currentSubjects.filter(s => s.name?.trim()).map(s => (
                              <SelectItem key={s.name} value={s.name!}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">This subject will use second language grading scales on report cards.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />


                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting || isLoadingData}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    {editingClass ? "Update Class" : "Create Class"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelClick} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4" />Cancel</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle>Existing Classes</CardTitle>
            <Button onClick={handleAddClick} disabled={isFormOpen && !editingClass}>
                <PlusCircle className="mr-2 h-4 w-4"/> Add New Class
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
             <div className="flex items-center justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading classes...</p></div>
          ) : schoolClasses.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class (Name - Section)</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead>Class Teacher</TableHead>
                <TableHead>No. of Students</TableHead>
                <TableHead>Subjects (Teachers)</TableHead>
                <TableHead>2nd Lang</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schoolClasses.map((cls) => (
                <TableRow key={cls._id.toString()}>
                  <TableCell className="font-medium">{classDisplayName(cls)}</TableCell>
                  <TableCell>{cls.academicYear}</TableCell>
                  <TableCell>{cls.classTeacherName || (cls.classTeacherId ? 'N/A' : 'Not Assigned')}</TableCell>
                  <TableCell className="text-center">{cls.studentCount ?? 0}</TableCell>
                  <TableCell>
                    {cls.subjects.length > 0 ? (
                        <ul className="list-disc pl-4 text-xs">
                            {cls.subjects.map(s => (
                                <li key={s.name}>{s.name} <span className="text-muted-foreground">({s.teacherName || (s.teacherId ? 'Teacher N/A' : 'Unassigned')})</span></li>
                            ))}
                        </ul>
                    ) : 'None'}
                  </TableCell>
                  <TableCell>{cls.secondLanguageSubjectName || 'N/A'}</TableCell>
                  <TableCell className="space-x-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEditClick(cls)} disabled={isSubmitting || isDeleting}><Edit3 className="h-4 w-4" /></Button>
                    <AlertDialog open={classToDelete?._id === cls._id} onOpenChange={(open) => !open && setClassToDelete(null)}>
                      <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(cls)} disabled={isSubmitting || isDeleting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      {classToDelete && classToDelete._id === cls._id && (
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>Delete class <span className="font-semibold">{classDisplayName(classToDelete)}</span>? This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setClassToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      )}
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          ) : (
            <div className="text-center py-6">
                <Info className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-muted-foreground">No classes found for this school.</p>
                <p className="text-xs text-muted-foreground">Use the form above to create the first class. Ensure tuition fee structures are set by Super Admin.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
