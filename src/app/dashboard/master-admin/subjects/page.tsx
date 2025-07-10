
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookCopy, PlusCircle, Edit3, Trash2, Loader2, XCircle, Info } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { createSubject, getSubjects, updateSubject, deleteSubject } from "@/app/actions/subjects";
import type { Subject, SubjectFormData } from "@/types/subject";
import { subjectSchema } from "@/types/subject";
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';
import type { AuthUser } from "@/types/user";

export default function MasterAdminSubjectsPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<Omit<SubjectFormData, 'schoolId'>>({
    resolver: zodResolver(subjectSchema.omit({ schoolId: true })),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined") {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        if (parsedUser.role === 'masteradmin' && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        } else {
          setAuthUser(null);
        }
      } catch (e) {
        setAuthUser(null);
        console.error("Failed to parse user", e);
      }
    } else {
      setAuthUser(null);
    }
  }, []);

  const fetchSubjects = useCallback(async () => {
    if (!authUser?.schoolId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const result = await getSubjects(authUser.schoolId);
    if (result.success && result.subjects) {
      setSubjects(result.subjects);
    } else {
      toast({ variant: "destructive", title: "Failed to load subjects", description: result.message });
      setSubjects([]);
    }
    setIsLoading(false);
  }, [toast, authUser]);

  useEffect(() => {
    if (authUser) {
      fetchSubjects();
    } else {
      setIsLoading(false);
    }
  }, [authUser, fetchSubjects]);

  useEffect(() => {
    if (editingSubject) {
      form.reset({ name: editingSubject.name || "" });
    } else {
      form.reset({ name: "" });
    }
  }, [editingSubject, form]);

  async function onSubmit(values: Omit<SubjectFormData, 'schoolId'>) {
    if (!authUser?.schoolId) {
      toast({ variant: "destructive", title: "Error", description: "Your account is not assigned to a school." });
      return;
    }
    
    const payload: SubjectFormData = { ...values, schoolId: authUser.schoolId };

    setIsSubmitting(true);
    const result = editingSubject
      ? await updateSubject(editingSubject._id, payload)
      : await createSubject(payload);
    
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: editingSubject ? "Subject Updated" : "Subject Created", description: result.message });
      setEditingSubject(null);
      fetchSubjects();
    } else {
      toast({ variant: "destructive", title: `Error`, description: result.message });
    }
  }

  const handleConfirmDelete = async () => {
    if (!subjectToDelete || !authUser?.schoolId) return;
    setIsDeleting(true);
    const result = await deleteSubject(subjectToDelete._id, authUser.schoolId);
    setIsDeleting(false);
    if (result.success) {
      toast({ title: "Subject Deleted", description: result.message });
      fetchSubjects();
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
    }
    setSubjectToDelete(null);
  };

  if (!authUser && !isLoading) {
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
            <BookCopy className="mr-2 h-6 w-6" /> Subjects List for Your School
          </CardTitle>
          <CardDescription>Manage the list of subjects available for your assigned school.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingSubject ? `Edit Subject: ${editingSubject.name}` : "Add New Subject"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Mathematics" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>
              <div className="flex gap-2 items-center">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingSubject ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {editingSubject ? "Update Subject" : "Create Subject"}
                </Button>
                {editingSubject && (
                  <Button type="button" variant="outline" onClick={() => setEditingSubject(null)} disabled={isSubmitting}>
                    <XCircle className="mr-2 h-4 w-4" /> Cancel Edit
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing Subjects</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading subjects...</p></div>
          ) : subjects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject._id}>
                    <TableCell>{subject.name}</TableCell>
                    <TableCell>{format(new Date(subject.createdAt), "PP")}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingSubject(subject)} disabled={isSubmitting || isDeleting}><Edit3 className="h-4 w-4" /></Button>
                      <AlertDialog open={subjectToDelete?._id === subject._id} onOpenChange={(open) => !open && setSubjectToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setSubjectToDelete(subject)} disabled={isSubmitting || isDeleting}><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the subject <span className="font-semibold">{subjectToDelete?.name}</span>. This action can only be performed if the subject is not currently assigned to any classes.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setSubjectToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Subject</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6">
                <Info className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-muted-foreground">No subjects found for your school.</p>
                <p className="text-xs text-muted-foreground">Use the form above to create the first subject.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
