// src/lib/mongodb.ts
import { MongoClient, ServerApiVersion, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'campusflow'; // Default to 'campusflow' if not set

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Routeusage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedClient: MongoClient | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    // Check if the client is still connected
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      return { client: cachedClient, db: cachedDb };
    } catch (e) {
      console.warn("Cached MongoDB client connection lost. Reconnecting...");
      cachedClient = null;
      cachedDb = null;
    }
  }

  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    console.log("Successfully connected to MongoDB Atlas!");

    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error('Failed to connect to MongoDB Atlas', error);
    throw error;
  }
}

// Optional: A helper to quickly get the Db instance
export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}
