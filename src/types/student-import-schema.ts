
export const dbSchemaFields = [
    // Admission Details
    'name', 
    'dob', 
    'gender',
    'bloodGroup',
    'nationality',
    'religion',
    'caste',
    'subcaste',
    'pwd',
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
    'classId', // This will be the class name (e.g., '10', 'LKG')
    'section', // This will be the section (e.g., 'A', 'B')
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
