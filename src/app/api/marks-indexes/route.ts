import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const checkDuplicates = url.searchParams.get('duplicates') === '1';

    const { db } = await connectToDatabase();
    const marksCollection = db.collection('marks');

    const indexes = await marksCollection.indexes();

    let duplicates: any[] = [];
    if (checkDuplicates) {
      // Groups by composite key WITHOUT subjectId to reveal collisions across multiple subjects
      duplicates = await marksCollection.aggregate([
        {
          $group: {
            _id: {
              studentId: '$studentId',
              classId: '$classId',
              assessmentName: '$assessmentName',
              academicYear: '$academicYear',
              schoolId: '$schoolId',
            },
            subjects: { $addToSet: '$subjectId' },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $limit: 50 },
      ]).toArray();
    }

    return NextResponse.json({ success: true, indexes, duplicates });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to inspect marks indexes' }, { status: 500 });
  }
}
