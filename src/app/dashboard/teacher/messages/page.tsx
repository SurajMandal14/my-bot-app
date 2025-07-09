
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Paperclip, UserPlus, Info } from "lucide-react";

export default function TeacherMessagesPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <MessageSquare className="mr-2 h-6 w-6" /> Communication Center
          </CardTitle>
          <CardDescription>
            Send and receive messages with students, parents, and administration. (Feature Coming Soon)
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Conversations</CardTitle>
             <Button variant="outline" size="sm" className="mt-2 w-full" disabled>
              <UserPlus className="mr-2 h-4 w-4" /> New Conversation
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-96 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 text-center">
              <Info className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Your conversation list will appear here.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Message Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col h-[calc(24rem+2.5rem)]">
            <div className="flex-grow border-2 border-dashed rounded-lg p-4 mb-4 flex flex-col items-center justify-center text-center">
                <Info className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Select a conversation to view messages or start a new one.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" disabled><Paperclip className="h-5 w-5" /></Button>
              <Input placeholder="Type your message..." className="flex-grow" disabled/>
              <Button disabled><Send className="mr-2 h-4 w-4"/> Send</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
