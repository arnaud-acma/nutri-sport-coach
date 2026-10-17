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
      <main className="mx-auto max-w-md px-4 pt-5 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
