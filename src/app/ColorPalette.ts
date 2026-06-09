export type ColorPaletteTone = "light" | "normal" | "dark";

export type ColorPaletteRow = {
  key: string;
  colors: Record<ColorPaletteTone, string>;
};

export const COLOR_PALETTE_TONES: ColorPaletteTone[] = [
  "light",
  "normal",
  "dark",
];

export const COLOR_PALETTE: ColorPaletteRow[] = [
  {
    key: "neutral",
    colors: {
      light: "#ffffff",
      normal: "#9ca3af",
      dark: "#111827",
    },
  },
  {
    key: "red",
    colors: {
      light: "#fca5a5",
      normal: "#ef4444",
      dark: "#991b1b",
    },
  },
  {
    key: "yellow",
    colors: {
      light: "#fde68a",
      normal: "#facc15",
      dark: "#a16207",
    },
  },
  {
    key: "green",
    colors: {
      light: "#86efac",
      normal: "#22c55e",
      dark: "#166534",
    },
  },
  {
    key: "cyan",
    colors: {
      light: "#67e8f9",
      normal: "#06b6d4",
      dark: "#155e75",
    },
  },
  {
    key: "blue",
    colors: {
      light: "#93c5fd",
      normal: "#3b82f6",
      dark: "#1e3a8a",
    },
  },
  {
    key: "magenta",
    colors: {
      light: "#f0abfc",
      normal: "#d946ef",
      dark: "#86198f",
    },
  },
];

export const DEFAULT_PALETTE_FILL_COLOR = "#000000";
export const DEFAULT_PALETTE_OUTLINE_COLOR = "#ffffff";

export function normalizePaletteColor(color: string | null | undefined) {
  return (color ?? "").trim().toLowerCase();
}

export function isPaletteColorSelected(value: string | null | undefined, color: string) {
  return normalizePaletteColor(value) === normalizePaletteColor(color);
}
