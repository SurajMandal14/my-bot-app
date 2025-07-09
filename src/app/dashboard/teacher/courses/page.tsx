
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, PlusCircle, Trash2, Loader2, Info, FileUp } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getSubjectsForTeacher, type SubjectForTeacher } from "@/app/actions/marks";
import { createCourseMaterial, getCourseMaterialsForClass, deleteCourseMaterial } from "@/app/actions/courses";
import type { CourseMaterial, CourseMaterialFormData } from "@/types/course";
import { courseMaterialSchema } from "@/types/course";
import type { AuthUser } from "@/types/user";
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';

type CourseMaterialFormClient = Omit<CourseMaterialFormData, 'schoolId' | 'classId' | 'subjectName'>;

const formClientSchema = courseMaterialSchema.omit({ schoolId: true, classId: true, subjectName: true });

export default function TeacherCoursesPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [assignedSubjects, setAssignedSubjects] = useState<SubjectForTeacher[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [materialToDelete, setMaterialToDelete] = useState<CourseMaterial | null>(null);

  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSubjectInfo, setSelectedSubjectInfo] = useState<SubjectForTeacher | null>(null);

  const form = useForm<CourseMaterialFormClient>({
    resolver: zodResolver(formClientSchema),
    defaultValues: { title: "", pdfUrl: "" },
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser.role === 'teacher') {
            setAuthUser(parsedUser);
        }
      } catch (e) { console.error("Failed to parse user", e); }
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!authUser?.schoolId || !authUser?._id) return;
    setIsLoadingSubjects(true);
    const subjectsResult = await getSubjectsForTeacher(authUser._id, authUser.schoolId);
    setAssignedSubjects(subjectsResult);
    setIsLoadingSubjects(false);
  }, [authUser]);

  useEffect(() => {
    if (authUser?.schoolId) {
      fetchInitialData();
    }
  }, [authUser, fetchInitialData]);

  const fetchMaterialsForClass = useCallback(async (classId: string) => {
    if (!classId || !authUser?.schoolId) {
      setMaterials([]);
      return;
    }
    setIsLoadingMaterials(true);
    const result = await getCourseMaterialsForClass(classId, authUser.schoolId);
    if(result.success && result.materials) {
        setMaterials(result.materials);
    } else {
        toast({variant: 'warning', title: 'Could not load materials', description: result.message});
        setMaterials([]);
    }
    setIsLoadingMaterials(false);
  }, [toast, authUser]);


  useEffect(() => {
    if (selectedSubjectInfo?.classId) {
      fetchMaterialsForClass(selectedSubjectInfo.classId);
    } else {
      setMaterials([]);
    }
  }, [selectedSubjectInfo, fetchMaterialsForClass]);

  async function onSubmit(values: CourseMaterialFormClient) {
    if (!authUser?.schoolId || !selectedSubjectInfo) {
      toast({variant: "destructive", title: "Error", description: "User or subject selection is missing."});
      return;
    }
    setIsSubmitting(true);
    
    const payload: CourseMaterialFormData = {
        ...values,
        schoolId: authUser.schoolId.toString(),
        classId: selectedSubjectInfo.classId,
        subjectName: selectedSubjectInfo.subjectName,
    };

    const result = await createCourseMaterial(payload);
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: "Material Added", description: result.message });
      form.reset({ title: "", pdfUrl: "" });
      fetchMaterialsForClass(selectedSubjectInfo.classId);
    } else {
      toast({ variant: "destructive", title: "Failed to Add", description: result.error || result.message });
    }
  }

  const handleConfirmDelete = async () => {
    if (!materialToDelete || !authUser?.schoolId) return;
    setIsDeleting(true);
    const result = await deleteCourseMaterial(materialToDelete._id, authUser.schoolId);
    setIsDeleting(false);
    setMaterialToDelete(null);
    if (result.success) {
      toast({ title: "Deleted", description: result.message });
      if(selectedSubjectInfo) fetchMaterialsForClass(selectedSubjectInfo.classId);
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
    }
  };

  const handleSubjectSelection = (value: string) => {
      const subjectInfo = assignedSubjects.find(s => s.value === value);
      setSelectedSubjectInfo(subjectInfo || null);
  }

  if (!authUser) {
      return (
        <Card>
            <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
            <CardContent><p>Please log in as a Teacher.</p></CardContent>
        </Card>
      )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileUp className="mr-2 h-6 w-6" /> Course Materials
          </CardTitle>
          <CardDescription>
            Upload and manage PDF course materials for your assigned subjects.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Course Material</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormItem>
                    <FormLabel>Select Subject (and Class)</FormLabel>
                    <Select onValueChange={handleSubjectSelection} value={selectedSubjectInfo?.value || ""} disabled={isLoadingSubjects || assignedSubjects.length === 0}>
                      <FormControl><SelectTrigger><SelectValue placeholder={isLoadingSubjects ? "Loading subjects..." : "Select a subject"} /></SelectTrigger></FormControl>
                      <SelectContent>{assignedSubjects.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                 <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title / Topic Name</FormLabel><FormControl><Input placeholder="e.g., Chapter 1: Algebra Basics" {...field} disabled={!selectedSubjectInfo} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="pdfUrl" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>PDF URL</FormLabel><FormControl><Input type="url" placeholder="https://example.com/document.pdf" {...field} disabled={!selectedSubjectInfo}/></FormControl><FormMessage /></FormItem>)}/>
              </div>
              <Button type="submit" disabled={isSubmitting || !selectedSubjectInfo}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                Add Material
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Uploaded Materials</CardTitle>
            <CardDescription>
                {selectedSubjectInfo ? `Showing materials for ${selectedSubjectInfo.label}.` : `Please select a subject to view materials.`}
            </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMaterials ? (
            <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : materials.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Title</TableHead><TableHead>URL</TableHead><TableHead>Added On</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {materials.map(mat => (
                  <TableRow key={mat._id}>
                    <TableCell>{mat.subjectName}</TableCell>
                    <TableCell>{mat.title}</TableCell>
                    <TableCell><a href={mat.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block max-w-xs">{mat.pdfUrl}</a></TableCell>
                    <TableCell>{format(new Date(mat.createdAt), "PP")}</TableCell>
                    <TableCell>
                      <AlertDialog open={materialToDelete?._id === mat._id} onOpenChange={(open) => !open && setMaterialToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setMaterialToDelete(mat)}><Trash2 className="h-4 w-4"/></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete this material?</AlertDialogTitle><AlertDialogDescription>Delete "{materialToDelete?.title}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setMaterialToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive">{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <p className="text-center text-muted-foreground py-4">{selectedSubjectInfo ? "No materials uploaded for this subject/class yet." : "Select a subject to see materials."}</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
