import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
} from 'docx';
import { BackendTest } from './types';

function slug(url: string) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function downloadBlobObject(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(content: string, filename: string, mime: string) {
  downloadBlobObject(new Blob([content], { type: mime }), filename);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
export function exportReportCSV(test: BackendTest) {
  const esc = (v: unknown) => `"${String(v ?? '-').replace(/"/g, '""')}"`;
  const lines: string[] = [];

  lines.push(`AI Website QA Engineer - Report for ${test.url}`);
  lines.push(`Generated,${new Date().toLocaleString()}`);
  lines.push(`Overall Score,${test.score ?? '-'}`);
  lines.push(`Status,${test.status}`);
  lines.push('');

  lines.push('Lighthouse Scores');
  lines.push('Category,Score');
  lines.push(`Performance,${test.scores.performance ?? '-'}`);
  lines.push(`Accessibility,${test.scores.accessibility ?? '-'}`);
  lines.push(`SEO,${test.scores.seo ?? '-'}`);
  lines.push(`Best Practices,${test.scores.bestPractices ?? '-'}`);
  lines.push('');

  if (test.accessibility?.violations?.length) {
    lines.push('Accessibility Violations');
    lines.push('Impact,Issue,Elements Affected,Help URL');
    test.accessibility.violations.forEach((v) => {
      lines.push([esc(v.impact), esc(v.help), esc(v.nodes), esc(v.helpUrl)].join(','));
    });
    lines.push('');
  }

  if (test.seo?.checks?.length) {
    lines.push(`SEO Audit (score ${test.seo.score ?? '-'}/100)`);
    lines.push('Check,Status,Message');
    test.seo.checks.forEach((c) => {
      lines.push([esc(c.id), esc(c.passed ? 'Pass' : 'Fail'), esc(c.message)].join(','));
    });
    lines.push('');
  }

  if (test.visualRegression?.length) {
    lines.push('Visual Regression');
    lines.push('Viewport,Status,Diff %');
    test.visualRegression.forEach((r) => {
      lines.push(
        [
          esc(r.viewport),
          esc(r.isNewBaseline ? 'New baseline' : r.significant ? 'Significant change' : 'No change'),
          esc(r.diffPercentage ?? 0),
        ].join(',')
      );
    });
    lines.push('');
  }

  if (test.crossBrowser?.length) {
    lines.push('Cross-Browser Testing');
    lines.push('Browser,Status,Load Time (ms),Detail');
    test.crossBrowser.forEach((r) => {
      lines.push(
        [
          esc(r.browser),
          esc(r.ok ? 'OK' : 'Failed'),
          esc(r.loadTimeMs ?? '-'),
          esc(r.error || (r.statusCode ? `Status ${r.statusCode}` : '-')),
        ].join(',')
      );
    });
    lines.push('');
  }

  if (test.performanceBenchmark) {
    lines.push('Performance Benchmark');
    lines.push('Metric,Current,Previous,Delta');
    const pb = test.performanceBenchmark;
    (Object.keys(pb.metrics) as Array<keyof typeof pb.metrics>).forEach((key) => {
      lines.push(
        [esc(key), esc(pb.metrics[key]), esc(pb.previousMetrics?.[key] ?? '-'), esc(pb.delta[key] ?? '-')].join(',')
      );
    });
    lines.push('');
  }

  if (test.issues?.length) {
    lines.push('All Issues');
    lines.push('Severity,Category,Title,Description,URL,Resolved');
    test.issues.forEach((i) => {
      lines.push(
        [esc(i.severity), esc(i.category), esc(i.title), esc(i.description), esc(i.url), esc(i.resolved ? 'Yes' : 'No')].join(
          ','
        )
      );
    });
  }

  downloadText(lines.join('\n'), `qa-report-${slug(test.url)}.csv`, 'text/csv');
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
export function exportReportPDF(test: BackendTest) {
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(16);
  doc.text('AI Website QA Engineer - Report', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(test.url, 14, y);
  y += 5;
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
  y += 5;
  doc.text(`Overall Score: ${test.score ?? '-'} / 100  |  Status: ${test.status}`, 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Score']],
    body: [
      ['Performance', String(test.scores.performance ?? '-')],
      ['Accessibility', String(test.scores.accessibility ?? '-')],
      ['SEO', String(test.scores.seo ?? '-')],
      ['Best Practices', String(test.scores.bestPractices ?? '-')],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  const ensureSpace = () => {
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
  };

  if (test.accessibility?.violations?.length) {
    ensureSpace();
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text('Accessibility Violations', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Impact', 'Issue', 'Elements']],
      body: test.accessibility.violations.map((v) => [v.impact || '-', v.help, String(v.nodes)]),
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (test.seo?.checks?.length) {
    ensureSpace();
    doc.setFontSize(12);
    doc.text(`SEO Audit (score ${test.seo.score ?? '-'}/100)`, 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Check', 'Status', 'Message']],
      body: test.seo.checks.map((c) => [c.id, c.passed ? 'Pass' : 'Fail', c.message]),
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (test.crossBrowser?.length) {
    ensureSpace();
    doc.setFontSize(12);
    doc.text('Cross-Browser Testing', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Browser', 'Status', 'Load Time', 'Detail']],
      body: test.crossBrowser.map((r) => [
        r.browser,
        r.ok ? 'OK' : 'Failed',
        r.loadTimeMs ? `${r.loadTimeMs}ms` : '-',
        r.error || (r.statusCode ? `Status ${r.statusCode}` : '-'),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (test.visualRegression?.length) {
    ensureSpace();
    doc.setFontSize(12);
    doc.text('Visual Regression', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Viewport', 'Status', 'Diff %']],
      body: test.visualRegression.map((r) => [
        r.viewport,
        r.isNewBaseline ? 'New baseline' : r.significant ? 'Significant change' : 'No change',
        String(r.diffPercentage ?? 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (test.issues?.length) {
    ensureSpace();
    doc.setFontSize(12);
    doc.text('All Issues', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Severity', 'Category', 'Title']],
      body: test.issues.map((i) => [i.severity, i.category, i.title]),
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
    });
  }

  doc.save(`qa-report-${slug(test.url)}.pdf`);
}

// ---------------------------------------------------------------------------
// Word (.docx)
// ---------------------------------------------------------------------------
function makeTable(headers: string[], rows: string[][]) {
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        })
    ),
  });
  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        children: r.map(
          (cell) =>
            new TableCell({
              width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
              children: [new Paragraph(cell)],
            })
        ),
      })
  );
  return new Table({ rows: [headerRow, ...bodyRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

export async function exportReportDocx(test: BackendTest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  children.push(new Paragraph({ text: 'AI Website QA Engineer - Report', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: test.url }));
  children.push(new Paragraph({ text: `Generated: ${new Date().toLocaleString()}` }));
  children.push(new Paragraph({ text: `Overall Score: ${test.score ?? '-'} / 100  |  Status: ${test.status}` }));
  children.push(new Paragraph({ text: '' }));

  children.push(new Paragraph({ text: 'Lighthouse Scores', heading: HeadingLevel.HEADING_2 }));
  children.push(
    makeTable(
      ['Category', 'Score'],
      [
        ['Performance', String(test.scores.performance ?? '-')],
        ['Accessibility', String(test.scores.accessibility ?? '-')],
        ['SEO', String(test.scores.seo ?? '-')],
        ['Best Practices', String(test.scores.bestPractices ?? '-')],
      ]
    )
  );
  children.push(new Paragraph({ text: '' }));

  if (test.accessibility?.violations?.length) {
    children.push(new Paragraph({ text: 'Accessibility Violations', heading: HeadingLevel.HEADING_2 }));
    children.push(
      makeTable(
        ['Impact', 'Issue', 'Elements'],
        test.accessibility.violations.map((v) => [v.impact || '-', v.help, String(v.nodes)])
      )
    );
    children.push(new Paragraph({ text: '' }));
  }

  if (test.seo?.checks?.length) {
    children.push(
      new Paragraph({ text: `SEO Audit (score ${test.seo.score ?? '-'}/100)`, heading: HeadingLevel.HEADING_2 })
    );
    children.push(
      makeTable(
        ['Check', 'Status', 'Message'],
        test.seo.checks.map((c) => [c.id, c.passed ? 'Pass' : 'Fail', c.message])
      )
    );
    children.push(new Paragraph({ text: '' }));
  }

  if (test.crossBrowser?.length) {
    children.push(new Paragraph({ text: 'Cross-Browser Testing', heading: HeadingLevel.HEADING_2 }));
    children.push(
      makeTable(
        ['Browser', 'Status', 'Load Time', 'Detail'],
        test.crossBrowser.map((r) => [
          r.browser,
          r.ok ? 'OK' : 'Failed',
          r.loadTimeMs ? `${r.loadTimeMs}ms` : '-',
          r.error || (r.statusCode ? `Status ${r.statusCode}` : '-'),
        ])
      )
    );
    children.push(new Paragraph({ text: '' }));
  }

  if (test.visualRegression?.length) {
    children.push(new Paragraph({ text: 'Visual Regression', heading: HeadingLevel.HEADING_2 }));
    children.push(
      makeTable(
        ['Viewport', 'Status', 'Diff %'],
        test.visualRegression.map((r) => [
          r.viewport,
          r.isNewBaseline ? 'New baseline' : r.significant ? 'Significant change' : 'No change',
          String(r.diffPercentage ?? 0),
        ])
      )
    );
    children.push(new Paragraph({ text: '' }));
  }

  if (test.issues?.length) {
    children.push(new Paragraph({ text: 'All Issues', heading: HeadingLevel.HEADING_2 }));
    children.push(makeTable(['Severity', 'Category', 'Title'], test.issues.map((i) => [i.severity, i.category, i.title])));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlobObject(blob, `qa-report-${slug(test.url)}.docx`);
}