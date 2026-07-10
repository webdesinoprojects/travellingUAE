import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdminPageAccess } from "@/server/admin/access";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import { BookingDetailView } from "@/features/admin/components/BookingDetailView";
import {
  HotelCancelPanel,
  type HotelProviderFields,
} from "@/features/admin/components/HotelCancelPanel";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function BookingDetailPage({
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
      <div className="grid gap-5">
        <BackLink />
        <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center dark:border-white/10 dark:bg-white/[0.06]">
          <p className="text-sm font-bold text-brand-brown">
            Database is not configured. Booking detail is unavailable.
          </p>
        </div>
      </div>
    );
  }

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("bookings")
    .select(
      "id,customer_name,customer_email,customer_phone,travelers_count,travel_date,status,admin_notes,created_at,updated_at,provider_order_status,provider_partner_order_id,provider_order_id,provider_order_item_id,provider_result_code,provider_confirmed_at,provider_cancel_requested_at,provider_cancelled_at",
    )
    .eq("id", id)
    .single();

  if (result.error || !result.data) {
    notFound();
  }

  const row = result.data;
  const booking = {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email ?? null,
    customerPhone: row.customer_phone ?? null,
    travelersCount: Number(row.travelers_count ?? 1),
    travelDate: row.travel_date ?? null,
    status: row.status,
    adminNotes: row.admin_notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // A RateHawk/ETG hotel booking is one that has provider order state. Only then
  // do we show the provider fields + cancellation controls.
  const providerFields: HotelProviderFields = {
    providerOrderStatus: row.provider_order_status ?? null,
    providerPartnerOrderId: row.provider_partner_order_id ?? null,
    providerOrderId: row.provider_order_id ?? null,
    providerOrderItemId: row.provider_order_item_id ?? null,
    providerResultCode: row.provider_result_code ?? null,
    providerConfirmedAt: row.provider_confirmed_at ?? null,
    providerCancelRequestedAt: row.provider_cancel_requested_at ?? null,
    providerCancelledAt: row.provider_cancelled_at ?? null,
  };
  const isProviderBooking = Boolean(
    providerFields.providerPartnerOrderId || providerFields.providerOrderStatus,
  );

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <BackLink />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
            Travel desk
          </p>
          <h1 className="font-serif text-2xl font-black tracking-tight">
            Booking detail
          </h1>
        </div>
      </div>

      <BookingDetailView booking={booking} />

      {isProviderBooking ? (
        <HotelCancelPanel bookingId={booking.id} provider={providerFields} />
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/bookings"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
      aria-label="Back to bookings"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
    </Link>
  );
}
