import { Document, Packer, Paragraph } from "docx";
const doc = new Document({ sections: [{ children: [
  new Paragraph("Резюме: директор по снабжению."),
  new Paragraph("Опыт: угольный разрез, парк БелАЗ, категорийные закупки, обеспеченность 68->92%."),
]}]});
const buf = await Packer.toBuffer(doc);
const b64 = buf.toString("base64");
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const res = await fetch("http://localhost:3108/api/extract", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ base64: b64, mediaType: DOCX, filename: "resume.docx" }),
});
const d = await res.json();
console.log("status", res.status, "| text:", (d.text||d.error||"").slice(0,120).replace(/\n/g," "));
