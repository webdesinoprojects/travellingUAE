"use client";

import { Copy, Download, FileDown, Printer } from "lucide-react";
import { useState } from "react";

import type { CustomerEsimDeliveryModel } from "@/lib/esim-activation";
import type { QrMatrix } from "@/lib/qr-code";

export function EsimDeliveryActions({
  delivery,
  qrMatrix,
  orderReference,
  planName,
  countryName,
}: {
  delivery: CustomerEsimDeliveryModel;
  qrMatrix: QrMatrix | null;
  orderReference: string;
  planName: string;
  countryName: string;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function copyActivation() {
    if (!delivery.manualActivationCode) return;
    await navigator.clipboard.writeText(delivery.manualActivationCode);
    setMessage("Activation code copied.");
  }

  function downloadQrPng() {
    if (!qrMatrix) return;
    const canvas = qrMatrixToCanvas(qrMatrix, 10, 4);
    const url = canvas.toDataURL("image/png");
    downloadUrl(url, `flytime-esim-${orderReference}-qr.png`);
    setMessage("QR downloaded.");
  }

  function downloadPdf() {
    const pdf = buildEsimPdf({
      delivery,
      qrMatrix,
      orderReference,
      planName,
      countryName,
    });
    const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    downloadUrl(url, `flytime-esim-${orderReference}.pdf`);
    URL.revokeObjectURL(url);
    setMessage("PDF downloaded.");
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {delivery.manualActivationCode ? (
        <ActionButton onClick={() => void copyActivation()} icon={<Copy className="size-4" />}>
          Copy activation
        </ActionButton>
      ) : null}
      {qrMatrix ? (
        <ActionButton onClick={downloadQrPng} icon={<Download className="size-4" />}>
          Download QR
        </ActionButton>
      ) : null}
      <ActionButton onClick={downloadPdf} icon={<FileDown className="size-4" />}>
        Download PDF
      </ActionButton>
      <ActionButton onClick={() => window.print()} icon={<Printer className="size-4" />}>
        Print
      </ActionButton>
      {message ? (
        <p className="text-xs font-bold text-brand-navy/60 dark:text-white/65">{message}</p>
      ) : null}
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy hover:bg-surface-muted dark:bg-white/10 dark:text-white dark:hover:bg-white/[0.14]"
    >
      {icon}
      {children}
    </button>
  );
}

function qrMatrixToCanvas(matrix: QrMatrix, scale: number, quietZone: number) {
  const modules = matrix.length + quietZone * 2;
  const canvas = document.createElement("canvas");
  canvas.width = modules * scale;
  canvas.height = modules * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f1f3d";
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        ctx.fillRect((x + quietZone) * scale, (y + quietZone) * scale, scale, scale);
      }
    });
  });

  return canvas;
}

function downloadUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function buildEsimPdf({
  delivery,
  qrMatrix,
  orderReference,
  planName,
  countryName,
}: {
  delivery: CustomerEsimDeliveryModel;
  qrMatrix: QrMatrix | null;
  orderReference: string;
  planName: string;
  countryName: string;
}) {
  const commands: string[] = [];
  const pageWidth = 612;
  const margin = 48;

  fill(commands, "#f4efe6");
  rect(commands, 0, 0, pageWidth, 792);
  fill(commands, "#ffffff");
  rect(commands, 36, 34, 540, 724);

  fill(commands, "#0f1f3d");
  rect(commands, 36, 710, 540, 48);
  text(commands, "FlyTime eSIM", 56, 734, 20, "bold", "#ffffff");
  text(commands, "Travel connectivity", 56, 718, 9, "regular", "#e3c39d");
  text(commands, "Activation details", 408, 730, 14, "bold", "#ffffff");

  text(commands, "Your eSIM is ready to install", margin, 682, 18, "bold", "#0f1f3d");
  text(
    commands,
    "Use the QR code below or the manual activation code to install your eSIM.",
    margin,
    662,
    10,
    "regular",
    "#41506a",
  );

  if (qrMatrix) {
    drawQr(commands, qrMatrix, margin, 462, 168);
    text(commands, "Scan this QR from your phone's Add eSIM screen.", margin, 448, 9, "regular", "#41506a");
  } else {
    fill(commands, "#eef5ff");
    rect(commands, margin, 474, 168, 136);
    text(commands, "QR unavailable", margin + 38, 542, 14, "bold", "#123f76");
  }

  let y = 626;
  const detailX = 252;
  y = detail(commands, detailX, y, "Order", orderReference);
  y = detail(commands, detailX, y, "Plan", planName);
  y = detail(commands, detailX, y, "Country", countryName);
  if (delivery.apn) y = detail(commands, detailX, y, "APN", delivery.apn);
  if (delivery.simId) detail(commands, detailX, y, "SIM ID / ICCID", delivery.simId);

  text(commands, "Manual activation code", margin, 414, 11, "bold", "#7a8296");
  fill(commands, "#f4efe6");
  rect(commands, margin, 346, 516, 54);
  drawWrappedText(
    commands,
    delivery.manualActivationCode ?? "Unavailable",
    margin + 12,
    382,
    88,
    11,
    13,
    "mono",
    "#0f1f3d",
  );

  if (delivery.providerOrderId) {
    text(commands, `Airhub order ID: ${delivery.providerOrderId}`, margin, 328, 9, "regular", "#41506a");
  }

  text(commands, "Install on iPhone", margin, 306, 12, "bold", "#0f1f3d");
  drawWrappedText(
    commands,
    "Settings -> Cellular/Mobile Data -> Add eSIM -> Use QR Code",
    margin,
    288,
    82,
    10,
    13,
    "regular",
    "#41506a",
  );

  text(commands, "Install on Android", margin, 252, 12, "bold", "#0f1f3d");
  drawWrappedText(
    commands,
    "Settings -> Network & Internet/SIMs -> Add eSIM -> Scan QR Code",
    margin,
    234,
    82,
    10,
    13,
    "regular",
    "#41506a",
  );

  fill(commands, "#fff3df");
  rect(commands, margin, 164, 516, 48);
  drawWrappedText(
    commands,
    "Keep this private. Anyone with this QR or activation code may be able to install your eSIM.",
    margin + 12,
    194,
    86,
    10,
    13,
    "bold",
    "#8a5f31",
  );

  text(commands, "FlyTime Travel - Need help? Contact support.", margin, 72, 9, "regular", "#7a8296");

  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return body;
}

function detail(commands: string[], x: number, y: number, label: string, value: string) {
  text(commands, label.toUpperCase(), x, y, 8, "bold", "#7a8296");
  drawWrappedText(commands, value, x, y - 13, 40, 10, 12, "bold", "#0f1f3d");
  return y - 36;
}

function drawQr(commands: string[], matrix: QrMatrix, x: number, y: number, size: number) {
  const quietZone = 4;
  const modules = matrix.length + quietZone * 2;
  const moduleSize = size / modules;

  fill(commands, "#ffffff");
  rect(commands, x, y, size, size);
  stroke(commands, "#e6ddcd");
  commands.push(`${x} ${y} ${size} ${size} re S`);
  fill(commands, "#0f1f3d");
  matrix.forEach((row, rowIndex) => {
    row.forEach((dark, columnIndex) => {
      if (!dark) return;
      const moduleX = x + (columnIndex + quietZone) * moduleSize;
      const moduleY = y + size - (rowIndex + quietZone + 1) * moduleSize;
      rect(commands, moduleX, moduleY, moduleSize + 0.02, moduleSize + 0.02);
    });
  });
}

function drawWrappedText(
  commands: string[],
  value: string,
  x: number,
  y: number,
  maxChars: number,
  fontSize: number,
  lineHeight: number,
  font: "regular" | "bold" | "mono",
  color: string,
) {
  wrapText(value, maxChars).forEach((line, index) => {
    text(commands, line, x, y - index * lineHeight, fontSize, font, color);
  });
}

function wrapText(value: string, maxChars: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function text(
  commands: string[],
  value: string,
  x: number,
  y: number,
  size: number,
  font: "regular" | "bold" | "mono",
  color: string,
) {
  const fontId = font === "bold" ? "F2" : font === "mono" ? "F3" : "F1";
  const [r, g, b] = pdfRgb(color);
  commands.push(`BT /${fontId} ${size} Tf ${r} ${g} ${b} rg ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
}

function fill(commands: string[], color: string) {
  const [r, g, b] = pdfRgb(color);
  commands.push(`${r} ${g} ${b} rg`);
}

function stroke(commands: string[], color: string) {
  const [r, g, b] = pdfRgb(color);
  commands.push(`${r} ${g} ${b} RG`);
}

function rect(commands: string[], x: number, y: number, width: number, height: number) {
  commands.push(`${round(x)} ${round(y)} ${round(width)} ${round(height)} re f`);
}

function pdfRgb(color: string): [string, string, string] {
  const normalized = color.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return [round(r), round(g), round(b)];
}

function round(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
