import { Uploader } from "@/components/upload/uploader";
import { squareStatus } from "@/server/square/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload · Lister" };

export default async function UploadPage() {
  return <Uploader square={await squareStatus()} />;
}
