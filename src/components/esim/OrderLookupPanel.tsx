import { BadgeCheck, Clock, Smartphone } from "lucide-react";

import type { AirhubPublicOrder } from "@/server/providers/airhub/contracts";

export function OrderLookupPanel({ order }: { order: AirhubPublicOrder }) {
  const hasActivation = Boolean(order.activationCode || order.qrPayload);

  return (
    <section className="mx-auto w-full max-w-[840px] px-4 py-10 sm:px-6">
      <div className="rounded-lg border border-border-soft bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-brand-blue">
              eSIM order
            </p>
            <h1 className="mt-2 text-3xl font-black">{order.publicReference}</h1>
          </div>
          <span className="rounded-md bg-brand-sky px-3 py-1.5 text-sm font-black uppercase text-brand-navy">
            {order.status.replace(/_/g, " ")}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Info label="Plan" value={order.planName ?? order.planCode} />
          <Info label="Country" value={order.countryName ?? order.countryCode ?? "Selected country"} />
          <Info
            label="Amount"
            value={
              order.price != null && order.currency
                ? `${order.currency} ${order.price.toLocaleString("en", {
                    maximumFractionDigits: 2,
                  })}`
                : "Unavailable"
            }
          />
          <Info label="Email" value={order.guestEmail} />
        </dl>

        <div className="mt-7 rounded-lg border border-border-soft bg-white p-5 dark:bg-surface-muted">
          {hasActivation ? (
            <div>
              <div className="flex items-center gap-2 text-lg font-black">
                <BadgeCheck className="size-5 text-brand-blue" aria-hidden="true" />
                Activation details
              </div>
              {order.activationCode ? (
                <p className="mt-4 break-all rounded-lg bg-surface-muted p-4 font-mono text-sm dark:bg-surface">
                  {order.activationCode}
                </p>
              ) : null}
              {order.apn ? (
                <p className="mt-3 text-sm font-semibold text-brand-navy/65 dark:text-white/65">
                  APN: {order.apn}
                </p>
              ) : null}
              <p className="mt-4 text-sm font-semibold text-brand-navy/55 dark:text-white/55">
                QR rendering will be added after live activation response handling is
                confirmed.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-lg font-black">
                {order.status === "paid" ? (
                  <Clock className="size-5 text-brand-blue" aria-hidden="true" />
                ) : (
                  <Smartphone className="size-5 text-brand-blue" aria-hidden="true" />
                )}
                Activation pending
              </div>
              <p className="mt-3 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
                The activation code will appear here after Airhub fulfillment is
                enabled and the provider returns the LPA payload.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-soft bg-white p-4 dark:bg-surface-muted">
      <dt className="text-xs font-black uppercase text-brand-navy/45 dark:text-white/45">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold">{value}</dd>
    </div>
  );
}
