
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, File, Loader2, ArrowRight, Wand2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { mapStudentData, type StudentDataMappingOutput } from '@/ai/flows/map-student-data-flow';

export default function StudentImportPage() {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [headers, setHeaders] = useState<string[]>([]);
    const [sampleData, setSampleData] = useState<any[][]>([]);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    
    const [isMapping, setIsMapping] = useState(false);
    const [mappedData, setMappedData] = useState<StudentDataMappingOutput | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setIsLoadingFile(true);
        const selectedFile = event.target.files?.[0];

        if (!selectedFile) {
            setIsLoadingFile(false);
            return;
        }

        const allowedTypes = [
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/csv"
        ];

        if (!allowedTypes.includes(selectedFile.type)) {
            toast({
                variant: 'destructive',
                title: 'Invalid File Type',
                description: 'Please upload an Excel (.xls, .xlsx) or CSV file.',
            });
            event.target.value = '';
            setFile(null);
            setFileName('');
            setIsLoadingFile(false);
            return;
        }

        setFile(selectedFile);
        setFileName(selectedFile.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (Array.isArray(jsonData) && jsonData.length > 1) {
                    // FIX: Filter out null, undefined, and empty string headers
                    const extractedHeaders = (jsonData[0] as any[])
                        .map(h => h ? String(h).trim() : '')
                        .filter(h => h); 

                    const extractedData = jsonData.slice(1, 6); // Get up to 5 sample rows

                    setHeaders(extractedHeaders);
                    setSampleData(extractedData as any[][]);
                    setMappedData(null); // Reset previous mapping
                } else {
                     toast({ variant: 'destructive', title: 'Empty Sheet', description: 'The selected file sheet appears to be empty or has no data.' });
                     setHeaders([]);
                     setSampleData([]);
                }

            } catch (error) {
                toast({ variant: 'destructive', title: 'Error Reading File', description: 'There was a problem processing your file.' });
                console.error(error);
            } finally {
                setIsLoadingFile(false);
            }
        };
        reader.onerror = () => {
             toast({ variant: 'destructive', title: 'File Read Error', description: 'Could not read the selected file.' });
             setIsLoadingFile(false);
        }
        reader.readAsArrayBuffer(selectedFile);
    };

    const handleMapData = async () => {
        if (!headers.length) {
            toast({ variant: 'warning', title: 'No Data', description: 'No data to map. Please upload a valid file first.' });
            return;
        }
        setIsMapping(true);
        try {
            const result = await mapStudentData({ headers, sampleData });
            setMappedData(result);
            toast({ title: "AI Mapping Complete", description: "Please review the proposed mappings." });
        } catch (error) {
            console.error("AI Mapping Error:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'AI Mapping Failed', description: errorMessage });
            setMappedData(null);
        } finally {
            setIsMapping(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center">
                        <UploadCloud className="mr-2 h-6 w-6" /> Import Students from File
                    </CardTitle>
                    <CardDescription>
                        Upload an Excel or CSV file with student data. Our AI will help you map the columns to the correct database fields.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 1: Upload File</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Label htmlFor="file-upload">Select Excel or CSV File</Label>
                                <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx, .xls, .csv" disabled={isLoadingFile || isMapping}/>
                            </div>
                            {isLoadingFile && <div className="mt-4 flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Processing file...</div>}
                            {fileName && !isLoadingFile && <div className="mt-4 flex items-center text-sm text-green-600"><File className="mr-2 h-4 w-4"/>{fileName} ready.</div>}
                        </CardContent>
                    </Card>
                    
                    {headers.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Step 2: Map Columns</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={handleMapData} disabled={isMapping || isLoadingFile} className="w-full">
                                    {isMapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                                    Run AI Mapping
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
                
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>File Preview & Mapping</CardTitle>
                            <CardDescription>
                                {headers.length > 0 ? "Review your uploaded data and the AI-generated mapping below." : "Upload a file to see a preview of its headers and data here."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {headers.length > 0 ? (
                                <div className="space-y-4">
                                     <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sampleData.map((row, rowIndex) => (
                                                    <TableRow key={rowIndex}>
                                                        {headers.map((header, colIndex) => (
                                                            <TableCell key={`${header}-${colIndex}`}>{row[colIndex]}</TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Showing first {sampleData.length} rows as a sample.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg text-center p-4">
                                    <Info className="h-10 w-10 text-muted-foreground mb-2"/>
                                    <p className="text-muted-foreground">Your file preview will appear here.</p>
                                </div>
                            )}

                            {isMapping && (
                                <div className="mt-4 flex justify-center items-center h-32">
                                     <Loader2 className="mr-2 h-6 w-6 animate-spin"/> Mapping columns with AI...
                                </div>
                            )}
                            {mappedData && !isMapping && (
                                <div className="mt-6">
                                    <h3 className="font-semibold text-lg mb-2">Review Mapping</h3>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Spreadsheet Column</TableHead>
                                                    <TableHead>Database Field</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {Object.entries(mappedData).map(([header, dbField]) => (
                                                    <TableRow key={header}>
                                                        <TableCell>{header}</TableCell>
                                                        <TableCell className="flex items-center gap-2">
                                                            <ArrowRight className="h-4 w-4 text-muted-foreground"/>
                                                            {dbField ? (
                                                                <span className="font-mono text-primary bg-primary/10 px-2 py-1 rounded-md">{dbField}</span>
                                                            ) : (
                                                                <span className="italic text-muted-foreground">Will be ignored</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <Alert className="mt-4">
                                        <Wand2 className="h-4 w-4" />
                                        <AlertTitle>Mapping Review</AlertTitle>
                                        <AlertDescription>
                                            The ability to edit these mappings and finalize the import will be added next.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
