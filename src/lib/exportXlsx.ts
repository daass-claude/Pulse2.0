import * as XLSX from 'xlsx';
import type { EODEntry, EmployeeEOD } from '../app/contexts/EODContext';

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}


function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export function exportEODEntry(entry: EODEntry, employeeName: string) {
  // Header rows matching the required format
  const header = ['Prio level', 'Task Status', 'Specific Task', 'Related Links', 'Time', 'Notes/ Challenges/ etc.'];
  const hints  = ['',           '',             '',               'or N/A',        'h/m',  'Jargons'];

  const dataRows = entry.tasks.map(t => [
    t.priority || '',
    t.status,
    t.task || '(unnamed)',
    t.relatedLinks || 'N/A',
    fmtTime(t.elapsedTime),
    t.notes || '',
  ]);

  const wsData = [header, hints, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 14 }, { wch: 13 }, { wch: 32 }, { wch: 20 }, { wch: 8 }, { wch: 36 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'EOD Report');

  const safeName = employeeName.replace(/\s+/g, '_');
  const safeDate = entry.date.replace(/[,\s]+/g, '_');
  download(wb, `EOD_${safeName}_${safeDate}.xlsx`);
}

export function exportPayrollWeek(weekLabel: string, entries: EODEntry[], employeeName: string) {
  let totalMin = 0;
  const rows = entries.map(e => {
    const [h = 0, m = 0] = e.totalHours.split(':').map(Number);
    totalMin += h * 60 + m;
    return { Date: e.date, Login: e.loginTime, Logout: e.logoutTime, 'Hours Worked': e.totalHours };
  });

  const th = Math.floor(totalMin / 60).toString().padStart(2, '0');
  const tm = (totalMin % 60).toString().padStart(2, '0');
  rows.push({ Date: 'TOTAL', Login: '', Logout: '', 'Hours Worked': `${th}:${tm}` });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

  const safeName = employeeName.replace(/\s+/g, '_');
  const safeWeek = weekLabel.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  download(wb, `Payroll_${safeName}_${safeWeek}.xlsx`);
}

export function exportAllEODs(eod: EmployeeEOD) {
  const wb = XLSX.utils.book_new();
  const header = ['Prio level', 'Task Status', 'Specific Task', 'Related Links', 'Time', 'Notes/ Challenges/ etc.'];
  const hints  = ['',           '',             '',               'or N/A',        'h/m',  'Jargons'];

  // Sort newest-first so the first sheet is the most recent day
  const sorted = [...eod.entries].sort((a, b) => {
    const pa = a.date.replace(/^[^,]+,\s*/, '');
    const pb = b.date.replace(/^[^,]+,\s*/, '');
    return new Date(`${pb}, ${new Date().getFullYear()}`).getTime() -
           new Date(`${pa}, ${new Date().getFullYear()}`).getTime();
  });

  for (const entry of sorted) {
    const dataRows = entry.tasks.map(t => [
      t.priority || '',
      t.status,
      t.task || '(unnamed)',
      t.relatedLinks || 'N/A',
      fmtTime(t.elapsedTime),
      t.notes || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, hints, ...dataRows]);
    ws['!cols'] = [{ wch: 14 }, { wch: 13 }, { wch: 32 }, { wch: 20 }, { wch: 8 }, { wch: 36 }];
    // Excel sheet names max 31 chars; strip commas
    const sheetName = entry.date.replace(/,\s*/g, ' ').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const safeName = eod.employeeName.replace(/\s+/g, '_');
  download(wb, `EOD_${safeName}_All.xlsx`);
}

export function exportPayrollAll(eod: EmployeeEOD) {
  let totalMin = 0;
  const rows = eod.entries.map(e => {
    const [h = 0, m = 0] = e.totalHours.split(':').map(Number);
    totalMin += h * 60 + m;
    return { Date: e.date, Login: e.loginTime, Logout: e.logoutTime, 'Hours Worked': e.totalHours };
  });

  const th = Math.floor(totalMin / 60).toString().padStart(2, '0');
  const tm = (totalMin % 60).toString().padStart(2, '0');
  rows.push({ Date: 'TOTAL', Login: '', Logout: '', 'Hours Worked': `${th}:${tm}` });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'All Payroll');

  const safeName = eod.employeeName.replace(/\s+/g, '_');
  download(wb, `Payroll_${safeName}_All.xlsx`);
}
