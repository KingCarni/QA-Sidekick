import { getServerSession } from "next-auth";
import BuyCreditsClient from "@/components/BuyCreditsClient";
import { authOptions } from "@/lib/auth";
import { getCreditBalance } from "@/lib/credits";

export const dynamic = "force-dynamic";

type BuyCreditsPageProps = {
  searchParams?: Promise<{
    success?: string;
    cancelled?: string;
    pack?: string;
  }>;
};

export default async function BuyCreditsPage({ searchParams }: BuyCreditsPageProps) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? "";
  const balance = userId ? await getCreditBalance(userId) : null;

  return (
    <BuyCreditsClient
      initialBalance={balance}
      checkoutSuccess={params?.success === "1"}
      checkoutCancelled={params?.cancelled === "1"}
      checkoutPackId={params?.pack ?? ""}
    />
  );
}
