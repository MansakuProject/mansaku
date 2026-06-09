import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as React from "react";

export function ContextMenuLayer({
  visible,
  x,
  y,
  positionKey,
  children,
  onFocusCapture,
}: {
  visible: boolean;
  x: number;
  y: number;
  positionKey: string;
  children: React.ReactNode;
  onFocusCapture?: React.FocusEventHandler<HTMLDivElement>;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState({ x, y });

  useEffect(() => {
    if (!visible) return;
    setMenuPos({ x, y });
  }, [visible, x, y, positionKey]);

  useLayoutEffect(() => {
    if (!visible) return;
    if (isContextMenuMouseInputMode()) return;

    let cancelled = false;

    const focusFirstItem = (attempt = 0) => {
      window.requestAnimationFrame(() => {
        if (cancelled) return;

        const menu = menuRef.current;
        const firstItem = menu?.querySelector<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled):not([type='hidden']), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1']), [data-focus-role='context-menu-item']:not([data-focus-skip='true'])"
        );

        if (firstItem) {
          firstItem.focus({ preventScroll: true });
          return;
        }

        if (attempt < 6) {
          window.setTimeout(() => focusFirstItem(attempt + 1), 0);
        }
      });
    };

    focusFirstItem();

    return () => {
      cancelled = true;
    };
  }, [visible, positionKey]);

  useEffect(() => {
    if (!visible) return;

    let frameId = 0;

    const updatePosition = () => {
      const el = menuRef.current;
      if (!el) return;

      const VIEWPORT_PADDING = 8;
      const rect = el.getBoundingClientRect();

      const maxX = Math.max(
        VIEWPORT_PADDING,
        window.innerWidth - rect.width - VIEWPORT_PADDING
      );
      const maxY = Math.max(
        VIEWPORT_PADDING,
        window.innerHeight - rect.height - VIEWPORT_PADDING
      );

      const finalX = Math.min(Math.max(x, VIEWPORT_PADDING), maxX);
      const finalY = Math.min(Math.max(y, VIEWPORT_PADDING), maxY);

      setMenuPos((prev) =>
        prev.x === finalX && prev.y === finalY
          ? prev
          : { x: finalX, y: finalY }
      );
    };

    frameId = window.requestAnimationFrame(updatePosition);

    const handleResize = () => {
      window.requestAnimationFrame(updatePosition);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [visible, x, y, positionKey]);

  if (!visible) return null;

  return (
    <>
      <style>
        {`
          .context-menu-button:hover:not(:disabled) {
            background: #e5e7eb;
          }

          .context-menu-button:active:not(:disabled) {
            background: #e5e7eb;
          }

          .context-menu-button:disabled {
            cursor: default;
          }
        `}
      </style>

      <div
        ref={menuRef}
        data-focus-area="menu"
        data-focus-layer="context-menu"
        data-context-menu="true"
        role="menu"
        onFocusCapture={onFocusCapture}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: menuPos.x,
          top: menuPos.y,
          width: "max-content",
          minWidth: 180,
          maxWidth: "calc(100vw - 16px)",
          maxHeight: "calc(100vh - 16px)",
          boxSizing: "border-box",
          overflow: "visible",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
          padding: 6,
          zIndex: 99999,
        }}
      >
        {children}
      </div>
    </>
  );
}

export type ContextMenuInputMode = "mouse" | "keyboard";

let contextMenuInputMode: ContextMenuInputMode = "mouse";
const contextMenuInputModeListeners = new Set<(mode: ContextMenuInputMode) => void>();
let contextMenuInputModeGlobalListenersReady = false;
let lastContextMenuPointerPosition: { x: number; y: number } | null = null;

function setContextMenuInputMode(mode: ContextMenuInputMode) {
  if (contextMenuInputMode === mode) return;

  contextMenuInputMode = mode;
  contextMenuInputModeListeners.forEach((listener) => listener(mode));
}

export function setContextMenuKeyboardInputMode() {
  setContextMenuInputMode("keyboard");
}

export function setContextMenuMouseInputMode() {
  setContextMenuInputMode("mouse");
}

export function isContextMenuMouseInputMode() {
  return contextMenuInputMode === "mouse";
}

export function setContextMenuMouseInputModeByPointerMove(event: Pick<PointerEvent, "clientX" | "clientY">) {
  const next = { x: event.clientX, y: event.clientY };
  const prev = lastContextMenuPointerPosition;

  lastContextMenuPointerPosition = next;

  if (!prev) return false;
  if (prev.x === next.x && prev.y === next.y) return false;

  setContextMenuMouseInputMode();
  return true;
}

function ensureContextMenuInputModeGlobalListeners() {
  if (contextMenuInputModeGlobalListenersReady || typeof window === "undefined") {
    return;
  }

  contextMenuInputModeGlobalListenersReady = true;

  window.addEventListener(
    "keydown",
    () => {
      setContextMenuKeyboardInputMode();
    },
    true
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      setContextMenuMouseInputModeByPointerMove(event);
    },
    true
  );

  window.addEventListener(
    "pointerdown",
    (event) => {
      lastContextMenuPointerPosition = { x: event.clientX, y: event.clientY };
      setContextMenuMouseInputMode();
    },
    true
  );
}

