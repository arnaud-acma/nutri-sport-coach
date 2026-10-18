"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Accueil", icon: "🏠" },
  { href: "/repas", label: "Repas", icon: "🍽️" },
  { href: "/coach", label: "Coach", icon: "💬" },
  { href: "/poids", label: "Poids", icon: "⚖️" },
  { href: "/connaissance", label: "Fiches", icon: "📚" },
  { href: "/reglages", label: "Réglages", icon: "⚙️" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card pb-safe z-10">
      <div className="mx-auto max-w-md grid grid-cols-6">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                active ? "text-accent font-semibold" : "text-muted"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
