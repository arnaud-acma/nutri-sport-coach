"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Accueil", icon: "🏠" },
  { href: "/historique", label: "Historique", icon: "📅" },
  { href: "/coach", label: "Coach", icon: "💬" },
  { href: "/poids", label: "Poids", icon: "⚖️" },
  { href: "/connaissance", label: "Fiches", icon: "📚" },
  { href: "/reglages", label: "Réglages", icon: "⚙️" },
] as const;

/** Icône qui pulse tant que l'onglet touché n'est pas affiché. */
function TabIcon({ icon }: { icon: string }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className={`text-lg leading-none ${pending ? "nav-pending" : ""}`}>
      {icon}
    </span>
  );
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/repas/nouveau") || pathname.startsWith("/selles");
  }
  if (href === "/historique") {
    return (
      pathname.startsWith("/historique") ||
      pathname.startsWith("/jour") ||
      (pathname.startsWith("/repas") && !pathname.startsWith("/repas/nouveau"))
    );
  }
  return pathname.startsWith(href);
}

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card pb-safe z-10">
      <div className="mx-auto max-w-md grid grid-cols-6">
        {TABS.map((tab) => {
          const active = isActive(tab.href, pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                active ? "text-accent font-semibold" : "text-muted"
              }`}
            >
              <TabIcon icon={tab.icon} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