export function useContextMenuInputMode() {
  const [inputMode, setInputMode] = useState<ContextMenuInputMode>(contextMenuInputMode);

  useEffect(() => {
    ensureContextMenuInputModeGlobalListeners();
    contextMenuInputModeListeners.add(setInputMode);

    return () => {
      contextMenuInputModeListeners.delete(setInputMode);
    };
  }, []);

  return inputMode;
}

export function ContextMenuButton({
  children,
  style,
  disabled,
  disablePressEffect,
  onClick,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onContextMenu,
  onFocus,
  onBlur,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  disabled?: boolean;
  disablePressEffect?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
  onContextMenu?: React.MouseEventHandler<HTMLButtonElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
}) {
  const inputMode = useContextMenuInputMode();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  const { background, transform, transition, outline, boxShadow, ...restStyle } = style ?? {};
  const isMouseActive = inputMode === "mouse" && hovered && !disabled;
  const isKeyboardActive = inputMode === "keyboard" && focused && !disabled;
  const isActive = isMouseActive || isKeyboardActive;

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      data-focus-role="context-menu-item"
      data-focus-skip={disabled ? "true" : undefined}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={() => {
        setContextMenuKeyboardInputMode();
      }}
      onMouseDown={(e) => {
        if (e.nativeEvent.isTrusted) {
          setContextMenuMouseInputMode();
        }

        if (!disabled && !disablePressEffect) {
          setPressed(true);
        }

        onMouseDown?.(e);
      }}
      onMouseUp={() => setPressed(false)}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        setPressed(false);
        onBlur?.(e);
      }}
      onContextMenu={onContextMenu}
      onMouseEnter={(e) => {
        if (e.nativeEvent.isTrusted) {
          setContextMenuMouseInputMode();
        }

        setHovered(true);

        if (!disabled && document.activeElement !== e.currentTarget) {
          e.currentTarget.focus({ preventScroll: true });
        }

        onMouseEnter?.(e);
      }}
      onPointerMove={(e) => {
        if (!setContextMenuMouseInputModeByPointerMove(e.nativeEvent)) return;

        setHovered(true);

        if (!disabled && document.activeElement !== e.currentTarget) {
          e.currentTarget.focus({ preventScroll: true });
        }
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        setPressed(false);
        onMouseLeave?.(e);
      }}
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        boxSizing: "border-box",
        padding: "9px 12px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 400,
        fontFamily: "inherit",
        color: "#111827",
        ...restStyle,
        cursor: disabled ? "default" : "pointer",
        background: isActive ? "#e5e7eb" : background ?? "transparent",
        outline: isKeyboardActive ? "2px solid #000000" : outline ?? "none",
        outlineOffset: -2,
        boxShadow,
        transform:
          pressed && !disabled && !disablePressEffect
            ? "translateY(1px)"
            : transform ?? "translateY(0)",
        transition:
          transition ?? "background 60ms ease, transform 50ms ease",
      }}
    >
      {children}
    </button>
  );
}

export function ContextSubmenu({
  visible,
  minWidth = 150,
  side = "right",
  children,
}: {
  visible: boolean;
  minWidth?: number;
  side?: "right" | "left";
  children: React.ReactNode;
}) {
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const [top, setTop] = useState(0);
  const [actualSide, setActualSide] = useState<"right" | "left">(side);
  const [positionReady, setPositionReady] = useState(false);

  useLayoutEffect(() => {
    if (!visible) {
      setTop(0);
      setActualSide(side);
      setPositionReady(false);
      return;
    }

    let frameId = 0;

    const updatePosition = () => {
      const el = submenuRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return;

      const VIEWPORT_PADDING = 8;
      const parentRect = parent.getBoundingClientRect();
      const submenuWidth = Math.max(el.offsetWidth, minWidth);
      const submenuHeight = el.offsetHeight;

      const rightX = parentRect.right - 1;
      const leftX = parentRect.left - submenuWidth + 1;

      const rightOverflow =
        rightX + submenuWidth > window.innerWidth - VIEWPORT_PADDING;

      const leftOverflow = leftX < VIEWPORT_PADDING;

      let nextSide: "right" | "left" = side;

      if (side === "right") {
        nextSide = rightOverflow ? "left" : "right";
      } else {
        nextSide = leftOverflow && !rightOverflow ? "right" : "left";
      }

      let nextTop = 0;

      const bottomOverflow =
        parentRect.top + submenuHeight - (window.innerHeight - VIEWPORT_PADDING);

      if (bottomOverflow > 0) {
        nextTop -= bottomOverflow;
      }

      if (parentRect.top + nextTop < VIEWPORT_PADDING) {
        nextTop += VIEWPORT_PADDING - (parentRect.top + nextTop);
      }

      setActualSide((prev) => (prev === nextSide ? prev : nextSide));
      setTop((prev) => (prev === nextTop ? prev : nextTop));
      setPositionReady(true);
    };

    frameId = window.requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
    };
  }, [visible, side, minWidth, children]);

  return (
    <div
      ref={submenuRef}
      className="split-submenu"
      data-focus-area="menu"
      data-focus-layer="context-menu"
      role="menu"
      style={{
        position: "absolute",
        top,
        left: actualSide === "right" ? "calc(100% - 1px)" : undefined,
        right: actualSide === "left" ? "calc(100% - 1px)" : undefined,
        minWidth,
        background: "#ffffff",
        border: "1px solid rgba(209,213,219,0.95)",
        borderRadius: 10,
        boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
        padding: 6,
        zIndex: 100000,
        opacity: visible && positionReady ? 1 : 0,
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}
