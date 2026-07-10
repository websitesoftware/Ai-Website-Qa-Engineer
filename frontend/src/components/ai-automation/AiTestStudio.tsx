
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
  const [pageTitle, setPageTitle] = useState('');
  const [showDownloads, setShowDownloads] = useState(false);

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

  const buildSectionedBody = (pageBreakBetween: boolean) =>
    groupedSteps
      .map(
        ({ section, rows }, index) => `
      <div style="${pageBreakBetween && index > 0 ? 'page-break-before: always;' : ''} margin-top:${index > 0 ? '24px' : '0'};">
        <h3 style="color:#1F4E79; border-bottom:2px solid #5BC0DE; padding-bottom:4px; margin-bottom:2px; font-family:Calibri, Arial, sans-serif;">
          ${esc(`${index + 1}. ${section}`)}
        </h3>
        ${buildHtmlTableString(rows)}
      </div>
    `
      )
      .join('');

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

  const downloadAsPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>${esc(documentTitle)}</title>${PRINT_STYLES}</head>
        <body>
          <h2>${esc(documentTitle)}</h2>
          <p class="scope"><b>Scope URL:</b> ${esc(url)} &nbsp;|&nbsp; <b>Date:</b> ${new Date().toLocaleDateString()}</p>
          ${buildSectionedBody(true)}
          <script>setTimeout(() => { window.print(); window.close(); }, 400);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
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

  const downloadAsWord = () => {
    const sourceHTML =
      WORD_HEAD +
      `<h2>${esc(documentTitle)}</h2>` +
      `<p class="scope"><b>Scope URL:</b> ${esc(url)}</p>` +
      buildSectionedBody(true) +
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
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 mt-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <i className="ph ph-layout text-emerald-600 text-xl"></i>
          AI Manual Test Case Matrix Studio
        </h3>
        <p className="text-xs text-slate-500 mt-1">
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
          className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
          <p className="text-sm font-bold text-slate-800 text-center">{documentTitle}</p>
          {groupedSteps.map(({ section, rows }, index) => (
            <div key={section} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <span className="text-xs font-bold text-[#1F4E79] uppercase tracking-wide">
                  {index + 1}. {section}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-[#1F6F8B]" style={{ background: '#EAF6FA' }}>
                      <th className="border border-[#B7B7B7] p-2 text-center w-[5%]">#</th>
                      <th className="border border-[#B7B7B7] p-2 text-left w-[13%]">Work Item Type</th>
                      <th className="border border-[#B7B7B7] p-2 text-left w-[22%]">Title</th>
                      <th className="border border-[#B7B7B7] p-2 text-center w-[7%]">Step</th>
                      <th className="border border-[#B7B7B7] p-2 text-left w-[26%]">Step Action</th>
                      <th className="border border-[#B7B7B7] p-2 text-left w-[27%]">Step Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i}>
                        <td className="border border-[#C7C7C7] p-2 text-center font-bold align-top">
                          {row._newCase ? row._sno : ''}
                        </td>
                        <td className="border border-[#C7C7C7] p-2 font-semibold align-top">{row.workItemType || ''}</td>
                        <td className="border border-[#C7C7C7] p-2 font-semibold align-top">{row.title || ''}</td>
                        <td className="border border-[#C7C7C7] p-2 text-center align-top">{row._step}</td>
                        <td className="border border-[#C7C7C7] p-2 whitespace-pre-line align-top">{row.stepAction || ''}</td>
                        <td className="border border-[#C7C7C7] p-2 whitespace-pre-line align-top">{row.stepExpected || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDownloads && (
        <div className="p-5 border border-dashed border-emerald-200 bg-emerald-50/20 rounded-xl flex flex-col gap-4 animate-fadeIn">
          <p className="text-sm font-bold text-slate-800">Download Steps</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={downloadAsWord}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <i className="ph ph-file-doc text-base"></i> MS Word
            </button>
            <button
              onClick={downloadAsPDF}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <i className="ph ph-file-pdf text-base"></i> PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
