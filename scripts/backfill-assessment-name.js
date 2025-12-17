// scripts/backfill-assessment-name.js
// Run with: MONGODB_URI="..." node scripts/backfill-assessment-name.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'campusflow';

if (!uri) {
  console.error('MONGODB_URI must be set in environment');
  process.exit(1);
}

(async () => {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db(dbName);
    const marks = db.collection('marks');

    const cursor = marks.find({ assessmentName: { $exists: false }, assessmentKey: { $exists: true }, testKey: { $exists: true } });
    let updated = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const assessmentName = `${doc.assessmentKey}-${doc.testKey}`;
      await marks.updateOne({ _id: doc._id }, { $set: { assessmentName } });
      updated++;
    }

    console.log(`Backfill completed. Updated ${updated} documents.`);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exitCode = 2;
  } finally {
    await client.close();
  }
})();
