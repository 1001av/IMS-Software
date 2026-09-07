import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * Escapes a field value according to RFC-4180 CSV specifications:
 * - If the value contains a comma, double-quote, or newline, wrap it in quotes.
 * - Any double-quotes within the value are escaped by doubling them (" -> "").
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC-4180 compliant CSV string with a UTF-8 BOM (\uFEFF)
 * so Microsoft Excel on Windows opens it with clean text and rupee currency symbols.
 */
export function buildCsvString<T>(columns: CsvColumn<T>[], data: T[]): string {
  const headerRow = columns.map((col) => escapeCsvValue(col.header)).join(",");
  const dataRows = data.map((row) =>
    columns.map((col) => escapeCsvValue(col.accessor(row))).join(",")
  );

  return "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
}

/**
 * Saves a CSV string to the user's filesystem:
 * 1. Prompts the user with Tauri's native Save File dialog.
 * 2. If running outside of Tauri or dialog fails, seamlessly falls back to a browser Blob download.
 */
export async function downloadCsv<T>(
  defaultFilename: string,
  columns: CsvColumn<T>[],
  data: T[]
): Promise<boolean> {
  const csvContent = buildCsvString(columns, data);

  // Try Tauri native dialog and file system first
  try {
    const selectedPath = await save({
      title: "Export Report to CSV",
      defaultPath: defaultFilename,
      filters: [
        {
          name: "CSV (Comma delimited)",
          extensions: ["csv"],
        },
      ],
    });

    if (!selectedPath) {
      return false; // User cancelled file dialog
    }

    await writeTextFile(selectedPath, csvContent);
    return true;
  } catch {
    // Fall back to standard browser Blob download
    try {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", defaultFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.error("Failed to trigger CSV download fallback:", err);
      return false;
    }
  }
}
