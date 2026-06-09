export {};

declare global {
  type FileSystemPermissionMode = "read" | "readwrite";

  interface FileSystemHandlePermissionDescriptor {
    mode?: FileSystemPermissionMode;
  }

  interface FileSystemFileHandle {
    readonly kind: "file";
    readonly name: string;
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
    queryPermission?(
      descriptor?: FileSystemHandlePermissionDescriptor
    ): Promise<PermissionState>;
    requestPermission?(
      descriptor?: FileSystemHandlePermissionDescriptor
    ): Promise<PermissionState>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: Blob | BufferSource | string): Promise<void>;
    close(): Promise<void>;
  }

  interface SaveFilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }

  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: SaveFilePickerAcceptType[];
  }

  interface OpenFilePickerOptions {
    multiple?: boolean;
    types?: SaveFilePickerAcceptType[];
  }

  type LocalFontData = {
    family: string;
    fullName: string;
    postscriptName: string;
    style: string;
  };

  interface Window {
    queryLocalFonts?: () => Promise<LocalFontData[]>;

    showSaveFilePicker(
      options?: SaveFilePickerOptions
    ): Promise<FileSystemFileHandle>;

    showOpenFilePicker(
      options?: OpenFilePickerOptions
    ): Promise<FileSystemFileHandle[]>;
  }
}