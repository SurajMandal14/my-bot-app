
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { createSchoolAdmin, getSchoolAdmins, updateSchoolAdmin, deleteSchoolAdmin } from "@/app/actions/schoolAdminManagement";
import type { SchoolAdminFormData, AuthUser, User } from "@/types/user";
import { schoolAdminFormSchema } from "@/types/user"; 
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';
import { getSchoolById } from "@/app/actions/schools";

type SchoolAdmin = Partial<User> & { schoolName?: string };

export default function MasterAdminManageAdminsPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [admins, setAdmins] = useState<SchoolAdmin[]>([]);
  const [schoolName, setSchoolName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<SchoolAdmin | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<SchoolAdmin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<SchoolAdminFormData>({
    resolver: zodResolver(schoolAdminFormSchema),
    defaultValues: { name: "", email: "", password: "", schoolId: "", designation: "", phone: "" },
  });

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

  const fetchAdminsForSchool = useCallback(async () => {
    if (!authUser || !authUser.schoolId) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    
    const [adminsResult, schoolResult] = await Promise.all([
        getSchoolAdmins(authUser.schoolId.toString()),
        getSchoolById(authUser.schoolId.toString())
    ]);

    if (adminsResult.success && adminsResult.admins) setAdmins(adminsResult.admins);
    else toast({ variant: "destructive", title: "Failed to load admins", description: adminsResult.error || "Could not fetch admin data." });

    if (schoolResult.success && schoolResult.school) {
        setSchoolName(schoolResult.school.schoolName);
    } else {
        setSchoolName("your assigned school");
    }

    setIsLoading(false);
  }, [toast, authUser]);

  useEffect(() => { 
    if (authUser) {
      fetchAdminsForSchool(); 
      form.setValue('schoolId', authUser.schoolId || "");
    }
  }, [authUser, fetchAdminsForSchool, form]);

  useEffect(() => {
    if (editingAdmin) {
      form.reset({
        name: editingAdmin.name || "",
        email: editingAdmin.email || "",
        password: "",
        schoolId: authUser?.schoolId || "",
        designation: editingAdmin.designation || "",
        phone: editingAdmin.phone || ""
      });
    } else {
      form.reset({ name: "", email: "", password: "", schoolId: authUser?.schoolId || "", designation: "", phone: "" });
    }
  }, [editingAdmin, form, authUser]);

  async function onSubmit(values: SchoolAdminFormData) {
    if (!authUser?.schoolId) {
        toast({ variant: "destructive", title: "Error", description: "Master admin is not assigned to a school." });
        return;
    }
    setIsSubmitting(true);
    
    const result = editingAdmin && editingAdmin._id
      ? await updateSchoolAdmin(editingAdmin._id.toString(), values)
      : await createSchoolAdmin(values);
    
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: editingAdmin ? "Admin Updated" : "Admin Created", description: result.message });
      setEditingAdmin(null); 
      fetchAdminsForSchool(); 
    } else {
      toast({ variant: "destructive", title: `Error ${editingAdmin ? "Updating" : "Creating"} Admin`, description: result.error || result.message });
    }
  }

  const handleConfirmDelete = async () => {
    if (!adminToDelete?._id) return;
    setIsDeleting(true);
    const result = await deleteSchoolAdmin(adminToDelete._id.toString());
    setIsDeleting(false);
    if (result.success) {
      toast({ title: "Admin Deleted", description: result.message });
      fetchAdminsForSchool();
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
            <Users className="mr-2 h-6 w-6" /> Manage School Administrators
          </CardTitle>
          <CardDescription>Create and manage administrator accounts for <span className="font-semibold">{schoolName}</span>.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingAdmin ? `Edit Admin: ${editingAdmin.name}` : "Add New School Administrator"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Jane Doe" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="admin@schoolname.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} /></FormControl>
                    {editingAdmin && <FormDescription className="text-xs">Leave blank to keep current password.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="designation" render={({ field }) => (
                  <FormItem><FormLabel>Designation</FormLabel><FormControl><Input placeholder="e.g., Office Manager" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="e.g., 9876543210" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>
              <div className="flex gap-2 items-center">
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingAdmin ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {editingAdmin ? "Update Admin" : "Create School Admin"}
                </Button>
                {editingAdmin && <Button type="button" variant="outline" onClick={() => setEditingAdmin(null)} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4" />Cancel Edit</Button>}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing Administrators for {schoolName}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (<div className="flex items-center justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading administrators...</p></div>)
          : admins.length > 0 ? (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Designation</TableHead><TableHead>Phone</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin._id?.toString()}>
                  <TableCell>{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{admin.designation || 'N/A'}</TableCell>
                  <TableCell>{admin.phone || 'N/A'}</TableCell>
                  <TableCell className="space-x-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingAdmin(admin)} disabled={isSubmitting || isDeleting}><Edit3 className="h-4 w-4" /></Button>
                    <AlertDialog open={adminToDelete?._id === admin._id} onOpenChange={(open) => !open && setAdminToDelete(null)}>
                      <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setAdminToDelete(admin)} disabled={isSubmitting || isDeleting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete the admin account for <span className="font-semibold">{adminToDelete?.name}</span>.</AlertDialogDescription>
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
          ) : (<p className="text-center text-muted-foreground py-4">No school administrators found for this school.</p>)}
        </CardContent>
      </Card>
    </div>
  );
}
