
'use client';
import React, { useState } from 'react';

interface TestStepRow {
  section?: string;
  workItemType: string;
  title: string;
  testStep: string;
  stepAction: string;
  stepExpected: string;
}

interface NumberedRow extends TestStepRow {
  _sno: number;      // test-case serial number within its section
  _step: number;     // step index within the current test case
  _newCase: boolean; // true on the first row of a test case
}

export const AiTestStudio: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<TestStepRow[]>([]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [sectionScreenshots, setSectionScreenshots] = useState<Record<string, string>>({});
  const [pageTitle, setPageTitle] = useState('');
  const [showDownloads, setShowDownloads] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null);
  const [brokenShots, setBrokenShots] = useState<Record<string, boolean>>({});

  // URL se clean website name nikaalne ke liye
  const getCleanWebsiteName = (inputUrl: string): string => {
    try {
      if (!inputUrl) return 'Web_Upgrade';
      let domain = inputUrl.replace('https://', '').replace('http://', '').replace('www.', '');
      domain = domain.split('/')[0];
      const nameCleaned = domain.split('.')[0];
      return nameCleaned.charAt(0).toUpperCase() + nameCleaned.slice(1);
    } catch {
      return 'Web_Upgrade';
    }
  };

  // Escape user/AI content so a stray < or & can never break the generated table.
  const esc = (s: unknown): string =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // Assigns a serial number to each test case (1,2,3…) and a step number
  // within each case. A row starts a new case when it carries a Title or a
  // Work Item Type; rows with neither are treated as continuation steps.
  const numberRows = (rows: TestStepRow[]): NumberedRow[] => {
    let tc = 0;
    let step = 0;
    return rows.map((row) => {
      const isNewCase =
        (!!row.title && row.title.trim() !== '') ||
        (!!row.workItemType && row.workItemType.trim() !== '');
      if (isNewCase) {
        tc += 1;
        step = 1;
      } else {
        step += 1;
      }
      return { ...row, _sno: tc, _step: step, _newCase: isNewCase };
    });
  };

  const groupStepsBySection = (
    rows: TestStepRow[],
    order: string[]
  ): { section: string; rows: NumberedRow[] }[] => {
    const map = new Map<string, TestStepRow[]>();
    rows.forEach((row) => {
      const key = row.section || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });

    const orderedKeys = order.length > 0 ? order.filter((name) => map.has(name)) : [];
    map.forEach((_, key) => {
      if (!orderedKeys.includes(key)) orderedKeys.push(key);
    });

    return orderedKeys.map((section) => ({ section, rows: numberRows(map.get(section)!) }));
  };

  const handleGenerateTests = async () => {
    if (!url) return;
    setLoading(true);
    setShowDownloads(false);
    setSteps([]);
    setSectionOrder([]);
    setSectionScreenshots({});
    setBrokenShots({});
    setPageTitle('');

    try {
      const response = await fetch('http://localhost:5000/api/generate-playwright-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Scan failed — check backend logs.');
        return;
      }

      if (data.steps && data.steps.length > 0) {
        setSteps(data.steps);
        setSectionOrder(data.sectionOrder || []);
        setSectionScreenshots(data.sectionScreenshots || {});
        setPageTitle(data.pageTitle || '');
        setShowDownloads(true);
      } else {
        alert('AI returned no test steps for this page. Try a different URL or check your ANTHROPIC_API_KEY.');
      }
    } catch (error) {
      console.error('Studio Matrix Compilation Failure Trace:', error);
      alert('Connection failed! Please make sure your backend node server is running (npm start).');
    } finally {
      setLoading(false);
    }
  };

  const groupedSteps = groupStepsBySection(steps, sectionOrder);
  const siteName = getCleanWebsiteName(url);
  const documentTitle = pageTitle ? `${siteName} — ${pageTitle}` : `${siteName} — ${url}`;

  // ---- Shared table style tokens (kept identical across preview / Word / PDF) ----
  const TABLE_OPEN =
    '<table border="1" cellspacing="0" cellpadding="6" ' +
    'style="width:100%; border-collapse:collapse; border:1px solid #B7B7B7; ' +
    'font-family:Calibri, Arial, sans-serif; font-size:11px; margin-top:8px;">';

  const TH = (label: string, width: string, align = 'left') =>
    `<th style="border:1px solid #B7B7B7; background:#EAF6FA; color:#1F6F8B; ` +
    `padding:8px; text-align:${align}; font-weight:bold; width:${width};">${label}</th>`;

  const TD = (content: string, opts: { align?: string; bold?: boolean; pre?: boolean } = {}) =>
    `<td style="border:1px solid #C7C7C7; padding:8px; vertical-align:top; ` +
    `text-align:${opts.align || 'left'};${opts.bold ? ' font-weight:bold;' : ''}` +
    `${opts.pre ? ' white-space:pre-line;' : ''}">${content}</td>`;

  const buildHtmlTableString = (dataRows: NumberedRow[]) => {
    const head =
      '<thead><tr>' +
      TH('#', '5%', 'center') +
      TH('Work Item Type', '13%') +
      TH('Title', '22%') +
      TH('Step', '7%', 'center') +
      TH('Step Action', '26%') +
      TH('Step Expected', '27%') +
      '</tr></thead>';

    const body = dataRows
      .map(
        (row) =>
          '<tr>' +
          TD(row._newCase ? String(row._sno) : '', { align: 'center', bold: true }) +
          TD(esc(row.workItemType), { bold: true }) +
          TD(esc(row.title), { bold: true }) +
          TD(String(row._step), { align: 'center' }) +
          TD(esc(row.stepAction), { pre: true }) +
          TD(esc(row.stepExpected), { pre: true }) +
          '</tr>'
      )
      .join('');

    return `${TABLE_OPEN}${head}<tbody>${body}</tbody></table>`;
  };

  const buildSectionScreenshotHtml = (section: string, shots: Record<string, string>) => {
    const src = shots[section];
    if (!src) return '';
    return `
      <div style="margin-top:10px;">
        <p style="font-size:10px; font-weight:bold; color:#666; margin:0 0 4px 0; font-family:Calibri, Arial, sans-serif;">
          Screenshot — ${esc(section)}
        </p>
        <img src="${esc(src)}" style="max-width:100%; border:1px solid #C7C7C7; border-radius:4px;" />
      </div>
    `;
  };

  const buildSectionedBody = (pageBreakBetween: boolean, shots: Record<string, string>) =>
    groupedSteps
      .map(
        ({ section, rows }, index) => `
      <div style="${pageBreakBetween && index > 0 ? 'page-break-before: always;' : ''} margin-top:${index > 0 ? '24px' : '0'};">
        <h3 style="color:#1F4E79; border-bottom:2px solid #5BC0DE; padding-bottom:4px; margin-bottom:2px; font-family:Calibri, Arial, sans-serif;">
          ${esc(`${index + 1}. ${section}`)}
        </h3>
        ${buildHtmlTableString(rows)}
        ${buildSectionScreenshotHtml(section, shots)}
      </div>
    `
      )
      .join('');

  // PDF/Word are generated from an HTML string that has to stand on its own —
  // by the time Word actually renders it (or the print window prints), the
  // backend may be slower to respond, offline, or the process may have
  // restarted (screenshots live under a per-run folder). Embedding each
  // screenshot as a base64 data URI up front means the exported document
  // never depends on a live fetch to localhost:5000 again.
  const toDataUrl = async (src: string): Promise<string | null> => {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error(`Could not embed screenshot for export: ${src}`, err);
      return null;
    }
  };

  const embedScreenshots = async (): Promise<Record<string, string>> => {
    const entries = await Promise.all(
      Object.entries(sectionScreenshots).map(async ([section, src]) => [section, await toDataUrl(src)] as const)
    );
    return entries.reduce<Record<string, string>>((acc, [section, dataUrl]) => {
      if (dataUrl) acc[section] = dataUrl;
      return acc;
    }, {});
  };

  // Print stylesheet ensures header colours actually render in the PDF and the
  // table header repeats on every page. Without print-color-adjust the teal
  // header prints white in most browsers.
  const PRINT_STYLES = `
    <style>
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { padding: 30px; font-family: Calibri, Arial, sans-serif; color: #222; }
      h2 { color:#1F4E79; margin-bottom:4px; text-align:center; }
      .scope { font-size:12px; color:#666; text-align:center; margin-bottom:18px; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
    </style>`;

  const downloadAsPDF = async () => {
    // Open the window synchronously, before any await, so pop-up blockers
    // still see it as a direct result of the click.
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    setExporting('pdf');
    try {
      const shots = await embedScreenshots();
      printWindow.document.write(`
        <html>
          <head><title>${esc(documentTitle)}</title>${PRINT_STYLES}</head>
          <body>
            <h2>${esc(documentTitle)}</h2>
            <p class="scope"><b>Scope URL:</b> ${esc(url)} &nbsp;|&nbsp; <b>Date:</b> ${new Date().toLocaleDateString()}</p>
            ${buildSectionedBody(true, shots)}
            <script>
              (function () {
                function printAndClose() { window.print(); window.close(); }
                var pending = Array.prototype.filter.call(document.images, function (img) { return !img.complete; });
                if (pending.length === 0) { printAndClose(); return; }
                var remaining = pending.length;
                function onSettle() { remaining -= 1; if (remaining <= 0) printAndClose(); }
                pending.forEach(function (img) {
                  img.addEventListener('load', onSettle);
                  img.addEventListener('error', onSettle);
                });
                setTimeout(printAndClose, 4000); // safety net if an image stalls
              })();
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } finally {
      setExporting(null);
    }
  };

  const WORD_HEAD =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
    "xmlns:w='urn:schemas-microsoft-com:office:word' " +
    "xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>" +
    '<title>QA Test Suite</title>' +
    "<style>body{font-family:Calibri, Arial, sans-serif;} " +
    'h2{color:#1F4E79;text-align:center;margin-bottom:4px;} ' +
    '.scope{font-size:12px;color:#666;text-align:center;margin-bottom:16px;}</style>' +
    '</head><body>';
  const WORD_FOOT = '</body></html>';

  const downloadAsWord = async () => {
    setExporting('word');
    try {
      const shots = await embedScreenshots();
      const sourceHTML =
        WORD_HEAD +
        `<h2>${esc(documentTitle)}</h2>` +
        `<p class="scope"><b>Scope URL:</b> ${esc(url)}</p>` +
        buildSectionedBody(true, shots) +
        WORD_FOOT;

      const blob = new Blob(['\ufeff' + sourceHTML], { type: 'application/msword' });
      const urlBlob = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlBlob;
      a.download = `${siteName}_Test_Pack.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(urlBlob);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 mt-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <i className="ph ph-layout text-emerald-600 text-xl"></i>
          AI Manual Test Case Matrix Studio
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Scan any website live to auto-generate a manual QA test pack — multi-step Test Cases,
          grouped by page component, headed with the real website and page name.
        </p>
      </div>

      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.themdu.com/"
          className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
        <button
          onClick={handleGenerateTests}
          disabled={loading || !url}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2 min-w-[180px] justify-center"
        >
          {loading ? (
            <><i className="ph ph-spinner-gap animate-spin"></i> Matrix Mapping...</>
          ) : (
            <><i className="ph ph-table"></i> Generate Test Matrix</>
          )}
        </button>
      </div>

      {/* Section-grouped preview (mirrors the exact look of the exported docs) */}
      {groupedSteps.length > 0 && (
        <div className="space-y-5">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 text-center">{documentTitle}</p>
          {groupedSteps.map(({ section, rows }, index) => (
            <div key={section} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-[#1F4E79] dark:text-sky-400 uppercase tracking-wide">
                  {index + 1}. {section}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-[#1F6F8B] dark:text-sky-300" style={{ background: '#EAF6FA' }}>
                      <th className="border border-[#B7B7B7] dark:border-slate-700 p-2 text-center w-[5%]">#</th>
                      <th className="border border-[#B7B7B7] dark:border-slate-700 p-2 text-left w-[13%]">Work Item Type</th>
                      <th className="border border-[#B7B7B7] dark:border-slate-700 p-2 text-left w-[22%]">Title</th>
                      <th className="border border-[#B7B7B7] dark:border-slate-700 p-2 text-center w-[7%]">Step</th>
                      <th className="border border-[#B7B7B7] dark:border-slate-700 p-2 text-left w-[26%]">Step Action</th>
                      <th className="border border-[#B7B7B7] dark:border-slate-700 p-2 text-left w-[27%]">Step Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="dark:bg-slate-800">
                        <td className="border border-[#C7C7C7] dark:border-slate-700 p-2 text-center font-bold align-top dark:text-slate-200">
                          {row._newCase ? row._sno : ''}
                        </td>
                        <td className="border border-[#C7C7C7] dark:border-slate-700 p-2 font-semibold align-top dark:text-slate-200">{row.workItemType || ''}</td>
                        <td className="border border-[#C7C7C7] dark:border-slate-700 p-2 font-semibold align-top dark:text-slate-200">{row.title || ''}</td>
                        <td className="border border-[#C7C7C7] dark:border-slate-700 p-2 text-center align-top dark:text-slate-300">{row._step}</td>
                        <td className="border border-[#C7C7C7] dark:border-slate-700 p-2 whitespace-pre-line align-top dark:text-slate-300">{row.stepAction || ''}</td>
                        <td className="border border-[#C7C7C7] dark:border-slate-700 p-2 whitespace-pre-line align-top dark:text-slate-300">{row.stepExpected || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sectionScreenshots[section] && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                    Screenshot — {section}
                  </p>
                  {brokenShots[section] ? (
                    <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                      Screenshot failed to load from the backend ({sectionScreenshots[section]}).
                    </p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sectionScreenshots[section]}
                      alt={`${section} screenshot`}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg"
                      onError={() => setBrokenShots((prev) => ({ ...prev, [section]: true }))}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showDownloads && (
        <div className="p-5 border border-dashed border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/20 rounded-xl flex flex-col gap-4 animate-fadeIn">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Download Steps</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={downloadAsWord}
              disabled={exporting !== null}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all min-w-[140px]"
            >
              {exporting === 'word' ? (
                <><i className="ph ph-spinner-gap animate-spin text-base"></i> Embedding shots...</>
              ) : (
                <><i className="ph ph-file-doc text-base"></i> MS Word</>
              )}
            </button>
            <button
              onClick={downloadAsPDF}
              disabled={exporting !== null}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all min-w-[140px]"
            >
              {exporting === 'pdf' ? (
                <><i className="ph ph-spinner-gap animate-spin text-base"></i> Embedding shots...</>
              ) : (
                <><i className="ph ph-file-pdf text-base"></i> PDF</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
