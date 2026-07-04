import { CheckCircle2, MinusCircle } from "lucide-react";

import { EsimStatusBadge } from "@/features/admin/esim/components/EsimStatusBadge";
import { formatEsimDate, formatEsimDateTime, formatEsimMoney, formatEsimText } from "@/features/admin/esim/format";
import type { EsimOrderDetail } from "@/features/admin/esim/types";

/**
 * Read-only detail sections. Sensitive fulfillment data is shown ONLY as
 * exists yes/no — the DTO never carries the raw values (see the DAL/mappers),
 * so nothing sensitive is present in the rendered HTML or the RSC payload.
 */
export function EsimOrderDetailSections({ order }: { order: EsimOrderDetail }) {
  return (
    <div className="grid gap-5">
      <StateMessage order={order} />

      <Card title="Order summary">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
              Reference
            </p>
            <p className="mt-1 font-serif text-xl font-black break-all">{order.publicReference}</p>
          </div>
          <EsimStatusBadge status={order.status} />
        </div>
        <FieldGrid>
          <Field label="Created" value={formatEsimDateTime(order.createdAt)} />
          <Field label="Updated" value={formatEsimDateTime(order.updatedAt)} />
          <Field label="Expires" value={formatEsimDateTime(order.expiresAt)} />
        </FieldGrid>
      </Card>

      <Card title="Customer">
        <FieldGrid>
          <Field label="Name" value={formatEsimText(order.guestName)} />
          <Field label="Email" value={order.guestEmail} breakAll />
          <Field label="Phone" value={formatEsimText(order.guestPhone)} />
        </FieldGrid>
      </Card>

      <Card title="Plan">
        <FieldGrid>
          <Field label="Provider" value={formatEsimText(order.provider)} />
          <Field label="Partner code" value={formatEsimText(order.partnerCode)} />
          <Field label="Country" value={formatEsimText(order.countryName)} />
          <Field label="Country code" value={formatEsimText(order.countryCode)} />
          <Field label="Plan name" value={formatEsimText(order.planName)} />
          <Field label="Plan code" value={formatEsimText(order.planCode)} />
          <Field label="Travel date" value={formatEsimDate(order.travelDate)} />
        </FieldGrid>
      </Card>

      <Card title="Payment">
        <FieldGrid>
          <Field label="Customer price" value={formatEsimMoney(order.price, order.currency)} />
          <Field label="Supplier price" value={formatEsimMoney(order.supplierPrice, order.supplierCurrency)} />
          <Field label="Estimated profit" value={formatEsimMoney(order.markupAmount, order.currency)} />
          <Field label="Paid amount" value={formatEsimMoney(order.paidAmount, order.paidCurrency)} />
          <Field label="Paid at" value={formatEsimDateTime(order.paidAt)} />
          <Field label="Pricing rule" value={formatEsimText(order.pricingRuleId)} breakAll />
          <Field label="Stripe session" value={formatEsimText(order.stripeCheckoutSessionId)} breakAll />
          <Field label="Payment intent" value={formatEsimText(order.stripePaymentIntentId)} breakAll />
          <Field label="Completed event" value={formatEsimText(order.stripeCompletedEventId)} breakAll />
        </FieldGrid>
      </Card>

      <Card title="Airhub fulfillment">
        <FieldGrid>
          <Field label="Unique order id" value={formatEsimText(order.uniqueOrderId)} breakAll />
          <Field label="Provider order id" value={formatEsimText(order.providerOrderId)} breakAll />
          <Field label="Error code" value={formatEsimText(order.errorCode)} />
        </FieldGrid>

        <div className="mt-4 border-t border-[#efe3cf] pt-4 dark:border-white/10">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
            Activation data (presence only)
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Presence label="Activation code" present={order.fulfillment.hasActivationCode} />
            <Presence label="LPA code" present={order.fulfillment.hasLpaCode} />
            <Presence label="QR payload" present={order.fulfillment.hasQrPayload} />
            <Presence label="APN" present={order.fulfillment.hasApn} />
            <Presence label="SIM id" present={order.fulfillment.hasSimId} />
            <Presence label="SIM PIN" present={order.fulfillment.hasSimPin} />
          </div>
          <p className="mt-3 text-xs font-semibold text-brand-brown">
            Raw activation/QR/PIN values are intentionally not exposed in admin.
          </p>
        </div>

        <div className="mt-4 border-t border-[#efe3cf] pt-4 dark:border-white/10">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
            Provider response
          </p>
          {order.providerResponsePresent ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {order.providerResponseKeys.length > 0 ? (
                order.providerResponseKeys.map((key) => (
                  <span
                    key={key}
                    className="rounded-full bg-[#ead7bd] px-2.5 py-1 text-xs font-bold text-brand-navy dark:bg-white/10 dark:text-white"
                  >
                    {key}
                  </span>
                ))
              ) : (
                <span className="text-sm font-bold">Present</span>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm font-bold text-brand-brown">None</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function StateMessage({ order }: { order: EsimOrderDetail }) {
  const hasActivation = order.fulfillment.hasActivationCode || order.fulfillment.hasQrPayload;

  let tone = "border-[#d7c5ad] bg-[#fff3df] text-[#8a5f31] dark:bg-brand-sand/10 dark:text-brand-sand";
  let message: string | null = null;

  if (order.status === "purchase_failed") {
    tone = "border-[#f0b8a6] bg-[#ffe8e2] text-[#a33b1f] dark:bg-red-500/10 dark:text-red-200";
    message = "Airhub purchase failed. Review provider response.";
  } else if (order.status === "fulfilled" || hasActivation) {
    tone = "border-[#a9d9ef] bg-[#e8f7ff] text-brand-blue dark:bg-white/10 dark:text-brand-sand";
    message = "Activation data available.";
  } else if (order.status === "paid") {
    message = "Payment received. Airhub fulfillment is currently disabled or pending.";
  }

  if (!message) return null;

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${tone}`}>{message}</div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</dl>;
}

function Field({ label, value, breakAll }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">{label}</dt>
      <dd className={`mt-1 text-sm font-bold ${breakAll ? "break-all" : "break-words"}`}>{value}</dd>
    </div>
  );
}

function Presence({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#e4d6bf] bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
      {present ? (
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-brand-blue dark:text-brand-sand" />
      ) : (
        <MinusCircle aria-hidden="true" className="size-4 shrink-0 text-brand-brown/60" />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-bold">{label}</p>
        <p className="text-xs font-black text-brand-brown">{present ? "Yes" : "No"}</p>
      </div>
    </div>
  );
}
