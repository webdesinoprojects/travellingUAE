/**
 * Pure eSIM email content builders (subject/html/text). No IO, no secrets kept -
 * callers pass the values. All dynamic values are HTML-escaped to prevent
 * injection into the email markup. node --test friendly.
 */

export const ESIM_ACTIVATION_SUBJECT = "Your FlyTime eSIM is ready";
export const ESIM_PRIVACY_WARNING =
  "Keep this private. Anyone with this QR or activation code may be able to install your eSIM.";

export type EmailContent = { subject: string; html: string; text: string };

export type ActivationEmailInput = {
  publicReference: string;
  planName: string | null;
  countryName: string | null;
  secureUrl: string;
  activationCode: string | null;
  apn: string | null;
  simId: string | null;
  hasQrAttachment: boolean;
};

function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4efe6;font-family:Arial,Helvetica,sans-serif;color:#0f1f3d;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#fff;border-radius:12px 12px 0 0;padding:22px 24px;border-bottom:4px solid #222;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
        <div>
          <div style="font-size:22px;font-weight:800;color:#071a75;letter-spacing:.01em;">FlyTime</div>
          <div style="font-size:12px;font-weight:700;color:#7a8296;margin-top:4px;">Travel connectivity</div>
        </div>
        <div style="font-size:26px;font-weight:900;letter-spacing:-.04em;line-height:1;">
          <span style="color:#f7c900;">Fly</span><span style="color:#f06d22;">Time</span>
        </div>
      </div>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:20px;">${esc(title)}</h1>
      ${body}
    </div>
    <p style="text-align:center;color:#7a8296;font-size:12px;margin:16px 0 0;">FlyTime Travel - Need help? Reply to this email.</p>
  </div></body></html>`;
}

export function buildOtpEmailContent(code: string): EmailContent {
  const safeCode = esc(code);
  const html = shell(
    "Verify your email",
    `<p style="font-size:14px;line-height:22px;">Use this code to verify your email and continue your eSIM purchase. It expires in 10 minutes.</p>
     <div style="margin:20px 0;text-align:center;">
       <span style="display:inline-block;font-size:30px;font-weight:800;letter-spacing:8px;background:#eef5ff;color:#123f76;border-radius:10px;padding:14px 22px;">${safeCode}</span>
     </div>
     <p style="font-size:13px;color:#7a8296;">If you did not request this, you can ignore this email. Never share this code with anyone.</p>`,
  );
  const text = `Your FlyTime eSIM verification code is ${code}. It expires in 10 minutes. Never share this code.`;
  return { subject: "Your FlyTime eSIM verification code", html, text };
}

export function buildActivationEmailContent(input: ActivationEmailInput): EmailContent {
  const rows: string[] = [];
  rows.push(detailRow("Order reference", input.publicReference));
  if (input.planName) rows.push(detailRow("Plan", input.planName));
  if (input.countryName) rows.push(detailRow("Country", input.countryName));
  if (input.apn) rows.push(detailRow("APN", input.apn));
  if (input.simId) rows.push(detailRow("SIM ID / ICCID", input.simId));

  const qrBlock = input.hasQrAttachment
    ? `<div style="text-align:center;margin:8px 0 16px;background:#eef5ff;border:1px solid #d4e6ff;border-radius:10px;padding:16px;">
         <p style="margin:0;font-size:14px;font-weight:800;color:#123f76;">QR code attached</p>
         <p style="font-size:12px;color:#41506a;line-height:18px;margin:8px 0 0;">Open the attached PNG named with your order reference and scan it from your phone's Add eSIM screen.</p>
       </div>`
    : `<p style="font-size:13px;color:#7a8296;">A QR image was not available for this eSIM. Use the manual activation code below.</p>`;

  const manualBlock = input.activationCode
    ? `<p style="font-size:12px;font-weight:700;text-transform:uppercase;color:#7a8296;margin:16px 0 6px;">Manual activation code</p>
       <div style="word-break:break-all;background:#f4efe6;border-radius:8px;padding:12px;font-family:Consolas,monospace;font-size:13px;font-weight:700;">${esc(input.activationCode)}</div>`
    : "";

  const html = shell(
    "Your eSIM is ready to install",
    `<p style="font-size:14px;line-height:22px;">Your eSIM has been fulfilled. Use the attached QR code PNG or the manual activation code to install it.</p>
     ${qrBlock}
     ${manualBlock}
     <table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows.join("")}</table>
     <div style="text-align:center;margin:20px 0;">
       <a href="${esc(input.secureUrl)}" style="display:inline-block;background:#123f76;color:#fff;text-decoration:none;font-weight:800;border-radius:10px;padding:12px 22px;">View eSIM details</a>
     </div>
     <div style="border-top:1px solid #e6ddcd;padding-top:16px;">
       <p style="font-size:13px;font-weight:800;margin:0 0 8px;">Install on iPhone</p>
       <p style="font-size:13px;color:#41506a;margin:0 0 12px;">Settings → Cellular/Mobile Data → Add eSIM → Use QR Code</p>
       <p style="font-size:13px;font-weight:800;margin:0 0 8px;">Install on Android</p>
       <p style="font-size:13px;color:#41506a;margin:0;">Settings → Network &amp; Internet/SIMs → Add eSIM → Scan QR Code</p>
     </div>
     <p style="margin:18px 0 0;background:#fff3df;border:1px solid #ead7bd;border-radius:8px;padding:12px;font-size:13px;font-weight:700;color:#8a5f31;">${esc(ESIM_PRIVACY_WARNING)}</p>`,
  );

  const textLines = [
    "Your FlyTime eSIM is ready to install.",
    "",
    `Order reference: ${input.publicReference}`,
    input.planName ? `Plan: ${input.planName}` : "",
    input.countryName ? `Country: ${input.countryName}` : "",
    input.activationCode ? `Manual activation code: ${input.activationCode}` : "",
    input.apn ? `APN: ${input.apn}` : "",
    input.simId ? `SIM ID / ICCID: ${input.simId}` : "",
    "",
    `View eSIM details: ${input.secureUrl}`,
    "",
    "iPhone: Settings → Cellular/Mobile Data → Add eSIM → Use QR Code",
    "Android: Settings → Network & Internet/SIMs → Add eSIM → Scan QR Code",
    "",
    ESIM_PRIVACY_WARNING,
  ].filter((line) => line !== "");

  return { subject: ESIM_ACTIVATION_SUBJECT, html, text: textLines.join("\n") };
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;font-weight:700;text-transform:uppercase;color:#7a8296;">${esc(label)}</td>
    <td style="padding:6px 0;font-size:13px;font-weight:700;text-align:right;word-break:break-all;">${esc(value)}</td>
  </tr>`;
}
