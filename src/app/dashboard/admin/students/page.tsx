
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Users, PlusCircle, Edit3, Trash2, Search, Loader2, UserPlus, BookUser, XCircle, SquarePen, DollarSign, Bus, Info, CalendarIcon, UserMinus, UserCheck, UserCircle2, ChevronsUpDown, Contact, GraduationCap, Home, Heart, ShieldQuestion, CalendarClock, Upload, ArrowUpDown } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
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
    updateSchoolUserFormSchema, type UpdateSchoolUserFormData,
    CasteOptions
} from '@/types/user';
import { getSchoolById } from "@/app/actions/schools";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";
import type { User as AppUser } from "@/types/user";
import type { School, TermFee } from "@/types/school";
import { useEffect, useState, useCallback, useMemo } from "react";
import { format } from 'date-fns';
import type { AuthUser } from "@/types/attendance";
import Link from "next/link";

type SchoolStudent = Partial<AppUser>; 
type SortableKeys = 'name' | 'admissionId' | 'classId' | 'status';


interface ClassOption {
  value: string; 
  label: string; 
  name?: string; 
  section?: string;
}

const getCurrentAcademicYear = (): string => {
  const today = new Date();
  const currentMonth = today.getMonth(); // 0 (Jan) to 11 (Dec)
  // Assuming academic year starts in June (month 5)
  if (currentMonth >= 5) { 
    return `${today.getFullYear()}-${today.getFullYear() + 1}`;
  } else { 
    return `${today.getFullYear() - 1}-${today.getFullYear()}`;
  }
};

