import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Upload } from "./types";

const FILE = path.join(process.cwd(), "data", "history.json");

export async function readHistory(): Promise<Upload[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function addUpload(u: Upload) {
  const list = [u, ...(await readHistory())].slice(0, 200);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2));
  return list;
}
