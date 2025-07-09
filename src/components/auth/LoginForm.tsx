
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { School, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { loginUser, type LoginResult } from "@/app/actions/auth";
import { useState } from "react";

const formSchema = z.object({
  identifier: z.string().min(1, { message: "Email or Admission Number is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const result: LoginResult = await loginUser(values);

      if (result.success && result.user) {
        toast({
          title: "Login Successful",
          description: result.message || "Redirecting to dashboard...",
        });
        
        localStorage.setItem('loggedInUser', JSON.stringify(result.user));
        
        
        if (result.user.role === 'superadmin') {
          router.push("/dashboard/super-admin");
        } else if (result.user.role === 'admin') {
          router.push("/dashboard/admin");
        } else if (result.user.role === 'teacher') {
          router.push("/dashboard/teacher");
        } else if (result.user.role === 'student') {
          router.push("/dashboard/student");
        } else {
          router.push("/dashboard"); 
        }
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: result.error || "An unknown error occurred.",
        });
      }
    } catch (error) {
      console.error("Login form submission error:", error);
      toast({
        variant: "destructive",
        title: "Login Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground">
          <School size={32} />
        </div>
        <CardTitle className="text-3xl font-bold">Scholr</CardTitle>
        <CardDescription>Login to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email / Admission No.</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your email or admission number" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
