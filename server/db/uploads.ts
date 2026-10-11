/**
 * Upload history repository: the stats of every manifest pushed to Square
 * (never the sheet itself). All MongoDB access for uploads goes through here.
 */

import "server-only";
import type { Upload } from "@/lib/types";
import { COLLECTIONS, getDb, prepareDb } from "./client";

const LIMIT = 500;

async function collection() {
  await prepareDb();
  return (await getDb()).collection<Upload>(COLLECTIONS.uploads);
}

/** Newest first. Throws if the database is unreachable. */
export async function listUploads(): Promise<Upload[]> {
  return (await collection()).find({}, { projection: { _id: 0 } }).sort({ at: -1 }).limit(LIMIT).toArray();
}

/** Like listUploads, but never throws: pages still render (empty) and the header shows the error. */
export async function listUploadsSafe(): Promise<Upload[]> {
  try {
    return await listUploads();
  } catch (e) {
    console.error("[uploads] list failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

export async function createUpload(u: Upload): Promise<Upload[]> {
  await (await collection()).insertOne({ ...u });
  return listUploads();
}

export async function deleteUpload(id: string): Promise<Upload[]> {
  await (await collection()).deleteOne({ id });
  return listUploads();
}
