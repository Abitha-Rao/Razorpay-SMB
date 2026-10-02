import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Razorpay Order Link" },
      {
        name: "description",
        content: "Razorpay Order Link (concept) — single-page app.",
      },
      { property: "og:title", content: "Razorpay Order Link" },
      {
        property: "og:description",
        content: "Razorpay Order Link (concept) — single-page app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Razorpay Order Link (concept)
      </h1>
    </div>
  );
}
