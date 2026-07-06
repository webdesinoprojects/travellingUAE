import {
  CircleHelp,
  Clock,
  QrCode,
  Settings,
  Smartphone,
} from "lucide-react";

import type { AirhubPublicOrder } from "@/server/providers/airhub/contracts";
import {
  buildCustomerEsimDeliveryModel,
  type CustomerEsimDeliveryModel,
} from "@/lib/esim-activation";
import { createQrMatrix, type QrMatrix } from "@/lib/qr-code";

export function OrderLookupPanel({ order }: { order: AirhubPublicOrder }) {
  const delivery = buildCustomerEsimDeliveryModel({
    status: order.status,
    activationCode: order.activationCode,
    qrPayload: order.qrPayload,
    apn: order.apn,
    simId: order.simId,
    providerOrderId: order.providerOrderId,
  });
  const qrMatrix = delivery.qrPayload ? createQrMatrix(delivery.qrPayload) : null;

  return (
    <section className="mx-auto w-full max-w-[840px] px-4 py-10 sm:px-6">
      <div className="grid gap-5">
        <section className="rounded-lg border border-border-soft bg-surface p-5 shadow-sm sm:p-7">
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
        </section>

        {delivery.isReady ? (
          <FulfilledActivation delivery={delivery} qrMatrix={qrMatrix} />
        ) : (
          <ActivationPending status={order.status} />
        )}
      </div>
    </section>
  );
}

function FulfilledActivation({
  delivery,
  qrMatrix,
}: {
  delivery: CustomerEsimDeliveryModel;
  qrMatrix: QrMatrix | null;
}) {
  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-border-soft bg-white p-5 dark:bg-surface-muted">
        <SectionHeading icon={<QrCode className="size-5" aria-hidden="true" />} title="Scan QR code" />
        <div className="mt-4 grid gap-5 sm:grid-cols-[240px_minmax(0,1fr)] sm:items-start">
          {qrMatrix ? (
            <div className="rounded-lg border border-border-soft bg-white p-3 dark:bg-white">
              <QrCodeSvg matrix={qrMatrix} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border-soft p-5 text-sm font-bold text-brand-navy/60 dark:text-white/60">
              QR code is unavailable for this activation payload. Use manual activation below.
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-brand-navy/65 dark:text-white/65">
              Scan this QR code from the eSIM setup screen on your phone. Keep this page private because it contains your activation details.
            </p>
            {delivery.manualActivationCode ? (
              <div className="mt-4">
                <p className="text-xs font-black uppercase text-brand-navy/45 dark:text-white/45">
                  Manual activation
                </p>
                <p className="mt-2 break-all rounded-lg bg-surface-muted p-4 font-mono text-sm font-bold dark:bg-surface">
                  {delivery.manualActivationCode}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border-soft bg-white p-5 dark:bg-surface-muted">
        <SectionHeading icon={<Settings className="size-5" aria-hidden="true" />} title="Network settings" />
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {delivery.apn ? <Info label="APN" value={delivery.apn} /> : null}
          {delivery.simId ? <Info label="SIM ID / ICCID" value={delivery.simId} /> : null}
          {delivery.providerOrderId ? (
            <Info label="Airhub order ID" value={delivery.providerOrderId} />
          ) : null}
        </dl>
        {!delivery.apn && !delivery.simId && !delivery.providerOrderId ? (
          <p className="mt-3 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
            No extra network settings were provided for this eSIM.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border-soft bg-white p-5 dark:bg-surface-muted">
        <SectionHeading icon={<Smartphone className="size-5" aria-hidden="true" />} title="Installation steps" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Instruction title="iPhone">
            Settings → Cellular/Mobile Data → Add eSIM → Use QR Code
          </Instruction>
          <Instruction title="Android">
            Settings → Network & Internet/SIMs → Add eSIM → Scan QR Code
          </Instruction>
        </div>
        {delivery.apn ? (
          <p className="mt-4 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
            If mobile data does not connect after installation, enter the APN shown above in your cellular network settings.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border-soft bg-white p-5 dark:bg-surface-muted">
        <SectionHeading icon={<CircleHelp className="size-5" aria-hidden="true" />} title="Need help?" />
        <p className="mt-3 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
          Install the eSIM while connected to Wi-Fi. If scanning fails, use manual activation and keep the activation code exactly as shown.
        </p>
      </section>
    </div>
  );
}

function ActivationPending({ status }: { status: string }) {
  return (
    <div className="rounded-lg border border-border-soft bg-white p-5 dark:bg-surface-muted">
      <div className="flex items-center gap-2 text-lg font-black">
        {status === "paid" ? (
          <Clock className="size-5 text-brand-blue" aria-hidden="true" />
        ) : (
          <Smartphone className="size-5 text-brand-blue" aria-hidden="true" />
        )}
        Activation pending
      </div>
      <p className="mt-3 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
        Payment is received. Your eSIM activation details will appear here after fulfillment is complete.
      </p>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-lg font-black">
      <span className="text-brand-blue">{icon}</span>
      {title}
    </div>
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

function Instruction({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-soft bg-surface p-4 dark:bg-surface">
      <p className="text-sm font-black">{title}</p>
      <p className="mt-2 text-sm font-semibold text-brand-navy/65 dark:text-white/65">
        {children}
      </p>
    </div>
  );
}

function QrCodeSvg({ matrix }: { matrix: QrMatrix }) {
  const quietZone = 4;
  const size = matrix.length + quietZone * 2;
  const path = matrix
    .flatMap((row, y) =>
      row.flatMap((dark, x) =>
        dark ? [`M${x + quietZone} ${y + quietZone}h1v1h-1z`] : [],
      ),
    )
    .join("");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="eSIM activation QR code"
      className="aspect-square w-full text-brand-navy"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="white" />
      <path d={path} fill="currentColor" />
    </svg>
  );
}
