import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <p className="text-lg font-semibold tracking-tight">Page not found</p>
        <p className="text-sm text-muted-foreground">There is nothing at this address.</p>
      </div>
      <Button asChild>
        <Link href="/">Go to Upload</Link>
      </Button>
    </div>
  );
}
