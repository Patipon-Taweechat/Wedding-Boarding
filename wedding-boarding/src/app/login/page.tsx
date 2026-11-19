import { PinPad } from "@/components/scan/PinPad";
import { Meta } from "@/components/ui/Meta";
import { couple } from "@/lib/wedding";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <Meta>{couple.one} &amp; {couple.two}</Meta>
      <h1 className="mt-3 mb-12 font-display text-4xl text-primary">Staff boarding</h1>
      <PinPad next={next && next.startsWith("/") ? next : "/scan"} />
    </main>
  );
}
