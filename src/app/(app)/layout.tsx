import BottomNav from "@/components/BottomNav";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <div className="flex-1 w-full">
      <main
        className="mx-auto max-w-md px-4 pb-28"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.25rem)" }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
