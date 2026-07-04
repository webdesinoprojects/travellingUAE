import { notFound } from "next/navigation";

import { requireAdminPageAccess } from "@/server/admin/access";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";
import { getEsimOrderById } from "@/server/admin/esim-orders";
import { getEsimFulfillmentGuardView } from "@/server/providers/airhub/orders";
import { EsimOrderActions } from "@/features/admin/esim/components/EsimOrderActions";
import { EsimOrderDetailSections } from "@/features/admin/esim/components/EsimOrderDetailSections";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminEsimOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requireAdminPageAccess("admin");

  if (!UUID_RE.test(id)) {
    notFound();
  }

  if (!hasSupabaseAdminEnv()) {
    return (
      <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center dark:border-white/10 dark:bg-white/[0.06]">
        <p className="text-sm font-bold text-brand-brown">
          Database is not configured. eSIM order detail is unavailable.
        </p>
      </div>
    );
  }

  const order = await getEsimOrderById(id);
  if (!order) {
    notFound();
  }
  const fulfillmentGuard = getEsimFulfillmentGuardView({
    status: order.status,
    planCode: order.planCode,
    hasActivationCode:
      order.fulfillment.hasActivationCode || order.fulfillment.hasQrPayload,
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
            eSIM order
          </p>
          <h1 className="font-serif text-2xl font-black tracking-tight break-all">
            {order.publicReference}
          </h1>
        </div>
        <EsimOrderActions
          orderId={order.id}
          status={order.status}
          publicReference={order.publicReference}
          stripeCheckoutSessionId={order.stripeCheckoutSessionId}
          fulfillmentGuard={fulfillmentGuard}
        />
      </div>

      <EsimOrderDetailSections order={order} />
    </div>
  );
}
