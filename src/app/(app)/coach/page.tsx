import { requireUser } from "@/lib/auth";
import CoachThread from "@/components/CoachThread";

export const dynamic = "force-dynamic";

export default async function Coach() {
  await requireUser();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Coach</h1>
      <p className="text-sm text-muted">
        Pose tes questions. Le coach lit tes fiches, tes repas des 7 derniers
        jours et tes pesées. S&apos;il apprend quelque chose de durable, il te
        propose de mettre à jour une fiche : rien ne change sans ton accord.
      </p>
      <CoachThread
        mealId={null}
        placeholder="Ta question (ex. : que manger avant une séance de jambes à 18h ?)"
      />
    </div>
  );
}
