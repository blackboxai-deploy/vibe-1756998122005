import { MongoClient, Db } from 'mongodb'

// Prevent client-side usage
if (typeof window !== 'undefined') {
  throw new Error('MongoDB service can only be used server-side')
}

let client: MongoClient | null = null
let db: Db | null = null

export async function connectToMongoDB(): Promise<Db> {
  if (db) {
    return db
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set')
  }

  client = new MongoClient(uri)
  await client.connect()
  db = client.db(process.env.MONGODB_DB_NAME || 'vibe-coding-platform')
  
  return db
}

export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}

export async function getDB(): Promise<Db> {
  if (!db) {
    return await connectToMongoDB()
  }
  return db
}
