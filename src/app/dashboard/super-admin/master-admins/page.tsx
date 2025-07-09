
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, PlusCircle, Edit3, Trash2, Loader2, XCircle, Building } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { createMasterAdmin, getMasterAdmins, updateMasterAdmin, deleteMasterAdmin } from "@/app/actions/masterAdmins";
import type { MasterAdminFormData, User } from "@/types/user";
import { masterAdminFormSchema } from "@/types/user";
import { getSchools } from "@/app/actions/schools";
import type { School } from "@/types/school";
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';

type MasterAdmin = Partial<User> & { schoolName?: string };

export default function SuperAdminMasterAdminsPage() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<MasterAdmin[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<MasterAdmin | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<MasterAdmin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<MasterAdminFormData>({
    resolver: zodResolver(masterAdminFormSchema),
    defaultValues: { name: "", email: "", password: "", schoolId: "" },
  });

  const fetchAdminsAndSchools = useCallback(async () => {
    setIsLoading(true);
    const [adminsResult, schoolsResult] = await Promise.all([
      getMasterAdmins(),
      getSchools()
    ]);
    
    if (adminsResult.success && adminsResult.admins) {
      setAdmins(adminsResult.admins);
    } else {
      toast({ variant: "destructive", title: "Failed to load master admins", description: adminsResult.error || "Could not fetch admin data." });
    }

    if (schoolsResult.success && schoolsResult.schools) {
        setSchools(schoolsResult.schools);
    } else {
        toast({ variant: "destructive", title: "Failed to load schools", description: schoolsResult.error || "Could not fetch school list."});
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAdminsAndSchools();
  }, [fetchAdminsAndSchools]);

  useEffect(() => {
    if (editingAdmin) {
      form.reset({
        name: editingAdmin.name || "",
        email: editingAdmin.email || "",
        password: "",
        schoolId: editingAdmin.schoolId?.toString() || "",
      });
    } else {
      form.reset({ name: "", email: "", password: "", schoolId: "" });
    }
  }, [editingAdmin, form]);

  async function onSubmit(values: MasterAdminFormData) {
    setIsSubmitting(true);
    const result = editingAdmin && editingAdmin._id
      ? await updateMasterAdmin(editingAdmin._id.toString(), values)
      : await createMasterAdmin(values);
    
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: editingAdmin ? "Master Admin Updated" : "Master Admin Created", description: result.message });
      setEditingAdmin(null); 
      fetchAdminsAndSchools(); 
    } else {
      toast({ variant: "destructive", title: `Error ${editingAdmin ? "Updating" : "Creating"} Admin`, description: result.error || result.message });
    }
  }

  const handleConfirmDelete = async () => {
    if (!adminToDelete?._id) return;
    setIsDeleting(true);
    const result = await deleteMasterAdmin(adminToDelete._id.toString());
    setIsDeleting(false);
    if (result.success) {
      toast({ title: "Master Admin Deleted", description: result.message });
      fetchAdminsAndSchools();
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.error || result.message });
    }
    setAdminToDelete(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Users className="mr-2 h-6 w-6" /> Manage Master Administrators
          </CardTitle>
          <CardDescription>Create and manage master administrator accounts for the platform.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingAdmin ? `Edit Admin: ${editingAdmin.name}` : "Add New Master Administrator"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., John Master" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="master@scholr.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="schoolId" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground"/>Assign to School</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || isLoading}>
                        <FormControl><SelectTrigger><SelectValue placeholder={isLoading ? "Loading schools..." : "Select a school"} /></SelectTrigger></FormControl>
                        <SelectContent>
                            {schools.map((school) => (<SelectItem key={school._id} value={school._id.toString()}>{school.schoolName}</SelectItem>))}
                            {schools.length === 0 && !isLoading && <SelectItem value="no-school" disabled>No schools available</SelectItem>}
                        </SelectContent>
                        </Select><FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} /></FormControl>
                    {editingAdmin && <FormDescription className="text-xs">Leave blank to keep current password.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>
              <div className="flex gap-2 items-center">
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingAdmin ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {editingAdmin ? "Update Admin" : "Create Master Admin"}
                </Button>
                {editingAdmin && <Button type="button" variant="outline" onClick={() => setEditingAdmin(null)} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4" />Cancel Edit</Button>}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing Master Administrators</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (<div className="flex items-center justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading administrators...</p></div>)
          : admins.length > 0 ? (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>School Assigned</TableHead><TableHead>Date Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin._id?.toString()}>
                  <TableCell>{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{admin.schoolName || 'N/A'}</TableCell>
                  <TableCell>{admin.createdAt ? format(new Date(admin.createdAt as string), "PP") : 'N/A'}</TableCell>
                  <TableCell className="space-x-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingAdmin(admin)} disabled={isSubmitting || isDeleting}><Edit3 className="h-4 w-4" /></Button>
                    <AlertDialog open={adminToDelete?._id === admin._id} onOpenChange={(open) => !open && setAdminToDelete(null)}>
                      <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setAdminToDelete(admin)} disabled={isSubmitting || isDeleting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete the master admin account for <span className="font-semibold">{adminToDelete?.name}</span>.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setAdminToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Admin
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          ) : (<p className="text-center text-muted-foreground py-4">No master administrators found.</p>)}
        </CardContent>
      </Card>
    </div>
  );
}
