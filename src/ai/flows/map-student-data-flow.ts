
'use server';

/**
 * @fileOverview An AI flow for mapping spreadsheet data to a student schema.
 * 
 * - mapStudentData - A function that takes spreadsheet headers and sample data,
 *   and returns a proposed mapping to the database schema.
 * - StudentDataMappingInput - The input type for the mapStudentData function.
 * - StudentDataMappingOutput - The return type for the mapStudentData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { dbSchemaFields } from '@/types/student-import-schema';


const StudentDataMappingInputSchema = z.object({
  headers: z.array(z.string()).describe('The header row from the uploaded spreadsheet.'),
  sampleData: z.array(z.array(z.any())).describe('The first few rows of data from the spreadsheet for context.'),
});
export type StudentDataMappingInput = z.infer<typeof StudentDataMappingInputSchema>;

// The final output format expected by the frontend.
export type StudentDataMappingOutput = Record<string, string | null>;


// The direct output from the LLM, which is an array of mapping objects.
// This is required because the structured output API prefers explicitly defined object properties.
const MappingItemSchema = z.object({
  originalHeader: z.string().describe("The exact column header from the user's spreadsheet."),
  mappedField: z.string().nullable().describe("The corresponding database field. If no match is found, this should be null."),
});

const AIOutputSchema = z.object({
  mappings: z.array(MappingItemSchema).describe("An array of objects, each mapping a spreadsheet header to a database field."),
});
type AIOutput = z.infer<typeof AIOutputSchema>;


export async function mapStudentData(input: StudentDataMappingInput): Promise<StudentDataMappingOutput> {
    return mapStudentDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'mapStudentDataPrompt',
  input: { schema: StudentDataMappingInputSchema },
  output: { schema: AIOutputSchema }, // Output is now the array-based schema
  prompt: `You are an expert data mapper. Your task is to map the column headers from an uploaded spreadsheet to a predefined database schema for student information.

Here are the available database fields:
${dbSchemaFields.join(', ')}

Here is the header row from the user's spreadsheet:
{{{json headers}}}

Here are the first few rows of data for context, to help you understand the data in each column:
{{{json sampleData}}}

Please provide a JSON object containing a "mappings" array. Each item in the array should be an object with two keys:
1. "originalHeader": The exact string from the spreadsheet header row.
2. "mappedField": The most appropriate database field name from the provided list.

- If a spreadsheet column does not correspond to any of the database fields, its "mappedField" value should be null.
- Be intelligent with the mapping. For example, 'adm_no' or 'Admission Number' should map to 'admissionId'. 'DOB' or 'Date of Birth' should map to 'dob'. 'D.O.A' should map to 'dateOfJoining'.
- **CRITICAL**: For the 'classId' field, you MUST map the standard class name. If the spreadsheet contains Roman numerals (e.g., I, II, V, X) or words (e.g., One, Two), convert them to their numeric equivalent (e.g., 1, 2, 5, 10). For example, a column named 'Class' with values 'V' should be mapped to the 'classId' field.
- Do not map columns that are clearly not part of the student schema (e.g., 'Row ID', 'Internal Notes'). Their "mappedField" value should be null.
- Ensure every header from the input is present in the output array.
`,
});

const mapStudentDataFlow = ai.defineFlow(
  {
    name: 'mapStudentDataFlow',
    inputSchema: StudentDataMappingInputSchema,
    outputSchema: z.record(z.string(), z.string().nullable()), // The final output is still the simple key-value object
  },
  async (input): Promise<StudentDataMappingOutput> => {
    // Add a check for empty headers to avoid sending empty requests
    if (input.headers.length === 0) {
      console.log("mapStudentDataFlow: Received empty headers, returning empty map.");
      return {};
    }
    
    try {
        const { output } = await prompt(input);
        if (!output || !output.mappings) {
            throw new Error("The AI model did not return a valid mapping array.");
        }
        
        // Transform the array of objects into the simple key-value record expected by the frontend.
        const finalMapping: StudentDataMappingOutput = {};
        for (const mappingItem of output.mappings) {
            finalMapping[mappingItem.originalHeader] = mappingItem.mappedField;
        }

        return finalMapping;
    } catch (error: any) {
        if (error.message && error.message.includes('503 Service Unavailable')) {
            throw new Error("The AI mapping service is currently overloaded. Please try again in a few moments.");
        }
        // Re-throw other errors
        throw error;
    }
  }
);
