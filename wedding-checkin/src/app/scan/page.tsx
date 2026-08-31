import { getStats } from "@/app/actions/checkin";
import { ScanApp } from "@/components/scan/ScanApp";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const stats = await getStats();
  return <ScanApp initialStats={stats} />;
}
