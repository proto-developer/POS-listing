import "server-only";
import { MongoClient, type Db } from "mongodb";

// MongoDB connection, shared across requests and hot reloads. MONGODB_URI is required.

const uri = process.env.MONGODB_URI?.trim();
const dbName = process.env.MONGODB_DB?.trim() || "lister";

export const dbConfigured = !!uri;

declare global {
  // eslint-disable-next-line no-var
  var __listerMongo: Promise<MongoClient> | undefined;
}

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error("MONGODB_URI is not set in .env.local");
  globalThis.__listerMongo ??= new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
    .connect()
    .catch((e) => {
      globalThis.__listerMongo = undefined; // let the next request retry
      throw e;
    });
  return (await globalThis.__listerMongo).db(dbName);
}

/** Collection names in one place. */
export const COLLECTIONS = {
  uploads: "uploads", // one document per manifest upload: the stats shown on the dashboard
} as const;

/** Shape the database itself enforces for an upload record, so nothing else can write junk into it. */
const uploadSchema = {
  bsonType: "object",
  required: ["id", "file", "at", "mode", "seconds", "total", "created", "exists", "value", "skipped"],
  additionalProperties: false,
  properties: {
    _id: {},
    id: { bsonType: "string", pattern: "^[0-9a-f-]{36}$" },
    file: { bsonType: "string", maxLength: 200 },
    at: { bsonType: "string", maxLength: 40 },
    mode: { enum: ["sandbox", "live"] },
    user: { bsonType: "string", maxLength: 100 },
    seconds: { bsonType: "number", minimum: 0 },
    total: { bsonType: "number", minimum: 0 },
    created: { bsonType: "number", minimum: 0 },
    exists: { bsonType: "number", minimum: 0 },
    value: { bsonType: "number", minimum: 0 },
    skipped: {
      bsonType: "array",
      maxItems: 2000,
      items: {
        bsonType: "object",
        additionalProperties: false,
        properties: {
          row: { bsonType: ["number", "null"] },
          sku: { bsonType: "string", maxLength: 255 },
          name: { bsonType: "string", maxLength: 300 },
          reason: { bsonType: "string", maxLength: 300 },
        },
      },
    },
  },
};

let indexed: Promise<void> | null = null;
/** Create the collection, its validator and indexes once per process. */
export function ensureIndexes() {
  indexed ??= (async () => {
    const db = await getDb();
    const exists = (await db.listCollections({ name: COLLECTIONS.uploads }, { nameOnly: true }).toArray()).length > 0;
    try {
      if (exists) await db.command({ collMod: COLLECTIONS.uploads, validator: { $jsonSchema: uploadSchema }, validationLevel: "strict" });
      else await db.createCollection(COLLECTIONS.uploads, { validator: { $jsonSchema: uploadSchema }, validationLevel: "strict" });
    } catch (e: any) {
      // A read/write-only database user can't change validators; the API still validates everything itself.
      console.warn("[db] could not apply the uploads schema:", e?.message);
    }
    const uploads = db.collection(COLLECTIONS.uploads);
    await uploads.createIndex({ id: 1 }, { unique: true });
    await uploads.createIndex({ at: -1 });
  })().catch((e) => {
    indexed = null;
    throw e;
  });
  return indexed;
}

export type DbStatus = { ok: boolean; db: string; error?: string };

/** Can we reach the database? Cached for a minute so pages stay fast. */
let statusCache: { at: number; value: DbStatus } | null = null;
export async function dbStatus(): Promise<DbStatus> {
  if (!uri) return { ok: false, db: dbName, error: "MONGODB_URI is not set in .env.local" };
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  let value: DbStatus;
  try {
    await (await getDb()).command({ ping: 1 });
    value = { ok: true, db: dbName };
  } catch (e: any) {
    value = { ok: false, db: dbName, error: e?.message ?? "Cannot connect" };
  }
  statusCache = { at: Date.now(), value };
  return value;
}
