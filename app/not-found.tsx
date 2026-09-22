import Link from "next/link";
import { connection } from "next/server";

export default async function NotFound() {
  // Same reason as app/page.tsx: the nonce in the CSP can only be applied
  // while rendering for a real request, so this route must not be prerendered.
  await connection();

  return (
    <main className="planner-bg flex min-h-screen flex-1 items-center">
      <div className="container mx-auto flex max-w-[1420px] flex-col gap-4 px-5 py-12 lg:px-10">
        <p className="micro-label">Error 404</p>
        <h1 className="text-4xl">This page does not exist.</h1>
        <p className="text-muted-foreground">
          The page you were looking for was moved or never existed.
        </p>
        <Link href="/" className="micro-label underline underline-offset-4">
          Back to the planner
        </Link>
      </div>
    </main>
  );
}
