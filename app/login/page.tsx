import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AUTH_SETUP_MESSAGE, authConfigured } from "@/server/auth/session";

export const metadata = { title: "Sign in · Lister" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-sidebar p-6 md:p-10">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Suspense>
          <LoginForm setupMessage={authConfigured ? undefined : AUTH_SETUP_MESSAGE} />
        </Suspense>
      </div>
    </div>
  );
}
