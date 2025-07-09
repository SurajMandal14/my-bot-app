
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCircle, Save, Loader2, Image as ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import type { AuthUser, UpdateProfileFormData } from "@/types/user"; 
import { updateProfileFormSchema } from "@/types/user";
import { updateUserProfile } from "@/app/actions/profile";


export default function ProfilePage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial load
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission

  const form = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      avatarUrl: "",
    },
  });

  // Effect to load user from localStorage and set form defaults
  useEffect(() => {
    setIsLoading(true);
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role) {
          setAuthUser(parsedUser);
          form.reset({
            name: parsedUser.name || "",
            // email: parsedUser.email || "", // Email is not part of UpdateProfileFormData
            phone: (parsedUser as any).phone || "", 
            avatarUrl: parsedUser.avatarUrl || "",
          });
        } else {
          setAuthUser(null);
        }
      } catch (e) {
        console.error("Failed to parse user from localStorage:", e);
        setAuthUser(null);
        toast({ variant: "destructive", title: "Session Error", description: "Failed to load user data." });
      }
    } else {
      setAuthUser(null);
    }
    setIsLoading(false);
  }, [form, toast]);

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
        
        // Create the new authUser state based on the server response
        const updatedAuthUser: AuthUser = {
            _id: result.user._id!, // server returns _id as string
            name: result.user.name!,
            email: result.user.email!, 
            role: result.user.role!,
            schoolId: result.user.schoolId,
            classId: result.user.classId,
            avatarUrl: result.user.avatarUrl,
            // phone: result.user.phone, // AuthUser type doesn't include phone currently
        };
        // Add phone to the object if it exists (for full user object in localStorage if needed)
        // This is a bit of a hack as AuthUser type doesn't have phone, but localStorage might store more.
        const fullUserForStorage = { ...updatedAuthUser, phone: result.user.phone };


        setAuthUser(updatedAuthUser); // Update local state for UI reactivity
        localStorage.setItem('loggedInUser', JSON.stringify(fullUserForStorage)); // Update localStorage

        // Update form with potentially sanitized/defaulted values from server (e.g. avatarUrl cleared)
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

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please log in to view your profile.</p>
           <Button asChild className="mt-4" onClick={() => window.location.href = '/'}>Go to Login</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <UserCircle className="mr-2 h-6 w-6" /> User Profile
          </CardTitle>
          <CardDescription>View and update your personal information.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={currentAvatarUrl || "https://placehold.co/128x128.png"} alt={authUser.name} data-ai-hint="profile avatar" />
              <AvatarFallback>{authUser.name ? authUser.name.substring(0, 2).toUpperCase() : "U"}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{form.watch("name") || authUser.name}</CardTitle>
              <p className="text-muted-foreground">{authUser.email}</p>
              <p className="text-sm text-muted-foreground capitalize">
                Role: {authUser.role}
                {authUser.schoolId && ` (School ID: ${authUser.schoolId.toString().substring(0,8)}...)`}
                {authUser.classId && ` (Class: ${authUser.classId})`}
              </p>
            </div>
          </div>
        </CardHeader>
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
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input placeholder="your.email@example.com" value={authUser.email} disabled />
                </FormControl>
                <FormDescription>Email address cannot be changed through this form.</FormDescription>
              </FormItem>
              
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
