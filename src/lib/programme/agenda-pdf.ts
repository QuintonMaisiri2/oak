import { jsPDF } from "jspdf";
import { proposedThemes, proposedTracks, teamLeads, conveningObjectives } from "@/components/programme/data";
import type { ScheduleDay } from "@/lib/types/programme";

export function createAgendaPdf(scheduleDays: ScheduleDay[]): ArrayBuffer {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title: "Oak Grantee Convening 2026 - Working Agenda", author: "Oak Zimbabwe" });
  let y = 22;
  const clean = (text: string) => text.replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  
  function page() {
    pdf.addPage();
    y = 22;
  }
  
  function text(value: string, size = 10, bold = false, gap = 3) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(bold ? "#1C2E5A" : "#475569");
    const lines: string[] = pdf.splitTextToSize(clean(value), 174);
    const lineHeight = size * 0.48;
    for (const line of lines) {
      if (y + lineHeight > 275) page();
      pdf.text(line, 18, y);
      y += lineHeight;
    }
    y += gap;
  }
  
  text("OAK GRANTEE CONVENING 2026", 10, true);
  text("Theme: Partnerships for Lasting Change", 18, true, 4);
  text("Working Agenda", 14, true, 4);
  text("9-11 November 2026 | Harare, Zimbabwe", 11, true, 3);
  text("Objectives", 12, true, 2);
  conveningObjectives.forEach((obj, idx) => {
    text(`${idx + 1}. ${obj}`, 9.5, false, 2);
  });
  y += 2;
  text("This agenda is offered as a starting structure for Oak's content and agenda design; timings and session titles remain fully adjustable to Oak's program objectives.", 10, false, 7);

  scheduleDays.forEach((day, index) => {
    if (index) page();
    text(`${day.label}: ${day.dateStr}`, 15, true);
    if (day.theme) text(day.theme, 10, false, 5);
    for (const item of day.items) {
      if (y > 247) page();
      const time = item.kind === "session" ? `${item.data.startTime} - ${item.data.endTime}` : item.data.time;
      text(time, 9.5, true, 1);
      text(item.data.title, 11, true, 1.5);
      if (item.kind === "session") {
        if (item.data.description) text(item.data.description, 9, false, 2);
        if (item.data.speakers.length) text(`Led by / Presenters: ${item.data.speakers.map(speaker => speaker.name).join(", ")}`, 8.5, false, 2);
        item.data.tracks?.forEach((track, i) => {
          text(`Track ${["i", "ii", "iii", "iv", "v", "vi"][i] ?? i + 1}: ${track.title}${track.location ? ` (${track.location})` : ""}`, 9.5, true, 1);
          if (track.speakers.length) text(track.speakers.map(speaker => speaker.name).join(", "), 8.5, false, 2);
        });
      }
      y += 3;
    }
  });

  page();
  text("Convening Theme", 16, true, 5);
  proposedThemes.forEach((theme, index) => text(`• ${theme}`, 11, false, 4));
  y += 6;
  text("Breakout Tracks", 16, true, 5);
  text("Participants attend two of the three parallel tracks across the day. Each track captures key takeaways for closing reflections.", 10, false, 4);
  proposedTracks.forEach((track, index) => {
    if (y > 245) page();
    text(`Track ${index + 1}: ${track.title}`, 11, true, 1);
    text(track.description, 10, false, 4);
  });
  
  page();
  text("Convening Leads & Coordination Team", 16, true, 5);
  text("Coordination team supporting delivery of the Oak Grantee Convening.", 10, false, 6);
  teamLeads.forEach(lead => {
    text(lead.area, 10, true, 1);
    text(lead.lead, 11, false, 5);
  });

  const pages = pdf.getNumberOfPages();
  for (let number = 1; number <= pages; number++) {
    pdf.setPage(number);
    pdf.setDrawColor("#E2E8F0");
    pdf.line(18, 281, 192, 281);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor("#64748B");
    pdf.text("Oak Grantee Convening 2026 | Working Agenda", 18, 287);
    pdf.text(`${number} / ${pages}`, 192, 287, { align: "right" });
  }

  return pdf.output("arraybuffer");
}
