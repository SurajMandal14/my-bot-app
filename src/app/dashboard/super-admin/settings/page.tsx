
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Construction, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useState } from "react";
import { resetDatabase } from "@/app/actions/database";
import { useRouter } from "next/navigation";

export default function SuperAdminSettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const handleResetDatabase = async () => {
    setIsResetting(true);
    const result = await resetDatabase();
    setIsResetting(false);
    setIsConfirmationOpen(false);

    if (result.success) {
      toast({
        title: "Database Reset Successful",
        description: result.message,
        duration: 5000,
      });
      // Optionally, force a reload or redirect to re-initialize the app state
      router.refresh(); 
    } else {
      toast({
        variant: "destructive",
        title: "Database Reset Failed",
        description: result.error || "An unexpected error occurred.",
        duration: 5000,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Settings className="mr-2 h-6 w-6" /> Platform System Settings
          </CardTitle>
          <CardDescription>
            Configure global platform settings and parameters.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5" /> Danger Zone
          </CardTitle>
          <CardDescription>
            These actions are irreversible. Please proceed with extreme caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border border-destructive/50 p-4">
            <div>
              <h3 className="font-semibold">Reset Database</h3>
              <p className="text-sm text-muted-foreground">
                This will permanently delete all data from the database,
                including schools, admins, teachers, students, fees, and marks.
                Only Super Admin accounts will be preserved.
              </p>
            </div>
            <AlertDialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-2 sm:mt-0 sm:ml-4 flex-shrink-0">
                  Reset Database
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all schools, admins, teachers, students, and associated data. 
                    <strong className="block mt-2">Only Super Admin accounts will remain.</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetDatabase}
                    disabled={isResetting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isResetting ? "Resetting..." : "I understand, reset the database"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card>
         <CardHeader>
             <CardTitle className="text-lg">Other System Settings</CardTitle>
         </CardHeader>
         <CardContent>
          <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg">
            <Construction className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground">
              More Settings Coming Soon
            </h3>
            <p className="text-muted-foreground">
              Global platform configuration options will be available here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
