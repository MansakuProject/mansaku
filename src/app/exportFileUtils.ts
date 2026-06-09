/// <reference path="./fileSystemAccess.d.ts" />

export type ExportFileErrorKind =
  | "cancel"
  | "write-blocked"
  | "permission"
  | "unknown";

function getErrorName(error: unknown) {
  return error instanceof DOMException || error instanceof Error ? error.name : "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof DOMException || error instanceof Error) {
    return error.message.toLowerCase();
  }

  return String(error ?? "").toLowerCase();
}

export function isAbortError(error: unknown) {
  return getErrorName(error) === "AbortError";
}

export function isExportPermissionError(error: unknown) {
  const name = getErrorName(error);
  return name === "NotAllowedError" || name === "SecurityError";
}

export function isExportWriteBlockedError(error: unknown) {
  const name = getErrorName(error);
  const message = getErrorMessage(error);

  if (name === "NoModificationAllowedError") return true;
  if (name === "InvalidModificationError") return true;
  if (name === "QuotaExceededError") return true;

  return (
    message.includes("failed to create or truncate file") ||
    message.includes("create or truncate") ||
    message.includes("being used by another process") ||
    message.includes("used by another process") ||
    message.includes("the process cannot access the file") ||
    message.includes("because it is being used") ||
    message.includes("file is locked") ||
    message.includes("locked by") ||
    message.includes("access is denied") ||
    message.includes("permission denied") ||
    message.includes("not writable") ||
    message.includes("no modification allowed") ||
    message.includes("disk full") ||
    message.includes("not enough space")
  );
}

export function getExportFileErrorKind(error: unknown): ExportFileErrorKind {
  if (isExportWriteBlockedError(error)) return "write-blocked";
  if (isAbortError(error)) return "cancel";
  if (isExportPermissionError(error)) return "permission";
  return "unknown";
}

export function isExportCancelError(error: unknown) {
  return getExportFileErrorKind(error) === "cancel";
}

export function isFileCreateOrTruncateError(error: unknown) {
  return isExportWriteBlockedError(error);
}

export async function pickSaveFileHandle(
  options: SaveFilePickerOptions
): Promise<FileSystemFileHandle | null> {
  try {
    return await window.showSaveFilePicker(options);
  } catch (error) {
    if (getExportFileErrorKind(error) === "cancel") {
      return null;
    }

    throw error;
  }
}

export async function writeBlobToHandle(
  fileHandle: FileSystemFileHandle,
  blob: Blob
) {
  let writable: FileSystemWritableFileStream | null = null;

  try {
    writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    writable = null;
  } catch (error) {
    if (writable) {
      try {
        await writable.close();
      } catch {
        // 書き込み失敗時の後始末
      }
    }

    throw error;
  }
}
