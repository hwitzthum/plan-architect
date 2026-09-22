import { connection } from "next/server";

import { PlannerApp } from "@/components/planner/planner-app";

export default async function Home() {
  // The CSP in proxy.ts authorises scripts with a per-request nonce. Next.js
  // can only inject that nonce while rendering for an actual request, so this
  // page has to opt out of build-time prerendering — otherwise every script
  // tag ships without a nonce and the browser blocks all of them
  // (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
  await connection();

  return <PlannerApp />;
}
