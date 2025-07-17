

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, PlusCircle, Edit3, Trash2, Search, Loader2, UserPlus, Briefcase, XCircle, UserMinus, UserCheck, CalendarIcon, Heart, Contact, Home, GraduationCap, ShieldQuestion, Building, ArrowUpDown } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { createSchoolUser, getSchoolUsers, updateSchoolUser, deleteSchoolUser, updateUserStatus } from "@/app/actions/schoolUsers";
import { 
    createSchoolUserFormSchema, type CreateSchoolUserFormData,
    updateSchoolUserFormSchema, type UpdateSchoolUserFormData
} from '@/types/user';
import { getSchoolById } from "@/app/actions/schools";
import { getSchoolClasses } from "@/app/actions/classes"; 
import type { User as AppUser } from "@/types/user";
import type { School } from "@/types/school";
import type { SchoolClass } from "@/types/classes"; 
import { useEffect, useState, useCallback, useMemo } from "react";
import { format } from 'date-fns';
import type { AuthUser } from "@/types/attendance";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SchoolTeacher = Partial<AppUser>; 
type SortableKeys = 'name' | 'email' | 'classTeacherFor' | 'dateOfJoining';


const getCurrentAcademicYear = (): string => {
  const today = new Date();
  const currentMonth = today.getMonth();
  if (currentMonth >= 5) { 
    return `${today.getFullYear()}-${today.getFullYear() + 1}`;
  } else { 
    return `${today.getFullYear() - 1}-${today.getFullYear()}`;
  }
};