export default function AdminStudentManagementPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(null); 
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [allSchoolStudents, setAllSchoolStudents] = useState<SchoolStudent[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingStudent, setEditingStudent] = useState<SchoolStudent | null>(null);
  const [userToUpdate, setUserToUpdate] = useState<SchoolStudent | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [isStatusUpdateLoading, setIsStatusUpdateLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });


  const currentForm = useForm<CreateSchoolUserFormData>({
    resolver: async (data, context, options) => {
        // Use update schema if we are editing, create schema otherwise
        const schema = editingStudent ? updateSchoolUserFormSchema : createSchoolUserFormSchema;
        return zodResolver(schema)(data, context, options);
    },
    defaultValues: { 
        name: "", email: "", password: "", admissionId: "", classId: "", role: 'student',
        academicYear: getCurrentAcademicYear(),
        enableBusTransport: false, busRouteLocation: "", busClassCategory: "",
        fatherName: "", motherName: "", dob: "", gender: undefined, section: "", rollNo: "", examNo: "", aadharNo: "",
        dateOfJoining: "",
        dateOfLeaving: "",
        // New detailed fields
        bloodGroup: "", nationality: "Indian", religion: "", caste: undefined, subcaste: "", pwd: 'No',
        identificationMarks: "", isPermanentSameAsPresent: false,
        presentAddress: { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
        permanentAddress: { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
        fatherMobile: "", motherMobile: "", fatherAadhar: "", motherAadhar: "",
        fatherQualification: "", motherQualification: "", fatherOccupation: "", motherOccupation: "",
        rationCardNumber: "", isTcAttached: false, previousSchool: "", childIdNumber: "", motherTongue: "",
    },
  });

  const isPermanentSameAsPresent = currentForm.watch("isPermanentSameAsPresent");
  const presentAddress = currentForm.watch("presentAddress");

  useEffect(() => {
    if (isPermanentSameAsPresent) {
      currentForm.setValue("permanentAddress", presentAddress);
    }
  }, [isPermanentSameAsPresent, presentAddress, currentForm]);

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
      const [usersResult, classesOptionsResult, academicYearsResult] = await Promise.all([
        getSchoolUsers(authUser.schoolId.toString()),
        getClassesForSchoolAsOptions(authUser.schoolId.toString()),
        getAcademicYears()
      ]);
      
      if (usersResult.success && usersResult.users) {
        setAllSchoolStudents(usersResult.users.filter(u => u.role === 'student'));
      }
      
      setClassOptions(classesOptionsResult);
      
      if (academicYearsResult.success && academicYearsResult.academicYears) {
        setAcademicYears(academicYearsResult.academicYears);
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

  const handleClassChange = (classIdValue: string) => {
    const NONE_CLASS_VALUE = "__NONE_CLASS_ID__"; 
    currentForm.setValue('classId', classIdValue === NONE_CLASS_VALUE ? "" : classIdValue);
    const selectedClass = classOptions.find(opt => opt.value === classIdValue);
    currentForm.setValue('section', selectedClass?.section || '');
  };

  useEffect(() => {
    if (isFormOpen && editingStudent) {
      // Ensure all fields are correctly populated from the existing student data.
      currentForm.reset({
        name: editingStudent.name || "",
        email: editingStudent.email || "",
        password: "", // Always clear password for edit form
        role: 'student',
        admissionId: editingStudent.admissionId || "",
        classId: editingStudent.classId || "",
        academicYear: editingStudent.academicYear || getCurrentAcademicYear(),
        enableBusTransport: !!editingStudent.busRouteLocation,
        busRouteLocation: editingStudent.busRouteLocation || "",
        busClassCategory: editingStudent.busClassCategory || "",
        fatherName: editingStudent.fatherName || "",
        motherName: editingStudent.motherName || "",
        dob: editingStudent.dob ? format(new Date(editingStudent.dob), 'yyyy-MM-dd') : "",
        gender: editingStudent.gender || undefined,
        section: editingStudent.section || "",
        rollNo: editingStudent.rollNo || "",
        examNo: editingStudent.examNo || "",
        aadharNo: editingStudent.aadharNo || "",
        dateOfJoining: editingStudent.dateOfJoining ? format(new Date(editingStudent.dateOfJoining), 'yyyy-MM-dd') : "",
        dateOfLeaving: editingStudent.dateOfLeaving ? format(new Date(editingStudent.dateOfLeaving), 'yyyy-MM-dd') : "",
        bloodGroup: editingStudent.bloodGroup || "",
        nationality: editingStudent.nationality || "Indian",
        religion: editingStudent.religion || "",
        caste: editingStudent.caste || undefined,
        subcaste: editingStudent.subcaste || "",
        pwd: editingStudent.pwd || 'No',
        identificationMarks: editingStudent.identificationMarks || "",
        isPermanentSameAsPresent: false, // Default to false for editing
        presentAddress: editingStudent.presentAddress || { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
        permanentAddress: editingStudent.permanentAddress || { houseNo: "", street: "", village: "", mandal: "", district: "", state: "" },
        fatherMobile: editingStudent.fatherMobile || "",
        motherMobile: editingStudent.motherMobile || "",
        fatherAadhar: editingStudent.fatherAadhar || "",
        motherAadhar: editingStudent.motherAadhar || "",
        fatherQualification: editingStudent.fatherQualification || "",
        motherQualification: editingStudent.motherQualification || "",
        fatherOccupation: editingStudent.fatherOccupation || "",
        motherOccupation: editingStudent.motherOccupation || "",
        rationCardNumber: editingStudent.rationCardNumber || "",
        isTcAttached: !!editingStudent.isTcAttached,
        previousSchool: editingStudent.previousSchool || "",
        childIdNumber: editingStudent.childIdNumber || "",
        motherTongue: editingStudent.motherTongue || "",
        phone: editingStudent.phone || "",
      });
    }
  }, [editingStudent, isFormOpen, currentForm]);

  async function handleStudentSubmit(values: CreateSchoolUserFormData) {
    if (!authUser?.schoolId) return;
    setIsSubmitting(true);
    
    const payload = { ...values, role: 'student' as 'student' };
    
    const result = editingStudent 
      ? await updateSchoolUser(editingStudent._id!.toString(), authUser.schoolId.toString(), payload as UpdateSchoolUserFormData)
      : await createSchoolUser(payload, authUser.schoolId.toString());

    setIsSubmitting(false);
    if (result.success) {
      toast({ title: editingStudent ? "Student Updated" : "Student Created", description: result.message });
      currentForm.reset();
      setIsFormOpen(false);
      setEditingStudent(null);
      fetchInitialData(); 
    } else {
      toast({ variant: "destructive", title: "Operation Failed", description: result.error || result.message });
    }
  }

  const handleEditClick = (student: SchoolStudent) => { setEditingStudent(student); setIsFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleAddClick = () => { setEditingStudent(null); currentForm.reset(); setIsFormOpen(true); };
  const handleCancelClick = () => { setIsFormOpen(false); setEditingStudent(null); };
  const handleActionClick = (user: SchoolStudent) => { setUserToUpdate(user); setIsActionDialogOpen(true); };
  
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
  
  const getClassNameFromId = useCallback((classId: string | undefined): string => {
    return classOptions.find(cls => cls.value === classId)?.label || 'N/A';
  }, [classOptions]);
  
  const handleSort = (key: SortableKeys) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  const filteredAndSortedStudents = useMemo(() => {
    let processableStudents = [...allSchoolStudents];
    
    // Filtering
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      processableStudents = processableStudents.filter(student => 
        student.name?.toLowerCase().includes(lowercasedFilter) ||
        student.admissionId?.toLowerCase().includes(lowercasedFilter)
      );
    }
    
    // Sorting
    processableStudents.sort((a, b) => {
      const { key, direction } = sortConfig;
      
      const aValue = (key === 'classId' ? getClassNameFromId(a[key]) : a[key]) || '';
      const bValue = (key === 'classId' ? getClassNameFromId(b[key]) : b[key]) || '';

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return processableStudents;
  }, [allSchoolStudents, searchTerm, sortConfig, getClassNameFromId]);
  
  const renderSortIcon = (columnKey: SortableKeys) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const FormFields = (
    <div className="space-y-8">
      <Card><CardHeader><CardTitle className="flex items-center text-xl"><GraduationCap className="mr-2 h-6 w-6 text-primary"/>Admission Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FormField control={currentForm.control} name="name" render={({ field }) => (<FormItem className="lg:col-span-2"><FormLabel>Full Name of the Student</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="dob" render={({ field }) => (<FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field}/></FormControl><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="bloodGroup" render={({ field }) => (<FormItem><FormLabel>Blood Group</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem><SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem><SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem><SelectItem value="O+">O+</SelectItem><SelectItem value="O-">O-</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="nationality" render={({ field }) => (<FormItem><FormLabel>Nationality</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="religion" render={({ field }) => (<FormItem><FormLabel>Religion</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Hinduism">Hinduism</SelectItem><SelectItem value="Islam">Islam</SelectItem><SelectItem value="Christianity">Christianity</SelectItem><SelectItem value="Sikhism">Sikhism</SelectItem><SelectItem value="Buddhism">Buddhism</SelectItem><SelectItem value="Jainism">Jainism</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="caste" render={({ field }) => (<FormItem><FormLabel>Caste</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Caste" /></SelectTrigger></FormControl><SelectContent>{CasteOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="subcaste" render={({ field }) => (<FormItem><FormLabel>Subcaste</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="pwd" render={({ field }) => (<FormItem><FormLabel>PwD (Persons with Disabilities)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="No">No</SelectItem><SelectItem value="Yes">Yes</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="aadharNo" render={({ field }) => (<FormItem><FormLabel>Aadhar Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
          <FormField control={currentForm.control} name="identificationMarks" render={({ field }) => (<FormItem className="lg:col-span-2"><FormLabel>Identification Marks</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage/></FormItem>)}/>
        </CardContent>
      </Card>
      
      <Card><CardHeader><CardTitle className="flex items-center text-xl"><Home className="mr-2 h-6 w-6 text-primary"/>Address Details</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <Separator/>
          <p className="font-medium">Present Address</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField control={currentForm.control} name="presentAddress.houseNo" render={({ field }) => (<FormItem><FormLabel>House No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="presentAddress.street" render={({ field }) => (<FormItem><FormLabel>Street</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="presentAddress.village" render={({ field }) => (<FormItem><FormLabel>Village</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="presentAddress.mandal" render={({ field }) => (<FormItem><FormLabel>Mandal</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="presentAddress.district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="presentAddress.state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
          </div>
          <Separator/>
          <div className="flex items-center justify-between">
            <p className="font-medium">Permanent Address</p>
            <FormField control={currentForm.control} name="isPermanentSameAsPresent" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange}/></FormControl><FormLabel className="font-normal">Same as Present Address</FormLabel></FormItem>)}/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField control={currentForm.control} name="permanentAddress.houseNo" render={({ field }) => (<FormItem><FormLabel>House No</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="permanentAddress.street" render={({ field }) => (<FormItem><FormLabel>Street</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="permanentAddress.village" render={({ field }) => (<FormItem><FormLabel>Village</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="permanentAddress.mandal" render={({ field }) => (<FormItem><FormLabel>Mandal</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="permanentAddress.district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="permanentAddress.state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} disabled={isPermanentSameAsPresent} /></FormControl></FormItem>)}/>
          </div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="flex items-center text-xl"><Users className="mr-2 h-6 w-6 text-primary"/>Parent/Guardian Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <FormField control={currentForm.control} name="fatherName" render={({ field }) => (<FormItem><FormLabel>Father's/Guardian's Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
            <FormField control={currentForm.control} name="motherName" render={({ field }) => (<FormItem><FormLabel>Mother's Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
            <FormField control={currentForm.control} name="fatherMobile" render={({ field }) => (<FormItem><FormLabel>Mobile Number (Father/Guardian)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="motherMobile" render={({ field }) => (<FormItem><FormLabel>Mobile Number (Mother)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="fatherAadhar" render={({ field }) => (<FormItem><FormLabel>Aadhar (Father/Guardian)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="motherAadhar" render={({ field }) => (<FormItem><FormLabel>Aadhar (Mother)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="fatherQualification" render={({ field }) => (<FormItem><FormLabel>Qualification (Father/Guardian)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="motherQualification" render={({ field }) => (<FormItem><FormLabel>Qualification (Mother)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="fatherOccupation" render={({ field }) => (<FormItem><FormLabel>Occupation (Father/Guardian)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="motherOccupation" render={({ field }) => (<FormItem><FormLabel>Occupation (Mother)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="rationCardNumber" render={({ field }) => (<FormItem><FormLabel>Ration Card Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
        </CardContent>
      </Card>
      
      <Card><CardHeader><CardTitle className="flex items-center text-xl"><ShieldQuestion className="mr-2 h-6 w-6 text-primary"/>Academic & Other Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField control={currentForm.control} name="classId" render={({ field }) => (<FormItem><FormLabel>Class in which admitted</FormLabel><Select onValueChange={handleClassChange} value={field.value} disabled={classOptions.length === 0}><FormControl><SelectTrigger><SelectValue placeholder={classOptions.length > 0 ? "Select class" : "No classes available"} /></SelectTrigger></FormControl><SelectContent>{classOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent></Select><FormMessage/></FormItem>)}/>
            <FormField
              control={currentForm.control}
              name="academicYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Academic Year of Admission</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value} disabled={academicYears.length === 0}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder={academicYears.length > 0 ? "Select year" : "No years available"} />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {academicYears.map((year) => (
                                <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={currentForm.control} name="previousSchool" render={({ field }) => (<FormItem className="lg:col-span-1"><FormLabel>Details of school last admitted to</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="childIdNumber" render={({ field }) => (<FormItem><FormLabel>Child ID Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="motherTongue" render={({ field }) => (<FormItem><FormLabel>Mother Tongue of Pupil</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
            <FormField control={currentForm.control} name="dateOfJoining" render={({ field }) => (<FormItem><FormLabel>Date of Joining</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)}/>
            {editingStudent && <FormField control={currentForm.control} name="dateOfLeaving" render={({ field }) => (<FormItem><FormLabel>Date of Leaving</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)}/>}
            <FormField control={currentForm.control} name="isTcAttached" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 lg:col-span-3"><div className="space-y-0.5"><FormLabel>Whether TC or Record Sheet Attached</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange}/></FormControl></FormItem>)}/>
        </CardContent>
      </Card>

       <Card><CardHeader><CardTitle className="flex items-center text-xl"><Contact className="mr-2 h-6 w-6 text-primary"/>System & Account Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={currentForm.control} name="admissionId" render={({ field }) => (<FormItem><FormLabel>Admission ID (for Login)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)}/>
            <FormField control={currentForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage/></FormItem>)}/>
            <FormField control={currentForm.control} name="password" render={({ field }) => (
                <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                        {editingStudent ? "Leave blank to keep current password." : "A password is required for new students."}
                    </FormDescription>
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
      <Card><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><BookUser className="mr-2 h-6 w-6" /> Student Management</CardTitle><CardDescription>Manage student accounts for {schoolDetails?.schoolName || "your school"}.</CardDescription></CardHeader></Card>

      {isFormOpen ? (
        <Card><CardHeader><CardTitle className="flex items-center">{editingStudent ? <><Edit3 className="mr-2 h-5 w-5"/>Edit Student: {editingStudent.name}</> : <><UserPlus className="mr-2 h-5 w-5"/>Add New Student</>}</CardTitle><CardDescription>{editingStudent ? `Update the details for ${editingStudent.name}.` : "Fill out the form below to add a new student."}</CardDescription></CardHeader>
          <CardContent>
            <Form {...currentForm}><form onSubmit={currentForm.handleSubmit(handleStudentSubmit)} className="space-y-6">{FormFields}<div className="flex gap-2 pt-4"><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingStudent ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}{editingStudent ? "Update Student" : "Add Student"}</Button><Button type="button" variant="outline" onClick={handleCancelClick} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4" />Cancel</Button></div></form></Form>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle>Student List</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input placeholder="Filter by Name or Adm. No..." className="w-full sm:max-w-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={isLoadingData || !allSchoolStudents.length}/>
              <Button asChild variant="outline">
                  <Link href="/dashboard/admin/students/import"><Upload className="mr-2 h-4 w-4" /> Import Students</Link>
              </Button>
              <Button onClick={handleAddClick}><UserPlus className="mr-2 h-4 w-4"/>Add New Student</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (<div className="flex items-center justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading students...</p></div>
          ) : filteredAndSortedStudents.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('name')}>Name {renderSortIcon('name')}</Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('admissionId')}>Admission ID {renderSortIcon('admissionId')}</Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('classId')}>Class {renderSortIcon('classId')}</Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('status')}>Status {renderSortIcon('status')}</Button>
                </TableHead>
                <TableHead>Joining Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedStudents.map((student) => (
                <TableRow key={student._id?.toString()} className={student.status === 'discontinued' ? 'opacity-50' : ''}>
                  <TableCell>{student.name}</TableCell>
                  <TableCell>{student.admissionId || 'N/A'}</TableCell>
                  <TableCell>{getClassNameFromId(student.classId)}</TableCell>
                  <TableCell><span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${student.status === 'active' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-gray-100 text-gray-800 border border-gray-300'}`}>{student.status || 'active'}</span></TableCell>
                  <TableCell>{student.dateOfJoining ? format(new Date(student.dateOfJoining), "PP") : 'N/A'}</TableCell>
                  <TableCell className="space-x-1"><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEditClick(student)} disabled={isStatusUpdateLoading}><Edit3 className="h-4 w-4" /></Button><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleActionClick(student)} disabled={isStatusUpdateLoading}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          ) : (<p className="text-center text-muted-foreground py-4">{searchTerm ? "No students match search." : "No students found."}</p>)}
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
