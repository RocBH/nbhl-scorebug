type Cell = string | number | null;
function xml(value: string) { return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function column(index: number) { let value = ""; for (index++; index; index = Math.floor((index-1)/26)) value = String.fromCharCode(65+(index-1)%26)+value; return value; }
function crc32(data: Uint8Array) { let crc = -1; for (const byte of data) { crc ^= byte; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); } return (crc^-1)>>>0; }
function zip(files: Record<string,string>) {
  const encoder = new TextEncoder(), chunks: Uint8Array[] = [], central: Uint8Array[] = []; let offset=0, centralSize=0;
  function header(size: number) { const bytes=new Uint8Array(size); return { bytes, view:new DataView(bytes.buffer) }; }
  for(const [name,content] of Object.entries(files)) {
    const filename=encoder.encode(name), data=encoder.encode(content), crc=crc32(data), local=header(30+filename.length);
    local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,data.length,true);local.view.setUint32(22,data.length,true);local.view.setUint16(26,filename.length,true);local.bytes.set(filename,30);
    chunks.push(local.bytes,data);
    const entry=header(46+filename.length);entry.view.setUint32(0,0x02014b50,true);entry.view.setUint16(4,20,true);entry.view.setUint16(6,20,true);entry.view.setUint16(8,0x800,true);entry.view.setUint32(16,crc,true);entry.view.setUint32(20,data.length,true);entry.view.setUint32(24,data.length,true);entry.view.setUint16(28,filename.length,true);entry.view.setUint32(42,offset,true);entry.bytes.set(filename,46);central.push(entry.bytes);centralSize+=entry.bytes.length;offset+=local.bytes.length+data.length;
  }
  const end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,central.length,true);end.view.setUint16(10,central.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
  const result=new Uint8Array(offset+centralSize+22);let cursor=0;for(const chunk of [...chunks,...central,end.bytes]){result.set(chunk,cursor);cursor+=chunk.length;}return result;
}
export type EventSheet = { name: string; rows: Cell[][] };
function sheetXml(rows: Cell[][]) {
  const headers=["", "File Name", "Type", "Scoring/Save Team", "Goal Scorer/Goalie", "Assist 1", "Assist 2", "Video Time of Clip", "Period End Time", "Period Start Time", "Period"];
  const all: Cell[][]=[headers,...rows];
  const sheetRows=all.map((row,index)=>`<row r="${index+1}" ht="${index===0?36:24}" customHeight="1">${row.map((value,col)=>{
    const ref=`${column(col)}${index+1}`,style=index===0?2:col>=7&&col<=9?3:0;
    if(value===null) return `<c r="${ref}" s="${style}"/>`;
    return typeof value==="number"?`<c r="${ref}" s="${style}"><v>${value}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const widths=[8,58,20,30,24,16,16,24,24,24,14];
  return `<worksheet xmlns="${ns}"><dimension ref="A1:K${all.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${widths.map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:K${Math.max(1,all.length)}"/></worksheet>`;
}
export function eventLogsXlsx(sheets: EventSheet[]) {
  if (!sheets.length) throw new Error("Select at least one game");
  const used = new Set<string>();
  const names = sheets.map(sheet => {
    const base = sheet.name.replace(/[\[\]:*?\/\\]/g," ").replace(/^'+|'+$/g,"").trim().slice(0,31) || "Game";
    let name = base, suffix = 2;
    while (used.has(name.toLowerCase())) { const tail = ` (${suffix++})`; name = base.slice(0,31-tail.length)+tail; }
    used.add(name.toLowerCase()); return name;
  });
  const sheetTypes = sheets.map((_,index) => `<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files: Record<string,string> = {
    "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetTypes}</Types>`,
    "_rels/.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name,index) => `<sheet name="${xml(name)}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,index) => `<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join("")}<Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml":`<styleSheet xmlns="${ns}"><numFmts count="2"><numFmt numFmtId="164" formatCode="hh:mm:ss"/><numFmt numFmtId="165" formatCode="mm/dd/yy hh:mm:ss"/></numFmts><fonts count="3"><font><sz val="12"/><name val="Calibri"/></font><font><b/><sz val="18"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="12"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF303030"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  };
  sheets.forEach((sheet,index) => { files[`xl/worksheets/sheet${index+1}.xml`] = sheetXml(sheet.rows); });
  return zip(files);
}
const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
export function eventLogXlsx(_gameId: string, rows: Cell[][]) { return eventLogsXlsx([{name:"Game events", rows}]); }
