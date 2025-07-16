
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCircle, Save, Loader2, School as SchoolIcon, BookUser, Image as ImageIcon, Contact, Calendar, Heart, Home, Users, ShieldHalf } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import type { AuthUser, UpdateProfileFormData, User } from "@/types/user";
import { updateProfileFormSchema } from "@/types/user";
import { updateUserProfile } from "@/app/actions/profile";
import { useStudentData } from "@/contexts/StudentDataContext";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

const ProfileDetailItem = ({ label, value }: { label: string; value: string | undefined | null }) => (
  value ? (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-base">{value}</p>
    </div>
  ) : null
);

export default function StudentProfilePage() {
  const { toast } = useToast();
  const { authUser: initialAuthUser, isLoading: isContextLoading, schoolDetails } = useStudentData();
  const [authUser, setAuthUser] = useState<User | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileFormSchema),
    defaultValues: { name: "", phone: "", avatarUrl: "" },
  });

  useEffect(() => {
    // We now get the full user object from localStorage via context
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
        try {
            const parsedUser: User = JSON.parse(storedUser);
            if (parsedUser && parsedUser.role === 'student') {
                setAuthUser(parsedUser);
                form.reset({
                    name: parsedUser.name || "",
                    phone: parsedUser.phone || "",
                    avatarUrl: parsedUser.avatarUrl || "",
                });
            } else {
                setAuthUser(null);
            }
        } catch(e) {
            console.error("Profile page: Failed to parse user", e);
            setAuthUser(null);
        }
    } else {
      setAuthUser(null);
    }
  }, [initialAuthUser, form]);

  async function onSubmit(values: UpdateProfileFormData) {
    if (!authUser || !authUser._id) {
        toast({ variant: "destructive", title: "Error", description: "User session not found."});
        return;
    }
    setIsSubmitting(true);
    const result = await updateUserProfile(authUser._id.toString(), values);
    setIsSubmitting(false);

    if (result.success && result.user) {
        toast({ title: "Profile Updated", description: result.message });
        const fullUserForStorage = { ...result.user };
        setAuthUser(fullUserForStorage as User);
        localStorage.setItem('loggedInUser', JSON.stringify(fullUserForStorage));
        form.reset({
            name: result.user.name || "",
            phone: result.user.phone || "",
            avatarUrl: result.user.avatarUrl || "",
        });
    } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error || "Could not update profile." });
    }
  }

  const currentAvatarUrl = form.watch("avatarUrl") || authUser?.avatarUrl;

  if (isContextLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please log in as a student to view this page.</p>
           <Button asChild className="mt-4" onClick={() => window.location.href = '/'}>Go to Login</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={currentAvatarUrl || "https://placehold.co/128x128.png"} alt={authUser.name} data-ai-hint="profile avatar"/>
              <AvatarFallback>{authUser.name ? authUser.name.substring(0, 2).toUpperCase() : "S"}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{form.watch("name") || authUser.name}</CardTitle>
              <p className="text-muted-foreground">{authUser.email}</p>
              {schoolDetails && (
                <p className="text-sm text-muted-foreground flex items-center mt-1">
                  <SchoolIcon className="mr-1 h-4 w-4" /> {schoolDetails.schoolName}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <UserCircle className="mr-2 h-5 w-5 text-primary" /> My Profile
          </CardTitle>
          <CardDescription>
            View your personal, academic, and contact information. To change most details, please contact your school administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="space-y-6">
                {/* Personal Details */}
                <div>
                    <h3 className="text-lg font-semibold flex items-center mb-3"><Contact className="mr-2 h-5 w-5"/>Personal Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md">
                        <ProfileDetailItem label="Full Name" value={authUser.name} />
                        <ProfileDetailItem label="Date of Birth" value={authUser.dob ? format(new Date(authUser.dob), 'PPP') : 'N/A'} />
                        <ProfileDetailItem label="Gender" value={authUser.gender} />
                        <ProfileDetailItem label="Blood Group" value={authUser.bloodGroup} />
                        <ProfileDetailItem label="Nationality" value={authUser.nationality} />
                        <ProfileDetailItem label="Religion" value={authUser.religion} />
                        <ProfileDetailItem label="Caste" value={authUser.caste} />
                        <ProfileDetailItem label="Subcaste" value={authUser.subcaste} />
                        <ProfileDetailItem label="PwD" value={authUser.pwd} />
                        <ProfileDetailItem label="Aadhar Number" value={authUser.aadharNo} />
                        <ProfileDetailItem label="Mother Tongue" value={authUser.motherTongue} />
                        <ProfileDetailItem label="Identification Marks" value={authUser.identificationMarks} />
                    </div>
                </div>

                {/* Academic Details */}
                <div>
                    <h3 className="text-lg font-semibold flex items-center mb-3"><BookUser className="mr-2 h-5 w-5"/>Academic Information</h3>
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md">
                        <ProfileDetailItem label="Admission No." value={authUser.admissionId} />
                        <ProfileDetailItem label="Class" value={authUser.classId} />
                        <ProfileDetailItem label="Section" value={authUser.section} />
                        <ProfileDetailItem label="Roll No." value={authUser.rollNo} />
                        <ProfileDetailItem label="Academic Year" value={authUser.academicYear} />
                        <ProfileDetailItem label="Date of Joining" value={authUser.dateOfJoining ? format(new Date(authUser.dateOfJoining), 'PPP') : null} />
                        <ProfileDetailItem label="Previous School" value={authUser.previousSchool} />
                        <ProfileDetailItem label="Child ID Number" value={authUser.childIdNumber} />
                     </div>
                </div>

                {/* Parent/Guardian Details */}
                <div>
                    <h3 className="text-lg font-semibold flex items-center mb-3"><Users className="mr-2 h-5 w-5"/>Parent/Guardian Information</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4 border rounded-md">
                        <ProfileDetailItem label="Father's Name" value={authUser.fatherName} />
                        <ProfileDetailItem label="Mother's Name" value={authUser.motherName} />
                        <ProfileDetailItem label="Father's Mobile" value={authUser.fatherMobile} />
                        <ProfileDetailItem label="Mother's Mobile" value={authUser.motherMobile} />
                        <ProfileDetailItem label="Father's Occupation" value={authUser.fatherOccupation} />
                        <ProfileDetailItem label="Mother's Occupation" value={authUser.motherOccupation} />
                        <ProfileDetailItem label="Father's Qualification" value={authUser.fatherQualification} />
                        <ProfileDetailItem label="Mother's Qualification" value={authUser.motherQualification} />
                     </div>
                </div>

                {/* Address Details */}
                <div>
                     <h3 className="text-lg font-semibold flex items-center mb-3"><Home className="mr-2 h-5 w-5"/>Address Information</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 border rounded-md space-y-2">
                           <h4 className="font-medium">Present Address</h4>
                           <p className="text-sm text-muted-foreground">
                            {authUser.presentAddress?.houseNo}, {authUser.presentAddress?.street}<br/>
                            {authUser.presentAddress?.village}, {authUser.presentAddress?.mandal}<br/>
                            {authUser.presentAddress?.district}, {authUser.presentAddress?.state}
                           </p>
                        </div>
                         <div className="p-4 border rounded-md space-y-2">
                           <h4 className="font-medium">Permanent Address</h4>
                           <p className="text-sm text-muted-foreground">
                            {authUser.permanentAddress?.houseNo}, {authUser.permanentAddress?.street}<br/>
                            {authUser.permanentAddress?.village}, {authUser.permanentAddress?.mandal}<br/>
                            {authUser.permanentAddress?.district}, {authUser.permanentAddress?.state}
                           </p>
                        </div>
                     </div>
                </div>
           </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>Update Contact Info</CardTitle></CardHeader>
        <CardContent>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full name" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Your phone number" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="avatarUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><ImageIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Avatar URL (Optional)</FormLabel>
                        <FormControl>
                          <Input type="url" placeholder="https://example.com/avatar.png" {...field} disabled={isSubmitting}/>
                        </FormControl>
                         <FormDescription>Enter a publicly accessible URL for your avatar image. Leave blank to remove.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" /> {isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
        </CardContent>
      </Card>
    </div>
  );
}
