import "server-only";
import { COLLECTIONS, ensureIndexes, getDb } from "./db";
import type { Upload } from "./types";

// Upload history in MongoDB: the stats of every manifest pushed to Square (never the sheet itself).

const LIMIT = 500;

async function uploads() {
  await ensureIndexes();
  return (await getDb()).collection<Upload>(COLLECTIONS.uploads);
}

async function list(): Promise<Upload[]> {
  return (await uploads()).find({}, { projection: { _id: 0 } }).sort({ at: -1 }).limit(LIMIT).toArray();
}

/** Newest first. If the database is unreachable the pages still render, empty, and the header shows the error. */
export async function readHistory(): Promise<Upload[]> {
  try {
    return await list();
  } catch (e) {
    console.error("[history] read failed:", e);
    return [];
  }
}

export async function addUpload(u: Upload): Promise<Upload[]> {
  await (await uploads()).insertOne({ ...u });
  return list();
}

export async function removeUpload(id: string): Promise<Upload[]> {
  await (await uploads()).deleteOne({ id });
  return list();
}
