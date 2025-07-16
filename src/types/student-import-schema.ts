export const dbSchemaFields = [
    // Admission Details
    'name', 
    'dob', 
    'bloodGroup',
    'nationality',
    'religion',
    'caste',
    'subcaste',
    'aadharNo',
    'identificationMarks',
    
    // Address Details (flattened for mapping)
    'presentAddress_houseNo',
    'presentAddress_street',
    'presentAddress_village',
    'presentAddress_mandal',
    'presentAddress_district',
    'presentAddress_state',
    'permanentAddress_houseNo',
    'permanentAddress_street',
    'permanentAddress_village',
    'permanentAddress_mandal',
    'permanentAddress_district',
    'permanentAddress_state',

    // Parent/Guardian Details
    'fatherName', 
    'motherName',
    'fatherMobile',
    'motherMobile',
    'fatherAadhar',
    'motherAadhar',
    'fatherQualification',
    'motherQualification',
    'fatherOccupation',
    'motherOccupation',
    'rationCardNumber',

    // Academic & Other Details
    'classId', // Will be class name from sheet
    'academicYear',
    'previousSchool',
    'isTcAttached',
    'childIdNumber',
    'motherTongue',
    'dateOfJoining',
    
    // System & Account Details
    'admissionId',
    'email',
    'password',
    'phone', // General contact phone
];
