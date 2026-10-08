import type { ReactNode } from "react";

import { Buyers } from "@/components/demo/seller/Buyers";
import { Home } from "@/components/demo/seller/Home";
import { NewOrder } from "@/components/demo/seller/NewOrder";
import { OrderDetail } from "@/components/demo/seller/OrderDetail";
import { Orders } from "@/components/demo/seller/Orders";
import { SheetHost } from "@/components/demo/seller/Sheets";
import { SettingsScreen } from "@/components/demo/seller/Settings";
import { TrackRecordScreen } from "@/components/demo/seller/TrackRecord";
import { actions, useStore, type SellerTab } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

const NAV: { tab: SellerTab; label: string; icon: ReactNode }[] = [
  {
    tab: "home",
    label: "Home",
    icon: <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
  },
  {
    tab: "orders",
    label: "Orders",
    icon: <path d="M6 3h12a1 1 0 011 1v17l-3-2-3 2-3-2-3 2-2-1.5V4a1 1 0 011-1zM9 8h6M9 12h6" />,
  },
  {
    tab: "buyers",
    label: "Buyers",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 010 5.8M18 14.2c1.8.8 3 2.6 3 4.8" />
      </>
    ),
  },
  {
    tab: "record",
    label: "Record",
    icon: <path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.1l5.8-.8z" />,
  },
  {
    tab: "settings",
    label: "Settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
      </>
    ),
  },
];

export function SellerApp() {
  const tab = useStore((s) => s.tab);
  const screen = useStore((s) => s.screen);

  let content: ReactNode;
  if (screen.kind === "new") content = <NewOrder />;
  else if (screen.kind === "order") content = <OrderDetail id={screen.id} />;
  else if (tab === "home") content = <Home />;
  else if (tab === "orders") content = <Orders />;
  else if (tab === "buyers") content = <Buyers />;
  else if (tab === "record") content = <TrackRecordScreen />;
  else content = <SettingsScreen />;

  return (
    <div className="relative flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      <nav className="grid shrink-0 grid-cols-5 border-t border-navy/8 bg-white pb-1">
        {NAV.map((n) => {
          const active = tab === n.tab && screen.kind !== "new";
          return (
            <button
              key={n.tab}
              onClick={() => actions.setTab(n.tab)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-rzp" : "text-navy/45",
              )}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {n.icon}
              </svg>
              {n.label}
            </button>
          );
        })}
      </nav>
      <SheetHost />
    </div>
  );
}