export default function AdminTeacherManagementPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(null); 
  const [managedClasses, setManagedClasses] = useState<SchoolClass[]>([]); 
  const [allSchoolTeachers, setAllSchoolTeachers] = useState<SchoolTeacher[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingTeacher, setEditingTeacher] = useState<SchoolTeacher | null>(null);
  const [userToUpdate, setUserToUpdate] = useState<SchoolTeacher | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [isStatusUpdateLoading, setIsStatusUpdateLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const form = useForm<CreateSchoolUserFormData>({
    resolver: async (data, context, options) => {
        const schema = editingTeacher ? updateSchoolUserFormSchema : createSchoolUserFormSchema;
        return zodResolver(schema)(data, context, options);
    },
    defaultValues: { 
        name: "", email: "", password: "", role: 'teacher',
        fatherName: "", motherName: "", dob: "", aadharNo: "",
        dateOfJoining: "", qualification: "",
        presentAddress: { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
        isPermanentSameAsPresent: false,
        permanentAddress: { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
    },
  });

  const isPermanentSameAsPresent = form.watch("isPermanentSameAsPresent");
  const presentAddress = form.watch("presentAddress");

  useEffect(() => {
    if (isPermanentSameAsPresent) {
      form.setValue("permanentAddress", presentAddress);
    }
  }, [isPermanentSameAsPresent, presentAddress, form]);


  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        if (parsedUser && parsedUser.role === 'admin' && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        } else {
          setAuthUser(null);
        }
      } catch (e) { setAuthUser(null); }
    } else { setAuthUser(null); }
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!authUser || !authUser.schoolId) {
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    try {
      const [schoolResult, usersResult, classesResult] = await Promise.all([
        getSchoolById(authUser.schoolId.toString()),
        getSchoolUsers(authUser.schoolId.toString()),
        getSchoolClasses(authUser.schoolId.toString()) 
      ]);

      if (schoolResult.success && schoolResult.school) {
        setSchoolDetails(schoolResult.school);
      }
      
      if (usersResult.success && usersResult.users) {
        setAllSchoolTeachers(usersResult.users.filter(u => u.role === 'teacher'));
      }

      if (classesResult.success && classesResult.classes) {
        setManagedClasses(classesResult.classes);
      }

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Unexpected error fetching data." });
    } finally {
      setIsLoadingData(false);
    }
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser?.schoolId) fetchInitialData();
    else { setIsLoadingData(false); }
  }, [authUser, fetchInitialData]);

  useEffect(() => {
    if (isFormOpen && editingTeacher) {
      form.reset({
        role: 'teacher',
        name: editingTeacher.name || "",
        email: editingTeacher.email || "",
        password: "",
        dateOfJoining: editingTeacher.dateOfJoining ? format(new Date(editingTeacher.dateOfJoining), 'yyyy-MM-dd') : "",
        dateOfLeaving: editingTeacher.dateOfLeaving ? format(new Date(editingTeacher.dateOfLeaving), 'yyyy-MM-dd') : "",
        dob: editingTeacher.dob ? format(new Date(editingTeacher.dob), 'yyyy-MM-dd') : "",
        phone: editingTeacher.phone || "",
        aadharNo: editingTeacher.aadharNo || "",
        qualification: editingTeacher.qualification || "",
        fatherName: editingTeacher.fatherName || "",
        motherName: editingTeacher.motherName || "",
        presentAddress: editingTeacher.presentAddress || { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
        isPermanentSameAsPresent: false,
        permanentAddress: editingTeacher.permanentAddress || { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
        bloodGroup: editingTeacher.bloodGroup || "",
      });
    }
  }, [editingTeacher, isFormOpen, form]);

  async function handleFormSubmit(values: CreateSchoolUserFormData) {
    if (!authUser?.schoolId) return;
    setIsSubmitting(true);
    
    const payload = { ...values, role: 'teacher' as 'teacher' };
    
    const result = editingTeacher 
      ? await updateSchoolUser(editingTeacher._id!.toString(), authUser.schoolId.toString(), payload as UpdateSchoolUserFormData)
      : await createSchoolUser(payload, authUser.schoolId.toString());

    setIsSubmitting(false);
    if (result.success) {
      toast({ title: editingTeacher ? "Teacher Updated" : "Teacher Created", description: result.message });
      form.reset();
      setIsFormOpen(false);
      setEditingTeacher(null);
      fetchInitialData(); 
    } else {
      toast({ variant: "destructive", title: "Operation Failed", description: result.error || result.message });
    }
  }

  const handleEditClick = (teacher: SchoolTeacher) => { 
    setEditingTeacher(teacher);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
  
  const handleAddClick = () => {
    setEditingTeacher(null);
    form.reset({
      role: 'teacher',
      name: "", email: "", password: "",
      fatherName: "", motherName: "", dob: "", aadharNo: "",
      dateOfJoining: "", qualification: "",
      presentAddress: { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
      isPermanentSameAsPresent: false,
      permanentAddress: { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
    });
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelClick = () => {
    setIsFormOpen(false);
    setEditingTeacher(null);
  };
  
  const handleActionClick = (user: SchoolTeacher) => {
    setUserToUpdate(user);
    setIsActionDialogOpen(true);
  };
  
  const handleStatusAction = async (status: 'active' | 'discontinued' | 'delete') => {
      if (!userToUpdate?._id || !authUser?.schoolId) return;
      setIsStatusUpdateLoading(true);

      let result;
      if (status === 'delete') {
          result = await deleteSchoolUser(userToUpdate._id.toString(), authUser.schoolId.toString());
      } else {
          result = await updateUserStatus(userToUpdate._id.toString(), authUser.schoolId.toString(), status);
      }
      
      if (result.success) {
          toast({ title: "Success", description: result.message });
          fetchInitialData();
      } else {
          toast({ variant: "destructive", title: "Failed", description: result.error || result.message });
      }
      
      setIsStatusUpdateLoading(false);
      setIsActionDialogOpen(false);
      setIsConfirmDeleteDialogOpen(false);
      setUserToUpdate(null);
  };
  
  const getClassNameFromId = useCallback((teacherId: string | undefined): string => {
    if (!teacherId) return 'N/A';
    const foundClass = managedClasses.find(cls => cls.classTeacherId === teacherId);
    return foundClass ? `${foundClass.name} - ${foundClass.section}` : 'N/A';
  }, [managedClasses]);
  
  const handleSort = (key: SortableKeys) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedTeachers = useMemo(() => {
    let processableTeachers = [...allSchoolTeachers];

    if (searchTerm) {
        const lowercasedFilter = searchTerm.toLowerCase();
        processableTeachers = processableTeachers.filter(teacher => 
            teacher.name?.toLowerCase().includes(lowercasedFilter) ||
            teacher.email?.toLowerCase().includes(lowercasedFilter)
        );
    }
    
    processableTeachers.sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue: string | number = '';
      let bValue: string | number = '';

      if (key === 'classTeacherFor') {
        aValue = getClassNameFromId(a._id);
        bValue = getClassNameFromId(b._id);
      } else {
        aValue = a[key] ?? '';
        bValue = b[key] ?? '';
      }
      
      if (key === 'dateOfJoining') {
        // Handle date sorting correctly, nulls/undefined last
        const dateA = aValue ? new Date(aValue as string).getTime() : 0;
        const dateB = bValue ? new Date(bValue as string).getTime() : 0;
        if(dateA < dateB) return direction === 'asc' ? -1 : 1;
        if(dateA > dateB) return direction === 'asc' ? 1 : -1;
        return 0;
      }
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return processableTeachers;
  }, [allSchoolTeachers, searchTerm, sortConfig, getClassNameFromId]);
  
  const renderSortIcon = (columnKey: SortableKeys) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };
  
  const TeacherFormFields = (
     <div className="space-y-8">
      <Card><CardHeader><CardTitle className="flex items-center text-xl"><Contact className="mr-2 h-6 w-6 text-primary"/>Personal Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FormField control={form.control} name="name" render={({ field }) => (<FormItem className="lg:col-span-2"><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
          <FormField control={form.control} name="dob" render={({ field }) => (<FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field}/></FormControl><FormMessage/></FormItem>)}/>
          <FormField control={form.control} name="bloodGroup" render={({ field }) => (<FormItem><FormLabel>Blood Group</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem><SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem><SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem><SelectItem value="O+">O+</SelectItem><SelectItem value="O-">O-</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="flex items-center text-xl"><Users className="mr-2 h-6 w-6 text-primary"/>Family Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="fatherName" render={({ field }) => (<FormItem><FormLabel>Father's Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
            <FormField control={form.control} name="motherName" render={({ field }) => (<FormItem><FormLabel>Mother's Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
        </CardContent>
      </Card>
      
      <Card><CardHeader><CardTitle className="flex items-center text-xl"><Home className="mr-2 h-6 w-6 text-primary"/>Address Details</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <p className="font-medium">Present Address</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField control={form.control} name="presentAddress.houseNo" render={({ field }) => (<FormItem><FormLabel>House No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="presentAddress.street" render={({ field }) => (<FormItem><FormLabel>Street</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="presentAddress.village" render={({ field }) => (<FormItem><FormLabel>Village</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="presentAddress.mandal" render={({ field }) => (<FormItem><FormLabel>Mandal</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="presentAddress.district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="presentAddress.state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
          </div>
          <Separator/>
          <div className="flex items-center justify-between">
            <p className="font-medium">Permanent Address</p>
            <FormField control={form.control} name="isPermanentSameAsPresent" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange}/></FormControl><FormLabel className="font-normal">Same as Present Address</FormLabel></FormItem>)}/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField control={form.control} name="permanentAddress.houseNo" render={({ field }) => (<FormItem><FormLabel>House No</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="permanentAddress.street" render={({ field }) => (<FormItem><FormLabel>Street</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="permanentAddress.village" render={({ field }) => (<FormItem><FormLabel>Village</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="permanentAddress.mandal" render={({ field }) => (<FormItem><FormLabel>Mandal</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="permanentAddress.district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="permanentAddress.state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
          </div>
        </CardContent>
      </Card>
      
      <Card><CardHeader><CardTitle className="flex items-center text-xl"><GraduationCap className="mr-2 h-6 w-6 text-primary"/>Professional & Account Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField control={form.control} name="qualification" render={({ field }) => (<FormItem><FormLabel>Qualification</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
            <FormField control={form.control} name="dateOfJoining" render={({ field }) => (<FormItem><FormLabel>Date of Joining</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)}/>
            {editingTeacher && <FormField control={form.control} name="dateOfLeaving" render={({ field }) => (<FormItem><FormLabel>Date of Leaving</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)}/>}
            <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="aadharNo" render={({ field }) => (<FormItem><FormLabel>Aadhar Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage/></FormItem>)}/>
            <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                    <FormDescription className="text-xs">{editingTeacher ? "Leave blank to keep current password." : "Password is required for new teachers."}</FormDescription>
                    <FormMessage/>
                </FormItem>
            )}/>
        </CardContent>
      </Card>
    </div>
  );

  if (!authUser && !isLoadingData) { 
    return <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent><p>Please log in as an admin.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><Briefcase className="mr-2 h-6 w-6" /> Teacher Management</CardTitle><CardDescription>Manage teacher accounts for {schoolDetails?.schoolName || "your school"}.</CardDescription></CardHeader></Card>

      {isFormOpen ? (
        <Card><CardHeader><CardTitle className="flex items-center">{editingTeacher ? <><Edit3 className="mr-2 h-5 w-5"/>Edit Teacher: {editingTeacher.name}</> : <><UserPlus className="mr-2 h-5 w-5"/>Add New Teacher</>}</CardTitle></CardHeader>
          <CardContent>
            <Form {...form}><form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">{TeacherFormFields}<div className="flex gap-2 pt-4"><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingTeacher ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}{editingTeacher ? "Update Teacher" : "Create Teacher"}</Button><Button type="button" variant="outline" onClick={handleCancelClick} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4" />Cancel</Button></div></form></Form>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle>Teacher List</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input placeholder="Filter by Name or Email..." className="w-full sm:max-w-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={isLoadingData || !allSchoolTeachers.length}/>
              <Button onClick={handleAddClick}><UserPlus className="mr-2 h-4 w-4"/>Add New Teacher</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (<div className="flex items-center justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading teachers...</p></div>
          ) : filteredAndSortedTeachers.length > 0 ? (
          <Table>
            <TableHeader><TableRow>
                <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('name')}>Name {renderSortIcon('name')}</Button>
                </TableHead>
                <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('email')}>Email {renderSortIcon('email')}</Button>
                </TableHead>
                <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('classTeacherFor')}>Class Teacher For {renderSortIcon('classTeacherFor')}</Button>
                </TableHead>
                <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('dateOfJoining')}>Joining Date {renderSortIcon('dateOfJoining')}</Button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredAndSortedTeachers.map((teacher) => (
                <TableRow key={teacher._id?.toString()} className={teacher.status === 'discontinued' ? 'opacity-50' : ''}>
                  <TableCell>{teacher.name}</TableCell>
                  <TableCell>{teacher.email}</TableCell>
                  <TableCell>{getClassNameFromId(teacher._id)}</TableCell>
                  <TableCell>{teacher.dateOfJoining ? format(new Date(teacher.dateOfJoining), "PP") : 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                        teacher.status === 'active' ? 'bg-green-100 text-green-800 border border-green-300' :
                        'bg-gray-100 text-gray-800 border border-gray-300'
                    }`}>
                        {teacher.status || 'active'}
                    </span>
                  </TableCell>
                  <TableCell className="space-x-1"><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEditClick(teacher)} disabled={isStatusUpdateLoading}><Edit3 className="h-4 w-4" /></Button><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleActionClick(teacher)} disabled={isStatusUpdateLoading}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          ) : (<p className="text-center text-muted-foreground py-4">{searchTerm ? "No teachers match search." : "No teachers found for this school."}</p>)}
        </CardContent>
      </Card>
      )}
      
      <AlertDialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}><AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{userToUpdate?.status === 'discontinued' ? `Reactivate ${userToUpdate?.name}?` : `Update status for ${userToUpdate?.name}?`}</AlertDialogTitle><AlertDialogDescription>{userToUpdate?.status === 'discontinued' ? "This will set the user's status back to 'active'." : "Mark user as 'Discontinued' to deactivate their account, or 'Delete Permanently' to remove all data."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setUserToUpdate(null)}>Cancel</AlertDialogCancel>{userToUpdate?.status === 'discontinued' ? (<Button variant="outline" onClick={() => handleStatusAction('active')} disabled={isStatusUpdateLoading}>{isStatusUpdateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserCheck className="mr-2 h-4 w-4"/>} Reactivate</Button>) : (<Button variant="outline" onClick={() => handleStatusAction('discontinued')} disabled={isStatusUpdateLoading}>{isStatusUpdateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserMinus className="mr-2 h-4 w-4"/>} Discontinue</Button>)}<Button variant="destructive" onClick={() => { setIsActionDialogOpen(false); setIsConfirmDeleteDialogOpen(true); }} disabled={isStatusUpdateLoading}><Trash2 className="mr-2 h-4 w-4"/> Delete Permanently</Button></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}><AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {userToUpdate?.name}. This action is irreversible.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setUserToUpdate(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleStatusAction('delete')} disabled={isStatusUpdateLoading} className="bg-destructive hover:bg-destructive/90">{isStatusUpdateLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirm Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>
  );
}
