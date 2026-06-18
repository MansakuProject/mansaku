/// <reference path="./fileSystemAccess.d.ts" />

import { APP_NAME, APP_VERSION } from "../appInfo";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import JSZip from "jszip";
import packageJson from "../../package.json";
import {
  getExportFileErrorKind,
  isAbortError,
  pickSaveFileHandle,
  writeBlobToHandle,
} from "./exportFileUtils";

import type {
  Frame,
  FrameTiltValue,
  SoundTiltValue,
  TailMode,
  BubbleBackgroundColor,
  Bubble,
  SoundText,
  Page,
  ProjectData,
  DragState,
  ClipboardItem,
  ContextMenuTarget,
  ContextMenuState,
  PercentPoint,
} from "./types";

import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  BUBBLE_STROKE_PX,
  ELECTRONIC_OUTER_STROKE_PX,
  ELECTRONIC_CENTER_WHITE_STROKE_PX,
  BOUNDARY_INSET,
  TAIL_OVERLAP_PX,
  OUTSIDE_BUBBLE_COVER_SHIFT_PX,
  OUTSIDE_BUBBLE_COVER_DEPTH_PX,
  OUTSIDE_BUBBLE_COVER_HALF_EXTRA_PX,
  FRAME_MARGIN,
  FRAME_SNAP_THRESHOLD,
  SHIFT_GRID_STEP_PERCENT,
} from "./constants";

import {
  bubbleSvgPath,
  getBubbleBackgroundFillForSvg,
  getBubbleOutlineStrokeColorForSvg,
  getBubbleOutlineStrokeWidthForSvg,
  getBubbleToneBackgroundColor,
  getBubbleToneDotStyle,
  shouldDrawBubbleToneDots,
  getBoundaryPoint,
  getTailGeometry,
  getTailHandlePosition,
  getBubbleMinimumTailLengthPx,
  getOutsideTriangleTailPath,
  getOutsideTriangleTailBackSideMaskPath,
  getInsideTriangleTailPath,
  getInsideThoughtTailPath,
  getInsideThoughtTailPatchPath,
  getThoughtDotPath,
  getThoughtTailDots,
  FlashBubbleSvg,
  ElectronicInnerLayer,
  OutsideTriangleTailSvg,
  OutsideThoughtTailSvg,
  OutsideTailFillSvg,
  BubbleCoverSvg,
  InsideTriangleTailSvg,
  InsideThoughtTailSvg,
  electronicBubbleStrokePath,
} from "./bubble";

import {
  clamp,
  fileToBase64,
  clonePages,
  getNextBubbleLayer,
  normalizeBubble,
  getNextSoundLayer,
  normalizeSound,
  normalizePage,
} from "./pageUtils";

import {
  FRAME_EFFECT_LINE_COLOR_MODES,
  FRAME_EFFECT_LINE_DEFAULTS,
  FRAME_EFFECT_LINE_KINDS,
  FrameEffectLineLayer,
  getFrameEffectLineFields,
  getFrameEffectLineKindLabel,
  type FrameEffectLineColorMode,
  type FrameEffectLineKind,
} from "./frameEffectLine";

import {
  SOUND_STYLE_PRESETS,
  SOUND_STYLE_ORDER,
  DEFAULT_SOUND_STYLE_KEY,
  buildTextStrokeShadow,
  getNextSoundStyleKey,
  getSoundPolygonPoints,
  getSoundPolygonPointString,
  getSoundTextBoxMetrics,
  getSoundGlyphLayouts,
  getSoundSelectionPath,
} from "./sound";

import {
  createNewPage,
  createInnerLockedFrame,
  INNER_LOCKED_FRAME_ID,
} from "./presets";

import {
  bubbleTypes,
  getBubbleTypeLabel,
  applyBubbleTypePreset,
  getNextBubbleType,
} from "./bubbleType";

import {
  getNextAddedBubblePosition,
  getNextAddedSoundPosition,
} from "./positionUtils";

import {
  getBubbleCenterFrame,
  getSoundCenterFrame,
  getBubbleFrameClipPath,
  getFrameClipPath,
  getFrameImageMetrics,
  getFrameInnerClipPath,
  getFrameInnerPolygonPointString,
  getFramePolygonCenterPoint,
  getFramePolygonPointString,
  getFramePolygonPoints,
  getFramePolygonPointsAbsolute,
  isBubbleOverflowingFramePolygon,
  isPointInFramePolygon,
} from "./frameGeometry";

import { TEMPLATE_DEFINITIONS } from "./templates";

import { HelpModal } from "./HelpModal";
import {
  ReviewDialog,
  REVIEW_LOCAL_STORAGE_KEYS,
  getReviewStorageItem,
  setReviewStorageItem,
  submitMansakuReview,
  type ReviewExportType,
  type ReviewSubmitPayload,
} from "./ReviewDialog";
import {
  initializeAnalytics,
  trackAppOpen,
  trackBubbleAdd,
  trackExportPdf,
  trackExportPng,
  trackReviewPromptClose,
  trackReviewPromptDismissForever,
  trackReviewPromptShow,
  trackReviewSubmit,
  trackReviewSubmitSuccess,
  trackFrameAdd,
  trackImageInsert,
  trackPageAdd,
  trackSaveProject,
  trackSoundAdd,
} from "./analytics";

import {
  clearProjectAutoSave,
  readProjectAutoSave,
  writeProjectAutoSave,
} from "./projectAutoSave";

import {
  appLanguageFlagCountries,
  appLanguageLabels,
  createTranslator,
  normalizeAppLanguage,
  supportedAppLanguages,
  type AppLanguage,
  type MessageKey,
} from "./i18n";

import { supportedHelpLanguages } from "./helpI18n";
import { FocusSystem } from "./focusSystem";

import {
  ContextMenuLayer,
  ContextMenuButton,
  ContextSubmenu,
  setContextMenuKeyboardInputMode,
  setContextMenuMouseInputMode,
  setContextMenuMouseInputModeByPointerMove,
  isContextMenuMouseInputMode,
  useContextMenuInputMode,
} from "./ContextMenu";

import {
  FoldChevronSvgIcon,
  SplitIcon,
  ManuscriptSvgIcon,
  LayoutSvgIcon,
  FrameAddSvgIcon,
  BubbleAddSvgIcon,
  DrawnTextAddSvgIcon,
  LayerOrderSvgIcon,
  PageVisibleSvgIcon,
  BubbleTypeIcon,
  MenuSvgIcon,
  SaveSvgIcon,
  UndoSvgIcon,
  RedoSvgIcon,
  PlusSvgIcon,
  MinusSvgIcon,
  CloseSvgIcon,
  ArrowHorizontalSvgIcon,
  ArrowVerticalSvgIcon,
  DiagonalResizeSvgIcon,
  AngleSvgIcon,
  CheckSvgIcon,
  TriangleSvgIcon,
  ArrowSvgIcon,
  HorizontalWritingSvgIcon,
  VerticalWritingSvgIcon,
  MagnifierSvgIcon,
  ResetSvgIcon,
  TrashSvgIcon,
  TextBackgroundSvgIcon,
  TextColorSvgIcon,
  SettingsSvgIcon,
  LanguageSvgIcon,
  HelpSvgIcon,
  FlagSvgIcon,
  FolderSvgIcon,
  ShareSvgIcon,
  PngFileSvgIcon,
  PdfFileSvgIcon,
  DownloadIcon,
  FreeTextColorSvgIcon,
  NoneSvgIcon,
  FocusLineSvgIcon,
  SpeedLineSvgIcon,
  WhiteFillSvgIcon,
  BlackFillSvgIcon,
  RainbowFillSvgIcon,
} from "./svgIcons";

import {
  COLOR_PALETTE,
  COLOR_PALETTE_TONES,
  DEFAULT_PALETTE_FILL_COLOR,
  DEFAULT_PALETTE_OUTLINE_COLOR,
  isPaletteColorSelected,
} from "./ColorPalette";

const STANDARD_EXPORT_PIXEL_RATIO = 2;
const HIGH_RESOLUTION_EXPORT_PIXEL_RATIO = 4;

function PageCardThumbnail({
  page,
  renderPageCanvas,
  PAGE_WIDTH,
  PAGE_HEIGHT,
}: {
  page: Page;
  renderPageCanvas: (
    page: Page,
    exportMode: boolean,
    refCallback?: (el: HTMLDivElement | null) => void
  ) => React.ReactNode;
  PAGE_WIDTH: number;
  PAGE_HEIGHT: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [innerWidth, setInnerWidth] = useState<number>(120);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const updateSize = () => {
      const width = el.clientWidth;

      if (width > 0) {
        setInnerWidth(width);
      }
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateSize);
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const scale = innerWidth / PAGE_WIDTH;
  const thumbHeight = Math.max(1, PAGE_HEIGHT * scale);

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        minHeight: thumbHeight,
        overflow: "hidden",
        background: "#e5e7eb",
        borderRadius: 10,
        position: "relative",
      }}
    >
      <div
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {renderPageCanvas(page, true)}
      </div>
    </div>
  );
}


function PageAddCardThumbnail({
  PAGE_WIDTH,
  PAGE_HEIGHT,
  children,
}: {
  PAGE_WIDTH: number;
  PAGE_HEIGHT: number;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [innerWidth, setInnerWidth] = useState<number>(120);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const updateSize = () => {
      const width = el.clientWidth;

      if (width > 0) {
        setInnerWidth(width);
      }
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateSize);
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const thumbHeight = Math.max(1, PAGE_HEIGHT * (innerWidth / PAGE_WIDTH));

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        minHeight: thumbHeight,
        overflow: "hidden",
        borderRadius: 10,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}


function ToolbarTextButtonContent({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

function MenuItemWithIcon({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
      }}
    >
      <span style={{ display: "inline-flex", width: 18, justifyContent: "center" }}>
        {icon}
      </span>
      <span>{children}</span>
    </span>
  );
}

function ToolbarIconButton({
  title,
  disabled,
  onClick,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  children,
  style,
  dataRubyActiveControl,
  dataFocusSkip,
  dataFocusRole,
  buttonRef,
  keepFocusAfterClick,
}: {
  title: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  style?: React.CSSProperties;
  dataRubyActiveControl?: boolean;
  dataFocusSkip?: boolean;
  dataFocusRole?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
  keepFocusAfterClick?: boolean;
}) {
  const inputMode = useContextMenuInputMode();
  const buttonElementRef = useRef<HTMLButtonElement | null>(null);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  const { background, transition, transform, outline, ...restStyle } = style ?? {};

  const hasCustomBackground = background != null;
  const baseBackground = hasCustomBackground ? background : "transparent";
  const baseTransform = transform ? `${transform} ` : "";
  const isActuallyFocused =
    typeof document !== "undefined" &&
    buttonElementRef.current === document.activeElement;
  const showKeyboardFocus =
    inputMode === "keyboard" && focused && isActuallyFocused && !disabled;

  useEffect(() => {
    if (!disabled) return;

    const button = buttonElementRef.current;
    if (button && document.activeElement === button) {
      button.blur();
    }

    setFocused(false);
    setPressed(false);
  }, [disabled]);

  const setButtonRef = (element: HTMLButtonElement | null) => {
    buttonElementRef.current = element;

    if (typeof buttonRef === "function") {
      buttonRef(element);
      return;
    }

    if (buttonRef) {
      (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = element;
    }
  };

  return (
    <button
      ref={setButtonRef}
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      tabIndex={-1}
      data-ruby-active-control={dataRubyActiveControl ? "true" : undefined}
      data-focus-skip={dataFocusSkip ? "true" : undefined}
      data-focus-role={dataFocusRole}
      onClick={(e) => {
        const isEditorSectionControl = !!e.currentTarget.closest(
          "[data-editor-section-content]"
        );
        const isEditorToolbarControl = dataFocusRole?.startsWith("editor-") ?? false;

        if (keepFocusAfterClick || isEditorSectionControl || isEditorToolbarControl) {
          e.currentTarget.focus({ preventScroll: true });
        } else {
          (document.activeElement as HTMLElement | null)?.blur();
        }

        onClick?.(e);
      }}
      onMouseDown={(e) => {
        setContextMenuMouseInputMode();
        e.preventDefault();
        if (!disabled) setPressed(true);
        onMouseDown?.(e);
      }}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={(e) => {
        setHover(false);
        setPressed(false);
        onMouseLeave?.(e);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        setPressed(false);
      }}
      onMouseEnter={(e) => {
        setHover(true);
        onMouseEnter?.(e);
      }}
      onPointerMove={(e) => {
        if (!setContextMenuMouseInputModeByPointerMove(e.nativeEvent)) return;
        setHover(true);
      }}
      style={{
        width: 34,
        height: 34,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border: "none",
        borderRadius: 8,
        color: disabled ? "#9ca3af" : "#111827",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        flexShrink: 0,

        ...restStyle,

        background: disabled ? "transparent" : hover ? "#e5e7eb" : baseBackground,
        outline: showKeyboardFocus ? "2px solid #000000" : outline ?? "none",
        outlineOffset: -2,
        transform:
          pressed && !disabled
            ? `${baseTransform}translateY(1px)`
            : transform,
        filter: pressed && !disabled ? "brightness(0.97)" : undefined,
        transition:
          transition ??
          "background 0.12s ease, transform 60ms ease, filter 60ms ease",
      }}
    >
      {children}
    </button>
  );
}

type FontFamilyPreviewSelectOption = {
  value: string;
  label: string;
};

type BubbleTypeSelectValue = (typeof bubbleTypes)[number];

function FontFamilyPreviewSelect({
  value,
  defaultLabel,
  families,
  inputStyle,
  onPreview,
  onCommit,
}: {
  value: string;
  defaultLabel: string;
  families: string[];
  inputStyle: React.CSSProperties;
  onPreview: (fontFamily: string | null) => void;
  onCommit: (fontFamily: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const suppressMouseHighlightRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [highlightedValue, setHighlightedValue] = useState(value);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 220, maxHeight: 260 });

  const uniqueFamilies = Array.from(
    new Map(
      families
        .map((family) => family.trim())
        .filter((family) => family.length > 0)
        .map((family) => [family.toLowerCase(), family])
    ).values()
  );

  const allOptions: FontFamilyPreviewSelectOption[] = [
    { value: "", label: defaultLabel },
    ...uniqueFamilies.map((family) => ({ value: family, label: family })),
  ];

  const normalizedSearchText = searchText.trim().toLowerCase();

  const options =
    normalizedSearchText.length === 0
      ? allOptions
      : allOptions.filter((option) => {
          if (option.value === "") return true;
          return option.label.toLowerCase().includes(normalizedSearchText);
        });

  const foundHighlightedIndex = options.findIndex(
    (option) => option.value === highlightedValue
  );

  const highlightedIndex = foundHighlightedIndex >= 0 ? foundHighlightedIndex : 0;

  const currentLabel =
    allOptions.find((option) => option.value === value)?.label ?? defaultLabel;

  const updateMenuPosition = () => {
    const input = inputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 4;
    const preferredMaxHeight = 260;
    const minHeight = 80;
    const width = rect.width;

    const maxLeft = Math.max(
      viewportPadding,
      window.innerWidth - width - viewportPadding
    );

    const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
    const spaceAbove = rect.top - viewportPadding - gap;
    const openUp =
      spaceBelow < Math.min(preferredMaxHeight, spaceAbove) &&
      spaceAbove > spaceBelow;
    const availableHeight = Math.max(
      minHeight,
      Math.min(preferredMaxHeight, openUp ? spaceAbove : spaceBelow)
    );
    const top = openUp
      ? Math.max(viewportPadding, rect.top - gap - availableHeight)
      : rect.bottom + gap;

    setMenuPosition({ left, top, width, maxHeight: availableHeight });
  };

  const openMenu = () => {
    suppressMouseHighlightRef.current = false;
    setSearchText("");
    setHighlightedValue(value);
    setOpen(true);
    onPreview(value);
    window.requestAnimationFrame(updateMenuPosition);
  };

  const closeMenu = () => {
    suppressMouseHighlightRef.current = false;
    setOpen(false);
    setSearchText("");
    setHighlightedValue(value);
    onPreview(null);
  };

  const highlightOption = (nextValue: string) => {
    setHighlightedValue(nextValue);
    onPreview(nextValue);
  };

  const commitOption = (nextValue: string) => {
    onCommit(nextValue);
    onPreview(null);
    setOpen(false);
    setSearchText("");
    setHighlightedValue(nextValue);
  };

  const moveHighlight = (delta: number) => {
    if (options.length === 0) return;

    const nextIndex = Math.min(
      Math.max(highlightedIndex + delta, 0),
      options.length - 1
    );

    suppressMouseHighlightRef.current = true;
    highlightOption(options[nextIndex].value);
  };

  useLayoutEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const handleResize = () => updateMenuPosition();
    const handleScroll = () => updateMenuPosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (options.length === 0) return;

    if (!options.some((option) => option.value === highlightedValue)) {
      highlightOption(options[0].value);
    }
  }, [searchText, open]);

  useEffect(() => {
    if (!open) return;

    const key = highlightedValue || "__default_font__";
    optionRefs.current[key]?.scrollIntoView({ block: "nearest" });
  }, [highlightedValue, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;

      if (target && rootRef.current?.contains(target)) return;
      if (target && listRef.current?.contains(target)) return;

      closeMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open, value]);

  const menu = open
    ? createPortal(
        <div
          ref={listRef}
          data-font-family-preview-menu="true"
          onMouseMove={() => {
            suppressMouseHighlightRef.current = false;
          }}
          style={{
            position: "fixed",
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
            overflowY: "auto",
            padding: 4,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#ffffff",
            boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
            zIndex: 100000,
          }}
        >
          {options.map((option) => {
            const isHighlighted = highlightedValue === option.value;
            const key = option.value || "__default_font__";

            return (
              <button
                key={key}
                ref={(el) => {
                  optionRefs.current[key] = el;
                }}
                type="button"
                title={option.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
                }}
                onMouseEnter={() => {
                  if (suppressMouseHighlightRef.current) return;
                  highlightOption(option.value);
                }}
                onMouseMove={() => {
                  suppressMouseHighlightRef.current = false;
                  highlightOption(option.value);
                }}
                onClick={() => commitOption(option.value)}
                style={{
                  all: "unset",
                  display: "block",
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "7px 9px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  lineHeight: 1.25,
                  color: isHighlighted ? "#ffffff" : "#111827",
                  background: isHighlighted ? "#2563eb" : "transparent",
                  fontFamily: option.value.trim() || "inherit",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={rootRef}
      data-font-family-preview-root="true"
      style={{ position: "relative", width: 112, minWidth: 0 }}
    >
      <input
        ref={inputRef}
        type="text"
        value={open ? searchText : currentLabel}
        title={value.trim() || defaultLabel}
        placeholder={currentLabel}
        onMouseDown={(e) => {
          if (!open) {
            e.preventDefault();
            openMenu();
          }
        }}
        onFocus={() => {
          if (!open) openMenu();
        }}
        onChange={(e) => {
          if (!open) {
            openMenu();
          }

          setSearchText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (
            e.key === "ArrowDown" ||
            e.key === "ArrowRight" ||
            e.key === "ArrowUp" ||
            e.key === "ArrowLeft" ||
            e.key === "Enter" ||
            e.key === "Escape"
          ) {
            e.preventDefault();
            e.stopPropagation();
          }

          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            if (!open) {
              openMenu();
              return;
            }
            moveHighlight(1);
            return;
          }

          if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            if (!open) {
              openMenu();
              return;
            }
            moveHighlight(-1);
            return;
          }

          if (e.key === "Enter") {
            if (!open) {
              openMenu();
              return;
            }
            commitOption(highlightedValue);
            return;
          }

          if (e.key === "Escape") {
            closeMenu();
          }
        }}
        onBlur={(e) => {
          const nextTarget = e.relatedTarget as Node | null;
          if (nextTarget && rootRef.current?.contains(nextTarget)) return;
          if (nextTarget && listRef.current?.contains(nextTarget)) return;
          closeMenu();
        }}
        style={{
          ...inputStyle,
          width: 112,
          minWidth: 0,
          maxWidth: 112,
          cursor: "text",
          fontFamily: "inherit",
          textAlign: "left",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      />

      {menu}
    </div>
  );
}


type BubbleTypePreviewSelectOption = {
  value: BubbleTypeSelectValue;
  label: string;
};

function BubbleTypePreviewSelect({
  value,
  inputStyle,
  t,
  onPreview,
  onCommit,
  onCancel,
}: {
  value: BubbleTypeSelectValue;
  inputStyle: React.CSSProperties;
  t: (key: MessageKey) => string;
  onPreview: (type: BubbleTypeSelectValue) => void;
  onCommit: (type: BubbleTypeSelectValue) => void;
  onCancel: (type: BubbleTypeSelectValue) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const suppressMouseHighlightRef = useRef(false);
  const committedRef = useRef(false);
  const startValueRef = useRef<BubbleTypeSelectValue>(value);

  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [highlightedValue, setHighlightedValue] = useState<BubbleTypeSelectValue>(value);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 260, maxHeight: 300 });

  const allOptions: BubbleTypePreviewSelectOption[] = bubbleTypes.map((type) => ({
    value: type,
    label: getBubbleTypeLabel(type, t),
  }));

  const normalizedSearchText = searchText.trim().toLowerCase();

  const options =
    normalizedSearchText.length === 0
      ? allOptions
      : allOptions.filter((option) =>
          option.label.toLowerCase().includes(normalizedSearchText)
        );

  const foundHighlightedIndex = options.findIndex(
    (option) => option.value === highlightedValue
  );

  const highlightedIndex = foundHighlightedIndex >= 0 ? foundHighlightedIndex : 0;

  const currentLabel =
    allOptions.find((option) => option.value === value)?.label ??
    getBubbleTypeLabel("ellipse", t);

  useEffect(() => {
    if (open) return;
    setHighlightedValue(value);
  }, [value, open]);

  const updateMenuPosition = () => {
    const input = inputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 4;
    const preferredMaxHeight = 300;
    const minHeight = 80;
    const width = rect.width;

    const maxLeft = Math.max(
      viewportPadding,
      window.innerWidth - width - viewportPadding
    );

    const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
    const spaceAbove = rect.top - viewportPadding - gap;
    const openUp =
      spaceBelow < Math.min(preferredMaxHeight, spaceAbove) &&
      spaceAbove > spaceBelow;
    const availableHeight = Math.max(
      minHeight,
      Math.min(preferredMaxHeight, openUp ? spaceAbove : spaceBelow)
    );
    const top = openUp
      ? Math.max(viewportPadding, rect.top - gap - availableHeight)
      : rect.bottom + gap;

    setMenuPosition({ left, top, width, maxHeight: availableHeight });
  };

  const previewOption = (nextValue: BubbleTypeSelectValue) => {
    setHighlightedValue(nextValue);
    onPreview(nextValue);
  };

  const openMenu = () => {
    committedRef.current = false;
    startValueRef.current = value;
    suppressMouseHighlightRef.current = false;
    setSearchText("");
    setHighlightedValue(value);
    setOpen(true);
    window.requestAnimationFrame(updateMenuPosition);
  };

  const closeMenu = (commit = false) => {
    suppressMouseHighlightRef.current = false;
    setOpen(false);
    setSearchText("");
    setHighlightedValue(value);

    if (!commit && !committedRef.current) {
      onCancel(startValueRef.current);
    }
  };

  const commitOption = (nextValue: BubbleTypeSelectValue) => {
    committedRef.current = true;
    onCommit(nextValue);
    setOpen(false);
    setSearchText("");
    setHighlightedValue(nextValue);
  };

  const moveHighlight = (delta: number) => {
    if (options.length === 0) return;

    const nextIndex = Math.min(
      Math.max(highlightedIndex + delta, 0),
      options.length - 1
    );

    suppressMouseHighlightRef.current = true;
    previewOption(options[nextIndex].value);
  };

  useLayoutEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const handleResize = () => updateMenuPosition();
    const handleScroll = () => updateMenuPosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (options.length === 0) return;

    if (!options.some((option) => option.value === highlightedValue)) {
      previewOption(options[0].value);
    }
  }, [searchText, open]);

  useEffect(() => {
    if (!open) return;

    optionRefs.current[highlightedValue]?.scrollIntoView({ block: "nearest" });
  }, [highlightedValue, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;

      if (target && rootRef.current?.contains(target)) return;
      if (target && listRef.current?.contains(target)) return;

      closeMenu(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open, value]);

  const menu = open
    ? createPortal(
        <div
          ref={listRef}
          data-bubble-type-preview-menu="true"
          onMouseMove={() => {
            suppressMouseHighlightRef.current = false;
          }}
          style={{
            position: "fixed",
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
            overflowY: "auto",
            padding: 4,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#ffffff",
            boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
            zIndex: 100000,
          }}
        >
          {options.map((option) => {
            const isHighlighted = highlightedValue === option.value;

            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[option.value] = el;
                }}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
                }}
                onMouseEnter={() => {
                  if (suppressMouseHighlightRef.current) return;
                  previewOption(option.value);
                }}
                onMouseMove={() => {
                  suppressMouseHighlightRef.current = false;
                  previewOption(option.value);
                }}
                onClick={() => commitOption(option.value)}
                style={{
                  all: "unset",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 8,
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "7px 9px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  lineHeight: 1.25,
                  color: isHighlighted ? "#ffffff" : "#111827",
                  background: isHighlighted ? "#2563eb" : "transparent",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      flexShrink: 0,
                      color: isHighlighted ? "#ffffff" : "#111827",
                    }}
                  >
                    <BubbleTypeIcon type={option.value} />
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {option.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={rootRef}
      data-bubble-type-preview-root="true"
      style={{ position: "relative", width: "100%", minWidth: 0 }}
    >
      <div style={{ position: "relative", width: "100%", minWidth: 0 }}>
        <span
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <BubbleTypeIcon type={highlightedValue} />
        </span>

        <input
          ref={inputRef}
          type="text"
          value={open ? searchText : currentLabel}
          title={currentLabel}
          placeholder={currentLabel}
          onMouseDown={(e) => {
            if (!open) {
              e.preventDefault();
              openMenu();
            }
          }}
          onFocus={() => {
            if (!open) openMenu();
          }}
          onChange={(e) => {
            if (!open) {
              openMenu();
            }

            setSearchText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (
              e.key === "ArrowDown" ||
              e.key === "ArrowRight" ||
              e.key === "ArrowUp" ||
              e.key === "ArrowLeft" ||
              e.key === "Enter" ||
              e.key === "Escape"
            ) {
              e.preventDefault();
              e.stopPropagation();
            }

            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
              if (!open) {
                openMenu();
                return;
              }
              moveHighlight(1);
              return;
            }

            if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
              if (!open) {
                openMenu();
                return;
              }
              moveHighlight(-1);
              return;
            }

            if (e.key === "Enter") {
              if (!open) {
                openMenu();
                return;
              }
              commitOption(highlightedValue);
              return;
            }

            if (e.key === "Escape") {
              closeMenu(false);
            }
          }}
          onBlur={(e) => {
            const nextTarget = e.relatedTarget as Node | null;
            if (nextTarget && rootRef.current?.contains(nextTarget)) return;
            if (nextTarget && listRef.current?.contains(nextTarget)) return;
            closeMenu(false);
          }}
          style={{
            ...inputStyle,
            width: "100%",
            minWidth: 0,
            paddingLeft: 34,
            paddingRight: 28,
            cursor: "text",
            fontFamily: "inherit",
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        />

        <span
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            color: "#6b7280",
            pointerEvents: "none",
          }}
        >
          <FoldChevronSvgIcon open={open} />
        </span>
      </div>

      {menu}
    </div>
  );
}

function EditorSwitchButton({
  checked,
  label,
  disabled,
  onToggle,
  onFocus,
  onBlur,
}: {
  checked: boolean;
  label?: string;
  disabled?: boolean;
  onToggle: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onToggle();
      }}
      onFocus={() => {
        onFocus?.();
      }}
      onBlur={() => {
        onBlur?.();
      }}
      style={{
        all: "unset",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 8,
        width: "fit-content",
        boxSizing: "border-box",
        minHeight: 34,
        padding: "6px 8px",
        borderRadius: 8,
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "#9ca3af" : "#111827",
        opacity: disabled ? 0.62 : 1,
        fontSize: 13,
        fontFamily: "inherit",
        outline: "none",
      }}
    >
      {label && (
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      )}

      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: 38,
          height: 20,
          borderRadius: 999,
          background: disabled ? "#e5e7eb" : checked ? "#2563eb" : "#d1d5db",
          boxShadow: disabled
            ? "inset 0 0 0 1px rgba(156,163,175,0.35)"
            : checked
            ? "inset 0 0 0 1px rgba(37,99,235,0.25)"
            : "inset 0 0 0 1px rgba(107,114,128,0.18)",
          transition: "background 120ms ease, box-shadow 120ms ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: disabled ? "#f9fafb" : "#ffffff",
            boxShadow: disabled ? "none" : "0 1px 3px rgba(0,0,0,0.25)",
            transition: "left 120ms ease",
          }}
        />
      </span>
    </button>
  );
}


type MainMode = "manga" | "template";

type SelectedItem =
  | { kind: "frame"; id: number }
  | { kind: "bubble"; id: number }
  | { kind: "sound"; id: number };

type SelectionBox = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
};

type PageSelectionBox = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
  baseSelectedIds: number[];
};

type TemplateDefinition = {
  id: string;
  name: string;
  frameCount: number;
  page: Page;
};

function createTemplateFrame(
  id: number,
  x: number,
  y: number,
  w: number,
  h: number
): Frame {
  return {
    id,
    x,
    y,
    w,
    h,
    borderEnabled: true,
    image: null,
    imageId: undefined,
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    topTilt: 0,
    rightTilt: 0,
    bottomTilt: 0,
    leftTilt: 0,
  };
}

function createTemplatePage(
  id: number,
  frames: Frame[]
): Page {
  return {
    id,
    visible: true,
    frames: [createInnerLockedFrame(), ...frames],
    bubbles: [],
    sounds: [],
  };
}

function countTextCharacters(text: string) {
  return Array.from(text).length;
}

const BUBBLE_AUTO_MIN_SIZE_PX = 40;

function getBubbleAutoSizePercent({
  text,
  writingMode,
  fontSize,
}: {
  text: string;
  writingMode: Bubble["writingMode"];
  fontSize: number;
}) {
  const safeFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 22;
  const bubblePaddingPx = clamp(safeFontSize * 1.5, 16, 64);

  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const textLines = lines.length > 0 ? lines : [""];
  const lineCount = Math.max(1, textLines.length);
  const maxChars = Math.max(
    1,
    ...textLines.map((line) => countTextCharacters(line.trimEnd()))
  );

  const charAdvancePx = safeFontSize;
  const lineAdvancePx = safeFontSize * 1.25;

  let textWidth: number;
  let textHeight: number;

  if ((writingMode ?? "vertical") === "horizontal") {
    textWidth = maxChars * charAdvancePx;
    textHeight = lineCount * lineAdvancePx;
  } else {
    textWidth = lineCount * lineAdvancePx;
    textHeight = maxChars * charAdvancePx;
  }

  const pixelWidth = Math.max(
    BUBBLE_AUTO_MIN_SIZE_PX,
    textWidth + bubblePaddingPx * 2
  );

  const pixelHeight = Math.max(
    BUBBLE_AUTO_MIN_SIZE_PX,
    textHeight + bubblePaddingPx * 2
  );

  return {
    w: (pixelWidth / PAGE_WIDTH) * 100,
    h: (pixelHeight / PAGE_HEIGHT) * 100,
  };
}

function getDefaultBubbleTailLengthPx(
  bubble: Pick<Bubble, "w" | "h"> & Partial<Pick<Bubble, "shape">>
) {
  return getBubbleMinimumTailLengthPx(bubble);
}

function TemplateListView({
  renderPageCanvas,
  handleTemplateDragStart,
  handleTemplateDragEnd,
  handleTemplateAddClick,
  setTemplateContextMenu,
  selectedTemplateId,
  setSelectedTemplateId,
  closeAllFloatingMenus,
  draggingTemplateId,
  templateCardWidth,
  t,
}: {
  renderPageCanvas: (
    page: Page,
    exportMode: boolean,
    refCallback?: (el: HTMLDivElement | null) => void
  ) => React.ReactNode;
  handleTemplateDragStart: (templateId: string) => void;
  handleTemplateDragEnd: () => void;
  handleTemplateAddClick: (templateId: string) => void;
  setTemplateContextMenu: React.Dispatch<
    React.SetStateAction<{
      visible: boolean;
      x: number;
      y: number;
      templateId: string | null;
      key: number;
    }>
  >;
  selectedTemplateId: string | null;
  setSelectedTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
  closeAllFloatingMenus: () => void;
  draggingTemplateId: string | null;
  templateCardWidth: number;
  t: (key: MessageKey) => string;
}) {
  const [pressedTemplateId, setPressedTemplateId] = useState<string | null>(null);

  const frameCounts = Array.from(
    new Set(TEMPLATE_DEFINITIONS.map((template) => template.frameCount))
  ).sort((a, b) => a - b);

  return (
    <div
      data-focus-area="template"
      data-focus-layer="template"
      tabIndex={-1}
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        e.currentTarget.focus({ preventScroll: true });
      }}
      onClick={() => {
        setSelectedTemplateId(null);

        setTemplateContextMenu((prev) => ({
          ...prev,
          visible: false,
          templateId: null,
        }));
      }}
      style={{
        flex: 1,
        overflow: "auto",
        padding: 20,
        boxSizing: "border-box",
        background: "#e5e7eb",
      }}
    >
      {frameCounts.map((frameCount) => {
        const templates = TEMPLATE_DEFINITIONS.filter(
          (template) => template.frameCount === frameCount
        );

        return (
          <section key={frameCount} style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#374151",
                  whiteSpace: "nowrap",
                }}
              >
                {frameCount === 1
                  ? `${frameCount}${t("panelCountSingularSuffix")}`
                  : `${frameCount}${t("panelCountPluralSuffix")}`}
              </div>

              <div
                style={{
                  height: 1,
                  flex: 1,
                  background: "#d1d5db",
                }}
              />
            </div>

            {templates.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                {templates.map((template) => {
                  const isSelected = selectedTemplateId === template.id;

                  return (
                    <div
                      key={template.id}
                      draggable
                      tabIndex={-1}
                      data-focus-role="template-item"
                      data-template-id={template.id}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;

                        e.currentTarget.focus({ preventScroll: true });
                        setPressedTemplateId(template.id);

                        e.stopPropagation();

                        closeAllFloatingMenus();

                        setSelectedTemplateId(template.id);
                      }}
                      onFocus={(e) => {
                        e.stopPropagation();
                        closeAllFloatingMenus();
                        setSelectedTemplateId(template.id);
                      }}
                      onMouseUp={() => {
                        setPressedTemplateId(null);
                      }}
                      onMouseLeave={() => {
                        if (draggingTemplateId === template.id) return;
                        setPressedTemplateId(null);
                      }}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setPressedTemplateId(template.id);
                        setSelectedTemplateId(template.id);
                        e.dataTransfer.effectAllowed = "copy";
                        e.dataTransfer.setData(
                          "application/x-manga-template",
                          template.id
                        );
                        handleTemplateDragStart(template.id);
                      }}
                      onDragEnd={() => {
                        setPressedTemplateId(null);
                        handleTemplateDragEnd();
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        setSelectedTemplateId(template.id);
                        setTemplateContextMenu({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          templateId: template.id,
                          key: Date.now(),
                        });
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        setSelectedTemplateId(template.id);
                        handleTemplateAddClick(template.id);
                      }}
                      title={t("dragToAddPage")}
                      style={{
                        width: templateCardWidth,
                        position: "relative",
                        background: isSelected ? "#eff6ff" : "#ffffff",
                        border: isSelected
                          ? "2px solid #2563eb"
                          : "1px solid #d1d5db",
                        outline: "none",
                        borderRadius: 10,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
                        cursor:
                          draggingTemplateId === template.id ||
                          pressedTemplateId === template.id
                            ? "grabbing"
                            : "grab",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                        }}
                      >
                        <PageCardThumbnail
                          page={template.page}
                          renderPageCanvas={renderPageCanvas}
                          PAGE_WIDTH={PAGE_WIDTH}
                          PAGE_HEIGHT={PAGE_HEIGHT}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

const isInnerLockedFrame = (frame: Frame) => {
  return frame.id === INNER_LOCKED_FRAME_ID;
};

const isInnerLockedFrameId = (frameId: number) => {
  return frameId === INNER_LOCKED_FRAME_ID;
};

type FrameImageFlipFields = {
  imageFlipX?: boolean;
  imageFlipY?: boolean;
};

type FrameImageTransparencyFields = {
  imageHasTransparency?: boolean;
};

const hasFrameImageTransparency = (
  frame: Frame | null | undefined
) => {
  return !!(frame as (Frame & FrameImageTransparencyFields) | null | undefined)
    ?.imageHasTransparency;
};

function detectImageTransparency(image: HTMLImageElement): boolean {
  const size = 128;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) return false;

  canvas.width = size;
  canvas.height = size;

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(image, 0, 0, size, size);

  const data = ctx.getImageData(0, 0, size, size).data;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }

  return false;
}

const hasFrameImageFlipX = (frame: Frame) => {
  return !!(frame as Frame & FrameImageFlipFields).imageFlipX;
};

const hasFrameImageFlipY = (frame: Frame) => {
  return !!(frame as Frame & FrameImageFlipFields).imageFlipY;
};

const hasFrameImageSourceForFlip = (frame: Frame) => {
  return !!frame.imageId || !!frame.image;
};

const withFrameImageFlip = (
  frame: Frame,
  flip: { x?: boolean; y?: boolean }
): Frame => {
  if (!flip.x && !flip.y) return frame;
  if (!hasFrameImageSourceForFlip(frame)) return frame;

  const frameWithFlip = frame as Frame & FrameImageFlipFields;

  return {
    ...frame,
    imageFlipX: flip.x ? !frameWithFlip.imageFlipX : frameWithFlip.imageFlipX,
    imageFlipY: flip.y ? !frameWithFlip.imageFlipY : frameWithFlip.imageFlipY,
  } as Frame;
};

const resetFrameImageFlip = (frame: Frame): Frame => {
  return {
    ...frame,
    imageFlipX: false,
    imageFlipY: false,
  } as Frame;
};

const preserveFrameImageFlipFields = (normalizedPage: Page, sourcePage: Page) => {
  const sourceFlipByFrameId = new Map(
    (sourcePage.frames ?? []).map((frame) => [
      frame.id,
      {
        imageFlipX: hasFrameImageFlipX(frame),
        imageFlipY: hasFrameImageFlipY(frame),
      },
    ])
  );

  return {
    ...normalizedPage,
    frames: normalizedPage.frames.map((frame) => {
      const sourceFlip = sourceFlipByFrameId.get(frame.id);
      if (!sourceFlip) return frame;

      return {
        ...frame,
        imageFlipX: sourceFlip.imageFlipX,
        imageFlipY: sourceFlip.imageFlipY,
      } as Frame;
    }),
  };
};

const getEditableFrames = (frames: Frame[]) => {
  return frames.filter((frame) => !isInnerLockedFrame(frame));
};

const sanitizeSelectedItems = (items: SelectedItem[]) => {
  return items.filter(
    (item) => !(item.kind === "frame" && isInnerLockedFrameId(item.id))
  );
};

const DRAG_COPY_GHOST_ID_BASE = -900000000000;
const SOUND_LAYER_Z_BASE = 20000;

const isDragCopyGhostId = (id: number) => {
  return id <= DRAG_COPY_GHOST_ID_BASE;
};

const COVER_PAGE_ID = 1;
const FIRST_CONTENT_PAGE_ID = 2;
const BACK_COVER_PAGE_ID = 3;
const COVER_BASE_FRAME_ID = -1000001;
const BACK_COVER_BASE_FRAME_ID = -1000002;

function createCoverBaseFrame(
  id: number,
  source?: Partial<Frame> | null
): Frame {
  return {
    id,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    borderEnabled: false,
    image: source?.image ?? null,
    imageId: source?.imageId,
    imageOffsetX: source?.imageOffsetX ?? 0,
    imageOffsetY: source?.imageOffsetY ?? 0,
    imageScale: source?.imageScale ?? 1,
    imageNaturalWidth: source?.imageNaturalWidth ?? 0,
    imageNaturalHeight: source?.imageNaturalHeight ?? 0,
    imageHasTransparency: hasFrameImageTransparency(source as Frame | null | undefined),
    frameBorderVisible: false,
    imageFlipX: (source as (Partial<Frame> & FrameImageFlipFields) | null | undefined)?.imageFlipX ?? false,
    imageFlipY: (source as (Partial<Frame> & FrameImageFlipFields) | null | undefined)?.imageFlipY ?? false,
    topTilt: 0,
    rightTilt: 0,
    bottomTilt: 0,
    leftTilt: 0,
  } as Frame;
}

function createCoverSlotPage(
  pageId: number,
  frameId: number,
  source?: Page | null
): Page {
  const sourceFrames = source?.frames ?? [];
  const explicitBaseFrame =
    sourceFrames.find((frame) => isCoverBaseFrameId(frame.id)) ?? null;

  const fallbackBaseFrame =
    sourceFrames.find(
      (frame) => !isInnerLockedFrame(frame) && (frame.imageId || frame.image)
    ) ??
    sourceFrames.find((frame) => !isInnerLockedFrame(frame)) ??
    sourceFrames[0] ??
    null;

  const sourceBaseFrame = explicitBaseFrame ?? fallbackBaseFrame;
  const sourceBaseFrameId = sourceBaseFrame?.id ?? null;

  const extraFrames = sourceFrames
    .filter((frame) => {
      if (isInnerLockedFrame(frame)) return false;
      if (isCoverBaseFrameId(frame.id)) return false;
      if (!explicitBaseFrame && sourceBaseFrameId != null && frame.id === sourceBaseFrameId) {
        return false;
      }
      return true;
    })
    .map((frame) => ({
      ...structuredClone(frame),
      borderEnabled: frame.borderEnabled ?? true,
    }));

  return {
    id: pageId,
    visible: source?.visible ?? true,
    frames: [createCoverBaseFrame(frameId, sourceBaseFrame), ...extraFrames],
    bubbles: source?.bubbles ? structuredClone(source.bubbles) : [],
    sounds: source?.sounds ? structuredClone(source.sounds) : [],
  };
}

function isCoverPageIdValue(pageId: number | null | undefined) {
  return pageId === COVER_PAGE_ID;
}

function isBackCoverPageIdValue(pageId: number | null | undefined) {
  return pageId === BACK_COVER_PAGE_ID;
}

function isSpecialCoverPageIdValue(pageId: number | null | undefined) {
  return isCoverPageIdValue(pageId) || isBackCoverPageIdValue(pageId);
}

function isCoverBaseFrameId(frameId: number) {
  return frameId === COVER_BASE_FRAME_ID || frameId === BACK_COVER_BASE_FRAME_ID;
}

function getContentInsertBounds(length: number) {
  return {
    min: 1,
    max: Math.max(1, length - 1),
  };
}

function clampContentInsertIndex(insertIndex: number, length: number) {
  const bounds = getContentInsertBounds(length);
  return Math.max(bounds.min, Math.min(insertIndex, bounds.max));
}

const ensureInnerLockedFrame = (frames: Frame[]) => {
  return [
    createInnerLockedFrame(),
    ...frames.filter((frame) => !isInnerLockedFrame(frame)),
  ];
};

function createInitialPages(): Page[] {
  return [
    createCoverSlotPage(COVER_PAGE_ID, COVER_BASE_FRAME_ID),
    createCoverSlotPage(BACK_COVER_PAGE_ID, BACK_COVER_BASE_FRAME_ID),
  ];
}

function normalizeProjectCoverStructure(sourcePages: Page[]): Page[] {
  if (sourcePages.length === 0) {
    return createInitialPages();
  }

  const explicitCover = sourcePages.find((page) => isCoverPageIdValue(page.id)) ?? null;
  const explicitBackCover = sourcePages.find((page) => isBackCoverPageIdValue(page.id)) ?? null;

  const hasExplicitSpecialPages = !!explicitCover || !!explicitBackCover;

  if (hasExplicitSpecialPages) {
    const contentPages = sourcePages.filter((page) => !isSpecialCoverPageIdValue(page.id));
    const normalizedContentPages = contentPages.map((page, index) => ({
      ...structuredClone(page),
      id: page.id === COVER_PAGE_ID || page.id === BACK_COVER_PAGE_ID
        ? FIRST_CONTENT_PAGE_ID + index
        : page.id,
      visible: page.visible ?? true,
      frames: ensureInnerLockedFrame(page.frames),
    }));

    return [
      createCoverSlotPage(COVER_PAGE_ID, COVER_BASE_FRAME_ID, explicitCover),
      ...normalizedContentPages,
      createCoverSlotPage(BACK_COVER_PAGE_ID, BACK_COVER_BASE_FRAME_ID, explicitBackCover),
    ];
  }

  if (sourcePages.length === 1) {
    return [
      createCoverSlotPage(COVER_PAGE_ID, COVER_BASE_FRAME_ID),
      {
        ...structuredClone(sourcePages[0]),
        id: FIRST_CONTENT_PAGE_ID,
        visible: sourcePages[0].visible ?? true,
        frames: ensureInnerLockedFrame(sourcePages[0].frames),
      },
      createCoverSlotPage(BACK_COVER_PAGE_ID, BACK_COVER_BASE_FRAME_ID),
    ];
  }

  const first = sourcePages[0];
  const last = sourcePages[sourcePages.length - 1];
  const middle = sourcePages.slice(1, -1);

  return [
    createCoverSlotPage(COVER_PAGE_ID, COVER_BASE_FRAME_ID, first),
    ...middle.map((page) => ({
      ...structuredClone(page),
      visible: page.visible ?? true,
      frames: ensureInnerLockedFrame(page.frames),
    })),
    createCoverSlotPage(BACK_COVER_PAGE_ID, BACK_COVER_BASE_FRAME_ID, last),
  ];
}

function sanitizeProjectPagesForState(sourcePages: Page[]): Page[] {
  if (sourcePages.length < 3) {
    return normalizeProjectCoverStructure(sourcePages);
  }

  const explicitCover = sourcePages.find((page) => isCoverPageIdValue(page.id)) ?? null;
  const explicitBackCover = sourcePages.find((page) => isBackCoverPageIdValue(page.id)) ?? null;

  const contentPages = sourcePages.filter((page) => !isSpecialCoverPageIdValue(page.id));
  const normalizedContentPages = contentPages.map((page, index) => ({
    ...structuredClone(page),
    id: page.id === COVER_PAGE_ID || page.id === BACK_COVER_PAGE_ID
      ? FIRST_CONTENT_PAGE_ID + index
      : page.id,
    visible: page.visible ?? true,
    frames: ensureInnerLockedFrame(page.frames),
  }));

  return [
    createCoverSlotPage(COVER_PAGE_ID, COVER_BASE_FRAME_ID, explicitCover ?? sourcePages[0]),
    ...normalizedContentPages,
    createCoverSlotPage(BACK_COVER_PAGE_ID, BACK_COVER_BASE_FRAME_ID, explicitBackCover ?? sourcePages[sourcePages.length - 1]),
  ];
}

type FrameEdgeKey = "top" | "right" | "bottom" | "left";

type FrameLine = {
  p1: PercentPoint;
  p2: PercentPoint;
};

type SnapGuideLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const SUPPORTED_IMAGE_FILE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
];

const KNOWN_UNSUPPORTED_IMAGE_FILE_EXTENSIONS = [
  ".heic",
  ".heif",
  ".avif",
  ".bmp",
  ".svg",
  ".tif",
  ".tiff",
  ".psd",
  ".raw",
  ".cr2",
  ".nef",
  ".arw",
];

function hasFileExtension(file: File, extensions: readonly string[]) {
  const name = file.name.toLowerCase();
  return extensions.some((extension) => name.endsWith(extension));
}

function isSupportedImageFile(file: File) {
  const mimeType = file.type.toLowerCase();

  return (
    SUPPORTED_IMAGE_MIME_TYPES.has(mimeType) ||
    hasFileExtension(file, SUPPORTED_IMAGE_FILE_EXTENSIONS)
  );
}

function isImageLikeFile(file: File) {
  return (
    file.type.toLowerCase().startsWith("image/") ||
    hasFileExtension(file, [
      ...SUPPORTED_IMAGE_FILE_EXTENSIONS,
      ...KNOWN_UNSUPPORTED_IMAGE_FILE_EXTENSIONS,
    ])
  );
}

function isImageLikeDataTransferItem(item: DataTransferItem) {
  if (item.kind !== "file") return false;

  const mimeType = item.type.toLowerCase();
  if (mimeType.startsWith("image/")) return true;

  const file = item.getAsFile();
  return file ? isImageLikeFile(file) : false;
}

type FreeTextColorFields = {
  freeTextColor?: string;
  freeTextOutlineEnabled?: boolean;
  freeTextOutlineColor?: string;
};

type FreeTextBubble = Omit<Bubble, "textColor"> &
  FreeTextColorFields & {
    textColor?: Bubble["textColor"] | "free";
  };

type BubbleBackgroundToneMode = "white" | "black" | "color";

type FreeBubbleBackgroundFields = {
  freeBubbleBackgroundColor?: string;
  freeBubbleTone?: number;
  freeBubbleBorderEnabled?: boolean;
  freeBubbleBorderColor?: string;
  bubbleBackgroundToneMode?: BubbleBackgroundToneMode;
};

const FREE_TEXT_COLOR_MODE = "free";

function asBubbleWithFreeTextColor(bubble: FreeTextBubble): Bubble {
  return bubble as unknown as Bubble;
}
const DEFAULT_FREE_TEXT_COLOR = DEFAULT_PALETTE_FILL_COLOR;
const DEFAULT_FREE_TEXT_OUTLINE_COLOR = DEFAULT_PALETTE_OUTLINE_COLOR;
const DEFAULT_FREE_BUBBLE_BACKGROUND_COLOR = "#ffffff";
const DEFAULT_FREE_BUBBLE_BORDER_COLOR = "#111827";

function getFreeTextColorFields(target: Bubble | SoundText) {
  return target as (Bubble | SoundText) & FreeTextColorFields;
}

function isFreeTextColorMode(target: Bubble | SoundText) {
  return (target as { textColor?: string }).textColor === FREE_TEXT_COLOR_MODE;
}

function getFreeTextFillColor(target: Bubble | SoundText) {
  return getFreeTextColorFields(target).freeTextColor ?? DEFAULT_FREE_TEXT_COLOR;
}

function getFreeTextOutlineEnabled(target: Bubble | SoundText) {
  return !!getFreeTextColorFields(target).freeTextOutlineEnabled;
}

function getFreeTextOutlineColor(target: Bubble | SoundText) {
  return getFreeTextColorFields(target).freeTextOutlineColor ?? DEFAULT_FREE_TEXT_OUTLINE_COLOR;
}

function getFreeBubbleBackgroundFields(bubble: Bubble) {
  return bubble as Bubble & FreeBubbleBackgroundFields;
}

function isFreeBubbleBackgroundColorMode(bubble: Bubble) {
  return getFreeBubbleBackgroundFields(bubble).freeBubbleTone != null;
}

function getFreeBubbleBackgroundColor(bubble: Bubble) {
  return getFreeBubbleBackgroundFields(bubble).freeBubbleBackgroundColor ?? DEFAULT_FREE_BUBBLE_BACKGROUND_COLOR;
}

function getFreeBubbleTone(bubble: Bubble) {
  return clamp(getFreeBubbleBackgroundFields(bubble).freeBubbleTone ?? 100, 0, 100);
}

function getFreeBubbleBorderEnabled(bubble: Bubble) {
  return !!getFreeBubbleBackgroundFields(bubble).freeBubbleBorderEnabled;
}

function getFreeBubbleBorderColor(bubble: Bubble) {
  return getFreeBubbleBackgroundFields(bubble).freeBubbleBorderColor ?? DEFAULT_FREE_BUBBLE_BORDER_COLOR;
}

function getBubbleBackgroundToneMode(bubble: Bubble): BubbleBackgroundToneMode {
  const fields = getFreeBubbleBackgroundFields(bubble);

  if (fields.bubbleBackgroundToneMode === "white" ||
      fields.bubbleBackgroundToneMode === "black" ||
      fields.bubbleBackgroundToneMode === "color") {
    return fields.bubbleBackgroundToneMode;
  }

  if (fields.freeBubbleTone != null) return "color";
  if ((bubble.blackTone ?? 0) > 0) return "black";

  return "white";
}

function getCurrentBubbleBackgroundToneModeFromPages(pages: Page[], bubbleId: number) {
  for (const page of pages) {
    const bubble = page.bubbles.find((item) => item.id === bubbleId);
    if (bubble) return getBubbleBackgroundToneMode(bubble);
  }

  return null;
}

function getBubbleForPresetBackgroundRendering(bubble: Bubble): Bubble {
  if (isFreeBubbleBackgroundColorMode(bubble)) {
    return bubble;
  }

  const next = { ...bubble } as Bubble & FreeBubbleBackgroundFields;
  delete next.freeBubbleBackgroundColor;
  delete next.freeBubbleTone;
  delete next.freeBubbleBorderEnabled;
  delete next.freeBubbleBorderColor;

  return next as Bubble;
}

function withWhiteBubbleTone(bubble: Bubble, tone: number): Bubble {
  const nextTone = clamp(tone, 0, 100);
  const fields = getFreeBubbleBackgroundFields(bubble);
  const next = {
    ...bubble,
    whiteTone: nextTone,
    blackTone: nextTone > 0 ? 0 : 0,
    backgroundColor: nextTone >= 100 ? "white" : "transparent",
    freeBubbleBackgroundColor:
      fields.freeBubbleBackgroundColor ?? DEFAULT_FREE_BUBBLE_BACKGROUND_COLOR,
    freeBubbleBorderEnabled: fields.freeBubbleBorderEnabled ?? false,
    freeBubbleBorderColor:
      fields.freeBubbleBorderColor ?? DEFAULT_FREE_BUBBLE_BORDER_COLOR,
    bubbleBackgroundToneMode: "white",
  } as Bubble & FreeBubbleBackgroundFields;

  delete next.freeBubbleTone;

  return next as Bubble;
}

function withBlackBubbleTone(bubble: Bubble, tone: number): Bubble {
  const nextTone = clamp(tone, 0, 100);
  const fields = getFreeBubbleBackgroundFields(bubble);
  const next = {
    ...bubble,
    blackTone: nextTone,
    whiteTone: nextTone > 0 ? 0 : 0,
    backgroundColor: nextTone >= 100 ? "black" : "transparent",
    freeBubbleBackgroundColor:
      fields.freeBubbleBackgroundColor ?? DEFAULT_FREE_BUBBLE_BACKGROUND_COLOR,
    freeBubbleBorderEnabled: fields.freeBubbleBorderEnabled ?? false,
    freeBubbleBorderColor:
      fields.freeBubbleBorderColor ?? DEFAULT_FREE_BUBBLE_BORDER_COLOR,
    bubbleBackgroundToneMode: "black",
  } as Bubble & FreeBubbleBackgroundFields;

  delete next.freeBubbleTone;

  return next as Bubble;
}


function isBubbleBackgroundTransparent(bubble: Bubble) {
  return getBubbleToneBackgroundColor(getBubbleForPresetBackgroundRendering(bubble)) === "transparent";
}

function withFreeBubbleBackgroundColor(
  bubble: Bubble,
  color: string | null,
  patch: Pick<Partial<FreeBubbleBackgroundFields>, "freeBubbleTone" | "freeBubbleBorderEnabled" | "freeBubbleBorderColor"> = {}
): Bubble {
  const fields = getFreeBubbleBackgroundFields(bubble);
  const storedColor = color ?? fields.freeBubbleBackgroundColor ?? DEFAULT_FREE_BUBBLE_BACKGROUND_COLOR;
  const next = {
    ...bubble,
    whiteTone: color == null ? bubble.whiteTone ?? 100 : 0,
    blackTone: color == null ? bubble.blackTone ?? 0 : 0,
    backgroundColor: color == null ? bubble.backgroundColor ?? "white" : "transparent",
    freeBubbleBackgroundColor: storedColor,
    freeBubbleTone: color == null ? undefined : patch.freeBubbleTone ?? fields.freeBubbleTone ?? 100,
    freeBubbleBorderEnabled:
      patch.freeBubbleBorderEnabled ?? fields.freeBubbleBorderEnabled ?? false,
    freeBubbleBorderColor:
      patch.freeBubbleBorderColor ?? fields.freeBubbleBorderColor ?? DEFAULT_FREE_BUBBLE_BORDER_COLOR,
    bubbleBackgroundToneMode: color == null ? getBubbleBackgroundToneMode(bubble) : "color",
  } as Bubble & FreeBubbleBackgroundFields;

  if (color == null) {
    delete next.freeBubbleTone;
  }

  return next as Bubble;
}

function isFixedSoundTextColorPreset(sound: SoundText) {
  return SOUND_STYLE_ORDER.slice(0, 2).some((key) => {
    const preset = SOUND_STYLE_PRESETS[key];

    return (
      sound.color === preset.color &&
      sound.outlineColor === preset.outlineColor &&
      sound.outlineWidth === preset.outlineWidth
    );
  });
}

function isSoundFreeTextColorMode(sound: SoundText) {
  const fields = getFreeTextColorFields(sound);

  return (
    fields.freeTextColor != null ||
    fields.freeTextOutlineEnabled != null ||
    fields.freeTextOutlineColor != null ||
    !isFixedSoundTextColorPreset(sound)
  );
}

function buildSoundWithFreeTextColor(
  sound: SoundText,
  patch: Partial<FreeTextColorFields> = {}
): SoundText {
  const fields = getFreeTextColorFields(sound);
  const fillColor =
    patch.freeTextColor ?? fields.freeTextColor ?? DEFAULT_FREE_TEXT_COLOR;
  const outlineEnabled =
    patch.freeTextOutlineEnabled ?? fields.freeTextOutlineEnabled ?? false;
  const outlineColor =
    patch.freeTextOutlineColor ??
    fields.freeTextOutlineColor ??
    DEFAULT_FREE_TEXT_OUTLINE_COLOR;

  return {
    ...sound,
    color: fillColor,
    outlineColor: outlineEnabled ? outlineColor : "transparent",
    outlineWidth: outlineEnabled ? 2 : 0,
    freeTextColor: fillColor,
    freeTextOutlineEnabled: outlineEnabled,
    freeTextOutlineColor: outlineColor,
  } as SoundText;
}

function normalizeBubbleWithFreeTextColor(bubble: Bubble, index: number): Bubble {
  const normalized = normalizeBubble(bubble, index);

  if (!isFreeTextColorMode(bubble)) {
    return normalized;
  }

  const fields = getFreeTextColorFields(bubble);

  return asBubbleWithFreeTextColor({
    ...normalized,
    textColor: FREE_TEXT_COLOR_MODE,
    freeTextColor: fields.freeTextColor ?? DEFAULT_FREE_TEXT_COLOR,
    freeTextOutlineEnabled: fields.freeTextOutlineEnabled ?? false,
    freeTextOutlineColor: fields.freeTextOutlineColor ?? DEFAULT_FREE_TEXT_OUTLINE_COLOR,
  });
}

function normalizeBubbleWithColorFields(bubble: Bubble, index: number): Bubble {
  const normalized = normalizeBubbleWithFreeTextColor(bubble, index);
  const fields = getFreeBubbleBackgroundFields(bubble);
  const hasStoredBackgroundColor = fields.freeBubbleBackgroundColor != null;
  const hasStoredBorderEnabled = fields.freeBubbleBorderEnabled != null;
  const hasStoredBorderColor = fields.freeBubbleBorderColor != null;
  const hasStoredToneMode = fields.bubbleBackgroundToneMode != null;

  if (!isFreeBubbleBackgroundColorMode(bubble)) {
    if (!hasStoredBackgroundColor && !hasStoredBorderEnabled && !hasStoredBorderColor && !hasStoredToneMode) {
      return normalized;
    }

    const next = { ...normalized } as Bubble & FreeBubbleBackgroundFields;

    if (hasStoredBackgroundColor) {
      next.freeBubbleBackgroundColor = getFreeBubbleBackgroundColor(bubble);
    }

    if (hasStoredBorderEnabled) {
      next.freeBubbleBorderEnabled = getFreeBubbleBorderEnabled(bubble);
    }

    if (hasStoredBorderColor) {
      next.freeBubbleBorderColor = getFreeBubbleBorderColor(bubble);
    }

    if (hasStoredToneMode) {
      next.bubbleBackgroundToneMode = getBubbleBackgroundToneMode(bubble);
    }

    return next as Bubble;
  }

  return {
    ...normalized,
    whiteTone: 0,
    blackTone: 0,
    backgroundColor: "transparent",
    freeBubbleBackgroundColor: getFreeBubbleBackgroundColor(bubble),
    freeBubbleTone: getFreeBubbleTone(bubble),
    freeBubbleBorderEnabled: getFreeBubbleBorderEnabled(bubble),
    freeBubbleBorderColor: getFreeBubbleBorderColor(bubble),
    bubbleBackgroundToneMode: getBubbleBackgroundToneMode(bubble),
  } as Bubble;
}

function restorePageBubbleColorFields(normalizedPage: Page, sourcePage: Page): Page {
  const sourceBubbleById = new Map((sourcePage.bubbles ?? []).map((bubble) => [bubble.id, bubble]));

  return {
    ...normalizedPage,
    bubbles: normalizedPage.bubbles.map((bubble, index) => {
      const sourceBubble = sourceBubbleById.get(bubble.id) ?? sourcePage.bubbles?.[index];

      if (!sourceBubble) {
        return normalizeBubbleWithColorFields(bubble, index);
      }

      return normalizeBubbleWithColorFields(
        {
          ...bubble,
          textColor: (sourceBubble as FreeTextBubble).textColor ?? bubble.textColor,
          freeTextColor: getFreeTextColorFields(sourceBubble).freeTextColor,
          freeTextOutlineEnabled: getFreeTextColorFields(sourceBubble).freeTextOutlineEnabled,
          freeTextOutlineColor: getFreeTextColorFields(sourceBubble).freeTextOutlineColor,
          freeBubbleBackgroundColor: getFreeBubbleBackgroundFields(sourceBubble).freeBubbleBackgroundColor,
          freeBubbleTone: getFreeBubbleBackgroundFields(sourceBubble).freeBubbleTone,
          freeBubbleBorderEnabled: getFreeBubbleBackgroundFields(sourceBubble).freeBubbleBorderEnabled,
          freeBubbleBorderColor: getFreeBubbleBackgroundFields(sourceBubble).freeBubbleBorderColor,
          bubbleBackgroundToneMode: getFreeBubbleBackgroundFields(sourceBubble).bubbleBackgroundToneMode,
        } as FreeTextBubble & Bubble & FreeBubbleBackgroundFields,
        index
      );
    }),
  };
}

function ColorPaletteButton({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const normalizedColor = color.trim().toLowerCase();

  return (
    <ToolbarIconButton
      title={color}
      keepFocusAfterClick
      onClick={onClick}
      style={{
        background: selected ? "#e5e7eb" : undefined,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: color,
            border: "1px solid rgba(17,24,39,0.45)",
            boxSizing: "border-box",
            boxShadow:
              normalizedColor === "#ffffff" || normalizedColor === "white"
                ? "inset 0 0 0 1px rgba(17,24,39,0.16)"
                : "inset 0 0 0 1px rgba(255,255,255,0.22)",
          }}
        />
      </span>
    </ToolbarIconButton>
  );
}

function normalizePaletteComparableColor(color: string) {
  const normalized = color.trim().toLowerCase();

  if (
    normalized === "black" ||
    normalized === "#000" ||
    normalized === "#000000" ||
    normalized === "rgb(0, 0, 0)" ||
    normalized === "rgb(0,0,0)" ||
    normalized === "#111827"
  ) {
    return "#000000";
  }

  if (
    normalized === "white" ||
    normalized === "#fff" ||
    normalized === "#ffffff" ||
    normalized === "rgb(255, 255, 255)" ||
    normalized === "rgb(255,255,255)"
  ) {
    return "#ffffff";
  }

  return normalized;
}

function isColorPaletteButtonSelected(value: string, color: string) {
  if (isPaletteColorSelected(value, color)) {
    return true;
  }

  return (
    normalizePaletteComparableColor(value || DEFAULT_FREE_TEXT_COLOR) ===
    normalizePaletteComparableColor(color)
  );
}

function ColorPaletteGrid({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLOR_PALETTE_TONES.length}, 34px)`,
        gap: 6,
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      {COLOR_PALETTE.flatMap((row) =>
        COLOR_PALETTE_TONES.map((tone) => {
          const color = row.colors[tone];

          return (
            <ColorPaletteButton
              key={`${row.key}-${tone}`}
              color={color}
              selected={isColorPaletteButtonSelected(value, color)}
              onClick={() => onChange(color)}
            />
          );
        })
      )}
    </div>
  );
}


function PaletteSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.25,
        color: "#374151",
      }}
    >
      {children}
    </span>
  );
}

function ColorPaletteField({
  label,
  value,
  onChange,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <PaletteSectionLabel>{label}</PaletteSectionLabel>
      <ColorPaletteGrid value={value} onChange={onChange} />
    </div>
  );
}

function FreeRgbTextColorEditor({
  t,
  fillColor,
  outlineEnabled,
  outlineColor,
  onFillColorChange,
  onOutlineEnabledChange,
  onOutlineColorChange,
}: {
  t: (key: MessageKey) => string;
  fillColor: string;
  outlineEnabled: boolean;
  outlineColor: string;
  onFillColorChange: (color: string) => void;
  onOutlineEnabledChange: (enabled: boolean) => void;
  onOutlineColorChange: (color: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      <ColorPaletteField
        label={t("colorText")}
        value={fillColor}
        onChange={onFillColorChange}
      />

      <EditorSwitchButton
        label={t("outline")}
        checked={outlineEnabled}
        onToggle={() => onOutlineEnabledChange(!outlineEnabled)}
      />

      {outlineEnabled && (
        <ColorPaletteField
          label={t("outline")}
          value={outlineColor}
          onChange={onOutlineColorChange}
        />
      )}
    </div>
  );
}

function getBubblePlaceholderTextStyle(): React.CSSProperties {
  return {
    color: "#9ca3af",
    textShadow: "none",
  };
}

function getSoundPlaceholderTextStyle() {
  return {
    color: "#9ca3af",
    outlineColor: "#ffffff",
    outlineWidth: 2,
  };
}

function getBubbleTextPaintStyle(bubble: Bubble) {
  if (isFreeTextColorMode(bubble)) {
    const outlineEnabled = getFreeTextOutlineEnabled(bubble);

    return {
      fillColor: getFreeTextFillColor(bubble),
      outlineColor: outlineEnabled ? getFreeTextOutlineColor(bubble) : "transparent",
      outlineWidth: outlineEnabled ? 2 : 0,
    };
  }

  const textColor = bubble.textColor ?? "black";

  if (textColor === "white") {
    return {
      fillColor: "#ffffff",
      outlineColor: "#111827",
      outlineWidth: 2,
    };
  }

  return {
    fillColor: "#111827",
    outlineColor: "#ffffff",
    outlineWidth: 2,
  };
}

function getBubbleTextFillStyle(bubble: Bubble): React.CSSProperties {
  const paint = getBubbleTextPaintStyle(bubble);

  return {
    color: paint.fillColor,
    textShadow: "none",
  };
}

function getBubbleTextOutlineStyle(bubble: Bubble): React.CSSProperties {
  const paint = getBubbleTextPaintStyle(bubble);

  if (paint.outlineWidth <= 0 || paint.outlineColor === "transparent") {
    return { display: "none" };
  }

  const strokeWidth = paint.outlineWidth;

  return {
    color: "transparent",
    WebkitTextStroke: `${strokeWidth}px ${paint.outlineColor}`,
    paintOrder: "stroke",
    textShadow: "none",
  };
}

function canBubbleUseTail(bubble: Bubble) {
  return (
    bubble.shape !== "flash" &&
    bubble.shape !== "uniFlash" &&
    bubble.shape !== "rect"
  );
}

function canBubbleUseTailCurve(bubble: Bubble) {
  return (
    bubble.shape !== "heptagon" &&
    bubble.shape !== "cornerSpiky" &&
    bubble.shape !== "electronic"
  );
}

function getBubbleAutoFitSizePercent(
  bubble: Bubble,
  fallbackText = " "
) {
  const fontSize = clamp(Number(bubble.fontSize) || 22, 10, 120);
  const bubblePaddingPx = clamp(fontSize * 1.5, 16, 64);
  const writingMode = bubble.writingMode ?? "vertical";
  const measuredText =
    (bubble.text ?? "").length > 0 ? bubble.text : fallbackText;
  const safeText = measuredText.length > 0 ? measuredText : " ";
  const safeLines = safeText.split(/\r?\n/);
  const lineCount = Math.max(1, safeLines.length);
  const maxLineLength = Math.max(
    1,
    ...safeLines.map((line) =>
      Array.from(line.length > 0 ? line : " ").length
    )
  );

  const charAdvancePx = fontSize;
  const lineAdvancePx = fontSize * 1.25;
  const isHorizontal = writingMode === "horizontal";

  let contentWidth: number;
  let contentHeight: number;

  if (isHorizontal) {
    contentWidth = maxLineLength * charAdvancePx;
    contentHeight = lineCount * lineAdvancePx;
  } else {
    contentWidth = lineCount * lineAdvancePx;
    contentHeight = maxLineLength * charAdvancePx;
  }

  const widthPx = contentWidth + bubblePaddingPx * 2;
  const heightPx = contentHeight + bubblePaddingPx * 2;

  const nextW = clamp(
    (Math.max(widthPx, BUBBLE_AUTO_MIN_SIZE_PX) / PAGE_WIDTH) * 100,
    4,
    95
  );

  const nextH = clamp(
    (Math.max(heightPx, BUBBLE_AUTO_MIN_SIZE_PX) / PAGE_HEIGHT) * 100,
    4,
    95
  );

  return { w: nextW, h: nextH };
}

function fitBubbleSizeToText(
  bubble: Bubble,
  fallbackText = " "
): Bubble {
  const { w, h } = getBubbleAutoFitSizePercent(bubble, fallbackText);
  const centerX = bubble.x + bubble.w / 2;
  const centerY = bubble.y + bubble.h / 2;
  const nextBubble = {
    ...bubble,
    w,
    h,
    x: clamp(centerX - w / 2, 0, 100 - w),
    y: clamp(centerY - h / 2, 0, 100 - h),
  };

  return {
    ...nextBubble,
    tailLength:
      nextBubble.tailEnabled && canBubbleUseTail(nextBubble)
        ? getBubbleMinimumTailLengthPx(nextBubble)
        : 0,
  };
}

function snapToGridPercent(value: number) {
  return Math.round(value / SHIFT_GRID_STEP_PERCENT) * SHIFT_GRID_STEP_PERCENT;
}

function clonePercentPoint(point: PercentPoint): PercentPoint {
  return { x: point.x, y: point.y };
}

function getFrameAbsolutePoints(frame: Frame): PercentPoint[] {
  return getFramePolygonPointsAbsolute(frame).map(clonePercentPoint);
}

function getPointsBounds(points: PercentPoint[]) {
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  return {
    minX,
    maxX,
    minY,
    maxY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

function getPolygonSignedArea(points: PercentPoint[]) {
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }

  return area / 2;
}

function rebuildFrameFromAbsolutePoints(frame: Frame, points: PercentPoint[]): Frame {
  const bounds = getPointsBounds(points);

  return {
    ...frame,
    x: bounds.minX,
    y: bounds.minY,
    w: Math.max(bounds.w, 0.000001),
    h: Math.max(bounds.h, 0.000001),
    points: points.map(clonePercentPoint) as [PercentPoint, PercentPoint, PercentPoint, PercentPoint],
  };
}

type SplitAxis = "vertical" | "horizontal";

function getPointKey(point: PercentPoint) {
  return `${point.x.toFixed(6)}:${point.y.toFixed(6)}`;
}

function arePointsNear(a: PercentPoint, b: PercentPoint, eps = 0.0001) {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function dedupeSequentialPoints(points: PercentPoint[], eps = 0.0001) {
  const result: PercentPoint[] = [];

  for (const point of points) {
    if (result.length === 0 || !arePointsNear(result[result.length - 1], point, eps)) {
      result.push({ x: point.x, y: point.y });
    }
  }

  if (result.length >= 2 && arePointsNear(result[0], result[result.length - 1], eps)) {
    result.pop();
  }

  return result;
}

function removeCollinearPoints(points: PercentPoint[], eps = 0.0001) {
  if (points.length <= 3) return points.map((p) => ({ x: p.x, y: p.y }));

  const result: PercentPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const cross = v1x * v2y - v1y * v2x;
    if (Math.abs(cross) > eps) {
      result.push({ x: curr.x, y: curr.y });
    }
  }

  return result;
}

function orderQuadPoints(points: PercentPoint[]) {
  if (points.length !== 4) return null;

  const sorted = [...points].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2).sort((a, b) => a.x - b.x);

  const tl = top[0];
  const tr = top[1];
  const bl = bottom[0];
  const br = bottom[1];

  return [tl, tr, br, bl] as [
    PercentPoint,
    PercentPoint,
    PercentPoint,
    PercentPoint
  ];
}

function sanitizeSplitPolygon(points: PercentPoint[]) {
  const deduped = dedupeSequentialPoints(points);
  const noCollinear = removeCollinearPoints(deduped);

  const unique = new Map<string, PercentPoint>();
  for (const point of noCollinear) {
    unique.set(getPointKey(point), point);
  }

  const uniquePoints = [...unique.values()];
  if (uniquePoints.length !== 4) return null;

  return orderQuadPoints(uniquePoints);
}

function clipPolygonByAxis(
  points: PercentPoint[],
  axis: SplitAxis,
  cutValue: number,
  keep: "min" | "max"
) {
  const result: PercentPoint[] = [];

  const isInside = (point: PercentPoint) => {
    return keep === "min"
      ? axis === "vertical"
        ? point.x <= cutValue + 0.0001
        : point.y <= cutValue + 0.0001
      : axis === "vertical"
      ? point.x >= cutValue - 0.0001
      : point.y >= cutValue - 0.0001;
  };

  const getIntersection = (a: PercentPoint, b: PercentPoint): PercentPoint | null => {
    if (axis === "vertical") {
      const dx = b.x - a.x;
      if (Math.abs(dx) < 0.000001) return null;

      const t = (cutValue - a.x) / dx;
      return {
        x: cutValue,
        y: a.y + (b.y - a.y) * t,
      };
    }

    const dy = b.y - a.y;
    if (Math.abs(dy) < 0.000001) return null;

    const t = (cutValue - a.y) / dy;
    return {
      x: a.x + (b.x - a.x) * t,
      y: cutValue,
    };
  };

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    const currentInside = isInside(current);
    const nextInside = isInside(next);

    if (currentInside && nextInside) {
      result.push({ x: next.x, y: next.y });
      continue;
    }

    if (currentInside && !nextInside) {
      const intersection = getIntersection(current, next);
      if (intersection) result.push(intersection);
      continue;
    }

    if (!currentInside && nextInside) {
      const intersection = getIntersection(current, next);
      if (intersection) result.push(intersection);
      result.push({ x: next.x, y: next.y });
    }
  }

  return sanitizeSplitPolygon(result);
}

function snapFrameTiltValue(value: number): FrameTiltValue {
  const candidates: FrameTiltValue[] = [-10, -5, 0, 5, 10];
  let best = candidates[0];
  let bestDiff = Math.abs(value - best);

  for (const candidate of candidates) {
    const diff = Math.abs(value - candidate);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }

  return best;
}

function getEdgeTiltFromQuad(
  points: [PercentPoint, PercentPoint, PercentPoint, PercentPoint],
  edge: "top" | "right" | "bottom" | "left"
): FrameTiltValue {
  let p1: PercentPoint;
  let p2: PercentPoint;

  switch (edge) {
    case "top":
      p1 = points[0];
      p2 = points[1];
      return snapFrameTiltValue((Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI);

    case "right":
      p1 = points[1];
      p2 = points[2];
      return snapFrameTiltValue((Math.atan2(p2.x - p1.x, p2.y - p1.y) * 180) / Math.PI);

    case "bottom":
      p1 = points[3];
      p2 = points[2];
      return snapFrameTiltValue((Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI);

    case "left":
      p1 = points[0];
      p2 = points[3];
      return snapFrameTiltValue((Math.atan2(p2.x - p1.x, p2.y - p1.y) * 180) / Math.PI);
  }
}

function buildSplitChildFrame(
  source: Frame,
  id: number,
  points: [PercentPoint, PercentPoint, PercentPoint, PercentPoint]
): Frame {
  const rebuilt = rebuildFrameFromAbsolutePoints(
    {
      ...source,
      id,
      points,
    },
    points
  );

  return {
    ...rebuilt,
    id,
    image: source.image,
    imageId: source.imageId,
    imageOffsetX: source.imageOffsetX,
    imageOffsetY: source.imageOffsetY,
    imageScale: source.imageScale,
    imageNaturalWidth: source.imageNaturalWidth,
    imageNaturalHeight: source.imageNaturalHeight,
    imageFlipX: hasFrameImageFlipX(source),
    imageFlipY: hasFrameImageFlipY(source),
    topTilt: getEdgeTiltFromQuad(points, "top"),
    rightTilt: getEdgeTiltFromQuad(points, "right"),
    bottomTilt: getEdgeTiltFromQuad(points, "bottom"),
    leftTilt: getEdgeTiltFromQuad(points, "left"),
  } as Frame;
}

function splitFramePolygon(
  frame: Frame,
  axis: SplitAxis,
  gap: number
) {
  const sourcePoints = getFrameAbsolutePoints(frame);
  const bounds = getPointsBounds(sourcePoints);

  const center = axis === "vertical"
    ? (bounds.minX + bounds.maxX) / 2
    : (bounds.minY + bounds.maxY) / 2;

  const halfGap = gap / 2;

  const first = clipPolygonByAxis(
    sourcePoints,
    axis,
    center - halfGap,
    "min"
  );

  const second = clipPolygonByAxis(
    sourcePoints,
    axis,
    center + halfGap,
    "max"
  );

  if (!first || !second) return null;

  const firstBounds = getPointsBounds(first);
  const secondBounds = getPointsBounds(second);

  if (firstBounds.w < 2 || firstBounds.h < 2) return null;
  if (secondBounds.w < 2 || secondBounds.h < 2) return null;

  return {
    first,
    second,
  };
}

function translateFrameWithPoints(frame: Frame, dx: number, dy: number): Frame {
  const movedPoints = getFrameAbsolutePoints(frame).map((point) => ({
    x: point.x + dx,
    y: point.y + dy,
  }));

  return rebuildFrameFromAbsolutePoints(frame, movedPoints);
}

function clampFrameMoveDelta(frame: Frame, dx: number, dy: number) {
  const points = getFrameAbsolutePoints(frame);
  const bounds = getPointsBounds(points);

  const clampedDx = clamp(dx, -bounds.minX, 100 - bounds.maxX);
  const clampedDy = clamp(dy, -bounds.minY, 100 - bounds.maxY);

  return {
    dx: clampedDx,
    dy: clampedDy,
  };
}

function getFrameEdgeLine(points: PercentPoint[], edge: FrameEdgeKey): FrameLine {
  switch (edge) {
    case "top":
      return { p1: points[0], p2: points[1] };
    case "right":
      return { p1: points[1], p2: points[2] };
    case "bottom":
      return { p1: points[3], p2: points[2] };
    case "left":
      return { p1: points[0], p2: points[3] };
  }
}

function getFrameEdgeOutwardNormal(points: PercentPoint[], edge: FrameEdgeKey) {
  const line = getFrameEdgeLine(points, edge);
  const dx = line.p2.x - line.p1.x;
  const dy = line.p2.y - line.p1.y;
  const length = Math.hypot(dx, dy);

  if (length < 0.000001) {
    return { x: 0, y: 0 };
  }

  const ux = dx / length;
  const uy = dy / length;

  const area = getPolygonSignedArea(points);
  const isClockwise = area < 0;

  const inward = isClockwise
    ? { x: -uy, y: ux }
    : { x: uy, y: -ux };

  return {
    x: -inward.x,
    y: -inward.y,
  };
}

function getPointOnLine(a: PercentPoint, b: PercentPoint, t: number): PercentPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function getFrameHandleCssPosition(point: PercentPoint): React.CSSProperties {
  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
    transform: "translate(-50%, -50%)",
  };
}

function offsetLine(line: FrameLine, nx: number, ny: number, distance: number): FrameLine {
  return {
    p1: {
      x: line.p1.x + nx * distance,
      y: line.p1.y + ny * distance,
    },
    p2: {
      x: line.p2.x + nx * distance,
      y: line.p2.y + ny * distance,
    },
  };
}

function intersectLines(a: FrameLine, b: FrameLine): PercentPoint | null {
  const dax = a.p2.x - a.p1.x;
  const day = a.p2.y - a.p1.y;
  const dbx = b.p2.x - b.p1.x;
  const dby = b.p2.y - b.p1.y;

  const cross = dax * dby - day * dbx;
  if (Math.abs(cross) < 0.000001) return null;

  const t =
    ((b.p1.x - a.p1.x) * dby - (b.p1.y - a.p1.y) * dbx) / cross;

  return {
    x: a.p1.x + dax * t,
    y: a.p1.y + day * t,
  };
}

function getResizeModeEdges(
  resizeMode:
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
): FrameEdgeKey[] {
  switch (resizeMode) {
    case "left":
      return ["left"];
    case "right":
      return ["right"];
    case "top":
      return ["top"];
    case "bottom":
      return ["bottom"];
    case "top-left":
      return ["top", "left"];
    case "top-right":
      return ["top", "right"];
    case "bottom-left":
      return ["bottom", "left"];
    case "bottom-right":
      return ["bottom", "right"];
  }
}

function isValidFramePolygonForTransform(frame: Frame) {
  const points = getFrameAbsolutePoints(frame);

  if (points.length !== 4) return false;

  const area = getPolygonSignedArea(points);
  if (!Number.isFinite(area) || Math.abs(area) < 0.000001) {
    return false;
  }

  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return false;
    }
  }

  let sign = 0;

  for (let i = 0; i < 4; i++) {
    const a = points[i];
    const b = points[(i + 1) % 4];
    const c = points[(i + 2) % 4];

    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const bcx = c.x - b.x;
    const bcy = c.y - b.y;

    const cross = abx * bcy - aby * bcx;

    if (Math.abs(cross) < 0.000001) {
      return false;
    }

    const currentSign = Math.sign(cross);

    if (sign === 0) {
      sign = currentSign;
    } else if (currentSign !== sign) {
      return false;
    }
  }

  return true;
}

function projectPointsToAxis(points: PercentPoint[], axis: PercentPoint) {
  let min = Infinity;
  let max = -Infinity;

  for (const point of points) {
    const value = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  return { min, max };
}

function doPolygonsOverlapStrict(a: PercentPoint[], b: PercentPoint[]) {
  const EPS = 0.0001;

  const axes: PercentPoint[] = [];

  const addAxes = (points: PercentPoint[]) => {
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);

      if (len < 0.000001) continue;

      axes.push({
        x: -dy / len,
        y: dx / len,
      });
    }
  };

  addAxes(a);
  addAxes(b);

  for (const axis of axes) {
    const pa = projectPointsToAxis(a, axis);
    const pb = projectPointsToAxis(b, axis);

    if (pa.max <= pb.min + EPS || pb.max <= pa.min + EPS) {
      return false;
    }
  }

  return true;
}

function doFramesOverlapStrict(a: Frame, b: Frame) {
  return doPolygonsOverlapStrict(
    getFrameAbsolutePoints(a),
    getFrameAbsolutePoints(b)
  );
}

const FRAME_BOUNDS_EPS = 0.0001;

function resizeFrameWithParallelEdges(
  frame: Frame,
  resizeMode:
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right",
  rawDx: number,
  rawDy: number
): Frame | null {
  const MIN_EDGE_LENGTH = 2;

  const getDistance = (a: PercentPoint, b: PercentPoint) => {
    return Math.hypot(b.x - a.x, b.y - a.y);
  };

  const isValidConvexQuad = (points: PercentPoint[]) => {
    if (points.length !== 4) return false;

    for (let i = 0; i < 4; i++) {
      const a = points[i];
      const b = points[(i + 1) % 4];

      if (getDistance(a, b) < MIN_EDGE_LENGTH) {
        return false;
      }
    }

    let sign = 0;

    for (let i = 0; i < 4; i++) {
      const a = points[i];
      const b = points[(i + 1) % 4];
      const c = points[(i + 2) % 4];

      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const bcx = c.x - b.x;
      const bcy = c.y - b.y;

      const cross = abx * bcy - aby * bcx;

      if (Math.abs(cross) < 0.000001) {
        return false;
      }

      const currentSign = Math.sign(cross);

      if (sign === 0) {
        sign = currentSign;
      } else if (currentSign !== sign) {
        return false;
      }
    }

    return true;
  };

  const isInsideCanvas = (points: PercentPoint[]) => {
    const bounds = getPointsBounds(points);

    return (
      Number.isFinite(bounds.minX) &&
      Number.isFinite(bounds.maxX) &&
      Number.isFinite(bounds.minY) &&
      Number.isFinite(bounds.maxY) &&
      bounds.minX >= -0.0001 &&
      bounds.maxX <= 100.0001 &&
      bounds.minY >= -0.0001 &&
      bounds.maxY <= 100.0001
    );
  };

  const originalPoints = getFrameAbsolutePoints(frame);
  const originalArea = getPolygonSignedArea(originalPoints);
  if (Math.abs(originalArea) < 0.000001) return null;

  const movedEdges = getResizeModeEdges(resizeMode);

  const tryResize = (dxInput: number, dyInput: number): Frame | null => {
    const lines: Record<FrameEdgeKey, FrameLine> = {
      top: getFrameEdgeLine(originalPoints, "top"),
      right: getFrameEdgeLine(originalPoints, "right"),
      bottom: getFrameEdgeLine(originalPoints, "bottom"),
      left: getFrameEdgeLine(originalPoints, "left"),
    };

    for (const edge of movedEdges) {
      const normal = getFrameEdgeOutwardNormal(originalPoints, edge);
      const offset = dxInput * normal.x + dyInput * normal.y;
      lines[edge] = offsetLine(lines[edge], normal.x, normal.y, offset);
    }

    const nextTl = intersectLines(lines.top, lines.left);
    const nextTr = intersectLines(lines.top, lines.right);
    const nextBr = intersectLines(lines.bottom, lines.right);
    const nextBl = intersectLines(lines.bottom, lines.left);

    if (!nextTl || !nextTr || !nextBr || !nextBl) {
      return null;
    }

    const nextPoints = [nextTl, nextTr, nextBr, nextBl];
    const nextArea = getPolygonSignedArea(nextPoints);

    if (Math.abs(nextArea) < 0.000001) {
      return null;
    }

    if (Math.sign(nextArea) !== Math.sign(originalArea)) {
      return null;
    }

    if (!isValidConvexQuad(nextPoints)) {
      return null;
    }

    if (!isInsideCanvas(nextPoints)) {
      return null;
    }

    return rebuildFrameFromAbsolutePoints(frame, nextPoints);
  };

  const direct = tryResize(rawDx, rawDy);
  if (direct) {
    return direct;
  }

  let low = 0;
  let high = 1;
  let best: Frame | null = null;

  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    const trial = tryResize(rawDx * mid, rawDy * mid);

    if (trial) {
      best = trial;
      low = mid;
    } else {
      high = mid;
    }
  }

  return best;
}

type FrameResizeMode = Parameters<typeof resizeFrameWithParallelEdges>[1];


type FrameEdgeCoordinateTargets = Partial<{
  left: number;
  right: number;
  top: number;
  bottom: number;
}>;

function resizeFrameWithEdgeCoordinateTargets(
  frame: Frame,
  targets: FrameEdgeCoordinateTargets
): Frame | null {
  const MIN_EDGE_LENGTH = 2;

  const getDistance = (a: PercentPoint, b: PercentPoint) => {
    return Math.hypot(b.x - a.x, b.y - a.y);
  };

  const isValidConvexQuad = (points: PercentPoint[]) => {
    if (points.length !== 4) return false;

    for (let i = 0; i < 4; i++) {
      const a = points[i];
      const b = points[(i + 1) % 4];

      if (getDistance(a, b) < MIN_EDGE_LENGTH) {
        return false;
      }
    }

    let sign = 0;

    for (let i = 0; i < 4; i++) {
      const a = points[i];
      const b = points[(i + 1) % 4];
      const c = points[(i + 2) % 4];

      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const bcx = c.x - b.x;
      const bcy = c.y - b.y;

      const cross = abx * bcy - aby * bcx;

      if (Math.abs(cross) < 0.000001) {
        return false;
      }

      const currentSign = Math.sign(cross);

      if (sign === 0) {
        sign = currentSign;
      } else if (currentSign !== sign) {
        return false;
      }
    }

    return true;
  };

  const isInsideCanvas = (points: PercentPoint[]) => {
    const bounds = getPointsBounds(points);

    return (
      Number.isFinite(bounds.minX) &&
      Number.isFinite(bounds.maxX) &&
      Number.isFinite(bounds.minY) &&
      Number.isFinite(bounds.maxY) &&
      bounds.minX >= -0.0001 &&
      bounds.maxX <= 100.0001 &&
      bounds.minY >= -0.0001 &&
      bounds.maxY <= 100.0001
    );
  };

  const originalPoints = getFrameAbsolutePoints(frame);
  const originalArea = getPolygonSignedArea(originalPoints);
  if (Math.abs(originalArea) < 0.000001) return null;

  const lines: Record<FrameEdgeKey, FrameLine> = {
    top: getFrameEdgeLine(originalPoints, "top"),
    right: getFrameEdgeLine(originalPoints, "right"),
    bottom: getFrameEdgeLine(originalPoints, "bottom"),
    left: getFrameEdgeLine(originalPoints, "left"),
  };

  const applyEdgeTarget = (edge: FrameEdgeKey, targetValue: number) => {
    if (!Number.isFinite(targetValue)) return false;

    const normal = getFrameEdgeOutwardNormal(originalPoints, edge);
    const line = lines[edge];
    const isHorizontalCoordinate = edge === "left" || edge === "right";
    const denominator = isHorizontalCoordinate ? normal.x : normal.y;

    if (Math.abs(denominator) < 0.000001) return false;

    const currentValue = isHorizontalCoordinate ? line.p1.x : line.p1.y;
    const offset = (targetValue - currentValue) / denominator;
    lines[edge] = offsetLine(line, normal.x, normal.y, offset);
    return true;
  };

  for (const edge of ["left", "right", "top", "bottom"] as const) {
    const targetValue = targets[edge];
    if (targetValue == null) continue;
    if (!applyEdgeTarget(edge, targetValue)) return null;
  }

  const nextTl = intersectLines(lines.top, lines.left);
  const nextTr = intersectLines(lines.top, lines.right);
  const nextBr = intersectLines(lines.bottom, lines.right);
  const nextBl = intersectLines(lines.bottom, lines.left);

  if (!nextTl || !nextTr || !nextBr || !nextBl) {
    return null;
  }

  const nextPoints = [nextTl, nextTr, nextBr, nextBl];
  const nextArea = getPolygonSignedArea(nextPoints);

  if (Math.abs(nextArea) < 0.000001) {
    return null;
  }

  if (Math.sign(nextArea) !== Math.sign(originalArea)) {
    return null;
  }

  if (!isValidConvexQuad(nextPoints)) {
    return null;
  }

  if (!isInsideCanvas(nextPoints)) {
    return null;
  }

  return rebuildFrameFromAbsolutePoints(frame, nextPoints);
}

type FrameResizeAxisMode = "left" | "right" | "top" | "bottom";

const replaceFrameResizeAxisMode = (
  resizeMode: FrameResizeMode,
  axis: "x" | "y",
  nextAxisMode: FrameResizeAxisMode
): FrameResizeMode => {
  const hasTop =
    resizeMode === "top" ||
    resizeMode === "top-left" ||
    resizeMode === "top-right";
  const hasBottom =
    resizeMode === "bottom" ||
    resizeMode === "bottom-left" ||
    resizeMode === "bottom-right";
  const hasLeft =
    resizeMode === "left" ||
    resizeMode === "top-left" ||
    resizeMode === "bottom-left";
  const hasRight =
    resizeMode === "right" ||
    resizeMode === "top-right" ||
    resizeMode === "bottom-right";

  const vertical =
    axis === "y" ? nextAxisMode : hasTop ? "top" : hasBottom ? "bottom" : null;
  const horizontal =
    axis === "x" ? nextAxisMode : hasLeft ? "left" : hasRight ? "right" : null;

  if (vertical && horizontal) {
    return `${vertical}-${horizontal}` as FrameResizeMode;
  }

  return (horizontal ?? vertical ?? resizeMode) as FrameResizeMode;
};

const getFrameResizeAxisModes = (resizeMode: FrameResizeMode) => ({
  horizontal:
    resizeMode === "left" ||
    resizeMode === "top-left" ||
    resizeMode === "bottom-left"
      ? "left"
      : resizeMode === "right" ||
        resizeMode === "top-right" ||
        resizeMode === "bottom-right"
      ? "right"
      : null,
  vertical:
    resizeMode === "top" ||
    resizeMode === "top-left" ||
    resizeMode === "top-right"
      ? "top"
      : resizeMode === "bottom" ||
        resizeMode === "bottom-left" ||
        resizeMode === "bottom-right"
      ? "bottom"
      : null,
});

function resizeFrameWithCornerFallback(
  frame: Frame,
  resizeMode: FrameResizeMode,
  rawDx: number,
  rawDy: number
): Frame | null {
  const direct = resizeFrameWithParallelEdges(frame, resizeMode, rawDx, rawDy);
  if (direct) return direct;

  const isCorner =
    resizeMode === "top-left" ||
    resizeMode === "top-right" ||
    resizeMode === "bottom-left" ||
    resizeMode === "bottom-right";

  if (!isCorner) return null;

  const horizontalMode: FrameResizeMode =
    resizeMode === "top-left" || resizeMode === "bottom-left"
      ? "left"
      : "right";

  const verticalMode: FrameResizeMode =
    resizeMode === "top-left" || resizeMode === "top-right"
      ? "top"
      : "bottom";

  const xOnly = resizeFrameWithParallelEdges(frame, horizontalMode, rawDx, 0);
  const yOnly = resizeFrameWithParallelEdges(frame, verticalMode, 0, rawDy);

  const xThenY = xOnly
    ? resizeFrameWithParallelEdges(xOnly, verticalMode, 0, rawDy) ?? xOnly
    : null;

  const yThenX = yOnly
    ? resizeFrameWithParallelEdges(yOnly, horizontalMode, rawDx, 0) ?? yOnly
    : null;

  const candidates = [xThenY, yThenX, xOnly, yOnly].filter(
    (item): item is Frame => item !== null
  );

  if (candidates.length === 0) return null;

  return candidates[0];
}

const PENDING_RESTORE_PROJECT_KEY = "mansaku_pending_restore_project";

type PendingRestoreProject = {
  projectFileName: string | null;
  data: ProjectData;
};


type CollapsibleEditorSectionProps = {
  sectionKey: string;
  title: React.ReactNode;
  openSectionKey: string | null;
  setOpenSectionKey: React.Dispatch<React.SetStateAction<string | null>>;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

function CollapsibleEditorSection({
  sectionKey,
  title,
  openSectionKey,
  setOpenSectionKey,
  style,
  children,
}: CollapsibleEditorSectionProps) {
  const isOpen = openSectionKey === sectionKey;
  const [hovered, setHovered] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const keepOpenByContentPointerRef = useRef(false);
  const [contentHeight, setContentHeight] = useState(0);

  const isFocusableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;

    return !!target.closest(
      "button, a[href], input, textarea, select, [tabindex]:not([tabindex='-1']), [contenteditable='true']"
    );
  };

  const blurActiveEditorControlForHeadingToggle = () => {
    const activeElement = document.activeElement as HTMLElement | null;

    if (!activeElement || activeElement === document.body) return;
    if (activeElement.closest("[data-focus-role='editor-heading']")) return;

    activeElement.blur();
  };

  useLayoutEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const updateContentHeight = () => {
      setContentHeight(contentElement.scrollHeight);
    };

    updateContentHeight();

    if (typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(updateContentHeight);
    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [children]);

  useEffect(() => {
    const handleVisibilityRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ sectionKey?: string; open?: boolean }>).detail;
      if (detail?.sectionKey !== sectionKey) return;

      setOpenSectionKey((current) => {
        if (detail.open) return sectionKey;

        const sectionElement = sectionRef.current;
        const activeElement = document.activeElement as HTMLElement | null;

        if (sectionElement && activeElement && sectionElement.contains(activeElement)) {
          return current;
        }

        return current === sectionKey ? null : current;
      });
    };

    document.addEventListener(
      "mansaku-editor-section-visibility-request",
      handleVisibilityRequest
    );

    return () => {
      document.removeEventListener(
        "mansaku-editor-section-visibility-request",
        handleVisibilityRequest
      );
    };
  }, [sectionKey, setOpenSectionKey]);

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      data-editor-section-root={sectionKey}
      onFocusCapture={() => {
        setOpenSectionKey(sectionKey);
      }}
      onBlurCapture={(e) => {
        if (sectionKey === "frame-image-move-copy" || sectionKey === "frame-effect-line") {
          const sectionElement = sectionRef.current;
          const nextTarget = e.relatedTarget as HTMLElement | null;

          if (!nextTarget || nextTarget === document.body) {
            return;
          }

          if (sectionElement && sectionElement.contains(nextTarget)) {
            return;
          }

          if (
            sectionKey === "frame-effect-line" &&
            nextTarget.closest("[data-focus-layer='canvas'], [data-canvas-focus-object='true']")
          ) {
            return;
          }
        }

        if (keepOpenByContentPointerRef.current) {
          window.setTimeout(() => {
            keepOpenByContentPointerRef.current = false;
          }, 0);
          return;
        }

        window.setTimeout(() => {
          const sectionElement = sectionRef.current;
          const activeElement = document.activeElement as HTMLElement | null;

          if (!sectionElement) return;
          if (activeElement && sectionElement.contains(activeElement)) return;

          setOpenSectionKey((current) =>
            current === sectionKey ? null : current
          );
        }, 0);
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        margin: 0,
        outline: "none",
      }}
    >
      <button
        type="button"
        data-focus-role="editor-heading"
        data-editor-section-key={sectionKey}
        aria-expanded={isOpen}
        onMouseDown={(e) => {
          e.preventDefault();
          blurActiveEditorControlForHeadingToggle();
          setOpenSectionKey((current) =>
            current === sectionKey ? null : sectionKey
          );
        }}
        onClick={(e) => {
          e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;

          e.preventDefault();
          blurActiveEditorControlForHeadingToggle();
          setOpenSectionKey((current) =>
            current === sectionKey ? null : sectionKey
          );
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => {}}
        onBlur={() => {}}
        style={{
          all: "unset",
          display: "flex",
          alignItems: "center",
          gap: 7,
          width: "100%",
          boxSizing: "border-box",
          padding: "6px 8px",
          borderRadius: 7,
          color: isOpen || hovered ? "#111827" : "#374151",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.2,
          lineHeight: 1.3,
          cursor: "pointer",
          userSelect: "none",
          background: isOpen || hovered ? "#e5e7eb" : "transparent",
          outline: "none",
          transition: "background 0.12s ease, color 0.12s ease",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 12,
            display: "inline-flex",
            justifyContent: "center",
            color: "currentColor",
            lineHeight: 1,
            transform: "translateY(-1px)",
            transition: "color 0.12s ease",
          }}
        >
          <FoldChevronSvgIcon open={isOpen} />
        </span>
        <span>{title}</span>
      </button>

      <div
        data-editor-section-content={sectionKey}
        aria-hidden={!isOpen}
        onPointerDownCapture={(e) => {
          keepOpenByContentPointerRef.current = true;

          if (!isFocusableTarget(e.target)) {
            return;
          }
        }}
        style={{
          maxHeight: isOpen ? contentHeight : 0,
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          pointerEvents: isOpen ? "auto" : "none",
          transition:
            "max-height 140ms ease, opacity 100ms ease, margin 140ms ease",
          marginTop: isOpen ? 8 : 0,
          marginBottom: isOpen ? 10 : 0,
        }}
      >
        <div
          ref={contentRef}
          style={{
            ...style,
          }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}


type ExportProgressState = {
  label: string;
  current: number;
  total: number;
} | null;

type HistorySnapshot = {
  pages: Page[];
  hasCovers: boolean;
  currentPageId: number | null;
};


const REVIEW_RESUBMIT_INTERVAL_DAYS = 90;

function isSameReviewDate(leftIso: string | null, right: Date) {
  if (!leftIso) return false;

  const left = new Date(leftIso);
  if (Number.isNaN(left.getTime())) return false;

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function hasReviewIntervalPassed(iso: string | null, now: Date, days: number) {
  if (!iso) return true;

  const previous = new Date(iso);
  if (Number.isNaN(previous.getTime())) return true;

  return now.getTime() - previous.getTime() >= days * 24 * 60 * 60 * 1000;
}

function isLocalhostReviewTestMode() {
  if (typeof window === "undefined") return false;

  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function shouldShowReviewPrompt(appVersion: string) {
  if (isLocalhostReviewTestMode()) return true;

  const now = new Date();
  const dismissedVersion = getReviewStorageItem(
    REVIEW_LOCAL_STORAGE_KEYS.dismissedForever
  );

  if (dismissedVersion === appVersion) return false;

  const lastShownAt = getReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.lastShownAt);
  if (isSameReviewDate(lastShownAt, now)) return false;

  const submittedAt = getReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.submittedAt);
  const submittedVersion = getReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.submittedVersion);
  if (
    submittedAt &&
    submittedVersion === appVersion &&
    !hasReviewIntervalPassed(submittedAt, now, REVIEW_RESUBMIT_INTERVAL_DAYS)
  ) {
    return false;
  }

  return true;
}

function markReviewPromptShown() {
  setReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.lastShownAt, new Date().toISOString());
}

function markReviewSubmitted(appVersion: string) {
  const now = new Date().toISOString();
  setReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.submittedAt, now);
  setReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.submittedVersion, appVersion);
}

export default function App() {
  const appRootRef = useRef<HTMLDivElement | null>(null);

  const PAGE_CARD_INNER_WIDTH = 124;
  const pageThumbScale = PAGE_CARD_INNER_WIDTH / PAGE_WIDTH;
  const PAGE_CARD_HEIGHT = PAGE_HEIGHT * pageThumbScale;

  const MAX_HISTORY_LENGTH = 99;
  const MAX_UNDO_STACK_LENGTH = Math.max(MAX_HISTORY_LENGTH - 1, 0);

  const limitUndoStack = (stack: HistorySnapshot[]) =>
    stack.length > MAX_UNDO_STACK_LENGTH
      ? stack.slice(stack.length - MAX_UNDO_STACK_LENGTH)
      : stack;

  useEffect(() => {
    initializeAnalytics();
    trackAppOpen();
  }, []);

  const createHistorySnapshot = (
    sourcePages = pagesRef.current,
    sourceHasCovers = hasCoversRef.current,
    sourceCurrentPageId = currentPageIdRef.current
  ): HistorySnapshot => ({
    pages: clonePages(sourcePages),
    hasCovers: sourceHasCovers,
    currentPageId: sourceCurrentPageId,
  });

  const pushUndoHistory = (stack: HistorySnapshot[], snapshot: HistorySnapshot) =>
    limitUndoStack([...stack, snapshot]);

  const getJsonByteSize = (value: unknown) => {
    const json = JSON.stringify(value);
    return new TextEncoder().encode(json).length;
  };

  const formatHistorySize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;

    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)}KB`;

    const mb = kb / 1024;
    return `${mb.toFixed(mb >= 10 ? 0 : 1)}MB`;
  };

  const SLIDER_PERCENT_LABEL_WIDTH = 44;
  const SLIDER_CONTROL_GAP = 3.5;
  const DEFAULT_SHARED_SLIDER_INPUT_WIDTH = 104;
  const DEFAULT_SHARED_PAGE_CARD_WIDTH = 131;

  const sliderInputStyle: React.CSSProperties = {
    width: "100%",
    margin: 0,
    accentColor: "#6b7280",
    position: "relative",
    zIndex: 2,
  };

  const sliderPercentLabelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#6b7280",
    minWidth: SLIDER_PERCENT_LABEL_WIDTH,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    textAlign: "right",
  };

  const sliderRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `34px minmax(0, 1fr) ${SLIDER_PERCENT_LABEL_WIDTH}px`,
    alignItems: "center",
    columnGap: SLIDER_CONTROL_GAP,
  };

  const sliderValueButtonStyle: React.CSSProperties = {
    ...sliderPercentLabelStyle,
    height: 28,
    padding: "0 6px",
    border: "none",
    borderRadius: 6,
    background: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    position: "relative",
    zIndex: 1,
    transition: "background 0.12s ease",
  };

  const sliderValueLabelStyle: React.CSSProperties = {
    ...sliderPercentLabelStyle,
    height: 28,
    padding: "0 6px",
    borderRadius: 6,
    boxSizing: "border-box",
    cursor: "default",
    userSelect: "none",
    position: "relative",
    zIndex: 1,
  };

  const [focusedWheelSliderId, setFocusedWheelSliderId] = useState<string | null>(null);

  const [leftPanelSharedMetrics, setLeftPanelSharedMetrics] = useState({
    sliderInputWidth: DEFAULT_SHARED_SLIDER_INPUT_WIDTH,
    pageCardWidth: DEFAULT_SHARED_PAGE_CARD_WIDTH,
  });

  const sharedSliderInputWidth = Math.max(
    40,
    leftPanelSharedMetrics.sliderInputWidth
  );

  const sharedPageCardWidth = Math.max(
    80,
    leftPanelSharedMetrics.pageCardWidth
  );


  const [pages, setPages] = useState<Page[]>(() => createInitialPages());
  const [imageAssets, setImageAssets] = useState<Record<string, string>>({});
  const pagesRef = useRef<Page[]>(pages);
  const [currentPageId, setCurrentPageId] = useState<number | null>(null);
  const currentPageIdRef = useRef<number | null>(currentPageId);

  const createImageAssetId = () =>
    `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const getFrameImageSrc = (frame: Frame | null | undefined) => {
    if (!frame) return null;
    if (frame.imageId) return imageAssets[frame.imageId] ?? frame.image ?? null;
    return frame.image ?? null;
  };

  const hasFrameImage = (frame: Frame | null | undefined): frame is Frame => {
    return !!getFrameImageSrc(frame);
  };

  const getPageIndexById = (pageId: number) => {
    return pagesRef.current.findIndex((page) => page.id === pageId);
  };

  const isSpecialCoverPageId = (pageId: number | null | undefined) => {
    return isSpecialCoverPageIdValue(pageId);
  };

  const isProtectedCoverBaseFrame = (page: Page | null | undefined, frame: Frame | null | undefined) => {
    if (!page || !frame) return false;
    return isSpecialCoverPageId(page.id) && isCoverBaseFrameId(frame.id);
  };

  type FrameBorderVisibleState = Frame & { frameBorderVisible?: boolean };

  const isFrameBorderVisible = (frame: Frame | null | undefined) => {
    return ((frame as FrameBorderVisibleState | null | undefined)?.frameBorderVisible ?? true) === true;
  };

  const isFrameBorderSwitchChecked = (
    page: Page | null | undefined,
    frame: Frame | null | undefined
  ) => {
    if (isProtectedCoverBaseFrame(page, frame)) return false;
    return isFrameBorderVisible(frame);
  };

  const shouldDrawFrameBorder = (frame: Frame | null | undefined) => {
    if (!frame) return false;
    if (isInnerLockedFrame(frame)) return false;
    if (isCoverBaseFrameId(frame.id)) return false;

    return isFrameBorderVisible(frame);
  };

  const getFirstContentPage = (sourcePages = pagesRef.current) => {
    return sourcePages.find((page) => !isSpecialCoverPageIdValue(page.id)) ?? null;
  };

  const getFirstVisiblePage = (
    sourcePages = pagesRef.current,
    sourceHasCovers = hasCoversRef.current
  ) => {
    return (
      sourcePages.find(
        (page) => sourceHasCovers || !isSpecialCoverPageIdValue(page.id)
      ) ?? null
    );
  };

  const resolveVisibleCurrentPageId = (
    requestedPageId: number | null | undefined,
    sourcePages = pagesRef.current,
    sourceHasCovers = hasCoversRef.current
  ) => {
    if (
      requestedPageId != null &&
      sourcePages.some((page) => page.id === requestedPageId) &&
      (sourceHasCovers || !isSpecialCoverPageIdValue(requestedPageId))
    ) {
      return requestedPageId;
    }

    return getFirstVisiblePage(sourcePages, sourceHasCovers)?.id ?? null;
  };

  const hasContentPage = (sourcePages = pagesRef.current) => {
    return sourcePages.some((page) => !isSpecialCoverPageIdValue(page.id));
  };

  const getDefaultPageInsertIndex = () => {
    return clampContentInsertIndex(pages.length - 1, pages.length);
  };

  const toggleCovers = () => {
    const nextHasCovers = !hasCovers;

    setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot()));
    setRedoStack([]);
    setHasCovers(nextHasCovers);
    setHasUnsavedChanges(true);

    if (!nextHasCovers && currentPageId != null && isSpecialCoverPageId(currentPageId)) {
      setCurrentPageId(resolveVisibleCurrentPageId(currentPageId, pagesRef.current, nextHasCovers));
      setSelectedPageIds([]);
      setSelectedItems([]);
      setSelectedFrameImageCardId(null);
      setTrimmingFrameId(null);
      setActiveTargetType("canvas");
      lastSelectedPageIdRef.current = null;
    }
  };

  const getFrameImagePayload = (frame: Frame) => ({
    image: frame.image ?? null,
    imageId: frame.imageId,
    imageOffsetX: frame.imageOffsetX,
    imageOffsetY: frame.imageOffsetY,
    imageScale: frame.imageScale,
    imageNaturalWidth: frame.imageNaturalWidth,
    imageNaturalHeight: frame.imageNaturalHeight,
    imageHasTransparency: hasFrameImageTransparency(frame),
    imageFlipX: hasFrameImageFlipX(frame),
    imageFlipY: hasFrameImageFlipY(frame),
  });

  const migrateInlineImagesToAssets = (sourcePages: Page[], sourceAssets: Record<string, string>) => {
    const nextAssets: Record<string, string> = { ...sourceAssets };

    const nextPages = sourcePages.map((page) => ({
      ...page,
      frames: page.frames.map((frame) => {
        if (frame.imageId && nextAssets[frame.imageId]) {
          return { ...frame, image: null };
        }

        if (!frame.image) {
          return frame;
        }

        const imageId = frame.imageId ?? createImageAssetId();
        nextAssets[imageId] = frame.image;

        return {
          ...frame,
          imageId,
          image: null,
        };
      }),
    }));

    return { pages: nextPages, imageAssets: nextAssets };
  };

  const [selectedPageIds, setSelectedPageIds] = useState<number[]>([]);

  const [activeTargetType, setActiveTargetType] = useState<"page" | "canvas">(
    "page"
  );

  const [pageClipboard, setPageClipboard] = useState<{
    mode: "copy" | "cut";
    pages: Page[];
  } | null>(null);

  const lastSelectedPageIdRef = useRef<number | null>(null);
  const suppressNextPageCardFocusSelectionRef = useRef(false);

  const [hasCovers, setHasCovers] = useState(false);
  const hasCoversRef = useRef(hasCovers);
  const [dragState, setDragState] = useState<DragState>(null);
  const [isDragCopyPreviewVisible, setIsDragCopyPreviewVisible] = useState(false);
  const [draggingFrameImage, setDraggingFrameImage] = useState<{
    sourceFrameId: number;
    isCopy: boolean;
  } | null>(null);
  const [dragOverFrameImageTargetId, setDragOverFrameImageTargetId] = useState<number | null>(null);
  const [pressedFrameImageCardId, setPressedFrameImageCardId] = useState<number | null>(null);
  const [selectedFrameImageCardId, setSelectedFrameImageCardId] = useState<number | null>(null);
  const [trimmingFrameId, setTrimmingFrameId] = useState<number | null>(null);
  const keepFrameImageCardSelectedByCanvasPointerRef = useRef(false);
  const [frameImageScaleIndicator, setFrameImageScaleIndicator] = useState<{
    frameId: number;
    scalePercent: number;
  } | null>(null);
  const frameImageScaleIndicatorTimerRef = useRef<number | null>(null);
  const frameTiltStartFrameRef = useRef<Frame | null>(null);
  const frameHandleInteractionLockRef = useRef<number | null>(null);
  const [snapGuideLines, setSnapGuideLines] = useState<SnapGuideLine[]>([]);
  const [bubbleTailWidthDragCursor, setBubbleTailWidthDragCursor] = useState<{
    id: number;
    xPercent: number;
    yPercent: number;
  } | null>(null);
  const bubbleTailDragPointerRef = useRef<{
    xPercent: number;
    yPercent: number;
  } | null>(null);
  const [hoverFrameGuideId, setHoverFrameGuideId] = useState<number | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgressState>(null);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [openEditorSectionKey, setOpenEditorSectionKey] = useState<string | null>(null);
  const [suppressFrameSelectionOutlineByBorderSwitch, setSuppressFrameSelectionOutlineByBorderSwitch] = useState(false);
  const selectedItemsSignature = selectedItems
    .map((item) => `${item.kind}:${item.id}`)
    .join("|");

  useEffect(() => {
    setSuppressFrameSelectionOutlineByBorderSwitch(false);
  }, [selectedItemsSignature]);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [previewScale, setPreviewScale] = useState(50);
  const [clipboardItem, setClipboardItem] = useState<ClipboardItem>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    pageXPercent: null,
    pageYPercent: null,
    target: null,
  });
  const [stickySubmenuKey, setStickySubmenuKey] = useState<
    | "frame-split"
    | "frame-layer"
    | "bubble-layer"
    | "sound-layer"
    | "bubble-type"
    | "bubble-background"
    | "sound-color"
    | "bubble-opacity"
    | "bubble-tone"
    | "main-export"
    | "main-settings"
    | "language"
    | "default-text-direction"
    | null
  >(null);
  const [lastPastePoint, setLastPastePoint] = useState<{
    xPercent: number;
    yPercent: number;
  } | null>(null);

  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  const imageScaleHistoryRef = useRef<{
    pages: Page[];
    frameId: number;
    startScale: number;
  } | null>(null);

  const bubbleToneHistoryRef = useRef<{
    pages: Page[];
    bubbleId: number;
    startWhiteTone: number;
    startBlackTone: number;
    startFreeBubbleTone?: number;
    startToneMode: BubbleBackgroundToneMode;
  } | null>(null);

  const bubbleTypeHistoryRef = useRef<{
    pages: Page[];
    bubbleId: number;
    startType: BubbleTypeSelectValue;
  } | null>(null);

  const sliderWheelHistoryRef = useRef<{
    pages: Page[];
    targetKind: "bubbleTone" | "frameImageScale" | "frameEffectLine";
    targetId: number;
    changed: boolean;
    timeoutId: number | null;
  } | null>(null);

  const frameEffectLineSliderHistoryRef = useRef<{
    pages: Page[];
    frameIds: number[];
    changed: boolean;
  } | null>(null);

  const fontSizeInputHistoryRef = useRef<{
    pages: Page[];
    targetKind: "bubble" | "sound";
    targetId: number;
  } | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const isAnyTopToolbarMenuOpen =
    isMenuOpen || isSettingsMenuOpen;

  const topToolbarMenuKindRef = useRef<"main" | "settings" | null>(null);

  function isTopToolbarSubmenuKey(key: typeof stickySubmenuKey) {
    return (
      key === "main-export" ||
      key === "main-settings" ||
      key === "language" ||
      key === "default-text-direction"
    );
  }

  function clearTopToolbarSubmenuIfFocusMovesToPlainItem(
    e: React.FocusEvent<HTMLDivElement>
  ) {
    const target = e.target as HTMLElement | null;

    if (!target) return;
    if (target.closest(".split-menu-wrap")) return;

    setStickySubmenuKey((prev) =>
      isTopToolbarSubmenuKey(prev) ? null : prev
    );
  }

  function isContextMenuSubmenuKey(key: typeof stickySubmenuKey) {
    return (
      key === "frame-split" ||
      key === "frame-layer" ||
      key === "bubble-layer" ||
      key === "sound-layer" ||
      key === "bubble-type" ||
      key === "bubble-background" ||
      key === "sound-color" ||
      key === "bubble-opacity" ||
      key === "bubble-tone"
    );
  }

  function clearContextMenuSubmenuIfFocusMovesToPlainItem(
    e: React.FocusEvent<HTMLDivElement>
  ) {
    const target = e.target as HTMLElement | null;

    if (!target) return;
    if (target.closest(".split-menu-wrap")) return;

    setStickySubmenuKey((prev) =>
      isContextMenuSubmenuKey(prev) ? null : prev
    );
  }

  function openTopToolbarMenu(kind: "main" | "settings") {
    const previousKind = topToolbarMenuKindRef.current;

    topToolbarMenuKindRef.current = kind;
    setIsMenuOpen(kind === "main");
    setIsSettingsMenuOpen(kind === "settings");

    if (previousKind !== kind) {
      setStickySubmenuKey(null);
    }

    window.dispatchEvent(
      new CustomEvent("mansaku-top-toolbar-menu-opened", {
        detail: { kind },
      })
    );
  }

  function closeTopToolbarMenus() {
    topToolbarMenuKindRef.current = null;
    setIsMenuOpen(false);
    setIsSettingsMenuOpen(false);
    setStickySubmenuKey(null);
  }

  useEffect(() => {
    const handleCloseTopToolbarMenus = () => {
      closeTopToolbarMenus();
    };

    window.addEventListener(
      "mansaku-close-top-toolbar-menus",
      handleCloseTopToolbarMenus
    );

    return () => {
      window.removeEventListener(
        "mansaku-close-top-toolbar-menus",
        handleCloseTopToolbarMenus
      );
    };
  }, []);

  const [language, setLanguage] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem("language");

    if (saved) {
      return normalizeAppLanguage(saved);
    }

    return normalizeAppLanguage(navigator.language);
  });

  const [defaultTextDirection, setDefaultTextDirection] = useState<
    "vertical" | "horizontal"
  >(() => {
    const saved = localStorage.getItem("defaultTextDirection");

    return saved === "horizontal" ? "horizontal" : "vertical";
  });

  const selectableLanguages = supportedAppLanguages.filter((value) =>
    (supportedHelpLanguages as readonly string[]).includes(value)
  );

  const t = createTranslator(language);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const reviewExportTypeRef = useRef<ReviewExportType>(null);

  const resetReviewForm = () => {
    // 入力欄の初期化は共通ReviewDialog側で行う
  };

  const requestReviewPromptAfterExport = (exportType: ReviewExportType) => {
    if (!shouldShowReviewPrompt(APP_VERSION)) return;

    markReviewPromptShown();
    reviewExportTypeRef.current = exportType;
    resetReviewForm();

    window.setTimeout(() => {
      setReviewDialogOpen(true);
      trackReviewPromptShow(exportType);
    }, 900);
  };

  const closeReviewDialog = () => {
    setReviewDialogOpen(false);
    trackReviewPromptClose(reviewExportTypeRef.current);
  };

  const dismissReviewForever = () => {
    setReviewStorageItem(REVIEW_LOCAL_STORAGE_KEYS.dismissedForever, APP_VERSION);
    setReviewDialogOpen(false);
    trackReviewPromptDismissForever(reviewExportTypeRef.current);
  };

  const handleReviewSubmit = async (
    payload: Omit<ReviewSubmitPayload, "source">
  ) => {
    trackReviewSubmit(payload.rating, reviewExportTypeRef.current);

    await submitMansakuReview({
      ...payload,
      source: "app",
      app_version: APP_VERSION,
      export_type: reviewExportTypeRef.current,
    });

    markReviewSubmitted(APP_VERSION);
    trackReviewSubmitSuccess(payload.rating, reviewExportTypeRef.current);
  };

  const [restoreNoticeToken, setRestoreNoticeToken] = useState(0);
  const shownRestoreNoticeTokenRef = useRef(0);

  const requestRestoreCompleteNotice = () => {
    setRestoreNoticeToken((token) => token + 1);
  };

  const showAlertAfterPaint = (message: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.alert(message);
      });
    });
  };

  useEffect(() => {
    if (restoreNoticeToken === 0) return;
    if (shownRestoreNoticeTokenRef.current === restoreNoticeToken) return;

    shownRestoreNoticeTokenRef.current = restoreNoticeToken;
    showAlertAfterPaint(t("autoSaveRestored"));
  }, [restoreNoticeToken, t]);

  const isDebugMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("dev");
  }, []);

  const historySizeBytes = useMemo(() => {
    if (undoStack.length === 0 && redoStack.length === 0) return 0;

    return getJsonByteSize([...undoStack, pages, ...redoStack]);
  }, [undoStack, pages, redoStack]);

  const collectReferencedImageAssetIds = (sourcePages: Page[], referencedIds: Set<string>) => {
    sourcePages.forEach((page) => {
      page.frames.forEach((frame) => {
        if (frame.imageId) {
          referencedIds.add(frame.imageId);
        }
      });
    });
  };

  const getReferencedImageAssetIds = () => {
    const referencedIds = new Set<string>();

    collectReferencedImageAssetIds(pages, referencedIds);
    undoStack.forEach((snapshot) => {
      collectReferencedImageAssetIds(snapshot.pages, referencedIds);
    });
    redoStack.forEach((snapshot) => {
      collectReferencedImageAssetIds(snapshot.pages, referencedIds);
    });

    return referencedIds;
  };

  const getImageAssetsForPages = (sourcePages: Page[]) => {
    const referencedIds = new Set<string>();
    collectReferencedImageAssetIds(sourcePages, referencedIds);

    const nextAssets: Record<string, string> = {};

    referencedIds.forEach((id) => {
      const asset = imageAssets[id];
      if (asset != null) {
        nextAssets[id] = asset;
      }
    });

    return nextAssets;
  };

  const imageAssetStats = useMemo(() => {
    const assetIds = Object.keys(imageAssets);
    const referencedIds = getReferencedImageAssetIds();
    const used = assetIds.filter((id) => referencedIds.has(id)).length;

    return {
      total: assetIds.length,
      used,
      unused: Math.max(assetIds.length - used, 0),
    };
  }, [imageAssets, pages, undoStack, redoStack]);

  useEffect(() => {
    setImageAssets((assets) => {
      const assetIds = Object.keys(assets);
      if (assetIds.length === 0) return assets;

      const referencedIds = getReferencedImageAssetIds();
      let changed = false;
      const nextAssets: Record<string, string> = {};

      assetIds.forEach((id) => {
        if (referencedIds.has(id)) {
          nextAssets[id] = assets[id];
        } else {
          changed = true;
        }
      });

      return changed ? nextAssets : assets;
    });
  }, [pages, undoStack, redoStack]);

  function clearFloatingNoticeTimer() {
    if (floatingNoticeTimerRef.current == null) return;

    window.clearTimeout(floatingNoticeTimerRef.current);
    floatingNoticeTimerRef.current = null;
  }

  function clearFloatingNoticeMouseMoveListener() {
    if (!floatingNoticeMouseMoveCleanupRef.current) return;

    floatingNoticeMouseMoveCleanupRef.current();
    floatingNoticeMouseMoveCleanupRef.current = null;
  }

  function showFloatingNotice(
    message: string,
    anchorElement?: HTMLElement | null,
    options: { hideOnMouseMove?: boolean } = {}
  ) {
    let left = 16;
    let top = 16;

    if (anchorElement) {
      const rect = anchorElement.getBoundingClientRect();

      left = rect.left;
      top = rect.bottom + 6;
    }

    clearFloatingNoticeTimer();
    clearFloatingNoticeMouseMoveListener();

    setFloatingNotice({
      message,
      left,
      top,
    });

    if (options.hideOnMouseMove) {
      window.setTimeout(() => {
        let startX: number | null = null;
        let startY: number | null = null;

        const handleMouseMove = (event: MouseEvent) => {
          if (startX == null || startY == null) {
            startX = event.clientX;
            startY = event.clientY;
            return;
          }

          if (
            Math.abs(event.clientX - startX) < 2 &&
            Math.abs(event.clientY - startY) < 2
          ) {
            return;
          }

          clearFloatingNoticeMouseMoveListener();
          setFloatingNotice(null);
        };

        window.addEventListener("mousemove", handleMouseMove);

        floatingNoticeMouseMoveCleanupRef.current = () => {
          window.removeEventListener("mousemove", handleMouseMove);
        };
      }, 0);

      return;
    }

    floatingNoticeTimerRef.current = window.setTimeout(() => {
      setFloatingNotice(null);
      floatingNoticeTimerRef.current = null;
    }, 1200);
  }

  function getHistoryNoticePosition(anchorElement: HTMLElement) {
    const rect = anchorElement.getBoundingClientRect();

    return {
      left: rect.left + rect.width / 2,
      top: rect.bottom + 6,
    };
  }

  function getPersistentHistoryNotice() {
    return null;
  }

  function clearHistoryShortcutTimer() {
    if (historyNoticeTimerRef.current == null) return;

    window.clearTimeout(historyNoticeTimerRef.current);
    historyNoticeTimerRef.current = null;
  }

  function showHistoryHoverNotice(anchorElement: HTMLElement) {
    clearHistoryShortcutTimer();

    setHistoryHoverNotice({
      ...getHistoryNoticePosition(anchorElement),
      mode: "hover",
    });
  }

  function showHistoryShortcutNotice(anchor: "undo" | "redo") {
    const anchorElement =
      anchor === "undo"
        ? undoHistoryButtonRef.current
        : redoHistoryButtonRef.current;

    if (!anchorElement) return;

    setHistoryHoverNotice((notice) => {
      if (notice?.mode === "hover") return notice;

      return {
        ...getHistoryNoticePosition(anchorElement),
        mode: "shortcut",
      };
    });

    clearHistoryShortcutTimer();

    historyNoticeTimerRef.current = window.setTimeout(() => {
      setHistoryHoverNotice((notice) => {
        if (notice?.mode !== "shortcut") return notice;
        return getPersistentHistoryNotice();
      });

      historyNoticeTimerRef.current = null;
    }, 1200);
  }

  function hideHistoryHoverNotice() {
    setHistoryHoverNotice((notice) => {
      if (notice?.mode !== "hover") return notice;
      return getPersistentHistoryNotice();
    });
  }

  const loadLocalFonts = async (anchorElement: HTMLElement | null) => {
    const resetLocalFontState = () => {
      setLocalFontFamilies([]);
      setLocalFontsLoaded(false);
      setPreviewFontFamily(null);
    };

    const getLocalFontsPermissionState = async () => {
      if (!navigator.permissions?.query) return null;

      try {
        const status = await navigator.permissions.query({
          name: "local-fonts" as PermissionName,
        });

        return status.state;
      } catch {
        return null;
      }
    };

    if (!window.queryLocalFonts) {
      resetLocalFontState();
      showFloatingNotice(t("localFontsNotSupported"), anchorElement, {
        hideOnMouseMove: true,
      });
      return;
    }

    const permissionState = await getLocalFontsPermissionState();

    if (permissionState === "denied") {
      resetLocalFontState();
      showFloatingNotice(t("localFontsSiteSettingsRequired"), anchorElement, {
        hideOnMouseMove: true,
      });
      return;
    }

    try {
      const fonts = await window.queryLocalFonts();

      const families = Array.from(
        new Set(
          fonts
            .map((font) => font.family)
            .filter((family) => family.trim() !== "")
        )
      ).sort((a, b) => a.localeCompare(b, language));

      if (families.length === 0) {
        resetLocalFontState();

        const nextPermissionState = await getLocalFontsPermissionState();
        showFloatingNotice(
          t(
            nextPermissionState === "denied"
              ? "localFontsSiteSettingsRequired"
              : "localFontsLoadFailed"
          ),
          anchorElement,
          { hideOnMouseMove: true }
        );
        return;
      }

      setLocalFontFamilies(families);
      setLocalFontsLoaded(true);

      showFloatingNotice(t("localFontsLoaded"), anchorElement);
    } catch (error) {
      resetLocalFontState();

      const nextPermissionState = await getLocalFontsPermissionState();
      showFloatingNotice(
        t(
          nextPermissionState === "denied" || isPermissionError(error)
            ? "localFontsSiteSettingsRequired"
            : "localFontsLoadFailed"
        ),
        anchorElement,
        { hideOnMouseMove: true }
      );
    }
  };

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    currentPageIdRef.current = currentPageId;
  }, [currentPageId]);

  useEffect(() => {
    hasCoversRef.current = hasCovers;
  }, [hasCovers]);

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem(
      "defaultTextDirection",
      defaultTextDirection
    );
  }, [defaultTextDirection]);

  useEffect(() => {
    return () => {
      clearFloatingNoticeTimer();
      clearFloatingNoticeMouseMoveListener();

      if (historyNoticeTimerRef.current != null) {
        window.clearTimeout(historyNoticeTimerRef.current);
      }
    };
  }, []);

  function resetSettings() {
    localStorage.removeItem("language");
    localStorage.removeItem("defaultTextDirection");

    const nextLanguage = normalizeAppLanguage(navigator.language);

    setLanguage(nextLanguage);
    setDefaultTextDirection("vertical");

    closeTopToolbarMenus();
  }

  const [bubbleRubyText, setBubbleRubyText] = useState("");
  const [bubbleRubySelectionPreview, setBubbleRubySelectionPreview] = useState("");
  const [bubbleRubySelectionRange, setBubbleRubySelectionRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [isRubyFocused, setIsRubyFocused] = useState(false);
  const [focusedTextEditor, setFocusedTextEditor] = useState<
    "bubble" | "sound" | null
  >(null);

  const [bubbleFontSizeInput, setBubbleFontSizeInput] = useState("");
  const [soundFontSizeInput, setSoundFontSizeInput] = useState("");
  const [localFontFamilies, setLocalFontFamilies] = useState<string[]>([]);
  const [localFontsLoaded, setLocalFontsLoaded] = useState(false);
  const [previewFontFamily, setPreviewFontFamily] = useState<{
    targetKind: "bubble" | "sound";
    targetId: number;
    fontFamily: string;
  } | null>(null);
  const [floatingNotice, setFloatingNotice] = useState<{
    message: string;
    left: number;
    top: number;
  } | null>(null);
  const [historyHoverNotice, setHistoryHoverNotice] = useState<{
    left: number;
    top: number;
    mode: "hover" | "shortcut" | "warning";
  } | null>(null);
  const floatingNoticeTimerRef = useRef<number | null>(null);
  const floatingNoticeMouseMoveCleanupRef = useRef<(() => void) | null>(null);
  const historyNoticeTimerRef = useRef<number | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const undoHistoryButtonRef = useRef<HTMLDivElement | null>(null);
  const redoHistoryButtonRef = useRef<HTMLDivElement | null>(null);
  const [pageMenu, setPageMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    pageId: number | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    pageId: null,
  });

  const [pageInsertMenu, setPageInsertMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    insertIndex: number;
    insertBarKey: string | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    insertIndex: 0,
    insertBarKey: null,
  });

  const [draggingPageId, setDraggingPageId] = useState<number | null>(null);
  const [pressedPageCardId, setPressedPageCardId] = useState<number | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<number | null>(null);
  const [dragOverInsertBarKey, setDragOverInsertBarKey] = useState<string | null>(null);
  const [isPageDragCopying, setIsPageDragCopying] = useState(false);
  const [draggingTemplateId, setDraggingTemplateId] = useState<string | null>(null);
  
  const [pageSelectionBox, setPageSelectionBox] =
    useState<PageSelectionBox | null>(null);

  const [mainMode, setMainMode] = useState<MainMode>("manga");

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [projectFileName, setProjectFileName] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveReadyRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const consumedPendingRestoreRef = useRef(false);

  const [templateContextMenu, setTemplateContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    templateId: string | null;
    key: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    templateId: null,
    key: 0,
  });

  const lastAddedFrameRef = useRef<{
    pageId: number;
    id: number;
    x: number;
    y: number;
  } | null>(null);

  const lastAddedBubbleRef = useRef<{
    pageId: number;
    id: number;
    x: number;
    y: number;
  } | null>(null);

  const lastAddedSoundRef = useRef<{
    pageId: number;
    id: number;
    x: number;
    y: number;
  } | null>(null);

  const lastPastedObjectRef = useRef<{
    pageId: number;
    itemKeys: string[];
    minX: number;
    minY: number;
  } | null>(null);

  const hiddenLoadInputRef = useRef<HTMLInputElement | null>(null);
  const loadProjectConfirmedRef = useRef(false);
  const projectFileHandleRef = useRef<FileSystemFileHandle | null>(null);

  const canUseFileSystemPicker =
    "showSaveFilePicker" in window && "showOpenFilePicker" in window;

  const getOptionalMessage = (key: string, fallbackKey: MessageKey) => {
    const value = t(key as MessageKey);

    return typeof value === "string" && value.length > 0 && value !== key
      ? value
      : t(fallbackKey);
  };

  const isPermissionError = (error: unknown) => {
    return (
      error instanceof DOMException &&
      (error.name === "NotAllowedError" || error.name === "SecurityError")
    );
  };

  const createAppError = (code: string) => {
    return new Error(code);
  };

  const isAppError = (error: unknown, code: string) => {
    return error instanceof Error && error.message === code;
  };

  const APP_ERROR = {
    PDF_RENDER: "MansakuPdfRenderFailed",
    PDF_WRITE: "MansakuPdfWriteFailed",
    PNG_RENDER: "MansakuPngRenderFailed",
    PNG_ZIP: "MansakuPngZipFailed",
    PNG_WRITE: "MansakuPngWriteFailed",
  } as const;

  const hiddenImageInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageFrameIdRef = useRef<number | null>(null);
  const mainAreaRef = useRef<HTMLElement | null>(null);
  const previewAreaRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const focusTrapRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const templateButtonRef = useRef<HTMLButtonElement | null>(null);
  const emptyPageAddButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsMenuWrapRef = useRef<HTMLDivElement | null>(null);
  const exportRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const pageListScrollRef = useRef<HTMLDivElement | null>(null);
  const editorPanelScrollRef = useRef<HTMLDivElement | null>(null);
  const currentPageCardRef = useRef<HTMLDivElement | null>(null);

  const pageCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const focusCanvasTrap = () => {
    window.requestAnimationFrame(() => {
      focusTrapRef.current?.focus({ preventScroll: true });
    });
  };

  const focusToolbarArea = () => {
    window.requestAnimationFrame(() => {
      toolbarRef.current?.focus({ preventScroll: true });
    });
  };

  const focusTemplateToolbarButton = () => {
    setContextMenuKeyboardInputMode();

    const focusWithRetry = (attempt = 0) => {
      window.requestAnimationFrame(() => {
        const target =
          templateButtonRef.current ??
          document.querySelector<HTMLButtonElement>(
            '[data-focus-role="toolbar-template"]'
          );

        if (target && isAltFocusableElementVisible(target)) {
          toolbarRef.current?.focus({ preventScroll: true });
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
          return;
        }

        if (attempt < 8) {
          window.setTimeout(() => focusWithRetry(attempt + 1), 0);
        }
      });
    };

    focusWithRetry();
  };

  const flashMainArea = () => {
    const area = mainAreaRef.current;
    if (!area) return;

    area.dataset.focusFlashActive = "false";
    void area.offsetWidth;
    area.dataset.focusFlashActive = "true";

    window.setTimeout(() => {
      area.dataset.focusFlashActive = "false";
    }, 650);
  };

  const focusEmptyPageAddButtonInPageList = () => {
    setMainMode("manga");
    setActiveTargetType("page");
    setSelectedItems([]);
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;

    const focusWithRetry = (attempt = 0) => {
      window.requestAnimationFrame(() => {
        const target = emptyPageAddButtonRef.current;

        if (target && isAltFocusableElementVisible(target)) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
          return;
        }

        if (attempt < 8) {
          window.setTimeout(() => focusWithRetry(attempt + 1), 0);
        }
      });
    };

    focusWithRetry();
  };

  useLayoutEffect(() => {
    let frameId = 0;

    const getContentWidth = (el: HTMLElement | null) => {
      if (!el) return null;

      const style = window.getComputedStyle(el);
      const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(style.paddingRight) || 0;
      const width = el.clientWidth - paddingLeft - paddingRight;

      return width > 0 ? width : null;
    };

    const update = () => {
      window.cancelAnimationFrame(frameId);

      frameId = window.requestAnimationFrame(() => {
        const toneSlider = editorPanelScrollRef.current?.querySelector<HTMLInputElement>(
          "#mansaku-slider-bubble-background-tone"
        );

        const sliderInputWidth = toneSlider?.getBoundingClientRect().width;
        const pageCardWidth =
          currentPageCardRef.current?.getBoundingClientRect().width ??
          getContentWidth(pageListScrollRef.current);

        setLeftPanelSharedMetrics((prev) => {
          const nextSliderInputWidth =
            sliderInputWidth && sliderInputWidth > 0
              ? Math.round(sliderInputWidth)
              : prev.sliderInputWidth;

          const nextPageCardWidth =
            pageCardWidth && pageCardWidth > 0
              ? Math.round(pageCardWidth)
              : prev.pageCardWidth;

          if (
            prev.sliderInputWidth === nextSliderInputWidth &&
            prev.pageCardWidth === nextPageCardWidth
          ) {
            return prev;
          }

          return {
            sliderInputWidth: nextSliderInputWidth,
            pageCardWidth: nextPageCardWidth,
          };
        });
      });
    };

    update();

    const observer = new ResizeObserver(update);

    if (editorPanelScrollRef.current) {
      observer.observe(editorPanelScrollRef.current);
    }

    if (pageListScrollRef.current) {
      observer.observe(pageListScrollRef.current);
    }

    if (currentPageCardRef.current) {
      observer.observe(currentPageCardRef.current);
    }

    window.addEventListener("resize", update);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [
    activeTargetType,
    currentPageId,
    mainMode,
    pages.length,
    selectedItems,
  ]);

  const skipPageListAutoScrollRef = useRef(false);
  const wasEditorPanelOpenRef = useRef(false);

  const pageMoveRepeatTimeoutRef = useRef<number | null>(null);
  const pageMoveRepeatIntervalRef = useRef<number | null>(null);

  const bubbleTextEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const bubbleRubyEditorRef = useRef<HTMLDivElement | null>(null);
  const soundTextEditorRef = useRef<HTMLTextAreaElement | null>(null);

  const previewZoom = previewScale / 100;


  const getVisiblePageCenterPercent = () => {
    const main = mainAreaRef.current;
    const page = pageRef.current;

    if (!main || !page) {
      return { x: 50, y: 50 };
    }

    const mainRect = main.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();

    if (pageRect.width <= 0 || pageRect.height <= 0) {
      return { x: 50, y: 50 };
    }

    const visibleLeft = Math.max(mainRect.left, pageRect.left);
    const visibleRight = Math.min(mainRect.right, pageRect.right);
    const visibleTop = Math.max(mainRect.top, pageRect.top);
    const visibleBottom = Math.min(mainRect.bottom, pageRect.bottom);

    const centerClientX =
      visibleLeft < visibleRight
        ? (visibleLeft + visibleRight) / 2
        : mainRect.left + mainRect.width / 2;

    const centerClientY =
      visibleTop < visibleBottom
        ? (visibleTop + visibleBottom) / 2
        : mainRect.top + mainRect.height / 2;

    return {
      x: clamp(((centerClientX - pageRect.left) / pageRect.width) * 100, 0, 100),
      y: clamp(((centerClientY - pageRect.top) / pageRect.height) * 100, 0, 100),
    };
  };

  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      if (
        settingsMenuWrapRef.current?.contains(target)
      ) {
        return;
      }

      setIsSettingsMenuOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, []);

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      fitPreviewToWindow();
    });
  }, []);

  const getPageListLocalPoint = (e: MouseEvent | React.MouseEvent) => {
    const area = pageListScrollRef.current;
    if (!area) return null;

    const rect = area.getBoundingClientRect();

    return {
      x: e.clientX - rect.left + area.scrollLeft,
      y: e.clientY - rect.top + area.scrollTop,
    };
  };

  const updatePageSelectionByBox = (box: PageSelectionBox) => {
    const area = pageListScrollRef.current;
    if (!area) return;

    const areaRect = area.getBoundingClientRect();

    const minX = Math.min(box.startX, box.currentX);
    const maxX = Math.max(box.startX, box.currentX);
    const minY = Math.min(box.startY, box.currentY);
    const maxY = Math.max(box.startY, box.currentY);

    const hitIds: number[] = [];

    pageCardRefs.current.forEach((el, pageId) => {
      const rect = el.getBoundingClientRect();

      const left = rect.left - areaRect.left + area.scrollLeft;
      const top = rect.top - areaRect.top + area.scrollTop;
      const right = left + rect.width;
      const bottom = top + rect.height;

      const hit =
        right >= minX &&
        left <= maxX &&
        bottom >= minY &&
        top <= maxY;

      if (hit) {
        hitIds.push(pageId);
      }
    });

    if (!box.additive) {
      setSelectedPageIds(hitIds);
      return;
    }

    const merged = [...box.baseSelectedIds];

    hitIds.forEach((id) => {
      if (!merged.includes(id)) {
        merged.push(id);
      }
    });

    setSelectedPageIds(merged);
  };

  const startPageSelectionBox = (
    e: React.MouseEvent<HTMLDivElement>,
    options?: { allowInsertBar?: boolean }
  ) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    const insertBar = target.closest("[data-insert-bar='true']");

    if (!options?.allowInsertBar && insertBar) return;
    if (!insertBar && target.closest("[data-page-card='true']")) return;
    if (!insertBar && target.closest("[data-page-add-card='true']")) return;

    const point = getPageListLocalPoint(e);
    if (!point) return;

    e.preventDefault();

    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    closeTopToolbarMenus();

    setActiveTargetType("page");
    setSelectedItems([]);

    const nextBox: PageSelectionBox = {
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      additive: e.ctrlKey || e.metaKey,
      baseSelectedIds: selectedPageIds,
    };

    setPageSelectionBox(nextBox);

    if (!nextBox.additive) {
      setSelectedPageIds([]);
    }
  };

  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest("[data-ruby-active-control='true']")) {
        return;
      }

      clearRubySelection();
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, []);

  function normalizeRubies(
    rubies: Bubble["rubies"] | undefined,
    textLength: number
  ) {
    return (rubies ?? [])
      .filter((ruby) => {
        return (
          Number.isFinite(ruby.start) &&
          Number.isFinite(ruby.end) &&
          ruby.start >= 0 &&
          ruby.end > ruby.start &&
          ruby.end <= textLength &&
          ruby.text.trim() !== ""
        );
      })
      .sort((a, b) => a.start - b.start);
  }

  function syncRubiesAfterTextChange(
    oldText: string,
    newText: string,
    rubies: Bubble["rubies"] | undefined
  ) {
    const currentRubies = normalizeRubies(rubies, oldText.length);

    let prefix = 0;
    while (
      prefix < oldText.length &&
      prefix < newText.length &&
      oldText[prefix] === newText[prefix]
    ) {
      prefix++;
    }

    let suffix = 0;
    while (
      suffix < oldText.length - prefix &&
      suffix < newText.length - prefix &&
      oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
    ) {
      suffix++;
    }

    const oldChangeStart = prefix;
    const oldChangeEnd = oldText.length - suffix;
    const newChangeEnd = newText.length - suffix;
    const delta = (newChangeEnd - oldChangeStart) - (oldChangeEnd - oldChangeStart);

    return currentRubies
      .filter((ruby) => ruby.end <= oldChangeStart || ruby.start >= oldChangeEnd)
      .map((ruby) => {
        if (ruby.start >= oldChangeEnd) {
          return {
            ...ruby,
            start: ruby.start + delta,
            end: ruby.end + delta,
          };
        }

        return ruby;
      })
      .filter((ruby) => ruby.start >= 0 && ruby.end <= newText.length);
  }

  type RubyTextTarget = Pick<Bubble, "text" | "rubies">;

  function clearRubySelection() {
    setBubbleRubySelectionPreview("");
    setBubbleRubySelectionRange(null);
    setBubbleRubyText("");
    setIsRubyFocused(false);
  }

  function updateRubySelectionFromTextarea(
    textarea: HTMLTextAreaElement,
    target: RubyTextTarget
  ) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      clearRubySelection();
      return;
    }

    setBubbleRubySelectionPreview(target.text.slice(start, end));
    setBubbleRubySelectionRange({ start, end });

    const matchedRuby = normalizeRubies(target.rubies, target.text.length).find(
      (ruby) => ruby.start === start && ruby.end === end
    );

    setBubbleRubyText(matchedRuby?.text ?? "");
  }


  function buildNextRubies(target: RubyTextTarget) {
    const range = bubbleRubySelectionRange;
    if (!range) return null;

    const start = range.start;
    const end = range.end;
    if (start === end || end > target.text.length) return null;

    const nextRubyText = bubbleRubyText.trim();
    const currentRubies = normalizeRubies(target.rubies, target.text.length);

    const rubiesWithoutSelectedRange = currentRubies.filter((ruby) => {
      return ruby.end <= start || ruby.start >= end;
    });

    if (nextRubyText === "") {
      return rubiesWithoutSelectedRange;
    }

    return [
      ...rubiesWithoutSelectedRange,
      {
        start,
        end,
        text: nextRubyText,
      },
    ].sort((a, b) => a.start - b.start);
  }

  function applyBubbleRuby(bubbleId: number) {
    updateBubble(bubbleId, (bubble) => {
      const nextRubies = buildNextRubies(bubble);
      if (!nextRubies) return bubble;

      return {
        ...bubble,
        rubies: nextRubies,
      };
    });
  }


  function renderTextWithRubies(
    text: string,
    rubies: Bubble["rubies"] | undefined,
    rubyTextStyle?: React.CSSProperties,
    baseTextStyle?: React.CSSProperties
  ) {
    const normalized = normalizeRubies(rubies, text.length);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    normalized.forEach((ruby, index) => {
      if (cursor < ruby.start) {
        nodes.push(text.slice(cursor, ruby.start));
      }

      nodes.push(
        <ruby key={`ruby-${index}`}>
          <span style={baseTextStyle}>{text.slice(ruby.start, ruby.end)}</span>
          <rt style={rubyTextStyle}>{ruby.text}</rt>
        </ruby>
      );

      cursor = ruby.end;
    });

    if (cursor < text.length) {
      nodes.push(text.slice(cursor));
    }

    return nodes;
  }

  useEffect(() => {
    setPages((prev) =>
      sanitizeProjectPagesForState(prev).map((page, index, allPages) => {
        if (isSpecialCoverPageIdValue(page.id)) {
          return {
            ...page,
            visible: page.visible ?? true,
          };
        }

        return {
          ...page,
          visible: page.visible ?? true,
          frames: ensureInnerLockedFrame(page.frames).map((frame) =>
            isInnerLockedFrame(frame)
              ? frame
              : {
                  ...frame,
                  borderEnabled: frame.borderEnabled ?? true,
                }
          ),
        };
      })
    );
  }, []);

  const currentPage =
    currentPageId == null || (!hasCovers && isSpecialCoverPageIdValue(currentPageId))
      ? null
      : pages.find((p) => p.id === currentPageId) ?? null;

  useEffect(() => {
    const resolvedPageId = resolveVisibleCurrentPageId(currentPageId, pages, hasCovers);

    if (resolvedPageId === currentPageId) return;

    setCurrentPageId(resolvedPageId);
    setSelectedPageIds([]);
    setSelectedItems([]);
    setSelectedFrameImageCardId(null);
    setTrimmingFrameId(null);
    setActiveTargetType("canvas");
    lastSelectedPageIdRef.current = null;
  }, [pages, hasCovers, currentPageId]);

  useEffect(() => {
    if (trimmingFrameId == null) return;

    const frame = currentPage?.frames.find((item) => item.id === trimmingFrameId);
    if (hasFrameImage(frame)) return;

    setTrimmingFrameId(null);
  }, [currentPage, trimmingFrameId]);

  useEffect(() => {
    return () => {
      if (frameImageScaleIndicatorTimerRef.current == null) return;

      window.clearTimeout(frameImageScaleIndicatorTimerRef.current);
      frameImageScaleIndicatorTimerRef.current = null;
    };
  }, []);

  const pageListEntries = pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => hasCovers || !isSpecialCoverPageIdValue(page.id));

  const contentPageCount = pages.filter(
    (page) => !isSpecialCoverPageIdValue(page.id)
  ).length;

  const visiblePages = pages.filter((page, index) =>
    (hasCovers || !isSpecialCoverPageIdValue(page.id)) &&
    page.visible !== false
  );
  const exportablePages = visiblePages;

  const getThumbnailPageLabel = (pageId: number): number | string | null => {
    const visibleIndex = visiblePages.findIndex((page) => page.id === pageId);
    if (visibleIndex < 0) return null;

    if (isCoverPageIdValue(pageId)) return t("cover");
    if (isBackCoverPageIdValue(pageId)) return t("backCover");

    return visiblePages
      .slice(0, visibleIndex + 1)
      .filter((page) => !isSpecialCoverPageIdValue(page.id)).length;
  };

  const getCanvasPageNumber = (pageId: number): number | null => {
    const visibleIndex = visiblePages.findIndex((page) => page.id === pageId);
    if (visibleIndex < 0) return null;

    if (isSpecialCoverPageIdValue(pageId)) return null;

    return visiblePages
      .slice(0, visibleIndex + 1)
      .filter((page) => !isSpecialCoverPageIdValue(page.id)).length;
  };

  const selectedCount = selectedItems.length;
  const isMultiSelected = selectedCount > 1;
  const isSingleSelected = selectedCount === 1;

  const primarySelectedItem =
    selectedItems.length > 0 ? selectedItems[selectedItems.length - 1] : null;

  const selectedFrameIds = sanitizeSelectedItems(selectedItems)
    .filter((item): item is Extract<SelectedItem, { kind: "frame" }> => item.kind === "frame")
    .map((item) => item.id);

  const selectedBubbleIds = selectedItems
    .filter((item): item is Extract<SelectedItem, { kind: "bubble" }> => item.kind === "bubble")
    .map((item) => item.id);

  const selectedSoundIds = selectedItems
    .filter((item): item is Extract<SelectedItem, { kind: "sound" }> => item.kind === "sound")
    .map((item) => item.id);

  const selectedMovableItems = sanitizeSelectedItems(selectedItems);;
    
  const selectedFrame =
    isSingleSelected && primarySelectedItem?.kind === "frame"
      ? currentPage?.frames.find((f) => f.id === primarySelectedItem.id) ?? null
      : null;

  const selectedFrameWithImage = hasFrameImage(selectedFrame)
    ? selectedFrame
    : null;
  const selectedFrameImageSrc = getFrameImageSrc(selectedFrame);
  const selectedFrameHasImage = !!selectedFrameImageSrc;
  const selectedFrameIsProtectedCoverBase = isProtectedCoverBaseFrame(currentPage, selectedFrame);

  const selectedBubble =
    isSingleSelected && primarySelectedItem?.kind === "bubble"
      ? currentPage?.bubbles.find((b) => b.id === primarySelectedItem.id) ?? null
      : null;

  const selectedSound =
    isSingleSelected && primarySelectedItem?.kind === "sound"
      ? currentPage?.sounds.find((s) => s.id === primarySelectedItem.id) ?? null
      : null;

  const selectedEditorDefaultSectionKey = selectedFrame
    ? selectedFrameHasImage
      ? "frame-image-move-copy"
      : "frame-image-add-delete"
    : selectedBubble
    ? "bubble-text"
    : selectedSound
    ? "sound-text"
    : null;

  const selectedEditorTargetSignature = selectedFrame
    ? `frame:${selectedFrame.id}:${selectedFrameHasImage ? "image" : "empty"}`
    : selectedBubble
    ? `bubble:${selectedBubble.id}`
    : selectedSound
    ? `sound:${selectedSound.id}`
    : null;

  useEffect(() => {
    if (!selectedEditorTargetSignature || !selectedEditorDefaultSectionKey) return;

    setOpenEditorSectionKey(selectedEditorDefaultSectionKey);
  }, [selectedEditorTargetSignature, selectedEditorDefaultSectionKey]);

  useEffect(() => {
    const handleDocumentMouseUp = () => {
      const textarea = bubbleTextEditorRef.current;
      if (!textarea || !selectedBubble) return;
      if (focusedTextEditor !== "bubble" && document.activeElement !== textarea) return;

      updateRubySelectionFromTextarea(textarea, selectedBubble);
    };

    document.addEventListener("mouseup", handleDocumentMouseUp);

    return () => {
      document.removeEventListener("mouseup", handleDocumentMouseUp);
    };
  }, [focusedTextEditor, selectedBubble]);

  useEffect(() => {
    if (selectedBubble) {
      setBubbleFontSizeInput(String(selectedBubble.fontSize));
    }
  }, [selectedBubble?.id, selectedBubble?.fontSize]);

  useEffect(() => {
    if (openEditorSectionKey !== "bubble-text") {
      clearRubySelection();
    }
  }, [openEditorSectionKey]);

  useEffect(() => {
    clearRubySelection();
  }, [selectedBubble?.id]);

  useEffect(() => {
    if (selectedSound) {
      setSoundFontSizeInput(String(selectedSound.fontSize));
    }
  }, [selectedSound?.id, selectedSound?.fontSize]);

  useEffect(() => {
    if (selectedFrameImageCardId == null) return;

    const frame = currentPage?.frames.find((f) => f.id === selectedFrameImageCardId);

    if (!hasFrameImage(frame)) {
      setSelectedFrameImageCardId(null);
      stopImageMoveRepeat();
      imageMoveKeyboardKeyRef.current = null;
    }
  }, [currentPage, selectedFrameImageCardId]);

  useEffect(() => {
    const activeImagePositionFrameId = trimmingFrameId ?? selectedFrameImageCardId;
    if (activeImagePositionFrameId == null) return;

    const closeImagePositionMode = () => {
      setSelectedFrameImageCardId(null);
      setTrimmingFrameId(null);
      stopImageMoveRepeat();
      imageMoveKeyboardKeyRef.current = null;
    };

    const handlePointerDownCapture = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const keepArea = target.closest<HTMLElement>(
        '[data-image-position-keep="true"], [data-frame-image-position-keep-id]'
      );

      if (keepArea) {
        const keepFrameId =
          keepArea.dataset.imagePositionKeepFrameId ??
          keepArea.dataset.frameImagePositionKeepId;

        if (!keepFrameId || keepFrameId === String(activeImagePositionFrameId)) {
          return;
        }

        closeImagePositionMode();
        return;
      }

      const clickedFrameElement = target.closest<HTMLElement>(
        '[data-canvas-object-type="frame"][data-canvas-object-id], [data-frame-id]'
      );
      const clickedFrameIdValue =
        clickedFrameElement?.dataset.canvasObjectId ??
        clickedFrameElement?.dataset.frameId;
      const clickedFrameId =
        clickedFrameIdValue == null ? null : Number(clickedFrameIdValue);

      if (clickedFrameId === activeImagePositionFrameId) {
        return;
      }

      closeImagePositionMode();
    };

    window.addEventListener("pointerdown", handlePointerDownCapture, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDownCapture, true);
    };
  }, [selectedFrameImageCardId, trimmingFrameId]);

  useEffect(() => {
    const frame =
      selectedFrameImageCardId == null
        ? null
        : currentPage?.frames.find((f) => f.id === selectedFrameImageCardId) ?? null;

    const shouldUseImagePosition =
      openEditorSectionKey === "frame-image-move-copy" && hasFrameImage(frame);

    if (shouldUseImagePosition) {
      setTrimmingFrameId((current) =>
        current === selectedFrameImageCardId ? current : selectedFrameImageCardId
      );
      return;
    }

    setTrimmingFrameId((current) =>
      current === selectedFrameImageCardId || selectedFrameImageCardId == null
        ? null
        : current
    );
  }, [currentPage, openEditorSectionKey, selectedFrameImageCardId]);

  const selectedFrameScaleMetrics = selectedFrameWithImage
    ? getFrameImageMetrics(selectedFrameWithImage)
    : null;

  const selectedFrameScalePercent = selectedFrameScaleMetrics
    ? Math.round(selectedFrameScaleMetrics.actualScale * 100)
    : null;

  const selectedFrameScaleMinPercent = selectedFrameScaleMetrics
    ? Math.round(selectedFrameScaleMetrics.baseScale * 100)
    : 100;

  const selectedFrameScaleMaxPercent = selectedFrameScaleMetrics
    ? Math.round(selectedFrameScaleMetrics.baseScale * 4 * 100)
    : 400;

  const convertFrameImageScalePercentToScale = (
    frame: Frame,
    scalePercent: number
  ) => {
    const metrics = getFrameImageMetrics(frame);
    const safeBaseScale = Math.max(metrics.baseScale, 0.000001);

    return clamp(Number((scalePercent / 100 / safeBaseScale).toFixed(4)), 1, 4);
  };

  useEffect(() => {
    const style = document.createElement("style");

    style.textContent = `
      .mansaku-range-slider:focus {
        outline: 2px solid #111827;
        outline-offset: 3px;
        border-radius: 999px;
      }

      .mansaku-slider-value-button {
        transform: translateY(0);
        transition: background 0.12s ease, transform 50ms ease !important;
      }

      .mansaku-slider-value-button:hover {
        background: #e5e7eb !important;
      }

      .mansaku-slider-value-button:active {
        transform: translateY(1px) !important;
      }
    `;

    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  function clearSliderWheelHistoryTimeout(snapshot: { timeoutId: number | null }) {
    if (snapshot.timeoutId != null) {
      window.clearTimeout(snapshot.timeoutId);
    }
  }

  function commitSliderWheelHistory() {
    const snapshot = sliderWheelHistoryRef.current;
    if (!snapshot) return false;

    clearSliderWheelHistoryTimeout(snapshot);
    sliderWheelHistoryRef.current = null;

    if (!snapshot.changed) return false;

    setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(snapshot.pages)));
    setRedoStack([]);
    return true;
  }

  function undoPendingSliderWheelHistory() {
    const snapshot = sliderWheelHistoryRef.current;
    if (!snapshot) return false;

    clearSliderWheelHistoryTimeout(snapshot);
    sliderWheelHistoryRef.current = null;

    if (!snapshot.changed) return false;

    const currentPages = clonePages(pagesRef.current);

    setRedoStack((stack) => [createHistorySnapshot(currentPages), ...stack]);
    setPages(sanitizeProjectPagesForState(clonePages(snapshot.pages)));
    setHasUnsavedChanges(true);
    return true;
  }


  function prepareSliderWheelHistory(
    targetKind: "bubbleTone" | "frameImageScale" | "frameEffectLine",
    targetId: number
  ) {
    const current = sliderWheelHistoryRef.current;

    if (
      current &&
      current.targetKind === targetKind &&
      current.targetId === targetId
    ) {
      return;
    }

    commitSliderWheelHistory();

    sliderWheelHistoryRef.current = {
      pages: clonePages(pagesRef.current),
      targetKind,
      targetId,
      changed: false,
      timeoutId: null,
    };
  }

  function markSliderWheelHistoryChanged() {
    const snapshot = sliderWheelHistoryRef.current;
    if (!snapshot) return;

    snapshot.changed = true;

    if (snapshot.timeoutId != null) {
      window.clearTimeout(snapshot.timeoutId);
    }

    snapshot.timeoutId = window.setTimeout(() => {
      commitSliderWheelHistory();
    }, 320);
  }

  function beginFrameEffectLineSliderHistory(frameIds: number[]) {
    frameEffectLineSliderHistoryRef.current = {
      pages: clonePages(pagesRef.current),
      frameIds: [...frameIds],
      changed: false,
    };
  }

  function markFrameEffectLineSliderHistoryChanged() {
    const snapshot = frameEffectLineSliderHistoryRef.current;
    if (!snapshot) return;
    snapshot.changed = true;
  }

  function commitFrameEffectLineSliderHistory() {
    const snapshot = frameEffectLineSliderHistoryRef.current;
    frameEffectLineSliderHistoryRef.current = null;

    if (!snapshot?.changed) return;

    setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(snapshot.pages)));
    setRedoStack([]);
  }

  function cancelFrameEffectLineSliderHistory() {
    frameEffectLineSliderHistoryRef.current = null;
  }

  useEffect(() => {
    const handleFocusedSliderWheel = (e: WheelEvent) => {
      const sliderElement = e.target;

      if (!(sliderElement instanceof HTMLInputElement)) return;
      if (sliderElement.type !== "range") return;
      if (!sliderElement.classList.contains("mansaku-range-slider")) return;

      e.preventDefault();
      e.stopPropagation();
      sliderElement.focus({ preventScroll: true });

      const direction = e.deltaY < 0 ? 1 : -1;

      switch (sliderElement.id) {
        case "mansaku-slider-preview-scale": {
          setPreviewScale((prev) => clamp(prev + direction * 5, 25, 200));
          return;
        }

        case "mansaku-slider-bubble-background-tone": {
          if (!selectedBubble) return;

          const step = e.shiftKey ? 5 : 1;
          const toneMode = getBubbleBackgroundToneMode(selectedBubble);
          const currentValue =
            toneMode === "white"
              ? selectedBubble.whiteTone ?? 100
              : toneMode === "black"
                ? selectedBubble.blackTone ?? 100
                : getFreeBubbleTone(selectedBubble);
          const nextValue = clamp(currentValue + direction * step, 0, 100);

          if (nextValue === currentValue) {
            return;
          }

          prepareSliderWheelHistory("bubbleTone", selectedBubble.id);

          updateBubble(
            selectedBubble.id,
            (b) => {
              if (toneMode === "white") return withWhiteBubbleTone(b, nextValue);
              if (toneMode === "black") return withBlackBubbleTone(b, nextValue);

              return withFreeBubbleBackgroundColor(
                b,
                getFreeBubbleBackgroundColor(b),
                { freeBubbleTone: nextValue }
              );
            },
            { recordHistory: false }
          );

          markSliderWheelHistoryChanged();

          return;
        }

        case "mansaku-slider-frame-image-scale": {
          if (!selectedFrame || !hasFrameImage(selectedFrame)) return;

          const metrics = getFrameImageMetrics(selectedFrame);
          const stepPercent = e.shiftKey ? 1 : 10;
          const currentPercent = Math.round(metrics.actualScale * 100);
          const minPercent = Math.round(metrics.baseScale * 100);
          const maxPercent = Math.round(metrics.baseScale * 4 * 100);
          const nextPercent = clamp(
            currentPercent + direction * stepPercent,
            minPercent,
            maxPercent
          );
          const nextScale = convertFrameImageScalePercentToScale(
            selectedFrame,
            nextPercent
          );

          if (nextScale === selectedFrame.imageScale) return;

          prepareSliderWheelHistory("frameImageScale", selectedFrame.id);

          changeFrameImageScaleDirect(selectedFrame.id, nextScale, {
            recordHistory: false,
          });

          markSliderWheelHistoryChanged();

          return;
        }
      }
    };

    window.addEventListener("wheel", handleFocusedSliderWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener("wheel", handleFocusedSliderWheel, {
        capture: true,
      } as AddEventListenerOptions);
    };
  }, [
    selectedBubble?.id,
    selectedBubble?.whiteTone,
    selectedBubble?.blackTone,
    selectedBubble ? getFreeBubbleTone(selectedBubble) : null,
    selectedBubble ? getFreeBubbleBackgroundColor(selectedBubble) : null,
    selectedBubble ? isFreeBubbleBackgroundColorMode(selectedBubble) : false,
    selectedFrame?.id,
    selectedFrame?.imageScale,
  ]);

  const showMainFloatingEditorPanel =
    pages.length > 0 &&
    (
      !!selectedBubble ||
      !!selectedSound ||
      !!selectedFrame
    );

useLayoutEffect(() => {
  if (!showMainFloatingEditorPanel) return;

  requestAnimationFrame(() => {
    if (editorPanelScrollRef.current) {
      editorPanelScrollRef.current.scrollTop = 0;
    }
  });
}, [
  selectedBubble?.id,
  selectedSound?.id,
  selectedFrame?.id,
  showMainFloatingEditorPanel,
]);

useLayoutEffect(() => {
  const wasOpen = wasEditorPanelOpenRef.current;
  wasEditorPanelOpenRef.current = showMainFloatingEditorPanel;

  if (!wasOpen || showMainFloatingEditorPanel) return;

  setOpenEditorSectionKey(null);

  requestAnimationFrame(() => {
    currentPageCardRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  });
}, [showMainFloatingEditorPanel, currentPageId]);

  const imageMoveRepeatTimeoutRef = useRef<number | null>(null);
  const imageMoveRepeatIntervalRef = useRef<number | null>(null);
  const imageMoveKeyboardKeyRef = useRef<string | null>(null);

  const imageMoveRepeatHistoryPushedRef = useRef(false);
  const pageMoveRepeatHistoryPushedRef = useRef(false);
  const dragHistoryPushedRef = useRef(false);

  const resetFontSizeInputHistory = () => {
    fontSizeInputHistoryRef.current = null;
  };

  const beginFontSizeInputHistory = (
    targetKind: "bubble" | "sound",
    targetId: number
  ) => {
    const current = fontSizeInputHistoryRef.current;

    if (
      current &&
      current.targetKind === targetKind &&
      current.targetId === targetId
    ) {
      return;
    }

    const snapshot = clonePages(pages);

    fontSizeInputHistoryRef.current = {
      pages: snapshot,
      targetKind,
      targetId,
    };

    setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(snapshot)));
    setRedoStack([]);
  };

  const pendingSingleSelectOnMouseUpRef = useRef<{
    item: SelectedItem;
    startMouseX: number;
    startMouseY: number;
  } | null>(null);

  const setPendingSingleSelectOnMouseUp = (
    item: SelectedItem,
    e: MouseEvent | React.MouseEvent
  ) => {
    pendingSingleSelectOnMouseUpRef.current = {
      item,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    };
  };

  const stopImageMoveRepeat = () => {
    if (imageMoveRepeatTimeoutRef.current !== null) {
      window.clearTimeout(imageMoveRepeatTimeoutRef.current);
      imageMoveRepeatTimeoutRef.current = null;
    }

    if (imageMoveRepeatIntervalRef.current !== null) {
      window.clearInterval(imageMoveRepeatIntervalRef.current);
      imageMoveRepeatIntervalRef.current = null;
    }

    imageMoveRepeatHistoryPushedRef.current = false;
  };

  const stopPageMoveRepeat = () => {
    if (pageMoveRepeatTimeoutRef.current !== null) {
      window.clearTimeout(pageMoveRepeatTimeoutRef.current);
      pageMoveRepeatTimeoutRef.current = null;
    }

    if (pageMoveRepeatIntervalRef.current !== null) {
      window.clearInterval(pageMoveRepeatIntervalRef.current);
      pageMoveRepeatIntervalRef.current = null;
    }

    pageMoveRepeatHistoryPushedRef.current = false;
  };

  const startImageMoveRepeat = (frameId: number, dx: number, dy: number) => {
    stopImageMoveRepeat();

    if (!selectedFrameIds.includes(frameId)) {
      selectFrame(frameId);
    }

    const ensureImageMoveHistory = () => {
      if (!imageMoveRepeatHistoryPushedRef.current) {
        pushHistorySnapshot();
        imageMoveRepeatHistoryPushedRef.current = true;
      }
    };

    ensureImageMoveHistory();
    moveFrameImage(frameId, dx, dy, { recordHistory: false });

    imageMoveRepeatTimeoutRef.current = window.setTimeout(() => {
      imageMoveRepeatIntervalRef.current = window.setInterval(() => {
        ensureImageMoveHistory();
        moveFrameImage(frameId, dx, dy, { recordHistory: false });
      }, 40);
    }, 250);
  };

  const startFrameImageMoveByDirection = (
    frameId: number,
    direction: "up" | "down" | "left" | "right",
    step: number
  ) => {
    const deltaMap = {
      up: { dx: 0, dy: -step },
      down: { dx: 0, dy: step },
      left: { dx: -step, dy: 0 },
      right: { dx: step, dy: 0 },
    } as const;

    const delta = deltaMap[direction];
    startImageMoveRepeat(frameId, delta.dx, delta.dy);
  };

  useEffect(() => {
    const stopKeyboardImageMove = () => {
      if (imageMoveKeyboardKeyRef.current == null) return;

      imageMoveKeyboardKeyRef.current = null;
      stopImageMoveRepeat();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (
        key !== "arrowleft" &&
        key !== "arrowup" &&
        key !== "arrowright" &&
        key !== "arrowdown" &&
        key !== "shift"
      ) {
        return;
      }

      stopKeyboardImageMove();
    };

    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", stopKeyboardImageMove, true);

    return () => {
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", stopKeyboardImageMove, true);
    };
  }, []);

  useEffect(() => {
    if (selectedFrameImageCardId == null) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-frame-image-card='true']")) return;

      const selectedFrameKeepTarget = target?.closest(
        `[data-frame-image-position-keep-id="${selectedFrameImageCardId}"]`
      );

      if (selectedFrameKeepTarget) {
        keepFrameImageCardSelectedByCanvasPointerRef.current = true;
        return;
      }

      setSelectedFrameImageCardId(null);
      imageMoveKeyboardKeyRef.current = null;
      stopImageMoveRepeat();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [selectedFrameImageCardId]);

  useEffect(() => {
    const handleFrameImageCardTabAway = () => {
      setSelectedFrameImageCardId(null);
      imageMoveKeyboardKeyRef.current = null;
      stopImageMoveRepeat();
    };

    window.addEventListener(
      "mansaku-frame-image-card-tab-away",
      handleFrameImageCardTabAway
    );

    return () => {
      window.removeEventListener(
        "mansaku-frame-image-card-tab-away",
        handleFrameImageCardTabAway
      );
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;

      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);  

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      stopImageMoveRepeat();
      stopPageMoveRepeat();
      if (selectionBox && currentPage) {
        const minX = Math.min(selectionBox.startX, selectionBox.currentX);
        const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
        const minY = Math.min(selectionBox.startY, selectionBox.currentY);
        const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

        const nextSelectedItems: SelectedItem[] = [];

        const overlapsRect = (x: number, y: number, w: number, h: number) => {
          return !(x + w < minX || x > maxX || y + h < minY || y > maxY);
        };

        const containsPoint = (x: number, y: number) => {
          return x >= minX && x <= maxX && y >= minY && y <= maxY;
        };

        currentPage.frames.forEach((frame) => {
          if (overlapsRect(frame.x, frame.y, frame.w, frame.h)) {
            nextSelectedItems.push({ kind: "frame", id: frame.id });
          }
        });

        currentPage.bubbles.forEach((bubble) => {
          if (overlapsRect(bubble.x, bubble.y, bubble.w, bubble.h)) {
            nextSelectedItems.push({ kind: "bubble", id: bubble.id });
          }
        });

        currentPage.sounds.forEach((sound) => {
          if (containsPoint(sound.x, sound.y)) {
            nextSelectedItems.push({ kind: "sound", id: sound.id });
          }
        });

        if (nextSelectedItems.length > 0) {
          setActiveTargetType("canvas");
        }

        setSelectedItems((prev) => {
          if (!selectionBox.additive) {
            return sanitizeSelectedItems(nextSelectedItems);
          }

          const merged = [...prev];

          nextSelectedItems.forEach((item) => {
            const exists = merged.some(
              (prevItem) => prevItem.kind === item.kind && prevItem.id === item.id
            );

            if (!exists) {
              merged.push(item);
            }
          });

          return sanitizeSelectedItems(merged);
        });

        setSelectionBox(null);
      }

      const pendingSingleSelect = pendingSingleSelectOnMouseUpRef.current;

      if (pendingSingleSelect) {
        const dx = e.clientX - pendingSingleSelect.startMouseX;
        const dy = e.clientY - pendingSingleSelect.startMouseY;
        const moved = Math.hypot(dx, dy) >= 3;

        if (!moved) {
          setActiveTargetType("canvas");
          setSelectedItems(sanitizeSelectedItems([pendingSingleSelect.item]));
        }
      }

      commitDragCopyGhost(dragState, e.ctrlKey || e.metaKey);

      pendingSingleSelectOnMouseUpRef.current = null;
      frameHandleInteractionLockRef.current = null;
      dragHistoryPushedRef.current = false;
      setDragState(null);
      setIsDragCopyPreviewVisible(false);
      setSnapGuideLines([]);
      setBubbleTailWidthDragCursor(null);
    };

    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [currentPage, selectionBox, dragState]);
      
  const applyPagesChange = (
    updater: Page[] | ((prev: Page[]) => Page[]),
    options?: { recordHistory?: boolean }
  ) => {
    const prevPages = clonePages(pagesRef.current);

    const rawNextPages =
      typeof updater === "function"
        ? (updater as (prev: Page[]) => Page[])(clonePages(prevPages))
        : clonePages(updater);

    const nextPages = sanitizeProjectPagesForState(rawNextPages);

    if (options?.recordHistory !== false) {
      setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(prevPages)));
      setRedoStack([]);
    }

    setPages(nextPages);
    setHasUnsavedChanges(true);
  };

  const updateCurrentPage = (
    updater: (page: Page) => Page,
    options?: { recordHistory?: boolean }
  ) => {
    applyPagesChange(
      (prev) =>
        prev.map((page) => (page.id === currentPageId ? updater(page) : page)),
      { recordHistory: options?.recordHistory ?? true }
    );
  };

  const getPageRect = () => pageRef.current?.getBoundingClientRect();

  const getPagePercentPointFromMouse = (
    e: MouseEvent | React.MouseEvent
  ) => {
    const rect = getPageRect();
    if (!rect) return null;

    return {
      xPercent: ((e.clientX - rect.left) / rect.width) * 100,
      yPercent: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const buildDragItemsFromSelection = (
    effectiveSelection: SelectedItem[],
    page: Page
  ) => {
    const frameItems = getEditableFrames(page.frames)
      .filter(
        (frame) =>
          !isProtectedCoverBaseFrame(page, frame) &&
          effectiveSelection.some(
            (item) => item.kind === "frame" && item.id === frame.id
          )
      )
      .map((frame) => ({
        kind: "frame" as const,
        id: frame.id,
        startX: frame.x,
        startY: frame.y,
        startPoints: getFrameAbsolutePoints(frame),
      }));

    const bubbleItems = page.bubbles
      .filter((bubble) =>
        effectiveSelection.some(
          (item) => item.kind === "bubble" && item.id === bubble.id
        )
      )
      .map((bubble) => ({
        kind: "bubble" as const,
        id: bubble.id,
        startX: bubble.x,
        startY: bubble.y,
      }));

    const soundItems = page.sounds
      .filter((sound) =>
        effectiveSelection.some(
          (item) => item.kind === "sound" && item.id === sound.id
        )
      )
      .map((sound) => ({
        kind: "sound" as const,
        id: sound.id,
        startX: sound.x,
        startY: sound.y,
      }));

    return [...frameItems, ...bubbleItems, ...soundItems];
  };

  const buildDragCopyGhostFromSelection = (
    effectiveSelection: SelectedItem[],
    page: Page
  ) => {
    const selection = sanitizeSelectedItems(effectiveSelection);

    return {
      frames: getEditableFrames(page.frames)
        .filter(
          (frame) =>
            !isProtectedCoverBaseFrame(page, frame) &&
            selection.some((item) => item.kind === "frame" && item.id === frame.id)
        )
        .map((frame) => structuredClone(frame)),
      bubbles: page.bubbles
        .filter((bubble) =>
          selection.some((item) => item.kind === "bubble" && item.id === bubble.id)
        )
        .map((bubble) => structuredClone(bubble)),
      sounds: page.sounds
        .filter((sound) =>
          selection.some((item) => item.kind === "sound" && item.id === sound.id)
        )
        .map((sound) => structuredClone(sound)),
    };
  };

  const commitDragCopyGhost = (
    sourceDragState: DragState,
    copyRequested: boolean
  ) => {
    if (!copyRequested || !sourceDragState) return;

    if (
      sourceDragState.kind !== "multi-move" &&
      sourceDragState.kind !== "bubble-move" &&
      sourceDragState.kind !== "sound-move"
    ) {
      return;
    }

    if (!sourceDragState.hasMoved || !sourceDragState.copyGhost) return;

    const copyGhost = sourceDragState.copyGhost;

    if (
      copyGhost.frames.length === 0 &&
      copyGhost.bubbles.length === 0 &&
      copyGhost.sounds.length === 0
    ) {
      return;
    }

    const baseId = Date.now();
    let seq = 0;
    const nextId = () => baseId + seq++;

    applyPagesChange(
      (prev) =>
        prev.map((page) => {
          if (page.id !== currentPageId) return page;

          const bubbleLayerStart = getNextBubbleLayer(page);
          const soundLayerStart = getNextSoundLayer(page);

          const copiedFrames = copyGhost.frames.map((frame) => ({
            ...structuredClone(frame),
            id: nextId(),
          }));

          const copiedBubbles = copyGhost.bubbles.map((bubble, index) => ({
            ...structuredClone(bubble),
            id: nextId(),
            layer: bubbleLayerStart + index,
          }));

          const copiedSounds = copyGhost.sounds.map((sound, index) => ({
            ...structuredClone(sound),
            id: nextId(),
            layer: soundLayerStart + index,
          }));

          return {
            ...page,
            frames: isSpecialCoverPageIdValue(page.id)
              ? [...page.frames, ...copiedFrames]
              : ensureInnerLockedFrame([...page.frames, ...copiedFrames]),
            bubbles: [...page.bubbles, ...copiedBubbles],
            sounds: [...page.sounds, ...copiedSounds],
          };
        }),
      { recordHistory: false }
    );
  };

  const toggleSelectedItem = (
    item: SelectedItem,
    options?: { additive?: boolean }
  ) => {
    const shouldKeepFrameImageCardSelected =
      item.kind === "frame" &&
      selectedFrameImageCardId === item.id &&
      !options?.additive;

    if (!shouldKeepFrameImageCardSelected) {
      setSelectedFrameImageCardId(null);
    }

    clearRubySelection();
    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    focusCanvasTrap();
    setActiveTargetType("canvas");

    if (item.kind === "frame" && isInnerLockedFrameId(item.id)) {
      setSelectedItems((prev) => sanitizeSelectedItems(prev));
      return;
    }

    setSelectedItems((prev) => {
      const safePrev = sanitizeSelectedItems(prev);

      if (!options?.additive) {
        return sanitizeSelectedItems([item]);
      }

      const exists = safePrev.some(
        (x) => x.kind === item.kind && x.id === item.id
      );

      if (exists) {
        return safePrev.filter(
          (x) => !(x.kind === item.kind && x.id === item.id)
        );
      }

      return sanitizeSelectedItems([...safePrev, item]);
    });
  };

  const selectFrame = (
    frameId: number,
    options?: { additive?: boolean }
  ) => {
    if (frameId === INNER_LOCKED_FRAME_ID) return;

    toggleSelectedItem({ kind: "frame", id: frameId }, options);
  };

  const activateImagePositionFrameFromEditor = (frameId: number) => {
    if (frameId === INNER_LOCKED_FRAME_ID) return;

    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    closeTopToolbarMenus();
    clearRubySelection();

    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setSelectedItems([{ kind: "frame", id: frameId }]);
    setHoverFrameGuideId(frameId);
    setOpenEditorSectionKey("frame-image-move-copy");
    setSelectedFrameImageCardId(frameId);
    setTrimmingFrameId(frameId);

    // 画像カードの onFocus / onClick から呼ばれるため、ここではメインへフォーカスを奪い返さない。
    // メインへ戻す必要がある操作は、呼び出し元で明示的に focusCanvasTrap する。
  };

  const activateFrameEffectLineFromEditor = (frameId: number) => {
    if (frameId === INNER_LOCKED_FRAME_ID) return;

    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    closeTopToolbarMenus();
    clearRubySelection();

    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setSelectedItems([{ kind: "frame", id: frameId }]);
    setSelectedFrameImageCardId(null);
    setTrimmingFrameId(null);
    setHoverFrameGuideId(frameId);
    setOpenEditorSectionKey("frame-effect-line");
  };

  const updateFrameEffectLineDirect = (
    frameId: number,
    patch:
      | Partial<ReturnType<typeof getFrameEffectLineFields>>
      | ((current: ReturnType<typeof getFrameEffectLineFields>) => Partial<ReturnType<typeof getFrameEffectLineFields>>),
    options?: { recordHistory?: boolean }
  ) => {
    updateCurrentPage(
      (page) => ({
        ...page,
        frames: page.frames.map((frame) => {
          if (frame.id !== frameId) return frame;

          const current = getFrameEffectLineFields(frame);
          const nextPatch =
            typeof patch === "function" ? patch(current) : patch;

          return {
            ...frame,
            effectLineEnabled: nextPatch.enabled ?? current.enabled,
            effectLineKind: nextPatch.kind ?? current.kind,
            effectLineColorMode: nextPatch.colorMode ?? current.colorMode,
            effectLineCustomColor: nextPatch.customColor ?? current.customColor,
            effectLineStrokeWidth: nextPatch.strokeWidth ?? current.strokeWidth,
            effectLineDensity: nextPatch.density ?? current.density,
            effectLineInnerBlank: nextPatch.innerBlank ?? current.innerBlank,
            effectLineCenterX: nextPatch.centerX ?? current.centerX,
            effectLineCenterY: nextPatch.centerY ?? current.centerY,
            effectLineAngle: nextPatch.angle ?? current.angle,
          } as Frame;
        }),
      }),
      { recordHistory: options?.recordHistory ?? true }
    );
  };

  const changeFrameEffectLineInnerBlankByWheel = (
    frameId: number,
    deltaY: number,
    largeStep = true
  ) => {
    const direction = deltaY < 0 ? 1 : -1;
    const step = largeStep ? 4 : 1;

    prepareSliderWheelHistory("frameEffectLine", frameId);

    updateFrameEffectLineDirect(
      frameId,
      (current) => ({
        enabled: true,
        innerBlank: clamp(current.innerBlank + direction * step, 0, 100),
      }),
      { recordHistory: false }
    );

    markSliderWheelHistoryChanged();
  };

  const changeFrameEffectLineDensityByWheel = (
    frameId: number,
    deltaY: number,
    largeStep = true
  ) => {
    const direction = deltaY < 0 ? 1 : -1;
    const step = largeStep ? 4 : 1;

    prepareSliderWheelHistory("frameEffectLine", frameId);

    updateFrameEffectLineDirect(
      frameId,
      (current) => ({
        enabled: true,
        density: clamp(current.density + (direction * step) / 100, 0, 1),
      }),
      { recordHistory: false }
    );

    markSliderWheelHistoryChanged();
  };

  useEffect(() => {
    if (
      focusedWheelSliderId !== "mansaku-slider-frame-effect-line-density" &&
      focusedWheelSliderId !== "mansaku-slider-frame-effect-line-blank"
    ) {
      return;
    }

    const handleFocusedEffectLineSliderWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (openEditorSectionKey !== "frame-effect-line") return;
      if (selectedFrameIds.length !== 1) return;

      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement?.id !== focusedWheelSliderId) return;

      e.preventDefault();
      e.stopPropagation();

      const frameId = selectedFrameIds[0];

      if (focusedWheelSliderId === "mansaku-slider-frame-effect-line-density") {
        changeFrameEffectLineDensityByWheel(frameId, e.deltaY, !e.shiftKey);
        return;
      }

      changeFrameEffectLineInnerBlankByWheel(frameId, e.deltaY, !e.shiftKey);
    };

    window.addEventListener("wheel", handleFocusedEffectLineSliderWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener("wheel", handleFocusedEffectLineSliderWheel, {
        capture: true,
      } as AddEventListenerOptions);
    };
  }, [focusedWheelSliderId, openEditorSectionKey, selectedFrameIds]);

  const getFrameEffectLineLocalPointFromMouse = (
    e: MouseEvent | React.MouseEvent,
    frame: Frame
  ) => {
    const pagePoint = getPagePercentPointFromMouse(e);
    if (!pagePoint) return null;

    return {
      x: clamp(((pagePoint.xPercent - frame.x) / Math.max(frame.w, 0.000001)) * 100, 0, 100),
      y: clamp(((pagePoint.yPercent - frame.y) / Math.max(frame.h, 0.000001)) * 100, 0, 100),
    };
  };

  const startFrameEffectLineHandleDrag = (
    e: React.MouseEvent,
    frame: Frame,
    handle: "center" | "blank" | "angle"
  ) => {
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    activateFrameEffectLineFromEditor(frame.id);

    const startPages = clonePages(pagesRef.current);

    const applyFromMouse = (event: MouseEvent | React.MouseEvent) => {
      const local = getFrameEffectLineLocalPointFromMouse(event, frame);
      if (!local) return;

      const current = getFrameEffectLineFields(
        pagesRef.current
          .find((page) => page.id === currentPageId)
          ?.frames.find((item) => item.id === frame.id) ?? frame
      );

      if (handle === "center") {
        const nextCenterX = event.shiftKey
          ? Math.round(local.x / 2.5) * 2.5
          : local.x;

        const nextCenterY = event.shiftKey
          ? Math.round(local.y / 2.5) * 2.5
          : local.y;

        updateFrameEffectLineDirect(
          frame.id,
          {
            enabled: true,
            centerX: clamp(nextCenterX, 0, 100),
            centerY: clamp(nextCenterY, 0, 100),
          },
          { recordHistory: false }
        );
        return;
      }

      if (handle === "blank") {
        const dx = local.x - current.centerX;
        const dy = local.y - current.centerY;
        const distance = Math.hypot(dx, dy);

        updateFrameEffectLineDirect(
          frame.id,
          { enabled: true, innerBlank: clamp(distance, 0, 100) },
          { recordHistory: false }
        );
        return;
      }

      const dx = local.x - current.centerX;
      const dy = local.y - current.centerY;
      const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const snappedAngle = event.shiftKey ? Math.round(rawAngle / 15) * 15 : rawAngle;
      const angle = clamp(snappedAngle, -90, 90);

      updateFrameEffectLineDirect(
        frame.id,
        { enabled: true, angle },
        { recordHistory: false }
      );
    };

    applyFromMouse(e);

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault();
      applyFromMouse(event);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(startPages)));
      setRedoStack([]);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };
  const moveSelectedItemToEnd = (
    items: SelectedItem[],
    target: SelectedItem
  ) => {
    const targetIndex = items.findIndex(
      (item) => item.kind === target.kind && item.id === target.id
    );

    if (targetIndex < 0 || targetIndex === items.length - 1) {
      return items;
    }

    return [
      ...items.slice(0, targetIndex),
      ...items.slice(targetIndex + 1),
      items[targetIndex],
    ];
  };

  const activateSelectedFrameForMultiSelection = (frameId: number) => {
    if (selectedFrameIds.length <= 1) return;

    const lockedFrameId = frameHandleInteractionLockRef.current;
    if (lockedFrameId != null && lockedFrameId !== frameId) return;

    setSelectedItems((prev) => {
      const safePrev = sanitizeSelectedItems(prev);
      const next = moveSelectedItemToEnd(safePrev, { kind: "frame", id: frameId });

      return next === safePrev ? prev : next;
    });
  };

  const activateSelectedFrameGuide = (frameId: number) => {
    if (!selectedFrameIds.includes(frameId)) return;

    const lockedFrameId = frameHandleInteractionLockRef.current;
    if (lockedFrameId != null && lockedFrameId !== frameId) return;

    activateSelectedFrameForMultiSelection(frameId);
    setHoverFrameGuideId(frameId);
  };

  const deactivateSelectedFrameGuide = (frameId: number) => {
    setHoverFrameGuideId((current) => (current === frameId ? null : current));
  };


  const selectBubble = (
    bubbleId: number,
    options?: { additive?: boolean }
  ) => {
    toggleSelectedItem({ kind: "bubble", id: bubbleId }, options);
  };

  const selectSound = (
    soundId: number,
    options?: { additive?: boolean }
  ) => {
    toggleSelectedItem({ kind: "sound", id: soundId }, options);
  };

  const fitSelectedBubbleSizeBeforeLeavingEditor = () => {
    const bubbleId = selectedBubble?.id;
    if (bubbleId == null) return;

    updateCurrentPage(
      (page) => ({
        ...page,
        bubbles: page.bubbles.map((bubble) =>
          bubble.id === bubbleId
            ? fitBubbleSizeToText(bubble, t("bubbleTextPlaceholder"))
            : bubble
        ),
      }),
      { recordHistory: false }
    );
  };

  const clearSelection = () => {
    fitSelectedBubbleSizeBeforeLeavingEditor();
    setSelectedFrameImageCardId(null);
    clearRubySelection();
    setSelectedItems([]);
    setOpenEditorSectionKey(null);
  };

  const clearEditorSelectionAndFocusMain = (options?: { fitBubble?: boolean }) => {
    if (options?.fitBubble !== false) {
      fitSelectedBubbleSizeBeforeLeavingEditor();
    }

    setMainMode("manga");
    setActiveTargetType("canvas");
    setSelectedFrameImageCardId(null);
    clearRubySelection();
    setSelectedItems([]);
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setOpenEditorSectionKey(null);
    setFocusedTextEditor(null);
    setBubbleRubySelectionPreview("");
    setBubbleRubySelectionRange(null);
    setBubbleRubyText("");

    requestAnimationFrame(() => {
      focusTrapRef.current?.focus({ preventScroll: true });
    });
  };

  const clearAllSelectionAndMenus = () => {
    setSelectedFrameImageCardId(null);
    setSelectedItems([]);
    setOpenEditorSectionKey(null);
    const currentPageExists = pagesRef.current.some(
      (page) => page.id === currentPageIdRef.current
    );

    if (currentPageExists && currentPageIdRef.current != null) {
      setSelectedPageIds([currentPageIdRef.current]);
      lastSelectedPageIdRef.current = currentPageIdRef.current;
    } else {
      setSelectedPageIds([]);
      lastSelectedPageIdRef.current = null;
    }

    setSelectionBox(null);
    setActiveTargetType("page");

    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();

    setTemplateContextMenu({
      visible: false,
      x: 0,
      y: 0,
      templateId: null,
      key: 0,
    });

    setStickySubmenuKey(null);
    setIsMenuOpen(false);
    setFocusedTextEditor(null);
    setBubbleRubySelectionPreview("");
    setBubbleRubySelectionRange(null);
    setBubbleRubyText("");
  };

  const isAltFocusableElementVisible = (el: HTMLElement | null) => {
    if (!el) return false;
    if (!el.isConnected) return false;
    if (el.hidden) return false;

    const rect = el.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  };

  const closeEditorAndClearCanvasFocusForAltMenu = () => {
    setSelectedFrameImageCardId(null);
    clearRubySelection();
    setSelectedItems([]);
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setOpenEditorSectionKey(null);
    setFocusedTextEditor(null);
    setBubbleRubySelectionPreview("");
    setBubbleRubySelectionRange(null);
    setBubbleRubyText("");
    setActiveTargetType("page");

    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
  };

  const focusPageListPrimaryTarget = () => {
    setMainMode("manga");
    setActiveTargetType("page");
    setSelectedItems([]);

    if (!hasContentPage()) {
      requestAnimationFrame(() => {
        const target = pageListScrollRef.current;
        if (!target || !isAltFocusableElementVisible(target)) return;

        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      });

      return;
    }

    if (currentPageId != null) {
      setSelectedPageIds([currentPageId]);
      lastSelectedPageIdRef.current = currentPageId;
    }

    requestAnimationFrame(() => {
      const target = currentPageCardRef.current;
      if (!target || !isAltFocusableElementVisible(target)) return;

      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };

  const focusMenuButtonByAlt = () => {
    closeEditorAndClearCanvasFocusForAltMenu();

    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;

    requestAnimationFrame(() => {
      const target = menuButtonRef.current;
      if (!target || !isAltFocusableElementVisible(target)) return;

      target.focus({ preventScroll: true });
    });
  };

  const focusSelectedCanvasObject = (item: SelectedItem | null = primarySelectedItem) => {
    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;

    const focusFallback = () => {
      focusTrapRef.current?.focus({ preventScroll: true });
    };

    if (!item) {
      requestAnimationFrame(focusFallback);
      return;
    }

    const selector =
      `[data-canvas-focus-object="true"]` +
      `[data-canvas-object-type="${item.kind}"]` +
      `[data-canvas-object-id="${String(item.id)}"]`;

    const focusWithRetry = (attempt = 0) => {
      requestAnimationFrame(() => {
        const target = pageRef.current?.querySelector<HTMLElement>(selector);

        if (target) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
          return;
        }

        if (attempt < 8) {
          window.setTimeout(() => focusWithRetry(attempt + 1), 0);
          return;
        }

        focusFallback();
      });
    };

    focusWithRetry();
  };

  useEffect(() => {
    const root = appRootRef.current;
    if (!root) return;

    const focusSystem = new FocusSystem(root, {
      getMenuPrimaryElement: () => toolbarRef.current,
      getMainPrimaryElement: () =>
        !hasContentPage()
          ? pageListScrollRef.current
          : currentPageCardRef.current,
      onMainCanvasTab: (reverse) => {
        if (mainMode !== "manga") return false;

        if (!hasContentPage()) {
          const target = pageListScrollRef.current;
          if (!target || !isAltFocusableElementVisible(target)) return false;

          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
          return true;
        }

        return selectCanvasItemByTab(reverse);
      },
      hasMainCanvasSelection: () =>
        mainMode === "manga" &&
        (
          selectedFrameIds.length > 0 ||
          selectedBubbleIds.length > 0 ||
          selectedSoundIds.length > 0
        ),
      onMainCanvasEnter: () => {
        if (mainMode !== "manga") return false;
        if (!primarySelectedItem) return false;

        if (primarySelectedItem.kind === "frame") {
          closeContextMenu();
          focusFrameImageInsertEditor(primarySelectedItem.id);
          return true;
        }

        if (primarySelectedItem.kind === "bubble") {
          focusBubbleTextEditor(primarySelectedItem.id);
          return true;
        }

        if (primarySelectedItem.kind === "sound") {
          focusSoundTextEditor(primarySelectedItem.id);
          return true;
        }

        return false;
      },
      onMainCanvasEscapeToMain: () => {
        closeContextMenu();
        closePageMenu();
        closePageInsertMenu();
        setSelectedFrameImageCardId(null);
        setTrimmingFrameId(null);
        clearRubySelection();
        setSelectedItems([]);
        setOpenEditorSectionKey(null);
        setFocusedTextEditor(null);
        setBubbleRubySelectionPreview("");
        setBubbleRubySelectionRange(null);
        setBubbleRubyText("");

        if (currentPageId != null) {
          setSelectedPageIds([currentPageId]);
          lastSelectedPageIdRef.current = currentPageId;
        } else {
          setSelectedPageIds([]);
          lastSelectedPageIdRef.current = null;
        }

        setActiveTargetType("canvas");
      },
      onEditorEscapeToMain: () => {
        const itemToFocus = primarySelectedItem;

        closeContextMenu();
        closePageMenu();
        closePageInsertMenu();
        setMainMode("manga");
        setActiveTargetType("canvas");
        setSelectedPageIds([]);
        lastSelectedPageIdRef.current = null;
        setSelectedFrameImageCardId(null);
        setTrimmingFrameId(null);
        clearRubySelection();
        setOpenEditorSectionKey(null);
        setFocusedTextEditor(null);
        setBubbleRubySelectionPreview("");
        setBubbleRubySelectionRange(null);
        setBubbleRubyText("");

        focusSelectedCanvasObject(itemToFocus);
      },
      onMainEscapeToPageList: () => {
        setMainMode("manga");
        setActiveTargetType("page");
        setSelectedItems([]);

        if (currentPageId != null) {
          setSelectedPageIds([currentPageId]);
          lastSelectedPageIdRef.current = currentPageId;
          return;
        }

        setSelectedPageIds([]);
        lastSelectedPageIdRef.current = null;
      },
      onPageCardEnterToMain: () => {
        closeAllFloatingMenus();
        setMainMode("manga");
        setActiveTargetType("canvas");
        setSelectedPageIds([]);
        lastSelectedPageIdRef.current = null;
      },
      onPageCardEscapeToPageList: () => {
        closeAllFloatingMenus();
        setMainMode("manga");
        setActiveTargetType("page");
        setSelectedItems([]);
        setSelectedPageIds([]);
        lastSelectedPageIdRef.current = null;
      },
      onTemplateEscape: () => {
        if (mainMode !== "template") return false;
        if (selectedTemplateId == null) return false;

        setActiveTargetType("canvas");
        setSelectedTemplateId(null);
        setTemplateContextMenu((prev) => ({
          ...prev,
          visible: false,
          templateId: null,
        }));

        return true;
      },
      onAltMoveToMenu: () => {
        closeEditorAndClearCanvasFocusForAltMenu();
        setSelectedPageIds([]);
        lastSelectedPageIdRef.current = null;
      },
      onAltMoveToMain: () => {
        setMainMode("manga");
        setActiveTargetType("page");
        setSelectedItems([]);

        const existingCurrentPage =
          currentPageId == null
            ? null
            : pagesRef.current.find(
                (page) =>
                  page.id === currentPageId &&
                  !isSpecialCoverPageIdValue(page.id)
              );
        const targetPageId = existingCurrentPage?.id ?? getFirstContentPage()?.id ?? null;

        if (targetPageId != null) {
          setCurrentPageId(targetPageId);
          setSelectedPageIds([targetPageId]);
          lastSelectedPageIdRef.current = targetPageId;
        } else {
          setSelectedPageIds([]);
          lastSelectedPageIdRef.current = null;
        }
      },
    });

    focusSystem.initialize();

    return () => {
      focusSystem.dispose();
    };
  }, [
    currentPageId,
    currentPage,
    mainMode,
    primarySelectedItem,
    selectedFrameIds.length,
    selectedBubbleIds.length,
    selectedSoundIds.length,
    selectedTemplateId,
    contentPageCount,
  ]);

  useEffect(() => {
    if (contentPageCount !== 0) return;

    setSelectedItems([]);
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setActiveTargetType("canvas");

    setCurrentPageId((current) => {
      if (hasCovers && isSpecialCoverPageIdValue(current)) return current;

      const fallbackCover = hasCovers
        ? pagesRef.current.find((page) => isCoverPageIdValue(page.id)) ??
          pagesRef.current.find((page) => isBackCoverPageIdValue(page.id)) ??
          null
        : null;

      return fallbackCover?.id ?? null;
    });

    if (mainMode !== "template") {
      setMainMode("manga");
    }
  }, [contentPageCount, hasCovers, mainMode]);

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;

    const target = e.target as HTMLElement | null;

    if (trimmingFrameId != null) {
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown"
      ) {
        const isTextEditingTarget = !!target?.closest(
          'input, textarea, select, [contenteditable="true"]'
        );

        if (isTextEditingTarget) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const step = e.shiftKey ? 1 : 10;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;

        moveTrimmingFrameImageByKeyboard(trimmingFrameId, dx, dy);
        focusCanvasTrap();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        finishFrameTrimming();
        focusCanvasTrap();
        return;
      }
    }

    if (e.key !== "Escape") return;

    if (contextMenu.visible) {
      const returnTarget = contextMenu.target;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeContextMenuAndFocusReturnTarget(returnTarget);
      return;
    }

    const activeElement = document.activeElement as HTMLElement | null;

    if (target?.closest('[data-focus-area="editor"]')) return;

    if (
      mainMode === "manga" &&
      activeTargetType === "page" &&
      selectedPageIds.length === 0
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    if (
      target?.closest("[data-top-toolbar-menu]") ||
      target?.closest('[data-focus-area="menu"]') ||
      activeElement?.closest("[data-top-toolbar-menu]") ||
      activeElement?.closest('[data-focus-area="menu"]')
    ) {
      return;
    }


    if (
      activeElement instanceof HTMLInputElement &&
      activeElement.type === "range" &&
      activeElement.classList.contains("mansaku-range-slider")
    ) {
      activeElement.blur();
    }

    e.preventDefault();
    e.stopPropagation();

    clearAllSelectionAndMenus();
  };

  window.addEventListener("keydown", handleKeyDown, true);

  return () => {
    window.removeEventListener("keydown", handleKeyDown, true);
  };
}, [
  activeTargetType,
  contextMenu.visible,
  contextMenu.target,
  trimmingFrameId,
  mainMode,
  selectedPageIds.length,
  currentPageId,
]);

  const focusBubbleTextEditor = (bubbleId: number) => {
    setActiveTargetType("canvas");
    setSelectedItems([{ kind: "bubble", id: bubbleId }]);
    setOpenEditorSectionKey("bubble-text");

    requestAnimationFrame(() => {
      const textarea = bubbleTextEditorRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(0, 0);
    });
  };

  const focusSoundTextEditor = (soundId: number) => {
    setActiveTargetType("canvas");
    setSelectedItems([{ kind: "sound", id: soundId }]);
    setOpenEditorSectionKey("sound-text");

    requestAnimationFrame(() => {
      const textarea = soundTextEditorRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(0, 0);
    });
  };

  const focusFrameImageInsertEditor = (frameId: number) => {
    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setSelectedItems([{ kind: "frame", id: frameId }]);
    setOpenEditorSectionKey("frame-image-add-delete");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setContextMenuKeyboardInputMode();

        const insertButton =
          editorPanelScrollRef.current?.querySelector<HTMLButtonElement>(
            "button[data-focus-role='editor-insert-image']"
          );

        insertButton?.focus({ preventScroll: true });
      });
    });
  };

  const focusFrameImageMoveEditor = (frameId: number) => {
    setMainMode("manga");
    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setSelectedItems([{ kind: "frame", id: frameId }]);
    setOpenEditorSectionKey("frame-image-move-copy");
    setSelectedFrameImageCardId(frameId);
    setTrimmingFrameId(frameId);
    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    closeTopToolbarMenus();

    const focusFrameOnCanvas = (attempt = 0) => {
      window.requestAnimationFrame(() => {
        const frameElement = pageRef.current?.querySelector<HTMLElement>(
          `[data-canvas-focus-object="true"]` +
            `[data-canvas-object-type="frame"]` +
            `[data-canvas-object-id="${String(frameId)}"]`
        );

        if (frameElement) {
          frameElement.focus({ preventScroll: true });
          frameElement.scrollIntoView({ block: "nearest", inline: "nearest" });
          return;
        }

        if (attempt < 8) {
          window.setTimeout(() => focusFrameOnCanvas(attempt + 1), 0);
          return;
        }

        focusTrapRef.current?.focus({ preventScroll: true });
      });
    };

    focusFrameOnCanvas();
  };

  const setPastePointAtMouse = (e: MouseEvent | React.MouseEvent) => {
    const rect = getPageRect();
    if (!rect) return;

    const xPercent = clamp(
      ((e.clientX - rect.left) / rect.width) * 100,
      0,
      100
    );
    const yPercent = clamp(
      ((e.clientY - rect.top) / rect.height) * 100,
      0,
      100
    );

    setLastPastePoint({
      xPercent,
      yPercent,
    });
  };

  const selectPageCard = (
    pageId: number,
    e?: React.MouseEvent
  ) => {
    const isCtrl = !!e && (e.ctrlKey || e.metaKey);
    const isShift = !!e && e.shiftKey;

    closeAllFloatingMenus();

    setActiveTargetType("page");
    setCurrentPageId(pageId);
    setSelectedItems([]);

    if (isShift && lastSelectedPageIdRef.current !== null) {
      const startIndex = pages.findIndex(
        (page) => page.id === lastSelectedPageIdRef.current
      );
      const endIndex = pages.findIndex((page) => page.id === pageId);

      if (startIndex >= 0 && endIndex >= 0) {
        const min = Math.min(startIndex, endIndex);
        const max = Math.max(startIndex, endIndex);

        setSelectedPageIds(
          pages.slice(min, max + 1).map((page) => page.id)
        );
        return;
      }
    }

    if (isCtrl) {
      setSelectedPageIds((prev) => {
        if (prev.includes(pageId)) {
          return prev.filter((id) => id !== pageId);
        }

        return [...prev, pageId];
      });

      lastSelectedPageIdRef.current = pageId;
      return;
    }

    setSelectedPageIds([pageId]);
    lastSelectedPageIdRef.current = pageId;
  };

  const closePageMenu = () => {
    setPageMenu({
      visible: false,
      x: 0,
      y: 0,
      pageId: null,
    });
  };

    const closePageInsertMenu = () => {
    setPageInsertMenu({
      visible: false,
      x: 0,
      y: 0,
      insertIndex: 0,
      insertBarKey: null,
    });
  };

  const focusPageListAfterPageMenuAction = () => {
    setMainMode("manga");
    setActiveTargetType("page");
    setSelectedItems([]);

    requestAnimationFrame(() => {
      const target = pageListScrollRef.current;
      if (!target || !isAltFocusableElementVisible(target)) return;

      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };

  const focusTemplateAfterTemplateMenuAction = (templateId: string | null) => {
    setMainMode("template");

    requestAnimationFrame(() => {
      const templateArea = document.querySelector<HTMLElement>(
        '[data-focus-area="template"][data-focus-layer="template"]'
      );

      if (!templateArea || !isAltFocusableElementVisible(templateArea)) return;

      const templateItems = Array.from(
        templateArea.querySelectorAll<HTMLElement>('[data-focus-role="template-item"]')
      );
      const target =
        templateId == null
          ? null
          : templateItems.find((item) => item.dataset.templateId === templateId) ?? null;

      const focusTarget = target ?? templateArea;
      focusTarget.focus({ preventScroll: true });
      focusTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };

  const openPageInsertMenu = (
    e: React.MouseEvent<HTMLElement>,
    insertIndex: number,
    insertBarKey: string | null = null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    closeContextMenu();
    closePageMenu();

    setPageInsertMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      insertIndex,
      insertBarKey,
    });
  };

  const openPageInsertMenuAtEnd = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    closeContextMenu();
    closePageMenu();

    setPageInsertMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      insertIndex: getDefaultPageInsertIndex(),
      insertBarKey: null,
    });
  };

  const openPageMenu = (
    e: React.MouseEvent<HTMLElement>,
    pageId: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    closeContextMenu();

    setActiveTargetType("page");
    setCurrentPageId(pageId);
    setSelectedItems([]);

    if (!selectedPageIds.includes(pageId)) {
      setSelectedPageIds([pageId]);
      lastSelectedPageIdRef.current = pageId;
    }

    const MENU_WIDTH = 190;
    const MENU_HEIGHT = 230;
    const VIEWPORT_PADDING = 8;

    let nextX = e.clientX;
    let nextY = e.clientY;

    if (nextX + MENU_WIDTH + VIEWPORT_PADDING > window.innerWidth) {
      nextX = window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING;
    }

    if (nextY + MENU_HEIGHT + VIEWPORT_PADDING > window.innerHeight) {
      nextY = window.innerHeight - MENU_HEIGHT - VIEWPORT_PADDING;
    }

    nextX = Math.max(VIEWPORT_PADDING, nextX);
    nextY = Math.max(VIEWPORT_PADDING, nextY);

    setPageMenu({
      visible: true,
      x: nextX,
      y: nextY,
      pageId,
    });
  };

  const closeContextMenu = () => {
    setStickySubmenuKey(null);
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      pageXPercent: null,
      pageYPercent: null,
      target: null,
    });
  };

  const focusContextMenuReturnTarget = (target: ContextMenuTarget | null) => {
    setMainMode("manga");
    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setSelectedFrameImageCardId(null);
    clearRubySelection();
    setOpenEditorSectionKey(null);
    setFocusedTextEditor(null);
    setBubbleRubySelectionPreview("");
    setBubbleRubySelectionRange(null);
    setBubbleRubyText("");

    if (!target || target.kind === "canvas") {
      focusSelectedCanvasObject(null);
      return;
    }

    focusSelectedCanvasObject({ kind: target.kind, id: target.id });
  };

  const closeContextMenuAndFocusReturnTarget = (target: ContextMenuTarget | null) => {
    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    setIsMenuOpen(false);
    focusContextMenuReturnTarget(target);
  };

  const closeAllFloatingMenus = () => {
    closeTopToolbarMenus();
    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();

    setTemplateContextMenu({
      visible: false,
      x: 0,
      y: 0,
      templateId: null,
      key: 0,
    });
  };

  const getActiveItems = () => {
    return selectedMovableItems;
  };

  const hasClipboardContent =
    (clipboardItem?.frames?.length ?? 0) > 0 ||
    (clipboardItem?.bubbles?.length ?? 0) > 0 ||
    (clipboardItem?.sounds?.length ?? 0) > 0;

  const getClipboardPasteLabel = () => {
    const frameCount = clipboardItem?.frames?.length ?? 0;
    const bubbleCount = clipboardItem?.bubbles?.length ?? 0;
    const soundCount = clipboardItem?.sounds?.length ?? 0;

    const kinds = [
      frameCount > 0 ? t("frame") : null,
      bubbleCount > 0 ? t("bubble") : null,
      soundCount > 0 ? t("sound") : null,
    ].filter((value): value is NonNullable<typeof value> => value !== null);

    if (kinds.length === 0) return t("paste");
    if (kinds.length === 1) return `${kinds[0]} ${t("paste")}`;
    return t("paste");
  };

  const getPrimarySelectedPosition = () => {
    if (!currentPage || !primarySelectedItem) return null;

    if (primarySelectedItem.kind === "frame") {
      const frame = currentPage.frames.find((f) => f.id === primarySelectedItem.id);
      return frame ? { xPercent: frame.x, yPercent: frame.y } : null;
    }

    if (primarySelectedItem.kind === "bubble") {
      const bubble = currentPage.bubbles.find((b) => b.id === primarySelectedItem.id);
      return bubble ? { xPercent: bubble.x, yPercent: bubble.y } : null;
    }

    const sound = currentPage.sounds.find((s) => s.id === primarySelectedItem.id);
    return sound ? { xPercent: sound.x, yPercent: sound.y } : null;
  };

  const getKeyboardPastePoint = () => {
    const visibleCenter = getVisiblePageCenterPercent();

    return {
      xPercent: visibleCenter.x,
      yPercent: visibleCenter.y,
      anchor: "center" as const,
      shiftIfPreviousPasteSelected: true,
    };
  };

  const handleCutSelection = () => {
    if (!currentPage) return;

    const activeItems = getActiveItems();
    if (activeItems.length === 0) return;

    const copiedFrames = currentPage.frames
      .filter((f) =>
        activeItems.some((item) => item.kind === "frame" && item.id === f.id) &&
        !isProtectedCoverBaseFrame(currentPage, f)
      )
      .map((f) => ({ ...f }));

    const copiedBubbles = currentPage.bubbles
      .filter((b) =>
        activeItems.some((item) => item.kind === "bubble" && item.id === b.id)
      )
      .sort((a, b) => a.layer - b.layer)
      .map((b) => ({ ...b }));

    const copiedSounds = currentPage.sounds
      .filter((s) =>
        activeItems.some((item) => item.kind === "sound" && item.id === s.id)
      )
      .sort((a, b) => a.layer - b.layer)
      .map((s) => ({ ...s }));

    if (
      copiedFrames.length === 0 &&
      copiedBubbles.length === 0 &&
      copiedSounds.length === 0
    ) {
      return;
    }

    setClipboardItem({
      mode: "cut",
      frames: copiedFrames,
      bubbles: copiedBubbles,
      sounds: copiedSounds,
    });

    applyPagesChange((prev) =>
      prev.map((page) =>
        page.id === currentPageId
          ? {
              ...page,
              frames: page.frames.filter(
                (f) =>
                  isProtectedCoverBaseFrame(page, f) ||
                  !activeItems.some((item) => item.kind === "frame" && item.id === f.id)
              ),
              bubbles: page.bubbles.filter(
                (b) =>
                  !activeItems.some((item) => item.kind === "bubble" && item.id === b.id)
              ),
              sounds: page.sounds.filter(
                (s) =>
                  !activeItems.some((item) => item.kind === "sound" && item.id === s.id)
              ),
            }
          : page
      )
    );

    setSelectedItems([]);
  };

  const handleCopySelection = () => {
    if (!currentPage) return;

    const activeItems = getActiveItems();
    if (activeItems.length === 0) return;

    const copiedFrames = currentPage.frames
      .filter((f) =>
        activeItems.some((item) => item.kind === "frame" && item.id === f.id) &&
        !isProtectedCoverBaseFrame(currentPage, f)
      )
      .map((f) => ({ ...f }));

    const copiedBubbles = currentPage.bubbles
      .filter((b) =>
        activeItems.some((item) => item.kind === "bubble" && item.id === b.id)
      )
      .sort((a, b) => a.layer - b.layer)
      .map((b) => ({ ...b }));

    const copiedSounds = currentPage.sounds
      .filter((s) =>
        activeItems.some((item) => item.kind === "sound" && item.id === s.id)
      )
      .sort((a, b) => a.layer - b.layer)
      .map((s) => ({ ...s }));

    if (
      copiedFrames.length === 0 &&
      copiedBubbles.length === 0 &&
      copiedSounds.length === 0
    ) {
      return;
    }

    setClipboardItem({
      mode: "copy",
      frames: copiedFrames,
      bubbles: copiedBubbles,
      sounds: copiedSounds,
    });

    setPageClipboard(null);
  };

  const handlePasteSelection = (
    pastePoint: {
      xPercent: number;
      yPercent: number;
      anchor?: "topLeft" | "center";
      shiftIfPreviousPasteSelected?: boolean;
    } | null
  ) => {
    if (!clipboardItem || !currentPage) return;

    const sourceFrames = clipboardItem.frames ?? [];
    const sourceBubbles = clipboardItem.bubbles ?? [];
    const sourceSounds = clipboardItem.sounds ?? [];

    if (
      sourceFrames.length === 0 &&
      sourceBubbles.length === 0 &&
      sourceSounds.length === 0
    ) {
      return;
    }

    const getSelectionItemKey = (item: SelectedItem) => `${item.kind}:${item.id}`;

    const getObjectBoundsByKeys = (itemKeys: string[]) => {
      const keySet = new Set(itemKeys);

      const points = [
        ...currentPage.frames
          .filter((frame) => keySet.has(`frame:${frame.id}`))
          .flatMap((frame) => getFrameAbsolutePoints(frame)),
        ...currentPage.bubbles
          .filter((bubble) => keySet.has(`bubble:${bubble.id}`))
          .flatMap((bubble) => [
            { x: bubble.x, y: bubble.y },
            { x: bubble.x + bubble.w, y: bubble.y + bubble.h },
          ]),
        ...currentPage.sounds
          .filter((sound) => keySet.has(`sound:${sound.id}`))
          .map((sound) => ({ x: sound.x, y: sound.y })),
      ];

      if (points.length === 0) return null;

      return {
        minX: Math.min(...points.map((point) => point.x)),
        maxX: Math.max(...points.map((point) => point.x)),
        minY: Math.min(...points.map((point) => point.y)),
        maxY: Math.max(...points.map((point) => point.y)),
      };
    };

    const baseId = Date.now();
    let seq = 0;
    const nextId = () => baseId + seq++;

    const bubbleLayerStart = getNextBubbleLayer(currentPage);
    const soundLayerStart = getNextSoundLayer(currentPage);

    const framePoints = sourceFrames.flatMap((frame) =>
      getFrameAbsolutePoints(frame)
    );

    const boundsPoints = [
      ...framePoints,
      ...sourceBubbles.flatMap((bubble) => [
        { x: bubble.x, y: bubble.y },
        { x: bubble.x + bubble.w, y: bubble.y + bubble.h },
      ]),
      ...sourceSounds.map((sound) => ({ x: sound.x, y: sound.y })),
    ];

    if (boundsPoints.length === 0) return;

    const minX = Math.min(...boundsPoints.map((point) => point.x));
    const maxX = Math.max(...boundsPoints.map((point) => point.x));
    const minY = Math.min(...boundsPoints.map((point) => point.y));
    const maxY = Math.max(...boundsPoints.map((point) => point.y));

    const pasteAnchor = pastePoint?.anchor ?? "topLeft";
    const sourceAnchorX = pasteAnchor === "center" ? (minX + maxX) / 2 : minX;
    const sourceAnchorY = pasteAnchor === "center" ? (minY + maxY) / 2 : minY;

    let rawOffsetX = pastePoint ? pastePoint.xPercent - sourceAnchorX : 0;
    let rawOffsetY = pastePoint ? pastePoint.yPercent - sourceAnchorY : 0;

    if (pastePoint?.shiftIfPreviousPasteSelected) {
      const lastPaste = lastPastedObjectRef.current;
      const currentSelectedKeys = selectedItems.map(getSelectionItemKey).sort();

      if (
        lastPaste &&
        lastPaste.pageId === currentPage.id &&
        lastPaste.itemKeys.length === currentSelectedKeys.length &&
        lastPaste.itemKeys.every((key, index) => key === currentSelectedKeys[index])
      ) {
        const existingBounds = getObjectBoundsByKeys(lastPaste.itemKeys);
        const isPreviousPasteStillInPlace =
          existingBounds &&
          Math.abs(existingBounds.minX - lastPaste.minX) <= 0.000001 &&
          Math.abs(existingBounds.minY - lastPaste.minY) <= 0.000001;

        const nextMinX = minX + rawOffsetX;
        const nextMinY = minY + rawOffsetY;

        if (
          existingBounds &&
          isPreviousPasteStillInPlace &&
          Math.abs(existingBounds.minX - nextMinX) <= 5 &&
          Math.abs(existingBounds.minY - nextMinY) <= 5
        ) {
          rawOffsetX = existingBounds.minX + 1 - minX;
          rawOffsetY = existingBounds.minY + 1 - minY;
        }
      }
    }

    const offsetX = clamp(rawOffsetX, -minX, 100 - maxX);
    const offsetY = clamp(rawOffsetY, -minY, 100 - maxY);

    const pastedFrames: Frame[] = sourceFrames.map((frame) => {
      const moved = translateFrameWithPoints(frame, offsetX, offsetY);
      return {
        ...moved,
        id: nextId(),
      };
    });

    const pastedBubbles: Bubble[] = sourceBubbles.map((bubble, index) => ({
      ...bubble,
      id: nextId(),
      x: bubble.x + offsetX,
      y: bubble.y + offsetY,
      layer: bubbleLayerStart + index,
    }));

    const pastedSounds: SoundText[] = sourceSounds.map((sound, index) => ({
      ...sound,
      id: nextId(),
      x: sound.x + offsetX,
      y: sound.y + offsetY,
      layer: soundLayerStart + index,
    }));

    updateCurrentPage((page) => ({
      ...page,
      frames: [...page.frames, ...pastedFrames],
      bubbles: [...page.bubbles, ...pastedBubbles],
      sounds: [...page.sounds, ...pastedSounds],
    }));

    const pastedItems = [
      ...pastedFrames.map((frame) => ({ kind: "frame" as const, id: frame.id })),
      ...pastedBubbles.map((bubble) => ({ kind: "bubble" as const, id: bubble.id })),
      ...pastedSounds.map((sound) => ({ kind: "sound" as const, id: sound.id })),
    ];

    setSelectedItems(pastedItems);

    lastPastedObjectRef.current = {
      pageId: currentPage.id,
      itemKeys: pastedItems.map(getSelectionItemKey).sort(),
      minX: minX + offsetX,
      minY: minY + offsetY,
    };
  };

  const handleDeleteSelection = () => {
    if (!currentPage) return;

    const activeItems = getActiveItems().filter((item) => {
      if (item.kind !== "frame") return true;
      if (item.id === INNER_LOCKED_FRAME_ID) return false;

      const frame = currentPage.frames.find((itemFrame) => itemFrame.id === item.id);
      return !isProtectedCoverBaseFrame(currentPage, frame);
    });

    if (activeItems.length === 0) return;

    applyPagesChange((prev) =>
      prev.map((page) =>
        page.id === currentPageId
          ? {
              ...page,
              frames: page.frames.filter(
                (frame) =>
                  isProtectedCoverBaseFrame(page, frame) ||
                  !activeItems.some(
                    (item) => item.kind === "frame" && item.id === frame.id
                  )
              ),
              bubbles: page.bubbles.filter(
                (bubble) =>
                  !activeItems.some(
                    (item) => item.kind === "bubble" && item.id === bubble.id
                  )
              ),
              sounds: page.sounds.filter(
                (sound) =>
                  !activeItems.some(
                    (item) => item.kind === "sound" && item.id === sound.id
                  )
              ),
            }
          : page
      )
    );

    setSelectedItems([]);
  };

  const suppressHandleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const openContextMenu = (
    e: React.MouseEvent,
    target: ContextMenuTarget
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      trimmingFrameId != null &&
      target.kind === "frame" &&
      target.id === trimmingFrameId
    ) {
      closeContextMenu();
      return;
    }

    if (target.kind === "canvas") {
      const eventTarget = e.target as HTMLElement | null;

      if (!eventTarget?.closest("[data-page-canvas='true']")) {
        closeContextMenu();
        return;
      }
    }

    if (target.kind === "bubble") {
      const alreadySelected = selectedItems.some(
        (item) => item.kind === "bubble" && item.id === target.id
      );

      if (!alreadySelected) {
        setSelectedItems([]);
        setSelectedItems([{ kind: "bubble", id: target.id }]);
      }
    }

    if (target.kind === "sound") {
      const alreadySelected = selectedItems.some(
        (item) => item.kind === "sound" && item.id === target.id
      );

      if (!alreadySelected) {
        setSelectedItems([]);
        setSelectedItems([{ kind: "sound", id: target.id }]);
      }
    }

    if (target.kind === "frame") {
      const alreadySelected = selectedFrameIds.includes(target.id);

      if (!alreadySelected) {
        setSelectedItems([{ kind: "frame", id: target.id }]);
      }
    }

    const rect = getPageRect();

    let pageXPercent: number | null = null;
    let pageYPercent: number | null = null;

    if (rect) {
      pageXPercent = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
      pageYPercent = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);

      setLastPastePoint({
        xPercent: pageXPercent,
        yPercent: pageYPercent,
      });
    }

    const MENU_WIDTH = 180;
    const VIEWPORT_PADDING = 8;

    let estimatedHeight = 56;

    if (target.kind === "canvas") {
      estimatedHeight = 56;
    } else if (target.kind === "bubble") {
      estimatedHeight = 360;
    } else if (target.kind === "sound") {
      estimatedHeight = 320;
    } else if (target.kind === "frame") {
      estimatedHeight = canMergeSelectedFrames(currentPage, selectedFrameIds)
        ? 300
        : 260;
    }

    let nextX = e.clientX;
    let nextY = e.clientY;

    if (nextX + MENU_WIDTH + VIEWPORT_PADDING > window.innerWidth) {
      nextX = window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING;
    }

    if (nextY + estimatedHeight + VIEWPORT_PADDING > window.innerHeight) {
      nextY = window.innerHeight - estimatedHeight - VIEWPORT_PADDING;
    }

    nextX = Math.max(VIEWPORT_PADDING, nextX);
    nextY = Math.max(VIEWPORT_PADDING, nextY);

    setStickySubmenuKey(null);
    setContextMenu({
      visible: true,
      x: nextX,
      y: nextY,
      pageXPercent,
      pageYPercent,
      target,
    });
  };

  const keepExistingSelectedItems = (
  targetPages: Page[],
  targetPageId: number,
  selectedItems: SelectedItem[]
): SelectedItem[] => {
  const targetPage = targetPages.find((page) => page.id === targetPageId);
  if (!targetPage) return [];

  return selectedItems.filter((item) => {
    if (item.kind === "frame") {
      return targetPage.frames.some((frame) => frame.id === item.id);
    }

    if (item.kind === "bubble") {
      return targetPage.bubbles.some((bubble) => bubble.id === item.id);
    }

    if (item.kind === "sound") {
      return targetPage.sounds.some((sound) => sound.id === item.id);
    }

    return false;
  });
};

  const pushHistorySnapshot = () => {
    setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(pages)));
    setRedoStack([]);
  };

  const handleUndo = () => {
    resetFontSizeInputHistory();

    if (undoPendingSliderWheelHistory()) {
      showHistoryShortcutNotice("undo");
      return;
    }

    if (undoStack.length === 0) return;

    showHistoryShortcutNotice("undo");

    const previous = undoStack[undoStack.length - 1];
    const previousPages = sanitizeProjectPagesForState(clonePages(previous.pages));

    const nextCurrentPageId = resolveVisibleCurrentPageId(
      previous.currentPageId,
      previousPages,
      previous.hasCovers
    );

    setRedoStack((stack) => [createHistorySnapshot(pages), ...stack]);
    setUndoStack((stack) => stack.slice(0, -1));
    setPages(previousPages);
    setHasCovers(previous.hasCovers);

    setSelectedItems([]);
    setSelectedPageIds([]);
    setSelectedFrameImageCardId(null);
    setTrimmingFrameId(null);
    setActiveTargetType("canvas");
    lastSelectedPageIdRef.current = null;

    setDragState(null);
    setSnapGuideLines([]);
    setCurrentPageId(nextCurrentPageId);
  };

  const handleRedo = () => {
    resetFontSizeInputHistory();

    if (commitSliderWheelHistory()) {
      return;
    }

    if (redoStack.length === 0) return;

    showHistoryShortcutNotice("redo");

    const next = redoStack[0];
    const nextPages = sanitizeProjectPagesForState(clonePages(next.pages));

    const nextCurrentPageId = resolveVisibleCurrentPageId(
      next.currentPageId,
      nextPages,
      next.hasCovers
    );

    setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(pages)));
    setRedoStack((stack) => stack.slice(1));
    setPages(nextPages);
    setHasCovers(next.hasCovers);

    setSelectedItems([]);
    setSelectedPageIds([]);
    setSelectedFrameImageCardId(null);
    setTrimmingFrameId(null);
    setActiveTargetType("canvas");
    lastSelectedPageIdRef.current = null;

    setDragState(null);
    setSnapGuideLines([]);
    setCurrentPageId(nextCurrentPageId);
  };

  const handleToolbarUndoClick = () => {
    const shouldMoveFocusToToolbar = undoStack.length === 1;

    handleUndo();

    if (shouldMoveFocusToToolbar) {
      focusToolbarArea();
    }
  };

  const handleToolbarRedoClick = () => {
    const shouldMoveFocusToToolbar = redoStack.length === 1;

    handleRedo();

    if (shouldMoveFocusToToolbar) {
      focusToolbarArea();
    }
  };

  const applyImageToFrame = async (frameId: number, file: File) => {
    if (!isSupportedImageFile(file)) {
      window.alert(t("unsupportedImageFormat"));
      return;
    }

    selectFrame(frameId);

    const base64 = await fileToBase64(file);
    const imageId = createImageAssetId();

    const img = new Image();
    img.onload = () => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const imageHasTransparency = detectImageTransparency(img);

      setImageAssets((assets) => ({
        ...assets,
        [imageId]: base64,
      }));

      updateCurrentPage((page) => ({
        ...page,
        frames: page.frames.map((f) => {
          if (f.id !== frameId) return f;

          const tempFrame = resetFrameImageFlip({
            ...f,
            image: null,
            imageId,
            imageOffsetX: 0,
            imageOffsetY: 0,
            imageScale: 1,
            imageNaturalWidth: naturalWidth,
            imageNaturalHeight: naturalHeight,
            imageHasTransparency,
          } as Frame & FrameImageTransparencyFields);

          return {
            ...tempFrame,
            imageOffsetX: 0,
            imageOffsetY: 0,
          };
        }),
      }));

      trackImageInsert();
    };

    img.src = base64;
  };

  const openImagePickerForFrame = (frameId: number) => {
    pendingImageFrameIdRef.current = frameId;
    hiddenImageInputRef.current?.click();
  };

  const handleHiddenImageInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    const frameId = pendingImageFrameIdRef.current;

    e.currentTarget.value = "";

    if (!file || frameId == null) return;

    await applyImageToFrame(frameId, file);
    pendingImageFrameIdRef.current = null;
  };

  const handleDropImage = async (
    e: React.DragEvent<HTMLDivElement>,
    frameId: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.types.includes("application/x-mansaku-frame-image")) {
      const sourceFrameIdText = e.dataTransfer.getData("application/x-mansaku-frame-image");
      const sourceFrameId = Number(sourceFrameIdText);
      moveOrCopyFrameImage(
        frameId,
        e.ctrlKey,
        Number.isFinite(sourceFrameId) ? sourceFrameId : undefined
      );
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const file = files.find(isSupportedImageFile);

    if (!file) {
      if (files.some(isImageLikeFile)) {
        window.alert(t("unsupportedImageFormat"));
      }
      return;
    }

    await applyImageToFrame(frameId, file);
  };

  const handleFrameImageDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    sourceFrameId: number
  ) => {
    e.stopPropagation();

    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData("application/x-mansaku-frame-image", String(sourceFrameId));
    e.dataTransfer.setData("text/plain", "Mansaku frame image");

    setDraggingFrameImage({ sourceFrameId, isCopy: e.ctrlKey });
    setPressedFrameImageCardId(sourceFrameId);
    setDragOverFrameImageTargetId(null);
  };

  const handleFrameImageDragEnd = () => {
    setDraggingFrameImage(null);
    setDragOverFrameImageTargetId(null);
    setPressedFrameImageCardId(null);
  };

  const handleFrameImageDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    targetFrameId: number
  ) => {
    const isFrameImageDrag =
      draggingFrameImage != null ||
      e.dataTransfer.types.includes("application/x-mansaku-frame-image");
    const isExternalImageDrag = Array.from(e.dataTransfer.items).some(
      isImageLikeDataTransferItem
    );

    if (!isFrameImageDrag && !isExternalImageDrag) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    e.dataTransfer.dropEffect = isFrameImageDrag
      ? e.ctrlKey
        ? "copy"
        : "move"
      : "copy";

    if (isFrameImageDrag) {
      setDraggingFrameImage((prev) =>
        prev ? { ...prev, isCopy: e.ctrlKey } : prev
      );
    }

    setDragOverFrameImageTargetId(targetFrameId);
  };

  const handleFrameImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;

    setDragOverFrameImageTargetId((prev) =>
      prev === null ? prev : null
    );
  };

  const moveOrCopyFrameImage = (
    targetFrameId: number,
    forceCopy: boolean,
    fallbackSourceFrameId?: number
  ) => {
    const sourceFrameId = draggingFrameImage?.sourceFrameId ?? fallbackSourceFrameId;

    setDraggingFrameImage(null);
    setDragOverFrameImageTargetId(null);
    setPressedFrameImageCardId(null);

    if (sourceFrameId == null) return;
    if (sourceFrameId === targetFrameId) return;

    const sourceFrame = currentPage?.frames.find((frame) => frame.id === sourceFrameId);
    const targetFrame = currentPage?.frames.find((frame) => frame.id === targetFrameId);
    if (!hasFrameImage(sourceFrame) || !targetFrame) return;

    const sourceImagePayload = getFrameImagePayload(sourceFrame);
    const targetImagePayload = getFrameImagePayload(targetFrame);

    updateCurrentPage((page) => ({
      ...page,
      frames: page.frames.map((frame) => {
        if (frame.id === targetFrameId) {
          return {
            ...frame,
            ...sourceImagePayload,
          };
        }

        if (!forceCopy && frame.id === sourceFrameId) {
          if (targetImagePayload.imageId || targetImagePayload.image) {
            return {
              ...frame,
              ...targetImagePayload,
            };
          }

          return resetFrameImageFlip({
            ...frame,
            image: null,
            imageId: undefined,
            imageOffsetX: 0,
            imageOffsetY: 0,
            imageScale: 1,
            imageNaturalWidth: 0,
            imageNaturalHeight: 0,
          } as Frame);
        }

        return frame;
      }),
    }));

    selectFrame(targetFrameId);
    setOpenEditorSectionKey("frame-image-move-copy");
    setSelectedFrameImageCardId(targetFrameId);

    const keepImagePositionOpen = () => {
      setOpenEditorSectionKey("frame-image-move-copy");
      setSelectedFrameImageCardId(targetFrameId);

      const active = document.activeElement as HTMLElement | null;
      const activeCard = active?.closest<HTMLElement>(
        "[data-frame-image-card='true'][data-frame-image-card-id]"
      );

      if (
        active &&
        active !== document.body &&
        !activeCard &&
        !active.closest("[data-editor-section-root='frame-image-move-copy']")
      ) {
        return;
      }

      if (
        activeCard &&
        activeCard.dataset.frameImageCardId !== String(targetFrameId)
      ) {
        return;
      }

      const targetCard = document.querySelector<HTMLElement>(
        `[data-frame-image-card-id="${targetFrameId}"]`
      );
      targetCard?.focus({ preventScroll: true });
    };

    window.requestAnimationFrame(keepImagePositionOpen);
    window.setTimeout(keepImagePositionOpen, 30);
    window.setTimeout(keepImagePositionOpen, 180);
    window.setTimeout(keepImagePositionOpen, 360);
  };

  const handleToggleFrameBorder = (frameId: number) => {
    updateCurrentPage((page) => ({
      ...page,
      frames: page.frames.map((f) =>
        f.id === frameId
          ? { ...f, borderEnabled: !f.borderEnabled }
          : f
      ),
    }));

    clearSelection();
    closeContextMenu();
  };

  const handleToggleSelectedFrameBorders = () => {
    if (selectedFrameIds.length === 0) return;

    updateCurrentPage((page) => {
      const targetFrames = page.frames.filter(
        (f) => selectedFrameIds.includes(f.id) && !isProtectedCoverBaseFrame(page, f)
      );
      if (targetFrames.length === 0) return page;

      const shouldEnable = targetFrames.some((f) => !f.borderEnabled);

      return {
        ...page,
        frames: page.frames.map((f) =>
          selectedFrameIds.includes(f.id) && !isProtectedCoverBaseFrame(page, f)
            ? { ...f, borderEnabled: shouldEnable }
            : f
        ),
      };
    });

    clearSelection();
    closeContextMenu();
  };


  const handleDeleteFrame = (frameId: number) => {
    if (frameId === INNER_LOCKED_FRAME_ID) return;
    if (!currentPage) return;

    const targetFrame = currentPage.frames.find((frame) => frame.id === frameId);
    if (isProtectedCoverBaseFrame(currentPage, targetFrame)) return;

    updateCurrentPage((page) => ({
      ...page,
      frames: page.frames.filter((f) => f.id !== frameId),
    }));

    if (selectedFrameIds.includes(frameId)) {
      setSelectedItems([]);
    }

    closeContextMenu();
  };


  const handleDeleteSelectedFrames = () => {
    if (!currentPage) return;
    if (selectedFrameIds.length === 0) return;

    updateCurrentPage((page) => ({
      ...page,
      frames: page.frames.filter(
        (f) => isProtectedCoverBaseFrame(page, f) || !selectedFrameIds.includes(f.id)
      ),
    }));

    setSelectedItems([]);
    closeContextMenu();
  };

  const handleSplitFrameByAxis = (frameId: number, axis: SplitAxis) => {
    if (!currentPage) return;

    const source = currentPage.frames.find((frame) => frame.id === frameId);
    if (!source) return;
    if (isProtectedCoverBaseFrame(currentPage, source)) return;

    const splitResult = splitFramePolygon(source, axis, 0);
    if (!splitResult) return;

    const firstId = source.id;
    const secondId = Date.now();

    const firstFrame = keepFrameImageDisplayScale(
      source,
      buildSplitChildFrame(source, firstId, splitResult.first),
      { allowOverflowOffset: true }
    );

    const secondFrame = keepFrameImageDisplayScale(
      source,
      buildSplitChildFrame(source, secondId, splitResult.second),
      { allowOverflowOffset: true }
    );

    updateCurrentPage((page) => {
      const sourceIndex = page.frames.findIndex((frame) => frame.id === frameId);
      if (sourceIndex < 0) return page;

      const nextFrames = [...page.frames];
      nextFrames.splice(sourceIndex, 1, firstFrame, secondFrame);

      return {
        ...page,
        frames: nextFrames,
      };
    });

    setSelectedItems([
      { kind: "frame", id: firstId },
      { kind: "frame", id: secondId },
    ]);
  };

  const handleImageWheel = (
    e: React.WheelEvent<HTMLDivElement>,
    frameId: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    updateCurrentPage((page) => ({
      ...page,
      frames: page.frames.map((f) => {
        if (f.id !== frameId) return f;
        const nextScale = clamp(
          f.imageScale + (e.deltaY < 0 ? 0.08 : -0.08),
          1,
          3.5
        );
        return { ...f, imageScale: Number(nextScale.toFixed(2)) };
      }),
    }));
  };

  const isMouseOverPageListItem = (clientX: number, clientY: number) => {
    const listEl = pageListScrollRef.current;
    if (!listEl) return false;

    const items = Array.from(
      listEl.querySelectorAll<HTMLElement>("[data-page-list-item='true']")
    );

    return items.some((item) => {
      const rect = item.getBoundingClientRect();

      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    });
  };

  const getNearestInsertBarByMouse = (clientY: number) => {
    const listEl = pageListScrollRef.current;
    if (!listEl) {
      return {
        insertIndex: getDefaultPageInsertIndex(),
        insertBarKey: null as string | null,
      };
    }

    const bars = Array.from(
      listEl.querySelectorAll<HTMLElement>("[data-insert-bar='true']")
    );

    if (bars.length === 0) {
      return {
        insertIndex: getDefaultPageInsertIndex(),
        insertBarKey: null as string | null,
      };
    }

    let nearestIndex = getDefaultPageInsertIndex();
    let nearestKey: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    bars.forEach((bar) => {
      const rawIndex = bar.dataset.insertIndex;
      if (rawIndex == null) return;

      const insertIndex = Number(rawIndex);
      if (!Number.isFinite(insertIndex)) return;

      const rect = bar.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const distance = Math.abs(clientY - centerY);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = insertIndex;
        nearestKey = bar.dataset.insertBarKey ?? null;
      }
    });

    return { insertIndex: nearestIndex, insertBarKey: nearestKey };
  };

  const updateNearestInsertBarByMouse = (clientY: number) => {
    if (pageInsertMenu.visible) return;

    const nearest = getNearestInsertBarByMouse(clientY);
    setDragOverPageId(nearest.insertIndex);
    setDragOverInsertBarKey(nearest.insertBarKey);
  };

  const getNearestInsertIndexByMouse = (clientY: number) => {
    return getNearestInsertBarByMouse(clientY).insertIndex;
  };

  const InsertBar = ({
    insertIndex,
    positionKey,
  }: {
    insertIndex: number;
    positionKey?: string;
  }) => {
    const insertBarKey = positionKey ?? `insert-${insertIndex}`;
    const isActive =
      dragOverPageId === insertIndex &&
      (dragOverInsertBarKey == null || dragOverInsertBarKey === insertBarKey);
    const isMenuOpenForThisBar =
      pageInsertMenu.visible &&
      pageInsertMenu.insertIndex === insertIndex &&
      (pageInsertMenu.insertBarKey == null || pageInsertMenu.insertBarKey === insertBarKey);

    const isVisible = isActive || isMenuOpenForThisBar;
    const isHighlighted = isActive || isMenuOpenForThisBar;

    return (
      <div
        data-insert-bar="true"
        data-page-insert-bar="true"
        data-insert-index={insertIndex}
        data-insert-bar-key={insertBarKey}
        onMouseDown={(e) => {
          e.stopPropagation();
          startPageSelectionBox(e, { allowInsertBar: true });
        }}
        onContextMenu={(e) => {
          setSelectedPageIds([]);
          lastSelectedPageIdRef.current = null;

          openPageInsertMenu(e, insertIndex, insertBarKey);
        }}
        onDragOver={(e) => {
          if (draggingPageId == null && !draggingTemplateId) return;

          e.preventDefault();
          e.stopPropagation();

          const isCopy = draggingPageId != null && (e.ctrlKey || e.metaKey);
          setIsPageDragCopying(isCopy);
          e.dataTransfer.dropEffect = draggingTemplateId || isCopy ? "copy" : "move";
          setDragOverPageId(insertIndex);
          setDragOverInsertBarKey(insertBarKey);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();

          if (draggingTemplateId) {
            handleTemplateDropToPageList(insertIndex);
            return;
          }

          handlePageDropToIndex(insertIndex, e.ctrlKey || e.metaKey || isPageDragCopying);
        }}
        style={{
          position: "relative",
          height: 28,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 2,
            background: isHighlighted ? "#2563eb" : "transparent",
            transform: "translateY(-50%)",
            opacity: 1,
            pointerEvents: "none",
          }}
        />

        {isVisible && isPageDragCopying && draggingPageId != null && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "#ffffff",
              border: "2px solid #2563eb",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.16)",
            }}
          >
            <PlusSvgIcon />
          </div>
        )}
      </div>
    );
  };
  
  useEffect(() => {
    const pendingRestoreText = localStorage.getItem(PENDING_RESTORE_PROJECT_KEY);

    if (!pendingRestoreText) return;

    consumedPendingRestoreRef.current = true;

    try {
      const pendingRestore = JSON.parse(pendingRestoreText) as PendingRestoreProject;

      restoreProjectData(pendingRestore.data, { markUnsaved: true });
      projectFileHandleRef.current = null;
      setProjectFileName(pendingRestore.projectFileName ?? null);
      autoSaveReadyRef.current = true;
      requestRestoreCompleteNotice();
    } catch {
      window.alert(t("autoSaveRestoreFailed"));
    } finally {
      localStorage.removeItem(PENDING_RESTORE_PROJECT_KEY);
    }
  }, []);

  useEffect(() => {
    if (consumedPendingRestoreRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        const snapshot = await readProjectAutoSave();
        if (cancelled) return;

        autoSaveReadyRef.current = true;

        if (!snapshot) return;

        const savedAtText = new Date(snapshot.savedAt).toLocaleString();
        const shouldRestore = window.confirm(
          t("autoSaveRestoreConfirm").replace("{time}", savedAtText)
        );

        if (!shouldRestore) {
          void clearProjectAutoSave();
          return;
        }

        try {
          restoreProjectData(snapshot.data, { markUnsaved: true });
          projectFileHandleRef.current = null;
          setProjectFileName(snapshot.projectFileName ?? null);
          void clearProjectAutoSave();
          requestRestoreCompleteNotice();
        } catch {
          window.alert(t("autoSaveRestoreFailed"));
        }
      } catch {
        autoSaveReadyRef.current = true;
        window.alert(t("autoSaveRestoreFailed"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!autoSaveReadyRef.current) return;

    if (autoSaveTimerRef.current != null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (!hasUnsavedChanges) return;

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;

      void writeProjectAutoSave({
        autoSaveVersion: 1,
        savedAt: Date.now(),
        projectFileName,
        data: buildProjectData(),
      }).catch(() => {
        // 復元用一時保存は本保存を邪魔しない
      });
    }, 5000);

    return () => {
      if (autoSaveTimerRef.current != null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [pages, imageAssets, hasCovers, showPageNumbers, hasUnsavedChanges, projectFileName]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      const activeElement = document.activeElement;

      if (
        activeElement instanceof HTMLInputElement &&
        activeElement.type === "range" &&
        activeElement.classList.contains("mansaku-range-slider")
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      setPreviewScale((prev) => {
        const step = e.shiftKey ? 1 : 10;
        const next = prev + (e.deltaY < 0 ? step : -step);
        return clamp(next, 25, 200);
      });
    };

    window.addEventListener("wheel", onWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener("wheel", onWheel, {
        capture: true,
      } as AddEventListenerOptions);
    };
  }, []);

  function getShortcutPageTargetId() {
    if (currentPageId != null && selectedPageIds.includes(currentPageId)) {
      return currentPageId;
    }

    return selectedPageIds[selectedPageIds.length - 1] ?? currentPageId;
  }

  function hasCanvasShortcutSelection() {
    return (
      selectedFrameIds.length > 0 ||
      selectedBubbleIds.length > 0 ||
      selectedSoundIds.length > 0
    );
  }

  function handleSaveShortcutCommand() {
    setIsMenuOpen(false);
    void handleSaveProjectWithStatus(saveButtonRef.current);
  }

  function selectPageByIndex(nextIndex: number) {
    if (pages.length === 0) return false;

    const nextPage = pages[clamp(nextIndex, 0, pages.length - 1)];
    if (!nextPage) return false;

    setActiveTargetType("page");
    setCurrentPageId(nextPage.id);
    setSelectedPageIds([nextPage.id]);
    lastSelectedPageIdRef.current = nextPage.id;
    setSelectedItems([]);

    requestAnimationFrame(() => {
      pageCardRefs.current.get(nextPage.id)?.scrollIntoView({
        block: "nearest",
      });
    });

    return true;
  }

  function getKeyboardPageAnchorIndex() {
    const anchorPageId =
      lastSelectedPageIdRef.current != null &&
      pages.some((page) => page.id === lastSelectedPageIdRef.current)
        ? lastSelectedPageIdRef.current
        : selectedPageIds[selectedPageIds.length - 1] ?? currentPageId;

    if (anchorPageId == null) return -1;
    return pages.findIndex((page) => page.id === anchorPageId);
  }

  function selectPageByKeyboard(direction: "up" | "down") {
    if (pages.length === 0) return false;
    if (activeTargetType !== "page") return false;

    const currentIndex = getKeyboardPageAnchorIndex();
    if (currentIndex < 0) return false;

    if (selectedPageIds.length === 0) {
      return selectPageByIndex(currentIndex);
    }

    return selectPageByIndex(
      currentIndex + (direction === "up" ? -1 : 1)
    );
  }

  function selectFirstPageByKeyboard() {
    return selectPageByIndex(0);
  }

  function selectLastPageByKeyboard() {
    return selectPageByIndex(pages.length - 1);
  }

  function selectSiblingPageByKeyboard(direction: "prev" | "next") {
    if (pages.length === 0) return false;

    const currentIndex = getKeyboardPageAnchorIndex();
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;

    return selectPageByIndex(
      baseIndex + (direction === "prev" ? -1 : 1)
    );
  }

  function moveSelectedItemsByKeyboard(dx: number, dy: number) {
    if (!currentPage || currentPageId == null) return false;

    const movableItems = sanitizeSelectedItems(selectedItems);
    if (movableItems.length === 0) return false;

    const selectedFrameIdSet = new Set(
      movableItems
        .filter((item): item is Extract<SelectedItem, { kind: "frame" }> => item.kind === "frame")
        .map((item) => item.id)
    );

    const selectedBubbleIdSet = new Set(
      movableItems
        .filter((item): item is Extract<SelectedItem, { kind: "bubble" }> => item.kind === "bubble")
        .map((item) => item.id)
    );

    const selectedSoundIdSet = new Set(
      movableItems
        .filter((item): item is Extract<SelectedItem, { kind: "sound" }> => item.kind === "sound")
        .map((item) => item.id)
    );

    let minDx = Number.NEGATIVE_INFINITY;
    let maxDx = Number.POSITIVE_INFINITY;
    let minDy = Number.NEGATIVE_INFINITY;
    let maxDy = Number.POSITIVE_INFINITY;

    currentPage.frames.forEach((frame) => {
      if (!selectedFrameIdSet.has(frame.id)) return;

      const bounds = getPointsBounds(getFrameAbsolutePoints(frame));
      minDx = Math.max(minDx, -bounds.minX);
      maxDx = Math.min(maxDx, 100 - bounds.maxX);
      minDy = Math.max(minDy, -bounds.minY);
      maxDy = Math.min(maxDy, 100 - bounds.maxY);
    });

    currentPage.bubbles.forEach((bubble) => {
      if (!selectedBubbleIdSet.has(bubble.id)) return;

      minDx = Math.max(minDx, -bubble.x);
      maxDx = Math.min(maxDx, 100 - (bubble.x + bubble.w));
      minDy = Math.max(minDy, -bubble.y);
      maxDy = Math.min(maxDy, 100 - (bubble.y + bubble.h));
    });

    currentPage.sounds.forEach((sound) => {
      if (!selectedSoundIdSet.has(sound.id)) return;

      minDx = Math.max(minDx, -sound.x);
      maxDx = Math.min(maxDx, 95 - sound.x);
      minDy = Math.max(minDy, -sound.y);
      maxDy = Math.min(maxDy, 95 - sound.y);
    });

    const safeDx = clamp(dx, minDx, maxDx);
    const safeDy = clamp(dy, minDy, maxDy);

    if (Math.abs(safeDx) <= 0.000001 && Math.abs(safeDy) <= 0.000001) {
      return false;
    }

    applyPagesChange((prev) =>
      prev.map((page) => {
        if (page.id !== currentPageId) return page;

        return {
          ...page,
          frames: page.frames.map((frame) =>
            selectedFrameIdSet.has(frame.id)
              ? rebuildFrameFromAbsolutePoints(
                  frame,
                  getFrameAbsolutePoints(frame).map((point) => ({
                    x: point.x + safeDx,
                    y: point.y + safeDy,
                  }))
                )
              : frame
          ),
          bubbles: page.bubbles.map((bubble) =>
            selectedBubbleIdSet.has(bubble.id)
              ? {
                  ...bubble,
                  x: bubble.x + safeDx,
                  y: bubble.y + safeDy,
                }
              : bubble
          ),
          sounds: page.sounds.map((sound) =>
            selectedSoundIdSet.has(sound.id)
              ? {
                  ...sound,
                  x: sound.x + safeDx,
                  y: sound.y + safeDy,
                }
              : sound
          ),
        };
      })
    );

    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    return true;
  }

  function selectCanvasItemByTab(reverse: boolean) {
    if (!currentPage) return false;

    const candidates = sanitizeSelectedItems([
      ...currentPage.frames.map((frame) => ({
        kind: "frame" as const,
        id: frame.id,
        x: frame.x,
        y: frame.y,
      })),
      ...currentPage.bubbles.map((bubble) => ({
        kind: "bubble" as const,
        id: bubble.id,
        x: bubble.x,
        y: bubble.y,
      })),
      ...currentPage.sounds.map((sound) => {
        const displaySound =
          (sound.text ?? "").length > 0
            ? sound
            : {
                ...sound,
                text: t("soundTextPlaceholder"),
              };

        const box = getSoundTextBoxMetrics(displaySound);

        return {
          kind: "sound" as const,
          id: sound.id,
          x: sound.x - (box.width / PAGE_WIDTH) * 50,
          y: sound.y - (box.height / PAGE_HEIGHT) * 50,
        };
      }),
    ])
      .filter((item): item is SelectedItem & { x: number; y: number } => item != null)
      .sort((a, b) => {
        if (Math.abs(a.y - b.y) > 0.001) return a.y - b.y;
        if (Math.abs(a.x - b.x) > 0.001) return a.x - b.x;
        return a.id - b.id;
      });

    if (candidates.length === 0) return false;

    const currentIndex = primarySelectedItem
      ? candidates.findIndex(
          (item) =>
            item.kind === primarySelectedItem.kind &&
            item.id === primarySelectedItem.id
        )
      : -1;

    const nextIndex =
      currentIndex < 0
        ? reverse
          ? candidates.length - 1
          : 0
        : (currentIndex + (reverse ? -1 : 1) + candidates.length) %
          candidates.length;

    const nextItem = candidates[nextIndex];
    if (!nextItem) return false;

    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    setSelectedItems([{ kind: nextItem.kind, id: nextItem.id }]);

    focusTrapRef.current?.focus({ preventScroll: true });

    return true;
  }

  function handleCutShortcutCommand() {
    const activeItems = getActiveItems();

    if (hasCanvasShortcutSelection()) {
      if (!currentPage || activeItems.length === 0) return;
      handleCutSelection();
      return;
    }

    const pageTargetId = getShortcutPageTargetId();
    if (pageTargetId == null || selectedPageIds.length === 0) return;

    handleCutPages(pageTargetId);
  }

  function handleCopyShortcutCommand() {
    const activeItems = getActiveItems();

    if (hasCanvasShortcutSelection()) {
      if (!currentPage || activeItems.length === 0) return;
      handleCopySelection();
      return;
    }

    const pageTargetId = getShortcutPageTargetId();
    if (pageTargetId == null || selectedPageIds.length === 0) return;

    handleCopyPages(pageTargetId);
  }

  function handlePasteShortcutCommand() {
    const hasPageClipboard = (pageClipboard?.pages.length ?? 0) > 0;

    const hasObjectClipboard =
      (clipboardItem?.frames?.length ?? 0) > 0 ||
      (clipboardItem?.bubbles?.length ?? 0) > 0 ||
      (clipboardItem?.sounds?.length ?? 0) > 0;

    if (hasObjectClipboard) {
      if (!currentPage) return;
      handlePasteSelection(getKeyboardPastePoint());
      return;
    }

    if (hasPageClipboard) {
      handlePastePagesAt(pages.length);
    }
  }

  function handleSelectAllShortcutCommand() {
    if (activeTargetType === "canvas") {
      if (!currentPage) return;

      setSelectedPageIds([]);

      setSelectedItems(
        sanitizeSelectedItems([
          ...currentPage.frames.map((f) => ({
            kind: "frame" as const,
            id: f.id,
          })),
          ...currentPage.bubbles.map((b) => ({
            kind: "bubble" as const,
            id: b.id,
          })),
          ...currentPage.sounds.map((s) => ({
            kind: "sound" as const,
            id: s.id,
          })),
        ])
      );

      return;
    }

    setSelectedItems([]);
    setActiveTargetType("page");
    setSelectedPageIds(pages.map((p) => p.id));
  }

  function handleDeleteShortcutCommand() {
    if (hasCanvasShortcutSelection()) {
      handleDeleteSelection();
      return;
    }

    if (selectedPageIds.length === 0) return;
    handleDeletePages(selectedPageIds);
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isExportingPdf || isExportingPng) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const key = e.key.toLowerCase();
      const code = e.code;
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      const isFontFamilyPreviewKey =
        key === "arrowdown" ||
        key === "arrowright" ||
        key === "arrowup" ||
        key === "arrowleft" ||
        key === "enter" ||
        key === "escape";

      if (
        isFontFamilyPreviewKey &&
        (target?.closest("[data-font-family-preview-root='true']") ||
          target?.closest("[data-font-family-preview-menu='true']"))
      ) {
        return;
      }

      const activeItems = getActiveItems();

      const hasCanvasSelection =
        selectedFrameIds.length > 0 ||
        selectedBubbleIds.length > 0 ||
        selectedSoundIds.length > 0;

      const pageShortcutTargetId =
        currentPageId != null && selectedPageIds.includes(currentPageId)
          ? currentPageId
          : selectedPageIds[selectedPageIds.length - 1] ?? currentPageId;

      if (ctrlOrMeta) {
        if (key === "s" || code === "KeyS") {
          e.preventDefault();
          e.stopPropagation();

          handleSaveShortcutCommand();

          return;
        }

        if ((key === "z" || code === "KeyZ") && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          handleUndo();
          return;
        }

        if (
          key === "y" ||
          code === "KeyY" ||
          ((key === "z" || code === "KeyZ") && e.shiftKey)
        ) {
          e.preventDefault();
          e.stopPropagation();
          handleRedo();
          return;
        }
      }

      if (
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (!ctrlOrMeta && !e.altKey && key === "tab") {
        const focusTrap = focusTrapRef.current;
        const pageElement = pageRef.current;
        const isInManuscriptArea = !!(pageElement && target && pageElement.contains(target));
        const isCanvasObjectFocused = !!target?.closest("[data-canvas-focus-object='true']");
        const isCanvasFocusTrapActive = target === focusTrap && activeTargetType === "canvas";

        if (
          mainMode !== "manga" ||
          (!isInManuscriptArea && !isCanvasObjectFocused && !isCanvasFocusTrapActive)
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        selectCanvasItemByTab(e.shiftKey);
        return;
      }

      if (!ctrlOrMeta && !e.shiftKey && !e.altKey && key === "enter") {
        if (selectedBubble) {
          e.preventDefault();
          e.stopPropagation();

          focusBubbleTextEditor(selectedBubble.id);
          return;
        }

        if (selectedSound) {
          e.preventDefault();
          e.stopPropagation();

          focusSoundTextEditor(selectedSound.id);
          return;
        }
      }

      if (!ctrlOrMeta && !e.altKey) {
        const imageMoveDirectionMap: Record<
          string,
          "left" | "up" | "right" | "down" | undefined
        > = {
          arrowleft: "left",
          arrowup: "up",
          arrowright: "right",
          arrowdown: "down",
        };

        const imageMoveDirection = imageMoveDirectionMap[key];

        if (imageMoveDirection) {
          const frameImageCard = target?.closest<HTMLElement>(
            "[data-frame-image-card='true'][data-frame-image-card-id]"
          );
          const frameImageCardIdText = frameImageCard?.dataset.frameImageCardId;
          const frameImageCardId =
            frameImageCardIdText != null ? Number(frameImageCardIdText) : null;
          const imageMoveFrameId =
            Number.isFinite(frameImageCardId) && frameImageCardId != null
              ? frameImageCardId
              : selectedFrameImageCardId;

          if (imageMoveFrameId != null) {
            const frame = currentPage?.frames.find(
              (f) => f.id === imageMoveFrameId && hasFrameImage(f)
            );

            if (frame) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();

              const step = e.shiftKey ? 1 : 10;
              const moveKey = `${frame.id}:${key}:${step}`;

              setOpenEditorSectionKey("frame-image-move-copy");
              setSelectedFrameImageCardId(frame.id);

              if (imageMoveKeyboardKeyRef.current !== moveKey) {
                imageMoveKeyboardKeyRef.current = moveKey;
                startFrameImageMoveByDirection(frame.id, imageMoveDirection, step);
              }

              window.requestAnimationFrame(() => {
                const active = document.activeElement as HTMLElement | null;
                const activeCard = active?.closest<HTMLElement>(
                  "[data-frame-image-card='true'][data-frame-image-card-id]"
                );

                if (
                  active &&
                  active !== document.body &&
                  !activeCard &&
                  !active.closest("[data-editor-section-root='frame-image-move-copy']")
                ) {
                  return;
                }

                if (
                  activeCard &&
                  activeCard.dataset.frameImageCardId !== String(frame.id)
                ) {
                  return;
                }

                const card = document.querySelector<HTMLElement>(
                  `[data-frame-image-card='true'][data-frame-image-card-id="${frame.id}"]`
                );
                card?.focus({ preventScroll: true });
              });

              return;
            }

            if (selectedFrameImageCardId === imageMoveFrameId) {
              setSelectedFrameImageCardId(null);
            }
          }
        }

        const moveStep = e.shiftKey ? SHIFT_GRID_STEP_PERCENT : 0.5;
        const arrowMoveMap: Record<string, { dx: number; dy: number } | undefined> = {
          arrowleft: { dx: -moveStep, dy: 0 },
          arrowup: { dx: 0, dy: -moveStep },
          arrowright: { dx: moveStep, dy: 0 },
          arrowdown: { dx: 0, dy: moveStep },
        };

        const arrowMove = arrowMoveMap[key];

        if (arrowMove && hasCanvasSelection) {
          if (moveSelectedItemsByKeyboard(arrowMove.dx, arrowMove.dy)) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }

      if (!ctrlOrMeta && !e.shiftKey && !e.altKey) {
        if (key === "home") {
          if (selectFirstPageByKeyboard()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (key === "end") {
          if (selectLastPageByKeyboard()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (key === "pageup") {
          if (selectSiblingPageByKeyboard("prev")) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (key === "pagedown") {
          if (selectSiblingPageByKeyboard("next")) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (key === "arrowup" || code === "ArrowUp") {
          if (selectPageByKeyboard("up")) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (key === "arrowdown" || code === "ArrowDown") {
          if (selectPageByKeyboard("down")) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }

      if (ctrlOrMeta) {
        if (key === "x" || code === "KeyX") {
          e.preventDefault();
          e.stopPropagation();

          if (hasCanvasSelection) {
            if (!currentPage || activeItems.length === 0) return;
            handleCutSelection();
            return;
          }

          if (pageShortcutTargetId == null || selectedPageIds.length === 0) return;
          handleCutPages(pageShortcutTargetId);
          return;
        }

        if (key === "c" || code === "KeyC") {
          e.preventDefault();
          e.stopPropagation();

          if (hasCanvasSelection) {
            if (!currentPage || activeItems.length === 0) return;
            handleCopySelection();
            return;
          }

          if (pageShortcutTargetId == null || selectedPageIds.length === 0) return;
          handleCopyPages(pageShortcutTargetId);
          return;
        }

        if (key === "v" || code === "KeyV") {
          e.preventDefault();
          e.stopPropagation();

          const hasPageClipboard =
            (pageClipboard?.pages.length ?? 0) > 0;

          const hasObjectClipboard =
            (clipboardItem?.frames?.length ?? 0) > 0 ||
            (clipboardItem?.bubbles?.length ?? 0) > 0 ||
            (clipboardItem?.sounds?.length ?? 0) > 0;

          if (hasObjectClipboard) {
            if (!currentPage) return;
            handlePasteSelection(getKeyboardPastePoint());
            return;
          }

          if (hasPageClipboard) {
            const pasteAfterPageId =
              activeTargetType === "page" &&
              lastSelectedPageIdRef.current != null &&
              selectedPageIds.includes(lastSelectedPageIdRef.current) &&
              pages.some((page) => page.id === lastSelectedPageIdRef.current)
                ? lastSelectedPageIdRef.current
                : null;

            if (pasteAfterPageId != null) {
              handlePastePagesAfter(pasteAfterPageId);
              return;
            }

            handlePastePagesAt(pages.length);
            return;
          }

          return;
        }

        if (key === "a" || code === "KeyA") {
          e.preventDefault();
          e.stopPropagation();

          if (activeTargetType === "canvas") {
            if (!currentPage) return;

            setSelectedPageIds([]);

            setSelectedItems(
              sanitizeSelectedItems([
                ...currentPage.frames.map((f) => ({
                  kind: "frame" as const,
                  id: f.id,
                })),
                ...currentPage.bubbles.map((b) => ({
                  kind: "bubble" as const,
                  id: b.id,
                })),
                ...currentPage.sounds.map((s) => ({
                  kind: "sound" as const,
                  id: s.id,
                })),
              ])
            );

            return;
          }

          setSelectedItems([]);
          setActiveTargetType("page");
          setSelectedPageIds(pages.map((p) => p.id));

          return;
        }
      }

      if (key === "delete") {
        e.preventDefault();
        e.stopPropagation();

        if (hasCanvasSelection) {
          handleDeleteSelection();
          return;
        }

        if (selectedPageIds.length === 0) return;
        handleDeletePages(selectedPageIds);
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [
    clipboardItem,
    currentPage,
    currentPageId,
    hasClipboardContent,
    pages,
    pageClipboard,
    selectedPageIds,
    selectedFrameIds,
    selectedBubbleIds,
    selectedSoundIds,
    selectedItems,
    primarySelectedItem,
    selectedFrame,
    lastPastePoint,
    undoStack,
    redoStack,
    activeTargetType,
    selectedFrameImageCardId,
    isExportingPdf,
    isExportingPng,
  ]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (selectionBox && currentPage) {
        const minX = Math.min(selectionBox.startX, selectionBox.currentX);
        const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
        const minY = Math.min(selectionBox.startY, selectionBox.currentY);
        const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

        const nextSelectedItems: SelectedItem[] = [];

        const overlapsRect = (
          x: number,
          y: number,
          w: number,
          h: number
        ) => {
          return !(
            x + w < minX ||
            x > maxX ||
            y + h < minY ||
            y > maxY
          );
        };

        const containsPoint = (x: number, y: number) => {
          return x >= minX && x <= maxX && y >= minY && y <= maxY;
        };

        currentPage.frames.forEach((frame) => {
          if (overlapsRect(frame.x, frame.y, frame.w, frame.h)) {
            nextSelectedItems.push({ kind: "frame", id: frame.id });
          }
        });

        currentPage.bubbles.forEach((bubble) => {
          if (overlapsRect(bubble.x, bubble.y, bubble.w, bubble.h)) {
            nextSelectedItems.push({ kind: "bubble", id: bubble.id });
          }
        });

        currentPage.sounds.forEach((sound) => {
          if (containsPoint(sound.x, sound.y)) {
            nextSelectedItems.push({ kind: "sound", id: sound.id });
          }
        });

        setSelectedItems((prev) => {
          if (!selectionBox.additive) {
            return nextSelectedItems;
          }

          const merged = [...prev];

          nextSelectedItems.forEach((item) => {
            const exists = merged.some(
              (prevItem) =>
                prevItem.kind === item.kind && prevItem.id === item.id
            );

            if (!exists) {
              merged.push(item);
            }
          });

          return merged;
        });

        setSelectionBox(null);
      }

      dragHistoryPushedRef.current = false;
      setDragState(null);
      setSnapGuideLines([]);
      setBubbleTailWidthDragCursor(null);
    };

    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [currentPage, selectionBox]);

  useEffect(() => {
    if (!dragState && !selectionBox) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      handlePageMouseMove(e);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
    };
  }, [dragState, selectionBox]);

  useEffect(() => {
    const stop = () => {
      stopPageMoveRepeat();
    };

    window.addEventListener("mouseup", stop);
    window.addEventListener("blur", stop);

    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("blur", stop);
      stopPageMoveRepeat();
    };
  }, []);

  useEffect(() => {
    if (skipPageListAutoScrollRef.current) {
      skipPageListAutoScrollRef.current = false;
      return;
    }

    if (!currentPageCardRef.current) return;

    currentPageCardRef.current.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [currentPageId, pages]);

  useEffect(() => {
    setSelectedItems([]);
    closeContextMenu();
  }, [currentPageId]);

  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      closeContextMenu();
      closePageMenu();
      closePageInsertMenu();

      const target = e.target as Node | null;
      const pageEl = pageRef.current;
      const toolbarEl = toolbarRef.current;
      const menuEl = menuWrapRef.current;

      if (target && menuEl?.contains(target)) {
        return;
      }

      setIsMenuOpen(false);

      if (!pageEl) return;
      if (target && pageEl.contains(target)) return;
      if (target && toolbarEl?.contains(target)) return;
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      if (contextMenu.visible) {
        const returnTarget = contextMenu.target;
        e.preventDefault();
        e.stopPropagation();
        closeContextMenuAndFocusReturnTarget(returnTarget);
        return;
      }

      closeContextMenu();
      closePageMenu();
      closePageInsertMenu();
      setIsMenuOpen(false);
    };

    window.addEventListener("mousedown", handleGlobalMouseDown);
    window.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      window.removeEventListener("mousedown", handleGlobalMouseDown);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [contextMenu.visible, contextMenu.target]);
    
  useEffect(() => {
    const handleMouseDown = () => {
      if (pageInsertMenu.visible) {
        closePageInsertMenu();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [pageInsertMenu.visible]);

  useEffect(() => {
    if (!pageSelectionBox) return;

    const handleMouseMove = (e: MouseEvent) => {
      const point = getPageListLocalPoint(e);
      if (!point) return;

      setPageSelectionBox((prev) => {
        if (!prev) return prev;

        const next: PageSelectionBox = {
          ...prev,
          currentX: point.x,
          currentY: point.y,
        };

        updatePageSelectionByBox(next);

        return next;
      });
    };

    const handleMouseUp = () => {
      setPageSelectionBox(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [pageSelectionBox]);
  
  const handlePreviewCtrlWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();
    e.stopPropagation();

    setPreviewScale((prev) => {
      const step = e.shiftKey ? 1 : 10;
      const next = prev + (e.deltaY < 0 ? step : -step);
      return clamp(next, 25, 200);
    });
  };

  useEffect(() => {
    if (
      dragState?.kind !== "multi-move" &&
      dragState?.kind !== "bubble-move" &&
      dragState?.kind !== "sound-move"
    ) {
      setIsDragCopyPreviewVisible(false);
      return;
    }

    const syncCopyPreview = (event: KeyboardEvent | MouseEvent) => {
      setIsDragCopyPreviewVisible(event.ctrlKey || event.metaKey);
    };

    const handleKeyDown = (event: KeyboardEvent) => syncCopyPreview(event);
    const handleKeyUp = (event: KeyboardEvent) => syncCopyPreview(event);
    const handleMouseMove = (event: MouseEvent) => syncCopyPreview(event);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [dragState?.kind]);

  const startFramePan = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>,
    frame: Frame
  ) => {
    if (!hasFrameImage(frame)) return;
    e.preventDefault();
    e.stopPropagation();

    closeTopToolbarMenus();

    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    focusCanvasTrap();
    selectFrame(frame.id);

    setDragState({
      kind: "frame-pan",
      id: frame.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startOffsetX: frame.imageOffsetX,
      startOffsetY: frame.imageOffsetY,
      hasMoved: false,
      historyPushed: false,
    });
  };

  const startFrameTrimming = (frame: Frame) => {
    if (!hasFrameImage(frame)) return;

    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    closeTopToolbarMenus();
    focusCanvasTrap();
    selectFrame(frame.id);
    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    setTrimmingFrameId(frame.id);
  };

  const finishFrameTrimming = () => {
    setTrimmingFrameId(null);
    setDragState((prev) => (prev?.kind === "frame-pan" ? null : prev));
  };

  const keepFrameImageDisplayScale = (
    before: Frame,
    after: Frame,
    options?: { allowOverflowOffset?: boolean }
  ): Frame => {
    if (!hasFrameImage(before)) return after;

    const beforeMetrics = getFrameImageMetrics(before);
    const afterBaseMetrics = getFrameImageMetrics({
      ...after,
      imageScale: 1,
      imageOffsetX: 0,
      imageOffsetY: 0,
    });

    const nextImageScale = clamp(
      beforeMetrics.actualScale / Math.max(afterBaseMetrics.baseScale, 0.000001),
      0.0001,
      100
    );

    const scaledAfter: Frame = {
      ...after,
      imageScale: Number(nextImageScale.toFixed(4)),
      imageOffsetX: 0,
      imageOffsetY: 0,
    };

    const afterMetricsWithoutOffset = getFrameImageMetrics(scaledAfter);

    const getPageImageOrigin = (frame: Frame, metrics: ReturnType<typeof getFrameImageMetrics>) => {
      const framePixelX = (PAGE_WIDTH * frame.x) / 100;
      const framePixelY = (PAGE_HEIGHT * frame.y) / 100;
      const framePixelW = (PAGE_WIDTH * frame.w) / 100;
      const framePixelH = (PAGE_HEIGHT * frame.h) / 100;

      const imageAreaPixelX = frame.borderEnabled
        ? (framePixelW * metrics.imageAreaLeftPercent) / 100
        : 0;
      const imageAreaPixelY = frame.borderEnabled
        ? (framePixelH * metrics.imageAreaTopPercent) / 100
        : 0;

      return {
        left: framePixelX + imageAreaPixelX + metrics.imageLeft,
        top: framePixelY + imageAreaPixelY + metrics.imageTop,
      };
    };

    const beforePageImageOrigin = getPageImageOrigin(before, beforeMetrics);
    const afterPageImageOriginWithoutOffset = getPageImageOrigin(
      scaledAfter,
      afterMetricsWithoutOffset
    );

    const nextOffsetX =
      beforePageImageOrigin.left - afterPageImageOriginWithoutOffset.left;
    const nextOffsetY =
      beforePageImageOrigin.top - afterPageImageOriginWithoutOffset.top;

    return {
      ...scaledAfter,
      imageOffsetX: nextOffsetX,
      imageOffsetY: nextOffsetY,
    };
  };


  const alignFrameImageToFlipAnchor = (
    frame: Frame,
    anchor: {
      x?: { edge: "left" | "right"; valuePercent: number };
      y?: { edge: "top" | "bottom"; valuePercent: number };
    }
  ): Frame => {
    if (!hasFrameImage(frame)) return frame;
    if (!anchor.x && !anchor.y) return frame;

    const frameWithoutOffset: Frame = {
      ...frame,
      imageOffsetX: 0,
      imageOffsetY: 0,
    };
    const metricsWithoutOffset = getFrameImageMetrics(frameWithoutOffset);

    const framePixelX = (PAGE_WIDTH * frameWithoutOffset.x) / 100;
    const framePixelY = (PAGE_HEIGHT * frameWithoutOffset.y) / 100;
    const framePixelW = (PAGE_WIDTH * frameWithoutOffset.w) / 100;
    const framePixelH = (PAGE_HEIGHT * frameWithoutOffset.h) / 100;

    const imageAreaPixelX = frameWithoutOffset.borderEnabled
      ? (framePixelW * metricsWithoutOffset.imageAreaLeftPercent) / 100
      : 0;
    const imageAreaPixelY = frameWithoutOffset.borderEnabled
      ? (framePixelH * metricsWithoutOffset.imageAreaTopPercent) / 100
      : 0;

    const imageLeftWithoutOffset =
      framePixelX + imageAreaPixelX + metricsWithoutOffset.imageLeft;
    const imageTopWithoutOffset =
      framePixelY + imageAreaPixelY + metricsWithoutOffset.imageTop;

    let nextOffsetX = frame.imageOffsetX;
    let nextOffsetY = frame.imageOffsetY;

    if (anchor.x) {
      const anchorX = (PAGE_WIDTH * anchor.x.valuePercent) / 100;
      nextOffsetX =
        anchor.x.edge === "left"
          ? anchorX - imageLeftWithoutOffset
          : anchorX -
            (imageLeftWithoutOffset + metricsWithoutOffset.renderedImageW);
    }

    if (anchor.y) {
      const anchorY = (PAGE_HEIGHT * anchor.y.valuePercent) / 100;
      nextOffsetY =
        anchor.y.edge === "top"
          ? anchorY - imageTopWithoutOffset
          : anchorY -
            (imageTopWithoutOffset + metricsWithoutOffset.renderedImageH);
    }

    return {
      ...frame,
      imageOffsetX: nextOffsetX,
      imageOffsetY: nextOffsetY,
    };
  };

  const getTrimmingFrameImageOffsetBounds = (frame: Frame) => {
    const metrics = getFrameImageMetrics(frame);

    const maxOffsetX = Math.abs(metrics.renderedImageW - metrics.framePixelW) / 2;
    const maxOffsetY = Math.abs(metrics.renderedImageH - metrics.framePixelH) / 2;

    return {
      minOffsetX: -maxOffsetX,
      maxOffsetX,
      minOffsetY: -maxOffsetY,
      maxOffsetY,
    };
  };

  const clampFrameImageOffsetForTrimming = (
    frame: Frame,
    offsetX: number,
    offsetY: number
  ) => {
    const bounds = getTrimmingFrameImageOffsetBounds(frame);

    return {
      imageOffsetX: clamp(offsetX, bounds.minOffsetX, bounds.maxOffsetX),
      imageOffsetY: clamp(offsetY, bounds.minOffsetY, bounds.maxOffsetY),
    };
  };

  const showFrameImageScaleIndicator = (frameId: number, scalePercent: number) => {
    if (frameImageScaleIndicatorTimerRef.current != null) {
      window.clearTimeout(frameImageScaleIndicatorTimerRef.current);
    }

    setFrameImageScaleIndicator({ frameId, scalePercent });

    frameImageScaleIndicatorTimerRef.current = window.setTimeout(() => {
      setFrameImageScaleIndicator((current) =>
        current?.frameId === frameId ? null : current
      );
      frameImageScaleIndicatorTimerRef.current = null;
    }, 1000);
  };

  const moveTrimmingFrameImageByKeyboard = (
    frameId: number,
    dx: number,
    dy: number
  ) => {
    applyPagesChange(
      (prev) =>
        prev.map((page) => {
          if (page.id !== currentPageId) return page;

          return {
            ...page,
            frames: page.frames.map((frame) => {
              if (frame.id !== frameId) return frame;
              if (!hasFrameImage(frame)) return frame;

              const nextOffset = clampFrameImageOffsetForTrimming(
                frame,
                frame.imageOffsetX + dx,
                frame.imageOffsetY + dy
              );

              return {
                ...frame,
                ...nextOffset,
              };
            }),
          };
        }),
      { recordHistory: true }
    );
  };

  const changeFrameImageScaleByWheel = (
    frameId: number,
    deltaY: number,
    coarse: boolean
  ) => {
    const currentFrame = currentPage?.frames.find((frame) => frame.id === frameId);
    if (!hasFrameImage(currentFrame)) return;

    const currentMetrics = getFrameImageMetrics(currentFrame);
    const scaleStepPercent = coarse ? 10 : 1;
    const direction = deltaY < 0 ? 1 : -1;
    const currentActualScalePercent = Math.round(currentMetrics.actualScale * 100);
    const minActualScalePercent = Math.round(currentMetrics.baseScale * 100);
    const maxActualScalePercent = Math.round(currentMetrics.baseScale * 4 * 100);
    const nextActualScalePercent = clamp(
      currentActualScalePercent + direction * scaleStepPercent,
      minActualScalePercent,
      maxActualScalePercent
    );
    const nextScale = clamp(
      Number((nextActualScalePercent / 100 / currentMetrics.baseScale).toFixed(4)),
      1,
      4
    );

    const previewFrame = {
      ...currentFrame,
      imageScale: nextScale,
    };
    const actualScalePercent = Math.round(
      getFrameImageMetrics(previewFrame).actualScale * 100
    );

    if (nextScale === currentFrame.imageScale) {
      showFrameImageScaleIndicator(frameId, actualScalePercent);
      return;
    }

    applyPagesChange(
      (prev) =>
        prev.map((page) => {
          if (page.id !== currentPageId) return page;

          return {
            ...page,
            frames: page.frames.map((frame) => {
              if (frame.id !== frameId) return frame;
              if (!hasFrameImage(frame)) return frame;

              const nextFrame = {
                ...frame,
                imageScale: nextScale,
              };

              if (trimmingFrameId === frame.id) {
                return {
                  ...nextFrame,
                  ...clampFrameImageOffsetForTrimming(
                    nextFrame,
                    frame.imageOffsetX,
                    frame.imageOffsetY
                  ),
                };
              }

              const metrics = getFrameImageMetrics(nextFrame);

              return {
                ...nextFrame,
                imageOffsetX: clamp(
                  frame.imageOffsetX,
                  metrics.minOffsetX,
                  metrics.maxOffsetX
                ),
                imageOffsetY: clamp(
                  frame.imageOffsetY,
                  metrics.minOffsetY,
                  metrics.maxOffsetY
                ),
              };
            }),
          };
        }),
      { recordHistory: true }
    );

    showFrameImageScaleIndicator(frameId, actualScalePercent);
  };

  useEffect(() => {
    if (trimmingFrameId == null) return;

    const handleTrimmingFrameWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;

      const eventTarget = e.target as Element | null;
      const hitTarget = document.elementFromPoint(e.clientX, e.clientY);
      const frameElement =
        eventTarget?.closest?.("[data-canvas-object-type='frame'][data-canvas-object-id]") ??
        hitTarget?.closest?.("[data-canvas-object-type='frame'][data-canvas-object-id]");

      if (!(frameElement instanceof HTMLElement)) return;
      if (frameElement.dataset.canvasObjectId !== String(trimmingFrameId)) return;

      const frame = currentPage?.frames.find((item) => item.id === trimmingFrameId);
      if (!hasFrameImage(frame)) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      changeFrameImageScaleByWheel(trimmingFrameId, e.deltaY, !e.shiftKey);
    };

    window.addEventListener("wheel", handleTrimmingFrameWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener("wheel", handleTrimmingFrameWheel, {
        capture: true,
      });
    };
  }, [currentPage, trimmingFrameId]);

  useEffect(() => {
    if (
      openEditorSectionKey !== "frame-effect-line" ||
      selectedFrameIds.length !== 1
    ) {
      return;
    }

    const frameId = selectedFrameIds[0];

    const handleFrameEffectLineWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;

      const eventTarget = e.target as Element | null;
      const hitTarget = document.elementFromPoint(e.clientX, e.clientY);
      const frameElement =
        eventTarget?.closest?.("[data-canvas-object-type='frame'][data-canvas-object-id]") ??
        hitTarget?.closest?.("[data-canvas-object-type='frame'][data-canvas-object-id]");

      if (!(frameElement instanceof HTMLElement)) return;
      if (frameElement.dataset.canvasObjectId !== String(frameId)) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      changeFrameEffectLineInnerBlankByWheel(frameId, e.deltaY, !e.shiftKey);
    };

    window.addEventListener("wheel", handleFrameEffectLineWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener("wheel", handleFrameEffectLineWheel, {
        capture: true,
      });
    };
  }, [openEditorSectionKey, selectedFrameIds, currentPage]);

  const startFrameMove = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>,
    frame: Frame
  ) => {
    if (isProtectedCoverBaseFrame(currentPage, frame)) {
      e.preventDefault();
      e.stopPropagation();
      closeContextMenu();
      closePageMenu();
      closePageInsertMenu();
      focusCanvasTrap();
      setActiveTargetType("canvas");
      setSelectedPageIds([]);
      selectFrame(frame.id);
      setHoverFrameGuideId(frame.id);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    closeTopToolbarMenus();

    if (isInnerLockedFrame(frame)) return;

    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    focusCanvasTrap();

    setActiveTargetType("canvas");
    setSelectedPageIds([]);

    const additive = e.ctrlKey || e.metaKey;
    const alreadySelected = selectedItems.some(
      (item) => item.kind === "frame" && item.id === frame.id
    );

    let effectiveSelection: SelectedItem[];

    pendingSingleSelectOnMouseUpRef.current = null;

    if (additive) {
      if (alreadySelected) {
        effectiveSelection = selectedItems;
        setSelectedItems(
          sanitizeSelectedItems(
            selectedItems.filter(
              (item) => !(item.kind === "frame" && item.id === frame.id)
            )
          )
        );
      } else {
        effectiveSelection = sanitizeSelectedItems([
          ...selectedItems,
          { kind: "frame", id: frame.id },
        ]);
        setSelectedItems(effectiveSelection);
      }
    } else if (alreadySelected && selectedItems.length > 1) {
      effectiveSelection = moveSelectedItemToEnd(selectedItems, {
        kind: "frame",
        id: frame.id,
      });
      setSelectedItems(effectiveSelection);
      setPendingSingleSelectOnMouseUp({ kind: "frame", id: frame.id }, e);
    } else {
      effectiveSelection = [{ kind: "frame", id: frame.id }];
      setSelectedItems(effectiveSelection);
    }

    const frameStillSelected = effectiveSelection.some(
      (item) => item.kind === "frame" && item.id === frame.id
    );

    setHoverFrameGuideId(frameStillSelected ? frame.id : null);

    const rect = getPageRect();
    if (!rect || !currentPage) return;

    const mouseXPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseYPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const dragItems = buildDragItemsFromSelection(effectiveSelection, currentPage);

    setDragState({
      kind: "multi-move",
      items: dragItems,
      anchorKind: "frame",
      anchorId: frame.id,
      offsetX: mouseXPercent - frame.x,
      offsetY: mouseYPercent - frame.y,
      copyGhost: buildDragCopyGhostFromSelection(effectiveSelection, currentPage),
      hasMoved: false,
      historyPushed: false,
    });
  };

  const startFrameResize = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>,
    frame: Frame,
    resizeMode:
      | "left"
      | "right"
      | "top"
      | "bottom"
      | "top-left"
      | "top-right"
      | "bottom-left"
      | "bottom-right"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    closeTopToolbarMenus();
    focusCanvasTrap();

    if (isInnerLockedFrame(frame)) return;

    closeContextMenu();

    const additive = e.ctrlKey || e.metaKey;
    if (additive) {
      selectFrame(frame.id, { additive: true });
      return;
    }

    const alreadySelected = selectedFrameIds.includes(frame.id);
    const keepMultiSelection = alreadySelected && selectedFrameIds.length > 1;

    if (!keepMultiSelection) {
      selectFrame(frame.id);
    }

    const effectiveSelectedFrameIds = keepMultiSelection ? selectedFrameIds : [frame.id];

    const singleEdgeResizeMode =
      resizeMode === "left" ||
      resizeMode === "right" ||
      resizeMode === "top" ||
      resizeMode === "bottom"
        ? resizeMode
        : null;

  const linkedBuddies =
    currentPage && singleEdgeResizeMode && effectiveSelectedFrameIds.length >= 2
      ? getLinkedFrameIdsForResize(
          currentPage,
          frame,
          singleEdgeResizeMode,
          effectiveSelectedFrameIds
        )[singleEdgeResizeMode].filter(
          (item) => item.id !== INNER_LOCKED_FRAME_ID
        )
      : [];

      const startEdges = getFrameSnapEdges(frame);

      frameHandleInteractionLockRef.current = frame.id;

      setDragState({
        kind: "frame-resize",
        id: frame.id,
        resizeMode,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startW: frame.w,
        startH: frame.h,
        startX: frame.x,
        startY: frame.y,
        startLeftEdgeX: startEdges.left.p1.x,
        startRightEdgeX: startEdges.right.p1.x,
        startTopEdgeY: startEdges.top.p1.y,
        startBottomEdgeY: startEdges.bottom.p1.y,
        linkedBuddies,
        snapLock: null,
        hasMoved: false,
        historyPushed: false,
      });
    };

    const changeFrameScale = (frameId: number, delta: number) => {
      updateCurrentPage((page) => ({
        ...page,
        frames: page.frames.map((f) =>
          f.id === frameId
            ? {
                ...f,
                imageScale: clamp(
                  Number((f.imageScale + delta).toFixed(2)),
                  1,
                  4
                ),
              }
            : f
        ),
      }));
    };

  const changeFrameImageScaleDirect = (
    frameId: number,
    nextScale: number,
    options?: { recordHistory?: boolean }
  ) => {
    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                frames: page.frames.map((f) =>
                  f.id === frameId
                    ? {
                        ...f,
                        imageScale: clamp(nextScale, 1, 4),
                      }
                    : f
                ),
              }
            : page
        ),
      { recordHistory: options?.recordHistory ?? true }
    );
  };

  const moveFrameImage = (
    frameId: number,
    dx: number,
    dy: number,
    options?: { recordHistory?: boolean }
  ) => {
    applyPagesChange(
      (prev) =>
        prev.map((page) => {
          if (page.id !== currentPageId) return page;

          return {
            ...page,
            frames: page.frames.map((f) => {
              if (f.id !== frameId) return f;

              const metrics = getFrameImageMetrics(f);

              return {
                ...f,
                imageOffsetX: clamp(
                  f.imageOffsetX + dx,
                  metrics.minOffsetX,
                  metrics.maxOffsetX
                ),
                imageOffsetY: clamp(
                  f.imageOffsetY + dy,
                  metrics.minOffsetY,
                  metrics.maxOffsetY
                ),
              };
            }),
          };
        }),
      { recordHistory: options?.recordHistory ?? true }
    );
  };

  const resetFrameImage = (frameId: number) => {
    applyPagesChange(
      (prev) =>
        prev.map((page) => {
          if (page.id !== currentPageId) return page;

          return {
            ...page,
            frames: page.frames.map((f) =>
              f.id === frameId && hasFrameImage(f)
                ? {
                    ...f,
                    imageScale: 1,
                    imageOffsetX: 0,
                    imageOffsetY: 0,
                  }
                : f
            ),
          };
        }),
      { recordHistory: true }
    );

    setTrimmingFrameId(frameId);
    selectFrame(frameId);
    focusCanvasTrap();
  };

  const resetFrameEditorControls = (frameId: number) => {
    if (frameId === INNER_LOCKED_FRAME_ID) return;

    const targetFrameIds = (
      selectedFrameIds.length > 1 && selectedFrameIds.includes(frameId)
        ? selectedFrameIds
        : [frameId]
    ).filter((id) => id !== INNER_LOCKED_FRAME_ID);

    if (targetFrameIds.length === 0) return;

    applyPagesChange(
      (prev) =>
        prev.map((page) => {
          if (page.id !== currentPageId) return page;

          return {
            ...page,
            frames: page.frames.map((f) => {
              if (!targetFrameIds.includes(f.id)) return f;

              const isProtected = isProtectedCoverBaseFrame(page, f);
              const hasImageSource = getFrameImageSrc(f) != null;

              return {
                ...f,
                imageScale: hasImageSource ? 1 : f.imageScale,
                imageOffsetX: hasImageSource ? 0 : f.imageOffsetX,
                imageOffsetY: hasImageSource ? 0 : f.imageOffsetY,
                topTilt: 0,
                rightTilt: 0,
                bottomTilt: 0,
                leftTilt: 0,
                borderEnabled: isProtected ? f.borderEnabled : true,
                frameBorderVisible: isProtected
                  ? (f as FrameBorderVisibleState).frameBorderVisible
                  : true,
                effectLineEnabled: false,
                effectLineKind: FRAME_EFFECT_LINE_DEFAULTS.kind,
                effectLineColorMode: FRAME_EFFECT_LINE_DEFAULTS.colorMode,
                effectLineCustomColor: FRAME_EFFECT_LINE_DEFAULTS.customColor,
                effectLineStrokeWidth: FRAME_EFFECT_LINE_DEFAULTS.strokeWidth,
                effectLineDensity: FRAME_EFFECT_LINE_DEFAULTS.density,
                effectLineInnerBlank: FRAME_EFFECT_LINE_DEFAULTS.innerBlank,
                effectLineCenterX: FRAME_EFFECT_LINE_DEFAULTS.centerX,
                effectLineCenterY: FRAME_EFFECT_LINE_DEFAULTS.centerY,
                effectLineAngle: FRAME_EFFECT_LINE_DEFAULTS.angle,
              } as Frame;
            }),
          };
        }),
      { recordHistory: true }
    );

    setOpenEditorSectionKey(null);
    setSelectedFrameImageCardId(null);
    setTrimmingFrameId(null);
    setSuppressFrameSelectionOutlineByBorderSwitch(false);
    focusCanvasTrap();
  };

  const removeFrameImage = (frameId: number) => {
    updateCurrentPage((page) => ({
      ...page,
      frames: page.frames.map((f) =>
        f.id === frameId
          ? {
              ...f,
              image: null,
              imageId: undefined,
              imageOffsetX: 0,
              imageOffsetY: 0,
              imageScale: 1,
            }
          : f
      ),
    }));
  };

const MIN_FRAME_WIDTH = 14;
const MIN_FRAME_HEIGHT = 10;
const FRAME_MARGIN = 1;

const FRAME_SNAP_THRESHOLD_SCREEN_PX = 5;
const FRAME_EQUAL_GAP_THRESHOLD_SCREEN_PX = 0;

const screenPxToCanvasPercent = (px: number) => {
  const rect = pageRef.current?.getBoundingClientRect();
  if (px <= 0 || !rect || rect.width <= 0 || rect.height <= 0) return 0;

  const xPercent = (px / rect.width) * 100;
  const yPercent = (px / rect.height) * 100;

  return Math.max(xPercent, yPercent);
};

const FRAME_SNAP_THRESHOLD = screenPxToCanvasPercent(
  FRAME_SNAP_THRESHOLD_SCREEN_PX
);

const FRAME_EQUAL_GAP_THRESHOLD = screenPxToCanvasPercent(
  FRAME_EQUAL_GAP_THRESHOLD_SCREEN_PX
);

  const INNER_FRAME_X = 5;
  const INNER_FRAME_Y = 5;
  const INNER_FRAME_W = 90;
  const INNER_FRAME_H = 90;

  const INNER_FRAME_LEFT = INNER_FRAME_X;
  const INNER_FRAME_TOP = INNER_FRAME_Y;
  const INNER_FRAME_RIGHT = INNER_FRAME_X + INNER_FRAME_W;
  const INNER_FRAME_BOTTOM = INNER_FRAME_Y + INNER_FRAME_H;

  const clearFrameImageData = (frame: Frame): Frame =>
    resetFrameImageFlip({
      ...frame,
      image: null,
      imageId: undefined,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageScale: 1,
      imageNaturalWidth: 0,
      imageNaturalHeight: 0,
    } as Frame);

  const FRAME_TILT_STEP_5 = Number(
    (Math.tan((5 * Math.PI) / 180) * 100).toFixed(2)
  );

  const FRAME_TILT_STEP_10 = Number(
    (Math.tan((10 * Math.PI) / 180) * 100).toFixed(2)
  );

type TiltEdge = "top" | "right" | "bottom" | "left";

const TILT_STEPS: FrameTiltValue[] = [-10, -5, 0, 5, 10];

const snapTiltStep = (value: number): FrameTiltValue => {
  return TILT_STEPS.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
};


const SOUND_TILT_STEPS: SoundTiltValue[] = [-30, -20, -10, 0, 10, 20, 30];

const snapSoundTiltStep = (value: number): SoundTiltValue => {
  return SOUND_TILT_STEPS.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
};

const getFrameEdgeTilt = (frame: Frame, edge: TiltEdge): FrameTiltValue => {
  switch (edge) {
    case "top":
      return frame.topTilt;
    case "right":
      return frame.rightTilt;
    case "bottom":
      return frame.bottomTilt;
    case "left":
      return frame.leftTilt;
  }
};
const getSoundEdgeTilt = (sound: SoundText, edge: TiltEdge): SoundTiltValue => {
  switch (edge) {
    case "top":
      return sound.topTilt;
    case "right":
      return sound.rightTilt;
    case "bottom":
      return sound.bottomTilt;
    case "left":
      return sound.leftTilt;
  }
};

const setSoundEdgeTilt = (
  sound: SoundText,
  edge: TiltEdge,
  tilt: SoundTiltValue
): SoundText => {
  switch (edge) {
    case "top":
      return { ...sound, topTilt: tilt };
    case "right":
      return { ...sound, rightTilt: tilt };
    case "bottom":
      return { ...sound, bottomTilt: tilt };
    case "left":
      return { ...sound, leftTilt: tilt };
  }
};

const getFrameEdgeTiltFromPoints = (
  frame: Frame,
  edge: TiltEdge
): FrameTiltValue => {
  const points = getFramePolygonPointsAbsolute(frame);

  let p1: PercentPoint;
  let p2: PercentPoint;

  switch (edge) {
    case "top":
      p1 = points[0];
      p2 = points[1];
      break;
    case "right":
      p1 = points[1];
      p2 = points[2];
      break;
    case "bottom":
      p1 = points[3];
      p2 = points[2];
      break;
    case "left":
      p1 = points[0];
      p2 = points[3];
      break;
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let angle = 0;

  if (edge === "top" || edge === "bottom") {
    angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  } else {
    angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  }

  return snapTiltStep(angle);
};

const getFramePointsBounds = (points: PercentPoint[]) => {
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  return {
    minX,
    maxX,
    minY,
    maxY,
    w: Math.max(maxX - minX, 0.000001),
    h: Math.max(maxY - minY, 0.000001),
  };
};

const getFrameEdgeLineFromPoints = (
  points: PercentPoint[],
  edge: TiltEdge
) => {
  switch (edge) {
    case "top":
      return { p1: points[0], p2: points[1] };
    case "right":
      return { p1: points[1], p2: points[2] };
    case "bottom":
      return { p1: points[3], p2: points[2] };
    case "left":
      return { p1: points[0], p2: points[3] };
  }
};

const getLineMidpoint = (line: { p1: PercentPoint; p2: PercentPoint }) => ({
  x: (line.p1.x + line.p2.x) / 2,
  y: (line.p1.y + line.p2.y) / 2,
});

const buildTiltedEdgeLine = (
  frame: Frame,
  edge: TiltEdge,
  tilt: FrameTiltValue
) => {
  const points = getFramePolygonPointsAbsolute(frame);
  const bounds = getFramePointsBounds(points);
  const currentLine = getFrameEdgeLineFromPoints(points, edge);
  const center = getLineMidpoint(currentLine);
  const angleRad = (tilt * Math.PI) / 180;

  if (edge === "top" || edge === "bottom") {
    const halfW = bounds.w / 2;
    const halfDy = Math.tan(angleRad) * halfW;

    return {
      p1: {
        x: center.x - halfW,
        y: center.y - halfDy,
      },
      p2: {
        x: center.x + halfW,
        y: center.y + halfDy,
      },
    };
  }

  const halfH = bounds.h / 2;
  const halfDx = Math.tan(angleRad) * halfH;

  return {
    p1: {
      x: center.x - halfDx,
      y: center.y - halfH,
    },
    p2: {
      x: center.x + halfDx,
      y: center.y + halfH,
    },
  };
};

  const intersectTiltLines = (
    a1: PercentPoint,
    a2: PercentPoint,
    b1: PercentPoint,
    b2: PercentPoint
  ): PercentPoint | null => {
    const dax = a2.x - a1.x;
    const day = a2.y - a1.y;
    const dbx = b2.x - b1.x;
    const dby = b2.y - b1.y;

    const crossValue = dax * dby - day * dbx;
    if (Math.abs(crossValue) < 0.000001) {
      return null;
    }

    const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / crossValue;

    return {
      x: a1.x + dax * t,
      y: a1.y + day * t,
    };
  };

  const rebuildFrameWithPointsAndImage = (
    prevFrame: Frame,
    nextPoints: PercentPoint[],
    updatedTilt: { edge: TiltEdge; value: FrameTiltValue }
  ): Frame => {
    const bounds = getFramePointsBounds(nextPoints);

    let nextFrame: Frame = {
      ...prevFrame,
      x: bounds.minX,
      y: bounds.minY,
      w: bounds.w,
      h: bounds.h,
      points: nextPoints.map((p) => ({ x: p.x, y: p.y })) as [
        PercentPoint,
        PercentPoint,
        PercentPoint,
        PercentPoint
      ],
    };

    nextFrame = setFrameEdgeTilt(nextFrame, updatedTilt.edge, updatedTilt.value);

    if (!hasFrameImage(prevFrame)) {
      return nextFrame;
    }

    return keepFrameImageDisplayScale(prevFrame, nextFrame, {
      allowOverflowOffset: true,
    });
  };

  const tiltFrameWithPoints = (
    frame: Frame,
    edge: TiltEdge,
    nextTilt: FrameTiltValue
  ): Frame | null => {
    const points = getFramePolygonPointsAbsolute(frame);

    const top = edge === "top"
      ? buildTiltedEdgeLine(frame, "top", nextTilt)
      : getFrameEdgeLineFromPoints(points, "top");

    const right = edge === "right"
      ? buildTiltedEdgeLine(frame, "right", nextTilt)
      : getFrameEdgeLineFromPoints(points, "right");

    const bottom = edge === "bottom"
      ? buildTiltedEdgeLine(frame, "bottom", nextTilt)
      : getFrameEdgeLineFromPoints(points, "bottom");

    const left = edge === "left"
      ? buildTiltedEdgeLine(frame, "left", nextTilt)
      : getFrameEdgeLineFromPoints(points, "left");

    const tl = intersectTiltLines(top.p1, top.p2, left.p1, left.p2);
    const tr = intersectTiltLines(top.p1, top.p2, right.p1, right.p2);
    const br = intersectTiltLines(bottom.p1, bottom.p2, right.p1, right.p2);
    const bl = intersectTiltLines(bottom.p1, bottom.p2, left.p1, left.p2);

    if (!tl || !tr || !br || !bl) return null;

    const nextPoints = [tl, tr, br, bl];
    const bounds = getFramePointsBounds(nextPoints);

    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.minY) ||
      !Number.isFinite(bounds.maxY)
    ) {
      return null;
    }

    if (bounds.w < 2 || bounds.h < 2) return null;
    if (
      bounds.minX < -FRAME_BOUNDS_EPS ||
      bounds.maxX > 100 + FRAME_BOUNDS_EPS
    ) {
      return null;
    }
    if (
      bounds.minY < -FRAME_BOUNDS_EPS ||
      bounds.maxY > 100 + FRAME_BOUNDS_EPS
    ) {
      return null;
    }

    return rebuildFrameWithPointsAndImage(frame, nextPoints, {
      edge,
      value: nextTilt,
    });
  };

  const getFrameTiltHandlePagePoint = (
    frame: Frame,
    edge: TiltEdge
  ): PercentPoint => {
    const [tl, tr, br, bl] = getFramePolygonPointsAbsolute(frame);

    switch (edge) {
      case "top":
        return getPointOnLine(tl, tr, 0.25);
      case "right":
        return getPointOnLine(tr, br, 0.25);
      case "bottom":
        return getPointOnLine(bl, br, 0.75);
      case "left":
        return getPointOnLine(tl, bl, 0.75);
    }
  };

  const getNearestFrameTiltByPointer = (
    frame: Frame,
    edge: TiltEdge,
    pointer: PercentPoint
  ): FrameTiltValue => {
    let bestTilt = getFrameEdgeTiltFromPoints(frame, edge);
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidateTilt of TILT_STEPS) {
      const candidateFrame = tiltFrameWithPoints(frame, edge, candidateTilt);
      if (!candidateFrame || !isValidFramePolygonForTransform(candidateFrame)) {
        continue;
      }

      const handlePoint = getFrameTiltHandlePagePoint(candidateFrame, edge);
      const distance = Math.hypot(
        handlePoint.x - pointer.x,
        handlePoint.y - pointer.y
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestTilt = candidateTilt;
      }
    }

    return bestTilt;
  };

  const tiltFrameEdgeToMatchLineKeepingOpposite = (
    frame: Frame,
    edge: TiltEdge,
    targetLine: { p1: PercentPoint; p2: PercentPoint },
    nextTilt: FrameTiltValue
  ): Frame | null => {
    const points = getFramePolygonPointsAbsolute(frame);

    const top =
      edge === "top" ? targetLine : getFrameEdgeLineFromPoints(points, "top");
    const right =
      edge === "right" ? targetLine : getFrameEdgeLineFromPoints(points, "right");
    const bottom =
      edge === "bottom" ? targetLine : getFrameEdgeLineFromPoints(points, "bottom");
    const left =
      edge === "left" ? targetLine : getFrameEdgeLineFromPoints(points, "left");

    const tl = intersectTiltLines(top.p1, top.p2, left.p1, left.p2);
    const tr = intersectTiltLines(top.p1, top.p2, right.p1, right.p2);
    const br = intersectTiltLines(bottom.p1, bottom.p2, right.p1, right.p2);
    const bl = intersectTiltLines(bottom.p1, bottom.p2, left.p1, left.p2);

    if (!tl || !tr || !br || !bl) return null;

    const nextPoints = [tl, tr, br, bl];
    const bounds = getFramePointsBounds(nextPoints);

    if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX)) return null;
    if (!Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxY)) return null;
    if (bounds.w < 2 || bounds.h < 2) return null;
    if (
      bounds.minX < -FRAME_BOUNDS_EPS ||
      bounds.maxX > 100 + FRAME_BOUNDS_EPS
    ) {
      return null;
    }
    if (
      bounds.minY < -FRAME_BOUNDS_EPS ||
      bounds.maxY > 100 + FRAME_BOUNDS_EPS
    ) {
      return null;
    }

    return rebuildFrameWithPointsAndImage(frame, nextPoints, {
      edge,
      value: nextTilt,
    });
  };

  const setFrameEdgeTilt = (
    frame: Frame,
    edge: TiltEdge,
    tilt: FrameTiltValue
  ): Frame => {
    switch (edge) {
      case "top":
        return { ...frame, topTilt: tilt };
      case "right":
        return { ...frame, rightTilt: tilt };
      case "bottom":
        return { ...frame, bottomTilt: tilt };
      case "left":
        return { ...frame, leftTilt: tilt };
    }
  };

  const getOppositeTiltEdge = (edge: TiltEdge): TiltEdge => {
    switch (edge) {
      case "top":
        return "bottom";
      case "right":
        return "left";
      case "bottom":
        return "top";
      case "left":
        return "right";
    }
  };

  const rangesOverlap = (a1: number, a2: number, b1: number, b2: number, gap = 0.25) => {
    const minA = Math.min(a1, a2);
    const maxA = Math.max(a1, a2);
    const minB = Math.min(b1, b2);
    const maxB = Math.max(b1, b2);
    return Math.min(maxA, maxB) >= Math.max(minA, minB) - gap;
  };

  const almostEqual = (a: number, b: number, gap = 0.25) =>
    Math.abs(a - b) <= gap;

  const getLinkedFrameIdsForTilt = (
    page: Page,
    baseFrame: Frame,
    edge: TiltEdge,
    selectedIds?: number[]
  ) => {
    const linked = new Set<number>();
    const band = FRAME_SNAP_THRESHOLD;

    const baseEdges = getFrameSnapEdges(baseFrame);
    const baseEdge = baseEdges[edge];
    const oppositeEdgeName = getOppositeTiltEdge(edge);

    if (!selectedIds || selectedIds.length < 2) {
      return linked;
    }

    const selectedIdSet = new Set(
      selectedIds.filter((id) => id !== baseFrame.id && id !== INNER_LOCKED_FRAME_ID)
    );

    const targetFrames = page.frames.filter((frame) =>
      selectedIdSet.has(frame.id)
    );

    for (const frame of targetFrames) {
      const otherEdges = getFrameSnapEdges(frame);
      const otherEdge = otherEdges[oppositeEdgeName];

      const alignCandidate = getParallelEdgeAlignSnapVector(baseEdge, otherEdge);
      if (!alignCandidate) continue;
      if (alignCandidate.distance > band + 0.0001) continue;

      const baseDir = normalizeVector(getEdgeVector(baseEdge));
      if (!baseDir) continue;

      const overlap = getProjectedOverlapLength(baseEdge, otherEdge, baseDir);
      if (overlap >= -band) {
        linked.add(frame.id);
      }
    }

    return linked;
  };

const getLinkedFrameIdsForResize = (
  page: Page,
  baseFrame: Frame,
  resizeMode:
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right",
  selectedIds: number[]
): Record<
  "top" | "right" | "bottom" | "left",
  Array<{ id: number; edge: "top" | "right" | "bottom" | "left" }>
> => {
  const empty = {
    top: [],
    right: [],
    bottom: [],
    left: [],
  };

  if (selectedIds.length < 2) return empty;

  const selectedIdSet = new Set(
    selectedIds.filter(
      (id) => id !== baseFrame.id && id !== INNER_LOCKED_FRAME_ID
    )
  );

  const result: Record<
    "top" | "right" | "bottom" | "left",
    Array<{ id: number; edge: "top" | "right" | "bottom" | "left" }>
  > = {
    top: [],
    right: [],
    bottom: [],
    left: [],
  };

  const band = FRAME_SNAP_THRESHOLD;
  const baseEdges = getFrameSnapEdges(baseFrame);

  const addIfSameLine = (
    baseEdgeName: "top" | "right" | "bottom" | "left",
    buddyEdgeName: "top" | "right" | "bottom" | "left"
  ) => {
    const baseEdge = baseEdges[baseEdgeName];
    const baseDir = normalizeVector(getEdgeVector(baseEdge));
    if (!baseDir) return;

    for (const frame of page.frames) {
      if (!selectedIdSet.has(frame.id)) continue;

      const buddyEdge = getFrameSnapEdges(frame)[buddyEdgeName];

      const snap = getParallelEdgeAlignSnapVector(baseEdge, buddyEdge);
      if (!snap) continue;
      if (snap.distance > band + 0.0001) continue;

      const overlap = getProjectedOverlapLength(baseEdge, buddyEdge, baseDir);
      if (overlap < -band) continue;

      if (
        result[baseEdgeName].some(
          (item) => item.id === frame.id && item.edge === buddyEdgeName
        )
      ) {
        continue;
      }

      result[baseEdgeName].push({
        id: frame.id,
        edge: buddyEdgeName,
      });
    }
  };

  if (
    resizeMode === "top" ||
    resizeMode === "top-left" ||
    resizeMode === "top-right"
  ) {
    addIfSameLine("top", "top");
    addIfSameLine("top", "bottom");
  }

  if (
    resizeMode === "right" ||
    resizeMode === "top-right" ||
    resizeMode === "bottom-right"
  ) {
    addIfSameLine("right", "right");
    addIfSameLine("right", "left");
  }

  if (
    resizeMode === "bottom" ||
    resizeMode === "bottom-left" ||
    resizeMode === "bottom-right"
  ) {
    addIfSameLine("bottom", "bottom");
    addIfSameLine("bottom", "top");
  }

  if (
    resizeMode === "left" ||
    resizeMode === "top-left" ||
    resizeMode === "bottom-left"
  ) {
    addIfSameLine("left", "left");
    addIfSameLine("left", "right");
  }

  return result;
};

const startFrameTiltDrag = (
  e: MouseEvent | React.MouseEvent<HTMLDivElement>,
  frame: Frame,
  edge: TiltEdge
) => {
  e.preventDefault();
  e.stopPropagation();

  closeTopToolbarMenus();

  if (isInnerLockedFrame(frame)) return;

  closeContextMenu();

  const additive = e.ctrlKey || e.metaKey;
  if (additive) {
    selectFrame(frame.id, { additive: true });
    return;
  }

  const alreadySelected = selectedFrameIds.includes(frame.id);
  const keepMultiSelection = alreadySelected && selectedFrameIds.length > 1;

  const effectiveSelectedFrameIds = keepMultiSelection
    ? selectedFrameIds.filter((id) => id !== INNER_LOCKED_FRAME_ID)
    : [frame.id];

  if (!keepMultiSelection) {
    selectFrame(frame.id);
  }

  const linkedFrameIds =
    currentPage && effectiveSelectedFrameIds.length >= 2
      ? [
          ...getLinkedFrameIdsForTilt(
            currentPage,
            frame,
            edge,
            effectiveSelectedFrameIds
          ),
        ].filter((id) => id !== INNER_LOCKED_FRAME_ID)
      : [];

  frameTiltStartFrameRef.current = structuredClone(frame);

  frameHandleInteractionLockRef.current = frame.id;

  setDragState({
    kind: "frame-tilt",
    id: frame.id,
    edge,
    startMouseX: e.clientX,
    startMouseY: e.clientY,
    startTilt: getFrameEdgeTiltFromPoints(frame, edge),
    startFrame: structuredClone(frame),
    linkedFrameIds,
    hasMoved: false,
    historyPushed: false,
  });
};

function getFrameAbsoluteCenter(frame: Frame): PercentPoint {
  const points = getFrameAbsolutePoints(frame);
  const sum = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

function getSegmentOrientation(
  a: PercentPoint,
  b: PercentPoint,
  c: PercentPoint
) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function isPointOnSegment(
  a: PercentPoint,
  b: PercentPoint,
  p: PercentPoint,
  eps = 0.0001
) {
  return (
    Math.min(a.x, b.x) - eps <= p.x &&
    p.x <= Math.max(a.x, b.x) + eps &&
    Math.min(a.y, b.y) - eps <= p.y &&
    p.y <= Math.max(a.y, b.y) + eps
  );
}

function doSegmentsIntersect(
  a1: PercentPoint,
  a2: PercentPoint,
  b1: PercentPoint,
  b2: PercentPoint,
  eps = 0.0001
) {
  const o1 = getSegmentOrientation(a1, a2, b1);
  const o2 = getSegmentOrientation(a1, a2, b2);
  const o3 = getSegmentOrientation(b1, b2, a1);
  const o4 = getSegmentOrientation(b1, b2, a2);

  if (
    ((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) &&
    ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))
  ) {
    return true;
  }

  if (Math.abs(o1) <= eps && isPointOnSegment(a1, a2, b1, eps)) return true;
  if (Math.abs(o2) <= eps && isPointOnSegment(a1, a2, b2, eps)) return true;
  if (Math.abs(o3) <= eps && isPointOnSegment(b1, b2, a1, eps)) return true;
  if (Math.abs(o4) <= eps && isPointOnSegment(b1, b2, a2, eps)) return true;

  return false;
}

function isValidMergeQuad(
  points: [PercentPoint, PercentPoint, PercentPoint, PercentPoint]
) {
  const area = getPolygonSignedArea(points);
  if (Math.abs(area) < 0.0001) return false;

  const [tl, tr, br, bl] = points;

  if (doSegmentsIntersect(tl, tr, br, bl)) return false;
  if (doSegmentsIntersect(tr, br, bl, tl)) return false;

  const bounds = getPointsBounds(points);
  if (bounds.w < 0.0001 || bounds.h < 0.0001) return false;

  return true;
}

  function getMergedFramePoints(
    first: Frame,
    second: Frame,
    direction: "horizontal" | "vertical"
  ): [PercentPoint, PercentPoint, PercentPoint, PercentPoint] | null {
    const firstPoints = getFrameAbsolutePoints(first) as [
      PercentPoint,
      PercentPoint,
      PercentPoint,
      PercentPoint
    ];
    const secondPoints = getFrameAbsolutePoints(second) as [
      PercentPoint,
      PercentPoint,
      PercentPoint,
      PercentPoint
    ];

    if (direction === "horizontal") {
      const firstCenter = getFrameAbsoluteCenter(first);
      const secondCenter = getFrameAbsoluteCenter(second);

      const [leftPoints, rightPoints] =
        firstCenter.x <= secondCenter.x
          ? [firstPoints, secondPoints]
          : [secondPoints, firstPoints];

      const merged: [PercentPoint, PercentPoint, PercentPoint, PercentPoint] = [
        clonePercentPoint(leftPoints[0]),
        clonePercentPoint(rightPoints[1]),
        clonePercentPoint(rightPoints[2]),
        clonePercentPoint(leftPoints[3]),
      ];

      return isValidMergeQuad(merged) ? merged : null;
    }

    const firstCenter = getFrameAbsoluteCenter(first);
    const secondCenter = getFrameAbsoluteCenter(second);

    const [topPoints, bottomPoints] =
      firstCenter.y <= secondCenter.y
        ? [firstPoints, secondPoints]
        : [secondPoints, firstPoints];

    const merged: [PercentPoint, PercentPoint, PercentPoint, PercentPoint] = [
      clonePercentPoint(topPoints[0]),
      clonePercentPoint(topPoints[1]),
      clonePercentPoint(bottomPoints[2]),
      clonePercentPoint(bottomPoints[3]),
    ];

    return isValidMergeQuad(merged) ? merged : null;
  }

  const buildMergedFrame = (
    first: Frame,
    second: Frame,
    mergedBase: Frame,
    direction: "horizontal" | "vertical",
    preferredImageFrameId: number | null = null
  ): Frame => {
    const firstHasImage = hasFrameImage(first);
    const secondHasImage = hasFrameImage(second);
    const borderEnabled =
      (first.borderEnabled ?? true) || (second.borderEnabled ?? true);

    const mergedPoints = getMergedFramePoints(first, second, direction);

    const mergedShapeBase: Frame = mergedPoints
      ? (() => {
          const rebuilt = rebuildFrameFromAbsolutePoints(
            {
              ...mergedBase,
              points: mergedPoints,
            },
            mergedPoints
          );

          return {
            ...rebuilt,
            points: mergedPoints,
            topTilt: getEdgeTiltFromQuad(mergedPoints, "top"),
            rightTilt: getEdgeTiltFromQuad(mergedPoints, "right"),
            bottomTilt: getEdgeTiltFromQuad(mergedPoints, "bottom"),
            leftTilt: getEdgeTiltFromQuad(mergedPoints, "left"),
          };
        })()
      : mergedBase;

    const sourceFrame = (() => {
      if (firstHasImage && secondHasImage) {
        if (preferredImageFrameId === second.id) return second;
        return first;
      }

      if (firstHasImage) return first;
      if (secondHasImage) return second;
      return null;
    })();

    if (!sourceFrame) {
      return {
        ...clearFrameImageData(mergedShapeBase),
        borderEnabled,
      };
    }

    const mergedWithImage: Frame = {
      ...mergedShapeBase,
      borderEnabled,
      ...getFrameImagePayload(sourceFrame),
    };

    return keepFrameImageDisplayScale(sourceFrame, mergedWithImage, {
      allowOverflowOffset: true,
    });
  };

  function canSplitFrameVertical(frame: Frame, count: number) {
    if (count !== 2) return false;

    return splitFramePolygon(frame, "vertical", FRAME_MARGIN) !== null;
  }

  function canSplitFrameHorizontal(frame: Frame, count: number) {
    if (count !== 2) return false;

    return splitFramePolygon(frame, "horizontal", FRAME_MARGIN) !== null;
  }

  function getFitPreviewScale() {
    const area = mainAreaRef.current;
    if (!area) return 100;

    const rect = area.getBoundingClientRect();

    const widthScale = rect.width / PAGE_WIDTH;
    const heightScale = rect.height / PAGE_HEIGHT;

    return clamp(
      Math.floor(Math.min(widthScale, heightScale) * 100),
      25,
      200
    );
  }

  function fitPreviewToWindow() {
    setPreviewScale(getFitPreviewScale());
  }

  function isPreviewFitScale() {
    return Math.abs(previewScale - getFitPreviewScale()) <= 1;
  }

  function toggleFitPreviewScale() {
    setPreviewScale(isPreviewFitScale() ? 100 : getFitPreviewScale());
  }

  const getFrameEdges = (frame: { x: number; y: number; w: number; h: number }) => ({
    left: frame.x,
    right: frame.x + frame.w,
    top: frame.y,
    bottom: frame.y + frame.h,
  });

  const getInnerFrameEdges = () => ({
    left: INNER_FRAME_LEFT,
    right: INNER_FRAME_RIGHT,
    top: INNER_FRAME_TOP,
    bottom: INNER_FRAME_BOTTOM,
  });

  type SnapPoint = { x: number; y: number };
  type SnapEdgeName = "top" | "right" | "bottom" | "left";
  type SnapEdge = {
    name: SnapEdgeName;
    p1: SnapPoint;
    p2: SnapPoint;
  };

  const getFrameSnapEdges = (
    frameLike: {
      x: number;
      y: number;
      w: number;
      h: number;
      topTilt?: FrameTiltValue;
      rightTilt?: FrameTiltValue;
      bottomTilt?: FrameTiltValue;
      leftTilt?: FrameTiltValue;
    }
  ) => {
    const [tl, tr, br, bl] = getFramePolygonPointsAbsolute(frameLike);

    return {
      top: { name: "top" as const, p1: tl, p2: tr },
      right: { name: "right" as const, p1: tr, p2: br },
      bottom: { name: "bottom" as const, p1: bl, p2: br },
      left: { name: "left" as const, p1: tl, p2: bl },
      corners: { tl, tr, br, bl },
    };
  };

  const getSnapGuideLineFromEdge = (edge: SnapEdge): SnapGuideLine | null => {
    const dx = edge.p2.x - edge.p1.x;
    const dy = edge.p2.y - edge.p1.y;

    if (Math.abs(dx) < 0.000001 && Math.abs(dy) < 0.000001) {
      return null;
    }

    const points: PercentPoint[] = [];

    const addPoint = (point: PercentPoint) => {
      if (
        point.x < -0.0001 ||
        point.x > 100.0001 ||
        point.y < -0.0001 ||
        point.y > 100.0001
      ) {
        return;
      }

      if (
        points.some(
          (p) =>
            Math.abs(p.x - point.x) <= 0.0001 &&
            Math.abs(p.y - point.y) <= 0.0001
        )
      ) {
        return;
      }

      points.push({
        x: clamp(point.x, 0, 100),
        y: clamp(point.y, 0, 100),
      });
    };

    if (Math.abs(dx) > 0.000001) {
      const tLeft = (0 - edge.p1.x) / dx;
      addPoint({ x: 0, y: edge.p1.y + dy * tLeft });

      const tRight = (100 - edge.p1.x) / dx;
      addPoint({ x: 100, y: edge.p1.y + dy * tRight });
    }

    if (Math.abs(dy) > 0.000001) {
      const tTop = (0 - edge.p1.y) / dy;
      addPoint({ x: edge.p1.x + dx * tTop, y: 0 });

      const tBottom = (100 - edge.p1.y) / dy;
      addPoint({ x: edge.p1.x + dx * tBottom, y: 100 });
    }

    if (points.length < 2) return null;

    let bestA = points[0];
    let bestB = points[1];
    let bestDistance = -1;

    for (const a of points) {
      for (const b of points) {
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > bestDistance) {
          bestA = a;
          bestB = b;
          bestDistance = distance;
        }
      }
    }

    return {
      x1: bestA.x,
      y1: bestA.y,
      x2: bestB.x,
      y2: bestB.y,
    };
  };

  const collectSnappedGuideLines = (
    movingFrames: Frame[],
    stationaryFrames: Frame[]
  ): SnapGuideLine[] => {
    const lines = new Map<string, SnapGuideLine>();

    const addLine = (edge: SnapEdge) => {
      const line = getSnapGuideLineFromEdge(edge);
      if (!line) return;

      const key = [
        line.x1.toFixed(4),
        line.y1.toFixed(4),
        line.x2.toFixed(4),
        line.y2.toFixed(4),
      ].join(":");

      lines.set(key, line);
    };

    for (const movingFrame of movingFrames) {
      const movingEdges = getSnapEdgeList(getFrameSnapEdges(movingFrame));

      for (const stationaryFrame of stationaryFrames) {
        const otherEdges = getSnapEdgeList(getFrameSnapEdges(stationaryFrame));

        for (const movingEdge of movingEdges) {
          for (const otherEdge of otherEdges) {
            const parallelSnap = getParallelEdgeAlignSnapVector(
              movingEdge,
              otherEdge
            );

            const adjacentSnap = getAdjacentSameEdgeAlignSnapVector(
              movingEdge,
              otherEdge
            );

            if (parallelSnap && parallelSnap.distance <= 0.05) {
              addLine(otherEdge);
              continue;
            }

            if (adjacentSnap && adjacentSnap.distance <= 0.05) {
              addLine(otherEdge);
            }
          }
        }
      }
    }

    return [...lines.values()];
  };

  const getInnerFrameSnapEdges = () => {
    const tl = { x: INNER_FRAME_LEFT, y: INNER_FRAME_TOP };
    const tr = { x: INNER_FRAME_RIGHT, y: INNER_FRAME_TOP };
    const br = { x: INNER_FRAME_RIGHT, y: INNER_FRAME_BOTTOM };
    const bl = { x: INNER_FRAME_LEFT, y: INNER_FRAME_BOTTOM };

    return {
      top: { name: "top" as const, p1: tl, p2: tr },
      right: { name: "right" as const, p1: tr, p2: br },
      bottom: { name: "bottom" as const, p1: bl, p2: br },
      left: { name: "left" as const, p1: tl, p2: bl },
      corners: { tl, tr, br, bl },
    };
  };

  const edgeSpanOverlaps = (
    a1: number,
    a2: number,
    b1: number,
    b2: number,
    threshold = FRAME_SNAP_THRESHOLD
  ) => {
    const aMin = Math.min(a1, a2);
    const aMax = Math.max(a1, a2);
    const bMin = Math.min(b1, b2);
    const bMax = Math.max(b1, b2);

    return Math.min(aMax, bMax) >= Math.max(aMin, bMin) - threshold;
  };

  const getVerticalEdgeSnapDx = (
    moving: SnapEdge,
    other: SnapEdge,
    gap: number
  ): number | null => {
    const overlaps = edgeSpanOverlaps(
      moving.p1.y,
      moving.p2.y,
      other.p1.y,
      other.p2.y
    );

    if (!overlaps) return null;

    const dx1 = other.p1.x + gap - moving.p1.x;
    const dx2 = other.p2.x + gap - moving.p2.x;

    if (Math.abs(dx1 - dx2) > 0.0001) {
      return null;
    }

    return dx1;
  };

  const getHorizontalEdgeSnapDy = (
    moving: SnapEdge,
    other: SnapEdge,
    gap: number
  ): number | null => {
    const overlaps = edgeSpanOverlaps(
      moving.p1.x,
      moving.p2.x,
      other.p1.x,
      other.p2.x
    );

    if (!overlaps) return null;

    const dy1 = other.p1.y + gap - moving.p1.y;
    const dy2 = other.p2.y + gap - moving.p2.y;

    if (Math.abs(dy1 - dy2) > 0.0001) {
      return null;
    }

    return dy1;
  };

  const getCornerSnapDelta = (
    moving: SnapPoint,
    other: SnapPoint
  ) => ({
    dx: other.x - moving.x,
    dy: other.y - moving.y,
  });

   const getSnapEdgeList = (edges: ReturnType<typeof getFrameSnapEdges>) => [
    edges.top,
    edges.right,
    edges.bottom,
    edges.left,
  ];

  const getEdgeVector = (edge: SnapEdge) => ({
    x: edge.p2.x - edge.p1.x,
    y: edge.p2.y - edge.p1.y,
  });

  const getVectorLength = (v: { x: number; y: number }) =>
    Math.sqrt(v.x * v.x + v.y * v.y);

  const normalizeVector = (v: { x: number; y: number }) => {
    const len = getVectorLength(v);
    if (len < 0.0001) return null;
    return {
      x: v.x / len,
      y: v.y / len,
    };
  };

  const dot = (
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) => a.x * b.x + a.y * b.y;

  const cross = (
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) => a.x * b.y - a.y * b.x;

  const getEdgeMidPoint = (edge: SnapEdge) => ({
    x: (edge.p1.x + edge.p2.x) / 2,
    y: (edge.p1.y + edge.p2.y) / 2,
  });

  const isAllowedGapSnapByEdgeOrder = (
    moving: SnapEdge,
    other: SnapEdge,
    signedDistance: number
  ) => {
    if (moving.name === "bottom" && other.name === "top") {
      return signedDistance > 0;
    }

    if (moving.name === "top" && other.name === "bottom") {
      return signedDistance < 0;
    }

    if (moving.name === "right" && other.name === "left") {
      return signedDistance < 0;
    }

    if (moving.name === "left" && other.name === "right") {
      return signedDistance > 0;
    }

    return false;
  };

  const projectPointToAxis = (
    point: SnapPoint,
    origin: SnapPoint,
    axisDir: { x: number; y: number }
  ) => ({
    value:
      (point.x - origin.x) * axisDir.x + (point.y - origin.y) * axisDir.y,
  });

  const getProjectedOverlapLength = (
    moving: SnapEdge,
    other: SnapEdge,
    axisDir: { x: number; y: number }
  ) => {
    const m1 = projectPointToAxis(moving.p1, moving.p1, axisDir).value;
    const m2 = projectPointToAxis(moving.p2, moving.p1, axisDir).value;
    const o1 = projectPointToAxis(other.p1, moving.p1, axisDir).value;
    const o2 = projectPointToAxis(other.p2, moving.p1, axisDir).value;

    const mMin = Math.min(m1, m2);
    const mMax = Math.max(m1, m2);
    const oMin = Math.min(o1, o2);
    const oMax = Math.max(o1, o2);

    return Math.min(mMax, oMax) - Math.max(mMin, oMin);
  };

  const getParallelGapSnapVector = (
    moving: SnapEdge,
    other: SnapEdge,
    targetGap: number
  ): { dx: number; dy: number; distance: number } | null => {
    const movingVec = getEdgeVector(moving);
    const otherVec = getEdgeVector(other);

    const movingDir = normalizeVector(movingVec);
    const otherDir = normalizeVector(otherVec);

    if (!movingDir || !otherDir) return null;

    const parallelScore = Math.abs(cross(movingDir, otherDir));
    if (parallelScore > 0.22) return null;

    const overlap = getProjectedOverlapLength(moving, other, movingDir);
    if (overlap <= 0) return null;

    const normal = {
      x: -movingDir.y,
      y: movingDir.x,
    };

    const movingMid = getEdgeMidPoint(moving);
    const otherMid = getEdgeMidPoint(other);

    const currentSignedDistance = dot(
      {
        x: otherMid.x - movingMid.x,
        y: otherMid.y - movingMid.y,
      },
      normal
    );

    if (!isAllowedGapSnapByEdgeOrder(moving, other, currentSignedDistance)) {
      return null;
    }

    const targetSignedDistance =
      currentSignedDistance >= 0 ? targetGap : -targetGap;

    const shiftAmount = currentSignedDistance - targetSignedDistance;

    return {
      dx: normal.x * shiftAmount,
      dy: normal.y * shiftAmount,
      distance: Math.sqrt(
        (normal.x * shiftAmount) * (normal.x * shiftAmount) +
          (normal.y * shiftAmount) * (normal.y * shiftAmount)
      ),
    };
  };

  const shouldApplyResizeGapSnap = (
    prevMoving: SnapEdge,
    nextMoving: SnapEdge,
    other: SnapEdge,
    targetGap: number
  ) => {
    const movingVec = getEdgeVector(nextMoving);
    const otherVec = getEdgeVector(other);

    const movingDir = normalizeVector(movingVec);
    const otherDir = normalizeVector(otherVec);

    if (!movingDir || !otherDir) return false;

    // 平行チェック
    const parallelScore = Math.abs(cross(movingDir, otherDir));
    if (parallelScore > 0.22) return false;

    // 投影重なり
    const overlap = getProjectedOverlapLength(nextMoving, other, movingDir);
    if (overlap <= 0) return false;

    // 法線
    const normal = {
      x: -movingDir.y,
      y: movingDir.x,
    };

    const movingMid = getEdgeMidPoint(nextMoving);
    const otherMid = getEdgeMidPoint(other);

    // 👇 符号付き距離
    const signedDistance = dot(
      {
        x: otherMid.x - movingMid.x,
        y: otherMid.y - movingMid.y,
      },
      normal
    );

    if (!isAllowedGapSnapByEdgeOrder(nextMoving, other, signedDistance)) {
      return false;
    }

    // 👇 向きに依存しない距離
    const distance = Math.abs(signedDistance);

    // 👇 重なりはNG
    if (distance < 0.001) return false;

    const band = FRAME_SNAP_THRESHOLD;

    // 👇 距離だけで吸着（完全対称）
    return Math.abs(distance - targetGap) <= band;
  };

  const getParallelEdgeAlignSnapVector = (
    moving: SnapEdge,
    other: SnapEdge
  ): { dx: number; dy: number; distance: number } | null => {
    const movingVec = getEdgeVector(moving);
    const otherVec = getEdgeVector(other);

    const movingDir = normalizeVector(movingVec);
    const otherDir = normalizeVector(otherVec);

    if (!movingDir || !otherDir) return null;

    const parallelScore = Math.abs(cross(movingDir, otherDir));
    if (parallelScore > 0.0001) return null;

    const overlap = getProjectedOverlapLength(moving, other, movingDir);
    if (overlap < -FRAME_SNAP_THRESHOLD) return null;

    const normal = {
      x: -movingDir.y,
      y: movingDir.x,
    };

    const movingMid = getEdgeMidPoint(moving);
    const otherMid = getEdgeMidPoint(other);

    const signedDistance = dot(
      {
        x: otherMid.x - movingMid.x,
        y: otherMid.y - movingMid.y,
      },
      normal
    );

    return {
      dx: normal.x * signedDistance,
      dy: normal.y * signedDistance,
      distance: Math.abs(signedDistance),
    };
  };

  const getAdjacentSameEdgeAlignSnapVector = (
    moving: SnapEdge,
    other: SnapEdge
  ): { dx: number; dy: number; distance: number } | null => {
    if (moving.name !== other.name) return null;

    const movingVec = getEdgeVector(moving);
    const movingDir = normalizeVector(movingVec);
    if (!movingDir) return null;

    const overlap = getProjectedOverlapLength(moving, other, movingDir);
    if (overlap < -FRAME_SNAP_THRESHOLD) return null;

    return getParallelEdgeAlignSnapVector(moving, other);
  };

  const pickNearestSnapDelta = (
    a: number | null,
    b: number | null
  ): number | null => {
    if (a == null) return b;
    if (b == null) return a;
    return Math.abs(a) <= Math.abs(b) ? a : b;
  };

  const getEqualGapSnapDelta = ({
    frameId,
    nextX,
    nextY,
    nextW,
    nextH,
    frames,
    threshold = FRAME_EQUAL_GAP_THRESHOLD,
  }: {
    frameId: number;
    nextX: number;
    nextY: number;
    nextW: number;
    nextH: number;
    frames: Frame[];
    threshold?: number;
  }) => {
    const moving = {
      left: nextX,
      right: nextX + nextW,
      top: nextY,
      bottom: nextY + nextH,
    };

    let bestDx: number | null = null;
    let bestDy: number | null = null;

    const updateBest = (current: number | null, candidate: number) => {
      if (Math.abs(candidate) > threshold) return current;
      if (current == null) return candidate;
      return Math.abs(candidate) < Math.abs(current) ? candidate : current;
    };

    const others = frames
      .filter((f) => f.id !== frameId)
      .map((f) => ({
        id: f.id,
        ...getFrameEdges(f),
      }));

    for (const leftFrame of others) {
      for (const rightFrame of others) {
        if (leftFrame.id === rightFrame.id) continue;
        if (leftFrame.right > moving.left) continue;
        if (rightFrame.left < moving.right) continue;

        const targetLeft =
          (leftFrame.right + rightFrame.left - nextW) / 2;

        const dx = targetLeft - nextX;
        bestDx = updateBest(bestDx, dx);
      }
    }

    for (const topFrame of others) {
      for (const bottomFrame of others) {
        if (topFrame.id === bottomFrame.id) continue;
        if (topFrame.bottom > moving.top) continue;
        if (bottomFrame.top < moving.bottom) continue;

        const targetTop =
          (topFrame.bottom + bottomFrame.top - nextH) / 2;

        const dy = targetTop - nextY;
        bestDy = updateBest(bestDy, dy);
      }
    }

    return {
      dx: bestDx,
      dy: bestDy,
    };
  };

  const getFrameMarginSnapDelta = ({
    frameId,
    nextX,
    nextY,
    nextW,
    nextH,
    frames,
    threshold = FRAME_SNAP_THRESHOLD,
  }: {
    frameId: number;
    nextX: number;
    nextY: number;
    nextW: number;
    nextH: number;
    frames: Frame[];
    threshold?: number;
  }) => {
    const source = frames.find((f) => f.id === frameId);

    const movingFrame: Frame = {
      ...(source ?? {
        id: frameId,
        borderEnabled: true,
        image: null,
        imageId: undefined,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageNaturalWidth: 0,
        imageNaturalHeight: 0,
        topTilt: 0,
        rightTilt: 0,
        bottomTilt: 0,
        leftTilt: 0,
      }),
      x: nextX,
      y: nextY,
      w: nextW,
      h: nextH,
    };

    const movingEdges = getSnapEdgeList(getFrameSnapEdges(movingFrame));

    let bestDx: number | null = null;
    let bestDy: number | null = null;

    const updateBest = (current: number | null, candidate: number | null) => {
      if (candidate == null) return current;
      if (Math.abs(candidate) > threshold) return current;
      if (current == null) return candidate;
      return Math.abs(candidate) < Math.abs(current) ? candidate : current;
    };

    for (const frame of frames) {
      if (frame.id === frameId) continue;

      const otherEdges = getSnapEdgeList(getFrameSnapEdges(frame));

      for (const movingEdge of movingEdges) {
        for (const otherEdge of otherEdges) {
          const marginCandidate = getParallelGapSnapVector(
            movingEdge,
            otherEdge,
            FRAME_MARGIN
          );

          if (!marginCandidate) continue;

          if (Math.abs(marginCandidate.dx) <= threshold) {
            bestDx = updateBest(bestDx, marginCandidate.dx);
          }

          if (Math.abs(marginCandidate.dy) <= threshold) {
            bestDy = updateBest(bestDy, marginCandidate.dy);
          }
        }
      }
    }

    return {
      dx: bestDx,
      dy: bestDy,
    };
  };

  const getFrameMoveLineSnapDelta = ({
    frameId,
    nextX,
    nextY,
    nextW,
    nextH,
    frames,
    threshold = FRAME_SNAP_THRESHOLD,
  }: {
    frameId: number;
    nextX: number;
    nextY: number;
    nextW: number;
    nextH: number;
    frames: Frame[];
    threshold?: number;
  }) => {
    const source = frames.find((f) => f.id === frameId);

    const movingFrame: Frame = {
      ...(source ?? {
        id: frameId,
        borderEnabled: true,
        image: null,
        imageId: undefined,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageNaturalWidth: 0,
        imageNaturalHeight: 0,
        topTilt: 0,
        rightTilt: 0,
        bottomTilt: 0,
        leftTilt: 0,
      }),
      x: nextX,
      y: nextY,
      w: nextW,
      h: nextH,
    };

    const movingEdges = getSnapEdgeList(getFrameSnapEdges(movingFrame));

    let bestDx: number | null = null;
    let bestDy: number | null = null;

    const updateBest = (current: number | null, candidate: number | null) => {
      if (candidate == null) return current;
      if (Math.abs(candidate) > threshold) return current;
      if (current == null) return candidate;
      return Math.abs(candidate) < Math.abs(current) ? candidate : current;
    };

    const applyCandidate = (
      candidate: { dx: number; dy: number; distance: number } | null
    ) => {
      if (!candidate) return;

      if (Math.abs(candidate.dx) <= threshold) {
        bestDx = updateBest(bestDx, candidate.dx);
      }

      if (Math.abs(candidate.dy) <= threshold) {
        bestDy = updateBest(bestDy, candidate.dy);
      }
    };

    {
      const innerEdges = getSnapEdgeList(getInnerFrameSnapEdges());
      for (const moving of movingEdges) {
        for (const inner of innerEdges) {
          applyCandidate(getParallelEdgeAlignSnapVector(moving, inner));
        }
      }
    }

    for (const frame of frames) {
      if (frame.id === frameId) continue;

      const otherEdges = getSnapEdgeList(getFrameSnapEdges(frame));

      for (const moving of movingEdges) {
        for (const other of otherEdges) {
          applyCandidate(getParallelEdgeAlignSnapVector(moving, other));
        }
      }
    }

    return {
      dx: bestDx,
      dy: bestDy,
    };
  };

  const getFrameMoveAdjacentSameEdgeSnapDelta = ({
    frameId,
    nextX,
    nextY,
    nextW,
    nextH,
    frames,
    threshold = 1,
  }: {
    frameId: number;
    nextX: number;
    nextY: number;
    nextW: number;
    nextH: number;
    frames: Frame[];
    threshold?: number;
  }) => {
    const source = frames.find((f) => f.id === frameId);

    const movingFrame: Frame = {
      ...(source ?? {
        id: frameId,
        borderEnabled: true,
        image: null,
        imageId: undefined,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageNaturalWidth: 0,
        imageNaturalHeight: 0,
        topTilt: 0,
        rightTilt: 0,
        bottomTilt: 0,
        leftTilt: 0,
      }),
      x: nextX,
      y: nextY,
      w: nextW,
      h: nextH,
    };

    const movingEdges = getSnapEdgeList(getFrameSnapEdges(movingFrame));

    let bestDx: number | null = null;
    let bestDy: number | null = null;

    const updateBest = (current: number | null, candidate: number | null) => {
      if (candidate == null) return current;
      if (Math.abs(candidate) > threshold) return current;
      if (current == null) return candidate;
      return Math.abs(candidate) < Math.abs(current) ? candidate : current;
    };

    for (const frame of frames) {
      if (frame.id === frameId) continue;

      const otherEdges = getSnapEdgeList(getFrameSnapEdges(frame));

      for (const moving of movingEdges) {
        for (const other of otherEdges) {
          const candidate = getAdjacentSameEdgeAlignSnapVector(moving, other);
          if (!candidate) continue;

          if (Math.abs(candidate.dx) <= threshold) {
            bestDx = updateBest(bestDx, candidate.dx);
          }

          if (Math.abs(candidate.dy) <= threshold) {
            bestDy = updateBest(bestDy, candidate.dy);
          }
        }
      }
    }

    return {
      dx: bestDx,
      dy: bestDy,
    };
  };

  const getFrameMoveGapOnlySnapDelta = ({
    frameId,
    nextX,
    nextY,
    nextW,
    nextH,
    frames,
    threshold = FRAME_SNAP_THRESHOLD,
  }: {
    frameId: number;
    nextX: number;
    nextY: number;
    nextW: number;
    nextH: number;
    frames: Frame[];
    threshold?: number;
  }) => {
    const source = frames.find((f) => f.id === frameId);

    const movingFrame = {
      ...(source ?? {
  topTilt: 0,
  rightTilt: 0,
  bottomTilt: 0,
  leftTilt: 0,
}),
      x: nextX,
      y: nextY,
      w: nextW,
      h: nextH,
    };

    const movingEdges = getSnapEdgeList(getFrameSnapEdges(movingFrame));

    let bestDx: number | null = null;
    let bestDy: number | null = null;

    const updateBest = (current: number | null, candidate: number | null) => {
      if (candidate == null) return current;
      if (Math.abs(candidate) > threshold) return current;
      if (current == null) return candidate;
      return Math.abs(candidate) < Math.abs(current) ? candidate : current;
    };

    for (const frame of frames) {
      if (frame.id === frameId) continue;

      const otherEdges = getSnapEdgeList(getFrameSnapEdges(frame));

      for (const movingEdge of movingEdges) {
        for (const otherEdge of otherEdges) {
          const gapCandidate = getParallelGapSnapVector(
            movingEdge,
            otherEdge,
            FRAME_MARGIN
          );

          if (!gapCandidate) continue;

          if (Math.abs(gapCandidate.dx) <= threshold) {
            bestDx = updateBest(bestDx, gapCandidate.dx);
          }

          if (Math.abs(gapCandidate.dy) <= threshold) {
            bestDy = updateBest(bestDy, gapCandidate.dy);
          }
        }
      }
    }

    return {
      dx: bestDx,
      dy: bestDy,
    };
  };

  const getFrameResizeLineSnapDelta = ({
    nextFrame,
    frames,
    threshold = FRAME_SNAP_THRESHOLD,
  }: {
    nextFrame: Frame;
    frames: Frame[];
    threshold?: number;
  }) => {
    const nextMoving = getFrameSnapEdges(nextFrame);

    let bestTop: number | null = null;
    let bestRight: number | null = null;
    let bestBottom: number | null = null;
    let bestLeft: number | null = null;

    const updateBest = (current: number | null, candidate: number | null) => {
      if (candidate == null) return current;
      if (Math.abs(candidate) > threshold) return current;
      if (current == null) return candidate;
      return Math.abs(candidate) < Math.abs(current) ? candidate : current;
    };

    for (const frame of frames) {
      if (frame.id === nextFrame.id) continue;

      const otherEdges = getSnapEdgeList(getFrameSnapEdges(frame));

      for (const otherEdge of otherEdges) {
        const leftCandidate = getParallelEdgeAlignSnapVector(
          nextMoving.left,
          otherEdge
        );
        if (leftCandidate && Math.abs(leftCandidate.dx) <= threshold) {
          bestLeft = updateBest(bestLeft, leftCandidate.dx);
        }

        const rightCandidate = getParallelEdgeAlignSnapVector(
          nextMoving.right,
          otherEdge
        );
        if (rightCandidate && Math.abs(rightCandidate.dx) <= threshold) {
          bestRight = updateBest(bestRight, rightCandidate.dx);
        }

        const topCandidate = getParallelEdgeAlignSnapVector(
          nextMoving.top,
          otherEdge
        );
        if (topCandidate && Math.abs(topCandidate.dy) <= threshold) {
          bestTop = updateBest(bestTop, topCandidate.dy);
        }

        const bottomCandidate = getParallelEdgeAlignSnapVector(
          nextMoving.bottom,
          otherEdge
        );
        if (bottomCandidate && Math.abs(bottomCandidate.dy) <= threshold) {
          bestBottom = updateBest(bestBottom, bottomCandidate.dy);
        }
      }
    }

    return {
      leftDx: bestLeft,
      rightDx: bestRight,
      topDy: bestTop,
      bottomDy: bestBottom,
    };
  };

  const getFrameResizeAdjacentSameEdgeSnapDelta = ({
    nextFrame,
    frames,
    threshold = 1,
  }: {
    nextFrame: Frame;
    frames: Frame[];
    threshold?: number;
  }) => {
    const nextMoving = getFrameSnapEdges(nextFrame);

    let bestTop: number | null = null;
    let bestRight: number | null = null;
    let bestBottom: number | null = null;
    let bestLeft: number | null = null;

    const updateBest = (current: number | null, candidate: number | null) => {
      if (candidate == null) return current;
      if (Math.abs(candidate) > threshold) return current;
      if (current == null) return candidate;
      return Math.abs(candidate) < Math.abs(current) ? candidate : current;
    };

    for (const frame of frames) {
      if (frame.id === nextFrame.id) continue;

      const otherEdges = getSnapEdgeList(getFrameSnapEdges(frame));

      for (const otherEdge of otherEdges) {
        const leftCandidate = getAdjacentSameEdgeAlignSnapVector(
          nextMoving.left,
          otherEdge
        );
        if (leftCandidate && Math.abs(leftCandidate.dx) <= threshold) {
          bestLeft = updateBest(bestLeft, leftCandidate.dx);
        }

        const rightCandidate = getAdjacentSameEdgeAlignSnapVector(
          nextMoving.right,
          otherEdge
        );
        if (rightCandidate && Math.abs(rightCandidate.dx) <= threshold) {
          bestRight = updateBest(bestRight, rightCandidate.dx);
        }

        const topCandidate = getAdjacentSameEdgeAlignSnapVector(
          nextMoving.top,
          otherEdge
        );
        if (topCandidate && Math.abs(topCandidate.dy) <= threshold) {
          bestTop = updateBest(bestTop, topCandidate.dy);
        }

        const bottomCandidate = getAdjacentSameEdgeAlignSnapVector(
          nextMoving.bottom,
          otherEdge
        );
        if (bottomCandidate && Math.abs(bottomCandidate.dy) <= threshold) {
          bestBottom = updateBest(bestBottom, bottomCandidate.dy);
        }
      }
    }

    return {
      leftDx: bestLeft,
      rightDx: bestRight,
      topDy: bestTop,
      bottomDy: bestBottom,
    };
  };

  const getFrameResizeMarginSnapDelta = ({
    nextFrame,
    frames,
    threshold = FRAME_SNAP_THRESHOLD,
  }: {
    nextFrame: Frame;
    frames: Frame[];
    threshold?: number;
  }) => {
    return getFrameResizeLineSnapDelta({
      nextFrame,
      frames,
      threshold,
    });
  };

  const getResizeBuddyFrame = ({
    currentPage,
    selectedFrameIds,
    activeFrame,
    resizeMode,
  }: {
    currentPage: Page;
    selectedFrameIds: number[];
    activeFrame: Frame;
    resizeMode: "left" | "right" | "top" | "bottom";
  }) => {
    if (selectedFrameIds.length !== 2) return null;

    const buddy = currentPage.frames.find(
      (frame) => frame.id !== activeFrame.id && selectedFrameIds.includes(frame.id)
    );
    if (!buddy) return null;

    const activeEdges = getFrameSnapEdges(activeFrame);
    const buddyEdges = getFrameSnapEdges(buddy);

    const threshold = FRAME_SNAP_THRESHOLD;

    const overlapsOnEdgeDirection = (a: SnapEdge, b: SnapEdge) => {
      const dir = normalizeVector(getEdgeVector(a));
      if (!dir) return false;
      return getProjectedOverlapLength(a, b, dir) >= -threshold;
    };

    const isAligned = (a: SnapEdge, b: SnapEdge) => {
      const candidate = getParallelEdgeAlignSnapVector(a, b);
      if (!candidate) return false;
      return (
        Math.hypot(candidate.dx, candidate.dy) <= threshold &&
        overlapsOnEdgeDirection(a, b)
      );
    };

    switch (resizeMode) {
      case "left": {
        if (isAligned(activeEdges.left, buddyEdges.right)) {
          return { buddy, edge: "right" as const };
        }
        if (isAligned(activeEdges.left, buddyEdges.left)) {
          return { buddy, edge: "left" as const };
        }
        return null;
      }

      case "right": {
        if (isAligned(activeEdges.right, buddyEdges.left)) {
          return { buddy, edge: "left" as const };
        }
        if (isAligned(activeEdges.right, buddyEdges.right)) {
          return { buddy, edge: "right" as const };
        }
        return null;
      }

      case "top": {
        if (isAligned(activeEdges.top, buddyEdges.bottom)) {
          return { buddy, edge: "bottom" as const };
        }
        if (isAligned(activeEdges.top, buddyEdges.top)) {
          return { buddy, edge: "top" as const };
        }
        return null;
      }

      case "bottom": {
        if (isAligned(activeEdges.bottom, buddyEdges.top)) {
          return { buddy, edge: "top" as const };
        }
        if (isAligned(activeEdges.bottom, buddyEdges.bottom)) {
          return { buddy, edge: "bottom" as const };
        }
        return null;
      }
    }
  };

  const getBuddyResizeModeFromEdge = (
    edge: "left" | "right" | "top" | "bottom"
  ):
    | "left"
    | "right"
    | "top"
    | "bottom" => {
    switch (edge) {
      case "left":
        return "left";
      case "right":
        return "right";
      case "top":
        return "top";
      case "bottom":
        return "bottom";
    }
  };

  const FRAME_MERGE_EPSILON = 0.05;

  type MergeEdge = [PercentPoint, PercentPoint];

  const getMergeEdgePoints = (
    frame: Frame,
    edge: "top" | "right" | "bottom" | "left"
  ): MergeEdge => {
    const points = getFrameAbsolutePoints(frame) as [
      PercentPoint,
      PercentPoint,
      PercentPoint,
      PercentPoint
    ];

    switch (edge) {
      case "top":
        return [points[0], points[1]];
      case "right":
        return [points[1], points[2]];
      case "bottom":
        return [points[3], points[2]];
      case "left":
        return [points[0], points[3]];
    }
  };

  const getMergeFrameCenter = (frame: Frame) => {
    const points = getFrameAbsolutePoints(frame);
    const sum = points.reduce(
      (acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y,
      }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  };

  const normalizeMergeVector = (x: number, y: number) => {
    const length = Math.hypot(x, y);
    if (length < 0.000001) return null;

    return {
      x: x / length,
      y: y / length,
    };
  };

  const getMergeEdgeDirection = (edge: MergeEdge) => {
    return normalizeMergeVector(
      edge[1].x - edge[0].x,
      edge[1].y - edge[0].y
    );
  };

  const getMergeEdgeMidpoint = (edge: MergeEdge): PercentPoint => {
    return {
      x: (edge[0].x + edge[1].x) / 2,
      y: (edge[0].y + edge[1].y) / 2,
    };
  };

  const getMergePointToLineDistance = (
    point: PercentPoint,
    edge: MergeEdge
  ) => {
    const a = edge[0];
    const b = edge[1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);

    if (length < 0.000001) return Number.POSITIVE_INFINITY;

    return Math.abs(dx * (a.y - point.y) - dy * (a.x - point.x)) / length;
  };

  const getMergeEdgeGap = (edgeA: MergeEdge, edgeB: MergeEdge) => {
    const midA = getMergeEdgeMidpoint(edgeA);
    const midB = getMergeEdgeMidpoint(edgeB);

    return Math.max(
      getMergePointToLineDistance(midA, edgeB),
      getMergePointToLineDistance(midB, edgeA)
    );
  };

  const getMergeEdgeLength = (edge: MergeEdge) => {
    return Math.hypot(edge[1].x - edge[0].x, edge[1].y - edge[0].y);
  };

  const areMergeEdgesSameLength = (
    edgeA: MergeEdge,
    edgeB: MergeEdge,
    epsilon = FRAME_MERGE_EPSILON
  ) => {
    return Math.abs(getMergeEdgeLength(edgeA) - getMergeEdgeLength(edgeB)) <= epsilon;
  };

  const getMergeProjectedOverlap = (edgeA: MergeEdge, edgeB: MergeEdge) => {
    const dir = getMergeEdgeDirection(edgeA);
    if (!dir) return 0;

    const project = (point: PercentPoint) => point.x * dir.x + point.y * dir.y;

    const a0 = project(edgeA[0]);
    const a1 = project(edgeA[1]);
    const b0 = project(edgeB[0]);
    const b1 = project(edgeB[1]);

    const aMin = Math.min(a0, a1);
    const aMax = Math.max(a0, a1);
    const bMin = Math.min(b0, b1);
    const bMax = Math.max(b0, b1);

    return Math.min(aMax, bMax) - Math.max(aMin, bMin);
  };

  const areMergeEdgesNearlyParallel = (edgeA: MergeEdge, edgeB: MergeEdge) => {
    const dirA = getMergeEdgeDirection(edgeA);
    const dirB = getMergeEdgeDirection(edgeB);

    if (!dirA || !dirB) return false;

    const cross = Math.abs(dirA.x * dirB.y - dirA.y * dirB.x);
    return cross <= 0.08;
  };

  const canMergeEdgePair = (edgeA: MergeEdge, edgeB: MergeEdge) => {
    if (!areMergeEdgesNearlyParallel(edgeA, edgeB)) return false;

    // ★ 隣接辺の長さが同じでないなら結合不可
    if (!areMergeEdgesSameLength(edgeA, edgeB)) return false;

    const overlap = getMergeProjectedOverlap(edgeA, edgeB);
    if (overlap <= 2) return false;

    const gap = getMergeEdgeGap(edgeA, edgeB);
    return isNearlyEqual(gap, 0) || isNearlyEqual(gap, FRAME_MARGIN);
  };

  const buildMergeBaseFrame = (first: Frame, second: Frame): Frame => {
    const allPoints = [
      ...getFrameAbsolutePoints(first),
      ...getFrameAbsolutePoints(second),
    ];
    const bounds = getPointsBounds(allPoints);

    return {
      ...first,
      id: Date.now(),
      x: bounds.minX,
      y: bounds.minY,
      w: Math.max(bounds.w, 0.000001),
      h: Math.max(bounds.h, 0.000001),
    };
  };

  const isNearlyEqual = (a: number, b: number, epsilon = FRAME_MERGE_EPSILON) =>
    Math.abs(a - b) <= epsilon;

  const getMergeInfo = (
    frames: Frame[],
    selectedIds: number[],
    preferredImageFrameId: number | null = null
  ):
    | {
        direction: "horizontal" | "vertical";
        first: Frame;
        second: Frame;
        merged: Frame;
      }
    | null => {
    if (selectedIds.length !== 2) return null;

    const selectedFrames = frames.filter((f) => selectedIds.includes(f.id));
    if (selectedFrames.length !== 2) return null;

    const [a, b] = selectedFrames;

    const aTop = getMergeEdgePoints(a, "top");
    const aRight = getMergeEdgePoints(a, "right");
    const aBottom = getMergeEdgePoints(a, "bottom");
    const aLeft = getMergeEdgePoints(a, "left");

    const bTop = getMergeEdgePoints(b, "top");
    const bRight = getMergeEdgePoints(b, "right");
    const bBottom = getMergeEdgePoints(b, "bottom");
    const bLeft = getMergeEdgePoints(b, "left");

    const aCenter = getMergeFrameCenter(a);
    const bCenter = getMergeFrameCenter(b);

    // 左右結合
    if (canMergeEdgePair(aRight, bLeft) || canMergeEdgePair(bRight, aLeft)) {
      const [leftFrame, rightFrame] =
        aCenter.x <= bCenter.x ? [a, b] : [b, a];

      const mergedBase = buildMergeBaseFrame(leftFrame, rightFrame);

      return {
        direction: "horizontal",
        first: leftFrame,
        second: rightFrame,
        merged: buildMergedFrame(
          leftFrame,
          rightFrame,
          mergedBase,
          "horizontal",
          preferredImageFrameId
        ),
      };
    }

    // 上下結合
    if (canMergeEdgePair(aBottom, bTop) || canMergeEdgePair(bBottom, aTop)) {
      const [topFrame, bottomFrame] =
        aCenter.y <= bCenter.y ? [a, b] : [b, a];

      const mergedBase = buildMergeBaseFrame(topFrame, bottomFrame);

      return {
        direction: "vertical",
        first: topFrame,
        second: bottomFrame,
        merged: buildMergedFrame(
          topFrame,
          bottomFrame,
          mergedBase,
          "vertical",
          preferredImageFrameId
        ),
      };
    }

    return null;
  };

  const canMergeSelectedFrames = (page: Page | null, selectedIds: number[]) => {
    if (!page) return false;
    return getMergeInfo(page.frames, selectedIds) !== null;
  };

  const getFrameCenterPastePoint = (frame: Frame) => {
    return getFramePolygonCenterPoint(frame);
  };

  const splitFrameVertical = (frameId: number, count: 2 | 3) => {
    updateCurrentPage((page) => {
      const source = page.frames.find((f) => f.id === frameId);
      if (!source) return page;
      if (isProtectedCoverBaseFrame(page, source)) return page;
      if (!canSplitFrameVertical(source, count)) return page;

      const lerpTilt = (a: number, b: number, t: number): FrameTiltValue => {
        return snapTiltStep(a + (b - a) * t);
      };

      const childW = source.w / count;
      const baseId = Date.now();

      const newFrames: Frame[] = Array.from({ length: count }, (_, i) => {
        const t0 = i / count;
        const t1 = (i + 1) / count;

        const nextFrame: Frame = {
          ...source,
          id: baseId + i,
          x: source.x + i * childW,
          y: source.y,
          w: childW,
          h: source.h,

          topTilt: source.topTilt,
          bottomTilt: source.bottomTilt,
          leftTilt: lerpTilt(source.leftTilt, source.rightTilt, t0),
          rightTilt: lerpTilt(source.leftTilt, source.rightTilt, t1),
        };

        return i === count - 1 ? nextFrame : clearFrameImageData(nextFrame);
      });

      return {
        ...page,
        frames: page.frames.flatMap((f) => (f.id === frameId ? newFrames : [f])),
      };
    });

    closeContextMenu();
  };

  const splitFrameHorizontal = (frameId: number, count: 2 | 3) => {
    updateCurrentPage((page) => {
      const source = page.frames.find((f) => f.id === frameId);
      if (!source) return page;
      if (isProtectedCoverBaseFrame(page, source)) return page;
      if (!canSplitFrameHorizontal(source, count)) return page;

      const childH = source.h / count;
      const baseId = Date.now();

      const newFrames: Frame[] = Array.from({ length: count }, (_, i) => {
        const isFirst = i === 0;
        const isLast = i === count - 1;

        const nextFrame: Frame = {
          ...source,
          id: baseId + i,
          x: source.x,
          y: source.y + i * childH,
          w: source.w,
          h: childH,

          topTilt: isFirst ? source.topTilt : 0,
          bottomTilt: isLast ? source.bottomTilt : 0,
          leftTilt: source.leftTilt,
          rightTilt: source.rightTilt,
        };

        return i === 0 ? nextFrame : clearFrameImageData(nextFrame);
      });

      return {
        ...page,
        frames: page.frames.flatMap((f) => (f.id === frameId ? newFrames : [f])),
      };
    });

    closeContextMenu();
  };

  const mergeSelectedFrames = () => {
    if (!currentPage) return;
    if (selectedFrameIds.some((id) => {
      const frame = currentPage.frames.find((item) => item.id === id);
      return isProtectedCoverBaseFrame(currentPage, frame);
    })) return;

    const preferredImageFrameId =
      contextMenu.target?.kind === "frame" ? contextMenu.target.id : null;
    const mergeInfo = getMergeInfo(
      currentPage.frames,
      selectedFrameIds,
      preferredImageFrameId
    );
    if (!mergeInfo) return;

    const removeIds = [mergeInfo.first.id, mergeInfo.second.id];
    const mergedFrame = mergeInfo.merged;

    updateCurrentPage((page) => ({
      ...page,
      frames: [
        ...page.frames.filter((f) => !removeIds.includes(f.id)),
        mergedFrame,
      ],
    }));

    setSelectedItems([{ kind: "frame", id: mergedFrame.id }]);
    closeContextMenu();
  };

  const bringFrameToFront = (frameId: number) => {
    updateCurrentPage((page) => {
      const target = page.frames.find((f) => f.id === frameId);
      if (!target) return page;
      if (isProtectedCoverBaseFrame(page, target)) return page;

      const others = page.frames.filter((f) => f.id !== frameId);

      return {
        ...page,
        frames: [...others, target],
      };
    });
  };

  const sendFrameToBack = (frameId: number) => {
    updateCurrentPage((page) => {
      const target = page.frames.find((f) => f.id === frameId);
      if (!target) return page;
      if (isProtectedCoverBaseFrame(page, target)) return page;

      const protectedFrames = page.frames.filter((f) => isProtectedCoverBaseFrame(page, f));
      const others = page.frames.filter(
        (f) => f.id !== frameId && !isProtectedCoverBaseFrame(page, f)
      );

      return {
        ...page,
        frames: [...protectedFrames, target, ...others],
      };
    });
  };

  const moveFrameLayerBy = (
    frameId: number,
    direction: "forward" | "backward"
  ) => {
    updateCurrentPage((page) => {
      const frames = [...page.frames];
      const index = frames.findIndex((f) => f.id === frameId);
      if (index < 0) return page;
      if (isProtectedCoverBaseFrame(page, frames[index])) return page;

      if (direction === "forward") {
        if (index === frames.length - 1) return page;
        [frames[index], frames[index + 1]] = [frames[index + 1], frames[index]];
      } else {
        const previous = frames[index - 1];
        if (!previous || isProtectedCoverBaseFrame(page, previous)) return page;
        [frames[index - 1], frames[index]] = [frames[index], frames[index - 1]];
      }

      return {
        ...page,
        frames,
      };
    });
  };

  const getTopmostSelectedFrameId = () => {
    if (!currentPage || selectedFrameIds.length === 0) return null;

    const selectedFrames = currentPage.frames.filter((f) =>
      selectedFrameIds.includes(f.id)
    );
    if (selectedFrames.length === 0) return null;

    return selectedFrames[selectedFrames.length - 1].id;
  };

  const handleAddFrame = () => {
    const newId = Date.now();

    updateCurrentPage((page) => {
      const frameW = 45;
      const frameH = 45;
      const visibleCenter = getVisiblePageCenterPercent();
      const offset = 1;

      let nextX = clamp(visibleCenter.x - frameW / 2, 0, 100 - frameW);
      let nextY = clamp(visibleCenter.y - frameH / 2, 0, 100 - frameH);

      const last = lastAddedFrameRef.current;

      if (last && last.pageId === page.id) {
        const existing = page.frames.find((f) => f.id === last.id);

        if (
          existing &&
          existing.x === last.x &&
          existing.y === last.y &&
          Math.abs(existing.x - nextX) <= 5 &&
          Math.abs(existing.y - nextY) <= 5
        ) {
          nextX = clamp(existing.x + offset, 0, 100 - frameW);
          nextY = clamp(existing.y + offset, 0, 100 - frameH);
        }
      }

      const frame: Frame = {
        id: newId,
        x: nextX,
        y: nextY,
        w: frameW,
        h: frameH,
        borderEnabled: true,
        topTilt: 0,
        rightTilt: 0,
        bottomTilt: 0,
        leftTilt: 0,
        image: null,
        imageId: undefined,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageNaturalWidth: 0,
        imageNaturalHeight: 0,
      };

      lastAddedFrameRef.current = {
        pageId: page.id,
        id: frame.id,
        x: frame.x,
        y: frame.y,
      };

      return {
        ...page,
        frames: [...page.frames, frame],
      };
    });

    setSelectedItems([{ kind: "frame", id: newId }]);
    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setDragState(null);
    setSnapGuideLines([]);
    trackFrameAdd();
    closeContextMenu();
    focusCanvasTrap();
  };
  
  const handleInsertPageAt = (insertIndex: number) => {
    const newPage = createNewPage(Date.now());

    applyPagesChange((prev) => {
      const next = [...prev];
      const safeIndex = clampContentInsertIndex(insertIndex, next.length);
      next.splice(safeIndex, 0, newPage);
      return next;
    });

    skipPageListAutoScrollRef.current = insertIndex === 0;

    setCurrentPageId(newPage.id);
    setSelectedPageIds([newPage.id]);
    lastSelectedPageIdRef.current = newPage.id;

    setSelectedItems([]);
    trackPageAdd();
    closePageMenu();
    closePageInsertMenu();
    focusPageListAfterPageMenuAction();
  };

  const handleTogglePageVisible = (pageId: number) => {
    applyPagesChange((prev) =>
      prev.map((page) =>
        page.id === pageId
          ? {
              ...page,
              visible: page.visible === false,
            }
          : page
      )
    );
  };

  const clonePageForPaste = (source: Page, index: number): Page => {
    const baseId = Date.now() + index * 10000;

    return {
      ...structuredClone(source),
      id: baseId,
      frames: source.frames.map((frame, frameIndex) =>
        isInnerLockedFrame(frame)
          ? createInnerLockedFrame()
          : {
              ...structuredClone(frame),
              id: baseId + frameIndex + 1,
            }
      ),
      bubbles: source.bubbles.map((bubble, bubbleIndex) => ({
        ...structuredClone(bubble),
        id: baseId + 1000 + bubbleIndex,
      })),
      sounds: source.sounds.map((sound, soundIndex) => ({
        ...structuredClone(sound),
        id: baseId + 2000 + soundIndex,
      })),
    };
  };

  const getPageMenuTargetIds = (pageId: number) => {
    return selectedPageIds.includes(pageId) ? selectedPageIds : [pageId];
  };

  const handleCutPages = (pageId: number) => {
    const targetIds = getPageMenuTargetIds(pageId).filter((id) => !isSpecialCoverPageId(id));
    const targetSet = new Set(targetIds);
    const targetPages = pages.filter((page) => targetSet.has(page.id));

    if (targetPages.length === 0) return;

    const snapshot = structuredClone(targetPages);

    setPageClipboard({
      mode: "cut",
      pages: snapshot,
    });

    setClipboardItem(null);

    applyPagesChange((prev) => {
      const next = prev.filter((page) => !targetSet.has(page.id));

      const nextCurrent =
        next.find((page) => page.id === currentPageId) ??
        next[
          Math.min(
            Math.max(0, prev.findIndex((page) => targetSet.has(page.id))),
            Math.max(0, next.length - 1)
          )
        ] ??
        null;

      setCurrentPageId(nextCurrent?.id ?? null);
      setSelectedPageIds(nextCurrent ? [nextCurrent.id] : []);
      lastSelectedPageIdRef.current = nextCurrent?.id ?? null;

      return next;
    });

    setSelectedItems([]);
    closePageMenu();
    focusPageListAfterPageMenuAction();
  };

  const handleCopyPages = (pageId: number) => {
    const targetIds = getPageMenuTargetIds(pageId).filter((id) => !isSpecialCoverPageId(id));
    const targetSet = new Set(targetIds);
    const targetPages = pages.filter((page) => targetSet.has(page.id));

    if (targetPages.length === 0) return;

    setPageClipboard({
      mode: "copy",
      pages: structuredClone(targetPages),
    });

    setClipboardItem(null);
    closePageMenu();
    focusPageListAfterPageMenuAction();
  };

  const handlePastePagesAfter = (pageId: number) => {
    if (!pageClipboard || pageClipboard.pages.length === 0) return;

    const pastedPages = pageClipboard.pages.map((page, index) =>
      clonePageForPaste(page, index)
    );

    applyPagesChange((prev) => {
      const targetIndex = prev.findIndex((page) => page.id === pageId);
      if (targetIndex < 0) return prev;

      const next = [...prev];
      const safeIndex = clampContentInsertIndex(targetIndex + 1, next.length);
      next.splice(safeIndex, 0, ...pastedPages);

      return next;
    });

    setCurrentPageId(pastedPages[pastedPages.length - 1].id);
    setSelectedPageIds(pastedPages.map((page) => page.id));
    lastSelectedPageIdRef.current = pastedPages[pastedPages.length - 1].id;

    setSelectedItems([]);
    closePageMenu();
    focusPageListAfterPageMenuAction();
  };

  const handlePastePagesAt = (insertIndex: number) => {
    if (!pageClipboard || pageClipboard.pages.length === 0) return;

    const pastedPages = pageClipboard.pages.map((page, index) =>
      clonePageForPaste(page, index)
    );

    applyPagesChange((prev) => {
      const next = [...prev];
      const safeIndex = clampContentInsertIndex(insertIndex, next.length);
      next.splice(safeIndex, 0, ...pastedPages);
      return next;
    });

    setCurrentPageId(pastedPages[pastedPages.length - 1].id);
    setSelectedPageIds(pastedPages.map((page) => page.id));
    lastSelectedPageIdRef.current = pastedPages[pastedPages.length - 1].id;

    setSelectedItems([]);
    closePageInsertMenu();
    focusPageListAfterPageMenuAction();
  };

  const handleDeletePages = (
    pageIds: number[],
    options: { flashEmptyPageMainArea?: boolean } = {}
  ) => {
    const deleteSet = new Set(pageIds.filter((pageId) => !isSpecialCoverPageId(pageId)));
    if (deleteSet.size === 0) {
      closePageMenu();
      focusPageListAfterPageMenuAction();
      return;
    }

    const contentPages = pages.filter((page) => !isSpecialCoverPageIdValue(page.id));
    const willDeleteAllContentPages =
      contentPages.length > 0 && contentPages.every((page) => deleteSet.has(page.id));

    if (willDeleteAllContentPages) {
      const prevPages = clonePages(pagesRef.current);
      const nextPages = prevPages.filter((page) => !deleteSet.has(page.id));

      setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(prevPages)));
      setRedoStack([]);
      setPages(nextPages);
      setHasUnsavedChanges(true);

      const nextCurrent = hasCovers
        ? nextPages.find((page) => !deleteSet.has(page.id)) ?? null
        : null;

      setCurrentPageId(nextCurrent?.id ?? null);
      setSelectedPageIds([]);
      lastSelectedPageIdRef.current = null;
      setSelectedItems([]);
      closePageMenu();
      focusPageListAfterPageMenuAction();
      return;
    }

    applyPagesChange((prev) => {
      const next = prev.filter((page) => !deleteSet.has(page.id));
      const nextContentPage = getFirstContentPage(next);

      const nextCurrent =
        next.find((page) => page.id === currentPageId && !deleteSet.has(page.id)) ??
        nextContentPage ??
        (hasCovers ? next.find((page) => !deleteSet.has(page.id)) ?? null : null);

      setCurrentPageId(nextCurrent?.id ?? null);
      setSelectedPageIds(nextCurrent && !isSpecialCoverPageId(nextCurrent.id) ? [nextCurrent.id] : []);
      lastSelectedPageIdRef.current = nextCurrent?.id ?? null;

      return next;
    });

    setSelectedItems([]);
    closePageMenu();
    focusPageListAfterPageMenuAction();
  };

  const handleDuplicatePage = (pageId: number) => {
    if (isSpecialCoverPageId(pageId)) return;

    const sourceIndex = pages.findIndex((p) => p.id === pageId);
    if (sourceIndex < 0) return;

    const source = pages[sourceIndex];
    const newId = Date.now();

    const clonedPage: Page = {
      ...source,
      id: newId,
      frames: ensureInnerLockedFrame(
        source.frames
          .filter((f) => !isInnerLockedFrame(f))
          .map((f) => ({
            ...f,
            id: Date.now() + Math.random(),
          }))
      ),
      bubbles: source.bubbles.map((b) => ({
        ...b,
        id: Date.now() + Math.random(),
      })),
      sounds: source.sounds.map((s) => ({
        ...s,
        id: Date.now() + Math.random(),
      })),
    };

    applyPagesChange((prev) => {
      const next = [...prev];
      next.splice(sourceIndex + 1, 0, clonedPage);
      return next;
    });

    setCurrentPageId(newId);
    setSelectedItems([]);
    closeContextMenu();
    closePageMenu();
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    applyPagesChange((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length
      ) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const startPageMoveRepeat = (pageId: number, direction: "up" | "down") => {
    stopPageMoveRepeat();

    const ensurePageMoveHistory = () => {
      if (!pageMoveRepeatHistoryPushedRef.current) {
        pushHistorySnapshot();
        pageMoveRepeatHistoryPushedRef.current = true;
      }
    };

    const stop = () => {
      stopPageMoveRepeat();
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("mouseleave", stop);
      window.removeEventListener("blur", stop);
    };

    window.addEventListener("mouseup", stop);
    window.addEventListener("mouseleave", stop);
    window.addEventListener("blur", stop);

    ensurePageMoveHistory();
    handleMovePage(pageId, direction, { recordHistory: false });

    pageMoveRepeatTimeoutRef.current = window.setTimeout(() => {
      pageMoveRepeatIntervalRef.current = window.setInterval(() => {
        ensurePageMoveHistory();
        handleMovePage(pageId, direction, { recordHistory: false });
      }, 40);
    }, 250);
  };

  const handleMovePage = (
    pageId: number,
    direction: "up" | "down",
    options?: { recordHistory?: boolean }
  ) => {
    if (isSpecialCoverPageId(pageId)) {
      stopPageMoveRepeat();
      return;
    }

    const currentIndex = pages.findIndex((p) => p.id === pageId);
    if (currentIndex < 0) {
      stopPageMoveRepeat();
      return;
    }

    if (direction === "up" && currentIndex <= 1) {
      stopPageMoveRepeat();
      return;
    }

    if (direction === "down" && currentIndex >= pages.length - 2) {
      stopPageMoveRepeat();
      return;
    }

    applyPagesChange(
      (prev) => {
        const nowIndex = prev.findIndex((p) => p.id === pageId);
        if (nowIndex < 0) return prev;

        const targetIndex = direction === "up" ? nowIndex - 1 : nowIndex + 1;
        if (targetIndex < 1 || targetIndex >= prev.length - 1) return prev;

        const next = [...prev];
        const [moved] = next.splice(nowIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      },
      { recordHistory: options?.recordHistory ?? true }
    );

    setCurrentPageId(pageId);
    setSelectedItems([]);
  };

  const handlePageDragStart = (pageId: number) => {
    if (isSpecialCoverPageId(pageId)) return;

    setPressedPageCardId(pageId);
    setDraggingPageId(pageId);
    setDragOverPageId(pageId);
    setIsPageDragCopying(false);

    if (!selectedPageIds.includes(pageId)) {
      setSelectedPageIds([pageId]);
      lastSelectedPageIdRef.current = pageId;
      setCurrentPageId(pageId);
    }

    closePageMenu();
    closeContextMenu();
  };

  const handlePageDragEnd = () => {
    setDraggingPageId(null);
    setPressedPageCardId(null);
    setDragOverPageId(null);
    setDragOverInsertBarKey(null);
    setIsPageDragCopying(false);
  };

  const handlePageDropToIndex = (insertIndex: number, isCopy: boolean) => {
    if (draggingPageId == null) {
      setDraggingPageId(null);
      setDragOverPageId(null);
    setDragOverInsertBarKey(null);
      setIsPageDragCopying(false);
      return;
    }

    const movingPageIds = (selectedPageIds.includes(draggingPageId)
      ? selectedPageIds
      : [draggingPageId]).filter((id) => !isSpecialCoverPageId(id));

    if (movingPageIds.length === 0) {
      setDraggingPageId(null);
      setDragOverPageId(null);
    setDragOverInsertBarKey(null);
      setIsPageDragCopying(false);
      return;
    }

    if (isCopy) {
      const copiedPageIds: number[] = [];

      applyPagesChange((prev) => {
        const movingIdSet = new Set(movingPageIds);
        const sourcePages = prev.filter((page) => movingIdSet.has(page.id));

        if (sourcePages.length === 0) return prev;

        let nextPageId = Math.max(0, ...prev.map((page) => page.id)) + 1;

        const copiedPages = sourcePages.map((page) => {
          const newPageId = nextPageId++;
          copiedPageIds.push(newPageId);

          let nextItemId = newPageId * 100000;

          return {
            ...structuredClone(page),
            id: newPageId,
            frames: ensureInnerLockedFrame(
              page.frames
                .filter((frame) => !isInnerLockedFrame(frame))
                .map((frame) => ({
                  ...structuredClone(frame),
                  id: nextItemId++,
                }))
            ),
            bubbles: page.bubbles.map((bubble) => ({
              ...structuredClone(bubble),
              id: nextItemId++,
            })),
            sounds: page.sounds.map((sound) => ({
              ...structuredClone(sound),
              id: nextItemId++,
            })),
          };
        });

        const safeIndex = clampContentInsertIndex(insertIndex, prev.length);
        const next = [...prev];
        next.splice(safeIndex, 0, ...copiedPages);

        return next;
      });

      const nextCurrentPageId = copiedPageIds[0] ?? draggingPageId;

      setCurrentPageId(nextCurrentPageId);
      setSelectedPageIds(copiedPageIds.length > 0 ? copiedPageIds : [draggingPageId]);
      lastSelectedPageIdRef.current = nextCurrentPageId;
      setSelectedItems([]);
      setDraggingPageId(null);
      setDragOverPageId(null);
    setDragOverInsertBarKey(null);
      setIsPageDragCopying(false);
      return;
    }

    applyPagesChange((prev) => {
      const movingIdSet = new Set(movingPageIds);

      const movingPages = prev.filter((page) => movingIdSet.has(page.id));
      if (movingPages.length === 0) return prev;

      const beforeDropCount = prev
        .slice(0, insertIndex)
        .filter((page) => movingIdSet.has(page.id)).length;

      const remainingPages = prev.filter((page) => !movingIdSet.has(page.id));

      const safeIndex = clampContentInsertIndex(insertIndex - beforeDropCount, remainingPages.length);

      const next = [...remainingPages];
      next.splice(safeIndex, 0, ...movingPages);

      const same =
        next.length === prev.length &&
        next.every((page, index) => page.id === prev[index].id);

      return same ? prev : next;
    });

    setCurrentPageId(draggingPageId);
    setSelectedPageIds(movingPageIds);
    lastSelectedPageIdRef.current = draggingPageId;
    setSelectedItems([]);
    setDraggingPageId(null);
    setDragOverPageId(null);
    setDragOverInsertBarKey(null);
    setIsPageDragCopying(false);
  };

  const handleTemplateDragStart = (templateId: string) => {
    setDraggingTemplateId(templateId);
    setDraggingPageId(null);
    setDragOverPageId(null);
    setDragOverInsertBarKey(null);
    setIsPageDragCopying(false);
  };

  const handleTemplateDragEnd = () => {
    setDraggingTemplateId(null);
    setDragOverPageId(null);
    setDragOverInsertBarKey(null);
    setIsPageDragCopying(false);
  };

  const createPageFromTemplate = (templatePage: Page, newPageId: number): Page => {
    return {
      id: newPageId,
      visible: true,
      frames: templatePage.frames.map((frame, index) => {
        if (isInnerLockedFrame(frame)) {
          return createInnerLockedFrame();
        }

        return {
          ...frame,
          id: newPageId + index + 1,
          image: null,
          imageId: undefined,
          imageOffsetX: 0,
          imageOffsetY: 0,
          imageScale: 1,
          imageNaturalWidth: 0,
          imageNaturalHeight: 0,
          points: frame.points
            ? (frame.points.map((point) => ({ ...point })) as Frame["points"])
            : undefined,
        };
      }),
      bubbles: [],
      sounds: [],
    };
  };

  const handleTemplateDropToPageList = (
    insertIndex: number,
    templateIdOverride?: string
  ) => {
    const targetTemplateId = templateIdOverride ?? draggingTemplateId;
    if (!targetTemplateId) return;

    const template = TEMPLATE_DEFINITIONS.find(
      (item) => item.id === targetTemplateId
    );

    if (!template) {
      setDraggingTemplateId(null);
      setDragOverPageId(null);
    setDragOverInsertBarKey(null);
      return;
    }

    const newPageId = Date.now();
    const newPage = createPageFromTemplate(template.page, newPageId);

    applyPagesChange((prev) => {
      const next = [...prev];
      const safeIndex = clampContentInsertIndex(insertIndex, next.length);
      next.splice(safeIndex, 0, newPage);
      return next;
    });

    setCurrentPageId(newPage.id);
    setSelectedPageIds([newPage.id]);
    lastSelectedPageIdRef.current = newPage.id;
    setSelectedItems([]);
    trackPageAdd();
    setDraggingTemplateId(null);
    setDragOverPageId(null);
    setDragOverInsertBarKey(null);
  };

  const handleTemplateAddClick = (templateId: string) => {
    const selectedPageId =
      selectedPageIds.length > 0
        ? selectedPageIds[selectedPageIds.length - 1]
        : null;

    const selectedPageIndex =
      selectedPageId == null
        ? -1
        : pages.findIndex((page) => page.id === selectedPageId);

    const insertIndex =
      selectedPageIndex < 0 ? getDefaultPageInsertIndex() : selectedPageIndex + 1;

    handleTemplateDropToPageList(insertIndex, templateId);
  };

  const handleDeletePage = (pageId: number) => {
    if (isSpecialCoverPageId(pageId)) return;

    const pageIndex = pages.findIndex((p) => p.id === pageId);
    if (pageIndex < 0) return;

    const ok = window.confirm(`${pageIndex + 1}${t("confirmDeletePageSuffix")}`);
    if (!ok) {
      closePageMenu();
      return;
    }

    const filtered = pages.filter((p) => p.id !== pageId);

    applyPagesChange(filtered);

    if (filtered.length > 0) {
      const nextCurrent =
        filtered[Math.min(pageIndex, filtered.length - 1)] ?? filtered[0];

      setCurrentPageId(nextCurrent.id);
    } else {
      setCurrentPageId(null);
    }

    setSelectedItems([]);
    closePageMenu();
  };

  const handleAddBubble = () => {
    const newId = Date.now();

    updateCurrentPage((page) => {
      const defaultBubbleText = t("bubbleDefaultText");
      const defaultBubbleSize = getBubbleAutoSizePercent({
        text: defaultBubbleText,
        writingMode: defaultTextDirection,
        fontSize: 22,
      });

      const bubbleW = defaultBubbleSize.w;
      const bubbleH = defaultBubbleSize.h;
      const visibleCenter = getVisiblePageCenterPercent();
      const offset = 1;

      let nextX = clamp(visibleCenter.x - bubbleW / 2, 0, 100 - bubbleW);
      let nextY = clamp(visibleCenter.y - bubbleH / 2, 0, 100 - bubbleH);

      const last = lastAddedBubbleRef.current;

      if (last && last.pageId === page.id) {
        const existing = page.bubbles.find((b) => b.id === last.id);

        if (
          existing &&
          existing.x === last.x &&
          existing.y === last.y &&
          Math.abs(existing.x - nextX) <= 5 &&
          Math.abs(existing.y - nextY) <= 5
        ) {
          nextX = clamp(existing.x + offset, 0, 100 - bubbleW);
          nextY = clamp(existing.y + offset, 0, 100 - bubbleH);
        }
      }

      const defaultTailLength = getDefaultBubbleTailLengthPx({
        w: bubbleW,
        h: bubbleH,
        shape: "ellipse",
      });

      const bubble: Bubble = {
        id: newId,
        x: nextX,
        y: nextY,
        w: bubbleW,
        h: bubbleH,
        text: defaultBubbleText,
        type: "ellipse",
        shape: "ellipse",
        fontSize: 22,
        fontFamily: "",
        writingMode: defaultTextDirection,
        backgroundColor: "white",
        textColor: "black",
        whiteTone: 100,
        blackTone: 0,
        tailEnabled: true,
        tailStyle: "triangle",
        tailAngle: 90,
        tailLength: defaultTailLength,
        tailWidth: 50,
        tailMode: "outside",
        layer: getNextBubbleLayer(page),
        clipToFrame: true,
      };

      lastAddedBubbleRef.current = {
        pageId: page.id,
        id: bubble.id,
        x: bubble.x,
        y: bubble.y,
      };

      return {
        ...page,
        bubbles: [...page.bubbles, bubble],
      };
    });

    setSelectedItems([{ kind: "bubble", id: newId }]);
    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setDragState(null);
    setSnapGuideLines([]);
    trackBubbleAdd();
    closeContextMenu();
    focusCanvasTrap();
  };

  const handleAddSound = () => {
    const newId = Date.now();

    updateCurrentPage((page) => {
      const visibleCenter = getVisiblePageCenterPercent();
      const offset = 1;

      let nextX = visibleCenter.x;
      let nextY = visibleCenter.y;

      const last = lastAddedSoundRef.current;

      if (last && last.pageId === page.id) {
        const existing = page.sounds.find((s) => s.id === last.id);

        if (
          existing &&
          existing.x === last.x &&
          existing.y === last.y &&
          Math.abs(existing.x - nextX) <= 5 &&
          Math.abs(existing.y - nextY) <= 5
        ) {
          nextX = clamp(existing.x + offset, 0, 100);
          nextY = clamp(existing.y + offset, 0, 100);
        }
      }
      
      const defaultSoundText = t("soundDefaultText");
      const defaultSoundStyle = SOUND_STYLE_PRESETS[DEFAULT_SOUND_STYLE_KEY];

      const sound: SoundText = {
        id: newId,
        x: nextX,
        y: nextY,
        text: defaultSoundText,
        fontSize: 42,
        fontFamily: "",
        rotate: 0,
        writingMode: defaultTextDirection,
        color: defaultSoundStyle.color,
        outlineColor: defaultSoundStyle.outlineColor,
        outlineWidth: defaultSoundStyle.outlineWidth,
        topTilt: 0,
        rightTilt: 0,
        bottomTilt: 0,
        leftTilt: 0,
        curveX: 0,
        curveY: 0,
        layer: getNextSoundLayer(page),
        clipToFrame: false,
      };

      lastAddedSoundRef.current = {
        pageId: page.id,
        id: sound.id,
        x: sound.x,
        y: sound.y,
      };

      return {
        ...page,
        sounds: [...page.sounds, sound],
      };
    });

    setSelectedItems([{ kind: "sound", id: newId }]);
    setActiveTargetType("canvas");
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setDragState(null);
    setSnapGuideLines([]);
    trackSoundAdd();
    closeContextMenu();
    focusCanvasTrap();
  };

  const handleDeleteBubble = (bubbleId: number) => {
    updateCurrentPage((page) => ({
      ...page,
      bubbles: page.bubbles.filter((b) => b.id !== bubbleId),
    }));
    if (primarySelectedItem?.kind === "bubble" && primarySelectedItem.id === bubbleId) {
      setSelectedItems([]);
    }
  };

  const handleDeleteSound = (soundId: number) => {
    updateCurrentPage((page) => ({
      ...page,
      sounds: page.sounds.filter((s) => s.id !== soundId),
    }));
    if (primarySelectedItem?.kind === "sound" && primarySelectedItem.id === soundId) {
      setSelectedItems([]);
    }
  };

  const handleCycleBubbleShape = (bubbleId: number) => {
    updateCurrentPage((page) => ({
      ...page,
      bubbles: page.bubbles.map((bubble) => {
        if (bubble.id !== bubbleId) return bubble;

        const nextType = getNextBubbleType(bubble.type);
        return applyBubbleTypePreset(
          {
            ...bubble,
            type: nextType,
          },
          nextType
        );
      }),
    }));
  };

  const handleToggleBubbleTail = (bubbleId: number) => {
    updateCurrentPage((page) => ({
      ...page,
      bubbles: page.bubbles.map((b) =>
        b.id === bubbleId ? { ...b, tailEnabled: !b.tailEnabled } : b
      ),
    }));
  };

  const handleToggleBubbleTailMode = (bubbleId: number) => {
    updateCurrentPage((page) => ({
      ...page,
      bubbles: page.bubbles.map((b) =>
        b.id === bubbleId
          ? {
              ...b,
              tailMode: b.tailMode === "outside" ? "inside" : "outside",
            }
          : b
      ),
    }));
  };

  const updateBubble = (
    bubbleId: number,
    updater: (bubble: Bubble) => Bubble,
    options?: { recordHistory?: boolean }
  ) => {
    updateCurrentPage(
      (page) => ({
        ...page,
        bubbles: page.bubbles.map((b) => (b.id === bubbleId ? updater(b) : b)),
      }),
      { recordHistory: options?.recordHistory ?? true }
    );
  };

  const renderSoundLayer = (
    page: Page,
    sound: SoundText,
    content: React.ReactNode
  ) => {
    const soundWithClip = sound as SoundText & { clipToFrame?: boolean };

    const centerFrame = getSoundCenterFrame(page, sound);
    const clipFrame =
      centerFrame && !isInnerLockedFrame(centerFrame) ? centerFrame : null;

    const shouldClip =
      !!soundWithClip.clipToFrame &&
      !!clipFrame &&
      clipFrame.borderEnabled;

    if (!shouldClip || !clipFrame) {
      return (
        <div
          key={`sound-layer-${sound.id}`}
          data-canvas-focus-object="true"
          data-canvas-object-type="sound"
          data-canvas-object-id={String(sound.id)}
          data-canvas-object-x={String(sound.x)}
          data-canvas-object-y={String(sound.y)}
          tabIndex={-1}
          style={{
            position: "absolute",
            left: `${sound.x}%`,
            top: `${sound.y}%`,
            overflow: "visible",
            pointerEvents: "none",
            zIndex: draggingFrameImage != null ? 0 : SOUND_LAYER_Z_BASE + (sound.layer ?? 0),
          }}
        >
          {content}
        </div>
      );
    }

    const frameClipPath = getFrameInnerClipPath(clipFrame);

    return (
      <div
        key={`sound-layer-${sound.id}`}
        style={{
          position: "absolute",
          left: `${clipFrame.x}%`,
          top: `${clipFrame.y}%`,
          width: `${clipFrame.w}%`,
          height: `${clipFrame.h}%`,
          overflow: "hidden",
          clipPath: frameClipPath,
          WebkitClipPath: frameClipPath,
          pointerEvents: "none",
          zIndex: draggingFrameImage != null ? 0 : SOUND_LAYER_Z_BASE + (sound.layer ?? 0),
        }}
      >
        <div
          data-canvas-focus-object="true"
          data-canvas-object-type="sound"
          data-canvas-object-id={String(sound.id)}
          data-canvas-object-x={String(sound.x)}
          data-canvas-object-y={String(sound.y)}
          tabIndex={-1}
          style={{
            position: "absolute",
            left: `${((sound.x - clipFrame.x) / clipFrame.w) * 100}%`,
            top: `${((sound.y - clipFrame.y) / clipFrame.h) * 100}%`,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          {content}
        </div>
      </div>
    );
  };

  const renderBubbleElement = (
    page: Page,
    bubble: Bubble,
    exportMode: boolean
  ) => {
    const isSelected = selectedBubbleIds.includes(bubble.id);
    const isPrimarySelected =
      primarySelectedItem?.kind === "bubble" &&
      primarySelectedItem.id === bubble.id;

    const bubblePixelW = (PAGE_WIDTH * bubble.w) / 100;
    const bubblePixelH = (PAGE_HEIGHT * bubble.h) / 100;

    const handlePos = getTailHandlePosition(bubble);

    return (
      <div
        key={`bubble-${bubble.id}`}
        data-canvas-focus-object="true"
        data-canvas-object-type="bubble"
        data-canvas-object-id={String(bubble.id)}
        data-canvas-object-x={String(bubble.x)}
        data-canvas-object-y={String(bubble.y)}
        tabIndex={-1}
        style={{
          position: "absolute",
          left: `${bubble.x}%`,
          top: `${bubble.y}%`,
          width: `${bubble.w}%`,
          height: `${bubble.h}%`,
          overflow: "visible",
          pointerEvents: exportMode ? "none" : "auto",
          zIndex: draggingFrameImage != null ? 0 : 10 + (bubble.layer ?? 0),
        }}
        onMouseDown={(e) => {
          if (exportMode) return;
          startBubbleMove(e, bubble);
        }}
        onDoubleClick={(e) => {
          if (exportMode) return;
          e.stopPropagation();
          focusBubbleTextEditor(bubble.id);
        }}
        onContextMenu={(e) => {
          if (exportMode) return;
          openContextMenu(e, { kind: "bubble", id: bubble.id });
        }}
      >
        <OutsideTriangleTailSvg bubble={bubble} />
        <OutsideThoughtTailSvg bubble={bubble} />
        <OutsideTailFillSvg bubble={bubble} />

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          {bubble.shape === "flash" ? (
            <FlashBubbleSvg bubble={bubble} />
          ) : (
            <>
              <path
                d={bubbleSvgPath(
                  bubble.shape,
                  bubble.shape === "electronic" ? 0 : BOUNDARY_INSET
                )}
                fill="none"
                stroke="#111"
                strokeWidth={
                  bubble.shape === "electronic"
                    ? ELECTRONIC_OUTER_STROKE_PX
                    : BUBBLE_STROKE_PX
                }
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <BubbleCoverSvg bubble={bubble} />
              <ElectronicInnerLayer bubble={bubble} />
              <InsideTriangleTailSvg bubble={bubble} />
              <InsideThoughtTailSvg bubble={bubble} />
            </>
          )}
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "8% 10%",
            fontSize: bubble.fontSize,
            fontFamily:
              !exportMode &&
              previewFontFamily?.targetKind === "bubble" &&
              previewFontFamily.targetId === bubble.id
                ? previewFontFamily.fontFamily.trim() || undefined
                : bubble.fontFamily?.trim() || undefined,
            lineHeight: 1.2,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            pointerEvents: "none",
          }}
        >
          {(() => {
            const isBubbleTextEmpty = !exportMode && (bubble.text ?? "").length === 0;
            const bubbleTextPaint = isBubbleTextEmpty ? null : getBubbleTextPaintStyle(bubble);

            const renderBubbleTextNode = (
              rubyTextStyle?: React.CSSProperties,
              rubyBaseTextStyle?: React.CSSProperties
            ) =>
              isBubbleTextEmpty
                ? t("bubbleTextPlaceholder")
                : renderTextWithRubies(
                    bubble.text,
                    bubble.rubies,
                    rubyTextStyle,
                    rubyBaseTextStyle
                  );

            const baseTextStyle = isBubbleTextEmpty
              ? getBubblePlaceholderTextStyle()
              : getBubbleTextFillStyle(bubble);

            const outlineStyle = isBubbleTextEmpty
              ? {
                  color: "transparent",
                  WebkitTextStroke: "2px #ffffff",
                  paintOrder: "stroke",
                  textShadow: "none",
                }
              : getBubbleTextOutlineStyle(bubble);

            const rubyOutlineStyle: React.CSSProperties | undefined =
              bubbleTextPaint &&
              bubbleTextPaint.outlineWidth > 0 &&
              bubbleTextPaint.outlineColor !== "transparent"
                ? {
                    color: "transparent",
                    WebkitTextStroke: `${Math.max(0.4, bubbleTextPaint.outlineWidth * 0.3)}px ${bubbleTextPaint.outlineColor}`,
                    paintOrder: "stroke",
                    textShadow: "none",
                  }
                : undefined;

            const rubyFillStyle: React.CSSProperties | undefined =
              bubbleTextPaint && (bubble.rubies?.length ?? 0) > 0
                ? {
                    color: bubbleTextPaint.fillColor,
                    WebkitTextStroke: "0 transparent",
                    paintOrder: "fill",
                    textShadow: "none",
                  }
                : undefined;

            const rubyHiddenBaseStyle: React.CSSProperties = {
              color: "transparent",
              WebkitTextStroke: "0 transparent",
              textShadow: "none",
            };

            return (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    ...baseTextStyle,
                    ...outlineStyle,
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                  }}
                >
                  {renderBubbleTextNode(rubyOutlineStyle)}
                </span>
                <span style={{ ...baseTextStyle, position: "relative" }}>
                  {renderBubbleTextNode()}
                </span>
                {rubyFillStyle && (
                  <span
                    aria-hidden="true"
                    style={{
                      ...baseTextStyle,
                      ...rubyHiddenBaseStyle,
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                    }}
                  >
                    {renderBubbleTextNode(rubyFillStyle, rubyHiddenBaseStyle)}
                  </span>
                )}
              </>
            );
          })()}
        </div>

        {!exportMode && isSelected && (
          <>
            {isPrimarySelected && (
              <div
                style={{
                  position: "absolute",
                  left: `calc(${handlePos.x}% - 8px)`,
                  top: `calc(${handlePos.y}% - 8px)`,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#3b82f6",
                  border: "2px solid #fff",
                  boxSizing: "border-box",
                  cursor: "grab",
                }}
                onContextMenu={suppressHandleContextMenu}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startBubbleTail(e, bubble);
                }}
              />
            )}
          </>
        )}
      </div>
    );
  };

  const renderBubbleWithFrameClip = (
    page: Page,
    bubble: Bubble,
    exportMode: boolean
  ) => {
    const centerFrame = getBubbleCenterFrame(page, bubble);
    const shouldClip = !!bubble.clipToFrame && !!centerFrame;

    if (!shouldClip || !centerFrame) {
      return renderBubbleElement(page, bubble, exportMode);
    }

    return (
      <div
        key={`bubble-clip-${bubble.id}`}
        style={{
          position: "absolute",
          left: `${centerFrame.x}%`,
          top: `${centerFrame.y}%`,
          width: `${centerFrame.w}%`,
          height: `${centerFrame.h}%`,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: draggingFrameImage != null ? 0 : 10 + (bubble.layer ?? 0),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${bubble.x - centerFrame.x}%`,
            top: `${bubble.y - centerFrame.y}%`,
            width: `${bubble.w}%`,
            height: `${bubble.h}%`,
            overflow: "visible",
            pointerEvents: "auto",
          }}
        >
          {renderBubbleElement(page, bubble, exportMode)}
        </div>
      </div>
    );
  };

  const bringBubbleToFront = (
    bubbleId: number,
    options?: { recordHistory?: boolean }
  ) => {
    applyPagesChange(
      (prev) =>
        prev.map((page) => {
          if (page.id !== currentPageId) return page;

          const nextLayer = getNextBubbleLayer(page);

          return {
            ...page,
            bubbles: page.bubbles.map((b) =>
              b.id === bubbleId ? { ...b, layer: nextLayer } : b
            ),
          };
        }),
      { recordHistory: options?.recordHistory ?? true }
    );
  };

  const moveBubbleLayerBy = (
    bubbleId: number,
    direction: "forward" | "backward"
  ) => {
    updateCurrentPage((page) => {
      const sorted = [...page.bubbles].sort(
        (a, b) => (a.layer ?? 0) - (b.layer ?? 0)
      );

      const index = sorted.findIndex((b) => b.id === bubbleId);
      if (index < 0) return page;

      if (direction === "forward") {
        if (index === sorted.length - 1) return page;
        [sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]];
      } else {
        if (index === 0) return page;
        [sorted[index - 1], sorted[index]] = [sorted[index], sorted[index - 1]];
      }

      const reordered = sorted.map((b, i) => ({
        ...b,
        layer: i + 1,
      }));

      return {
        ...page,
        bubbles: page.bubbles.map(
          (b) => reordered.find((r) => r.id === b.id) ?? b
        ),
      };
    });
  };

  const bringSoundToFront = (
    soundId: number,
    options?: { recordHistory?: boolean }
  ) => {
    applyPagesChange(
      (prev) =>
        prev.map((page) => {
          if (page.id !== currentPageId) return page;

          const nextLayer = getNextSoundLayer(page);

          return {
            ...page,
            sounds: page.sounds.map((s) =>
              s.id === soundId ? { ...s, layer: nextLayer } : s
            ),
          };
        }),
      { recordHistory: options?.recordHistory ?? true }
    );
  };

  const sendSoundToBack = (soundId: number) => {
    updateCurrentPage((page) => {
      const sorted = [...page.sounds].sort(
        (a, b) => (a.layer ?? 0) - (b.layer ?? 0)
      );

      const target = sorted.find((s) => s.id === soundId);
      if (!target) return page;

      const others = sorted.filter((s) => s.id !== soundId);
      const reordered = [target, ...others].map((s, index) => ({
        ...s,
        layer: index + 1,
      }));

      return {
        ...page,
        sounds: page.sounds.map(
          (s) => reordered.find((r) => r.id === s.id) ?? s
        ),
      };
    });
  };

  const moveSoundLayerBy = (
    soundId: number,
    direction: "forward" | "backward"
  ) => {
    updateCurrentPage((page) => {
      const sorted = [...page.sounds].sort(
        (a, b) => (a.layer ?? 0) - (b.layer ?? 0)
      );

      const index = sorted.findIndex((s) => s.id === soundId);
      if (index < 0) return page;

      if (direction === "forward") {
        if (index === sorted.length - 1) return page;
        [sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]];
      } else {
        if (index === 0) return page;
        [sorted[index - 1], sorted[index]] = [sorted[index], sorted[index - 1]];
      }

      const reordered = sorted.map((s, i) => ({
        ...s,
        layer: i + 1,
      }));

      return {
        ...page,
        sounds: page.sounds.map(
          (s) => reordered.find((r) => r.id === s.id) ?? s
        ),
      };
    });
  };

  const handleCycleSoundStyle = (soundId: number) => {
    updateSound(soundId, (s) => {
      const nextKey = getNextSoundStyleKey(s);
      return {
        ...s,
        ...SOUND_STYLE_PRESETS[nextKey],
      };
    });
  };

  const sendBubbleToBack = (bubbleId: number) => {
    updateCurrentPage((page) => {
      const sorted = [...page.bubbles].sort(
        (a, b) => (a.layer ?? 0) - (b.layer ?? 0)
      );

      const target = sorted.find((b) => b.id === bubbleId);
      if (!target) return page;

      const others = sorted.filter((b) => b.id !== bubbleId);
      const reordered = [target, ...others].map((b, index) => ({
        ...b,
        layer: index + 1,
      }));

      return {
        ...page,
        bubbles: page.bubbles.map(
          (b) => reordered.find((r) => r.id === b.id) ?? b
        ),
      };
    });
  };

const handleResetBubbleStyle = (bubbleId: number) => {
  updateBubble(bubbleId, (b) => {
    const nextFontSize = 22;
    const nextWritingMode = defaultTextDirection;

    const resetBase = {
      ...b,

      type: "ellipse",
      shape: "ellipse",
      clipToFrame: true,
      rotate: 0,

      fontSize: nextFontSize,
      fontFamily: "",
      writingMode: nextWritingMode,

      backgroundColor: "white",
      textColor: "black",
      whiteTone: 100,
      blackTone: 0,

      tailEnabled: true,
      tailStyle: "triangle",
      tailMode: "outside",
      tailAngle: 90,
      tailLength: 0,
      tailWidth: 50,
      tailCurve: 0,
    } as Bubble & FreeTextColorFields & FreeBubbleBackgroundFields;

    delete resetBase.freeTextColor;
    delete resetBase.freeTextOutlineEnabled;
    delete resetBase.freeTextOutlineColor;
    delete resetBase.freeBubbleBackgroundColor;
    delete resetBase.freeBubbleTone;
    delete resetBase.freeBubbleBorderEnabled;
    delete resetBase.freeBubbleBorderColor;

    resetBase.bubbleBackgroundToneMode = "white";

    const fitted = fitBubbleSizeToText(
      resetBase as Bubble,
      t("bubbleTextPlaceholder")
    );

    const defaultTailLength = getDefaultBubbleTailLengthPx({
      w: fitted.w,
      h: fitted.h,
      shape: "ellipse",
    });

    return {
      ...fitted,
      tailLength: defaultTailLength,
    };
  });
};

  const handleResetSoundStyle = (soundId: number) => {
    const defaultSoundStyle = SOUND_STYLE_PRESETS[DEFAULT_SOUND_STYLE_KEY];

    updateSound(soundId, (s) => {
      const next = {
        ...s,
        fontSize: 42,
        fontFamily: "",
        rotate: 0,
        writingMode: defaultTextDirection,
        color: defaultSoundStyle.color,
        outlineColor: defaultSoundStyle.outlineColor,
        outlineWidth: defaultSoundStyle.outlineWidth,
        topTilt: 0,
        rightTilt: 0,
        bottomTilt: 0,
        leftTilt: 0,
        curveX: 0,
        curveY: 0,
        clipToFrame: false,
      } as SoundText & FreeTextColorFields;

      delete next.freeTextColor;
      delete next.freeTextOutlineEnabled;
      delete next.freeTextOutlineColor;

      return next as SoundText;
    });
  };

  const applySoundStylePreset = (
    soundId: number,
    preset: "whiteBlack" | "blackWhite" | "white" | "black"
  ) => {
    updateSound(soundId, (s) => ({
      ...s,
      ...SOUND_STYLE_PRESETS[preset],
    }));
  };

  const updateSound = (
    soundId: number,
    updater: (sound: SoundText) => SoundText,
    options?: { recordHistory?: boolean }
  ) => {
    updateCurrentPage(
      (page) => ({
        ...page,
        sounds: page.sounds.map((s) => (s.id === soundId ? updater(s) : s)),
      }),
      { recordHistory: options?.recordHistory ?? true }
    );
  };

  const startBubbleMove = (
    e: React.MouseEvent,
    bubble: Bubble
  ) => {
    e.preventDefault();
    e.stopPropagation();

    closeTopToolbarMenus();

    if (contextMenu.visible) {
      closeContextMenu();
    }

    closePageMenu();
    closePageInsertMenu();
    focusCanvasTrap();

    setActiveTargetType("canvas");
    setSelectedPageIds([]);

    const additive = e.ctrlKey || e.metaKey;
    const alreadySelected = selectedItems.some(
      (item) => item.kind === "bubble" && item.id === bubble.id
    );

    let effectiveSelection: SelectedItem[];

    pendingSingleSelectOnMouseUpRef.current = null;

    if (additive) {
      if (alreadySelected) {
        effectiveSelection = selectedItems;
        setSelectedItems(
          sanitizeSelectedItems(
            selectedItems.filter(
              (item) => !(item.kind === "bubble" && item.id === bubble.id)
            )
          )
        );
      } else {
        effectiveSelection = sanitizeSelectedItems([
          ...selectedItems,
          { kind: "bubble", id: bubble.id },
        ]);
        setSelectedItems(effectiveSelection);
      }
    } else if (alreadySelected && selectedItems.length > 1) {
      effectiveSelection = selectedItems;
      setPendingSingleSelectOnMouseUp({ kind: "bubble", id: bubble.id }, e);
    } else {
      effectiveSelection = [{ kind: "bubble", id: bubble.id }];
      setSelectedItems(effectiveSelection);
    }

    const rect = getPageRect();
    if (!rect || !currentPage) return;

    const mouseXPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseYPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const dragItems = buildDragItemsFromSelection(effectiveSelection, currentPage);

    if (effectiveSelection.length === 1) {
      setDragState({
        kind: "bubble-move",
        items: buildDragItemsFromSelection(effectiveSelection, currentPage)
          .filter((item) => item.kind === "bubble" || item.kind === "sound")
          .map(({ kind, id, startX, startY }) => ({
            kind,
            id,
            startX,
            startY,
          })),
        anchorKind: "bubble",
        anchorId: bubble.id,
        offsetX: mouseXPercent - bubble.x,
        offsetY: mouseYPercent - bubble.y,
        copyGhost: buildDragCopyGhostFromSelection(effectiveSelection, currentPage),
        hasMoved: false,
        historyPushed: false,
      });
    } else {
      setDragState({
        kind: "multi-move",
        items: buildDragItemsFromSelection(effectiveSelection, currentPage).map(
          ({ kind, id, startX, startY }) => ({
            kind,
            id,
            startX,
            startY,
          })
        ),
        anchorKind: "bubble",
        anchorId: bubble.id,
        offsetX: mouseXPercent - bubble.x,
        offsetY: mouseYPercent - bubble.y,
        copyGhost: buildDragCopyGhostFromSelection(effectiveSelection, currentPage),
        hasMoved: false,
        historyPushed: false,
      });
    }
  };

  const startBubbleTail = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>,
    bubble: Bubble
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canBubbleUseTail(bubble)) return;

    closeTopToolbarMenus();
    focusCanvasTrap();

    selectBubble(bubble.id);

    bringBubbleToFront(bubble.id, { recordHistory: false });

    const point = getPagePercentPointFromMouse(e);
    bubbleTailDragPointerRef.current = point
      ? { xPercent: point.xPercent, yPercent: point.yPercent }
      : null;

    setDragState({
      kind: "bubble-tail",
      id: bubble.id,
      hasMoved: false,
      historyPushed: false,
    });
  };

  const startBubbleTailWidth = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>,
    bubble: Bubble
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canBubbleUseTail(bubble) || !canBubbleUseTailCurve(bubble)) return;

    closeTopToolbarMenus();
    focusCanvasTrap();

    selectBubble(bubble.id);

    bringBubbleToFront(bubble.id, { recordHistory: false });

    const rect = getPageRect();
    if (rect) {
      const xPercent = clamp(
        ((e.clientX - rect.left) / rect.width) * 100,
        0,
        100
      );
      const yPercent = clamp(
        ((e.clientY - rect.top) / rect.height) * 100,
        0,
        100
      );

      setBubbleTailWidthDragCursor({
        id: bubble.id,
        xPercent,
        yPercent,
      });
    }

    setDragState({
      kind: "bubble-tail-width",
      id: bubble.id,
      hasMoved: false,
      historyPushed: false,
    });
  };

  const getBubbleTailWidthHandlePosition = (bubble: Bubble) => {
    const {
      bubblePixelW,
      bubblePixelH,
      unitX,
      unitY,
      perpX,
      perpY,
      tipX,
      tipY,
    } = getTailGeometry(bubble);

    const tailCurveDirection = (() => {
      const value = Number(bubble.tailWidth ?? 50);
      if (!Number.isFinite(value)) return 0;
      if (value <= 37) return -1;
      if (value >= 63) return 1;
      return 0;
    })();

    const tailDirection = bubble.tailMode === "outside" ? 1 : -1;
    const guideOffsetPx = 18;
    const centerX =
      tipX + ((unitX * tailDirection * guideOffsetPx) / bubblePixelW) * 100;
    const centerY =
      tipY + ((unitY * tailDirection * guideOffsetPx) / bubblePixelH) * 100;
    const handleOffsetPx = tailCurveDirection * 28;

    return {
      x: centerX + ((perpX * handleOffsetPx) / bubblePixelW) * 100,
      y: centerY + ((perpY * handleOffsetPx) / bubblePixelH) * 100,
    };
  };

  const startSoundMove = (
    e: React.MouseEvent,
    sound: SoundText
  ) => {
    e.preventDefault();
    e.stopPropagation();

    closeTopToolbarMenus();

    if (contextMenu.visible) {
      closeContextMenu();
    }

    closePageMenu();
    closePageInsertMenu();
    focusCanvasTrap();

    setActiveTargetType("canvas");
    setSelectedPageIds([]);

    const additive = e.ctrlKey || e.metaKey;
    const alreadySelected = selectedItems.some(
      (item) => item.kind === "sound" && item.id === sound.id
    );

    let effectiveSelection: SelectedItem[];

    pendingSingleSelectOnMouseUpRef.current = null;

    if (additive) {
      if (alreadySelected) {
        effectiveSelection = selectedItems;
        setSelectedItems(
          sanitizeSelectedItems(
            selectedItems.filter(
              (item) => !(item.kind === "sound" && item.id === sound.id)
            )
          )
        );
      } else {
        effectiveSelection = sanitizeSelectedItems([
          ...selectedItems,
          { kind: "sound", id: sound.id },
        ]);
        setSelectedItems(effectiveSelection);
      }
    } else if (alreadySelected && selectedItems.length > 1) {
      effectiveSelection = selectedItems;
      setPendingSingleSelectOnMouseUp({ kind: "sound", id: sound.id }, e);
    } else {
      effectiveSelection = [{ kind: "sound", id: sound.id }];
      setSelectedItems(effectiveSelection);
    }

    const rect = getPageRect();
    if (!rect || !currentPage) return;

    const mouseXPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseYPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const dragItems = buildDragItemsFromSelection(effectiveSelection, currentPage);

    if (effectiveSelection.length === 1) {
      setDragState({
        kind: "sound-move",
        items: buildDragItemsFromSelection(effectiveSelection, currentPage)
          .filter((item) => item.kind === "bubble" || item.kind === "sound")
          .map(({ kind, id, startX, startY }) => ({
            kind,
            id,
            startX,
            startY,
          })),
        anchorKind: "sound",
        anchorId: sound.id,
        offsetX: mouseXPercent - sound.x,
        offsetY: mouseYPercent - sound.y,
        copyGhost: buildDragCopyGhostFromSelection(effectiveSelection, currentPage),
        hasMoved: false,
        historyPushed: false,
      });
    } else {
      setDragState({
        kind: "multi-move",
        items: buildDragItemsFromSelection(effectiveSelection, currentPage).map(
          ({ kind, id, startX, startY }) => ({
            kind,
            id,
            startX,
            startY,
          })
        ),
        anchorKind: "sound",
        anchorId: sound.id,
        offsetX: mouseXPercent - sound.x,
        offsetY: mouseYPercent - sound.y,
        copyGhost: buildDragCopyGhostFromSelection(effectiveSelection, currentPage),
        hasMoved: false,
        historyPushed: false,
      });
    }
  };

  const startSoundResize = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>,
    sound: SoundText
  ) => {
    e.preventDefault();
    e.stopPropagation();

    closeTopToolbarMenus();
    focusCanvasTrap();

    selectSound(sound.id);

    const rect = getPageRect();
    if (!rect) return;

    const centerX = rect.left + (rect.width * sound.x) / 100;
    const centerY = rect.top + (rect.height * sound.y) / 100;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const startMouseDistance = Math.max(1, Math.sqrt(dx * dx + dy * dy));

    bringSoundToFront(sound.id, { recordHistory: false });

    setDragState({
      kind: "sound-resize",
      id: sound.id,
      startMouseDistance,
      startFontSize: sound.fontSize,
      hasMoved: false,
      historyPushed: false,
    });
  };

  const startSoundRotate = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>,
    sound: SoundText
  ) => {
    e.preventDefault();
    e.stopPropagation();

    closeTopToolbarMenus();
    focusCanvasTrap();

    selectSound(sound.id);

    const rect = getPageRect();
    if (!rect) return;

    const centerX = rect.left + (rect.width * sound.x) / 100;
    const centerY = rect.top + (rect.height * sound.y) / 100;

    const mouseAngle =
      (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;

    bringSoundToFront(sound.id, { recordHistory: false });

    setDragState({
      kind: "sound-rotate",
      id: sound.id,
      rotateOffset: sound.rotate - mouseAngle,
      hasMoved: false,
      historyPushed: false,
    });
  };

  const startSoundTiltDrag = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>,
    sound: SoundText,
    edge: TiltEdge
  ) => {
    e.preventDefault();
    e.stopPropagation();

    closeTopToolbarMenus();
    focusCanvasTrap();
    selectSound(sound.id);
    bringSoundToFront(sound.id, { recordHistory: false });

    setDragState({
      kind: "sound-tilt",
      id: sound.id,
      edge,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTilt: getSoundEdgeTilt(sound, edge),
      hasMoved: false,
      historyPushed: false,
    });
  };

  const startSoundCurveDrag = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>,
    sound: SoundText,
    axis: "x" | "y"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    closeTopToolbarMenus();
    focusCanvasTrap();
    selectSound(sound.id);
    bringSoundToFront(sound.id, { recordHistory: false });

    setDragState({
      kind: "sound-curve",
      id: sound.id,
      axis,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startCurveX: sound.curveX ?? 0,
      startCurveY: sound.curveY ?? 0,
      hasMoved: false,
      historyPushed: false,
    });
  };

  const handleMultiMoveDrag = ({
    dragState,
    currentPage,
    currentPageId,
    mouseXPercent,
    mouseYPercent,
    e,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "multi-move" }>;
    currentPage: Page;
    currentPageId: number;
    mouseXPercent: number;
    mouseYPercent: number;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    type MultiMoveItem = {
      kind: "frame" | "bubble" | "sound";
      id: number;
      startX: number;
      startY: number;
      startPoints?: PercentPoint[];
    };

    type SnapCandidate = {
      dx: number;
      dy: number;
      guideLine: SnapGuideLine | null;
    };

    const getSnapGuideLineFromEdge = (edge: SnapEdge): SnapGuideLine | null => {
      const dx = edge.p2.x - edge.p1.x;
      const dy = edge.p2.y - edge.p1.y;

      if (Math.abs(dx) < 0.000001 && Math.abs(dy) < 0.000001) {
        return null;
      }

      const points: PercentPoint[] = [];

      const addPoint = (point: PercentPoint) => {
        if (
          point.x < -0.0001 ||
          point.x > 100.0001 ||
          point.y < -0.0001 ||
          point.y > 100.0001
        ) {
          return;
        }

        if (
          points.some(
            (p) =>
              Math.abs(p.x - point.x) <= 0.0001 &&
              Math.abs(p.y - point.y) <= 0.0001
          )
        ) {
          return;
        }

        points.push({
          x: clamp(point.x, 0, 100),
          y: clamp(point.y, 0, 100),
        });
      };

      if (Math.abs(dx) > 0.000001) {
        const tLeft = (0 - edge.p1.x) / dx;
        addPoint({ x: 0, y: edge.p1.y + dy * tLeft });

        const tRight = (100 - edge.p1.x) / dx;
        addPoint({ x: 100, y: edge.p1.y + dy * tRight });
      }

      if (Math.abs(dy) > 0.000001) {
        const tTop = (0 - edge.p1.y) / dy;
        addPoint({ x: edge.p1.x + dx * tTop, y: 0 });

        const tBottom = (100 - edge.p1.y) / dy;
        addPoint({ x: edge.p1.x + dx * tBottom, y: 100 });
      }

      if (points.length < 2) return null;

      let bestA = points[0];
      let bestB = points[1];
      let bestDistance = -1;

      for (const a of points) {
        for (const b of points) {
          const distance = Math.hypot(a.x - b.x, a.y - b.y);

          if (distance > bestDistance) {
            bestA = a;
            bestB = b;
            bestDistance = distance;
          }
        }
      }

      return {
        x1: bestA.x,
        y1: bestA.y,
        x2: bestB.x,
        y2: bestB.y,
      };
    };

    const items = dragState.items as MultiMoveItem[];

    const anchor = items.find(
      (item) =>
        item.kind === dragState.anchorKind &&
        item.id === dragState.anchorId
    );
    if (!anchor) return;

    const frameItems = items.filter(
      (item): item is MultiMoveItem & { kind: "frame" } =>
        item.kind === "frame"
    );

    const bubbleItems = items.filter(
      (item): item is MultiMoveItem & { kind: "bubble" } =>
        item.kind === "bubble"
    );

    const soundItems = items.filter(
      (item): item is MultiMoveItem & { kind: "sound" } =>
        item.kind === "sound"
    );

    const selectedFrameIdsForDrag = new Set(frameItems.map((item) => item.id));
    const selectedBubbleIdsForDrag = new Set(bubbleItems.map((item) => item.id));
    const selectedSoundIdsForDrag = new Set(soundItems.map((item) => item.id));

    const movingFramePairs = frameItems
      .map((item) => {
        const frame = currentPage.frames.find((x) => x.id === item.id);
        if (!frame || isInnerLockedFrame(frame) || isProtectedCoverBaseFrame(currentPage, frame)) return null;

        return {
          item,
          frame,
          startPoints: item.startPoints ?? getFrameAbsolutePoints(frame),
        };
      })
      .filter(
        (
          pair
        ): pair is {
          item: MultiMoveItem & { kind: "frame" };
          frame: Frame;
          startPoints: PercentPoint[];
        } => pair !== null
      );

    const stationaryFrames = currentPage.frames.filter(
      (frame) => !selectedFrameIdsForDrag.has(frame.id)
    );

    const buildMovedFrameFromStart = (
      pair: {
        item: MultiMoveItem & { kind: "frame" };
        frame: Frame;
        startPoints: PercentPoint[];
      },
      dx: number,
      dy: number
    ) => {
      return rebuildFrameFromAbsolutePoints(
        pair.frame,
        pair.startPoints.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        }))
      );
    };

    const clampGroupDelta = (rawDx: number, rawDy: number) => {
      let minDx = Number.NEGATIVE_INFINITY;
      let maxDx = Number.POSITIVE_INFINITY;
      let minDy = Number.NEGATIVE_INFINITY;
      let maxDy = Number.POSITIVE_INFINITY;

      for (const pair of movingFramePairs) {
        const bounds = getPointsBounds(pair.startPoints);

        minDx = Math.max(minDx, -bounds.minX);
        maxDx = Math.min(maxDx, 100 - bounds.maxX);
        minDy = Math.max(minDy, -bounds.minY);
        maxDy = Math.min(maxDy, 100 - bounds.maxY);
      }

      for (const item of bubbleItems) {
        const bubble = currentPage.bubbles.find((x) => x.id === item.id);
        if (!bubble) continue;

        minDx = Math.max(minDx, -item.startX);
        maxDx = Math.min(maxDx, 100 - (item.startX + bubble.w));
        minDy = Math.max(minDy, -item.startY);
        maxDy = Math.min(maxDy, 100 - (item.startY + bubble.h));
      }

      for (const item of soundItems) {
        minDx = Math.max(minDx, -item.startX);
        maxDx = Math.min(maxDx, 95 - item.startX);
        minDy = Math.max(minDy, -item.startY);
        maxDy = Math.min(maxDy, 95 - item.startY);
      }

      return {
        dx: clamp(rawDx, minDx, maxDx),
        dy: clamp(rawDy, minDy, maxDy),
      };
    };

    const getMovedFramesFromStart = (dx: number, dy: number) =>
      movingFramePairs.map((pair) => buildMovedFrameFromStart(pair, dx, dy));

    const snapKey = (candidate: Pick<SnapCandidate, "dx" | "dy">) =>
      `${candidate.dx.toFixed(4)}:${candidate.dy.toFixed(4)}`;

    const countSnappedEdgesAt = (dx: number, dy: number) => {
      let count = 0;

      for (const movedFrame of getMovedFramesFromStart(dx, dy)) {
        const movingEdges = getSnapEdgeList(getFrameSnapEdges(movedFrame));

        for (const stationaryFrame of stationaryFrames) {
          const otherEdges = getSnapEdgeList(getFrameSnapEdges(stationaryFrame));

          for (const movingEdge of movingEdges) {
            for (const otherEdge of otherEdges) {
              const parallelSnap = getParallelEdgeAlignSnapVector(
                movingEdge,
                otherEdge
              );

              const adjacentSnap = getAdjacentSameEdgeAlignSnapVector(
                movingEdge,
                otherEdge
              );

              if (parallelSnap && parallelSnap.distance <= 0.05) {
                count++;
                continue;
              }

              if (adjacentSnap && adjacentSnap.distance <= 0.05) {
                count++;
              }
            }
          }
        }
      }

      return count;
    };

    const rawNextX = mouseXPercent - dragState.offsetX;
    const rawNextY = mouseYPercent - dragState.offsetY;

    const nextX = e.shiftKey ? snapToGridPercent(rawNextX) : rawNextX;
    const nextY = e.shiftKey ? snapToGridPercent(rawNextY) : rawNextY;

    let base = clampGroupDelta(
      nextX - anchor.startX,
      nextY - anchor.startY
    );

    const candidates = new Map<string, SnapCandidate>();
    const xValues = new Set<number>([0]);
    const yValues = new Set<number>([0]);

    const addCandidate = (candidate: SnapCandidate) => {
      const clamped = clampGroupDelta(
        base.dx + candidate.dx,
        base.dy + candidate.dy
      );

      const fixed: SnapCandidate = {
        dx: Number((clamped.dx - base.dx).toFixed(4)),
        dy: Number((clamped.dy - base.dy).toFixed(4)),
        guideLine: candidate.guideLine,
      };

      const key = snapKey(fixed);
      const existing = candidates.get(key);

      candidates.set(key, {
        ...fixed,
        guideLine: fixed.guideLine ?? existing?.guideLine ?? null,
      });

      xValues.add(fixed.dx);
      yValues.add(fixed.dy);
    };

    addCandidate({ dx: 0, dy: 0, guideLine: null });

    for (const movedFrame of getMovedFramesFromStart(base.dx, base.dy)) {
      const movingEdges = getSnapEdgeList(getFrameSnapEdges(movedFrame));

      for (const stationaryFrame of stationaryFrames) {
        const otherEdges = getSnapEdgeList(getFrameSnapEdges(stationaryFrame));

        for (const movingEdge of movingEdges) {
          for (const otherEdge of otherEdges) {
            const guideLine = getSnapGuideLineFromEdge(otherEdge);

            const snaps = [
              getParallelEdgeAlignSnapVector(movingEdge, otherEdge),
              getAdjacentSameEdgeAlignSnapVector(movingEdge, otherEdge),
            ].filter(
              (
                snap
              ): snap is { dx: number; dy: number; distance: number } =>
                !!snap && snap.distance <= FRAME_SNAP_THRESHOLD + 0.0001
            );

            for (const snap of snaps) {
              addCandidate({
                dx: snap.dx,
                dy: snap.dy,
                guideLine,
              });
            }
          }
        }
      }
    }

    for (const dx of xValues) {
      for (const dy of yValues) {
        addCandidate({ dx, dy, guideLine: null });
      }
    }

    let bestCandidate: SnapCandidate = { dx: 0, dy: 0, guideLine: null };
    let bestScore = countSnappedEdgesAt(base.dx, base.dy);
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of candidates.values()) {
      const nextDx = base.dx + candidate.dx;
      const nextDy = base.dy + candidate.dy;
      const score = countSnappedEdgesAt(nextDx, nextDy);
      const distance = Math.hypot(candidate.dx, candidate.dy);

      if (
        score > bestScore ||
        (score === bestScore && distance < bestDistance)
      ) {
        bestCandidate = candidate;
        bestScore = score;
        bestDistance = distance;
      }
    }

    base = clampGroupDelta(
      base.dx + bestCandidate.dx,
      base.dy + bestCandidate.dy
    );

    setSnapGuideLines(
      collectSnappedGuideLines(
        getMovedFramesFromStart(base.dx, base.dy),
        stationaryFrames
      )
    );

    if (
      !dragState.hasMoved &&
      Math.abs(base.dx) <= 0.001 &&
      Math.abs(base.dy) <= 0.001
    ) {
      return;
    }

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                frames: page.frames.map((frame) => {
                  const pair = movingFramePairs.find(
                    (item) => item.frame.id === frame.id
                  );

                  if (!pair) return frame;

                  return buildMovedFrameFromStart(pair, base.dx, base.dy);
                }),
                bubbles: page.bubbles.map((bubble) => {
                  const item = bubbleItems.find((x) => x.id === bubble.id);
                  if (!item) return bubble;

                  return {
                    ...bubble,
                    x: item.startX + base.dx,
                    y: item.startY + base.dy,
                  };
                }),
                sounds: page.sounds.map((sound) => {
                  const item = soundItems.find((x) => x.id === sound.id);
                  if (!item) return sound;

                  return {
                    ...sound,
                    x: item.startX + base.dx,
                    y: item.startY + base.dy,
                  };
                }),
              }
            : page
        ),
      { recordHistory: false }
    );
  };

  const handleFrameResizeDrag = ({
    dragState,
    currentPage,
    currentPageId,
    rect,
    e,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "frame-resize" }>;
    currentPage: Page;
    currentPageId: number;
    rect: DOMRect;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const target = currentPage.frames.find((frame) => frame.id === dragState.id);
    if (!target) return;

    let singleEdgeResizeMode =
      dragState.resizeMode === "left" ||
      dragState.resizeMode === "right" ||
      dragState.resizeMode === "top" ||
      dragState.resizeMode === "bottom"
        ? dragState.resizeMode
        : null;

    const isMultiFrameResize = selectedFrameIds.length > 1;
    const snapThreshold = FRAME_SNAP_THRESHOLD;

    const mouseDeltaX =
      ((e.clientX - dragState.startMouseX) / rect.width) * 100;
    const mouseDeltaY =
      ((e.clientY - dragState.startMouseY) / rect.height) * 100;

    const targetEdges = getFrameSnapEdges(target);

    let desiredLeft = targetEdges.left.p1.x;
    let desiredRight = targetEdges.right.p1.x;
    let desiredTop = targetEdges.top.p1.y;
    let desiredBottom = targetEdges.bottom.p1.y;

    if (
      dragState.resizeMode === "left" ||
      dragState.resizeMode === "top-left" ||
      dragState.resizeMode === "bottom-left"
    ) {
      desiredLeft = dragState.startLeftEdgeX + mouseDeltaX;
    }

    if (
      dragState.resizeMode === "right" ||
      dragState.resizeMode === "top-right" ||
      dragState.resizeMode === "bottom-right"
    ) {
      desiredRight = dragState.startRightEdgeX + mouseDeltaX;
    }

    if (
      dragState.resizeMode === "top" ||
      dragState.resizeMode === "top-left" ||
      dragState.resizeMode === "top-right"
    ) {
      desiredTop = dragState.startTopEdgeY + mouseDeltaY;
    }

    if (
      dragState.resizeMode === "bottom" ||
      dragState.resizeMode === "bottom-left" ||
      dragState.resizeMode === "bottom-right"
    ) {
      desiredBottom = dragState.startBottomEdgeY + mouseDeltaY;
    }

    if (e.shiftKey) {
      if (
        dragState.resizeMode === "left" ||
        dragState.resizeMode === "top-left" ||
        dragState.resizeMode === "bottom-left"
      ) {
        desiredLeft = snapToGridPercent(desiredLeft);
      }

      if (
        dragState.resizeMode === "right" ||
        dragState.resizeMode === "top-right" ||
        dragState.resizeMode === "bottom-right"
      ) {
        desiredRight = snapToGridPercent(desiredRight);
      }

      if (
        dragState.resizeMode === "top" ||
        dragState.resizeMode === "top-left" ||
        dragState.resizeMode === "top-right"
      ) {
        desiredTop = snapToGridPercent(desiredTop);
      }

      if (
        dragState.resizeMode === "bottom" ||
        dragState.resizeMode === "bottom-left" ||
        dragState.resizeMode === "bottom-right"
      ) {
        desiredBottom = snapToGridPercent(desiredBottom);
      }
    }

    let rawDx = 0;
    let rawDy = 0;

    if (
      dragState.resizeMode === "left" ||
      dragState.resizeMode === "top-left" ||
      dragState.resizeMode === "bottom-left"
    ) {
      rawDx = desiredLeft - targetEdges.left.p1.x;
    }

    if (
      dragState.resizeMode === "right" ||
      dragState.resizeMode === "top-right" ||
      dragState.resizeMode === "bottom-right"
    ) {
      rawDx = desiredRight - targetEdges.right.p1.x;
    }

    if (
      dragState.resizeMode === "top" ||
      dragState.resizeMode === "top-left" ||
      dragState.resizeMode === "top-right"
    ) {
      rawDy = desiredTop - targetEdges.top.p1.y;
    }

    if (
      dragState.resizeMode === "bottom" ||
      dragState.resizeMode === "bottom-left" ||
      dragState.resizeMode === "bottom-right"
    ) {
      rawDy = desiredBottom - targetEdges.bottom.p1.y;
    }

    let activeResizeMode = dragState.resizeMode;
    let flippedXThisFrame = false;
    let flippedYThisFrame = false;
    let flipAnchorX: { edge: "left" | "right"; valuePercent: number } | undefined;
    let flipAnchorY: { edge: "top" | "bottom"; valuePercent: number } | undefined;
    let flipEdgeTargets: FrameEdgeCoordinateTargets | null = null;
    const MIN_FRAME_FLIP_EDGE_LENGTH = 2;

    const resizeAxisModes = getFrameResizeAxisModes(activeResizeMode);

    if (
      resizeAxisModes.horizontal === "left" &&
      desiredLeft > dragState.startRightEdgeX - MIN_FRAME_FLIP_EDGE_LENGTH
    ) {
      activeResizeMode = replaceFrameResizeAxisMode(activeResizeMode, "x", "right");
      const innerLeft = targetEdges.right.p1.x;
      const outerRight = Math.max(desiredLeft, innerLeft + MIN_FRAME_FLIP_EDGE_LENGTH);
      rawDx = outerRight - targetEdges.right.p1.x;
      flippedXThisFrame = true;
      flipAnchorX = { edge: "left", valuePercent: outerRight };
      flipEdgeTargets = {
        ...(flipEdgeTargets ?? {}),
        left: innerLeft,
        right: outerRight,
      };
    } else if (
      resizeAxisModes.horizontal === "right" &&
      desiredRight < dragState.startLeftEdgeX + MIN_FRAME_FLIP_EDGE_LENGTH
    ) {
      activeResizeMode = replaceFrameResizeAxisMode(activeResizeMode, "x", "left");
      const innerRight = targetEdges.left.p1.x;
      const outerLeft = Math.min(desiredRight, innerRight - MIN_FRAME_FLIP_EDGE_LENGTH);
      rawDx = outerLeft - targetEdges.left.p1.x;
      flippedXThisFrame = true;
      flipAnchorX = { edge: "right", valuePercent: outerLeft };
      flipEdgeTargets = {
        ...(flipEdgeTargets ?? {}),
        left: outerLeft,
        right: innerRight,
      };
    }

    if (
      resizeAxisModes.vertical === "top" &&
      desiredTop > dragState.startBottomEdgeY - MIN_FRAME_FLIP_EDGE_LENGTH
    ) {
      activeResizeMode = replaceFrameResizeAxisMode(activeResizeMode, "y", "bottom");
      const innerTop = targetEdges.bottom.p1.y;
      const outerBottom = Math.max(desiredTop, innerTop + MIN_FRAME_FLIP_EDGE_LENGTH);
      rawDy = outerBottom - targetEdges.bottom.p1.y;
      flippedYThisFrame = true;
      flipAnchorY = { edge: "top", valuePercent: outerBottom };
      flipEdgeTargets = {
        ...(flipEdgeTargets ?? {}),
        top: innerTop,
        bottom: outerBottom,
      };
    } else if (
      resizeAxisModes.vertical === "bottom" &&
      desiredBottom < dragState.startTopEdgeY + MIN_FRAME_FLIP_EDGE_LENGTH
    ) {
      activeResizeMode = replaceFrameResizeAxisMode(activeResizeMode, "y", "top");
      const innerBottom = targetEdges.top.p1.y;
      const outerTop = Math.min(desiredBottom, innerBottom - MIN_FRAME_FLIP_EDGE_LENGTH);
      rawDy = outerTop - targetEdges.top.p1.y;
      flippedYThisFrame = true;
      flipAnchorY = { edge: "bottom", valuePercent: outerTop };
      flipEdgeTargets = {
        ...(flipEdgeTargets ?? {}),
        top: outerTop,
        bottom: innerBottom,
      };
    }

    singleEdgeResizeMode =
      activeResizeMode === "left" ||
      activeResizeMode === "right" ||
      activeResizeMode === "top" ||
      activeResizeMode === "bottom"
        ? activeResizeMode
        : null;

    let resized =
      (flipEdgeTargets
        ? resizeFrameWithEdgeCoordinateTargets(target, flipEdgeTargets)
        : null) ??
      resizeFrameWithCornerFallback(target, activeResizeMode, rawDx, rawDy) ??
      target;

    resized = withFrameImageFlip(resized, {
      x: flippedXThisFrame,
      y: flippedYThisFrame,
    });

    let snappedThisFrame = false;
    let nextSnapLock =
      isMultiFrameResize && dragState.snapLock ? dragState.snapLock : null;

    const getMousePercentPoint = () => ({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });

    const getEdgeNormal = (
      frame: Frame,
      edge: "left" | "right" | "top" | "bottom"
    ): PercentPoint | null => {
      const snapEdge = getFrameSnapEdges(frame)[edge];
      const dir = normalizeVector(getEdgeVector(snapEdge));
      if (!dir) return null;

      return {
        x: -dir.y,
        y: dir.x,
      };
    };

    const getEdgeProjection = (
      frame: Frame,
      edge: "left" | "right" | "top" | "bottom",
      normal: PercentPoint
    ) => {
      const snapEdge = getFrameSnapEdges(frame)[edge];
      const mid = getEdgeMidPoint(snapEdge);
      return dot(mid, normal);
    };

    if (!flipEdgeTargets && singleEdgeResizeMode && isMultiFrameResize && nextSnapLock) {
      const mousePoint = getMousePercentPoint();
      const currentMouseProjection = dot(mousePoint, nextSnapLock.normal);
      const releaseDistanceFromMouse = Math.abs(
        currentMouseProjection - nextSnapLock.lockMouseProjection
      );

      if (releaseDistanceFromMouse < nextSnapLock.releaseDistance) {
        const currentProjection = getEdgeProjection(
          resized,
          nextSnapLock.edge,
          nextSnapLock.normal
        );

        const lockShift =
          nextSnapLock.lockedEdgeProjection - currentProjection;

        const locked = resizeFrameWithParallelEdges(
          target,
          activeResizeMode,
          rawDx + nextSnapLock.normal.x * lockShift,
          rawDy + nextSnapLock.normal.y * lockShift
        );

        if (locked) {
          resized = locked;
          snappedThisFrame = true;
        } else {
          nextSnapLock = null;
        }
      } else {
        nextSnapLock = null;
      }
    }

    if (!flipEdgeTargets && singleEdgeResizeMode && (!isMultiFrameResize || !nextSnapLock)) {
      const nextEdges = getFrameSnapEdges(resized);
      const movingEdge = nextEdges[singleEdgeResizeMode];

      const pickBetterSnap = (
        current: { dx: number; dy: number; distance: number } | null,
        candidate: { dx: number; dy: number; distance: number } | null
      ): { dx: number; dy: number; distance: number } | null => {
        if (!candidate) return current;
        if (candidate.distance > snapThreshold + 0.0001) return current;
        if (!current) return candidate;
        return candidate.distance < current.distance ? candidate : current;
      };

      let bestSnap: { dx: number; dy: number; distance: number } | null = null;

      for (const frame of currentPage.frames) {
        if (selectedFrameIds.includes(frame.id)) continue;

        const otherEdges = getSnapEdgeList(getFrameSnapEdges(frame));

        for (const otherEdge of otherEdges) {
          bestSnap = pickBetterSnap(
            bestSnap,
            getParallelEdgeAlignSnapVector(movingEdge, otherEdge)
          );

          if (!isMultiFrameResize) {
            bestSnap = pickBetterSnap(
              bestSnap,
              getAdjacentSameEdgeAlignSnapVector(movingEdge, otherEdge)
            );
          }
        }
      }

      if (bestSnap !== null) {
        const snapped = resizeFrameWithParallelEdges(
          target,
          activeResizeMode,
          rawDx + bestSnap.dx,
          rawDy + bestSnap.dy
        );

        if (snapped) {
          resized = snapped;
          snappedThisFrame = true;

          if (isMultiFrameResize) {
            const normal = getEdgeNormal(snapped, singleEdgeResizeMode);
            if (normal) {
              const mousePoint = getMousePercentPoint();

              nextSnapLock = {
                edge: singleEdgeResizeMode,
                normal,
                lockMouseProjection: dot(mousePoint, normal),
                releaseDistance: snapThreshold,
                lockedEdgeProjection: getEdgeProjection(
                  snapped,
                  singleEdgeResizeMode,
                  normal
                ),
              };
            } else {
              nextSnapLock = null;
            }
          } else {
            nextSnapLock = null;
          }
        } else if (!isMultiFrameResize) {
          nextSnapLock = null;
        }
      } else if (!isMultiFrameResize) {
        nextSnapLock = null;
      }
    }

    if (!flipEdgeTargets && !singleEdgeResizeMode) {
      const baseResized =
        resizeFrameWithCornerFallback(target, activeResizeMode, rawDx, rawDy) ??
        target;

      const movedEdges = getResizeModeEdges(activeResizeMode);

      const pickBetterSnap = (
        current: { dx: number; dy: number; distance: number } | null,
        candidate: { dx: number; dy: number; distance: number } | null
      ): { dx: number; dy: number; distance: number } | null => {
        if (!candidate) return current;
        if (candidate.distance > snapThreshold + 0.0001) return current;
        if (!current) return candidate;
        return candidate.distance < current.distance ? candidate : current;
      };

      const nextEdges = getFrameSnapEdges(baseResized);

      let bestX: { dx: number; dy: number; distance: number } | null = null;
      let bestY: { dx: number; dy: number; distance: number } | null = null;

      for (const frame of currentPage.frames) {
        if (selectedFrameIds.includes(frame.id)) continue;

        const otherEdges = getSnapEdgeList(getFrameSnapEdges(frame));

        for (const otherEdge of otherEdges) {
          for (const movedEdge of movedEdges) {
            const movingEdge = nextEdges[movedEdge];

            const parallelSnap = getParallelEdgeAlignSnapVector(
              movingEdge,
              otherEdge
            );

            const adjacentSnap = getAdjacentSameEdgeAlignSnapVector(
              movingEdge,
              otherEdge
            );

            const candidate = pickBetterSnap(parallelSnap, adjacentSnap);
            if (!candidate) continue;

            if (movedEdge === "left" || movedEdge === "right") {
              bestX = pickBetterSnap(bestX, candidate);
            }

            if (movedEdge === "top" || movedEdge === "bottom") {
              bestY = pickBetterSnap(bestY, candidate);
            }
          }
        }
      }

      const snapDx = bestX?.dx ?? 0;
      const snapDy = bestY?.dy ?? 0;

      if (Math.abs(snapDx) > 0.0001 || Math.abs(snapDy) > 0.0001) {
        const snapped =
          resizeFrameWithCornerFallback(
            target,
            activeResizeMode,
            rawDx + snapDx,
            rawDy + snapDy
          ) ?? baseResized;

        resized = snapped;
        snappedThisFrame = true;
      } else {
        resized = baseResized;
      }

      nextSnapLock = null;
    }

    const buddyResizedList: Frame[] = [];

    if (
      dragState.linkedBuddies.length > 0 &&
      singleEdgeResizeMode &&
      selectedFrameIds.length > 1
    ) {
      const beforeEdge = getFrameSnapEdges(target)[singleEdgeResizeMode];
      const afterEdge = getFrameSnapEdges(resized)[singleEdgeResizeMode];

      const beforeMid = getEdgeMidPoint(beforeEdge);
      const afterMid = getEdgeMidPoint(afterEdge);

      const parentDir = normalizeVector(getEdgeVector(beforeEdge));
      if (!parentDir) return;

      const parentNormal = {
        x: -parentDir.y,
        y: parentDir.x,
      };

      const movedDistance =
        (afterMid.x - beforeMid.x) * parentNormal.x +
        (afterMid.y - beforeMid.y) * parentNormal.y;

      const requestedMoveVector = {
        dx: parentNormal.x * movedDistance,
        dy: parentNormal.y * movedDistance,
      };

      const tryLinkedResize = (rate: number) => {
        const moveVector = {
          dx: requestedMoveVector.dx * rate,
          dy: requestedMoveVector.dy * rate,
        };

        const nextParent = resized;
        const nextBuddies: Frame[] = [];

        for (const linkedBuddy of dragState.linkedBuddies) {
          const buddy = currentPage.frames.find(
            (frame) => frame.id === linkedBuddy.id
          );

          if (!buddy) continue;

          const nextBuddy = resizeFrameWithParallelEdges(
            buddy,
            linkedBuddy.edge,
            moveVector.dx,
            moveVector.dy
          );

          if (!nextBuddy) return null;
          if (doFramesOverlapStrict(nextParent, nextBuddy)) return null;

          nextBuddies.push(nextBuddy);
        }

        return {
          parent: nextParent,
          buddies: nextBuddies,
        };
      };

      const directLinked = tryLinkedResize(1);
      if (!directLinked) return;

      resized = directLinked.parent;
      buddyResizedList.push(...directLinked.buddies);
    }

    resized = keepFrameImageDisplayScale(target, resized, {
      allowOverflowOffset: isMultiFrameResize || trimmingFrameId === target.id,
    });

    if (flippedXThisFrame || flippedYThisFrame) {
      resized = {
        ...resized,
        imageFlipX: flippedXThisFrame
          ? !hasFrameImageFlipX(target)
          : hasFrameImageFlipX(resized),
        imageFlipY: flippedYThisFrame
          ? !hasFrameImageFlipY(target)
          : hasFrameImageFlipY(resized),
      } as Frame;

      const flippedResizeAxisModes = getFrameResizeAxisModes(activeResizeMode);
      const flippedFrameEdges = getFrameSnapEdges(resized);

      const imageAnchorX = flippedXThisFrame
        ? flippedResizeAxisModes.horizontal === "right"
          ? {
              edge: "left" as const,
              valuePercent: flippedFrameEdges.left.p1.x,
            }
          : flippedResizeAxisModes.horizontal === "left"
          ? {
              edge: "right" as const,
              valuePercent: flippedFrameEdges.right.p1.x,
            }
          : flipAnchorX
        : flipAnchorX;

      const imageAnchorY = flippedYThisFrame
        ? flippedResizeAxisModes.vertical === "bottom"
          ? {
              edge: "top" as const,
              valuePercent: flippedFrameEdges.top.p1.y,
            }
          : flippedResizeAxisModes.vertical === "top"
          ? {
              edge: "bottom" as const,
              valuePercent: flippedFrameEdges.bottom.p1.y,
            }
          : flipAnchorY
        : flipAnchorY;

      resized = alignFrameImageToFlipAnchor(resized, {
        x: imageAnchorX,
        y: imageAnchorY,
      });
    }

    for (let index = 0; index < buddyResizedList.length; index++) {
      const beforeBuddy = currentPage.frames.find(
        (frame) => frame.id === buddyResizedList[index].id
      );

      if (beforeBuddy) {
        buddyResizedList[index] = keepFrameImageDisplayScale(
          beforeBuddy,
          buddyResizedList[index],
          { allowOverflowOffset: true }
        );
      }
    }

    const resizeGuideLines = new Map<string, SnapGuideLine>();
    const resizedEdges = getFrameSnapEdges(resized);
    const resizedMovingEdges = getResizeModeEdges(activeResizeMode);

    const addResizeGuideLine = (edge: SnapEdge) => {
      const line = getSnapGuideLineFromEdge(edge);
      if (!line) return;

      const key = [
        line.x1.toFixed(4),
        line.y1.toFixed(4),
        line.x2.toFixed(4),
        line.y2.toFixed(4),
      ].join(":");

      resizeGuideLines.set(key, line);
    };

    for (const frame of currentPage.frames) {
      if (frame.id === target.id) continue;
      if (buddyResizedList.some((buddy) => buddy.id === frame.id)) continue;

      const otherEdges = getSnapEdgeList(getFrameSnapEdges(frame));

      for (const movedEdge of resizedMovingEdges) {
        const movingEdge = resizedEdges[movedEdge];

        for (const otherEdge of otherEdges) {
          const parallelSnap = getParallelEdgeAlignSnapVector(
            movingEdge,
            otherEdge
          );

          const adjacentSnap = getAdjacentSameEdgeAlignSnapVector(
            movingEdge,
            otherEdge
          );

          if (parallelSnap && parallelSnap.distance <= 0.05) {
            addResizeGuideLine(otherEdge);
            continue;
          }

          if (adjacentSnap && adjacentSnap.distance <= 0.05) {
            addResizeGuideLine(otherEdge);
          }
        }
      }
    }

    setSnapGuideLines([...resizeGuideLines.values()]);

    const changed =
      Math.abs(resized.x - target.x) > 0.0001 ||
      Math.abs(resized.y - target.y) > 0.0001 ||
      Math.abs(resized.w - target.w) > 0.0001 ||
      Math.abs(resized.h - target.h) > 0.0001 ||
      buddyResizedList.length > 0 ||
      flippedXThisFrame ||
      flippedYThisFrame;

    if (!changed && !snappedThisFrame) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                frames: page.frames.map((frame) => {
                  if (frame.id === target.id) return resized;

                  const buddyResized = buddyResizedList.find(
                    (item) => item.id === frame.id
                  );

                  if (buddyResized) return buddyResized;

                  return frame;
                }),
              }
            : page
        ),
      { recordHistory: false }
    );

    setDragState((prev) =>
      prev && prev.kind === "frame-resize"
        ? {
            ...prev,
            resizeMode: activeResizeMode,
            startMouseX: flippedXThisFrame || flippedYThisFrame ? e.clientX : prev.startMouseX,
            startMouseY: flippedXThisFrame || flippedYThisFrame ? e.clientY : prev.startMouseY,
            startX: flippedXThisFrame || flippedYThisFrame ? resized.x : prev.startX,
            startY: flippedXThisFrame || flippedYThisFrame ? resized.y : prev.startY,
            startW: flippedXThisFrame || flippedYThisFrame ? resized.w : prev.startW,
            startH: flippedXThisFrame || flippedYThisFrame ? resized.h : prev.startH,
            startLeftEdgeX: flippedXThisFrame || flippedYThisFrame ? getFrameSnapEdges(resized).left.p1.x : prev.startLeftEdgeX,
            startRightEdgeX: flippedXThisFrame || flippedYThisFrame ? getFrameSnapEdges(resized).right.p1.x : prev.startRightEdgeX,
            startTopEdgeY: flippedXThisFrame || flippedYThisFrame ? getFrameSnapEdges(resized).top.p1.y : prev.startTopEdgeY,
            startBottomEdgeY: flippedXThisFrame || flippedYThisFrame ? getFrameSnapEdges(resized).bottom.p1.y : prev.startBottomEdgeY,
            snapLock: flippedXThisFrame || flippedYThisFrame ? null : nextSnapLock,
            hasMoved: true,
            historyPushed: true,
          }
        : prev
    );
  };
  
  const handleFramePanDrag = ({
    dragState,
    currentPage,
    currentPageId,
    rect,
    e,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "frame-pan" }>;
    currentPage: Page;
    currentPageId: number;
    rect: DOMRect;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const target = currentPage.frames.find((f) => f.id === dragState.id);
    if (!target) return;

    const metrics = getFrameImageMetrics(target);

    const pageScaleX = PAGE_WIDTH / Math.max(rect.width, 0.000001);
    const pageScaleY = PAGE_HEIGHT / Math.max(rect.height, 0.000001);

    const dxPx = (e.clientX - dragState.startMouseX) * pageScaleX;
    const dyPx = (e.clientY - dragState.startMouseY) * pageScaleY;

    const trimmingDragGridX = PAGE_WIDTH * 0.025;
    const trimmingDragGridY = PAGE_HEIGHT * 0.025;

    const nextRawOffsetX =
      trimmingFrameId === target.id && e.shiftKey && trimmingDragGridX > 0
        ? dragState.startOffsetX + Math.round(dxPx / trimmingDragGridX) * trimmingDragGridX
        : dragState.startOffsetX + dxPx;

    const nextRawOffsetY =
      trimmingFrameId === target.id && e.shiftKey && trimmingDragGridY > 0
        ? dragState.startOffsetY + Math.round(dyPx / trimmingDragGridY) * trimmingDragGridY
        : dragState.startOffsetY + dyPx;

    const nextOffset =
      trimmingFrameId === target.id
        ? clampFrameImageOffsetForTrimming(target, nextRawOffsetX, nextRawOffsetY)
        : {
            imageOffsetX: clamp(
              nextRawOffsetX,
              metrics.minOffsetX,
              metrics.maxOffsetX
            ),
            imageOffsetY: clamp(
              nextRawOffsetY,
              metrics.minOffsetY,
              metrics.maxOffsetY
            ),
          };

    const nextOffsetX = nextOffset.imageOffsetX;
    const nextOffsetY = nextOffset.imageOffsetY;

    const moved =
      Math.abs(nextOffsetX - dragState.startOffsetX) > 0.001 ||
      Math.abs(nextOffsetY - dragState.startOffsetY) > 0.001;

    if (!moved) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                frames: page.frames.map((f) =>
                  f.id === dragState.id
                    ? {
                        ...f,
                        imageOffsetX: nextOffsetX,
                        imageOffsetY: nextOffsetY,
                      }
                    : f
                ),
              }
            : page
        ),
      { recordHistory: false }
    );
  };

  const handleBubbleMoveDrag = ({
    dragState,
    currentPageId,
    mouseXPercent,
    mouseYPercent,
    e,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "bubble-move" }>;
    currentPageId: number;
    mouseXPercent: number;
    mouseYPercent: number;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const anchor = dragState.items.find(
      (item) =>
        item.kind === dragState.anchorKind && item.id === dragState.anchorId
    );
    if (!anchor) return;

    const rawCurrentAnchorX = mouseXPercent - dragState.offsetX;
    const rawCurrentAnchorY = mouseYPercent - dragState.offsetY;

    const currentAnchorX = e.shiftKey
      ? snapToGridPercent(rawCurrentAnchorX)
      : rawCurrentAnchorX;
    const currentAnchorY = e.shiftKey
      ? snapToGridPercent(rawCurrentAnchorY)
      : rawCurrentAnchorY;

    const dx = currentAnchorX - anchor.startX;
    const dy = currentAnchorY - anchor.startY;

    const moved = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001;
    if (!moved) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                bubbles: page.bubbles.map((b) => {
                  const dragItem = dragState.items.find(
                    (item) => item.kind === "bubble" && item.id === b.id
                  );
                  if (!dragItem) return b;

                  return {
                    ...b,
                    x: clamp(dragItem.startX + dx, 0, 100 - b.w),
                    y: clamp(dragItem.startY + dy, 0, 100 - b.h),
                  };
                }),
                sounds: page.sounds.map((s) => {
                  const dragItem = dragState.items.find(
                    (item) => item.kind === "sound" && item.id === s.id
                  );
                  if (!dragItem) return s;

                  return {
                    ...s,
                    x: clamp(dragItem.startX + dx, 0, 95),
                    y: clamp(dragItem.startY + dy, 0, 95),
                  };
                }),
              }
            : page
        ),
      { recordHistory: false }
    );
  };

  const handleBubbleTailDrag = ({
    dragState,
    currentPage,
    currentPageId,
    mouseXPercent,
    mouseYPercent,
    e,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "bubble-tail" }>;
    currentPage: Page;
    currentPageId: number;
    mouseXPercent: number;
    mouseYPercent: number;
    e: { shiftKey: boolean };
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const bubble = currentPage.bubbles.find((b) => b.id === dragState.id);
    if (!bubble || !canBubbleUseTail(bubble)) return;

    const cxPercent = bubble.x + bubble.w / 2;
    const cyPercent = bubble.y + bubble.h / 2;

    const centerDxPercent = mouseXPercent - cxPercent;
    const centerDyPercent = mouseYPercent - cyPercent;

    const centerDxPx = (centerDxPercent / 100) * PAGE_WIDTH;
    const centerDyPx = (centerDyPercent / 100) * PAGE_HEIGHT;

    const angle = (Math.atan2(centerDyPx, centerDxPx) * 180) / Math.PI;

    const bubblePixelW = (PAGE_WIDTH * bubble.w) / 100;
    const bubblePixelH = (PAGE_HEIGHT * bubble.h) / 100;

    const boundary = getBoundaryPoint(
      bubble.shape,
      angle,
      bubblePixelW,
      bubblePixelH
    );

    const localMouseX = ((mouseXPercent - bubble.x) / bubble.w) * 100;
    const localMouseY = ((mouseYPercent - bubble.y) / bubble.h) * 100;

    const tailDxPx = ((localMouseX - boundary.x) / 100) * bubblePixelW;
    const tailDyPx = ((localMouseY - boundary.y) / 100) * bubblePixelH;

    const projectedLength =
      tailDxPx * Math.cos((angle * Math.PI) / 180) +
      tailDyPx * Math.sin((angle * Math.PI) / 180);

    const DEAD_ZONE_PX = 8;
    const absProjected = Math.abs(projectedLength);

    const nextTailEnabled = absProjected > DEAD_ZONE_PX;
    const nextTailMode: TailMode =
      projectedLength >= 0 ? "outside" : "inside";

    const minimumTailLengthPx = getBubbleMinimumTailLengthPx(bubble);
    const length = !nextTailEnabled
      ? 0
      : e.shiftKey
      ? clamp(absProjected, minimumTailLengthPx, 260)
      : minimumTailLengthPx;

    const moved =
      Math.abs(bubble.tailAngle - angle) > 0.001 ||
      Math.abs(bubble.tailLength - length) > 0.001 ||
      bubble.tailEnabled !== nextTailEnabled ||
      bubble.tailMode !== nextTailMode;

    if (!moved) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                bubbles: page.bubbles.map((b) =>
                  b.id === dragState.id
                    ? {
                        ...b,
                        tailEnabled: nextTailEnabled,
                        tailAngle: angle,
                        tailLength: length,
                        tailMode: nextTailMode,
                      }
                    : b
                ),
              }
            : page
        ),
      { recordHistory: false }
    );
  };

  const handleBubbleTailWidthDrag = ({
    dragState,
    currentPage,
    currentPageId,
    mouseXPercent,
    mouseYPercent,
    e,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "bubble-tail-width" }>;
    currentPage: Page;
    currentPageId: number;
    mouseXPercent: number;
    mouseYPercent: number;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const bubble = currentPage.bubbles.find((b) => b.id === dragState.id);
    if (!bubble || !bubble.tailEnabled || !canBubbleUseTailCurve(bubble)) return;

    const snappedMouseXPercent = e.shiftKey
      ? snapToGridPercent(mouseXPercent)
      : mouseXPercent;

    const snappedMouseYPercent = e.shiftKey
      ? snapToGridPercent(mouseYPercent)
      : mouseYPercent;

    setBubbleTailWidthDragCursor({
      id: bubble.id,
      xPercent: snappedMouseXPercent,
      yPercent: snappedMouseYPercent,
    });

    const localMouseX =
      ((snappedMouseXPercent - bubble.x) / bubble.w) * 100;

    const localMouseY =
      ((snappedMouseYPercent - bubble.y) / bubble.h) * 100;

    const {
      bubblePixelW,
      bubblePixelH,
      unitX,
      unitY,
      perpX,
      perpY,
      tipX,
      tipY,
    } = getTailGeometry(bubble);

    const tailDirection = bubble.tailMode === "outside" ? 1 : -1;
    const guideOffsetPx = 18;
    const handleCenterX =
      tipX + ((unitX * tailDirection * guideOffsetPx) / bubblePixelW) * 100;
    const handleCenterY =
      tipY + ((unitY * tailDirection * guideOffsetPx) / bubblePixelH) * 100;

    const deltaPxX =
      ((localMouseX - handleCenterX) / 100) * bubblePixelW;

    const deltaPxY =
      ((localMouseY - handleCenterY) / 100) * bubblePixelH;

    const tailStyle = bubble.tailStyle ?? "triangle";
    if (tailStyle !== "triangle" && tailStyle !== "thought") return;

    const projectedCurvePx = deltaPxX * perpX + deltaPxY * perpY;
    const CURVE_THRESHOLD_PX = 14;

    const nextTailWidth =
      projectedCurvePx <= -CURVE_THRESHOLD_PX
        ? 25
        : projectedCurvePx >= CURVE_THRESHOLD_PX
          ? 75
          : 50;

    const currentTailWidth = (() => {
      const value = Number(bubble.tailWidth ?? 50);
      if (!Number.isFinite(value)) return 50;
      if (value <= 37) return 25;
      if (value >= 63) return 75;
      return 50;
    })();

    if (currentTailWidth === nextTailWidth) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                bubbles: page.bubbles.map((b) =>
                  b.id === dragState.id
                    ? {
                        ...b,
                        tailWidth: nextTailWidth,
                      }
                    : b
                ),
              }
            : page
        ),
      { recordHistory: false }
    );
  };

  const handleSoundMoveDrag = ({
    dragState,
    currentPageId,
    mouseXPercent,
    mouseYPercent,
    e,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "sound-move" }>;
    currentPageId: number;
    mouseXPercent: number;
    mouseYPercent: number;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const anchor = dragState.items.find(
      (item) =>
        item.kind === dragState.anchorKind && item.id === dragState.anchorId
    );
    if (!anchor) return;

    const rawCurrentAnchorX = mouseXPercent - dragState.offsetX;
    const rawCurrentAnchorY = mouseYPercent - dragState.offsetY;

    const currentAnchorX = e.shiftKey
      ? snapToGridPercent(rawCurrentAnchorX)
      : rawCurrentAnchorX;
    const currentAnchorY = e.shiftKey
      ? snapToGridPercent(rawCurrentAnchorY)
      : rawCurrentAnchorY;

    const dx = currentAnchorX - anchor.startX;
    const dy = currentAnchorY - anchor.startY;

    const moved = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001;
    if (!moved) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                bubbles: page.bubbles.map((b) => {
                  const dragItem = dragState.items.find(
                    (item) => item.kind === "bubble" && item.id === b.id
                  );
                  if (!dragItem) return b;

                  return {
                    ...b,
                    x: clamp(dragItem.startX + dx, 0, 100 - b.w),
                    y: clamp(dragItem.startY + dy, 0, 100 - b.h),
                  };
                }),
                sounds: page.sounds.map((s) => {
                  const dragItem = dragState.items.find(
                    (item) => item.kind === "sound" && item.id === s.id
                  );
                  if (!dragItem) return s;

                  return {
                    ...s,
                    x: clamp(dragItem.startX + dx, 0, 95),
                    y: clamp(dragItem.startY + dy, 0, 95),
                  };
                }),
              }
            : page
        ),
      { recordHistory: false }
    );
  };

  const handleSoundResizeDrag = ({
    dragState,
    currentPage,
    rect,
    e,
    currentPageId,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "sound-resize" }>;
    currentPage: Page;
    rect: DOMRect;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    currentPageId: number;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const sound = currentPage.sounds.find((s) => s.id === dragState.id);
    if (!sound) return;

    const centerX = rect.left + (rect.width * sound.x) / 100;
    const centerY = rect.top + (rect.height * sound.y) / 100;

    const rawDxPercent = ((e.clientX - centerX) / rect.width) * 100;
    const rawDyPercent = ((e.clientY - centerY) / rect.height) * 100;

    const dxPercent = e.shiftKey
      ? snapToGridPercent(rawDxPercent)
      : rawDxPercent;
    const dyPercent = e.shiftKey
      ? snapToGridPercent(rawDyPercent)
      : rawDyPercent;

    const dx = (dxPercent / 100) * rect.width;
    const dy = (dyPercent / 100) * rect.height;
    const currentDistance = Math.max(1, Math.sqrt(dx * dx + dy * dy));

    const ratio = currentDistance / dragState.startMouseDistance;
    const nextFont = clamp(dragState.startFontSize * ratio, 16, 160);

    const moved = Math.abs(nextFont - dragState.startFontSize) > 0.001;
    if (!moved) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                sounds: page.sounds.map((s) =>
                  s.id === dragState.id ? { ...s, fontSize: nextFont } : s
                ),
              }
            : page
        ),
      { recordHistory: false }
    );
  };

  const handleSoundRotateDrag = ({
    dragState,
    currentPage,
    rect,
    e,
    currentPageId,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "sound-rotate" }>;
    currentPage: Page;
    rect: DOMRect;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    currentPageId: number;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const sound = currentPage.sounds.find((s) => s.id === dragState.id);
    if (!sound) return;

    const centerX = rect.left + (rect.width * sound.x) / 100;
    const centerY = rect.top + (rect.height * sound.y) / 100;

    const mouseAngle =
      (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;

    let nextAngle = mouseAngle + dragState.rotateOffset;

    if (e.shiftKey) {
      nextAngle = Math.round(nextAngle / 15) * 15;
    }

    const moved = Math.abs(nextAngle - sound.rotate) > 0.001;
    if (!moved) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                sounds: page.sounds.map((s) =>
                  s.id === dragState.id ? { ...s, rotate: nextAngle } : s
                ),
              }
            : page
        ),
      { recordHistory: false }
    );
  };

  const handleSoundTiltDrag = ({
    dragState,
    currentPage,
    e,
    currentPageId,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "sound-tilt" }>;
    currentPage: Page;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    currentPageId: number;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const sound = currentPage.sounds.find((s) => s.id === dragState.id);
    if (!sound) return;

    const rect = getPageRect();
    if (!rect) return;

    const box = getSoundTextBoxMetrics(sound);

    const pageScaleX = rect.width / PAGE_WIDTH || 1;
    const pageScaleY = rect.height / PAGE_HEIGHT || 1;

    const centerX = rect.left + (rect.width * sound.x) / 100;
    const centerY = rect.top + (rect.height * sound.y) / 100;

    const rad = (-(sound.rotate ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const screenToSoundLocal = (clientX: number, clientY: number) => {
      const pageDx = (clientX - centerX) / pageScaleX;
      const pageDy = (clientY - centerY) / pageScaleY;

      return {
        x: pageDx * cos - pageDy * sin + box.width / 2,
        y: pageDx * sin + pageDy * cos + box.height / 2,
      };
    };

    const getHandlePoint = (targetSound: SoundText) => {
      const [tl, tr, br, bl] = getSoundPolygonPoints(
        targetSound,
        box.width,
        box.height
      );

      switch (dragState.edge) {
        case "top":
          return getPointOnLine(tl, tr, 0.25);
        case "right":
          return getPointOnLine(tr, br, 0.25);
        case "bottom":
          return getPointOnLine(bl, br, 0.75);
        case "left":
          return getPointOnLine(tl, bl, 0.75);
      }
    };

    const startLocal = screenToSoundLocal(
      dragState.startMouseX,
      dragState.startMouseY
    );
    const currentLocal = screenToSoundLocal(e.clientX, e.clientY);
    const startHandlePoint = getHandlePoint(
      setSoundEdgeTilt(sound, dragState.edge, dragState.startTilt)
    );
    const desiredHandlePoint = {
      x: currentLocal.x - (startLocal.x - startHandlePoint.x),
      y: currentLocal.y - (startLocal.y - startHandlePoint.y),
    };

    const getDistanceForTilt = (tilt: number) => {
      const point = getHandlePoint(
        setSoundEdgeTilt(sound, dragState.edge, tilt as SoundTiltValue)
      );

      return Math.hypot(
        point.x - desiredHandlePoint.x,
        point.y - desiredHandlePoint.y
      );
    };

    let bestTilt = -30;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let tilt = -30; tilt <= 30.000001; tilt += 0.25) {
      const distance = getDistanceForTilt(tilt);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestTilt = tilt;
      }
    }

    const left = Math.max(-30, bestTilt - 0.3);
    const right = Math.min(30, bestTilt + 0.3);

    for (let tilt = left; tilt <= right + 0.000001; tilt += 0.02) {
      const distance = getDistanceForTilt(tilt);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestTilt = tilt;
      }
    }

    const roundedTilt = Math.round(bestTilt * 10) / 10;
    const nextTilt = (Math.abs(roundedTilt) < 0.6 ? 0 : roundedTilt) as SoundTiltValue;

    if (Math.abs(Number(getSoundEdgeTilt(sound, dragState.edge)) - Number(nextTilt)) < 0.001) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                sounds: page.sounds.map((s) =>
                  s.id === dragState.id
                    ? setSoundEdgeTilt(s, dragState.edge, nextTilt)
                    : s
                ),
              }
            : page
        ),
      { recordHistory: false }
    );

    setDragState((prev) =>
      prev && prev.kind === "sound-tilt"
        ? { ...prev, hasMoved: true, historyPushed: true }
        : prev
    );
  };


  const handleSoundCurveDrag = ({
    dragState,
    currentPage,
    rect,
    e,
    currentPageId,
    applyPagesChange,
    ensureDragHistory,
  }: {
    dragState: Extract<DragState, { kind: "sound-curve" }>;
    currentPage: Page;
    rect: DOMRect;
    e: MouseEvent | React.MouseEvent<HTMLDivElement>;
    currentPageId: number;
    applyPagesChange: (
      updater: Page[] | ((prev: Page[]) => Page[]),
      options?: { recordHistory?: boolean }
    ) => void;
    ensureDragHistory: () => void;
  }) => {
    const sound = currentPage.sounds.find((s) => s.id === dragState.id);
    if (!sound) return;

    const snapCurveStep = (value: number) => {
      return clamp(Math.round(value / 15) * 15, -120, 120);
    };

    const pageScaleX = rect.width / PAGE_WIDTH || 1;
    const pageScaleY = rect.height / PAGE_HEIGHT || 1;
    const rad = (-(sound.rotate ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const pageDx = (e.clientX - dragState.startMouseX) / pageScaleX;
    const pageDy = (e.clientY - dragState.startMouseY) / pageScaleY;
    const localDx = pageDx * cos - pageDy * sin;
    const localDy = pageDx * sin + pageDy * cos;

    const rawCurveX =
      dragState.axis === "x"
        ? dragState.startCurveX + localDx
        : dragState.startCurveX;

    const rawCurveY =
      dragState.axis === "y"
        ? dragState.startCurveY + localDy
        : dragState.startCurveY;

    const nextCurveX =
      dragState.axis === "x"
        ? e.shiftKey
          ? snapCurveStep(rawCurveX)
          : clamp(rawCurveX, -120, 120)
        : dragState.startCurveX;

    const nextCurveY =
      dragState.axis === "y"
        ? e.shiftKey
          ? snapCurveStep(rawCurveY)
          : clamp(rawCurveY, -120, 120)
        : dragState.startCurveY;

    const moved =
      Math.abs(nextCurveX - (sound.curveX ?? 0)) > 0.001 ||
      Math.abs(nextCurveY - (sound.curveY ?? 0)) > 0.001;

    if (!moved) return;

    ensureDragHistory();

    applyPagesChange(
      (prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                sounds: page.sounds.map((s) =>
                  s.id === dragState.id
                    ? { ...s, curveX: nextCurveX, curveY: nextCurveY }
                    : s
                ),
              }
            : page
        ),
      { recordHistory: false }
    );

    setDragState((prev) =>
      prev && prev.kind === "sound-curve"
        ? { ...prev, hasMoved: true, historyPushed: true }
        : prev
    );
  };


  const handlePageMouseMove = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>
  ) => {
    if (currentPageId == null || !currentPage || !pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();

    const rawMouseXPercent =
      ((e.clientX - rect.left) / rect.width) * 100;
    const rawMouseYPercent =
      ((e.clientY - rect.top) / rect.height) * 100;

    const mouseXPercent = clamp(rawMouseXPercent, 0, 100);
    const mouseYPercent = clamp(rawMouseYPercent, 0, 100);

    if (dragState?.kind === "bubble-tail") {
      bubbleTailDragPointerRef.current = { xPercent: mouseXPercent, yPercent: mouseYPercent };
    }

    if (selectionBox) {
      setSelectionBox((prev) =>
        prev
          ? {
              ...prev,
              currentX: mouseXPercent,
              currentY: mouseYPercent,
            }
          : prev
      );

      return;
    }

    if (!dragState) return;

    const ensureDragHistory = () => {
      if (!dragHistoryPushedRef.current) {
        dragHistoryPushedRef.current = true;
        pushHistorySnapshot();

        if (
          dragState.kind === "multi-move" ||
          dragState.kind === "bubble-move" ||
          dragState.kind === "sound-move"
        ) {
          setSelectedItems(
            sanitizeSelectedItems(
              dragState.items.map((item) => ({ kind: item.kind, id: item.id }))
            )
          );
        }

        setDragState((prev) =>
          prev ? { ...prev, historyPushed: true, hasMoved: true } : prev
        );
        return;
      }

      if (!dragState.hasMoved) {
        setDragState((prev) =>
          prev ? { ...prev, hasMoved: true } : prev
        );
      }
    };

    if (dragState.kind === "multi-move") {
      handleMultiMoveDrag({
        dragState,
        currentPage,
        currentPageId,
        mouseXPercent,
        mouseYPercent,
        e,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "frame-resize") {
      handleFrameResizeDrag({
        dragState,
        currentPage,
        currentPageId,
        rect,
        e,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "frame-tilt") {
      const baseFrame = currentPage.frames.find((f) => f.id === dragState.id);
      if (!baseFrame) return;

      if (!dragHistoryPushedRef.current) {
        dragHistoryPushedRef.current = true;
        pushHistorySnapshot();

        setDragState((prev) =>
          prev && prev.kind === "frame-tilt"
            ? { ...prev, historyPushed: true, hasMoved: true }
            : prev
        );
      }

      const pageRect = pageRef.current?.getBoundingClientRect();
      if (!pageRect) return;

      const pointer: PercentPoint = {
        x: ((e.clientX - pageRect.left) / pageRect.width) * 100,
        y: ((e.clientY - pageRect.top) / pageRect.height) * 100,
      };

      const nextTilt = getNearestFrameTiltByPointer(
        baseFrame,
        dragState.edge,
        pointer
      );

      const currentTilt = getFrameEdgeTiltFromPoints(baseFrame, dragState.edge);
      if (currentTilt === nextTilt) return;

      const oppositeEdge = getOppositeTiltEdge(dragState.edge);
      const linkedIds = new Set(dragState.linkedFrameIds);

      applyPagesChange(
        (prev) =>
          prev.map((page) => {
            if (page.id !== currentPageId) return page;

            const currentBase = page.frames.find((frame) => frame.id === baseFrame.id);
            if (!currentBase) return page;

            const rawNextBase = tiltFrameWithPoints(
              currentBase,
              dragState.edge,
              nextTilt
            );

            if (!rawNextBase || !isValidFramePolygonForTransform(rawNextBase)) {
              return page;
            }

            const tiltStartFrame = dragState.startFrame;
            const nextBase =
              tiltStartFrame.id === rawNextBase.id && hasFrameImage(tiltStartFrame)
                ? keepFrameImageDisplayScale(tiltStartFrame, rawNextBase, {
                    allowOverflowOffset: true,
                  })
                : rawNextBase;

            const nextBaseEdge = getFrameSnapEdges(nextBase)[dragState.edge];

            const nextFrames = page.frames.map((frame) => {
              if (frame.id === nextBase.id) {
                return nextBase;
              }

              if (linkedIds.has(frame.id)) {
                const linkedNext = tiltFrameEdgeToMatchLineKeepingOpposite(
                  frame,
                  oppositeEdge,
                  nextBaseEdge,
                  nextTilt
                );

                if (!linkedNext || !isValidFramePolygonForTransform(linkedNext)) {
                  return null;
                }

                return hasFrameImage(frame)
                  ? keepFrameImageDisplayScale(frame, linkedNext, {
                      allowOverflowOffset: true,
                    })
                  : linkedNext;
              }

              return frame;
            });

            if (nextFrames.some((frame) => frame == null)) {
              return page;
            }

            return {
              ...page,
              frames: nextFrames as Frame[],
            };
          }),
        { recordHistory: false }
      );

      setDragState((prev) =>
        prev && prev.kind === "frame-tilt"
          ? {
              ...prev,
              linkedFrameIds: dragState.linkedFrameIds,
              hasMoved: true,
              historyPushed: true,
            }
          : prev
      );

      return;
    }

    if (dragState.kind === "frame-pan") {
      const rect = getPageRect();
      if (!rect) return;

      handleFramePanDrag({
        dragState,
        currentPage,
        currentPageId,
        rect,
        e,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "bubble-move") {
      handleBubbleMoveDrag({
        dragState,
        currentPageId,
        mouseXPercent,
        mouseYPercent,
        e,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "bubble-tail") {
      handleBubbleTailDrag({
        dragState,
        currentPage,
        currentPageId,
        mouseXPercent,
        mouseYPercent,
        e,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "bubble-tail-width") {
      handleBubbleTailWidthDrag({
        dragState,
        currentPage,
        currentPageId,
        mouseXPercent,
        mouseYPercent,
        e,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "sound-move") {
      handleSoundMoveDrag({
        dragState,
        currentPageId,
        mouseXPercent,
        mouseYPercent,
        e,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "sound-resize") {
      handleSoundResizeDrag({
        dragState,
        currentPage,
        rect,
        e,
        currentPageId,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "sound-rotate") {
      handleSoundRotateDrag({
        dragState,
        currentPage,
        rect,
        e,
        currentPageId,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "sound-tilt") {
      handleSoundTiltDrag({
        dragState,
        currentPage,
        e,
        currentPageId,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }

    if (dragState.kind === "sound-curve") {
      handleSoundCurveDrag({
        dragState,
        currentPage,
        rect,
        e,
        currentPageId,
        applyPagesChange,
        ensureDragHistory,
      });
      return;
    }
  };

  useEffect(() => {
    const handleBubbleTailShiftSnap = (e: KeyboardEvent) => {
      if (e.key !== "Shift") return;
      if (!dragState || dragState.kind !== "bubble-tail") return;
      if (currentPageId == null || !currentPage) return;

      const pointer = bubbleTailDragPointerRef.current;
      if (!pointer) return;

      const ensureDragHistory = () => {
        if (!dragHistoryPushedRef.current) {
          dragHistoryPushedRef.current = true;
          pushHistorySnapshot();

          setDragState((prev) =>
            prev ? { ...prev, historyPushed: true, hasMoved: true } : prev
          );
          return;
        }

        if (!dragState.hasMoved) {
          setDragState((prev) =>
            prev ? { ...prev, hasMoved: true } : prev
          );
        }
      };

      handleBubbleTailDrag({
        dragState,
        currentPage,
        currentPageId,
        mouseXPercent: pointer.xPercent,
        mouseYPercent: pointer.yPercent,
        e: { shiftKey: true },
        applyPagesChange,
        ensureDragHistory,
      });
    };

    window.addEventListener("keydown", handleBubbleTailShiftSnap, true);

    return () => {
      window.removeEventListener("keydown", handleBubbleTailShiftSnap, true);
    };
  }, [dragState, currentPage, currentPageId]);

  const stopDrag = () => {
    bubbleTailDragPointerRef.current = null;
    dragHistoryPushedRef.current = false;
    setDragState(null);
    setSnapGuideLines([]);
  };

  const startSelectionBox = (
    e: React.MouseEvent<HTMLElement>,
    additive: boolean
  ): boolean => {
    if (!currentPage) return false;

    const point = getPagePercentPointFromMouse(e);
    if (!point) return false;

    setSelectionBox({
      startX: point.xPercent,
      startY: point.yPercent,
      currentX: point.xPercent,
      currentY: point.yPercent,
      additive,
    });

    return true;
  };

  const buildProjectData = (): ProjectData => ({
    version: 1,
    pages,
    hasCovers,
    showPageNumbers,
    imageAssets: getImageAssetsForPages(pages),
  });

  const buildProjectBlob = () => {
    return new Blob([JSON.stringify(buildProjectData(), null, 2)], {
      type: "application/json",
    });
  };

  const ensureProjectFileWritePermission = async (
    fileHandle: FileSystemFileHandle
  ): Promise<boolean> => {
    const options: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };

    if (fileHandle.queryPermission) {
      const currentPermission = await fileHandle.queryPermission(options);
      if (currentPermission === "granted") return true;
    }

    if (fileHandle.requestPermission) {
      const requestedPermission = await fileHandle.requestPermission(options);
      return requestedPermission === "granted";
    }

    return true;
  };

  const saveProjectToHandle = async (fileHandle: FileSystemFileHandle) => {
    const hasPermission = await ensureProjectFileWritePermission(fileHandle);

    if (!hasPermission) {
      throw new DOMException(
        "Project file write permission was not granted.",
        "NotAllowedError"
      );
    }

    const writable = await fileHandle.createWritable();

    try {
      await writable.write(buildProjectBlob());
      await writable.close();
    } catch (error) {
      try {
        await writable.close();
      } catch {
        // 保存失敗時の後始末
      }

      throw error;
    }

    projectFileHandleRef.current = fileHandle;
    setProjectFileName(fileHandle.name);
  };

  const downloadProjectFallback = (): boolean => {
    const name = window.prompt(t("promptSaveFileName"), projectFileName ?? "manga-project");
    if (!name) return false;

    const safeName = name.replace(/[\/:*?"<>|]/g, "_");
    const fileName = safeName.endsWith(".mansa") ? safeName : `${safeName}.mansa`;

    const blob = buildProjectBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);

    return true;
  };

  const handleSaveProjectAs = async (): Promise<boolean> => {
    if (!canUseFileSystemPicker) {
      return downloadProjectFallback();
    }

    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: projectFileName ?? "manga-project.mansa",
        types: [
          {
            description: t("mangaProjectJson"),
            accept: {
              "application/x-mansa": [".mansa"],
            },
          },
        ],
      });

      await saveProjectToHandle(fileHandle);
      return true;
    } catch (error) {
      if (isAbortError(error)) {
        return false;
      }

      alert(t(isPermissionError(error) ? "savePermissionDenied" : "saveFailed"));
      return false;
    }
  };

  const handleSaveProject = async (): Promise<boolean> => {
    if (!canUseFileSystemPicker) {
      return downloadProjectFallback();
    }

    if (!projectFileHandleRef.current) {
      return await handleSaveProjectAs();
    }

    try {
      await saveProjectToHandle(projectFileHandleRef.current);
      return true;
    } catch (error) {
      alert(
        t(
          isPermissionError(error)
            ? "savePermissionDenied"
            : "overwriteSaveFailed"
        )
      );
      projectFileHandleRef.current = null;
      setProjectFileName(null);
      return false;
    }
  };

  const handleSaveProjectWithStatus = async (anchorElement: HTMLElement | null) => {
    const saved = await handleSaveProject();

    if (!saved) {
      return;
    }

    setHasUnsavedChanges(false);
    void clearProjectAutoSave();
    trackSaveProject();
    showFloatingNotice(t("saved"), anchorElement);
  };

  const confirmDiscardUnsavedChanges = () => {
    if (!hasUnsavedChanges) return true;

    return window.confirm(t("confirmDiscardUnsavedChanges"));
  };

  const handleNewProject = () => {
    if (!confirmDiscardUnsavedChanges()) return;

    closeTopToolbarMenus();
    const initialPages = createInitialPages();

    projectFileHandleRef.current = null;
    setProjectFileName(null);
    setHasCovers(false);
    setShowPageNumbers(true);
    setUndoStack([]);
    setRedoStack([]);
    setImageAssets({});
    setPages(sanitizeProjectPagesForState(clonePages(initialPages)));
    setCurrentPageId(null);
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setSelectedItems([]);
    setSelectedTemplateId(null);
    setClipboardItem(null);
    setPageClipboard(null);
    setDragState(null);
    setSnapGuideLines([]);
    setSelectionBox(null);
    setPageSelectionBox(null);
    setTrimmingFrameId(null);
    setSelectedFrameImageCardId(null);
    setActiveTargetType("page");
    setMainMode("manga");
    setOpenEditorSectionKey(null);
    closeAllFloatingMenus();
    setHasUnsavedChanges(false);
    void clearProjectAutoSave();
  };

  const restoreProjectData = (raw: ProjectData, options?: { markUnsaved?: boolean }) => {
    if (!raw.pages || !Array.isArray(raw.pages)) {
      throw new Error("Invalid Mansaku project data.");
    }

    const normalizedPages = normalizeProjectCoverStructure(
      raw.pages.map((page) =>
        restorePageBubbleColorFields(
          preserveFrameImageFlipFields(normalizePage(page), page),
          page
        )
      )
    );
    const migrated = migrateInlineImagesToAssets(
      normalizedPages,
      raw.imageAssets ?? {}
    );
    const nextCurrentPageId = getFirstContentPage(migrated.pages)?.id ?? migrated.pages[0]?.id ?? null;

    setHasCovers(raw.hasCovers ?? false);
    setShowPageNumbers(raw.showPageNumbers ?? true);

    setUndoStack([]);
    setRedoStack([]);
    setImageAssets(migrated.imageAssets);
    setPages(sanitizeProjectPagesForState(clonePages(migrated.pages)));
    setCurrentPageId(nextCurrentPageId);
    setSelectedPageIds([]);
    lastSelectedPageIdRef.current = null;
    setSelectedItems([]);
    setDragState(null);
    setSnapGuideLines([]);
    setSelectionBox(null);
    setPageSelectionBox(null);
    closeContextMenu();
    closePageMenu();
    closePageInsertMenu();
    setHasUnsavedChanges(options?.markUnsaved ?? false);
  };

  const loadProjectFromFile = async (file: File): Promise<boolean> => {
    let text: string;

    try {
      text = await file.text();
    } catch {
      alert(t("openFileReadFailed"));
      return false;
    }

    let raw: ProjectData;

    try {
      raw = JSON.parse(text) as ProjectData;
    } catch {
      alert(t("jsonParseFailed"));
      return false;
    }

    try {
      restoreProjectData(raw);
      void clearProjectAutoSave();
      return true;
    } catch {
      alert(t("invalidProjectFile"));
      return false;
    }
  };

  const handleLoadProjectClick = async () => {
    if (!confirmDiscardUnsavedChanges()) return;

    closeTopToolbarMenus();

    if (!canUseFileSystemPicker) {
      loadProjectConfirmedRef.current = true;
      hiddenLoadInputRef.current?.click();
      return;
    }

    try {
      const [fileHandle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: t("mangaProjectJson"),
            accept: {
              "application/x-mansa": [".mansa"],
            },
          },
        ],
      });

      let file: File;

      try {
        file = await fileHandle.getFile();
      } catch {
        alert(t("openFileReadFailed"));
        return;
      }

      const loaded = await loadProjectFromFile(file);
      if (!loaded) return;

      projectFileHandleRef.current = fileHandle;
      setProjectFileName(fileHandle.name);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      alert(t(isPermissionError(error) ? "openPermissionDenied" : "openFilePickerFailed"));
    }
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      loadProjectConfirmedRef.current = false;
      return;
    }

    if (!loadProjectConfirmedRef.current && !confirmDiscardUnsavedChanges()) {
      e.target.value = "";
      return;
    }

    loadProjectConfirmedRef.current = false;
    closeTopToolbarMenus();

    void (async () => {
      const loaded = await loadProjectFromFile(file);

      if (loaded) {
        projectFileHandleRef.current = null;
        setProjectFileName(file.name);
      }

      e.target.value = "";
    })();
  };

  const renderPageCanvas = (
    page: Page,
    exportMode: boolean,
    refCallback?: (el: HTMLDivElement | null) => void
  ) => {
    if (
      !exportMode &&
      isDragCopyPreviewVisible &&
      dragState &&
      (dragState.kind === "multi-move" ||
        dragState.kind === "bubble-move" ||
        dragState.kind === "sound-move") &&
      dragState.copyGhost
    ) {
      let ghostSeq = 0;
      const nextGhostId = () => DRAG_COPY_GHOST_ID_BASE - ghostSeq++;

      page = {
        ...page,
        frames: [
          ...page.frames,
          ...dragState.copyGhost.frames.map((frame) => ({
            ...structuredClone(frame),
            id: nextGhostId(),
          })),
        ],
        bubbles: [
          ...page.bubbles,
          ...dragState.copyGhost.bubbles.map((bubble) => ({
            ...structuredClone(bubble),
            id: nextGhostId(),
          })),
        ],
        sounds: [
          ...page.sounds,
          ...dragState.copyGhost.sounds.map((sound) => ({
            ...structuredClone(sound),
            id: nextGhostId(),
          })),
        ],
      };
    }

    const sortedBubbles = [...page.bubbles]
      .map((bubble, index) => normalizeBubbleWithColorFields(bubble, index))
      .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
    const bubbleLayerStep = Math.max(1, sortedBubbles.length + 1);
    const bubbleLayerIndexMap = new Map(
      sortedBubbles.map((bubble, index) => [bubble.id, index])
    );
    const getBubblePartZIndex = (partOrder: number, bubble: Bubble) =>
      partOrder * bubbleLayerStep + (bubbleLayerIndexMap.get(bubble.id) ?? 0);

    const editableFrameLayerIds = page.frames
      .filter((frame) => !isProtectedCoverBaseFrame(page, frame))
      .map((frame) => frame.id);
    const editableFrameLayerIndexMap = new Map(
      editableFrameLayerIds.map((id, index) => [id, index])
    );
    const isMultiFrameSelection = !exportMode && selectedFrameIds.length > 1;
    const frameHandleDragFrameId =
      !exportMode &&
      (dragState?.kind === "frame-resize" || dragState?.kind === "frame-tilt") &&
      selectedFrameIds.includes(dragState.id)
        ? dragState.id
        : null;
    const activeSelectedFrameId =
      isMultiFrameSelection && frameHandleDragFrameId != null
        ? frameHandleDragFrameId
        : isMultiFrameSelection &&
          primarySelectedItem?.kind === "frame" &&
          selectedFrameIds.includes(primarySelectedItem.id)
        ? primarySelectedItem.id
        : isMultiFrameSelection
        ? selectedFrameIds[selectedFrameIds.length - 1] ?? null
        : null;

    const getFrameBaseZIndex = (frame: Frame) => {
      if (isProtectedCoverBaseFrame(page, frame)) return 0;

      return (editableFrameLayerIndexMap.get(frame.id) ?? 0) + 1;
    };

    const imagePositionDimTargetFrameId =
      !exportMode &&
      draggingFrameImage == null &&
      selectedFrameImageCardId != null &&
      openEditorSectionKey === "frame-image-move-copy" &&
      page.frames.some((frame) => frame.id === selectedFrameImageCardId && hasFrameImage(frame))
        ? selectedFrameImageCardId
        : null;
    const effectLineDimTargetFrameId =
      !exportMode &&
      draggingFrameImage == null &&
      openEditorSectionKey === "frame-effect-line" &&
      selectedFrameIds.length === 1 &&
      page.frames.some((frame) => frame.id === selectedFrameIds[0])
        ? selectedFrameIds[0]
        : null;
    const editorDimTargetFrameId =
      imagePositionDimTargetFrameId ?? effectLineDimTargetFrameId;
    const editorDimTargetFrame =
      editorDimTargetFrameId == null
        ? null
        : page.frames.find((frame) => frame.id === editorDimTargetFrameId) ?? null;
    const getFrameImagePositionDimPointString = (frame: Frame) => {
      const pointString = frame.borderEnabled
        ? getFrameInnerPolygonPointString(frame)
        : getFramePolygonPointString(frame);

      return pointString
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const [localXText, localYText] = pair.split(",");
          const localX = Number(localXText);
          const localY = Number(localYText);

          return `${frame.x + (localX / 100) * frame.w},${
            frame.y + (localY / 100) * frame.h
          }`;
        })
        .join(" ");
    };

    const imagePositionDimTargetPointString = editorDimTargetFrame
      ? getFrameImagePositionDimPointString(editorDimTargetFrame)
      : null;

    const FRAME_EDITOR_FRONT_Z_INDEX = 30000;

    const getFrameDisplayZIndex = (frame: Frame) => {
      if (isProtectedCoverBaseFrame(page, frame)) return 0;

      if (
        imagePositionDimTargetFrameId === frame.id ||
        effectLineDimTargetFrameId === frame.id
      ) {
        return FRAME_EDITOR_FRONT_Z_INDEX;
      }

      if (isMultiFrameSelection && activeSelectedFrameId === frame.id) {
        return editableFrameLayerIds.length + 1;
      }

      return getFrameBaseZIndex(frame);
    };

    const frameNeedsBorderOverlay = (_frame: Frame) => {
      return false;
    };

    const renderFrameVisualLayer = ({
      frame,
      exportMode,
      isFrameSelected,
      ignoreFrameContentInset = false,
    }: {
      frame: Frame;
      exportMode: boolean;
      isFrameSelected: boolean;
      ignoreFrameContentInset?: boolean;
    }) => {
      const frameStrokePoints = getFrameInnerPolygonPointString(frame);
      const frameStrokeClipPath = getFrameInnerClipPath(frame);
      const frameContentClipPath = frame.borderEnabled
        ? getFrameInnerClipPath(frame)
        : getFrameClipPath(frame);
      const baseMetrics = getFrameImageMetrics(frame);

      const imageMetrics = ignoreFrameContentInset
        ? (() => {
            const fullMetrics = getFrameImageMetrics({
              ...frame,
              borderEnabled: false,
            });

            return {
              ...fullMetrics,
              renderedImageW: baseMetrics.renderedImageW,
              renderedImageH: baseMetrics.renderedImageH,
              imageLeft: baseMetrics.imageLeft,
              imageTop: baseMetrics.imageTop,
            };
          })()
        : baseMetrics;
      const {
        renderedImageW,
        renderedImageH,
        imageAreaLeftPercent,
        imageAreaTopPercent,
        imageAreaWidthPercent,
        imageAreaHeightPercent,
      } = imageMetrics;

      const frameImageSrc = getFrameImageSrc(frame);

      const isFrameImageDragOverTarget =
        !exportMode &&
        draggingFrameImage != null &&
        dragOverFrameImageTargetId === frame.id;

      return (
        <>
          <div
            style={{
              position: "absolute",
              left:
                frame.borderEnabled && !ignoreFrameContentInset
                  ? `${imageAreaLeftPercent}%`
                  : 0,
              top:
                frame.borderEnabled && !ignoreFrameContentInset
                  ? `${imageAreaTopPercent}%`
                  : 0,
              width:
                frame.borderEnabled && !ignoreFrameContentInset
                  ? `${imageAreaWidthPercent}%`
                  : "100%",
              height:
                frame.borderEnabled && !ignoreFrameContentInset
                  ? `${imageAreaHeightPercent}%`
                  : "100%",
              overflow: "hidden",
              clipPath: frameContentClipPath,
              WebkitClipPath: frameContentClipPath,
              background:
                !frameImageSrc && isFrameImageDragOverTarget
                  ? "#dbeafe"
                  : frameImageSrc
                  ? "transparent"
                  : "#e5e7eb",
              pointerEvents: "none",
            }}
          >
            {frameImageSrc && (
              <img
                src={frameImageSrc}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: `${imageMetrics.imageLeft}px`,
                  top: `${imageMetrics.imageTop}px`,
                  width: `${renderedImageW}px`,
                  height: `${renderedImageH}px`,
                  cursor: exportMode ? "default" : "grab",
                  userSelect: "none",
                  pointerEvents: "none",
                  transform: `scale(${hasFrameImageFlipX(frame) ? -1 : 1}, ${hasFrameImageFlipY(frame) ? -1 : 1})`,
                  transformOrigin: "center center",
                }}
              />
            )}
          </div>

          <FrameEffectLineLayer frame={frame} />

          {isFrameImageDragOverTarget && (
            <div
              style={{
                position: "absolute",
                left:
                  frame.borderEnabled && !ignoreFrameContentInset
                    ? `${imageAreaLeftPercent}%`
                    : 0,
                top:
                  frame.borderEnabled && !ignoreFrameContentInset
                    ? `${imageAreaTopPercent}%`
                    : 0,
                width:
                  frame.borderEnabled && !ignoreFrameContentInset
                    ? `${imageAreaWidthPercent}%`
                    : "100%",
                height:
                  frame.borderEnabled && !ignoreFrameContentInset
                    ? `${imageAreaHeightPercent}%`
                    : "100%",
                overflow: "hidden",
                clipPath: frameContentClipPath,
                WebkitClipPath: frameContentClipPath,
                background: "rgba(37, 99, 235, 0.26)",
                boxShadow: "inset 0 0 0 2px rgba(37, 99, 235, 0.85)",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
          )}

          <div
            style={{
              position: "absolute",
              inset: 0,
              clipPath: frameStrokeClipPath,
              WebkitClipPath: frameStrokeClipPath,
              pointerEvents: "none",
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "visible",
              }}
            >
              {shouldDrawFrameBorder(frame) && (
                <polygon
                  points={frameStrokePoints}
                  fill="none"
                  stroke="#111"
                  strokeWidth={0.2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              )}

              {!exportMode && isFrameSelected && (() => {
                const isImagePositionFrame =
                  trimmingFrameId === frame.id ||
                  (selectedFrameImageCardId === frame.id &&
                    openEditorSectionKey === "frame-image-move-copy");
                const isImagePositionFrameTransformDragging =
                  isImagePositionFrame &&
                  ((dragState?.kind === "frame-resize" && dragState.id === frame.id) ||
                    (dragState?.kind === "frame-tilt" && dragState.id === frame.id));

                if (isImagePositionFrameTransformDragging) {
                  return null;
                }

                const selectionStrokeWidth = isImagePositionFrame ? 3 : 0.7;
                const selectionStrokeDasharray = isImagePositionFrame
                  ? undefined
                  : isProtectedCoverBaseFrame(page, frame)
                  ? undefined
                  : "3 2";

                return (
                  <>
                    {!isImagePositionFrame && (
                      <>
                        <polygon
                          points={frameStrokePoints}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={selectionStrokeWidth + 4}
                          vectorEffect="non-scaling-stroke"
                          strokeLinejoin="round"
                          strokeDasharray={selectionStrokeDasharray}
                          opacity={0.1}
                        />
                        <polygon
                          points={frameStrokePoints}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={selectionStrokeWidth + 2}
                          vectorEffect="non-scaling-stroke"
                          strokeLinejoin="round"
                          strokeDasharray={selectionStrokeDasharray}
                          opacity={0.16}
                        />
                      </>
                    )}

                    <polygon
                      points={frameStrokePoints}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth={selectionStrokeWidth}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      strokeDasharray={selectionStrokeDasharray}
                    />
                  </>
                );
              })()}
            </svg>


          </div>
        </>
      );
    };

    const getCanvasMousePoint = (e: React.MouseEvent): PercentPoint | null => {
      const rect = getPageRect();
      if (!rect) return null;

      return {
        x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
        y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
      };
    };

    const findTopFrameAtMouse = (e: React.MouseEvent): Frame | null => {
      const point = getCanvasMousePoint(e);
      if (!point) return null;

      return (
        [...getEditableFrames(page.frames)]
          .reverse()
          .find((frame) => isPointInFramePolygon(point, frame)) ?? null
      );
    };

    const renderBubbleLayer = (
      page: Page,
      bubble: Bubble,
      zIndex: number,
      content: React.ReactNode,
      options?: {
        pointerEvents?: React.CSSProperties["pointerEvents"];
        overflow?: "visible" | "hidden";
        opacity?: number;
      }
    ) => {
      const bubbleWithClip = bubble as Bubble & { clipToFrame?: boolean };

      const centerFrame = getBubbleCenterFrame(page, bubble);
      const clipFrame =
        centerFrame && !isInnerLockedFrame(centerFrame) ? centerFrame : null;

      const shouldClip =
        !!bubbleWithClip.clipToFrame &&
        !!clipFrame &&
        clipFrame.borderEnabled;

      if (!shouldClip || !clipFrame) {
        return (
          <div
            key={`bubble-layer-${zIndex}-${bubble.id}`}
            data-canvas-focus-object="true"
            data-canvas-object-type="bubble"
            data-canvas-object-id={String(bubble.id)}
            data-canvas-object-x={String(bubble.x)}
            data-canvas-object-y={String(bubble.y)}
            tabIndex={-1}
            style={{
              position: "absolute",
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              width: `${bubble.w}%`,
              height: `${bubble.h}%`,
              overflow: options?.overflow ?? "visible",
              pointerEvents: options?.pointerEvents ?? "none",
              zIndex: draggingFrameImage != null ? 0 : zIndex,
              opacity: options?.opacity ?? (isDragCopyGhostId(bubble.id) ? 0.38 : 1),
              background: "transparent",
            }}
          >
            {content}
          </div>
        );
      }

      const frameClipPath = getBubbleFrameClipPath(clipFrame);

      return (
        <div
          key={`bubble-layer-${zIndex}-${bubble.id}`}
          style={{
            position: "absolute",
            left: `${clipFrame.x}%`,
            top: `${clipFrame.y}%`,
            width: `${clipFrame.w}%`,
            height: `${clipFrame.h}%`,
            overflow: "hidden",
            clipPath: frameClipPath,
            WebkitClipPath: frameClipPath,
            pointerEvents: "none",
            zIndex: draggingFrameImage != null ? 0 : zIndex,
            opacity: options?.opacity ?? (isDragCopyGhostId(bubble.id) ? 0.38 : 1),
          }}
        >
          <div
            data-canvas-focus-object="true"
            data-canvas-object-type="bubble"
            data-canvas-object-id={String(bubble.id)}
            data-canvas-object-x={String(bubble.x)}
            data-canvas-object-y={String(bubble.y)}
            tabIndex={-1}
            style={{
              position: "absolute",
              left: `${((bubble.x - clipFrame.x) / clipFrame.w) * 100}%`,
              top: `${((bubble.y - clipFrame.y) / clipFrame.h) * 100}%`,
              width: `${(bubble.w / clipFrame.w) * 100}%`,
              height: `${(bubble.h / clipFrame.h) * 100}%`,
              overflow: options?.overflow ?? "visible",
              pointerEvents: options?.pointerEvents ?? "none",
            }}
          >
            {content}
          </div>
        </div>
      );
    };

    const getBubbleVisibleTextOffset = (bubble: Bubble) => {
      const bubbleWithClip = bubble as Bubble & { clipToFrame?: boolean };
      if (!bubbleWithClip.clipToFrame) return { x: 0, y: 0 };

      const centerFrame = getBubbleCenterFrame(page, bubble);
      const clipFrame =
        centerFrame && !isInnerLockedFrame(centerFrame) ? centerFrame : null;

      if (!clipFrame || !clipFrame.borderEnabled) return { x: 0, y: 0 };
      if (!isBubbleOverflowingFramePolygon(bubble, clipFrame)) return { x: 0, y: 0 };

      const bubbleLeft = bubble.x;
      const bubbleTop = bubble.y;
      const bubbleRight = bubble.x + bubble.w;
      const bubbleBottom = bubble.y + bubble.h;

      const frameLeft = clipFrame.x;
      const frameTop = clipFrame.y;
      const frameRight = clipFrame.x + clipFrame.w;
      const frameBottom = clipFrame.y + clipFrame.h;

      const visibleLeft = Math.max(bubbleLeft, frameLeft);
      const visibleTop = Math.max(bubbleTop, frameTop);
      const visibleRight = Math.min(bubbleRight, frameRight);
      const visibleBottom = Math.min(bubbleBottom, frameBottom);

      if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) {
        return { x: 0, y: 0 };
      }

      const bubbleCenterX = (bubbleLeft + bubbleRight) / 2;
      const bubbleCenterY = (bubbleTop + bubbleBottom) / 2;
      const visibleCenterX = (visibleLeft + visibleRight) / 2;
      const visibleCenterY = (visibleTop + visibleBottom) / 2;

      return {
        x: ((visibleCenterX - bubbleCenterX) / 100) * PAGE_WIDTH,
        y: ((visibleCenterY - bubbleCenterY) / 100) * PAGE_HEIGHT,
      };
    };

    const renderBubbleBackgroundPatch = (
      bubble: Bubble,
      patchPathD: string,
      keySuffix: string
    ) => {
      bubble = getBubbleForPresetBackgroundRendering(bubble);
      const safeW = Math.max(bubble.w, 0.000001);
      const safeH = Math.max(bubble.h, 0.000001);
      const maskId = `bubble-bg-patch-mask-${page.id}-${bubble.id}-${keySuffix}`;

      const bubblePixelW = (PAGE_WIDTH * safeW) / 100;
      const bubblePixelH = (PAGE_HEIGHT * safeH) / 100;
      const patchMaskMargin = Math.max(PAGE_WIDTH, PAGE_HEIGHT) * 2;
      const patchMaskX = -patchMaskMargin;
      const patchMaskY = -patchMaskMargin;
      const patchMaskWidth = bubblePixelW + patchMaskMargin * 2;
      const patchMaskHeight = bubblePixelH + patchMaskMargin * 2;

      const insideTrianglePath =
        keySuffix === "body" &&
        bubble.tailEnabled &&
        canBubbleUseTail(bubble) &&
        bubble.tailMode === "inside" &&
        (bubble.tailStyle ?? "triangle") === "triangle"
          ? getInsideTriangleTailPath(bubble)
          : null;

      const insideThoughtPath =
        keySuffix === "body" &&
        bubble.tailEnabled &&
        canBubbleUseTail(bubble) &&
        bubble.tailMode === "inside" &&
        (bubble.tailStyle ?? "triangle") === "thought"
          ? getInsideThoughtTailPath(bubble)
          : null;

      return (
        <svg
          viewBox={`0 0 ${bubblePixelW} ${bubblePixelH}`}
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            display: "block",
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={patchMaskX}
              y={patchMaskY}
              width={patchMaskWidth}
              height={patchMaskHeight}
            >
              <rect
                x={patchMaskX}
                y={patchMaskY}
                width={patchMaskWidth}
                height={patchMaskHeight}
                fill="black"
              />

              <path
                d={patchPathD}
                transform={`scale(${bubblePixelW / 100} ${bubblePixelH / 100})`}
                fill="white"
              />

              {keySuffix === "outside-tail-tone-under-stroke" &&
                getOutsideTriangleTailBackSideMaskPath(bubble) && (
                  <path
                    d={getOutsideTriangleTailBackSideMaskPath(bubble) ?? ""}
                    transform={`scale(${bubblePixelW / 100} ${bubblePixelH / 100})`}
                    fill="black"
                  />
                )}

              {insideTrianglePath && (
                <path
                  d={insideTrianglePath}
                  transform={`scale(${bubblePixelW / 100} ${bubblePixelH / 100})`}
                  fill="black"
                />
              )}

              {insideThoughtPath && (
                <path
                  d={insideThoughtPath}
                  transform={`scale(${bubblePixelW / 100} ${bubblePixelH / 100})`}
                  fill="black"
                />
              )}
            </mask>
          </defs>

          <foreignObject
            x={-(PAGE_WIDTH * bubble.x) / 100}
            y={-(PAGE_HEIGHT * bubble.y) / 100}
            width={PAGE_WIDTH}
            height={PAGE_HEIGHT}
            mask={`url(#${maskId})`}
          >
            <div
              style={{
                position: "relative",
                width: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                overflow: "hidden",
                background: "#ffffff",
              }}
            >
              {getEditableFrames(page.frames).map((frame) => (
                <div
                  key={`bubble-bg-patch-${page.id}-${bubble.id}-${keySuffix}-${frame.id}`}
                  style={{
                    position: "absolute",
                    left: `${frame.x}%`,
                    top: `${frame.y}%`,
                    width: `${frame.w}%`,
                    height: `${frame.h}%`,
                    pointerEvents: "none",
                  }}
                >
                  {renderFrameVisualLayer({
                    frame,
                    exportMode: true,
                    isFrameSelected: false,
                    ignoreFrameContentInset: true,
                  })}
                </div>
              ))}

              {shouldDrawBubbleToneDots(bubble) && getBubbleToneDotStyle(bubble) && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    ...getBubbleToneDotStyle(bubble),
                  }}
                />
              )}
            </div>
          </foreignObject>
        </svg>
      );
    };

    const renderBubbleBackgroundOnlyPatch = (
      bubble: Bubble,
      patchPathD: string,
      keySuffix: string
    ) => {
      const safeW = Math.max(bubble.w, 0.000001);
      const safeH = Math.max(bubble.h, 0.000001);
      const maskId = `bubble-bg-only-patch-mask-${page.id}-${bubble.id}-${keySuffix}`;

      const bubblePixelW = (PAGE_WIDTH * safeW) / 100;
      const bubblePixelH = (PAGE_HEIGHT * safeH) / 100;
      const patchMaskMargin = Math.max(PAGE_WIDTH, PAGE_HEIGHT) * 2;
      const patchMaskX = -patchMaskMargin;
      const patchMaskY = -patchMaskMargin;
      const patchMaskWidth = bubblePixelW + patchMaskMargin * 2;
      const patchMaskHeight = bubblePixelH + patchMaskMargin * 2;

      return (
        <svg
          viewBox={`0 0 ${bubblePixelW} ${bubblePixelH}`}
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            display: "block",
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={patchMaskX}
              y={patchMaskY}
              width={patchMaskWidth}
              height={patchMaskHeight}
            >
              <rect
                x={patchMaskX}
                y={patchMaskY}
                width={patchMaskWidth}
                height={patchMaskHeight}
                fill="black"
              />

              <path
                d={patchPathD}
                transform={`scale(${bubblePixelW / 100} ${bubblePixelH / 100})`}
                fill="white"
              />
            </mask>
          </defs>

          <foreignObject
            x={-(PAGE_WIDTH * bubble.x) / 100}
            y={-(PAGE_HEIGHT * bubble.y) / 100}
            width={PAGE_WIDTH}
            height={PAGE_HEIGHT}
            mask={`url(#${maskId})`}
          >
            <div
              style={{
                position: "relative",
                width: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                overflow: "hidden",
                background: "#ffffff",
              }}
            >
              {getEditableFrames(page.frames).map((frame) => (
                <div
                  key={`bubble-bg-only-patch-${page.id}-${bubble.id}-${keySuffix}-${frame.id}`}
                  style={{
                    position: "absolute",
                    left: `${frame.x}%`,
                    top: `${frame.y}%`,
                    width: `${frame.w}%`,
                    height: `${frame.h}%`,
                    pointerEvents: "none",
                  }}
                >
                  {renderFrameVisualLayer({
                    frame,
                    exportMode: true,
                    isFrameSelected: false,
                    ignoreFrameContentInset: true,
                  })}
                </div>
              ))}
            </div>
          </foreignObject>
        </svg>
      );
    };

    const getBubbleCoverPatchPath = (bubble: Bubble) => {
      const insetPt = bubble.shape === "electronic" ? 0 : 0.5;
      const insetPx = insetPt * (96 / 72);

      const insetX = (insetPx / ((PAGE_WIDTH * bubble.w) / 100)) * 100;
      const insetY = (insetPx / ((PAGE_HEIGHT * bubble.h) / 100)) * 100;
      const inset = Math.max(insetX, insetY);

      const bodyPath =
        bubble.shape === "flash"
          ? `
            M 2 50
            A 48 50 0 1 0 98 50
            A 48 50 0 1 0 2 50
            Z
          `
          : bubbleSvgPath(bubble.shape, inset);

      const insideTrianglePath = getInsideTriangleTailPath(bubble);
      const insideThoughtPath = getInsideThoughtTailPatchPath(bubble);

      return `
        ${bodyPath}
        ${insideTrianglePath ?? ""}
        ${insideThoughtPath}
      `;
    };

    const getOutsideTailFillPatchPath = (bubble: Bubble) => {
      const {
        boundary,
        bubblePixelW,
        bubblePixelH,
        unitX,
        unitY,
        perpX,
        perpY,
        baseHalfPx,
        tipX,
        tipY,
      } = getTailGeometry(bubble);

      const overlapPx = TAIL_OVERLAP_PX;

      const rootCenterX =
        boundary.x + ((-unitX * overlapPx) / bubblePixelW) * 100;
      const rootCenterY =
        boundary.y + ((-unitY * overlapPx) / bubblePixelH) * 100;

      const insetPx = 1 * (96 / 72);

      const coverTipX = tipX + ((-unitX * insetPx) / bubblePixelW) * 100;
      const coverTipY = tipY + ((-unitY * insetPx) / bubblePixelH) * 100;

      const coverBaseHalfPx = Math.max(0, baseHalfPx - insetPx);

      const coverLeftX =
        rootCenterX + ((perpX * coverBaseHalfPx) / bubblePixelW) * 100;
      const coverLeftY =
        rootCenterY + ((perpY * coverBaseHalfPx) / bubblePixelH) * 100;

      const coverRightX =
        rootCenterX - ((perpX * coverBaseHalfPx) / bubblePixelW) * 100;
      const coverRightY =
        rootCenterY - ((perpY * coverBaseHalfPx) / bubblePixelH) * 100;

      const tailCurveValue = Number(bubble.tailWidth ?? 50);
      const tailCurveDirection =
        !canBubbleUseTailCurve(bubble) || !Number.isFinite(tailCurveValue)
          ? 0
          : tailCurveValue <= 37
            ? -1
            : tailCurveValue >= 63
              ? 1
              : 0;
      const curveOffsetPx = tailCurveDirection * 16;

      if (curveOffsetPx === 0) {
        return `
          M ${coverLeftX} ${coverLeftY}
          L ${coverTipX} ${coverTipY}
          L ${coverRightX} ${coverRightY}
          Z
        `;
      }

      const curveX = ((perpX * curveOffsetPx) / bubblePixelW) * 100;
      const curveY = ((perpY * curveOffsetPx) / bubblePixelH) * 100;

      const controlLeftX = (coverLeftX + coverTipX) / 2 + curveX;
      const controlLeftY = (coverLeftY + coverTipY) / 2 + curveY;
      const controlRightX = (coverTipX + coverRightX) / 2 + curveX;
      const controlRightY = (coverTipY + coverRightY) / 2 + curveY;

      return `
        M ${coverLeftX} ${coverLeftY}
        Q ${controlLeftX} ${controlLeftY} ${coverTipX} ${coverTipY}
        Q ${controlRightX} ${controlRightY} ${coverRightX} ${coverRightY}
        Z
      `;
    };

    const getOutsideThoughtTailFillPatchPath = (bubble: Bubble) => {
      if (
        !bubble.tailEnabled ||
        bubble.tailMode !== "outside" ||
        (bubble.tailStyle ?? "triangle") !== "thought"
      ) {
        return "";
      }

      const strokeInsetPercent =
        (BUBBLE_STROKE_PX /
          Math.max(1, Math.max((PAGE_WIDTH * bubble.w) / 100, (PAGE_HEIGHT * bubble.h) / 100))) *
        100;

      return getThoughtTailDots(bubble)
        .map((dot) =>
          getThoughtDotPath(dot.cx, dot.cy, Math.max(0.01, dot.r - strokeInsetPercent))
        )
        .join("\n");
    };

    return (
      <div
        ref={refCallback}
        onMouseDown={
          exportMode
            ? undefined
            : (e) => {
                if (e.button !== 0) return;

                const frame = findTopFrameAtMouse(e);

                if (
                  selectedFrameImageCardId != null &&
                  frame?.id === selectedFrameImageCardId &&
                  selectedFrameIds.length === 1 &&
                  selectedFrameIds[0] === selectedFrameImageCardId
                ) {
                  keepFrameImageCardSelectedByCanvasPointerRef.current = true;
                }

                e.currentTarget.focus({ preventScroll: true });
                setActiveTargetType("canvas");
                setSelectedPageIds([]);

                if (trimmingFrameId != null) {
                  if (frame?.id === trimmingFrameId && hasFrameImage(frame)) {
                    startFramePan(e, frame);
                    return;
                  }

                  setSelectedFrameImageCardId(null);
                  imageMoveKeyboardKeyRef.current = null;
                  stopImageMoveRepeat();
                  finishFrameTrimming();

                  if (!frame) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeContextMenu();
                    focusCanvasTrap();
                    return;
                  }
                }

                if (
                  frame &&
                  openEditorSectionKey === "frame-effect-line" &&
                  selectedFrameIds.length === 1 &&
                  selectedFrameIds[0] === frame.id
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  closeContextMenu();
                  activateFrameEffectLineFromEditor(frame.id);
                  window.setTimeout(() => setOpenEditorSectionKey("frame-effect-line"), 0);
                  return;
                }

                if (frame) {
                  startFrameMove(e, frame);
                  return;
                }

                const additive = e.ctrlKey || e.metaKey || e.shiftKey;

                if (!additive) {
                  clearSelection();
                }

                closeContextMenu();
                setPastePointAtMouse(e);
                startSelectionBox(e, additive);
              }
        }

        
        data-page-canvas="true"
        tabIndex={exportMode ? undefined : -1}
        onContextMenu={
          exportMode
            ? undefined
            : (e) => {
                if (
                  openEditorSectionKey === "frame-image-move-copy" &&
                  selectedFrameImageCardId != null
                ) {
                  const frame = page.frames.find(
                    (item) => item.id === selectedFrameImageCardId
                  );
                  const point = getCanvasMousePoint(e);

                  if (frame && point && isPointInFramePolygon(point, frame)) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeContextMenu();
                    return;
                  }
                }

                openContextMenu(e, { kind: "canvas" });
              }
        }
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          position: "relative",
          backgroundColor: "#ffffff",
          border: "1px solid #d0d7de",
          borderRadius: 0,
          boxShadow: exportMode
            ? "none"
            : "0 14px 42px rgba(0,0,0,0.42)",
          overflow: "hidden",
          userSelect: "none",
          boxSizing: "border-box",
        }}
      >
        {getEditableFrames(page.frames).map((frame) => {
          const imageMetrics = getFrameImageMetrics(frame);
          const renderedImageW = imageMetrics.renderedImageW;
          const renderedImageH = imageMetrics.renderedImageH;
          const imageAreaLeftPercent = imageMetrics.imageAreaLeftPercent;
          const imageAreaTopPercent = imageMetrics.imageAreaTopPercent;
          const imageAreaWidthPercent = imageMetrics.imageAreaWidthPercent;
          const imageAreaHeightPercent = imageMetrics.imageAreaHeightPercent;
          const frameImageSrc = getFrameImageSrc(frame);

          const isDragCopyGhostFrame = isDragCopyGhostId(frame.id);

          const isFrameSelected =
            !exportMode &&
            !suppressFrameSelectionOutlineByBorderSwitch &&
            !isDragCopyGhostFrame &&
            selectedFrameIds.includes(frame.id);

          const isFrameImageDragOverTarget =
            !exportMode &&
            draggingFrameImage != null &&
            dragOverFrameImageTargetId === frame.id;

          const frameStrokePoints = getFrameInnerPolygonPointString(frame);

          return (
            <div
              key={frame.id}
              data-canvas-focus-object="true"
              data-canvas-object-type="frame"
              data-canvas-object-id={String(frame.id)}
              data-frame-image-position-keep-id={String(frame.id)}
              data-canvas-object-x={String(frame.x)}
              data-canvas-object-y={String(frame.y)}
              tabIndex={-1}
              onDoubleClick={
                exportMode
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      closeContextMenu();

                      if (frameImageSrc) {
                        focusFrameImageMoveEditor(frame.id);
                        return;
                      }

                      focusFrameImageInsertEditor(frame.id);
                      openImagePickerForFrame(frame.id);
                    }
              }
              onContextMenu={
                exportMode
                  ? undefined
                  : (e) => {
                      if (
                        openEditorSectionKey === "frame-image-move-copy" &&
                        selectedFrameImageCardId === frame.id
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        closeContextMenu();
                        return;
                      }

                      openContextMenu(e, { kind: "frame", id: frame.id });
                    }
              }
              onDragOver={
                exportMode
                  ? undefined
                  : (e) => handleFrameImageDragOver(e, frame.id)
              }
              onDragLeave={
                exportMode
                  ? undefined
                  : handleFrameImageDragLeave
              }
              onDrop={
                exportMode
                  ? undefined
                  : (e) => {
                      void handleDropImage(e, frame.id);
                    }
              }
              onMouseEnter={
                exportMode
                  ? undefined
                  : () => activateSelectedFrameGuide(frame.id)
              }
              onMouseLeave={
                exportMode
                  ? undefined
                  : () => deactivateSelectedFrameGuide(frame.id)
              }
              onWheelCapture={
                exportMode
                  ? undefined
                  : (e) => {
                      if (e.ctrlKey || e.metaKey) return;

                      if (
                        openEditorSectionKey === "frame-effect-line" &&
                        selectedFrameIds.length === 1 &&
                        selectedFrameIds[0] === frame.id &&
                        getFrameEffectLineFields(frame).enabled
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        changeFrameEffectLineInnerBlankByWheel(
                          frame.id,
                          e.deltaY,
                          !e.shiftKey
                        );
                        return;
                      }

                      if (trimmingFrameId !== frame.id || !frameImageSrc) return;

                      e.preventDefault();
                      e.stopPropagation();
                      changeFrameImageScaleByWheel(frame.id, e.deltaY, !e.shiftKey);
                    }
              }
              title={!exportMode && !frameImageSrc ? t("dropImageHere") : undefined}
              style={{
                position: "absolute",
                left: `${frame.x}%`,
                top: `${frame.y}%`,
                width: `${frame.w}%`,
                height: `${frame.h}%`,
                overflow: "visible",
                boxSizing: "border-box",
                background: "transparent",
                zIndex: getFrameDisplayZIndex(frame),
                opacity: isDragCopyGhostFrame ? 0.38 : 1,
                pointerEvents: exportMode || isDragCopyGhostFrame ? "none" : "auto",
                cursor:
                  !exportMode && trimmingFrameId === frame.id && frameImageSrc
                    ? "grab"
                    : undefined,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  clipPath: frame.borderEnabled
                    ? getFrameInnerClipPath(frame)
                    : getFrameClipPath(frame),
                  WebkitClipPath: frame.borderEnabled
                    ? getFrameInnerClipPath(frame)
                    : getFrameClipPath(frame),
                  background:
                !frameImageSrc &&
                !exportMode &&
                draggingFrameImage != null &&
                dragOverFrameImageTargetId === frame.id
                  ? "#dbeafe"
                  : frameImageSrc
                  ? "transparent"
                  : "#e5e7eb",
                  pointerEvents: "none",
                }}
              >
                {frameImageSrc && (
                  <img
                    src={frameImageSrc}
                    alt=""
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: `${imageMetrics.imageLeft}px`,
                      top: `${imageMetrics.imageTop}px`,
                      width: `${renderedImageW}px`,
                      height: `${renderedImageH}px`,
                      cursor: exportMode ? "default" : "grab",
                      userSelect: "none",
                      pointerEvents: "none",
                      transform: `scale(${hasFrameImageFlipX(frame) ? -1 : 1}, ${hasFrameImageFlipY(frame) ? -1 : 1})`,
                      transformOrigin: "center center",
                    }}
                  />
                )}

                <FrameEffectLineLayer frame={frame} />
              </div>

              {!exportMode &&
                isFrameSelected &&
                selectedFrameIds.length === 1 &&
                openEditorSectionKey === "frame-effect-line" &&
                getFrameEffectLineFields(frame).enabled && (() => {
                  const effectLine = getFrameEffectLineFields(frame);
                  const centerHandle = (
                    <div
                      key="effect-line-center"
                      data-effect-line-handle="true"
                      title="効果線の中心"
                      onMouseDown={(e) => startFrameEffectLineHandleDrag(e, frame, "center")}
                      style={{
                        position: "absolute",
                        left: `${effectLine.centerX}%`,
                        top: `${effectLine.centerY}%`,
                        width: 18,
                        height: 18,
                        transform: "translate(-50%, -50%)",
                        borderRadius: "50%",
                        background: "#ffffff",
                        border: "3px solid #2563eb",
                        boxShadow: "0 0 0 3px rgba(37,99,235,0.22)",
                        cursor: "move",
                        pointerEvents: "auto",
                        zIndex: 10000,
                      }}
                    />
                  );

                  const rad = (effectLine.angle * Math.PI) / 180;
                  const angleX = clamp(effectLine.centerX + Math.cos(rad) * 34, 0, 100);
                  const angleY = clamp(effectLine.centerY + Math.sin(rad) * 34, 0, 100);

                  return (
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10000 }}>
                      {centerHandle}
                      {effectLine.kind === "speed" && (
                        <div
                          data-effect-line-handle="true"
                          title="スピード線の角度"
                          onMouseDown={(e) => startFrameEffectLineHandleDrag(e, frame, "angle")}
                          style={{
                            position: "absolute",
                            left: `${angleX}%`,
                            top: `${angleY}%`,
                            width: 20,
                            height: 20,
                            transform: "translate(-50%, -50%)",
                            borderRadius: "50%",
                            background: "#f97316",
                            border: "3px solid #ffffff",
                            boxShadow: "0 0 0 2px #f97316, 0 8px 18px rgba(0,0,0,0.28)",
                            cursor: "grab",
                            pointerEvents: "auto",
                          }}
                        />
                      )}
                    </div>
                  );
                })()}

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  clipPath: getFrameClipPath(frame),
                  WebkitClipPath: getFrameClipPath(frame),
                  pointerEvents: "none",
                }}
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    overflow: "visible",
                  }}
                >
                  {shouldDrawFrameBorder(frame) && (
                    <polygon
                      points={frameStrokePoints}
                      fill="none"
                      stroke="#111"
                      strokeWidth={0.35}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                    />
                  )}

                  {!exportMode && isFrameSelected && (() => {
                    const isImagePositionFrame =
                      trimmingFrameId === frame.id ||
                      (selectedFrameImageCardId === frame.id &&
                        openEditorSectionKey === "frame-image-move-copy");
                    const isImagePositionFrameTransformDragging =
                      isImagePositionFrame &&
                      ((dragState?.kind === "frame-resize" && dragState.id === frame.id) ||
                        (dragState?.kind === "frame-tilt" && dragState.id === frame.id));

                    if (isImagePositionFrameTransformDragging) {
                      return null;
                    }

                    const selectionStrokeWidth = isImagePositionFrame ? 3 : 3;
                    const selectionStrokeDasharray = isImagePositionFrame
                      ? undefined
                      : undefined;

                    return (
                      <>
                        {!isImagePositionFrame && (
                          <>
                            <polygon
                              points={frameStrokePoints}
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth={selectionStrokeWidth + 4}
                              vectorEffect="non-scaling-stroke"
                              strokeLinejoin="round"
                              strokeDasharray={selectionStrokeDasharray}
                              opacity={0.1}
                            />
                            <polygon
                              points={frameStrokePoints}
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth={selectionStrokeWidth + 2}
                              vectorEffect="non-scaling-stroke"
                              strokeLinejoin="round"
                              strokeDasharray={selectionStrokeDasharray}
                              opacity={0.16}
                            />
                          </>
                        )}

                        <polygon
                          points={frameStrokePoints}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={selectionStrokeWidth}
                          vectorEffect="non-scaling-stroke"
                          strokeLinejoin="round"
                          strokeDasharray={selectionStrokeDasharray}
                        />
                      </>
                    );
                  })()}

                </svg>
              </div>

              {isFrameImageDragOverTarget && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    clipPath: getFrameClipPath(frame),
                    WebkitClipPath: getFrameClipPath(frame),
                    background: "rgba(37, 99, 235, 0.28)",
                    boxShadow: "inset 0 0 0 2px rgba(37, 99, 235, 0.9)",
                    pointerEvents: "none",
                    zIndex: 9999,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* 1. 輪郭アリの吹出 */}
        {sortedBubbles.map((bubble) => {
          const visualBubble = getBubbleForPresetBackgroundRendering(bubble);
          const isDragCopyGhostBubble = isDragCopyGhostId(bubble.id);

          const isSelected =
            !isDragCopyGhostBubble &&
            selectedItems.some(
              (item) => item.kind === "bubble" && item.id === bubble.id
            );

          const insideTrianglePath = getInsideTriangleTailPath(bubble);

          const useInsideTrianglePunch =
            !!insideTrianglePath &&
            bubble.tailEnabled &&
            bubble.tailMode === "inside" &&
            (bubble.tailStyle ?? "triangle") === "triangle";
          const isTransparentBubble =
            isBubbleBackgroundTransparent(bubble);
          const outlineMaskId = `bubble-outline-mask-${bubble.id}`;
          const outsideTriangleFillPath =
            isTransparentBubble &&
            bubble.tailEnabled &&
            bubble.tailMode === "outside" &&
            (bubble.tailStyle ?? "triangle") === "triangle" &&
            bubble.shape !== "ellipse"
              ? getOutsideTailFillPatchPath(bubble)
              : null;

          const useOutlineMask = useInsideTrianglePunch || !!outsideTriangleFillPath;

          const outlineStrokePx =
            bubble.shape === "electronic"
              ? ELECTRONIC_OUTER_STROKE_PX
              : BUBBLE_STROKE_PX;



          const outlineMaskInsetX =
            ((outlineStrokePx / 2) / ((PAGE_WIDTH * bubble.w) / 100)) * 100;
          const outlineMaskInsetY =
            ((outlineStrokePx / 2) / ((PAGE_HEIGHT * bubble.h) / 100)) * 100;
          const outlineMaskInset = Math.max(outlineMaskInsetX, outlineMaskInsetY);

          const tailHandle = getTailHandlePosition(bubble);

          return renderBubbleLayer(
            page,
            bubble,
            getBubblePartZIndex(10, bubble),
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  display: "block",
                  overflow: "visible",
                  cursor: exportMode ? "default" : "move",
                  filter: isSelected
                    ? "drop-shadow(0 0 0.5px #2563eb) drop-shadow(0 0 2px #2563eb)"
                    : "none",
                  pointerEvents: exportMode || isDragCopyGhostBubble ? "none" : "auto",
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  focusBubbleTextEditor(bubble.id);
                }}
                onMouseDown={exportMode ? undefined : (e) => startBubbleMove(e, bubble)}
                onContextMenu={
                  exportMode
                    ? undefined
                    : (e) => openContextMenu(e, { kind: "bubble", id: bubble.id })
                }
              >
                {bubble.shape === "flash" ? (
                  <FlashBubbleSvg bubble={visualBubble} />
                ) : (
                  <>
                  {useOutlineMask && (
                    <defs>
                    <mask
                      id={outlineMaskId}
                      maskUnits="userSpaceOnUse"
                      x="-20"
                      y="-20"
                      width="140"
                      height="140"
                    >
                      <rect x="-20" y="-20" width="140" height="140" fill="white" />

                        {useInsideTrianglePunch && insideTrianglePath && (
                          <>
                            <path
                              d={bubbleSvgPath(bubble.shape, -outlineMaskInset)}
                              fill="white"
                            />
                            <path d={insideTrianglePath} fill="black" />
                          </>
                        )}
                        {outsideTriangleFillPath && (
                          <path d={outsideTriangleFillPath} fill="black" />
                        )}
                      </mask>
                    </defs>
                  )}

                    <path
                      d={
                        bubble.shape === "electronic"
                          ? electronicBubbleStrokePath(0)
                          : bubbleSvgPath(bubble.shape, 0)
                      }
                      fill={getBubbleBackgroundFillForSvg(visualBubble)}
                      stroke={getBubbleOutlineStrokeColorForSvg(visualBubble)}
                      strokeWidth={
                        getBubbleOutlineStrokeWidthForSvg(
                          visualBubble,
                          isTransparentBubble && bubble.shape !== "electronic"
                            ? outlineStrokePx * 3
                            : outlineStrokePx
                        )
                      }
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      strokeLinecap={bubble.shape === "electronic" ? "butt" : "round"}
                      mask={useOutlineMask ? `url(#${outlineMaskId})` : undefined}
                    />
                  </>
                )}
              </svg>

              {!exportMode && isSelected && (
                <>
                  {canBubbleUseTail(bubble) && (
                    <div
                      onContextMenu={suppressHandleContextMenu}
                      onMouseDown={(e) => startBubbleTail(e, bubble)}
                      style={{
                        position: "absolute",
                        left: `calc(${tailHandle.x}% - 6px)`,
                        top: `calc(${tailHandle.y}% - 6px)`,
                        width: 12,
                        height: 12,
                        background: "#2563eb",
                        borderRadius: "50%",
                        border: "2px solid #fff",
                        boxSizing: "border-box",
                        cursor: "crosshair",
                        pointerEvents: "auto",
                      }}
                    />
                  )}
                </>
              )}
            </>,
            { pointerEvents: "auto", overflow: "visible" }
          );
        })}

        {/* 3. 外用しっぽ */}
        {sortedBubbles.map((bubble) => {
          const visualBubble = getBubbleForPresetBackgroundRendering(bubble);

          return bubble.tailEnabled && canBubbleUseTail(bubble) && bubble.tailMode === "outside"
            ? renderBubbleLayer(
                page,
                bubble,
                getBubblePartZIndex(30, bubble),
                <>
                  {(bubble.tailStyle ?? "triangle") === "triangle" &&
                    isBubbleBackgroundTransparent(bubble) &&
                    renderBubbleBackgroundPatch(
                      bubble,
                      getOutsideTriangleTailPath(bubble) ?? "",
                      "outside-tail-tone-under-stroke"
                    )}

                  {(bubble.tailStyle ?? "triangle") === "triangle" && (
                    <OutsideTriangleTailSvg bubble={visualBubble} />
                  )}

                  {(bubble.tailStyle ?? "triangle") === "thought" && (
                    <OutsideThoughtTailSvg bubble={visualBubble} />
                  )}
                </>,
                { pointerEvents: "none", overflow: "visible" }
              )
            : null;
        })}

        {/* 4. 外用しっぽの内側に載せる塗り／透明時は背景＋ドット */}
        {sortedBubbles.map((bubble) => {
          const visualBubble = getBubbleForPresetBackgroundRendering(bubble);

          return bubble.tailEnabled &&
          canBubbleUseTail(bubble) &&
          bubble.tailMode === "outside"
            ? renderBubbleLayer(
                page,
                bubble,
                getBubblePartZIndex(40, bubble),
                (bubble.tailStyle ?? "triangle") === "triangle" ? (
                  isBubbleBackgroundTransparent(bubble) ? null : (
                    <OutsideTailFillSvg bubble={visualBubble} />
                  )
                ) : (bubble.tailStyle ?? "triangle") === "thought" &&
                  isBubbleBackgroundTransparent(bubble) ? (
                  renderBubbleBackgroundPatch(
                    bubble,
                    getOutsideThoughtTailFillPatchPath(bubble),
                    "outside-thought-tail-fill"
                  )
                ) : null,
                { pointerEvents: "none", overflow: "visible" }
              )
            : null;
        })}

        {/* 5. 吹出に載せる背景塗り */}
        {sortedBubbles.map((bubble) => {
          const visualBubble = getBubbleForPresetBackgroundRendering(bubble);

          return renderBubbleLayer(
            page,
            bubble,
            getBubblePartZIndex(50, bubble),
            isBubbleBackgroundTransparent(bubble) ? (
              renderBubbleBackgroundPatch(
                bubble,
                getBubbleCoverPatchPath(bubble),
                "body"
              )
            ) : (
              <BubbleCoverSvg bubble={visualBubble} />
            ),
            { pointerEvents: "none", overflow: "visible" }
          );
        })}

        {/* 5.5 電子音の黒い線（本体塗りの上に載せる） */}
        {sortedBubbles.map((bubble) => {
          const visualBubble = getBubbleForPresetBackgroundRendering(bubble);

          return bubble.shape === "electronic"
            ? renderBubbleLayer(
                page,
                bubble,
                getBubblePartZIndex(55, bubble),
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                    overflow: "visible",
                    pointerEvents: "none",
                  }}
                >
                  <ElectronicInnerLayer bubble={visualBubble} />
                </svg>,
                { pointerEvents: "none", overflow: "visible" }
              )
            : null;
        })}

        {/* 6. 内用しっぽ */}
        {sortedBubbles.map((bubble) => {
          const visualBubble = getBubbleForPresetBackgroundRendering(bubble);

          return bubble.tailEnabled && canBubbleUseTail(bubble) && bubble.tailMode === "inside"
            ? renderBubbleLayer(
                page,
                bubble,
                getBubblePartZIndex(60, bubble),
                <>
                  {(bubble.tailStyle ?? "triangle") === "triangle" && (
                    <InsideTriangleTailSvg bubble={visualBubble} />
                  )}

                    {(bubble.tailStyle ?? "triangle") === "thought" && (
                      <>
                        {renderBubbleBackgroundOnlyPatch(
                          bubble,
                          getInsideThoughtTailPatchPath(bubble),
                          "inside-thought-tail-fill"
                        )}

                        <InsideThoughtTailSvg bubble={visualBubble} />
                      </>
                    )}
                </>,
                { pointerEvents: "none", overflow: "visible" }
              )
            : null;
        })}

        {/* 7. セリフ */}
        {sortedBubbles.map((bubble) => {
          const isSelected = selectedItems.some(
            (item) => item.kind === "bubble" && item.id === bubble.id
          );
          const tailHandle = getTailHandlePosition(bubble);
          const visibleTextOffset = getBubbleVisibleTextOffset(bubble);

          return renderBubbleLayer(
            page,
            bubble,
            getBubblePartZIndex(70, bubble),
            <>
              <div
                translate="no"
                className="notranslate"
                style={{
                  position: "absolute",
                  left: 6,
                  top: 6,
                  right: 6,
                  bottom: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "visible",
                  pointerEvents: "none",
                  boxSizing: "border-box",
                  transform: `translate(${visibleTextOffset.x}px, ${visibleTextOffset.y}px)`,
                }}
              >
                <div
                  style={{
                    writingMode:
                      (bubble.writingMode ?? "vertical") === "horizontal"
                        ? "horizontal-tb"
                        : "vertical-rl",
                    textOrientation: "mixed",
                    letterSpacing:
                      (bubble.writingMode ?? "vertical") === "horizontal"
                        ? "0px"
                        : "1px",
                    whiteSpace: "pre-wrap",
                    textAlign: "start",
                    fontSize: `${bubble.fontSize}px`,
                    fontFamily:
                      !exportMode &&
                      previewFontFamily?.targetKind === "bubble" &&
                      previewFontFamily.targetId === bubble.id
                        ? previewFontFamily.fontFamily.trim() || undefined
                        : bubble.fontFamily?.trim() || undefined,
                    lineHeight: 1.25,
                    wordBreak: "break-all",
                    display: "block",
                    maxHeight: "100%",
                    maxWidth: "100%",
                    position: "relative",
                  }}
                >
                  {(() => {
                    const isBubbleTextEmpty = !exportMode && (bubble.text ?? "").length === 0;
                    const renderBubbleTextNode = (
                      rubyTextStyle?: React.CSSProperties,
                      rubyBaseTextStyle?: React.CSSProperties
                    ) =>
                      isBubbleTextEmpty
                        ? t("bubbleTextPlaceholder")
                        : renderTextWithRubies(
                            bubble.text,
                            bubble.rubies,
                            rubyTextStyle,
                            rubyBaseTextStyle
                          );
                    const baseTextStyle = isBubbleTextEmpty
                      ? getBubblePlaceholderTextStyle()
                      : getBubbleTextFillStyle(bubble);
                    const outlineStyle = isBubbleTextEmpty
                      ? {
                          color: "transparent",
                          WebkitTextStroke: "2px #ffffff",
                          paintOrder: "stroke",
                          textShadow: "none",
                        }
                      : getBubbleTextOutlineStyle(bubble);

                    const bubbleTextPaint = isBubbleTextEmpty
                      ? null
                      : getBubbleTextPaintStyle(bubble);

                    const rubyFillStyle: React.CSSProperties | undefined =
                      bubbleTextPaint && (bubble.rubies?.length ?? 0) > 0
                        ? {
                            color: bubbleTextPaint.fillColor,
                            WebkitTextStroke: "0 transparent",
                            paintOrder: "fill",
                            textShadow: "none",
                          }
                        : undefined;

                    const rubyHiddenBaseStyle: React.CSSProperties = {
                      color: "transparent",
                      WebkitTextStroke: "0 transparent",
                      textShadow: "none",
                    };

                    return (
                      <>
                        <span
                          aria-hidden="true"
                          style={{
                            ...baseTextStyle,
                            ...outlineStyle,
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                          }}
                        >
                          {renderBubbleTextNode()}
                        </span>
                        <span style={{ ...baseTextStyle, position: "relative" }}>
                          {renderBubbleTextNode()}
                        </span>
                        {rubyFillStyle && (
                          <span
                            aria-hidden="true"
                            style={{
                              ...baseTextStyle,
                              ...rubyHiddenBaseStyle,
                              position: "absolute",
                              inset: 0,
                              pointerEvents: "none",
                            }}
                          >
                            {renderBubbleTextNode(rubyFillStyle, rubyHiddenBaseStyle)}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {!exportMode &&
                isSelected &&
                !isMultiSelected &&
                canBubbleUseTail(bubble) && (
                <div
                  onContextMenu={suppressHandleContextMenu}
                  onMouseDown={(e) => startBubbleTail(e, bubble)}
                  style={{
                    position: "absolute",
                    left: `${tailHandle.x}%`,
                    top: `${tailHandle.y}%`,
                    width: 14,
                    height: 14,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: bubble.tailEnabled
                      ? "#3b82f6"
                      : "rgba(59, 130, 246, 0.45)",
                    border: "2px solid #fff",
                    boxShadow: bubble.tailEnabled
                      ? "0 0 0 1px #3b82f6"
                      : "0 0 0 1px rgba(59, 130, 246, 0.45)",
                    cursor: "crosshair",
                    pointerEvents: "auto",
                    zIndex: 21,
                  }}
                />
              )}
            </>,
            { pointerEvents: "none", overflow: "visible" }
          );
        })}

        {page.frames.map((frame) => {
          const isFrameSelected =
            !exportMode &&
            !suppressFrameSelectionOutlineByBorderSwitch &&
            selectedFrameIds.includes(frame.id);
          const isFrameImagePositionSelected =
            !exportMode &&
            selectedFrameImageCardId === frame.id &&
            openEditorSectionKey === "frame-image-move-copy";
          const isProtectedCoverBase = isProtectedCoverBaseFrame(page, frame);
          const isFrameImagePositionEditing =
            !exportMode &&
            (trimmingFrameId === frame.id || isFrameImagePositionSelected) &&
            hasFrameImage(frame);
          const isFrameTransformDragging =
            (dragState?.kind === "frame-resize" && dragState.id === frame.id) ||
            (dragState?.kind === "frame-tilt" && dragState.id === frame.id);
          const shouldHideImagePositionFrameSelection =
            isFrameImagePositionEditing && isFrameTransformDragging;

          const frameStrokePoints = getFrameInnerPolygonPointString(frame);

          return (
            <svg
              key={`frame-outline-front-${frame.id}`}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                left: `${frame.x}%`,
                top: `${frame.y}%`,
                width: `${frame.w}%`,
                height: `${frame.h}%`,
                overflow: "visible",
                pointerEvents: "none",
                zIndex: isFrameSelected || isFrameImagePositionSelected
                  ? 5000
                  : getFrameDisplayZIndex(frame),
              }}
            >
              <polygon
                points={frameStrokePoints}
                fill="none"
                stroke={shouldDrawFrameBorder(frame) ? "#111" : "transparent"}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="miter"
              />

              {!shouldHideImagePositionFrameSelection &&
                !exportMode &&
                (isFrameSelected || isFrameImagePositionSelected) && (
                  <>
                    <polygon
                      points={frameStrokePoints}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth={3}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="miter"
                    />
                  </>
                )}
            </svg>
          );
        })}

        {selectionBox && !exportMode && (
          <div
            style={{
              position: "absolute",
              left: `${Math.min(selectionBox.startX, selectionBox.currentX)}%`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY)}%`,
              width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}%`,
              height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}%`,
              border: "1px dashed #2563eb",
              background: "rgba(37, 99, 235, 0.12)",
              boxSizing: "border-box",
              pointerEvents: "none",
              zIndex: 999999,
            }}
          />
        )}

        {page.sounds
          .map((sound, index) => normalizeSound(sound, index))
          .sort((a, b) => a.layer - b.layer)
          .map((sound) => {
            const isDragCopyGhostSound = isDragCopyGhostId(sound.id);

            const isSelected =
              !isDragCopyGhostSound &&
              selectedItems.some(
                (item) => item.kind === "sound" && item.id === sound.id
              );

            return renderSoundLayer(
              page,
              sound,
              (() => {
                const isSoundTextEmpty = !exportMode && (sound.text ?? "").length === 0;
                const soundPlaceholderStyle = getSoundPlaceholderTextStyle();
                const displaySound = isSoundTextEmpty
                  ? {
                      ...sound,
                      text: t("soundTextPlaceholder"),
                      color: soundPlaceholderStyle.color,
                      outlineColor: soundPlaceholderStyle.outlineColor,
                      outlineWidth: soundPlaceholderStyle.outlineWidth,
                    }
                  : sound;
                const box = getSoundTextBoxMetrics(displaySound);
                const polygonPoints = getSoundPolygonPoints(displaySound, box.width, box.height);
                const selectionPath = getSoundSelectionPath(displaySound, box.width, box.height);
                const [tl, tr, br, bl] = polygonPoints;
                const glyphs = getSoundGlyphLayouts(displaySound, box.width, box.height);
                const tiltHandles = [
                  { edge: "top" as const, point: getPointOnLine(tl, tr, 0.25) },
                  { edge: "right" as const, point: getPointOnLine(tr, br, 0.25) },
                  { edge: "bottom" as const, point: getPointOnLine(bl, br, 0.75) },
                  { edge: "left" as const, point: getPointOnLine(tl, bl, 0.75) },
                ];
                const curveYHandle = getPointOnLine(bl, br, 0.5);
                const curveXHandle = getPointOnLine(tr, br, 0.5);

                return (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: box.width,
                      height: box.height,
                      transform: `translate(-50%, -50%) rotate(${sound.rotate}deg)`,
                      transformOrigin: "center center",
                      cursor: exportMode ? "default" : "move",
                      userSelect: "none",
                      opacity: isDragCopyGhostSound ? 0.38 : 1,
                      pointerEvents: exportMode || isDragCopyGhostSound ? "none" : "none",
                    }}
                  >
                    <svg
                      viewBox={`0 0 ${box.width} ${box.height}`}
                      preserveAspectRatio="none"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                        pointerEvents: exportMode ? "none" : "auto",
                      }}
                    >
                      {!exportMode && !isDragCopyGhostSound && (
                        <path
                          d={selectionPath}
                          fill="transparent"
                          stroke="transparent"
                          strokeWidth={18}
                          pointerEvents="all"
                          onMouseDown={(e) => startSoundMove(e, sound)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            focusSoundTextEditor(sound.id);
                          }}
                          onContextMenu={(e) => {
                            openContextMenu(e, { kind: "sound", id: sound.id });
                          }}
                          style={{
                            cursor: "move",
                          }}
                        />
                      )}

                      <g pointerEvents="none">
                        {displaySound.outlineWidth > 0 &&
                          displaySound.outlineColor !== "transparent" &&
                          glyphs.map((glyph, index) => (
                            <text
                              key={`sound-stroke-${sound.id}-${index}`}
                              x={glyph.x}
                              y={glyph.y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={glyph.fontSize}
                              fontFamily={
                                !exportMode &&
                                previewFontFamily?.targetKind === "sound" &&
                                previewFontFamily.targetId === sound.id
                                  ? previewFontFamily.fontFamily.trim() || undefined
                                  : sound.fontFamily?.trim() || undefined
                              }
                              fontWeight={700}
                              transform={
                                glyph.rotate
                                  ? `rotate(${glyph.rotate} ${glyph.x} ${glyph.y})`
                                  : undefined
                              }
                              fill="none"
                              stroke={displaySound.outlineColor}
                              strokeWidth={displaySound.outlineWidth * 2}
                              strokeLinejoin="round"
                              paintOrder="stroke"
                              vectorEffect="non-scaling-stroke"
                            >
                              {glyph.char}
                            </text>
                          ))}

                        {glyphs.map((glyph, index) => (
                          <text
                            key={`sound-fill-${sound.id}-${index}`}
                            x={glyph.x}
                            y={glyph.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={glyph.fontSize}
                            fontFamily={
                              !exportMode &&
                              previewFontFamily?.targetKind === "sound" &&
                              previewFontFamily.targetId === sound.id
                                ? previewFontFamily.fontFamily.trim() || undefined
                                : sound.fontFamily?.trim() || undefined
                            }
                            fontWeight={700}
                            transform={
                              glyph.rotate
                                ? `rotate(${glyph.rotate} ${glyph.x} ${glyph.y})`
                                : undefined
                            }
                            fill={displaySound.color}
                          >
                            {glyph.char}
                          </text>
                        ))}
                      </g>

                      {!exportMode && isSelected && (
                        <path
                          d={selectionPath}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={2}
                          vectorEffect="non-scaling-stroke"
                          strokeLinejoin="round"
                          pointerEvents="none"
                        />
                      )}
                    </svg>

                    {!exportMode && isSelected && !isMultiSelected && (
                      <>
                        {tiltHandles.map((handle) => (
                          <div
                            key={`sound-tilt-${sound.id}-${handle.edge}`}
                            title={t("adjustAngle")}
                            onContextMenu={suppressHandleContextMenu}
                            onMouseDown={(e) => startSoundTiltDrag(e, sound, handle.edge)}
                            style={{
                              position: "absolute",
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              border: "2px solid #2563eb",
                              background: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              pointerEvents: "auto",
                              cursor: "pointer",
                              boxSizing: "border-box",
                              left: handle.point.x,
                              top: handle.point.y,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <AngleSvgIcon />
                          </div>
                        ))}

                        <div
                          title={t("verticalCurve")}
                          onContextMenu={suppressHandleContextMenu}
                          onMouseDown={(e) => startSoundCurveDrag(e, sound, "y")}
                          style={{
                            position: "absolute",
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            border: "2px solid #2563eb",
                            background: "#ffffff",
                            pointerEvents: "auto",
                            cursor: "ns-resize",
                            boxSizing: "border-box",
                            left: curveYHandle.x,
                            top: curveYHandle.y,
                            transform: "translate(-50%, -50%)",
                          }}
                        />

                        <div
                          title={t("horizontalCurve")}
                          onContextMenu={suppressHandleContextMenu}
                          onMouseDown={(e) => startSoundCurveDrag(e, sound, "x")}
                          style={{
                            position: "absolute",
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            border: "2px solid #2563eb",
                            background: "#ffffff",
                            pointerEvents: "auto",
                            cursor: "ew-resize",
                            boxSizing: "border-box",
                            left: curveXHandle.x,
                            top: curveXHandle.y,
                            transform: "translate(-50%, -50%)",
                          }}
                        />

                        <div
                          title={t("resize")}
                          onContextMenu={suppressHandleContextMenu}
                          onMouseDown={(e) => startSoundResize(e, sound)}
                          style={{
                            position: "absolute",
                            right: -24,
                            bottom: -24,
                            width: 18,
                            height: 18,
                            background: "#ffffff",
                            border: "2px solid #2563eb",
                            borderRadius: 4,
                            color: "#111827",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "nwse-resize",
                            pointerEvents: "auto",
                            boxSizing: "border-box",
                          }}
                        >
                          <DiagonalResizeSvgIcon direction="nesw" />
                        </div>

                        <div
                          title={t("rotate")}
                          onContextMenu={suppressHandleContextMenu}
                          onMouseDown={(e) => startSoundRotate(e, sound)}
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: -30,
                            width: 18,
                            height: 18,
                            transform: "translateX(-50%)",
                            borderRadius: "50%",
                            background: "#ffffff",
                            border: "2px solid #2563eb",
                            color: "#111827",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "crosshair",
                            pointerEvents: "auto",
                            boxSizing: "border-box",
                          }}
                        >
                          <ResetSvgIcon />
                        </div>
                      </>
                    )}
                  </div>
                );
              })()
            );
          })}

        {!exportMode && imagePositionDimTargetPointString && (
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 4990,
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <mask id={`image-position-dim-mask-${page.id}`}>
                <rect x="0" y="0" width="100" height="100" fill="white" />
                <polygon points={imagePositionDimTargetPointString} fill="black" />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100"
              height="100"
              fill="rgba(0, 0, 0, 0.46)"
              mask={`url(#image-position-dim-mask-${page.id})`}
            />
          </svg>
        )}

        {!exportMode && snapGuideLines.length > 0 && (
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 9998,
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {snapGuideLines.map((line, index) => (
              <line
                key={`snap-guide-line-${index}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}

        {!exportMode &&
          !suppressFrameSelectionOutlineByBorderSwitch &&
          page.frames
            .filter((frame) => selectedFrameIds.includes(frame.id))
            .map((frame) => {
              const frameStrokePoints = getFrameInnerPolygonPointString(frame);
              const [tl, tr, br, bl] = getFramePolygonPoints(frame);

              const isFrameImagePositionEditing =
                (trimmingFrameId === frame.id ||
                  (selectedFrameImageCardId === frame.id &&
                    openEditorSectionKey === "frame-image-move-copy")) &&
                hasFrameImage(frame);
              const isProtectedCoverBase = isProtectedCoverBaseFrame(page, frame);
              const isActiveSelectedFrame =
                !isMultiFrameSelection || activeSelectedFrameId === frame.id;
              const isFrameEffectLineEditing =
                openEditorSectionKey === "frame-effect-line" &&
                selectedFrameIds.length === 1 &&
                selectedFrameIds[0] === frame.id;
              const showFrameHandles =
                !isProtectedCoverBase &&
                isActiveSelectedFrame &&
                !isFrameEffectLineEditing;
              const frameHandleColor = "#2563eb";
              const frameHandleBackground = "#ffffff";

              const isFrameTransformDragging =
                (dragState?.kind === "frame-resize" && dragState.id === frame.id) ||
                (dragState?.kind === "frame-tilt" && dragState.id === frame.id);
              const shouldHideImagePositionFrameHandles =
                isFrameImagePositionEditing && isFrameTransformDragging;

              if (shouldHideImagePositionFrameHandles) {
                return null;
              }

              const isFrameHandleActive =
                isFrameImagePositionEditing ||
                (isMultiFrameSelection && activeSelectedFrameId === frame.id) ||
                hoverFrameGuideId === frame.id ||
                isFrameTransformDragging;

              const frameStrokeWidth = isFrameImagePositionEditing ? 5 : isFrameHandleActive ? 5 : 3;
              const handleBorderWidth = isFrameHandleActive ? 3 : 2;
              const handleIconStrokeWidth = isFrameHandleActive ? "2.4" : "1.8";

              const activateFrameHandle = () => {
                activateSelectedFrameGuide(frame.id);
              };
              const deactivateFrameHandle = () => deactivateSelectedFrameGuide(frame.id);

              const tiltHandles = [
                { edge: "top" as const, point: getPointOnLine(tl, tr, 0.25) },
                { edge: "right" as const, point: getPointOnLine(tr, br, 0.25) },
                { edge: "bottom" as const, point: getPointOnLine(bl, br, 0.75) },
                { edge: "left" as const, point: getPointOnLine(tl, bl, 0.75) },
              ];

              const topEdgeCenter = getPointOnLine(tl, tr, 0.5);
              const imageResetButtonPoint = getPointOnLine(topEdgeCenter, tr, 0.5);

              const resizeHandles = [
                { mode: "top-left" as const, point: tl, cursor: "nwse-resize" },
                { mode: "top-right" as const, point: tr, cursor: "nesw-resize" },
                { mode: "bottom-left" as const, point: bl, cursor: "nesw-resize" },
                { mode: "bottom-right" as const, point: br, cursor: "nwse-resize" },
                { mode: "top" as const, point: topEdgeCenter, cursor: "ns-resize" },
                { mode: "bottom" as const, point: getPointOnLine(bl, br, 0.5), cursor: "ns-resize" },
                { mode: "left" as const, point: getPointOnLine(tl, bl, 0.5), cursor: "ew-resize" },
                { mode: "right" as const, point: getPointOnLine(tr, br, 0.5), cursor: "ew-resize" },
              ];

              return (
                <div
                  key={`frame-selection-overlay-${frame.id}`}
                  data-frame-image-position-keep-id={String(frame.id)}
                  style={{
                    position: "absolute",
                    left: `${frame.x}%`,
                    top: `${frame.y}%`,
                    width: `${frame.w}%`,
                    height: `${frame.h}%`,
                    overflow: "visible",
                    pointerEvents: "none",
                    zIndex: isFrameImagePositionEditing
                      ? FRAME_EDITOR_FRONT_Z_INDEX + 1000
                      : isFrameHandleActive
                        ? 7000
                        : 6000,
                  }}
                >
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      overflow: "visible",
                      pointerEvents: "none",
                    }}
                  >
                    <polygon
                      points={frameStrokePoints}
                      fill="none"
                      stroke={frameHandleColor}
                      strokeWidth={frameStrokeWidth}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="miter"
                      strokeDasharray={undefined}
                    />
                  </svg>

                  {isFrameImagePositionEditing && (
                    <button
                      type="button"
                      title={t("reset")}
                      aria-label={t("reset")}
                      data-image-position-keep="true"
                      data-image-position-keep-frame-id={String(frame.id)}
                      onContextMenu={suppressHandleContextMenu}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        activateFrameHandle();
                        resetFrameImage(frame.id);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      style={{
                        position: "absolute",
                        width: 34,
                        height: 34,
                        padding: 0,
                        borderRadius: 8,
                        border: `${handleBorderWidth}px solid ${frameHandleColor}`,
                        background: frameHandleBackground,
                        display: "flex",
                        alignItems: "center",
                        color: frameHandleColor,
                        justifyContent: "center",
                        pointerEvents: "auto",
                        zIndex: 7200,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                        ...getFrameHandleCssPosition(imageResetButtonPoint),
                        cursor: "pointer",
                      }}
                    >
                      <ResetSvgIcon />
                    </button>
                  )}

                  {showFrameHandles && tiltHandles.map((handle) => (
                  <div
                    key={`frame-selection-tilt-${frame.id}-${handle.edge}`}
                    title={t("adjustAngle")}
                    onContextMenu={suppressHandleContextMenu}
                    onMouseDown={(e) => {
                      activateFrameHandle();
                      startFrameTiltDrag(e, frame, handle.edge);
                    }}
                    onMouseEnter={activateFrameHandle}
                    onMouseLeave={deactivateFrameHandle}
                      style={{
                        position: "absolute",
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: `${handleBorderWidth}px solid ${frameHandleColor}`,
                        background: frameHandleBackground,
                        display: "flex",
                        alignItems: "center",
                        color: frameHandleColor,
                        justifyContent: "center",
                        pointerEvents: "auto",
                        zIndex: isFrameHandleActive ? 7100 : 6100,
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                        ...getFrameHandleCssPosition(handle.point),
                      }}
                    >
                      <AngleSvgIcon />
                    </div>
                  ))}

                  {showFrameHandles && resizeHandles.map((handle) => {
                    const isVertical = handle.mode === "top" || handle.mode === "bottom";
                    const isHorizontal = handle.mode === "left" || handle.mode === "right";
                    const isDiagonal = !isVertical && !isHorizontal;
                    const isBackslashDiagonal =
                      handle.mode === "top-left" || handle.mode === "bottom-right";

                    return (
                      <div
                        key={`frame-selection-handle-${frame.id}-${handle.mode}`}
                        onContextMenu={suppressHandleContextMenu}
                        onMouseDown={(e) => {
                          activateFrameHandle();
                          startFrameResize(e, frame, handle.mode);
                        }}
                        onMouseEnter={activateFrameHandle}
                        onMouseLeave={deactivateFrameHandle}
                        style={{
                          position: "absolute",
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          border: `${handleBorderWidth}px solid ${frameHandleColor}`,
                          background: frameHandleBackground,
                          display: "flex",
                          alignItems: "center",
                          color: frameHandleColor,
                          justifyContent: "center",
                          pointerEvents: "auto",
                          zIndex: isFrameHandleActive ? 7100 : 6100,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                          ...getFrameHandleCssPosition(handle.point),
                          cursor: handle.cursor,
                        }}
                      >
                        {isVertical && <ArrowVerticalSvgIcon />}
                        {isHorizontal && <ArrowHorizontalSvgIcon />}
                        {isDiagonal && !isBackslashDiagonal && (
                          <DiagonalResizeSvgIcon direction="nwse" />
                        )}
                        {isDiagonal && isBackslashDiagonal && (
                          <DiagonalResizeSvgIcon direction="nesw" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

        {!exportMode &&
          sortedBubbles
            .filter((bubble) => selectedBubbleIds.includes(bubble.id))
            .map((bubble) => {
              const tailHandle = getTailHandlePosition(bubble);
              const tailGeometry = getTailGeometry(bubble);
              const isPrimarySelected =
                primarySelectedItem?.kind === "bubble" &&
                primarySelectedItem.id === bubble.id;
              const showTailHandles =
                isPrimarySelected &&
                canBubbleUseTail(bubble);
              const tailStyle = bubble.tailStyle ?? "triangle";
              const showTailWidthGuide =
                showTailHandles &&
                canBubbleUseTailCurve(bubble) &&
                bubble.tailEnabled &&
                (tailStyle === "triangle" || tailStyle === "thought");
              const tailWidthGuideRangePx = 28;
              const tailWidthGuideOffsetPx = 18;
              const tailWidthGuideDirection =
                bubble.tailMode === "outside" ? 1 : -1;
              const tailWidthGuideCenterX =
                tailGeometry.tipX +
                ((tailGeometry.unitX * tailWidthGuideDirection * tailWidthGuideOffsetPx) /
                  tailGeometry.bubblePixelW) *
                  100;
              const tailWidthGuideCenterY =
                tailGeometry.tipY +
                ((tailGeometry.unitY * tailWidthGuideDirection * tailWidthGuideOffsetPx) /
                  tailGeometry.bubblePixelH) *
                  100;
              const tailWidthGuideStartX =
                tailWidthGuideCenterX -
                ((tailGeometry.perpX * tailWidthGuideRangePx) /
                  tailGeometry.bubblePixelW) *
                  100;
              const tailWidthGuideStartY =
                tailWidthGuideCenterY -
                ((tailGeometry.perpY * tailWidthGuideRangePx) /
                  tailGeometry.bubblePixelH) *
                  100;
              const tailWidthGuideEndX =
                tailWidthGuideCenterX +
                ((tailGeometry.perpX * tailWidthGuideRangePx) /
                  tailGeometry.bubblePixelW) *
                  100;
              const tailWidthGuideEndY =
                tailWidthGuideCenterY +
                ((tailGeometry.perpY * tailWidthGuideRangePx) /
                  tailGeometry.bubblePixelH) *
                  100;
              const projectTailWidthHandleToGuide = (point: { x: number; y: number }) => {
                const deltaPxX =
                  ((point.x - tailWidthGuideCenterX) / 100) *
                  tailGeometry.bubblePixelW;
                const deltaPxY =
                  ((point.y - tailWidthGuideCenterY) / 100) *
                  tailGeometry.bubblePixelH;
                const projectedPx = clamp(
                  deltaPxX * tailGeometry.perpX + deltaPxY * tailGeometry.perpY,
                  -tailWidthGuideRangePx,
                  tailWidthGuideRangePx
                );

                return {
                  x:
                    tailWidthGuideCenterX +
                    ((tailGeometry.perpX * projectedPx) /
                      tailGeometry.bubblePixelW) *
                      100,
                  y:
                    tailWidthGuideCenterY +
                    ((tailGeometry.perpY * projectedPx) /
                      tailGeometry.bubblePixelH) *
                      100,
                };
              };
              const tailWidthHandle =
                dragState?.kind === "bubble-tail-width" &&
                bubbleTailWidthDragCursor?.id === bubble.id
                  ? projectTailWidthHandleToGuide({
                      x:
                        ((bubbleTailWidthDragCursor.xPercent - bubble.x) /
                          bubble.w) *
                        100,
                      y:
                        ((bubbleTailWidthDragCursor.yPercent - bubble.y) /
                          bubble.h) *
                        100,
                    })
                  : projectTailWidthHandleToGuide(
                      getBubbleTailWidthHandlePosition(bubble)
                    );

              return (
                <div
                  key={`bubble-selection-overlay-${bubble.id}`}
                  style={{
                    position: "absolute",
                    left: `${bubble.x}%`,
                    top: `${bubble.y}%`,
                    width: `${bubble.w}%`,
                    height: `${bubble.h}%`,
                    overflow: "visible",
                    pointerEvents: "none",
                    zIndex: 2100,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      border: "2px solid #2563eb",
                      borderRadius: 8,
                      pointerEvents: "none",
                      boxSizing: "border-box",
                    }}
                  />

                  {showTailWidthGuide && (
                    <>
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: "100%",
                          height: "100%",
                          overflow: "visible",
                          pointerEvents: "none",
                        }}
                      >
                        <line
                          x1={tailWidthGuideStartX}
                          y1={tailWidthGuideStartY}
                          x2={tailWidthGuideEndX}
                          y2={tailWidthGuideEndY}
                          stroke="#2563eb"
                          strokeWidth="1.6"
                          strokeDasharray="4 3"
                          vectorEffect="non-scaling-stroke"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div
                        onContextMenu={suppressHandleContextMenu}
                        onMouseDown={(e) => startBubbleTailWidth(e, bubble)}
                        title={t("tailWidth")}
                        style={{
                          position: "absolute",
                          left: `calc(${tailWidthHandle.x}% - 6px)`,
                          top: `calc(${tailWidthHandle.y}% - 6px)`,
                          width: 12,
                          height: 12,
                          background: "#ffffff",
                          borderRadius: "50%",
                          border: "2px solid #2563eb",
                          boxSizing: "border-box",
                          cursor: "ew-resize",
                          pointerEvents: "auto",
                        }}
                      />
                    </>
                  )}
                  {showTailHandles && (
                    <div
                      onContextMenu={suppressHandleContextMenu}
                      onMouseDown={(e) => startBubbleTail(e, bubble)}
                      title={t("tailPosition")}
                      style={{
                        position: "absolute",
                        left: `calc(${tailHandle.x}% - 6px)`,
                        top: `calc(${tailHandle.y}% - 6px)`,
                        width: 12,
                        height: 12,
                        background: "#2563eb",
                        borderRadius: "50%",
                        border: "2px solid #fff",
                        boxSizing: "border-box",
                        cursor: "crosshair",
                        pointerEvents: "auto",
                      }}
                    />
                  )}
                </div>
              );
            })}


            {showPageNumbers && (() => {
              const pageNumber = getCanvasPageNumber(page.id);
              if (pageNumber == null) return null;

              return (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "97.5%",
                    transform: "translate(-50%, -50%)",
                    color: "#111827",
                    fontSize: 18,
                    fontWeight: 400,
                    lineHeight: 1,
                    fontFamily:
                      '"Yu Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                >
                  {pageNumber}
                </div>
              );
            })()}

      </div>
    );
  };

  const loadImageElement = (dataUrl: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(createAppError(APP_ERROR.PDF_RENDER));
      image.src = dataUrl;
    });
  };

  const updateExportProgress = (label: string, current: number, total: number) => {
    setExportProgress({
      label,
      current: Math.min(Math.max(current, 0), Math.max(total, 1)),
      total: Math.max(total, 1),
    });
  };

  const waitForNextFrame = () => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  };

  const getExportBaseName = () => {
    const base = projectFileName
      ? projectFileName.replace(/\.[^/.]+$/, "")
      : "manga-pages";

    const sanitized = base.replace(/[\\/:*?"<>|]/g, "_").trim();
    return sanitized.length > 0 ? sanitized : "manga-pages";
  };

  const handleExportPdf = async (pixelRatio = STANDARD_EXPORT_PIXEL_RATIO) => {
    console.log("PDF export start");

    if (isExportingPdf || isExportingPng) {
      console.log("PDF export blocked: already exporting");
      return;
    }
    if (pages.length === 0) {
      console.log("PDF export blocked: no pages");
      return;
    }

    const exportPages = exportablePages;
    if (exportPages.length === 0) {
      console.log("PDF export blocked: no exportable pages");
      alert(t("noPdfPages"));
      return;
    }

    const isHighResolutionExport = pixelRatio > STANDARD_EXPORT_PIXEL_RATIO;
    const fileName = `${getExportBaseName()}${isHighResolutionExport ? "_high" : ""}.pdf`;
    let fileHandle: FileSystemFileHandle | null = null;

    if (canUseFileSystemPicker) {
      try {
        console.log("PDF picker start");

        fileHandle = await pickSaveFileHandle({
          suggestedName: fileName,
          types: [
            {
              description: t("pdfFile"),
              accept: {
                "application/pdf": [".pdf"],
              },
            },
          ],
        });

        console.log("PDF picker success", fileHandle);

        if (!fileHandle) {
          console.log("PDF picker cancelled or returned null");
          return;
        }
        } catch (error) {
          console.error("PDF picker error", error);

          const errorKind = getExportFileErrorKind(error);

          if (errorKind === "cancel") {
            return;
          }

          if (errorKind === "write-blocked") {
            alert(t("pdfWriteFailed"));
            return;
          }

          alert(
            t(
              errorKind === "permission" || isPermissionError(error)
                ? "pdfPermissionDenied"
                : "pdfFilePickerFailed"
            )
          );
          return;
        }
    }

    let didExport = false;

    try {
      console.log("PDF render setup start");

      setIsExportingPdf(true);
      updateExportProgress(t("exportPreparing"), 0, exportPages.length + 1);
      await waitForNextFrame();

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [PAGE_WIDTH, PAGE_HEIGHT],
        compress: true,
      });
      let renderedCount = 0;

      console.log("PDF render loop start", exportPages.length);

      for (let i = 0; i < exportPages.length; i++) {
        const page = exportPages[i];
        console.log("PDF render page start", i + 1, page.id);

        updateExportProgress(`${t("exportRenderingPage")} ${i + 1}/${exportPages.length}`, i, exportPages.length + 1);

        const el = exportRefs.current[page.id];
        if (!el) {
          console.log("PDF render page skipped: missing ref", i + 1, page.id);
          continue;
        }

        let dataUrl: string;

        try {
          dataUrl = await htmlToImage.toPng(el, {
            pixelRatio,
            cacheBust: true,
          });

          console.log("PDF render page image created", i + 1, dataUrl.length);
        } catch (error) {
          console.error("PDF render page error", error);
          throw createAppError(APP_ERROR.PDF_RENDER);
        }

        const image = await loadImageElement(dataUrl);

        if (renderedCount > 0) {
          pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], "portrait");
        }

        pdf.addImage(image, "PNG", 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
        renderedCount += 1;

        console.log("PDF render page added", i + 1, "renderedCount", renderedCount);

        updateExportProgress(`${t("exportRenderingPage")} ${i + 1}/${exportPages.length}`, i + 1, exportPages.length + 1);
        await waitForNextFrame();
      }

      console.log("PDF render loop finished", renderedCount);

      if (renderedCount === 0) {
        console.log("PDF render failed: renderedCount is 0");
        throw createAppError(APP_ERROR.PDF_RENDER);
      }

      console.log("PDF blob create start");

      const blob = pdf.output("blob");

      console.log("PDF blob created", blob.size);

      updateExportProgress(t("exportCreatingPdf"), exportPages.length, exportPages.length + 1);
      await waitForNextFrame();

      if (fileHandle) {
        console.log("PDF write start");
        await writeBlobToHandle(fileHandle, blob);
        console.log("PDF write success");
      } else {
        console.log("PDF downloadBlob start");
        downloadBlob(blob, fileName);
        console.log("PDF downloadBlob success");
      }

      updateExportProgress(t("exportWritingFile"), exportPages.length + 1, exportPages.length + 1);
      didExport = true;

      console.log("PDF export success");
    } catch (error) {
      console.error("PDF export error", error);

      const errorKind = getExportFileErrorKind(error);

      if (errorKind === "cancel") {
        return;
      }

      alert(
        t(
          isAppError(error, APP_ERROR.PDF_RENDER)
            ? "pdfRenderFailed"
            : "pdfWriteFailed"
        )
      );
      return;
    } finally {
      console.log("PDF export cleanup");

      setIsExportingPdf(false);
      setExportProgress(null);
    }

    if (didExport) {
      console.log("PDF completion alert");
      trackExportPdf();
      requestReviewPromptAfterExport("pdf");
      showAlertAfterPaint(getOptionalMessage("pdfExportCompleted", "exportCompleted"));
    }
  };

  const dataUrlToBlob = async (dataUrl: string) => {
    const response = await fetch(dataUrl);
    return await response.blob();
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);
  };

  const handleExportPng = async (pixelRatio = STANDARD_EXPORT_PIXEL_RATIO) => {
    if (isExportingPdf || isExportingPng) return;
    if (pages.length === 0) return;

    const exportPages = exportablePages;
    if (exportPages.length === 0) {
      alert(t("noPngPages"));
      return;
    }

    const isHighResolutionExport = pixelRatio > STANDARD_EXPORT_PIXEL_RATIO;
    const baseName = `${getExportBaseName()}${isHighResolutionExport ? "_high" : ""}`;
    const isSingle = exportPages.length === 1;

    let fileHandle: FileSystemFileHandle | null = null;

    if (canUseFileSystemPicker) {
      try {
        fileHandle = await pickSaveFileHandle({
          suggestedName: isSingle
            ? `${baseName}_001.png`
            : `${baseName}_png.zip`,
          types: [
            {
              description: isSingle ? "PNG画像" : "ZIPファイル",
              accept: isSingle
                ? { "image/png": [".png"] }
                : { "application/zip": [".zip"] },
            },
          ],
        });

        if (!fileHandle) {
          return;
        }
      } catch (error) {
        console.error(error);

        const errorKind = getExportFileErrorKind(error);

        if (errorKind === "cancel") {
          return;
        }

        if (errorKind === "write-blocked") {
          alert(t("pngWriteFailed"));
          return;
        }

        alert(
          t(
            errorKind === "permission" || isPermissionError(error)
              ? "pngPermissionDenied"
              : "pngFilePickerFailed"
          )
        );
        return;
      }
    }

    let didExport = false;

    try {
      setIsExportingPng(true);
      const totalSteps = exportPages.length + (isSingle ? 1 : 2);
      updateExportProgress(t("exportPreparing"), 0, totalSteps);
      await waitForNextFrame();

      const pngItems: { fileName: string; blob: Blob }[] = [];

      for (let i = 0; i < exportPages.length; i++) {
        const page = exportPages[i];
        updateExportProgress(`${t("exportRenderingPage")} ${i + 1}/${exportPages.length}`, i, totalSteps);

        const el = exportRefs.current[page.id];
        if (!el) continue;

        let dataUrl: string;

        try {
          dataUrl = await htmlToImage.toPng(el, {
            pixelRatio,
            cacheBust: true,
          });
        } catch (error) {
          console.error(error);
          throw createAppError(APP_ERROR.PNG_RENDER);
        }

        const pageNumber = String(i + 1).padStart(3, "0");
        const blob = await dataUrlToBlob(dataUrl);

        pngItems.push({
          fileName: `${baseName}_${pageNumber}.png`,
          blob,
        });

        updateExportProgress(`${t("exportRenderingPage")} ${i + 1}/${exportPages.length}`, i + 1, totalSteps);
        await waitForNextFrame();
      }

      if (pngItems.length === 0) {
        alert(t("noPngExported"));
        return;
      }

      if (pngItems.length === 1) {
        updateExportProgress(t("exportWritingFile"), exportPages.length, totalSteps);
        await waitForNextFrame();

        if (fileHandle) {
          await writeBlobToHandle(fileHandle, pngItems[0].blob);
        } else {
          downloadBlob(pngItems[0].blob, pngItems[0].fileName);
        }

        updateExportProgress(t("exportWritingFile"), totalSteps, totalSteps);
        didExport = true;
      } else {
        updateExportProgress(t("exportCreatingZip"), exportPages.length, totalSteps);
        await waitForNextFrame();

        const zip = new JSZip();

        pngItems.forEach((item) => {
          zip.file(item.fileName, item.blob);
        });

        let zipBlob: Blob;

        try {
          zipBlob = await zip.generateAsync(
            {
              type: "blob",
              compression: "DEFLATE",
            },
            (metadata) => {
              const zipStepProgress = metadata.percent / 100;
              updateExportProgress(t("exportCreatingZip"), exportPages.length + zipStepProgress, totalSteps);
            }
          );
        } catch (error) {
          console.error(error);
          throw createAppError(APP_ERROR.PNG_ZIP);
        }

        updateExportProgress(t("exportWritingFile"), exportPages.length + 1, totalSteps);
        await waitForNextFrame();

        if (fileHandle) {
          await writeBlobToHandle(fileHandle, zipBlob);
        } else {
          downloadBlob(zipBlob, `${baseName}_png.zip`);
        }

        updateExportProgress(t("exportWritingFile"), totalSteps, totalSteps);
        didExport = true;
      }
    } catch (error) {
      console.error(error);

      const errorKind = getExportFileErrorKind(error);

      if (errorKind === "cancel") {
        return;
      }

      alert(t("pngExportFailed"));
      return;
    } finally {
      setIsExportingPng(false);
      setExportProgress(null);
    }

    console.log("PNG didExport", didExport);

    if (didExport) {
      console.log("GA export_png");
      trackExportPng();
      requestReviewPromptAfterExport("png");
      showAlertAfterPaint(getOptionalMessage("pngExportCompleted", "exportCompleted"));
    }
  };

  const buttonStyle: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    fontSize: "14px",
    cursor: "pointer",
    border: "1px solid #999",        // ★戻す
    borderRadius: "6px",
    backgroundColor: "#fff",         // ★戻す
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  };

  const smallButtonStyle: React.CSSProperties = {
    padding: "4px 8px",
    fontSize: "12px",
    cursor: "pointer",
    border: "1px solid #999",
    borderRadius: "4px",
    backgroundColor: "rgba(255,255,255,0.95)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid #c8c8c8",
    borderRadius: 6,
    boxSizing: "border-box",
    backgroundColor: "#fff",
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
  };

  const sectionTitleStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,

    marginTop: 14,
    marginBottom: 6,

    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.2,

    color: "#374151",

    lineHeight: 1.3,
  };
  
  const exportProgressPercent = exportProgress
    ? Math.round((exportProgress.current / Math.max(exportProgress.total, 1)) * 100)
    : 0;

  const projectStatusFileName = projectFileName ?? t("untitled");
  const projectStatusText = hasUnsavedChanges
    ? `${projectStatusFileName} *`
    : projectStatusFileName;

  //--------------------------------------------------
  // App本体のreturn。ここから画面全体のJSX
  //--------------------------------------------------
  return (
    <div
      ref={appRootRef}
      translate="no"
      className="notranslate"
      onContextMenu={(e) => {
        const target = e.target as HTMLElement | null;

        const input = target?.closest("input") as HTMLInputElement | null;

        if (input?.type === "range") {
          e.preventDefault();
          return;
        }

        if (
          input ||
          target?.closest("textarea") ||
          target?.closest("[contenteditable='true']")
        ) {
          return;
        }

        e.preventDefault();
      }}
      onMouseDown={() => {
        setTemplateContextMenu((prev) => ({
          ...prev,
          visible: false,
        }));
      }}
      style={{
        display: "grid",
        gridTemplateRows: "auto auto minmax(0, 1fr)",
        height: "100vh",
        overflow: "hidden",
        background: "#f3f3f3",
      }}
    >
      <div
        ref={focusTrapRef}
        tabIndex={-1}
        aria-hidden="true"
        data-focus-area="main"
        data-focus-layer="canvas"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          outline: "none",
        }}
      />

      <style>
        {`
          .mansaku-page-add-card:hover,
          .mansaku-empty-page-add-button:hover {
            background: rgba(59, 130, 246, 0.08) !important;
            border-color: #2563eb !important;
            color: #2563eb !important;
          }

          .mansaku-page-add-card:active,
          .mansaku-empty-page-add-button:active {
            background: rgba(59, 130, 246, 0.14) !important;
          }

          .mansaku-page-add-card:focus-within,
          .mansaku-page-add-card:focus,
          .mansaku-empty-page-add-button:focus {
            outline: 3px solid #2563eb !important;
            outline-offset: -3px !important;
          }

          @keyframes mansaku-template-button-attention {
            0%, 100% {
              box-shadow:
                0 0 0 0 rgba(17, 24, 39, 0),
                0 0 0 rgba(17, 24, 39, 0);
            }

            50% {
              box-shadow:
                0 0 0 3px rgba(17, 24, 39, 0.28),
                0 0 16px rgba(17, 24, 39, 0.72);
            }
          }

          [data-focus-area]:focus,
          [data-focus-area][tabindex="-1"]:focus,
          [data-focus-role]:focus:not(button):not(input[type="range"]),
          [data-canvas-focus-object="true"]:focus {
            outline: none !important;
          }

          [data-focus-flash-area] {
            position: relative;
          }

          [data-focus-flash-area][data-focus-flash-active="true"]::after {
            content: "";
            position: absolute;
            inset: 2px;
            border: 2px solid #2563eb;
            border-radius: 10px;
            box-shadow:
              0 0 0 2px rgba(37, 99, 235, 0.18),
              0 0 18px rgba(37, 99, 235, 0.72);
            pointer-events: none;
            z-index: 999999;
            animation: mansaku-focus-area-flash 650ms ease-out forwards;
          }

          @keyframes mansaku-focus-area-flash {
            0% {
              opacity: 0;
            }

            18% {
              opacity: 1;
            }

            100% {
              opacity: 0;
            }
          }
        `}
      </style>       
      <div
        translate="no"
        className="notranslate"
        style={{
          height: 22,
          borderBottom: "1px solid #d1d5db",
          background: "#f7f7f7",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 10px",
          fontSize: 11,
          color: "#6b7280",
          lineHeight: 1,
          userSelect: "none",
          overflow: "hidden",
          zIndex: 21,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "#374151",
            }}
          >
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
            }}
          >
            <img
              src="/favicon.svg"
              alt={APP_NAME}
              width={14}
              height={14}
              draggable={false}
              style={{
                flexShrink: 0,
              }}
            />

            <div
              title={projectStatusText}
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {projectStatusText}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={toolbarRef}
        tabIndex={-1}
        data-focus-area="menu"
        data-focus-layer="menu"
        data-focus-flash-area="toolbar"
        style={{
          height: 44,
          borderBottom: "1px solid #ccc",
          backgroundColor: "#f7f7f7",
          display: "flex",
          alignItems: "stretch",
          overflow: "visible",
          zIndex: 20,
          outline: "none",
        }}
      >
        <div
          style={{
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            paddingLeft: 12,
            paddingRight: 8,
            flexShrink: 0,
          }}
        >
            <div
              ref={menuWrapRef}
              onPointerMove={(e) => {
                if (!setContextMenuMouseInputModeByPointerMove(e.nativeEvent)) return;
                if (!isAnyTopToolbarMenuOpen) return;
                openTopToolbarMenu("main");
              }}
              style={{ position: "relative" }}
            >
            <ToolbarIconButton
              buttonRef={menuButtonRef}
              dataFocusRole="menu-primary"
              title={t("menu")}
              onClick={() => {
                if (isMenuOpen) {
                  closeTopToolbarMenus();
                  return;
                }

                openTopToolbarMenu("main");
              }}
            >
              <MenuSvgIcon />
            </ToolbarIconButton>

            {isMenuOpen && (
              <div
                data-focus-area="menu"
                data-focus-layer="context-menu"
                data-top-toolbar-menu="main"
                data-context-menu="top-toolbar-main"
                role="menu"
                onFocusCapture={clearTopToolbarSubmenuIfFocusMovesToPlainItem}
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  minWidth: 210,
                  background: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                  padding: 6,
                  zIndex: 99999,
                }}
              >
                <ContextMenuButton
                  onClick={() => {
                    handleNewProject();
                  }}
                >
                  <MenuItemWithIcon icon={<ManuscriptSvgIcon />}>
                    {t("newProject")}
                  </MenuItemWithIcon>
                </ContextMenuButton>

                <ContextMenuButton
                  onClick={() => {
                    void handleLoadProjectClick();
                  }}
                >
                  <MenuItemWithIcon icon={<FolderSvgIcon />}>
                    {t("open")}
                  </MenuItemWithIcon>
                </ContextMenuButton>

                <ContextMenuButton
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    setStickySubmenuKey(null);
                    void handleSaveProjectWithStatus(menuWrapRef.current);
                  }}
                >
                  <MenuItemWithIcon icon={<SaveSvgIcon />}>
                    {t("save")}
                  </MenuItemWithIcon>
                </ContextMenuButton>

                <ContextMenuButton
                  onClick={() => {
                    setIsMenuOpen(false);
                    setStickySubmenuKey(null);
                    void handleSaveProjectAs();
                  }}
                >
                  <MenuItemWithIcon icon={<SaveSvgIcon />}>
                    {t("saveAs")}
                  </MenuItemWithIcon>
                </ContextMenuButton>

                {(() => {
                  const canExport =
                    exportablePages.length > 0 &&
                    !isExportingPng &&
                    !isExportingPdf;

                  return (
                    <div
                      className="split-menu-wrap"
                      onPointerMove={(e) => {
                        if (!setContextMenuMouseInputModeByPointerMove(e.nativeEvent)) return;

                        if (canExport) {
                          setStickySubmenuKey("main-export");
                          return;
                        }

                        setStickySubmenuKey((prev) =>
                          prev === "main-export" ? null : prev
                        );
                      }}
                      onFocusCapture={() => {
                        if (canExport) {
                          setStickySubmenuKey("main-export");
                        }
                      }}
                      style={{ position: "relative" }}
                    >
                      <ContextMenuButton
                        disablePressEffect
                        disabled={!canExport}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          if (canExport) {
                            setStickySubmenuKey("main-export");
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          if (canExport) {
                            setStickySubmenuKey("main-export");
                          }
                        }}
                      ><MenuItemWithIcon
                        icon={
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              color: canExport ? undefined : "#9ca3af",
                            }}
                          >
                            <ShareSvgIcon />
                          </span>
                        }
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            color: canExport ? undefined : "#9ca3af",
                          }}
                        >
                          {t("export")}
                        </span>
                      </MenuItemWithIcon>

                        {canExport && <TriangleSvgIcon direction="right" />}
                      </ContextMenuButton>

                      {canExport && (
                        <ContextSubmenu
                          visible={stickySubmenuKey === "main-export"}
                          minWidth={190}
                        >
                        <ContextMenuButton
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            setIsMenuOpen(false);
                            setStickySubmenuKey(null);
                            void handleExportPng();
                          }}
                        >
                          <MenuItemWithIcon icon={<PngFileSvgIcon />}>
                            {t("png")}
                          </MenuItemWithIcon>
                        </ContextMenuButton>

                        <ContextMenuButton
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            setIsMenuOpen(false);
                            setStickySubmenuKey(null);
                            void handleExportPng(HIGH_RESOLUTION_EXPORT_PIXEL_RATIO);
                          }}
                        >
                          <MenuItemWithIcon icon={<PngFileSvgIcon />}>
                            {`${t("png")} (${t("highResolution")})`}
                          </MenuItemWithIcon>
                        </ContextMenuButton>

                        <ContextMenuButton
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            setIsMenuOpen(false);
                            setStickySubmenuKey(null);
                            void handleExportPdf();
                          }}
                        >
                          <MenuItemWithIcon icon={<PdfFileSvgIcon />}>
                            {t("pdf")}
                          </MenuItemWithIcon>
                        </ContextMenuButton>

                        <ContextMenuButton
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            setIsMenuOpen(false);
                            setStickySubmenuKey(null);
                            void handleExportPdf(HIGH_RESOLUTION_EXPORT_PIXEL_RATIO);
                          }}
                        >
                          <MenuItemWithIcon icon={<PdfFileSvgIcon />}>
                            {`${t("pdf")} (${t("highResolution")})`}
                          </MenuItemWithIcon>
                        </ContextMenuButton>
                        </ContextSubmenu>
                      )}
                    </div>
                  );
                })()}

                <div
                  style={{
                    height: 1,
                    background: "#e5e7eb",
                    margin: "6px 0",
                  }}
                />

                <div
                  className="split-menu-wrap"
                  onPointerMove={(e) => {
                    if (!setContextMenuMouseInputModeByPointerMove(e.nativeEvent)) return;
                    setStickySubmenuKey("main-settings");
                  }}
                  onFocusCapture={() => {
                    setStickySubmenuKey("main-settings");
                  }}
                  style={{ position: "relative" }}
                >
                  <ContextMenuButton
                        disablePressEffect
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      setStickySubmenuKey("main-settings");
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      setStickySubmenuKey("main-settings");
                    }}
                  >
                    <MenuItemWithIcon icon={<SettingsSvgIcon />}>
                      {t("settings")}
                    </MenuItemWithIcon>

                    <TriangleSvgIcon direction="right" />
                  </ContextMenuButton>

                  <ContextSubmenu
                    visible={
                      stickySubmenuKey === "main-settings" ||
                      stickySubmenuKey === "language" ||
                      stickySubmenuKey === "default-text-direction"
                    }
                    minWidth={190}
                  >
                    <div
                      className="split-menu-wrap"
                      onPointerMove={(e) => {
                        if (!setContextMenuMouseInputModeByPointerMove(e.nativeEvent)) return;
                        setStickySubmenuKey("language");
                      }}
                      onFocusCapture={() => {
                        setStickySubmenuKey("language");
                      }}
                      style={{ position: "relative" }}
                    >
                      <ContextMenuButton
                        disablePressEffect
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          setStickySubmenuKey("language");
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          setStickySubmenuKey("language");
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <LanguageSvgIcon />

                          <span>{t("language")}</span>
                        </span>

                        <span style={{ fontSize: 12 }}>
                          <TriangleSvgIcon direction="right" />
                        </span>
                      </ContextMenuButton>

                      <ContextSubmenu
                        visible={stickySubmenuKey === "language"}
                        minWidth={140}
                      >
                        {selectableLanguages.map((value) => (
                          <ContextMenuButton
                            key={value}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              setLanguage(value);
                              localStorage.setItem("language", value);

                              setStickySubmenuKey(null);
                              setIsMenuOpen(false);
                              setIsSettingsMenuOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              {value in appLanguageFlagCountries && (
                                <FlagSvgIcon
                                  country={
                                    appLanguageFlagCountries[
                                      value as keyof typeof appLanguageFlagCountries
                                    ]
                                  }
                                />
                              )}

                              <span>{appLanguageLabels[value] ?? value}</span>
                            </span>

                            <span
                              style={{
                                opacity: language === value ? 1 : 0,
                              }}
                            >
                              <CheckSvgIcon />
                            </span>
                          </ContextMenuButton>
                        ))}
                      </ContextSubmenu>
                    </div>

                    <div
                      className="split-menu-wrap"
                      onPointerMove={(e) => {
                        if (!setContextMenuMouseInputModeByPointerMove(e.nativeEvent)) return;
                        setStickySubmenuKey("default-text-direction");
                      }}
                      onFocusCapture={() => {
                        setStickySubmenuKey("default-text-direction");
                      }}
                      style={{ position: "relative" }}
                    >
                      <ContextMenuButton
                        disablePressEffect
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          setStickySubmenuKey("default-text-direction");
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          setStickySubmenuKey("default-text-direction");
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {defaultTextDirection === "vertical" ? (
                            <VerticalWritingSvgIcon />
                          ) : (
                            <HorizontalWritingSvgIcon />
                          )}

                          <span>{t("defaultTextDirection")}</span>
                        </span>

                        <span style={{ fontSize: 12 }}>
                          <TriangleSvgIcon direction="right" />
                        </span>
                      </ContextMenuButton>

                      <ContextSubmenu
                        visible={
                          stickySubmenuKey === "default-text-direction"
                        }
                        minWidth={150}
                      >
                        <ContextMenuButton
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            setDefaultTextDirection("vertical");

                            localStorage.setItem(
                              "defaultTextDirection",
                              "vertical"
                            );

                            setStickySubmenuKey(null);
                            setIsMenuOpen(false);
                            setIsSettingsMenuOpen(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <VerticalWritingSvgIcon />

                            <span>{t("verticalWriting")}</span>
                          </span>

                          <span
                            style={{
                              opacity:
                                defaultTextDirection === "vertical"
                                  ? 1
                                  : 0,
                            }}
                          >
                            <CheckSvgIcon />
                          </span>
                        </ContextMenuButton>

                        <ContextMenuButton
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            setDefaultTextDirection("horizontal");

                            localStorage.setItem(
                              "defaultTextDirection",
                              "horizontal"
                            );

                            setStickySubmenuKey(null);
                            setIsMenuOpen(false);
                            setIsSettingsMenuOpen(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <HorizontalWritingSvgIcon />

                            <span>{t("horizontalWriting")}</span>
                          </span>

                          <span
                            style={{
                              opacity:
                                defaultTextDirection === "horizontal"
                                  ? 1
                                  : 0,
                            }}
                          >
                            <CheckSvgIcon />
                          </span>
                        </ContextMenuButton>
                      </ContextSubmenu>
                    </div>

                    <div
                      style={{
                        height: 1,
                        background: "#e5e7eb",
                        margin: "6px 4px",
                      }}
                    />

<ContextMenuButton
  onMouseDown={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();

    const ok = window.confirm(t("confirmResetSettings"));

    closeTopToolbarMenus();

    if (!ok) return;

    resetSettings();
  }}
>
  <MenuItemWithIcon icon={<ResetSvgIcon />}>
    {t("resetSettings")}
  </MenuItemWithIcon>
</ContextMenuButton>
                  </ContextSubmenu>
                </div>

                <ContextMenuButton
                  onClick={() => {
                    setIsMenuOpen(false);
                    setStickySubmenuKey(null);
                    setIsHelpOpen(true);
                  }}
                >
                  <MenuItemWithIcon icon={<HelpSvgIcon />}>
                    {t("help")}
                  </MenuItemWithIcon>
                </ContextMenuButton>
              </div>
            )}

            <input
              ref={hiddenLoadInputRef}
              type="file"
              accept=".mansa"
              onChange={handleLoadProject}
              style={{ display: "none" }}
            />

            <input
              ref={hiddenImageInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"
              onChange={handleHiddenImageInputChange}
              style={{ display: "none" }}
            />
          </div>

          <div style={{ position: "relative" }}>
            <ToolbarIconButton
              title={t("save")}
              buttonRef={saveButtonRef}
              keepFocusAfterClick
              onClick={(e) => {
                void handleSaveProjectWithStatus(e.currentTarget);
              }}
            >
              <SaveSvgIcon />
            </ToolbarIconButton>
          </div>

          <div
            ref={undoHistoryButtonRef}
            onMouseEnter={(e) => showHistoryHoverNotice(e.currentTarget)}
            onMouseLeave={hideHistoryHoverNotice}
            style={{ display: "inline-flex" }}
          >
            <ToolbarIconButton
              title={t("undo")}
              disabled={undoStack.length === 0}
              keepFocusAfterClick
              onClick={handleToolbarUndoClick}
            >
              <UndoSvgIcon />
            </ToolbarIconButton>
          </div>

          <div
            ref={redoHistoryButtonRef}
            onMouseEnter={(e) => showHistoryHoverNotice(e.currentTarget)}
            onMouseLeave={hideHistoryHoverNotice}
            style={{ display: "inline-flex" }}
          >
            <ToolbarIconButton
              title={t("redo")}
              disabled={redoStack.length === 0}
              keepFocusAfterClick
              onClick={handleToolbarRedoClick}
            >
              <RedoSvgIcon />
            </ToolbarIconButton>
          </div>
        </div>

        <div
          style={{
            width: 1,
            height: 20,
            background: "#d1d5db",
            margin: "0 6px",
            alignSelf: "center",
          }}
        />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            boxSizing: "border-box",
            padding: "0 12px 0 8px",
            display: "flex",
            gap: 8,
            flexWrap: "nowrap",
            overflow: "hidden",
            alignItems: "center",
            alignContent: "center",
          }}
        >

        {mainMode === "manga" && (
          <div style={{ display: "inline-flex", gap: 6 }}>

            {/* テンプレート */}
            <ToolbarIconButton
              title={t("template")}
              buttonRef={templateButtonRef}
              dataFocusRole="toolbar-template"
              keepFocusAfterClick
              style={
                contentPageCount === 0
                  ? {
                      animation:
                        "mansaku-template-button-attention 1.25s ease-in-out infinite",
                    }
                  : undefined
              }
              onClick={(e) => {
                e.currentTarget.focus({ preventScroll: true });

                requestAnimationFrame(() => {
                  setMainMode("template");
                  setActiveTargetType("canvas");
                  setSelectedItems([]);
                  setSelectedPageIds([]);
                  lastSelectedPageIdRef.current = null;
                  setSelectionBox(null);
                  setBubbleTailWidthDragCursor(null);

                  const focusTemplatePrimaryTarget = (attempt = 0) => {
                    requestAnimationFrame(() => {
                      const target =
                        document.querySelector<HTMLElement>(
                          '[data-focus-role="template-item"]'
                        );

                      if (target) {
                        target.focus({ preventScroll: true });
                        target.scrollIntoView({
                          block: "nearest",
                          inline: "nearest",
                        });
                        return;
                      }

                      if (attempt < 8) {
                        window.setTimeout(() => focusTemplatePrimaryTarget(attempt + 1), 0);
                        return;
                      }

                      mainAreaRef.current?.focus({ preventScroll: true });
                    });
                  };

                  focusTemplatePrimaryTarget();
                });
              }}
            >
              <span style={{ display: "inline-flex", transform: "scale(0.92)" }}>
                <LayoutSvgIcon />
              </span>
            </ToolbarIconButton>
          </div>
        )}

          {currentPage && mainMode === "manga" && (
            <>

              <ToolbarIconButton title={t("addBubble")} onClick={handleAddBubble}>
                <span style={{ display: "inline-flex", gap: 0, transform: "scale(0.92)" }}>
                  <BubbleAddSvgIcon />
                </span>
              </ToolbarIconButton>

              <ToolbarIconButton title={t("addSound")} onClick={handleAddSound}>
                <span style={{ display: "inline-flex", gap: 0, transform: "scale(0.92)" }}>
                  <DrawnTextAddSvgIcon />
                </span>
              </ToolbarIconButton>

              <ToolbarIconButton title={t("addFrame")} onClick={handleAddFrame}>
                <span style={{ display: "inline-flex", gap: 0, transform: "scale(0.92)" }}>
                  <FrameAddSvgIcon />
                </span>
              </ToolbarIconButton>

              <div
                style={{
                  width: 1,
                  height: 20,
                  background: "#d1d5db",
                  margin: "0 6px",
                  alignSelf: "center",
                }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `34px ${sharedSliderInputWidth}px ${SLIDER_PERCENT_LABEL_WIDTH}px`,
                  alignItems: "center",
                  columnGap: SLIDER_CONTROL_GAP,
                }}
              >
                <ToolbarIconButton
                  title={isPreviewFitScale() ? t("resetZoomTo100") : t("fitToScreen")}
                  onMouseEnter={(e) => {
                    e.currentTarget.title = isPreviewFitScale()
                      ? t("resetZoomTo100")
                      : t("fitToScreen");

                    e.currentTarget.setAttribute("aria-label", e.currentTarget.title);
                  }}
                  keepFocusAfterClick
                  onClick={toggleFitPreviewScale}
                >
                  <MagnifierSvgIcon />
                </ToolbarIconButton>

                <input
                  id="mansaku-slider-preview-scale"
                  className="mansaku-range-slider"
                  type="range"
                  min={25}
                  max={200}
                  step={5}
                  value={previewScale}
                  onChange={(e) => setPreviewScale(Number(e.target.value))}
                  onFocus={() => setFocusedWheelSliderId("mansaku-slider-preview-scale")}
                  onBlur={() => setFocusedWheelSliderId((current) => current === "mansaku-slider-preview-scale" ? null : current)}
                  style={sliderInputStyle}
                />

                <span style={sliderValueLabelStyle}>
                  {previewScale}%
                </span>

              </div>
              
            </>
          )}
        </div>

      </div>

      {floatingNotice && (
        <div
          style={{
            position: "fixed",
            left: floatingNotice.left,
            top: floatingNotice.top,
            maxWidth: `calc(100vw - ${Math.ceil(floatingNotice.left)}px - 8px)`,
            fontSize: 12,
            color:
              floatingNotice.message === t("localFontsLoadFailed") ||
              floatingNotice.message === t("localFontsSiteSettingsRequired")
                ? "#dc2626"
                : "#16a34a",
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "4px 8px",
            whiteSpace: "nowrap",
            overflow: "visible",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            pointerEvents: "none",
            zIndex: 100000,
          }}
        >
          {floatingNotice.message}
        </div>
      )}

      {historyHoverNotice && (
        <div
          style={{
            position: "fixed",
            left: historyHoverNotice.left,
            top: historyHoverNotice.top,
            width: "max-content",
            maxWidth: "calc(100vw - 16px)",
            boxSizing: "border-box",
            transform: "translateX(-100%)",
            fontSize: 12,
            color: "#374151",
            background: "#ffffff",
            borderRadius: 6,
            padding: "4px 7px",
            textAlign: "left",
            whiteSpace: "nowrap",
            display: "grid",
            rowGap: 2,
            overflow: "visible",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            pointerEvents: "none",
            zIndex: 100000,
          }}
        >
          <div>
            {t("historyStatus")} {undoStack.length + 1}/{undoStack.length + redoStack.length + 1}
          </div>
          {isDebugMode && (
            <>
              <div>
                {t("historySize")}: {formatHistorySize(historySizeBytes)}
              </div>
              <div>
                {t("imageAssetStatus")}: {imageAssetStats.total}
              </div>
              <div>
                {t("imageAssetUsed")}: {imageAssetStats.used}
              </div>
              <div>
                {t("imageAssetUnused")}: {imageAssetStats.unused}
              </div>
            </>
          )}
        </div>
      )}

      {isHelpOpen && (
        <HelpModal
          onClose={() => setIsHelpOpen(false)}
          language={language}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "181px minmax(0, 1fr)",
          position: "relative",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
            <aside
              translate="no"
              className="notranslate"
              data-focus-flash-area="left"
              style={{
                borderRight: "1px solid #ccc",
                backgroundColor: "#e5e7eb",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {showMainFloatingEditorPanel ? (
                <div
                  ref={editorPanelScrollRef}
                  translate="no"
                  className="notranslate"
                  data-focus-area="editor"
                  data-focus-layer="editor"
                  data-focus-flash-area="left"
                  onKeyDownCapture={(e) => {
                    if (e.key !== "Tab") return;

                    const panel = editorPanelScrollRef.current;
                    if (!panel) return;

                    const focusable = Array.from(
                      panel.querySelectorAll<HTMLElement>(
                        [
                          "button:not(:disabled)",
                          "a[href]",
                          "input:not(:disabled):not([type='hidden'])",
                          "textarea:not(:disabled)",
                          "select:not(:disabled)",
                          "[tabindex]:not([tabindex='-1'])",
                          "[data-focus-role]",
                        ].join(",")
                      )
                    ).filter((el) => {
                      const style = window.getComputedStyle(el);
                      const rect = el.getBoundingClientRect();

                      return (
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        rect.width > 0 &&
                        rect.height > 0 &&
                        el.dataset.focusSkip !== "true" &&
                        el.dataset.disabled !== "true" &&
                        el.getAttribute("aria-disabled") !== "true" &&
                        !el.hasAttribute("disabled")
                      );
                    });

                    if (focusable.length === 0) return;

                    e.preventDefault();
                    e.stopPropagation();

                    const current = document.activeElement as HTMLElement | null;
                    const currentIndex = current ? focusable.indexOf(current) : -1;

                    const nextIndex = e.shiftKey
                      ? currentIndex <= 0
                        ? focusable.length - 1
                        : currentIndex - 1
                      : currentIndex < 0 || currentIndex >= focusable.length - 1
                      ? 0
                      : currentIndex + 1;

                      const next = focusable[nextIndex];
                      if (!next) return;

                      next.focus({ preventScroll: true });
                      next.scrollIntoView({
                        block: "nearest",
                        inline: "nearest",
                      });
                  }}
                  onMouseDown={(e) => {
                    closeContextMenu();
                    e.stopPropagation();
                  }}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    scrollbarGutter: "stable",
                    paddingTop: 12,
                    paddingRight: 1,
                    paddingBottom: 12,
                    paddingLeft: 8,
                    boxSizing: "border-box",
                    background: "#f7f7f7",
                  }}
                >
                  <>
                    {selectedBubble && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <ToolbarIconButton
                            title={t("reset")}
                            dataFocusRole="editor-reset"
                            onClick={() => handleResetBubbleStyle(selectedBubble.id)}
                          >
                            <ResetSvgIcon />
                          </ToolbarIconButton>

                          <ToolbarIconButton
                            title={t("delete")}
                            dataFocusRole="editor-delete"
                            onClick={() => {
                              handleDeleteBubble(selectedBubble.id);
                              clearEditorSelectionAndFocusMain({ fitBubble: false });
                            }}
                            style={{ color: "#b91c1c" }}
                          >
                            <TrashSvgIcon />
                          </ToolbarIconButton>

                          <ToolbarIconButton title={t("close")} dataFocusRole="editor-close" onClick={() => clearEditorSelectionAndFocusMain()}>
                            <CloseSvgIcon />
                          </ToolbarIconButton>
                        </div>

                        <h3
                          style={{
                            margin: 0,
                            marginBottom: 6,
                            marginLeft: 6,
                            color: "#1f2937",
                          }}
                        >
                          {t("bubbleEditor")}
                        </h3>

                        <div style={{ position: "relative" }}>
                          <CollapsibleEditorSection sectionKey="bubble-text" title={t("text")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          <textarea
                            ref={bubbleTextEditorRef}
                            data-ruby-active-control="true"
                            value={selectedBubble.text}
                            placeholder={t("bubbleTextPlaceholder")}
                            onFocus={() => setFocusedTextEditor("bubble")}
                            onBlur={() => {
                              setFocusedTextEditor(null);

                              updateBubble(
                                selectedBubble.id,
                                (b) => fitBubbleSizeToText(b, t("bubbleTextPlaceholder")),
                                { recordHistory: false }
                              );
                            }}
                            onSelect={(e) => {
                              updateRubySelectionFromTextarea(e.currentTarget, selectedBubble);
                            }}
                            onMouseUp={(e) => {
                              updateRubySelectionFromTextarea(e.currentTarget, selectedBubble);
                            }}
                            onKeyUp={(e) => {
                              updateRubySelectionFromTextarea(e.currentTarget, selectedBubble);
                            }}
                            onChange={(e) =>
                              updateBubble(selectedBubble.id, (b) => ({
                                ...b,
                                text: e.target.value,
                                rubies: syncRubiesAfterTextChange(
                                  b.text,
                                  e.target.value,
                                  b.rubies
                                ),
                              }))
                            }
                            rows={8}
                            style={{
                              ...inputStyle,
                              resize: "vertical",
                              minHeight: 120,
                            }}
                          />

                          {bubbleRubySelectionRange && bubbleRubySelectionPreview && (
                            <div
                              ref={bubbleRubyEditorRef}
                              data-ruby-active-control="true"
                              style={{
                                marginTop: 6,
                                border: isRubyFocused
                                  ? "2px solid #111827"
                                  : "1px solid #d1d5db",
                                borderRadius: inputStyle.borderRadius ?? 6,
                                background: "#f7f7f7",
                                overflow: "hidden",
                                boxSizing: "border-box",
                              }}
                            >
                              <div
                                style={{
                                  padding: "6px 8px",
                                  fontSize: 12,
                                  color: "#6b7280",
                                  borderBottom: "1px solid #d1d5db",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}
                              >
                                {t("selected")}：{bubbleRubySelectionPreview}
                              </div>

                              <div style={{ position: "relative", height: 34 }}>
                                <input
                                  data-ruby-active-control="true"
                                  value={bubbleRubyText}
                                  onChange={(e) => setBubbleRubyText(e.target.value)}
                                  placeholder={t("enterRuby")}
                                  onFocus={() => setIsRubyFocused(true)}
                                  onBlur={() => setIsRubyFocused(false)}
                                  onKeyDown={(e) => {
                                    if (e.key !== "Enter") return;

                                    e.preventDefault();
                                    applyBubbleRuby(selectedBubble.id);
                                  }}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    padding: "0 54px 0 8px",
                                    border: "none",
                                    outline: "none",
                                    boxSizing: "border-box",
                                    background: "#ffffff",
                                    color: "#111827",
                                    fontSize: inputStyle.fontSize,
                                    fontFamily: inputStyle.fontFamily,
                                    textAlign: "center",
                                  }}
                                />

                                <ToolbarIconButton
                                  title={t("applyRuby")}
                                  dataRubyActiveControl
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => applyBubbleRuby(selectedBubble.id)}
                                  style={{
                                    position: "absolute",
                                    right: 4,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 26,
                                    height: 26,
                                    padding: 0,
                                    border: "1px solid #d1d5db",
                                    borderRadius: 6,
                                    background: "#f7f7f7",
                                    writingMode: "horizontal-tb",
                                    flexShrink: 0,
                                  }}
                                >
                                  <CheckSvgIcon />
                                </ToolbarIconButton>
                              </div>
                            </div>
                          )}

                        
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="bubble-font-size" title={t("fontSize")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: SLIDER_CONTROL_GAP }}>
                              {[16, 22, 42].map((presetSize) => (
                                <button
                                  key={presetSize}
                                  type="button"
                                  className="mansaku-slider-value-button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    resetFontSizeInputHistory();
                                    setBubbleFontSizeInput(String(presetSize));

                                    updateBubble(selectedBubble.id, (b) =>
                                      fitBubbleSizeToText(
                                        {
                                          ...b,
                                          fontSize: presetSize,
                                        },
                                        t("bubbleTextPlaceholder")
                                      )
                                    );
                                  }}
                                  style={{
                                    ...sliderValueButtonStyle,
                                    minWidth: 44,
                                    width: "auto",
                                    justifyContent: "center",
                                  }}
                                >
                                  {presetSize}px
                                </button>
                              ))}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="number"
                                min={10}
                                max={120}
                                value={bubbleFontSizeInput}
                              onChange={(e) => {
                                const value = e.target.value;

                                setBubbleFontSizeInput(value);

                                if (value === "") return;

                                const num = Number(value);
                                if (!Number.isFinite(num)) return;

                                beginFontSizeInputHistory("bubble", selectedBubble.id);

                                updateBubble(
                                  selectedBubble.id,
                                  (b) => {
                                    const nextBubble = {
                                      ...b,
                                      fontSize: num,
                                    };

                                    return {
                                      ...nextBubble,
                                      tailLength:
                                        nextBubble.tailEnabled && canBubbleUseTail(nextBubble)
                                          ? getBubbleMinimumTailLengthPx(nextBubble)
                                          : 0,
                                    };
                                  },
                                  { recordHistory: false }
                                );
                              }}
                              onBlur={() => {
                                if (bubbleFontSizeInput === "") {
                                  setBubbleFontSizeInput(String(selectedBubble.fontSize));
                                  resetFontSizeInputHistory();
                                  return;
                                }

                                const num = Number(bubbleFontSizeInput);
                                if (!Number.isFinite(num)) {
                                  setBubbleFontSizeInput(String(selectedBubble.fontSize));
                                  resetFontSizeInputHistory();
                                  return;
                                }

                                const fixed = clamp(num, 10, 120);

                                updateBubble(
                                  selectedBubble.id,
                                  (b) =>
                                    fitBubbleSizeToText(
                                      {
                                        ...b,
                                        fontSize: fixed,
                                      },
                                      t("bubbleTextPlaceholder")
                                    ),
                                  { recordHistory: false }
                                );

                                setBubbleFontSizeInput(String(fixed));
                                resetFontSizeInputHistory();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                              style={{
                                ...inputStyle,
                                width: 71,
                                textAlign: "right",
                              }}
                            />

                              <span style={{ fontSize: 12, color: "#666" }}>px</span>
                            </div>
                          </div>
                        
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="bubble-font-family" title={t("fontFamily")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                              <ToolbarIconButton
                                title={t("loadLocalFonts")}
                                onClick={(e) => {
                                  void loadLocalFonts(e.currentTarget);
                                }}
                              >
                                <DownloadIcon />
                              </ToolbarIconButton>
                            </div>

                            {localFontsLoaded && (
                              <FontFamilyPreviewSelect
                                value={selectedBubble.fontFamily ?? ""}
                                defaultLabel={t("defaultFont")}
                                families={localFontFamilies}
                                inputStyle={inputStyle}
                                onPreview={(fontFamily) => {
                                  setPreviewFontFamily(
                                    fontFamily == null
                                      ? null
                                      : {
                                          targetKind: "bubble",
                                          targetId: selectedBubble.id,
                                          fontFamily,
                                        }
                                  );
                                }}
                                onCommit={(fontFamily) => {
                                  updateBubble(selectedBubble.id, (b) => ({
                                    ...b,
                                    fontFamily,
                                  }));
                                }}
                              />
                            )}
                          </div>
                        
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="bubble-text-direction" title={t("textDirection")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          <div style={{ display: "flex", gap: 6 }}>
                            <ToolbarIconButton
                              title={t("verticalWriting")}
                              onClick={() =>
                                updateBubble(
                                  selectedBubble.id,
                                  (b) => {
                                    if ((b.writingMode ?? "vertical") === "vertical") return b;

                                    return fitBubbleSizeToText(
                                      {
                                        ...b,
                                        writingMode: "vertical",
                                      },
                                      t("bubbleTextPlaceholder")
                                    );
                                  },
                                  { recordHistory: false }
                                )
                              }
                              style={{
                                background:
                                  (selectedBubble.writingMode ?? "vertical") === "vertical"
                                    ? "#e5e7eb"
                                    : undefined,
                              }}
                            >
                              <VerticalWritingSvgIcon />
                            </ToolbarIconButton>

                            <ToolbarIconButton
                              title={t("horizontalWriting")}
                              onClick={() =>
                                updateBubble(
                                  selectedBubble.id,
                                  (b) => {
                                    if ((b.writingMode ?? "vertical") === "horizontal") return b;

                                    return fitBubbleSizeToText(
                                      {
                                        ...b,
                                        writingMode: "horizontal",
                                      },
                                      t("bubbleTextPlaceholder")
                                    );
                                  },
                                  { recordHistory: false }
                                )
                              }
                              style={{
                                background:
                                  (selectedBubble.writingMode ?? "vertical") === "horizontal"
                                    ? "#e5e7eb"
                                    : undefined,
                              }}
                            >
                              <HorizontalWritingSvgIcon />
                            </ToolbarIconButton>
                          </div>
                        
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="bubble-overflow" title={t("hideOverflow")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>
                            {(() => {
                              const outsideOverflowEnabled = !(selectedBubble.clipToFrame ?? true);

                              return (
                                <EditorSwitchButton
                                  checked={outsideOverflowEnabled}
                                  onToggle={() => {
                                    updateBubble(selectedBubble.id, (b) => ({
                                      ...b,
                                      clipToFrame: outsideOverflowEnabled,
                                    }));
                                  }}
                                />
                              );
                            })()}
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="bubble-text-color" title={t("textColor")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          {(() => {
                            const bubbleHasText = (selectedBubble.text ?? "").trim().length > 0;

                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {(
                                    [
                                      { key: "black", title: t("blackTextWhiteStroke") },
                                      { key: "white", title: t("whiteTextBlackStroke") },
                                    ] as const
                                  ).map((option) => {
                                    const isActive = (selectedBubble.textColor ?? "black") === option.key;

                                    return (
                                      <ToolbarIconButton
                                        key={option.key}
                                        title={option.title}
                                        disabled={!bubbleHasText}
                                        onClick={() => {
                                          if (!bubbleHasText) return;

                                          updateBubble(
                                            selectedBubble.id,
                                            (b) =>
                                              fitBubbleSizeToText(
                                                {
                                                  ...b,
                                                  textColor: option.key,
                                                },
                                                t("bubbleTextPlaceholder")
                                              )
                                          );
                                        }}
                                        style={{
                                          background: isActive ? "#e5e7eb" : undefined,
                                        }}
                                      >
                                        <TextColorSvgIcon
                                          type={
                                            option.key === "black"
                                              ? "blackWithWhiteOutline"
                                              : "whiteWithBlackOutline"
                                          }
                                        />
                                      </ToolbarIconButton>
                                    );
                                  })}

                                  <ToolbarIconButton
                                    title={t("colorText")}
                                    disabled={!bubbleHasText}
                                    onClick={() => {
                                      if (!bubbleHasText) return;

                                      updateBubble(
                                        selectedBubble.id,
                                        (b) => {
                                          const fields = getFreeTextColorFields(b);

                                          return fitBubbleSizeToText(
                                            asBubbleWithFreeTextColor({
                                              ...b,
                                              textColor: FREE_TEXT_COLOR_MODE,
                                              freeTextColor: fields.freeTextColor ?? DEFAULT_FREE_TEXT_COLOR,
                                              freeTextOutlineEnabled: fields.freeTextOutlineEnabled ?? false,
                                              freeTextOutlineColor: fields.freeTextOutlineColor ?? DEFAULT_FREE_TEXT_OUTLINE_COLOR,
                                            }),
                                            t("bubbleTextPlaceholder")
                                          );
                                        }
                                      );
                                    }}
                                    style={{
                                      background:
                                        bubbleHasText && isFreeTextColorMode(selectedBubble)
                                          ? "#e5e7eb"
                                          : undefined,
                                    }}
                                  >
                                    <FreeTextColorSvgIcon />
                                  </ToolbarIconButton>
                                </div>

                                {bubbleHasText && isFreeTextColorMode(selectedBubble) && (
                                  <FreeRgbTextColorEditor
                                    t={t}
                                    fillColor={getFreeTextFillColor(selectedBubble)}
                                    outlineEnabled={getFreeTextOutlineEnabled(selectedBubble)}
                                    outlineColor={getFreeTextOutlineColor(selectedBubble)}
                                    onFillColorChange={(color) =>
                                      updateBubble(
                                        selectedBubble.id,
                                        (b) =>
                                          fitBubbleSizeToText(
                                            asBubbleWithFreeTextColor({
                                              ...b,
                                              textColor: FREE_TEXT_COLOR_MODE,
                                              freeTextColor: color,
                                            }),
                                            t("bubbleTextPlaceholder")
                                          )
                                      )
                                    }
                                    onOutlineEnabledChange={(enabled) =>
                                      updateBubble(
                                        selectedBubble.id,
                                        (b) =>
                                          fitBubbleSizeToText(
                                            asBubbleWithFreeTextColor({
                                              ...b,
                                              textColor: FREE_TEXT_COLOR_MODE,
                                              freeTextOutlineEnabled: enabled,
                                            }),
                                            t("bubbleTextPlaceholder")
                                          )
                                      )
                                    }
                                    onOutlineColorChange={(color) =>
                                      updateBubble(
                                        selectedBubble.id,
                                        (b) =>
                                          fitBubbleSizeToText(
                                            asBubbleWithFreeTextColor({
                                              ...b,
                                              textColor: FREE_TEXT_COLOR_MODE,
                                              freeTextOutlineColor: color,
                                            }),
                                            t("bubbleTextPlaceholder")
                                          )
                                      )
                                    }
                                  />
                                )}
                              </div>
                            );
                          })()}
                        
                          </CollapsibleEditorSection></div>


                        <div>
                          <CollapsibleEditorSection sectionKey="bubble-tone" title={t("backgroundColor")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          {(() => {
                            const toneMode = getBubbleBackgroundToneMode(selectedBubble);
                            const toneValue =
                              toneMode === "white"
                                ? selectedBubble.whiteTone ?? 100
                                : toneMode === "black"
                                  ? selectedBubble.blackTone ?? 100
                                  : getFreeBubbleTone(selectedBubble);

                            const applyToneValue = (
                              bubble: Bubble,
                              value: number
                            ) => {
                              if (toneMode === "white") return withWhiteBubbleTone(bubble, value);
                              if (toneMode === "black") return withBlackBubbleTone(bubble, value);

                              return withFreeBubbleBackgroundColor(
                                bubble,
                                getFreeBubbleBackgroundColor(bubble),
                                { freeBubbleTone: value }
                              );
                            };

                            const beginBubbleToneHistory = () => {
                              setActiveTargetType("canvas");
                              setSelectedItems([{ kind: "bubble", id: selectedBubble.id }]);

                              bubbleToneHistoryRef.current = {
                                pages: clonePages(pagesRef.current),
                                bubbleId: selectedBubble.id,
                                startWhiteTone: selectedBubble.whiteTone ?? 100,
                                startBlackTone: selectedBubble.blackTone ?? 100,
                                startFreeBubbleTone: getFreeBubbleTone(selectedBubble),
                                startToneMode: getBubbleBackgroundToneMode(selectedBubble),
                              };
                            };

                            const commitBubbleToneHistory = () => {
                              const snapshot = bubbleToneHistoryRef.current;
                              bubbleToneHistoryRef.current = null;

                              if (!snapshot) return;
                              if (snapshot.bubbleId !== selectedBubble.id) return;

                              const currentBubble =
                                pagesRef.current
                                  .find((page) => page.id === currentPageId)
                                  ?.bubbles.find((bubble) => bubble.id === selectedBubble.id) ??
                                selectedBubble;

                              const currentWhiteTone = currentBubble.whiteTone ?? 100;
                              const currentBlackTone = currentBubble.blackTone ?? 0;
                              const currentFreeBubbleTone = getFreeBubbleTone(currentBubble);
                              const currentToneMode = getBubbleBackgroundToneMode(currentBubble);

                              if (
                                snapshot.startWhiteTone === currentWhiteTone &&
                                snapshot.startBlackTone === currentBlackTone &&
                                snapshot.startFreeBubbleTone === currentFreeBubbleTone &&
                                snapshot.startToneMode === currentToneMode
                              ) {
                                return;
                              }

                              setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(snapshot.pages)));
                              setRedoStack([]);
                            };

                            const selectToneMode = (mode: BubbleBackgroundToneMode) => {
                              updateBubble(selectedBubble.id, (b) => {
                                const currentMode = getBubbleBackgroundToneMode(b);
                                const currentTone =
                                  currentMode === "white"
                                    ? b.whiteTone ?? 100
                                    : currentMode === "black"
                                      ? b.blackTone ?? 100
                                      : getFreeBubbleTone(b);

                                if (mode === "white") {
                                  return withWhiteBubbleTone(b, currentTone);
                                }

                                if (mode === "black") {
                                  return withBlackBubbleTone(b, currentTone);
                                }

                                return withFreeBubbleBackgroundColor(
                                  b,
                                  getFreeBubbleBackgroundColor(b),
                                  { freeBubbleTone: currentTone }
                                );
                              });
                            };

                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                                    {t("tone")}
                                  </span>

                                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                                    <input
                                      id="mansaku-slider-bubble-background-tone"
                                      className="mansaku-range-slider"
                                      type="range"
                                      title={t("tone")}
                                      aria-label={t("tone")}
                                      min={0}
                                      max={100}
                                      step={1}
                                      value={toneValue}
                                      onChange={(e) => {
                                        const rawValue = Number(e.target.value);
                                        const value =
                                          e.currentTarget.dataset.shiftDown === "true"
                                            ? clamp(Math.round(rawValue / 25) * 25, 0, 100)
                                            : clamp(rawValue, 0, 100);

                                        updateBubble(
                                          selectedBubble.id,
                                          (b) => applyToneValue(b, value),
                                          { recordHistory: false }
                                        );
                                      }}
                                      onPointerDown={(e) => {
                                        e.currentTarget.dataset.shiftDown = e.shiftKey ? "true" : "false";
                                        beginBubbleToneHistory();
                                        updateBubble(
                                          selectedBubble.id,
                                          (b) => applyToneValue(b, toneValue),
                                          { recordHistory: false }
                                        );
                                      }}
                                      onPointerMove={(e) => {
                                        e.currentTarget.dataset.shiftDown = e.shiftKey ? "true" : "false";
                                      }}
                                      onPointerUp={(e) => {
                                        e.currentTarget.dataset.shiftDown = "false";
                                        commitBubbleToneHistory();
                                      }}
                                      onPointerCancel={(e) => {
                                        e.currentTarget.dataset.shiftDown = "false";
                                        bubbleToneHistoryRef.current = null;
                                      }}
                                      onFocus={() => setFocusedWheelSliderId("mansaku-slider-bubble-background-tone")}
                                      onBlur={() => setFocusedWheelSliderId((current) => current === "mansaku-slider-bubble-background-tone" ? null : current)}
                                      style={sliderInputStyle}
                                    />

                                    <span style={sliderValueLabelStyle}>
                                      {toneValue}%
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                                    {t("backgroundColor")}
                                  </span>

                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    <ToolbarIconButton
                                      title={t("toggleWhiteTone")}
                                      onClick={() => selectToneMode("white")}
                                      style={{
                                        background: toneMode === "white" ? "#dbeafe" : undefined,
                                        outline: toneMode === "white" ? "2px solid #2563eb" : undefined,
                                      }}
                                    >
                                      <TextBackgroundSvgIcon type="white" />
                                    </ToolbarIconButton>

                                    <ToolbarIconButton
                                      title={t("toggleBlackTone")}
                                      onClick={() => selectToneMode("black")}
                                      style={{
                                        background: toneMode === "black" ? "#dbeafe" : undefined,
                                        outline: toneMode === "black" ? "2px solid #2563eb" : undefined,
                                      }}
                                    >
                                      <TextBackgroundSvgIcon type="black" />
                                    </ToolbarIconButton>

                                    <ToolbarIconButton
                                      title={t("colorText")}
                                      onClick={() => selectToneMode("color")}
                                      style={{
                                        background: toneMode === "color" ? "#dbeafe" : undefined,
                                        outline: toneMode === "color" ? "2px solid #2563eb" : undefined,
                                      }}
                                    >
                                      <TextBackgroundSvgIcon type="color" />
                                    </ToolbarIconButton>
                                  </div>

                                  {toneMode === "color" && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", paddingTop: 8 }}>
                                      <ColorPaletteField
                                        label={t("colorText")}
                                        value={getFreeBubbleBackgroundColor(selectedBubble)}
                                        onChange={(color) =>
                                          updateBubble(selectedBubble.id, (b) =>
                                            withFreeBubbleBackgroundColor(b, color)
                                          )
                                        }
                                      />

                                      <EditorSwitchButton
                                        label={t("outline")}
                                        checked={getFreeBubbleBorderEnabled(selectedBubble)}
                                        onToggle={() =>
                                          updateBubble(selectedBubble.id, (b) =>
                                            withFreeBubbleBackgroundColor(
                                              b,
                                              getFreeBubbleBackgroundColor(b),
                                              {
                                                freeBubbleBorderEnabled: !getFreeBubbleBorderEnabled(b),
                                              }
                                            )
                                          )
                                        }
                                      />

                                      {getFreeBubbleBorderEnabled(selectedBubble) && (
                                        <ColorPaletteField
                                          label={t("outline")}
                                          value={getFreeBubbleBorderColor(selectedBubble)}
                                          onChange={(color) =>
                                            updateBubble(selectedBubble.id, (b) =>
                                              withFreeBubbleBackgroundColor(
                                                b,
                                                getFreeBubbleBackgroundColor(b),
                                                { freeBubbleBorderColor: color }
                                              )
                                            )
                                          }
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="bubble-type" title={t("bubbleType")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>
                            <BubbleTypePreviewSelect
                              value={selectedBubble.type ?? "ellipse"}
                              inputStyle={inputStyle}
                              t={t}
                              onPreview={(type) => {
                                if (!bubbleTypeHistoryRef.current) {
                                  bubbleTypeHistoryRef.current = {
                                    pages: clonePages(pagesRef.current),
                                    bubbleId: selectedBubble.id,
                                    startType: selectedBubble.type ?? "ellipse",
                                  };
                                }

                                updateBubble(
                                  selectedBubble.id,
                                  (b) => applyBubbleTypePreset(b, type),
                                  { recordHistory: false }
                                );
                              }}
                              onCancel={() => {
                                const snapshot = bubbleTypeHistoryRef.current;
                                bubbleTypeHistoryRef.current = null;

                                if (!snapshot) return;
                                if (snapshot.bubbleId !== selectedBubble.id) return;

                                setPages(sanitizeProjectPagesForState(clonePages(snapshot.pages)));
                              }}
                              onCommit={(type) => {
                                const snapshot = bubbleTypeHistoryRef.current;
                                bubbleTypeHistoryRef.current = null;

                                if (!snapshot) {
                                  updateBubble(selectedBubble.id, (b) =>
                                    applyBubbleTypePreset(b, type)
                                  );
                                  return;
                                }

                                if (snapshot.bubbleId !== selectedBubble.id) return;

                                updateBubble(
                                  selectedBubble.id,
                                  (b) => applyBubbleTypePreset(b, type),
                                  { recordHistory: false }
                                );

                                if (snapshot.startType === type) return;

                                setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(snapshot.pages)));
                                setRedoStack([]);
                              }}
                            />
                          </CollapsibleEditorSection></div>



                      </div>
                    )}

                    {selectedSound && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <ToolbarIconButton
                            title={t("reset")}
                            dataFocusRole="editor-reset"
                            onClick={() => handleResetSoundStyle(selectedSound.id)}
                          >
                            <ResetSvgIcon />
                          </ToolbarIconButton>

                          <ToolbarIconButton
                            title={t("delete")}
                            dataFocusRole="editor-delete"
                            onClick={() => {
                              handleDeleteSound(selectedSound.id);
                              clearEditorSelectionAndFocusMain();
                            }}
                            style={{ color: "#b91c1c" }}
                          >
                            <TrashSvgIcon />
                          </ToolbarIconButton>

                          <ToolbarIconButton title={t("close")} dataFocusRole="editor-close" onClick={() => clearEditorSelectionAndFocusMain()}>
                            <CloseSvgIcon />
                          </ToolbarIconButton>
                        </div>

                        <h3
                          style={{
                            margin: 0,
                            marginBottom: 6,
                            marginLeft: 6,
                            color: "#1f2937",
                          }}
                        >
                          {t("soundEditor")}
                        </h3>

                        <div>
                          <CollapsibleEditorSection sectionKey="sound-text" title={t("text")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>
                          <textarea
                            ref={soundTextEditorRef}
                            value={selectedSound.text}
                            placeholder={t("soundTextPlaceholder")}
                            onFocus={() => setFocusedTextEditor("sound")}
                            onBlur={() => setFocusedTextEditor(null)}
                            onChange={(e) =>
                              updateSound(selectedSound.id, (s) => ({
                                ...s,
                                text: e.target.value.replace(/[\r\n]+/g, " "),
                              }))
                            }
                            rows={8}
                            style={{
                              ...inputStyle,
                              resize: "vertical",
                              minHeight: 120,
                            }}
                          />
                        
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="sound-font-size" title={t("fontSize")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: SLIDER_CONTROL_GAP }}>
                              {[16, 22, 42].map((presetSize) => (
                                <button
                                  key={presetSize}
                                  type="button"
                                  className="mansaku-slider-value-button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    resetFontSizeInputHistory();
                                    setSoundFontSizeInput(String(presetSize));

                                    updateSound(selectedSound.id, (s) => ({
                                      ...s,
                                      fontSize: presetSize,
                                    }));
                                  }}
                                  style={{
                                    ...sliderValueButtonStyle,
                                    minWidth: 44,
                                    width: "auto",
                                    justifyContent: "center",
                                  }}
                                >
                                  {presetSize}px
                                </button>
                              ))}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="number"
                                min={10}
                                max={160}
                                value={soundFontSizeInput}
                              onChange={(e) => {
                                const value = e.target.value;

                                setSoundFontSizeInput(value);

                                if (value === "") return;

                                const num = Number(value);
                                if (!Number.isFinite(num)) return;

                                beginFontSizeInputHistory("sound", selectedSound.id);

                                updateSound(
                                  selectedSound.id,
                                  (s) => ({
                                    ...s,
                                    fontSize: num,
                                  }),
                                  { recordHistory: false }
                                );
                              }}
                              onBlur={() => {
                                if (soundFontSizeInput === "") {
                                  setSoundFontSizeInput(String(selectedSound.fontSize));
                                  resetFontSizeInputHistory();
                                  return;
                                }

                                const num = Number(soundFontSizeInput);
                                if (!Number.isFinite(num)) {
                                  setSoundFontSizeInput(String(selectedSound.fontSize));
                                  resetFontSizeInputHistory();
                                  return;
                                }

                                const fixed = clamp(num, 10, 160);

                                updateSound(
                                  selectedSound.id,
                                  (s) => ({
                                    ...s,
                                    fontSize: fixed,
                                  }),
                                  { recordHistory: false }
                                );

                                setSoundFontSizeInput(String(fixed));
                                resetFontSizeInputHistory();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                              style={{
                                ...inputStyle,
                                width: 71,
                                textAlign: "right",
                              }}
                            />

                              <span style={{ fontSize: 12, color: "#666" }}>px</span>
                            </div>
                          </div>
                        
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="sound-font-family" title={t("fontFamily")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                              <ToolbarIconButton
                                title={t("loadLocalFonts")}
                                onClick={(e) => {
                                  void loadLocalFonts(e.currentTarget);
                                }}
                              >
                                <DownloadIcon />
                              </ToolbarIconButton>
                            </div>

                            {localFontsLoaded && (
                              <FontFamilyPreviewSelect
                                value={selectedSound.fontFamily ?? ""}
                                defaultLabel={t("defaultFont")}
                                families={localFontFamilies}
                                inputStyle={inputStyle}
                                onPreview={(fontFamily) => {
                                  setPreviewFontFamily(
                                    fontFamily == null
                                      ? null
                                      : {
                                          targetKind: "sound",
                                          targetId: selectedSound.id,
                                          fontFamily,
                                        }
                                  );
                                }}
                                onCommit={(fontFamily) => {
                                  updateSound(selectedSound.id, (s) => ({
                                    ...s,
                                    fontFamily,
                                  }));
                                }}
                              />
                            )}
                          </div>
                        
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="sound-text-direction" title={t("textDirection")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          <div style={{ display: "flex", gap: 6 }}>
                            <ToolbarIconButton
                              title={t("verticalWriting")}
                              onClick={() =>
                                updateSound(selectedSound.id, (s) => ({
                                  ...s,
                                  writingMode: "vertical",
                                }))
                              }
                              style={{
                                background:
                                  (selectedSound.writingMode ?? "vertical") === "vertical"
                                    ? "#e5e7eb"
                                    : undefined,
                              }}
                            >
                              <VerticalWritingSvgIcon />
                            </ToolbarIconButton>

                            <ToolbarIconButton
                              title={t("horizontalWriting")}
                              onClick={() =>
                                updateSound(selectedSound.id, (s) => ({
                                  ...s,
                                  writingMode: "horizontal",
                                }))
                              }
                              style={{
                                background:
                                  (selectedSound.writingMode ?? "vertical") === "horizontal"
                                    ? "#e5e7eb"
                                    : undefined,
                              }}
                            >
                              <HorizontalWritingSvgIcon />
                            </ToolbarIconButton>
                          </div>
                        
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="sound-overflow" title={t("hideOverflow")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>
                            {(() => {
                              const outsideOverflowEnabled = !(selectedSound.clipToFrame ?? false);

                              return (
                                <EditorSwitchButton
                                  checked={outsideOverflowEnabled}
                                  onToggle={() => {
                                    updateSound(selectedSound.id, (s) => ({
                                      ...s,
                                      clipToFrame: outsideOverflowEnabled,
                                    }));
                                  }}
                                />
                              );
                            })()}
                          </CollapsibleEditorSection></div>

                        <div>
                          <CollapsibleEditorSection sectionKey="sound-text-color" title={t("textColor")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                          {(() => {
                            const soundHasText = (selectedSound.text ?? "").trim().length > 0;

                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", gap: 6 }}>
                              {SOUND_STYLE_ORDER.slice(0, 2).map((key, index) => {
                                const preset = SOUND_STYLE_PRESETS[key];
                                const option = index === 0
                                  ? { iconType: "blackWithWhiteOutline", label: t("blackTextWhiteStroke") }
                                  : { iconType: "whiteWithBlackOutline", label: t("whiteTextBlackStroke") };

                                const isActive =
                                  !isSoundFreeTextColorMode(selectedSound) &&
                                  selectedSound.color === preset.color &&
                                  selectedSound.outlineColor === preset.outlineColor &&
                                  selectedSound.outlineWidth === preset.outlineWidth;

                                return (
                                  <ToolbarIconButton
                                    key={key}
                                    title={option.label}
                                    disabled={!soundHasText}
                                    onClick={() => {
                                      if (!soundHasText) return;

                                      updateSound(selectedSound.id, (s) => ({
                                        ...s,
                                        color: preset.color,
                                        outlineColor: preset.outlineColor,
                                        outlineWidth: preset.outlineWidth,
                                      } as SoundText));
                                    }}
                                    style={{
                                      background: isActive ? "#e5e7eb" : undefined,
                                    }}
                                  >
                                    <TextColorSvgIcon
                                      type={
                                        option.iconType as
                                          | "blackWithWhiteOutline"
                                          | "whiteWithBlackOutline"
                                      }
                                    />
                                  </ToolbarIconButton>
                                );
                              })}

                              <ToolbarIconButton
                                title={t("colorText")}
                                disabled={!soundHasText}
                                onClick={() => {
                                  if (!soundHasText) return;

                                  updateSound(selectedSound.id, (s) =>
                                    buildSoundWithFreeTextColor(s, {
                                      freeTextColor: getFreeTextColorFields(s).freeTextColor ?? DEFAULT_FREE_TEXT_COLOR,
                                      freeTextOutlineEnabled: getFreeTextColorFields(s).freeTextOutlineEnabled ?? false,
                                      freeTextOutlineColor: getFreeTextColorFields(s).freeTextOutlineColor ?? DEFAULT_FREE_TEXT_OUTLINE_COLOR,
                                    })
                                  );
                                }}
                                style={{
                                  background: soundHasText && isSoundFreeTextColorMode(selectedSound) ? "#e5e7eb" : undefined,
                                }}
                              >
                                <FreeTextColorSvgIcon />
                              </ToolbarIconButton>
                            </div>

                            {soundHasText && isSoundFreeTextColorMode(selectedSound) && (
                              <FreeRgbTextColorEditor
                                t={t}
                                fillColor={getFreeTextFillColor(selectedSound)}
                                outlineEnabled={getFreeTextOutlineEnabled(selectedSound)}
                                outlineColor={getFreeTextOutlineColor(selectedSound)}
                                onFillColorChange={(color) =>
                                  updateSound(selectedSound.id, (s) =>
                                    buildSoundWithFreeTextColor(s, {
                                      freeTextColor: color,
                                    })
                                  )
                                }
                                onOutlineEnabledChange={(enabled) =>
                                  updateSound(selectedSound.id, (s) =>
                                    buildSoundWithFreeTextColor(s, {
                                      freeTextOutlineEnabled: enabled,
                                    })
                                  )
                                }
                                onOutlineColorChange={(color) =>
                                  updateSound(selectedSound.id, (s) =>
                                    buildSoundWithFreeTextColor(s, {
                                      freeTextOutlineColor: color,
                                    })
                                  )
                                }
                              />
                            )}
                              </div>
                            );
                          })()}
                        
                          </CollapsibleEditorSection></div>




                      </div>
                    )}

                    {selectedFrame && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <ToolbarIconButton
                            title={t("reset")}
                            dataFocusRole="editor-reset"
                            onClick={() => {
                              resetFrameEditorControls(selectedFrame.id);
                            }}
                          >
                            <ResetSvgIcon />
                          </ToolbarIconButton>

                          <ToolbarIconButton
                            title={t("delete")}
                            dataFocusRole="editor-delete-frame"
                            disabled={selectedFrameIsProtectedCoverBase}
                            onClick={() => {
                              if (selectedFrameIsProtectedCoverBase) return;

                              if (selectedFrameIds.length > 1) {
                                handleDeleteSelectedFrames();
                              } else {
                                handleDeleteFrame(selectedFrame.id);
                              }

                              clearEditorSelectionAndFocusMain();
                            }}
                            style={{ color: selectedFrameIsProtectedCoverBase ? "#9ca3af" : "#b91c1c" }}
                          >
                            <TrashSvgIcon />
                          </ToolbarIconButton>

                          <ToolbarIconButton title={t("close")} dataFocusRole="editor-close" onClick={() => clearEditorSelectionAndFocusMain()}>
                            <CloseSvgIcon />
                          </ToolbarIconButton>
                        </div>

                        <h3
                          style={{
                            margin: 0,
                            marginBottom: 6,
                            marginLeft: 6,
                            color: "#1f2937",
                          }}
                        >
                          {t("frameImageEditor")}
                        </h3>

                        <CollapsibleEditorSection sectionKey="frame-image-add-delete" title={t("insertImage")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <ToolbarIconButton
                              title={t("insertImage")}
                              dataFocusRole="editor-insert-image"
                              onClick={() => openImagePickerForFrame(selectedFrame.id)}
                            >
                              <FolderSvgIcon />
                            </ToolbarIconButton>

                            <ToolbarIconButton
                              title={t("deleteImage")}
                              dataFocusRole="editor-delete-image"
                              disabled={!selectedFrameHasImage}
                              onClick={() => {
                                if (!selectedFrameHasImage) return;
                                removeFrameImage(selectedFrame.id);
                              }}
                              style={{ color: selectedFrameHasImage ? "#111827" : "#9ca3af" }}
                            >
                              <TrashSvgIcon />
                            </ToolbarIconButton>
                          </div>
                        </CollapsibleEditorSection>

                        <CollapsibleEditorSection sectionKey="frame-image-move-copy" title={t("imagePosition")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>

                        <div
                          data-frame-image-card="true"
                          data-frame-image-card-id={String(selectedFrame.id)}
                          data-image-position-keep="true"
                          data-image-position-keep-frame-id={String(selectedFrame.id)}
                          data-focus-role={selectedFrameHasImage ? "frame-image-card" : undefined}
                          tabIndex={selectedFrameHasImage ? 0 : -1}
                          role="button"
                          aria-label={t("dragMoveCopyImage")}
                          aria-disabled={!selectedFrameHasImage}
                          draggable={selectedFrameHasImage}
                          onFocus={() => {
                            if (!selectedFrameHasImage) return;
                            activateImagePositionFrameFromEditor(selectedFrame.id);
                          }}
                          onBlur={() => {
                            if (!selectedFrameHasImage) return;
                            keepFrameImageCardSelectedByCanvasPointerRef.current = false;
                          }}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            if (!selectedFrameHasImage) return;

                            // preventDefault すると draggable の画像カードD&D開始が潰れる。
                            // 伝播だけ止めて、クリック時の画像位置モード合流とD&Dを両立する。
                            e.stopPropagation();
                            activateImagePositionFrameFromEditor(selectedFrame.id);
                            setPressedFrameImageCardId(selectedFrame.id);
                          }}
                          onMouseUp={() => {
                            setPressedFrameImageCardId(null);
                          }}
                          onMouseLeave={() => {
                            if (draggingFrameImage?.sourceFrameId === selectedFrame.id) return;
                            setPressedFrameImageCardId(null);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!selectedFrameHasImage) return;
                            activateImagePositionFrameFromEditor(selectedFrame.id);
                          }}
                          onWheelCapture={(e) => {
                            if (!selectedFrameHasImage) return;
                            if (selectedFrameImageCardId !== selectedFrame.id) return;
                            if (e.ctrlKey || e.metaKey) return;

                            e.preventDefault();
                            e.stopPropagation();
                            changeFrameImageScaleByWheel(
                              selectedFrame.id,
                              e.deltaY,
                              !e.shiftKey
                            );
                          }}
                          onDragStart={(e) => {
                            if (!selectedFrameHasImage) {
                              e.preventDefault();
                              return;
                            }

                            handleFrameImageDragStart(e, selectedFrame.id);
                          }}
                          onDragEnd={handleFrameImageDragEnd}
                          title={t("dragMoveCopyImage")}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            border:
                              selectedFrameHasImage &&
                              (selectedFrameImageCardId === selectedFrame.id ||
                                draggingFrameImage?.sourceFrameId === selectedFrame.id ||
                                pressedFrameImageCardId === selectedFrame.id)
                                ? "3px solid #2563eb"
                                : "2px solid #e5e7eb",
                            borderRadius: 12,
                            padding: 0,
                            overflow: "visible",
                            background: selectedFrameHasImage
                              ? selectedFrameImageCardId === selectedFrame.id
                                ? "#ffffff"
                                : "#ffffff"
                              : "#f3f4f6",
                            boxShadow: selectedFrameHasImage
                              ? "0 4px 12px rgba(0,0,0,0.28)"
                              : "none",
                            cursor: selectedFrameHasImage
                              ? draggingFrameImage?.sourceFrameId === selectedFrame.id ||
                                pressedFrameImageCardId === selectedFrame.id
                                ? "grabbing"
                                : "grab"
                              : "default",
                            opacity: selectedFrameHasImage ? 1 : 0.45,
                            userSelect: "none",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              minHeight: selectedFrameHasImage ? 60 : undefined,
                              overflow: "hidden",
                              borderRadius: 10,
                              background: "#f3f4f6",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {selectedFrameHasImage ? (
                              <img
                                src={selectedFrameImageSrc ?? undefined}
                                alt=""
                                draggable={false}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  height: "auto",
                                  maxHeight: 160,
                                  objectFit: "contain",
                                  borderRadius: 8,
                                  background: "#f3f4f6",
                                  pointerEvents: "none",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  minHeight: 96,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#6b7280",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  background: "#f3f4f6",
                                }}
                              >
                                {t("noImage")}
                              </div>
                            )}
                          </div>
                        </div>

                          <div
                            data-image-position-keep="true"
                            data-image-position-keep-frame-id={String(selectedFrame.id)}
                            style={{ marginTop: 10 }}
                          >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              id="mansaku-slider-frame-image-scale"
                              className="mansaku-range-slider"
                              type="range"
                              min={selectedFrameScaleMinPercent}
                              max={selectedFrameScaleMaxPercent}
                              step={1}
                              value={selectedFrameScalePercent ?? selectedFrameScaleMinPercent}
                              disabled={!selectedFrameHasImage}
                              data-image-position-keep="true"
                              data-image-position-keep-frame-id={String(selectedFrame.id)}
                              onPointerDown={() => {
                                if (!selectedFrameHasImage) return;
                                activateImagePositionFrameFromEditor(selectedFrame.id);
                                imageScaleHistoryRef.current = {
                                  pages: clonePages(pagesRef.current),
                                  frameId: selectedFrame.id,
                                  startScale: selectedFrame.imageScale,
                                };
                              }}
                              onChange={(e) => {
                                if (!selectedFrameHasImage) return;
                                changeFrameImageScaleDirect(
                                  selectedFrame.id,
                                  convertFrameImageScalePercentToScale(
                                    selectedFrame,
                                    Number(e.target.value)
                                  ),
                                  { recordHistory: false }
                                );
                              }}
                              onPointerUp={() => {
                                const snapshot = imageScaleHistoryRef.current;
                                imageScaleHistoryRef.current = null;
                                activateImagePositionFrameFromEditor(selectedFrame.id);

                                if (!snapshot) return;
                                if (snapshot.startScale === selectedFrame.imageScale) return;

                                setUndoStack((stack) => pushUndoHistory(stack, createHistorySnapshot(snapshot.pages)));
                                setRedoStack([]);
                              }}
                              onPointerCancel={() => {
                                imageScaleHistoryRef.current = null;
                              }}
                              onFocus={() => setFocusedWheelSliderId("mansaku-slider-frame-image-scale")}
                              onBlur={() =>
                                setFocusedWheelSliderId((current) =>
                                  current === "mansaku-slider-frame-image-scale" ? null : current
                                )
                              }
                              onWheelCapture={(e) => {
                                if (!selectedFrameHasImage || e.ctrlKey || e.metaKey) return;
                                e.preventDefault();
                                e.stopPropagation();
                                changeFrameImageScaleByWheel(
                                  selectedFrame.id,
                                  e.deltaY,
                                  !e.shiftKey
                                );
                              }}
                              style={{ ...sliderInputStyle, flex: 1 }}
                            />

                            <span
                              style={{
                                ...sliderValueLabelStyle,
                                opacity: selectedFrameHasImage ? 1 : 0.45,
                              }}
                            >
                              {selectedFrameScalePercent ?? 100}%
                            </span>
                          </div>
                          </div>

                        </CollapsibleEditorSection>

                        <CollapsibleEditorSection sectionKey="frame-effect-line" title={t("effectLine")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>
                          {(() => {
                            const effectLine = getFrameEffectLineFields(selectedFrame);

                            const updateSelectedFrameEffectLine = (
                              patch:
                                | Partial<ReturnType<typeof getFrameEffectLineFields>>
                                | ((current: ReturnType<typeof getFrameEffectLineFields>) => Partial<ReturnType<typeof getFrameEffectLineFields>>),
                              options?: { recordHistory?: boolean }
                            ) => {
                              const targetFrameIds =
                                selectedFrameIds.length > 1 ? selectedFrameIds : [selectedFrame.id];

                              updateCurrentPage(
                                (page) => ({
                                ...page,
                                frames: page.frames.map((frame) => {
                                  if (!targetFrameIds.includes(frame.id)) return frame;

                                  const current = getFrameEffectLineFields(frame);
                                  const nextPatch =
                                    typeof patch === "function" ? patch(current) : patch;

                                  return {
                                    ...frame,
                                    effectLineEnabled:
                                      nextPatch.enabled ?? current.enabled,
                                    effectLineKind:
                                      nextPatch.kind ?? current.kind,
                                    effectLineColorMode:
                                      nextPatch.colorMode ?? current.colorMode,
                                    effectLineCustomColor:
                                      nextPatch.customColor ?? current.customColor,
                                    effectLineStrokeWidth:
                                      nextPatch.strokeWidth ?? current.strokeWidth,
                                    effectLineDensity:
                                      nextPatch.density ?? current.density,
                                    effectLineInnerBlank:
                                      nextPatch.innerBlank ?? current.innerBlank,
                                    effectLineCenterX:
                                      nextPatch.centerX ?? current.centerX,
                                    effectLineCenterY:
                                      nextPatch.centerY ?? current.centerY,
                                    effectLineAngle:
                                      nextPatch.angle ?? current.angle,
                                  } as Frame;
                                }),
                              }),
                                { recordHistory: options?.recordHistory ?? true }
                              );
                            };

                            const selectedFrames =
                              currentPage?.frames.filter((frame) =>
                                selectedFrameIds.includes(frame.id)
                              ) ?? [];

                            const disabled = selectedFrames.length === 0;

                            const getFrameEffectLineKindIcon = (
                              kind: "none" | FrameEffectLineKind
                            ) => {
                              if (kind === "none") return <NoneSvgIcon />;
                              if (kind === "focus") return <FocusLineSvgIcon />;
                              return <SpeedLineSvgIcon />;
                            };

                            const getFrameEffectLineColorModeIcon = (
                              mode: FrameEffectLineColorMode
                            ) => {
                              if (mode === "white") return <WhiteFillSvgIcon />;
                              if (mode === "black") return <BlackFillSvgIcon />;
                              return <RainbowFillSvgIcon />;
                            };

                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  {(["none", ...FRAME_EFFECT_LINE_KINDS] as const).map((kind) => {
                                    const active =
                                      kind === "none"
                                        ? !effectLine.enabled
                                        : effectLine.enabled && effectLine.kind === kind;

                                    const title =
                                      kind === "none"
                                        ? t("effectLineNone")
                                        : getFrameEffectLineKindLabel(kind, t);

                                    return (
                                      <ToolbarIconButton
                                        key={kind}
                                        title={title}
                                        disabled={disabled}
                                        onClick={() => {
                                          activateFrameEffectLineFromEditor(selectedFrame.id);
                                          if (kind === "none") {
                                            updateSelectedFrameEffectLine({ enabled: false });
                                            return;
                                          }

                                          updateSelectedFrameEffectLine({ enabled: true, kind });
                                        }}
                                        style={{
                                          background: active ? "#e5e7eb" : undefined,
                                        }}
                                      >
                                        {getFrameEffectLineKindIcon(kind)}
                                      </ToolbarIconButton>
                                    );
                                  })}

                                  <ToolbarIconButton
                                    title={t("reset")}
                                    disabled={disabled}
                                    onClick={() =>
                                      updateSelectedFrameEffectLine({
                                        ...FRAME_EFFECT_LINE_DEFAULTS,
                                        enabled: false,
                                      })
                                    }
                                  >
                                    <ResetSvgIcon />
                                  </ToolbarIconButton>
                                </div>

                                {effectLine.enabled && (
                                  <>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700 }}>{t("effectLineBlank")}</span>

                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <input
                                          id="mansaku-slider-frame-effect-line-blank"
                                          className="mansaku-range-slider"
                                          data-effect-line-blank-slider="true"
                                          type="range"
                                          min={0}
                                          max={100}
                                          step={1}
                                          value={effectLine.innerBlank}
                                          disabled={disabled}
                                          onPointerDown={(e) => {
                                            e.currentTarget.focus({ preventScroll: true });
                                            const targetFrameIds =
                                              selectedFrameIds.length > 1 ? selectedFrameIds : [selectedFrame.id];
                                            beginFrameEffectLineSliderHistory(targetFrameIds);
                                          }}
                                          onFocus={() => setFocusedWheelSliderId("mansaku-slider-frame-effect-line-blank")}
                                          onBlur={() =>
                                            setFocusedWheelSliderId((current) =>
                                              current === "mansaku-slider-frame-effect-line-blank" ? null : current
                                            )
                                          }
                                          onChange={(e) => {
                                            updateSelectedFrameEffectLine(
                                              {
                                                enabled: true,
                                                innerBlank: Number(e.target.value),
                                              },
                                              { recordHistory: false }
                                            );
                                            markFrameEffectLineSliderHistoryChanged();
                                          }}
                                          onPointerUp={() => commitFrameEffectLineSliderHistory()}
                                          onPointerCancel={() => cancelFrameEffectLineSliderHistory()}
                                          onWheelCapture={(e) => {
                                            if (disabled || e.ctrlKey || e.metaKey) return;
                                            e.preventDefault();
                                            e.stopPropagation();

                                            const direction = e.deltaY < 0 ? 1 : -1;
                                            const step = e.shiftKey ? 1 : 4;

                                            prepareSliderWheelHistory("frameEffectLine", selectedFrame.id);

                                            updateSelectedFrameEffectLine(
                                              (current) => ({
                                                enabled: true,
                                                innerBlank: clamp(current.innerBlank + direction * step, 0, 100),
                                              }),
                                              { recordHistory: false }
                                            );

                                            markSliderWheelHistoryChanged();
                                          }}
                                          style={{ ...sliderInputStyle, flex: 1 }}
                                        />

                                        <span style={sliderValueLabelStyle}>
                                          {Math.round(effectLine.innerBlank)}%
                                        </span>
                                      </div>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700 }}>{t("effectLineDensity")}</span>

                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <input
                                          id="mansaku-slider-frame-effect-line-density"
                                          className="mansaku-range-slider"
                                          type="range"
                                          min={0}
                                          max={100}
                                          step={1}
                                          value={Math.round(effectLine.density * 100)}
                                          disabled={disabled}
                                          onPointerDown={(e) => {
                                            e.currentTarget.focus({ preventScroll: true });
                                            const targetFrameIds =
                                              selectedFrameIds.length > 1 ? selectedFrameIds : [selectedFrame.id];
                                            beginFrameEffectLineSliderHistory(targetFrameIds);
                                          }}
                                          onFocus={() => setFocusedWheelSliderId("mansaku-slider-frame-effect-line-density")}
                                          onBlur={() =>
                                            setFocusedWheelSliderId((current) =>
                                              current === "mansaku-slider-frame-effect-line-density" ? null : current
                                            )
                                          }
                                          onChange={(e) => {
                                            updateSelectedFrameEffectLine(
                                              {
                                                enabled: true,
                                                density: clamp(Number(e.target.value) / 100, 0, 1),
                                              },
                                              { recordHistory: false }
                                            );
                                            markFrameEffectLineSliderHistoryChanged();
                                          }}
                                          onPointerUp={() => commitFrameEffectLineSliderHistory()}
                                          onPointerCancel={() => cancelFrameEffectLineSliderHistory()}
                                          onWheelCapture={(e) => {
                                            if (disabled || e.ctrlKey || e.metaKey) return;
                                            e.preventDefault();
                                            e.stopPropagation();

                                            const direction = e.deltaY < 0 ? 1 : -1;
                                            const step = e.shiftKey ? 1 : 4;

                                            prepareSliderWheelHistory("frameEffectLine", selectedFrame.id);

                                            updateSelectedFrameEffectLine(
                                              (current) => ({
                                                enabled: true,
                                                density: clamp(current.density + (direction * step) / 100, 0, 1),
                                              }),
                                              { recordHistory: false }
                                            );

                                            markSliderWheelHistoryChanged();
                                          }}
                                          style={{ ...sliderInputStyle, flex: 1 }}
                                        />

                                        <span style={sliderValueLabelStyle}>
                                          {Math.round(effectLine.density * 100)}%
                                        </span>
                                      </div>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700 }}>{t("effectLineStrokeColor")}</span>

                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        {FRAME_EFFECT_LINE_COLOR_MODES.map((mode) => {
                                          const active = effectLine.colorMode === mode;
                                          const title =
                                            mode === "black"
                                              ? t("effectLineColorBlack")
                                              : mode === "white"
                                                ? t("effectLineColorWhite")
                                                : t("effectLineColorCustom");

                                          return (
                                            <ToolbarIconButton
                                              key={mode}
                                              title={title}
                                              disabled={disabled}
                                              onClick={() =>
                                                updateSelectedFrameEffectLine({
                                                  colorMode: mode as FrameEffectLineColorMode,
                                                })
                                              }
                                              style={{
                                                background: active ? "#e5e7eb" : undefined,
                                              }}
                                            >
                                              {getFrameEffectLineColorModeIcon(
                                                mode as FrameEffectLineColorMode
                                              )}
                                            </ToolbarIconButton>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {effectLine.colorMode === "color" && (
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 6,
                                          opacity: disabled ? 0.45 : 1,
                                          pointerEvents: disabled ? "none" : "auto",
                                        }}
                                      >
                                        <span style={{ fontSize: 12, fontWeight: 700 }}>
                                          {t("effectLineColorCustom")}
                                        </span>
                                        <ColorPaletteGrid
                                          value={effectLine.customColor}
                                          onChange={(color) =>
                                            updateSelectedFrameEffectLine({ customColor: color })
                                          }
                                        />
                                      </div>
                                    )}

                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </CollapsibleEditorSection>

                        <CollapsibleEditorSection sectionKey="frame-border-visible" title={t("frameBorderVisible")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>
                          {(() => {
                            const selectedFrames =
                              currentPage?.frames.filter((frame) =>
                                selectedFrameIds.includes(frame.id)
                              ) ?? [];
                            const borderVisible =
                              selectedFrameIds.length > 1
                                ? selectedFrames.length > 0 &&
                                  selectedFrames.every((frame) =>
                                    isFrameBorderSwitchChecked(currentPage, frame)
                                  )
                                : isFrameBorderSwitchChecked(currentPage, selectedFrame);
                            const borderVisibleSwitchDisabled =
                              selectedFrames.length > 0 &&
                              selectedFrames.every((frame) =>
                                currentPage ? isProtectedCoverBaseFrame(currentPage, frame) : false
                              );

                            return (
                              <EditorSwitchButton
                                checked={borderVisible}
                                disabled={borderVisibleSwitchDisabled}
                                onFocus={() => setSuppressFrameSelectionOutlineByBorderSwitch(true)}
                                onBlur={() => setSuppressFrameSelectionOutlineByBorderSwitch(false)}
                                onToggle={() => {
                                  setSuppressFrameSelectionOutlineByBorderSwitch(true);
                                  const targetFrameIds =
                                    selectedFrameIds.length > 1
                                      ? selectedFrameIds
                                      : [selectedFrame.id];
                                  const nextBorderVisible = !borderVisible;

                                  updateCurrentPage((page) => ({
                                    ...page,
                                    frames: page.frames.map((frame) =>
                                      targetFrameIds.includes(frame.id) &&
                                      !isProtectedCoverBaseFrame(page, frame)
                                        ? ({
                                            ...frame,
                                            frameBorderVisible: nextBorderVisible,
                                          } as Frame)
                                        : frame
                                    ),
                                  }));
                                }}
                              />
                            );
                          })()}
                        </CollapsibleEditorSection>

                        <CollapsibleEditorSection sectionKey="frame-overflow" title={t("hideOverflow")} openSectionKey={openEditorSectionKey} setOpenSectionKey={setOpenEditorSectionKey}>
                          {(() => {
                            const selectedFrames =
                              currentPage?.frames.filter((frame) =>
                                selectedFrameIds.includes(frame.id)
                              ) ?? [];
                            const overflowEnabled =
                              selectedFrameIds.length > 1
                                ? selectedFrames.length > 0 &&
                                  selectedFrames.every((frame) => !frame.borderEnabled)
                                : !selectedFrame.borderEnabled;
                            const overflowSwitchDisabled =
                              selectedFrames.length > 0 &&
                              selectedFrames.every((frame) =>
                                currentPage ? isProtectedCoverBaseFrame(currentPage, frame) : false
                              );

                            return (
                              <EditorSwitchButton
                                checked={overflowEnabled}
                                disabled={overflowSwitchDisabled}
                                onFocus={() => setSuppressFrameSelectionOutlineByBorderSwitch(true)}
                                onBlur={() => setSuppressFrameSelectionOutlineByBorderSwitch(false)}
                                onToggle={() => {
                                  setSuppressFrameSelectionOutlineByBorderSwitch(true);
                                  const targetFrameIds =
                                    selectedFrameIds.length > 1
                                      ? selectedFrameIds
                                      : [selectedFrame.id];
                                  const nextOverflowEnabled = !overflowEnabled;

                                  updateCurrentPage((page) => ({
                                    ...page,
                                    frames: page.frames.map((frame) =>
                                      targetFrameIds.includes(frame.id) &&
                                      !isProtectedCoverBaseFrame(page, frame)
                                        ? { ...frame, borderEnabled: !nextOverflowEnabled }
                                        : frame
                                    ),
                                  }));
                                }}
                              />
                            );
                          })()}
                        </CollapsibleEditorSection>
                      </div>
                    )}
                  </>
                </div>
              ) : (
                <div
                  ref={pageListScrollRef}
                  tabIndex={-1}
                  data-focus-area="main"
                  data-focus-layer="page-list"
                  onMouseDown={startPageSelectionBox}
                  onContextMenu={(e) => {
                    const target = e.target as HTMLElement;

                    if (target.closest("[data-page-card='true']")) return;
                    if (target.closest("[data-page-add-card='true']")) return;
                    if (target.closest("[data-page-insert-bar='true']")) return;

                    setSelectedPageIds([]);
                    lastSelectedPageIdRef.current = null;

                    const nearestInsertBar = getNearestInsertBarByMouse(e.clientY);
                    openPageInsertMenu(
                      e,
                      nearestInsertBar.insertIndex,
                      nearestInsertBar.insertBarKey
                    );
                  }}
                  onDragOver={(e) => {
                    if (draggingPageId == null && !draggingTemplateId) return;

                    e.preventDefault();
                    e.stopPropagation();

                    const nearestInsertBar = getNearestInsertBarByMouse(e.clientY);
                    const insertIndex = nearestInsertBar.insertIndex;

                    const isCopy = draggingPageId != null && (e.ctrlKey || e.metaKey);
                    setIsPageDragCopying(isCopy);

                    e.dataTransfer.dropEffect = draggingTemplateId || isCopy ? "copy" : "move";
                    setDragOverPageId(insertIndex);
                    setDragOverInsertBarKey(nearestInsertBar.insertBarKey);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const insertIndex = getNearestInsertIndexByMouse(e.clientY);

                    if (draggingTemplateId) {
                      handleTemplateDropToPageList(insertIndex);
                      return;
                    }

                    handlePageDropToIndex(insertIndex, e.ctrlKey || e.metaKey || isPageDragCopying);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    scrollbarGutter: "stable",
                    padding: "16px 16px 16px 16px",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    position: "relative",
                    userSelect: "none",
                    outline: "none",
                  }}
                >
                  {!hasCovers && contentPageCount > 0 && (
                    <InsertBar insertIndex={1} />
                  )}

                  {!hasCovers && contentPageCount === 0 && (
                    <InsertBar insertIndex={1} positionKey="empty-content" />
                  )}

                  {pageListEntries.map(({ page, index }) => {
                    const isCurrent = page.id === currentPageId;
                    const isSelectedPage = selectedPageIds.includes(page.id);

                    const isPageSelectionBoxActive = pageSelectionBox != null;
                    const isCurrentCanvasPage =
                      activeTargetType === "canvas" && isCurrent;
                    const isPageVisuallySelected =
                      !isPageSelectionBoxActive && (isSelectedPage || isCurrentCanvasPage);

                    const isDragging = page.id === draggingPageId;
                    const isPageVisible = page.visible !== false;
                    const visiblePageNumber = getThumbnailPageLabel(page.id);

                    return (
                      <div key={page.id} style={{ display: "contents" }}>
                        <div
                          ref={(el) => {
                            if (isCurrent) {
                              currentPageCardRef.current = el;
                            }

                            if (el) {
                              pageCardRefs.current.set(page.id, el);
                            } else {
                              pageCardRefs.current.delete(page.id);
                            }
                          }}
                          data-page-list-item="true"
                          data-page-card="true"
                          data-focus-role="page-card"
                          data-current-page={isCurrent ? "true" : undefined}
                          data-selected-page={isSelectedPage ? "true" : undefined}
                          tabIndex={-1}
                          onFocus={() => {
                            if (suppressNextPageCardFocusSelectionRef.current) {
                              suppressNextPageCardFocusSelectionRef.current = false;
                              return;
                            }

                            closeAllFloatingMenus();
                            setMainMode("manga");
                            setActiveTargetType("page");
                            setCurrentPageId(page.id);
                            setSelectedPageIds([page.id]);
                            lastSelectedPageIdRef.current = page.id;
                            setSelectedItems([]);
                          }}
                          style={{
                            outline: "none",
                          }}
                        >
                        <div
                          draggable={!isSpecialCoverPageId(page.id)}
                          onDragStart={(e) => {
                            if (isSpecialCoverPageId(page.id)) {
                              e.preventDefault();
                              e.stopPropagation();
                              return;
                            }

                            e.stopPropagation();
                            e.dataTransfer.effectAllowed = "copyMove";
                            handlePageDragStart(page.id);
                          }}
                          onDragEnd={handlePageDragEnd}
                          onDragOver={(e) => {
                            if (draggingPageId == null && !draggingTemplateId) return;

                            e.preventDefault();
                            e.stopPropagation();

                            const nearestInsertBar = getNearestInsertBarByMouse(e.clientY);
                            const insertIndex = nearestInsertBar.insertIndex;

                            const isCopy = draggingPageId != null && (e.ctrlKey || e.metaKey);
                            setIsPageDragCopying(isCopy);

                            e.dataTransfer.dropEffect = draggingTemplateId || isCopy ? "copy" : "move";
                            setDragOverPageId(insertIndex);
                            setDragOverInsertBarKey(nearestInsertBar.insertBarKey);
                          }}
                          onDragLeave={(e) => {
                            const nextTarget = e.relatedTarget as Node | null;
                            if (nextTarget && e.currentTarget.contains(nextTarget)) return;

                            setDragOverPageId(null);
    setDragOverInsertBarKey(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const insertIndex = getNearestInsertIndexByMouse(e.clientY);

                            if (draggingTemplateId) {
                              handleTemplateDropToPageList(insertIndex);
                              return;
                            }

                            handlePageDropToIndex(insertIndex, e.ctrlKey || e.metaKey || isPageDragCopying);
                          }}
onMouseDown={(e) => {
  if (e.button !== 0) return;

  suppressNextPageCardFocusSelectionRef.current = true;
  setPressedPageCardId(page.id);

  e.stopPropagation();

  if (
    e.ctrlKey ||
    e.metaKey ||
    e.shiftKey ||
    !selectedPageIds.includes(page.id)
  ) {
    selectPageCard(page.id, e);
    return;
  }

  closeAllFloatingMenus();
  setActiveTargetType("page");
  setCurrentPageId(page.id);
  setSelectedItems([]);
}}
onMouseUp={() => {
  setPressedPageCardId(null);
}}
onMouseLeave={() => {
  if (draggingPageId === page.id) return;
  setPressedPageCardId(null);
}}
onClick={(e) => {
  e.stopPropagation();

  if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
    selectPageCard(page.id, e);
  }

  setMainMode("manga");
}}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onContextMenu={(e) => {
                            openPageMenu(e, page.id);
                          }}
                          style={{
                            position: "relative",
                            border: isPageVisuallySelected
                              ? "2px solid #2563eb"
                              : "2px solid #d1d5db",
                            borderRadius: 10,
                            background:
                              draggingPageId === page.id
                                ? "#e2e8f0"
                                : !isPageVisible
                                ? "#e5e7eb"
                                : isSelectedPage
                                ? "#eff6ff"
                                : "#fff",
                            cursor: isSpecialCoverPageId(page.id)
                              ? "default"
                              : draggingPageId === page.id ||
                                pressedPageCardId === page.id
                              ? "grabbing"
                              : "grab",
                            userSelect: "none",
                            boxSizing: "border-box",
                            width: "100%",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
                            overflow: "visible",
                          }}
                        >
                        <ToolbarIconButton
                          title={isPageVisible ? t("exportTarget") : t("excludedFromExport")}
                          dataFocusSkip
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            closeContextMenu();
                            closePageMenu();
                            closePageInsertMenu();
                            closeTopToolbarMenus();

                            setTemplateContextMenu({
                              visible: false,
                              x: 0,
                              y: 0,
                              templateId: null,
                              key: 0,
                            });

                            skipPageListAutoScrollRef.current = true;
                            handleTogglePageVisible(page.id);
                            focusPageListAfterPageMenuAction();
                          }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              height: 22,
                              minWidth: 22,
                              width: isPageVisible && visiblePageNumber != null ? "auto" : 22,
                              padding: isPageVisible && visiblePageNumber != null ? "0 6px" : 0,
                              maxWidth: "calc(100% - 28px)",
                              borderRadius: 999,
                              border: "1px solid rgba(203,213,225,0.95)",
                              background: "rgba(255,255,255,0.92)",
                              color: "#64748b",
                              fontSize: 12,
                              fontWeight: 600,
                              lineHeight: "20px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              boxShadow: "none",
                              transform: "translate(-11px, -50%)",
                              zIndex: 5,
                              boxSizing: "border-box",
                            }}
                          >
                            {isPageVisible && visiblePageNumber != null ? (
                              <span
                                style={{
                                  display: "block",
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {visiblePageNumber}
                              </span>
                            ) : (
                              <PageVisibleSvgIcon visible={false} />
                            )}
                          </ToolbarIconButton>

                          <div
                            style={{
                              opacity: isDragging ? 0.6 : !isPageVisible ? 0.55 : 1,
                            }}
                          >
                            <PageCardThumbnail
                              page={page}
                              renderPageCanvas={renderPageCanvas}
                              PAGE_WIDTH={PAGE_WIDTH}
                              PAGE_HEIGHT={PAGE_HEIGHT}
                            />
                          </div>
                        </div>

                        {index + 1 < pages.length && (
                          <InsertBar
                            insertIndex={
                              hasCovers && contentPageCount === 0 && isCoverPageIdValue(page.id)
                                ? 1
                                : index + 1
                            }
                            positionKey={
                              hasCovers && contentPageCount === 0 && isCoverPageIdValue(page.id)
                                ? "cover-empty-before-add"
                                : undefined
                            }
                          />
                        )}
                      </div>

                        {false && hasCovers && contentPageCount === 0 && isCoverPageIdValue(page.id) && (
                          <>
                            <div
                              key="page-add-card-first"
                              data-page-list-item="true"
                              data-page-add-card="true"
                              style={{ outline: "none", boxSizing: "border-box" }}
                            >
                              <div
                                className="mansaku-page-add-card"
                                style={{
                                  position: "relative",
                                  border: "2px dashed #94a3b8",
                                  borderRadius: 10,
                                  background: "rgba(255,255,255,0.62)",
                                  color: "#334155",
                                  boxSizing: "border-box",
                                  width: "100%",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.16)",
                                  overflow: "visible",
                                }}
                              >
                                <PageAddCardThumbnail PAGE_WIDTH={PAGE_WIDTH} PAGE_HEIGHT={PAGE_HEIGHT}>
                                  {null}
                                </PageAddCardThumbnail>

                                <button
                                  ref={emptyPageAddButtonRef}
                                  type="button"
                                  data-focus-role="empty-page-add"
                                  onMouseDown={(e) => {
                                    if (e.button !== 0) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveTargetType("page");
                                    setSelectedPageIds([]);
                                    lastSelectedPageIdRef.current = null;
                                    setSelectedItems([]);
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleInsertPageAt(1);
                                    setMainMode("manga");
                                  }}
                                  style={{
                                    all: "unset",
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    color: "inherit",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    fontSize: 14,
                                    fontWeight: 800,
                                    boxSizing: "border-box",
                                    userSelect: "none",
                                  }}
                                >
                                  <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">＋</span>
                                  <span>{t("addPage")}</span>
                                </button>
                              </div>

                              <InsertBar insertIndex={1} positionKey="cover-empty-after-add" />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {pageSelectionBox && (
                    <div
                      style={{
                        position: "absolute",
                        left: Math.min(pageSelectionBox.startX, pageSelectionBox.currentX),
                        top: Math.min(pageSelectionBox.startY, pageSelectionBox.currentY),
                        width: Math.abs(pageSelectionBox.currentX - pageSelectionBox.startX),
                        height: Math.abs(pageSelectionBox.currentY - pageSelectionBox.startY),
                        background: "rgba(37, 99, 235, 0.14)",
                        border: "1px solid rgba(37, 99, 235, 0.75)",
                        pointerEvents: "none",
                        zIndex: 9999,
                      }}
                    />
                  )}
                </div>
              )}
            </aside>

            <main
              ref={mainAreaRef}
              data-focus-area="main"
              data-focus-layer="canvas"
              data-focus-flash-area="right"
              tabIndex={-1}
              onMouseDown={(e) => {
                if (mainMode !== "manga") return;
                if (e.button !== 0) return;

                const target = e.target as HTMLElement | null;


                focusTrapRef.current?.focus({ preventScroll: true });

                if (
                  target?.closest("button") ||
                  target?.closest("input") ||
                  target?.closest("textarea") ||
                  target?.closest("select") ||
                  target?.closest("[data-page-canvas='true']")
                ) {
                  return;
                }

                const additive = e.ctrlKey || e.metaKey || e.shiftKey;

                setActiveTargetType("canvas");
                setSelectedPageIds([]);

                if (!startSelectionBox(e, additive)) {
                  if (!additive) {
                    clearSelection();
                  }

                  closeContextMenu();
                  return;
                }

                if (!additive) {
                  clearSelection();
                }

                closeContextMenu();
                setPastePointAtMouse(e);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                overflow: "auto",
                position: "relative",
                background: "#e5e7eb",
                outline: "none",
              }}
            >
              {mainMode === "template" ? (
                <TemplateListView
                  renderPageCanvas={renderPageCanvas}
                  handleTemplateDragStart={handleTemplateDragStart}
                  handleTemplateDragEnd={handleTemplateDragEnd}
                  handleTemplateAddClick={handleTemplateAddClick}
                  setTemplateContextMenu={setTemplateContextMenu}
                  selectedTemplateId={selectedTemplateId}
                  setSelectedTemplateId={setSelectedTemplateId}
                  closeAllFloatingMenus={closeAllFloatingMenus}
                  draggingTemplateId={draggingTemplateId}
                  templateCardWidth={sharedPageCardWidth}
                  t={t}
                />
              ) : (
                (() => {
                  const page = currentPage;
                  if (!page) return null;
                  return (
                    <div
                      onContextMenu={(e) => {
                        const target = e.target as HTMLElement | null;

                        if (target?.closest("[data-page-canvas='true']")) {
                          return;
                        }

                        openContextMenu(e, { kind: "canvas" });
                      }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;

                        const target = e.target as HTMLElement | null;

                        if (
                          target?.closest("button") ||
                          target?.closest("input") ||
                          target?.closest("textarea") ||
                          target?.closest("select")
                        ) {
                          return;
                        }

                        const additive = e.ctrlKey || e.metaKey || e.shiftKey;

                        setActiveTargetType("canvas");
                        setSelectedPageIds([]);

                        if (!startSelectionBox(e, additive)) {
                          if (!additive) {
                            clearSelection();
                          }

                          closeContextMenu();
                          return;
                        }

                        if (!additive) {
                          clearSelection();
                        }

                        closeContextMenu();
                        setPastePointAtMouse(e);
                      }}
                    >
                      <div
                        style={{
                          width: PAGE_WIDTH * previewZoom,
                          height: PAGE_HEIGHT * previewZoom,
                          position: "relative",
                          margin: "0 auto",
                        }}
                      >
                        <div
                          ref={pageRef}
                          onMouseMove={handlePageMouseMove}
                          style={{
                            width: PAGE_WIDTH,
                            height: PAGE_HEIGHT,
                            position: "absolute",
                            left: 0,
                            top: 0,
                            transform: `scale(${previewZoom})`,
                            transformOrigin: "top left",
                          }}
                        >
                          {renderPageCanvas(page, false)}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </main>

      </div>

      <div
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        {exportablePages.map((page) => (
          <div
            key={page.id}
            ref={(el) => {
              exportRefs.current[page.id] = el;
            }}
          >
            {renderPageCanvas(page, true)}
          </div>
        ))}
      </div>

      {(() => {
        if (!contextMenu.visible) return null;

        const bubbleTarget =
          contextMenu.target?.kind === "bubble" ? contextMenu.target : null;

        const soundTarget =
          contextMenu.target?.kind === "sound" ? contextMenu.target : null;

        const frameTarget =
          contextMenu.target?.kind === "frame" ? contextMenu.target : null;

        const contextMenuBubble =
          bubbleTarget
            ? currentPage?.bubbles.find((b) => b.id === bubbleTarget.id) ?? null
            : null;

        const contextMenuSound =
          soundTarget
            ? currentPage?.sounds.find((s) => s.id === soundTarget.id) ?? null
            : null;

        const contextMenuFrame =
          frameTarget
            ? currentPage?.frames.find((f) => f.id === frameTarget.id) ?? null
            : null;

        const isSingleFrameContext = selectedFrameIds.length === 1;
        const isProtectedFrameContext = isProtectedCoverBaseFrame(currentPage, contextMenuFrame);
        const selectedFrameIdsContainProtectedCoverBase = selectedFrameIds.some((id) => {
          const frame = currentPage?.frames.find((item) => item.id === id);
          return isProtectedCoverBaseFrame(currentPage, frame);
        });

        const canMergeFrames =
          !selectedFrameIdsContainProtectedCoverBase &&
          canMergeSelectedFrames(currentPage, selectedFrameIds);

        const canSplitV2 = contextMenuFrame && !isProtectedFrameContext
          ? canSplitFrameVertical(contextMenuFrame, 2)
          : false;

        const canSplitH2 = contextMenuFrame && !isProtectedFrameContext
          ? canSplitFrameHorizontal(contextMenuFrame, 2)
          : false;

        const canUseSplitMenu = !isProtectedFrameContext && isSingleFrameContext && (canSplitH2 || canSplitV2);

        const isCanvasTarget = contextMenu.target?.kind === "canvas";

        const menuButtonStyle: React.CSSProperties = {
          display: "flex",
          alignItems: "center",
          width: "100%",
          border: "none",
          background: "transparent",
          textAlign: "left",
          padding: "8px 12px",
          borderRadius: 6,
          cursor: "pointer",
        };

        const getStickySubmenuVisibilityStyle = (
          key:
            | "frame-layer"
            | "bubble-layer"
            | "sound-layer"
            | "bubble-type"
            | "sound-color"
        ) =>
          stickySubmenuKey === key
            ? {
                opacity: 1 as const,
                visibility: "visible" as const,
                pointerEvents: "auto" as const,
              }
            : {};

        const contextMenuPositionKey =
          contextMenu.target?.kind === "canvas"
            ? "canvas"
            : contextMenu.target?.kind === "frame"
            ? `frame-${contextMenu.target.id}`
            : contextMenu.target?.kind === "bubble"
            ? `bubble-${contextMenu.target.id}`
            : contextMenu.target?.kind === "sound"
            ? `sound-${contextMenu.target.id}`
            : "none";

        return (
          <ContextMenuLayer
            visible={contextMenu.visible}
            x={contextMenu.x}
            y={contextMenu.y}
            positionKey={contextMenuPositionKey}
            onFocusCapture={clearContextMenuSubmenuIfFocusMovesToPlainItem}
          >
            {isCanvasTarget && (
              <>
                <ContextMenuButton
                  onClick={() => {
                    setShowPageNumbers((prev) => !prev);
                    closeContextMenuAndFocusReturnTarget(contextMenu.target);
                  }}
                  style={{
                    ...menuButtonStyle,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{t("showPageNumbers")}</span>
                  <span style={{ opacity: showPageNumbers ? 1 : 0 }}>
                    <CheckSvgIcon />
                  </span>
                </ContextMenuButton>

                {contextMenu.pageXPercent != null && contextMenu.pageYPercent != null && (
                  <ContextMenuButton
                    disabled={!hasClipboardContent}
                    onClick={() => {
                      if (
                        contextMenu.pageXPercent == null ||
                        contextMenu.pageYPercent == null
                      ) {
                        return;
                      }

                      handlePasteSelection({
                        xPercent: contextMenu.pageXPercent,
                        yPercent: contextMenu.pageYPercent,
                      });
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    style={{
                      ...menuButtonStyle,
                      cursor: hasClipboardContent ? "pointer" : "default",
                      opacity: hasClipboardContent ? 1 : 0.45,
                    }}
                  >
                    {getClipboardPasteLabel()}
                  </ContextMenuButton>
                )}
              </>
            )}

              {frameTarget && contextMenuFrame && isProtectedFrameContext && (
                <>
                  <ContextMenuButton
                    onClick={() => {
                      if (
                        contextMenu.pageXPercent == null ||
                        contextMenu.pageYPercent == null
                      ) {
                        return;
                      }

                      handlePasteSelection({
                        xPercent: contextMenu.pageXPercent,
                        yPercent: contextMenu.pageYPercent,
                      });
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    disabled={
                      !hasClipboardContent ||
                      contextMenu.pageXPercent == null ||
                      contextMenu.pageYPercent == null
                    }
                    style={{
                      ...menuButtonStyle,
                      cursor:
                        hasClipboardContent &&
                        contextMenu.pageXPercent != null &&
                        contextMenu.pageYPercent != null
                          ? "pointer"
                          : "default",
                      opacity:
                        hasClipboardContent &&
                        contextMenu.pageXPercent != null &&
                        contextMenu.pageYPercent != null
                          ? 1
                          : 0.45,
                    }}
                  >
                    {getClipboardPasteLabel()}
                  </ContextMenuButton>
                </>
              )}

              {frameTarget && contextMenuFrame && !isProtectedFrameContext && (
                <>
                  <>
                    <div
                      className="split-menu-wrap"
                      onPointerMove={(e) => {
                        if (!canUseSplitMenu) return;
                        setContextMenuMouseInputMode();
                        setContextMenuMouseInputModeByPointerMove(e.nativeEvent);
                        setStickySubmenuKey("frame-split");
                      }}
                      onFocusCapture={() => {
                        if (!canUseSplitMenu) return;
                        setStickySubmenuKey("frame-split");
                      }}
                      style={{ position: "relative" }}
                    >
                      <ContextMenuButton
                        disabled={!canUseSplitMenu}
                        disablePressEffect
                        style={{
                          ...menuButtonStyle,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          cursor: canUseSplitMenu ? "pointer" : "default",
                          opacity: canUseSplitMenu ? 1 : 0.45,
                        }}
                      >
                        <span>{t("split")}</span>
                        <span style={{ fontSize: 12, opacity: canUseSplitMenu ? 1 : 0.45 }}>
                          <TriangleSvgIcon direction="right" />
                        </span>
                      </ContextMenuButton>

                      <ContextSubmenu
                        visible={canUseSplitMenu && stickySubmenuKey === "frame-split"}
                        minWidth={150}
                      >
                        <ContextMenuButton
                          disabled={!canSplitH2}
                          onClick={() => {
                            if (!canSplitH2) return;
                            handleSplitFrameByAxis(frameTarget.id, "horizontal");
                            closeContextMenuAndFocusReturnTarget(contextMenu.target);
                          }}
                          style={{
                            ...menuButtonStyle,
                            cursor: canSplitH2 ? "pointer" : "default",
                            opacity: canSplitH2 ? 1 : 0.45,
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <SplitIcon direction="vertical" />
                            <span>{t("splitHorizontalTwo")}</span>
                          </span>
                        </ContextMenuButton>

                        <ContextMenuButton
                          disabled={!canSplitV2}
                          onClick={() => {
                            if (!canSplitV2) return;
                            handleSplitFrameByAxis(frameTarget.id, "vertical");
                            closeContextMenuAndFocusReturnTarget(contextMenu.target);
                          }}
                          style={{
                            ...menuButtonStyle,
                            cursor: canSplitV2 ? "pointer" : "default",
                            opacity: canSplitV2 ? 1 : 0.45,
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <SplitIcon direction="horizontal" />
                            <span>{t("splitVerticalTwo")}</span>
                          </span>
                        </ContextMenuButton>
                      </ContextSubmenu>
                    </div>

                    <ContextMenuButton
                      disabled={!canMergeFrames}
                      onClick={() => {
                        if (!canMergeFrames) return;
                        mergeSelectedFrames();
                      }}
                      style={{
                        ...menuButtonStyle,
                        cursor: canMergeFrames ? "pointer" : "default",
                        opacity: canMergeFrames ? 1 : 0.45,
                      }}
                    >
                      {t("merge")}
                    </ContextMenuButton>

                    <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />
                  </>

                  <div
                    className="split-menu-wrap"
                    onPointerMove={(e) => {
                      setContextMenuMouseInputMode();
                      setContextMenuMouseInputModeByPointerMove(e.nativeEvent);
                      setStickySubmenuKey("frame-layer");
                    }}
                    onFocusCapture={() => {
                      setStickySubmenuKey("frame-layer");
                    }}
                    style={{ position: "relative" }}
                  >
                    <ContextMenuButton
                        disablePressEffect
                      style={{
                        ...menuButtonStyle,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{t("layerOrder")}</span>
                      <span style={{ fontSize: 12 }}>
                        <TriangleSvgIcon direction="right" />
                      </span>
                    </ContextMenuButton>

                    <ContextSubmenu
                      visible={stickySubmenuKey === "frame-layer"}
                      minWidth={150}
                    >
                      <ContextMenuButton
                        onClick={() => {
                          const targetId =
                            selectedFrameIds.length > 1
                              ? getTopmostSelectedFrameId()
                              : contextMenuFrame.id;

                          if (targetId != null) bringFrameToFront(targetId);
                          setStickySubmenuKey("frame-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="front" />
                            <ArrowSvgIcon direction="up" />
                          </span>
                          <span>{t("bringToFront")}</span>
                        </span>
                      </ContextMenuButton>

                      <ContextMenuButton
                        onClick={() => {
                          const targetId =
                            selectedFrameIds.length > 1
                              ? getTopmostSelectedFrameId()
                              : contextMenuFrame.id;

                          if (targetId != null) moveFrameLayerBy(targetId, "forward");
                          setStickySubmenuKey("frame-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="forward" />
                            <ArrowSvgIcon direction="up" />
                          </span>
                          <span>{t("bringForward")}</span>
                        </span>
                      </ContextMenuButton>

                      <ContextMenuButton
                        onClick={() => {
                          const targetId =
                            selectedFrameIds.length > 1
                              ? getTopmostSelectedFrameId()
                              : contextMenuFrame.id;

                          if (targetId != null) moveFrameLayerBy(targetId, "backward");
                          setStickySubmenuKey("frame-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="backward" />
                            <ArrowSvgIcon direction="down" />
                          </span>
                          <span>{t("sendBackward")}</span>
                        </span>
                      </ContextMenuButton>

                      <ContextMenuButton
                        onClick={() => {
                          const targetId =
                            selectedFrameIds.length > 1
                              ? getTopmostSelectedFrameId()
                              : contextMenuFrame.id;

                          if (targetId != null) sendFrameToBack(targetId);
                          setStickySubmenuKey("frame-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="back" />
                            <ArrowSvgIcon direction="down" />
                          </span>
                          <span>{t("sendToBack")}</span>
                        </span>
                      </ContextMenuButton>
                    </ContextSubmenu>
                  </div>

                  <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />

                  <ContextMenuButton
                    disabled={selectedFrameIdsContainProtectedCoverBase}
                    onClick={() => {
                      if (selectedFrameIdsContainProtectedCoverBase) return;
                      handleCutSelection();
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    style={{
                      ...menuButtonStyle,
                      opacity: selectedFrameIdsContainProtectedCoverBase ? 0.45 : 1,
                    }}
                  >
                    {t("cut")}
                  </ContextMenuButton>

                  <ContextMenuButton
                    disabled={selectedFrameIdsContainProtectedCoverBase}
                    onClick={() => {
                      if (selectedFrameIdsContainProtectedCoverBase) return;
                      handleCopySelection();
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    style={{
                      ...menuButtonStyle,
                      opacity: selectedFrameIdsContainProtectedCoverBase ? 0.45 : 1,
                    }}
                  >
                    {t("copy")}
                  </ContextMenuButton>

                  <ContextMenuButton
                    onClick={() => {
                      if (
                        contextMenu.pageXPercent == null ||
                        contextMenu.pageYPercent == null
                      ) {
                        return;
                      }

                      handlePasteSelection({
                        xPercent: contextMenu.pageXPercent,
                        yPercent: contextMenu.pageYPercent,
                      });
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    disabled={
                      !hasClipboardContent ||
                      contextMenu.pageXPercent == null ||
                      contextMenu.pageYPercent == null
                    }
                    style={{
                      ...menuButtonStyle,
                      cursor:
                        hasClipboardContent &&
                        contextMenu.pageXPercent != null &&
                        contextMenu.pageYPercent != null
                          ? "pointer"
                          : "default",
                      opacity:
                        hasClipboardContent &&
                        contextMenu.pageXPercent != null &&
                        contextMenu.pageYPercent != null
                          ? 1
                          : 0.45,
                    }}
                  >
                    {getClipboardPasteLabel()}
                  </ContextMenuButton>

                  <ContextMenuButton
                    disabled={selectedFrameIdsContainProtectedCoverBase}
                    onClick={() => {
                      if (selectedFrameIdsContainProtectedCoverBase) return;

                      if (selectedFrameIds.length > 1) {
                        handleDeleteSelectedFrames();
                      } else {
                        handleDeleteFrame(contextMenuFrame.id);
                      }

                      closeContextMenuAndFocusReturnTarget(null);
                    }}
                    style={{
                      ...menuButtonStyle,
                      color: "#b91c1c",
                      opacity: selectedFrameIdsContainProtectedCoverBase ? 0.45 : 1,
                    }}
                  >
                    {t("delete")}
                  </ContextMenuButton>
                </>
              )}

              {bubbleTarget && (
                <>


<div
                    className="split-menu-wrap"
                    onPointerMove={(e) => {
                      setContextMenuMouseInputMode();
                      setContextMenuMouseInputModeByPointerMove(e.nativeEvent);
                      setStickySubmenuKey("bubble-layer");
                    }}
                    onFocusCapture={() => {
                      setStickySubmenuKey("bubble-layer");
                    }}
                    style={{ position: "relative" }}
                  >
                    <ContextMenuButton
                        disablePressEffect
                      style={{
                        ...menuButtonStyle,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{t("layerOrder")}</span>
                      <span style={{ fontSize: 12 }}>
                        <TriangleSvgIcon direction="right" />
                      </span>
                    </ContextMenuButton>

                    <ContextSubmenu
                      visible={stickySubmenuKey === "bubble-layer"}
                      minWidth={150}
                    >
                      <ContextMenuButton
                        onClick={() => {
                          bringBubbleToFront(bubbleTarget.id);
                          setStickySubmenuKey("bubble-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="front" />
                            <ArrowSvgIcon direction="up" />
                          </span>
                          <span>{t("bringToFront")}</span>
                        </span>
                      </ContextMenuButton>

                      <ContextMenuButton
                        onClick={() => {
                          moveBubbleLayerBy(bubbleTarget.id, "forward");
                          setStickySubmenuKey("bubble-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="forward" />
                            <ArrowSvgIcon direction="up" />
                          </span>
                          <span>{t("bringForward")}</span>
                        </span>
                      </ContextMenuButton>

                      <ContextMenuButton
                        onClick={() => {
                          moveBubbleLayerBy(bubbleTarget.id, "backward");
                          setStickySubmenuKey("bubble-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="backward" />
                            <ArrowSvgIcon direction="down" />
                          </span>
                          <span>{t("sendBackward")}</span>
                        </span>
                      </ContextMenuButton>

                      <ContextMenuButton
                        onClick={() => {
                          sendBubbleToBack(bubbleTarget.id);
                          setStickySubmenuKey("bubble-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="back" />
                            <ArrowSvgIcon direction="down" />
                          </span>
                          <span>{t("sendToBack")}</span>
                        </span>
                      </ContextMenuButton>
                    </ContextSubmenu>
                  </div>

                  <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />

                  <ContextMenuButton
                    onClick={() => {
                      handleCutSelection();
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    style={menuButtonStyle}
                  >
                    {t("cut")}
                  </ContextMenuButton>

                  <ContextMenuButton
                    onClick={() => {
                      handleCopySelection();
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    style={menuButtonStyle}
                  >
                    {t("copy")}
                  </ContextMenuButton>

                  <ContextMenuButton
                    onClick={() => {
                      if (contextMenu.pageXPercent == null || contextMenu.pageYPercent == null) {
                        return;
                      }

                      handlePasteSelection({
                        xPercent: contextMenu.pageXPercent,
                        yPercent: contextMenu.pageYPercent,
                      });
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    disabled={
                      !hasClipboardContent ||
                      contextMenu.pageXPercent == null ||
                      contextMenu.pageYPercent == null
                    }
                    style={{
                      ...menuButtonStyle,
                      cursor:
                        hasClipboardContent &&
                        contextMenu.pageXPercent != null &&
                        contextMenu.pageYPercent != null
                          ? "pointer"
                          : "default",
                      opacity:
                        hasClipboardContent &&
                        contextMenu.pageXPercent != null &&
                        contextMenu.pageYPercent != null
                          ? 1
                          : 0.45,
                    }}
                  >
                    {getClipboardPasteLabel()}
                  </ContextMenuButton>

                  <ContextMenuButton
                    onClick={() => {
                      handleDeleteSelection();
                      closeContextMenuAndFocusReturnTarget(null);
                    }}
                    style={{
                      ...menuButtonStyle,
                      color: "#b91c1c",
                    }}
                  >
                    {t("delete")}
                  </ContextMenuButton>
                </>
              )}

              {soundTarget && contextMenuSound && (
                <>
<div
                    className="split-menu-wrap"
                    onPointerMove={(e) => {
                      setContextMenuMouseInputMode();
                      setContextMenuMouseInputModeByPointerMove(e.nativeEvent);
                      setStickySubmenuKey("sound-layer");
                    }}
                    onFocusCapture={() => {
                      setStickySubmenuKey("sound-layer");
                    }}
                    style={{ position: "relative" }}
                  >
                    <ContextMenuButton
                        disablePressEffect
                      style={{
                        ...menuButtonStyle,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{t("layerOrder")}</span>
                      <span style={{ fontSize: 12 }}>
                        <TriangleSvgIcon direction="right" />
                      </span>
                    </ContextMenuButton>

                    <ContextSubmenu visible={stickySubmenuKey === "sound-layer"} minWidth={150}>
                      <ContextMenuButton
                        onClick={() => {
                          bringSoundToFront(soundTarget.id);
                          setStickySubmenuKey("sound-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="front" />
                            <ArrowSvgIcon direction="up" />
                          </span>
                          <span>{t("bringToFront")}</span>
                        </span>
                      </ContextMenuButton>

                      <ContextMenuButton
                        onClick={() => {
                          moveSoundLayerBy(soundTarget.id, "forward");
                          setStickySubmenuKey("sound-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="forward" />
                            <ArrowSvgIcon direction="up" />
                          </span>
                          <span>{t("bringForward")}</span>
                        </span>
                      </ContextMenuButton>

                      <ContextMenuButton
                        onClick={() => {
                          moveSoundLayerBy(soundTarget.id, "backward");
                          setStickySubmenuKey("sound-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="backward" />
                            <ArrowSvgIcon direction="down" />
                          </span>
                          <span>{t("sendBackward")}</span>
                        </span>
                      </ContextMenuButton>

                      <ContextMenuButton
                        onClick={() => {
                          sendSoundToBack(soundTarget.id);
                          setStickySubmenuKey("sound-layer");
                        }}
                        style={menuButtonStyle}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <LayerOrderSvgIcon type="back" />
                            <ArrowSvgIcon direction="down" />
                          </span>
                          <span>{t("sendToBack")}</span>
                        </span>
                      </ContextMenuButton>
                    </ContextSubmenu>
                  </div>

                  <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />

                  <ContextMenuButton
                    onClick={() => {
                      handleCutSelection();
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    style={menuButtonStyle}
                  >
                    {t("cut")}
                  </ContextMenuButton>

                  <ContextMenuButton
                    onClick={() => {
                      handleCopySelection();
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    style={menuButtonStyle}
                  >
                    {t("copy")}
                  </ContextMenuButton>

                  <ContextMenuButton
                    onClick={() => {
                      if (contextMenu.pageXPercent == null || contextMenu.pageYPercent == null) {
                        return;
                      }

                      handlePasteSelection({
                        xPercent: contextMenu.pageXPercent,
                        yPercent: contextMenu.pageYPercent,
                      });
                      closeContextMenuAndFocusReturnTarget(contextMenu.target);
                    }}
                    disabled={
                      !hasClipboardContent ||
                      contextMenu.pageXPercent == null ||
                      contextMenu.pageYPercent == null
                    }
                    style={{
                      ...menuButtonStyle,
                      cursor:
                        hasClipboardContent &&
                        contextMenu.pageXPercent != null &&
                        contextMenu.pageYPercent != null
                          ? "pointer"
                          : "default",
                      opacity:
                        hasClipboardContent &&
                        contextMenu.pageXPercent != null &&
                        contextMenu.pageYPercent != null
                          ? 1
                          : 0.45,
                    }}
                  >
                    {getClipboardPasteLabel()}
                  </ContextMenuButton>

                  <ContextMenuButton
                    onClick={() => {
                      handleDeleteSound(contextMenuSound.id);
                      closeContextMenuAndFocusReturnTarget(null);
                    }}
                    style={{
                      ...menuButtonStyle,
                      color: "#b91c1c",
                    }}
                  >
                    {t("delete")}
                  </ContextMenuButton>
                </>
              )}

          </ContextMenuLayer>
        );
      })()}
      
      {templateContextMenu.visible && (
        <ContextMenuLayer
          visible={templateContextMenu.visible}
          x={templateContextMenu.x}
          y={templateContextMenu.y}
          positionKey={`template-${templateContextMenu.key}`}
        >
          <ContextMenuButton
            onClick={() => {
              const templateId = templateContextMenu.templateId;

              if (templateId) {
                handleTemplateAddClick(templateId);
              }

              setTemplateContextMenu((prev) => ({
                ...prev,
                visible: false,
              }));
              focusTemplateAfterTemplateMenuAction(templateId);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              textAlign: "left",
              padding: "9px 12px",
              border: "none",
              borderRadius: 8,
              background: "transparent",
              cursor: "pointer",
              color: "#111827",
              fontWeight: 400,
              fontSize: 13,
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          >
            <span>{t("addPage")}</span>
          </ContextMenuButton>
        </ContextMenuLayer>
      )}

      {pageInsertMenu.visible && (() => {
        const hasPageClipboard = !!pageClipboard && pageClipboard.pages.length > 0;

        const pageMenuButtonStyle: React.CSSProperties = {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          textAlign: "left",
          padding: "9px 12px",
          border: "none",
          borderRadius: 8,
          background: "transparent",
          cursor: "pointer",
          color: "#111827",
          fontWeight: 400,
          fontSize: 13,
          fontFamily: "inherit",
          boxSizing: "border-box",
        };

        return (
          <ContextMenuLayer
            visible={pageInsertMenu.visible}
            x={pageInsertMenu.x}
            y={pageInsertMenu.y}
            positionKey={`page-insert-${pageInsertMenu.insertIndex}`}
          >
            <ContextMenuButton
              onClick={() => {
                toggleCovers();
                closePageInsertMenu();
              }}
            >
              <span>{t("hasCovers")}</span>
              <span style={{ opacity: hasCovers ? 1 : 0 }}>
                <CheckSvgIcon />
              </span>
            </ContextMenuButton>

            <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />

            <ContextMenuButton
              disabled={!hasPageClipboard}
              onClick={() => {
                if (!hasPageClipboard) return;

                handlePastePagesAt(pageInsertMenu.insertIndex);
                closePageInsertMenu();
              }}
              style={{
                opacity: hasPageClipboard ? 1 : 0.45,
              }}
            >
              <span>{t("paste")}</span>
            </ContextMenuButton>
          </ContextMenuLayer>
        );
      })()}

      {pageMenu.visible && pageMenu.pageId != null && (() => {
        const menuPage = pages.find((page) => page.id === pageMenu.pageId);
        if (!menuPage) return null;

        const pageMenuTargetIds = getPageMenuTargetIds(pageMenu.pageId);
        const isAllPageMenuTargetsOutputExcluded =
          pageMenuTargetIds.length > 0 &&
          pageMenuTargetIds.every((pageId) => {
            const page = pages.find((item) => item.id === pageId);
            return page?.visible === false;
          });
        const hasPageClipboard = !!pageClipboard && pageClipboard.pages.length > 0;
        const hasEditablePageMenuTargets = pageMenuTargetIds.some((pageId) => !isSpecialCoverPageId(pageId));
        const isSpecialPageMenuTarget = isSpecialCoverPageId(pageMenu.pageId);

        return (
          <ContextMenuLayer
            visible={pageMenu.visible}
            x={pageMenu.x}
            y={pageMenu.y}
            positionKey={`page-${pageMenu.pageId}`}
          >
            <ContextMenuButton
              onClick={() => {
                const nextVisible = isAllPageMenuTargetsOutputExcluded;
                const targetIdSet = new Set(pageMenuTargetIds);

                setPages((prev) =>
                  sanitizeProjectPagesForState(
                    prev.map((page) =>
                      targetIdSet.has(page.id)
                        ? {
                            ...page,
                            visible: nextVisible,
                          }
                        : page
                    )
                  )
                );

                setHasUnsavedChanges(true);
                closePageMenu();
                focusPageListAfterPageMenuAction();
              }}
            >
              <span>{t("excludeFromExport")}</span>
              <span style={{ opacity: isAllPageMenuTargetsOutputExcluded ? 1 : 0 }}>
                <CheckSvgIcon />
              </span>
            </ContextMenuButton>

            <ContextMenuButton
              onClick={() => {
                toggleCovers();
                closePageMenu();
                focusPageListAfterPageMenuAction();
              }}
            >
              <span>{t("hasCovers")}</span>
              <span style={{ opacity: hasCovers ? 1 : 0 }}>
                <CheckSvgIcon />
              </span>
            </ContextMenuButton>

            <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />

            {!isSpecialPageMenuTarget && (
              <>
                <ContextMenuButton
                  disabled={!hasEditablePageMenuTargets}
                  onClick={() => handleCutPages(pageMenu.pageId!)}
                  style={{ opacity: hasEditablePageMenuTargets ? 1 : 0.45 }}
                >
                  <span>{t("cut")}</span>
                </ContextMenuButton>

                <ContextMenuButton
                  onClick={() => handleCopyPages(pageMenu.pageId!)}
                >
                  <span>{t("copy")}</span>
                </ContextMenuButton>
              </>
            )}

            <ContextMenuButton
              disabled={!hasPageClipboard}
              onClick={() => handlePastePagesAfter(pageMenu.pageId!)}
              style={{
                opacity: hasPageClipboard ? 1 : 0.45,
              }}
            >
              <span>{t("paste")}</span>
            </ContextMenuButton>

            {!isSpecialPageMenuTarget && (
              <ContextMenuButton
                disabled={!hasEditablePageMenuTargets}
                onClick={() => {
                  handleDeletePages(getPageMenuTargetIds(pageMenu.pageId!), {
                    flashEmptyPageMainArea: !isContextMenuMouseInputMode(),
                  });
                }}
                style={{
                  color: "#b91c1c",
                  opacity: hasEditablePageMenuTargets ? 1 : 0.45,
                }}
              >
                <span>{t("delete")}</span>
              </ContextMenuButton>
            )}
          </ContextMenuLayer>
        );
      })()}



      <ReviewDialog
        open={reviewDialogOpen}
        language={language}
        showDismissForever={true}
        onClose={closeReviewDialog}
        onDismissForever={dismissReviewForever}
        onSubmit={handleReviewSubmit}
      />

      {exportProgress && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(17,24,39,0.35)",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              width: 360,
              maxWidth: "calc(100vw - 48px)",
              padding: 20,
              borderRadius: 14,
              background: "#ffffff",
              boxShadow: "0 20px 48px rgba(0,0,0,0.25)",
              color: "#111827",
              fontFamily: "inherit",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {t("export")}
              </div>
              <div style={{ fontSize: 13, color: "#4b5563" }}>
                {exportProgressPercent}%
              </div>
            </div>

            <div
              style={{
                height: 10,
                overflow: "hidden",
                borderRadius: 999,
                background: "#e5e7eb",
              }}
            >
              <div
                style={{
                  width: `${exportProgressPercent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "#2563eb",
                  transition: "width 120ms ease",
                }}
              />
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                color: "#4b5563",
                textAlign: "center",
              }}
            >
              {exportProgress.label}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
