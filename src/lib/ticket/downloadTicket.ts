'use client';

export interface TicketAttendee {
  firstName: string;
  lastName: string;
  organization: string;
  role: string;
  registrationId: string;
  qrCodeId?: string | null;
  location?: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | [number, number, number, number]
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  } else {
    const r = typeof radius === 'number' ? radius : radius[0];
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

/**
 * Generates a high-resolution, beautifully formatted conference entry ticket image
 * and triggers a browser download.
 */
export async function downloadTicket(attendee: TicketAttendee): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Wait for the QR code canvas to be available in the DOM (retry up to 10 times)
  let qrCanvas = document.getElementById('qr-canvas') as HTMLCanvasElement | null;
  let attempts = 0;
  while (!qrCanvas && attempts < 10) {
    await new Promise((res) => setTimeout(res, 100));
    qrCanvas = document.getElementById('qr-canvas') as HTMLCanvasElement | null;
    attempts++;
  }

  const canvas = document.createElement('canvas');
  const width = 900;
  const height = 1320;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // 1. Overall Canvas Background
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, 0, width, height);

  // Card bounds
  const cardX = 40;
  const cardY = 40;
  const cardW = 820;
  const cardH = 1240;
  const cardRadius = 32;

  // 2. Main Card Drop Shadow & Base Background
  ctx.save();
  ctx.shadowColor = 'rgba(28, 46, 90, 0.14)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fill();
  ctx.restore();

  // Card Border
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.stroke();

  // 3. Header Section (Deep Navy Gradient)
  const headerH = 260;
  ctx.save();
  // Clip to top rounded corners of card
  drawRoundedRect(ctx, cardX, cardY, cardW, headerH + 20, [cardRadius, cardRadius, 0, 0]);
  ctx.clip();

  const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
  headerGrad.addColorStop(0, '#101D34');
  headerGrad.addColorStop(0.5, '#1C2E5A');
  headerGrad.addColorStop(1, '#274278');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(cardX, cardY, cardW, headerH);

  // Ambient Glow Effect in Top Right
  const glow = ctx.createRadialGradient(cardX + cardW - 100, cardY + 70, 10, cardX + cardW - 100, cardY + 70, 200);
  glow.addColorStop(0, 'rgba(147, 197, 253, 0.28)');
  glow.addColorStop(1, 'rgba(147, 197, 253, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cardX, cardY, cardW, headerH);

  // Header Sub-label
  ctx.fillStyle = '#93C5FD';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('OAK FOUNDATION · CONVENING 2026', cardX + 44, cardY + 60);

  // Event Main Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText('Grantee Convening', cardX + 44, cardY + 110);

  // Date and Venue subtitle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.font = '500 17px system-ui, -apple-system, sans-serif';
  ctx.fillText('9–11 November 2026  ·  Harare, Zimbabwe', cardX + 44, cardY + 150);

  // Top Right "OFFICIAL ENTRY PASS" Pill Badge
  const badgeW = 190;
  const badgeH = 36;
  const badgeX = cardX + cardW - badgeW - 44;
  const badgeY = cardY + 44;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18);
  ctx.stroke();

  // Green dot in badge
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(badgeX + 18, badgeY + badgeH / 2, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('OFFICIAL ENTRY PASS', badgeX + 32, badgeY + 22);

  ctx.restore();

  // 4. Perforation & Notches
  const notchY = cardY + headerH;
  const notchRadius = 20;

  // Left Notch cutout
  ctx.fillStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.arc(cardX, notchY, notchRadius, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cardX, notchY, notchRadius, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Right Notch cutout
  ctx.fillStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.arc(cardX + cardW, notchY, notchRadius, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cardX + cardW, notchY, notchRadius, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  // Dashed Perforation Line
  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + notchRadius + 4, notchY);
  ctx.lineTo(cardX + cardW - notchRadius - 4, notchY);
  ctx.stroke();
  ctx.restore();

  // 5. Attendee Information Block
  const attendeeY = notchY + 36;

  // Section Tag
  ctx.fillStyle = '#6B7590';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('ATTENDEE DETAILS', cardX + 44, attendeeY);

  // Full Name
  const fullName = `${attendee.firstName} ${attendee.lastName}`.trim().toUpperCase();
  ctx.fillStyle = '#0E1726';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '0.5px';
  ctx.fillText(fullName, cardX + 44, attendeeY + 40);

  // Organization
  ctx.fillStyle = '#475569';
  ctx.font = '500 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(attendee.organization || 'OAK Grantee Convening', cardX + 44, attendeeY + 72);

  // Badges (Role + Location)
  const roleText = attendee.role || 'Grantee';
  const locationText = attendee.location || 'Harare, Zimbabwe';

  // Role Pill
  const rolePillX = cardX + 44;
  const rolePillY = attendeeY + 95;
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  const roleW = ctx.measureText(roleText).width + 36;
  const pillH = 30;

  ctx.fillStyle = '#EEF1F9';
  drawRoundedRect(ctx, rolePillX, rolePillY, roleW, pillH, 15);
  ctx.fill();
  ctx.strokeStyle = '#C5CFDF';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, rolePillX, rolePillY, roleW, pillH, 15);
  ctx.stroke();

  // Dot
  ctx.fillStyle = '#1C2E5A';
  ctx.beginPath();
  ctx.arc(rolePillX + 14, rolePillY + pillH / 2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1C2E5A';
  ctx.fillText(roleText, rolePillX + 25, rolePillY + 19);

  // Location Pill
  const locPillX = rolePillX + roleW + 12;
  const locW = ctx.measureText(locationText).width + 28;
  ctx.fillStyle = '#F8FAFC';
  drawRoundedRect(ctx, locPillX, rolePillY, locW, pillH, 15);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, locPillX, rolePillY, locW, pillH, 15);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '500 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(locationText, locPillX + 14, rolePillY + 19);

  // 6. QR Code Container Box
  const qrBoxY = attendeeY + 155;
  const qrBoxW = cardW - 88;
  const qrBoxH = 430;
  const qrBoxX = cardX + 44;

  ctx.fillStyle = '#F8FAFC';
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
  ctx.stroke();

  // Draw QR Code in Center of Box
  const qrSize = 250;
  const qrX = qrBoxX + (qrBoxW - qrSize) / 2;
  const qrY = qrBoxY + 36;

  if (qrCanvas) {
    // White background padding behind QR code
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 16);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 16);
    ctx.stroke();

    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  } else {
    // Fallback QR placeholder
    ctx.fillStyle = '#1C2E5A';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
  }

  // Registration / Event Code (Monospace)
  const codeY = qrY + qrSize + 48;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1C2E5A';
  ctx.font = 'bold 22px Consolas, Monaco, monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText(attendee.registrationId, cardX + cardW / 2, codeY);

  // Instruction Subtext
  ctx.fillStyle = '#6B7590';
  ctx.font = 'normal 14px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText('Present this QR code at convening entrance for check-in', cardX + cardW / 2, codeY + 28);
  ctx.textAlign = 'left';

  // 7. Bottom Metadata Strip & Security Bar
  const footerY = cardY + cardH - 180;
  const footerH = 180;

  ctx.save();
  // Clip to bottom corners of card
  drawRoundedRect(ctx, cardX, footerY, cardW, footerH, [0, 0, cardRadius, cardRadius]);
  ctx.clip();

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(cardX, footerY, cardW, footerH);

  // Top border of footer
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX, footerY);
  ctx.lineTo(cardX + cardW, footerY);
  ctx.stroke();

  // 3 Columns: DATES | VENUE | ADMISSION
  const colWidth = (cardW - 88) / 3;
  const colY = footerY + 32;

  // Col 1
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('EVENT DATES', cardX + 44, colY);
  ctx.fillStyle = '#0E1726';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText('9–11 November 2026', cardX + 44, colY + 24);

  // Col 2
  const col2X = cardX + 44 + colWidth;
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('VENUE', col2X, colY);
  ctx.fillStyle = '#0E1726';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText('Harare, Zimbabwe', col2X, colY + 24);

  // Col 3
  const col3X = cardX + 44 + colWidth * 2;
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('ADMISSION', col3X, colY);
  ctx.fillStyle = '#0D652D';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText('✓ Confirmed', col3X, colY + 24);

  // Bottom Security Line & Barcode Graphic
  const barcodeY = footerY + 105;
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(cardX + 44, barcodeY);
  ctx.lineTo(cardX + cardW - 44, barcodeY);
  ctx.stroke();

  // Micro Security Disclaimer
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'normal 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('Personal entry ticket · Non-transferable · Issued by OAK Foundation', cardX + 44, barcodeY + 26);

  ctx.textAlign = 'right';
  ctx.font = 'bold 11px Consolas, Monaco, monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(`ID: ${attendee.registrationId}`, cardX + cardW - 44, barcodeY + 26);
  ctx.textAlign = 'left';

  ctx.restore();

  // 8. Convert to PNG Blob and Download
  try {
    const pngUrl = canvas.toDataURL('image/png');
    const safeName = `${attendee.firstName}-${attendee.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `OAK-Ticket-${attendee.registrationId}-${safeName}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    return true;
  } catch (err) {
    console.error('Failed to trigger ticket download:', err);
    return false;
  }
}
