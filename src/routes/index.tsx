import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PhoneShell } from "@/components/demo/PhoneShell";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Razorpay Order Link (concept)" },
      {
        name: "description",
        content:
          "Clickable prototype: AI-drafted order links with smart COD for Instagram and WhatsApp sellers.",
      },
      { property: "og:title", content: "Razorpay Order Link (concept)" },
      {
        property: "og:description",
        content:
          "Clickable prototype: AI-drafted order links with smart COD for Instagram and WhatsApp sellers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  // The demo store is seeded relative to "now" – render on the client only to avoid hydration drift.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="min-h-dvh bg-[#e9edf3]" />;
  }
  return (
    <>
      <PhoneShell />
      <Toaster position="top-center" duration={2200} />
    </>
  );
}
