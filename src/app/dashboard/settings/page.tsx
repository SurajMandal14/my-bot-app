
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, Bell, Palette, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  useEffect(() => {
    // Load settings from localStorage or API on mount
    const storedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(storedDarkMode);
    if (storedDarkMode) {
      document.documentElement.classList.add('dark');
    }
    // Load other settings similarly
  }, []);

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    localStorage.setItem('darkMode', String(checked));
    if (checked) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    toast({ title: "Appearance Updated", description: `Dark mode ${checked ? 'enabled' : 'disabled'}.` });
  };

  const handleNotificationChange = (type: 'email' | 'sms', checked: boolean) => {
    if (type === 'email') setEmailNotifications(checked);
    if (type === 'sms') setSmsNotifications(checked);
    // TODO: Save notification preferences to backend
    toast({ title: "Notification Settings Updated", description: `${type.toUpperCase()} notifications ${checked ? 'enabled' : 'disabled'}.` });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Settings className="mr-2 h-6 w-6" /> Application Settings
          </CardTitle>
          <CardDescription>Manage your application preferences and settings.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" /> Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode-switch" className="flex flex-col space-y-1">
              <span>Dark Mode</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Enable dark theme for the application.
              </span>
            </Label>
            <Switch
              id="dark-mode-switch"
              checked={darkMode}
              onCheckedChange={handleDarkModeToggle}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center"><Bell className="mr-2 h-5 w-5 text-primary" /> Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
              <span>Email Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Receive important updates via email.
              </span>
            </Label>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={(checked) => handleNotificationChange('email', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sms-notifications" className="flex flex-col space-y-1">
              <span>SMS Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Receive critical alerts via SMS (if applicable).
              </span>
            </Label>
            <Switch
              id="sms-notifications"
              checked={smsNotifications}
              onCheckedChange={(checked) => handleNotificationChange('sms', checked)}
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center"><Lock className="mr-2 h-5 w-5 text-primary" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <Button variant="outline">Change Password</Button>
            <p className="text-sm text-muted-foreground">
                It's recommended to use a strong, unique password for your account.
            </p>
            {/* Placeholder for Two-Factor Authentication setup */}
            {/* <div className="flex items-center justify-between">
                <Label>Two-Factor Authentication (2FA)</Label>
                <Button variant="outline" size="sm">Setup 2FA</Button>
            </div> */}
        </CardContent>
      </Card>
    </div>
  );
}
