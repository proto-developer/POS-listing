import { Uploader } from "@/components/uploader";
import { status } from "@/lib/square";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload · Lister" };

export default async function UploadPage() {
  return <Uploader square={await status()} />;
}
