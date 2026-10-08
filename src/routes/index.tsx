import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PhoneShell } from "@/components/demo/PhoneShell";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chat Checkout" },
      {
        name: "description",
        content:
          "Turn a buyer's chat into a payment link, with simple COD rules, for Instagram and WhatsApp sellers.",
      },
      { property: "og:title", content: "Chat Checkout" },
      {
        property: "og:description",
        content:
          "Turn a buyer's chat into a payment link, with simple COD rules, for Instagram and WhatsApp sellers.",
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
      <Toaster position="top-center" duration={3000} />
    </>
  );
}
