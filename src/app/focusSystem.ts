export type MansakuFocusArea = "menu" | "main" | "editor" | "template";
export type MansakuFocusLayer = "menu" | "submenu" | "page-list" | "canvas" | "editor" | "template" | "context-menu";

type MainReturnPoint = {
  area: "main";
  layer: "page-list" | "canvas";
  element?: HTMLElement | null;
};

type FocusSystemOptions = {
  onAltMoveToMenu?: () => void;
  onAltMoveToMain?: () => void;
  getMenuPrimaryElement?: () => HTMLElement | null;
  getMainPrimaryElement?: () => HTMLElement | null;
  onMainCanvasTab?: (reverse: boolean) => boolean;
  hasMainCanvasSelection?: () => boolean;
  onMainCanvasEnter?: () => boolean;
  onMainCanvasEscapeToMain?: () => void;
  onEditorEscapeToMain?: () => void;
  onMainEscapeToPageList?: () => void;
  onPageCardEnterToMain?: () => void;
  onPageCardEscapeToPageList?: () => void;
  onTemplateEscape?: () => boolean;
};

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled):not([type='hidden'])",
  "textarea:not(:disabled)",
  "select:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
  "[data-focus-role]",
].join(",");

export class FocusSystem {
  private root: HTMLElement;
  private options: FocusSystemOptions;
  private altDown = false;
  private altCombined = false;
  private lastMainReturnPoint: MainReturnPoint = {
    area: "main",
    layer: "page-list",
    element: null,
  };
  private keyboardMenuHoverWrap: HTMLElement | null = null;
  private menuKeyboardPointerGuardStyle: HTMLStyleElement | null = null;
  private menuKeyboardPointerGuardClearTimer: number | null = null;
  private lastPointerPosition: { x: number; y: number } | null = null;
  private activeFocusArea: HTMLElement | null = null;
  private previousActiveFocusArea: HTMLElement | null = null;
  private lastInputMode: "keyboard" | "mouse" = "mouse";
  private lastFlashedFocusArea: HTMLElement | null = null;
  private focusFlashClearTimer: number | null = null;
  private editorSectionCollapseTimers = new Map<string, number>();


  constructor(root: HTMLElement, options: FocusSystemOptions = {}) {
    this.root = root;
    this.options = options;
  }

  initialize() {
    this.ensureMenuKeyboardPointerGuardStyle();
    window.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("keyup", this.handleKeyUp, true);
    window.addEventListener("pointermove", this.clearMenuKeyboardPointerGuardByPointerMove, true);
    window.addEventListener("mousedown", this.handleMouseDown, true);
    window.addEventListener("mansaku-top-toolbar-menu-opened", this.handleTopToolbarMenuOpened as EventListener);
    document.addEventListener("focusin", this.handleFocusIn, true);
    document.addEventListener("focusout", this.handleFocusOut, true);
  }

  dispose() {
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    window.removeEventListener("pointermove", this.clearMenuKeyboardPointerGuardByPointerMove, true);
    window.removeEventListener("mousedown", this.handleMouseDown, true);
    window.removeEventListener("mansaku-top-toolbar-menu-opened", this.handleTopToolbarMenuOpened as EventListener);
    document.removeEventListener("focusin", this.handleFocusIn, true);
    document.removeEventListener("focusout", this.handleFocusOut, true);
    this.clearMenuKeyboardPointerGuard();
    this.clearFocusFlashTimer();
    this.clearEditorSectionCollapseTimers();

    if (this.menuKeyboardPointerGuardStyle) {
      this.menuKeyboardPointerGuardStyle.remove();
      this.menuKeyboardPointerGuardStyle = null;
    }
  }

  private handleFocusIn = (event: FocusEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target || !this.root.contains(target)) return;

    const areaElement = target.closest<HTMLElement>("[data-focus-area]");
    if (!areaElement) return;

    this.setActiveFocusArea(areaElement);

    const area = areaElement.dataset.focusArea as MansakuFocusArea | undefined;
    const layer = areaElement.dataset.focusLayer as MansakuFocusLayer | undefined;

    if (area === "main" && (layer === "page-list" || layer === "canvas")) {
      this.lastMainReturnPoint = {
        area,
        layer,
        element: target,
      };
    }

    this.cancelEditorSectionCollapse(this.getEditorSectionKeyFromElement(target));
    this.expandFocusedEditorSection(target);
    this.syncKeyboardMenuHover(target);
  };

  private handleFocusOut = (event: FocusEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target || !this.root.contains(target)) return;

    const sectionKey = this.getEditorSectionKeyFromElement(target);
    if (!sectionKey) return;

    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (relatedTarget && this.isInsideEditorSection(relatedTarget, sectionKey)) {
      return;
    }

    this.scheduleEditorSectionCollapse(sectionKey);
  };

  private handleTopToolbarMenuOpened = (event: Event) => {
    const detail = (event as CustomEvent<{ kind?: "main" | "settings" }>).detail;
    this.focusFirstOpenTopToolbarMenuWithRetry(detail?.kind ?? "main");
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    this.lastInputMode = "keyboard";

    if (event.key === "Alt") {
      this.altDown = true;
      this.altCombined = event.shiftKey || event.ctrlKey || event.metaKey;
      event.preventDefault();
      return;
    }

    if (this.altDown) {
      this.altCombined = true;
    }

    if (!this.isEventInsideRoot(event)) return;
    if (event.ctrlKey || event.metaKey) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const menuButton = target.closest<HTMLButtonElement>(
        "button[data-focus-role='context-menu-item']"
      );

      if (menuButton && !menuButton.disabled) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        menuButton.click();
        return;
      }
    }

    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.moveTab(event.shiftKey, target);
      return;
    }

    if (event.key === "Escape" && this.escapeEditorToMain(target)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    if (this.isTextInput(target)) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        target.blur();
      }
      return;
    }

    switch (event.key) {

      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.escapeOneStep(target);
        return;

      case "Enter":
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          this.openContextMenu(target);
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.enter(target);
        return;

      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "PageUp":
      case "PageDown":
      case "Home":
      case "End":
        this.handleDirectionalKey(event, target);
        return;
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    if (event.key !== "Alt") return;

    this.lastInputMode = "keyboard";

    const shouldToggle = this.altDown && !this.altCombined;
    this.altDown = false;
    this.altCombined = false;

    if (!shouldToggle) return;

    event.preventDefault();
    event.stopPropagation();
    this.toggleMenuMain();
  };

  private ensureMenuKeyboardPointerGuardStyle() {
    if (this.menuKeyboardPointerGuardStyle) return;

    const style = document.createElement("style");
    style.dataset.mansakuMenuKeyboardPointerGuard = "true";
    style.textContent = `
      [data-mansaku-menu-keyboard-pointer-guard="true"] [data-top-toolbar-menu],
      [data-mansaku-menu-keyboard-pointer-guard="true"] .split-submenu {
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    this.menuKeyboardPointerGuardStyle = style;
  }

  private activateMenuKeyboardPointerGuard() {
    this.root.dataset.mansakuMenuKeyboardPointerGuard = "true";

    if (this.menuKeyboardPointerGuardClearTimer != null) {
      window.clearTimeout(this.menuKeyboardPointerGuardClearTimer);
      this.menuKeyboardPointerGuardClearTimer = null;
    }
  }

  private clearMenuKeyboardPointerGuard() {
    delete this.root.dataset.mansakuMenuKeyboardPointerGuard;

    if (this.menuKeyboardPointerGuardClearTimer != null) {
      window.clearTimeout(this.menuKeyboardPointerGuardClearTimer);
      this.menuKeyboardPointerGuardClearTimer = null;
    }
  }

  private clearMenuKeyboardPointerGuardByPointerMove = (event: PointerEvent) => {
    const next = { x: event.clientX, y: event.clientY };
    const prev = this.lastPointerPosition;

    this.lastPointerPosition = next;

    if (!prev) return;
    if (prev.x === next.x && prev.y === next.y) return;

    this.clearMenuKeyboardPointerGuard();
  };

  private handleMouseDown = (event: MouseEvent) => {
    this.lastInputMode = "mouse";
    this.lastFlashedFocusArea = null;
    this.lastPointerPosition = { x: event.clientX, y: event.clientY };
    this.clearMenuKeyboardPointerGuard();

    const target = event.target as HTMLElement | null;
    if (!target || !this.root.contains(target)) return;

    const area = target.closest<HTMLElement>("[data-focus-area]");
    if (area) this.setActiveFocusAreaByMouse(area);
  };

    private moveTab(reverse: boolean, target?: HTMLElement | null) {
    const activeArea = this.activeFocusArea;

    if (
        activeArea &&
        this.root.contains(activeArea) &&
        activeArea.dataset.focusArea === "main" &&
        activeArea.dataset.focusLayer === "page-list"
    ) {
        const pageCards = this.getPageCardElements(activeArea);

        if (pageCards.length > 0) {
        this.movePageListFocusByTab(reverse, activeArea);
        return;
        }
    }

    const area = this.getCurrentFocusArea(target);
    if (!area) return;

    if (area.dataset.focusArea === "main" && area.dataset.focusLayer === "canvas") {
        this.options.onMainCanvasTab?.(reverse);
        return;
    }

    if (area.dataset.focusArea === "main" && area.dataset.focusLayer === "page-list") {
        this.movePageListFocusByTab(reverse, area);
        return;
    }

    if (area.dataset.focusArea === "menu" && area.dataset.focusLayer === "context-menu") {
        this.moveMenuContextFocus(reverse ? -1 : 1, area);
        return;
    }

    if (area.dataset.focusArea === "editor") {
        this.notifyFrameImageCardTabAway(target);
        this.moveEditorFocusByTab(reverse, area);
        return;
    }

    if (area.dataset.focusArea === "template") {
        this.moveTemplateFocusByTab(reverse, area);
        return;
    }

    const focusables = this.getFocusableElements(area);
    if (focusables.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? focusables.indexOf(active) : -1;

    const nextIndex = reverse
        ? currentIndex <= 0
        ? focusables.length - 1
        : currentIndex - 1
        : currentIndex < 0 || currentIndex >= focusables.length - 1
        ? 0
        : currentIndex + 1;

    this.focusElement(focusables[nextIndex]);
    }

    private notifyFrameImageCardTabAway(target?: HTMLElement | null) {
    const card = target?.closest<HTMLElement>(
        "[data-frame-image-card='true'][data-frame-image-card-id]"
    );

    if (!card) return;

    window.dispatchEvent(
        new CustomEvent("mansaku-frame-image-card-tab-away", {
        detail: { frameId: card.dataset.frameImageCardId ?? null },
        })
    );
    }

    private moveEditorFocusByTab(reverse: boolean, area: HTMLElement) {
    const focusables = this.getEditorTabCycleElements(area);
    if (focusables.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? focusables.indexOf(active) : -1;

    const nextIndex = reverse
        ? currentIndex <= 0
        ? focusables.length - 1
        : currentIndex - 1
        : currentIndex < 0 || currentIndex >= focusables.length - 1
        ? 0
        : currentIndex + 1;

    this.focusElement(focusables[nextIndex]);
    }

    private movePageListFocusByTab(reverse: boolean, area: HTMLElement) {
    const pageCards = this.getPageCardElements(area);

    if (pageCards.length === 0) {
        this.focusElement(this.root.querySelector<HTMLElement>('[data-focus-role="empty-page-add"]'));
        return;
    }

    const active = document.activeElement as HTMLElement | null;
    const activeCard = active?.closest<HTMLElement>('[data-focus-role="page-card"]');
    const currentIndex = activeCard ? pageCards.indexOf(activeCard) : -1;

    const nextIndex = reverse
        ? currentIndex <= 0
        ? pageCards.length - 1
        : currentIndex - 1
        : currentIndex < 0 || currentIndex >= pageCards.length - 1
        ? 0
        : currentIndex + 1;

    this.focusElement(pageCards[nextIndex]);
    }

  private moveTemplateFocusByTab(reverse: boolean, area: HTMLElement) {
    const templates = this.getTemplateItemElements(area);
    if (templates.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const activeTemplate = active?.closest<HTMLElement>('[data-focus-role="template-item"]');
    const currentIndex = activeTemplate ? templates.indexOf(activeTemplate) : -1;

    const nextIndex = reverse
      ? currentIndex <= 0
        ? templates.length - 1
        : currentIndex - 1
      : currentIndex < 0 || currentIndex >= templates.length - 1
      ? 0
      : currentIndex + 1;

    this.focusElement(templates[nextIndex]);
  }

  private moveTemplateFocusByKey(key: string, area: HTMLElement | null | undefined) {
    if (!area) return;

    const templates = this.getTemplateItemElements(area);
    if (templates.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const activeTemplate = active?.closest<HTMLElement>('[data-focus-role="template-item"]');
    const currentIndex = activeTemplate ? templates.indexOf(activeTemplate) : -1;

    if (key === "Home") {
      this.focusElement(templates[0]);
      return;
    }

    if (key === "End") {
      this.focusElement(templates[templates.length - 1]);
      return;
    }

    if (key === "PageDown") {
      this.focusElement(templates[Math.min(templates.length - 1, currentIndex < 0 ? 0 : currentIndex + this.getTemplateColumnStep(templates))]);
      return;
    }

    if (key === "PageUp") {
      this.focusElement(templates[Math.max(0, currentIndex < 0 ? 0 : currentIndex - this.getTemplateColumnStep(templates))]);
      return;
    }

    if (!activeTemplate) {
      this.focusElement(templates[0]);
      return;
    }

    const next = this.findTemplateItemByDirection(activeTemplate, templates, key);
    if (next) this.focusElement(next);
  }

  private getTemplateColumnStep(templates: HTMLElement[]) {
    if (templates.length <= 1) return 1;

    const firstTop = templates[0].getBoundingClientRect().top;
    const nextRowIndex = templates.findIndex((template) => {
      return Math.abs(template.getBoundingClientRect().top - firstTop) > 8;
    });

    return nextRowIndex > 0 ? nextRowIndex : 1;
  }

  private findTemplateItemByDirection(current: HTMLElement, templates: HTMLElement[], key: string) {
    const currentRect = current.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;

    const candidates = templates
      .filter((template) => template !== current)
      .map((template) => {
        const rect = template.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = centerX - currentCenterX;
        const dy = centerY - currentCenterY;

        return {
          template,
          dx,
          dy,
          primary: key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dx) : Math.abs(dy),
          secondary: key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dy) : Math.abs(dx),
        };
      })
      .filter(({ dx, dy }) => {
        if (key === "ArrowLeft") return dx < -1;
        if (key === "ArrowRight") return dx > 1;
        if (key === "ArrowUp") return dy < -1;
        if (key === "ArrowDown") return dy > 1;
        return false;
      });

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const aScore = a.primary * 1000 + a.secondary;
      const bScore = b.primary * 1000 + b.secondary;
      return aScore - bScore;
    });

    return candidates[0].template;
  }

  private enter(target: HTMLElement) {
    const roleTarget = target.closest<HTMLElement>(
      "button, a[href], input, textarea, select, [tabindex]:not([tabindex='-1']), [data-focus-role]"
    ) ?? target;
    const role = roleTarget.dataset.focusRole;
    const area = this.getCurrentFocusArea();
    const areaName = area?.dataset.focusArea;
    const layer = area?.dataset.focusLayer;

    if (role === "menu-primary") {
      roleTarget.click();
      this.focusFirstOpenTopToolbarMenuWithRetry("main");
      return;
    }

    if (role === "toolbar-template") {
      roleTarget.click();
      this.flashCurrentFocusAreaAfterAction({
        previousArea: area,
        getFallbackArea: () => this.getArea("template"),
      });
      return;
    }

    if (role === "toolbar-manga") {
      roleTarget.click();
      this.flashCurrentFocusAreaAfterAction({
        previousArea: area,
        getFallbackArea: () => this.getMainCanvasArea(),
      });
      return;
    }

    if (areaName === "menu" && layer === "context-menu") {
      if (this.hasSubmenu(roleTarget)) {
        this.openFocusedSubmenu(roleTarget);
        return;
      }

      roleTarget.click();
      return;
    }

    if (role === "page-card") {
      roleTarget.click();

      this.options.onPageCardEnterToMain?.();

      window.requestAnimationFrame(() => {
        const canvas = this.getMainCanvasArea();
        this.focusElement(canvas);
        this.flashCurrentFocusAreaAfterAction({ previousArea: area });
      });

      return;
    }

    if (role === "template-item") {
      roleTarget.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      return;
    }

    if (role === "editor-heading") {
      this.enterEditorHeading(roleTarget);
      return;
    }

    if (
      areaName === "editor" &&
      (role === "editor-close" ||
        role === "editor-delete" ||
        role === "editor-delete-frame")
    ) {
      roleTarget.click();
      this.flashCurrentFocusAreaAfterAction({
        previousArea: area,
        getFallbackArea: () => this.getMainCanvasArea(),
      });
      return;
    }

    if (areaName === "menu") {
      roleTarget.click();
      this.flashCurrentFocusAreaAfterAction();
      window.setTimeout(() => {
        const submenu = this.root.querySelector<HTMLElement>(".split-menu-wrap:hover [role='menu'], [data-focus-layer='submenu']");
        if (submenu) this.focusFirst(submenu);
      }, 0);
      return;
    }

    if (areaName === "main" && layer === "canvas") {
      if (this.options.onMainCanvasEnter?.()) {
        this.flashCurrentFocusAreaAfterAction();
        return;
      }

      roleTarget.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      roleTarget.click();
      this.flashCurrentFocusAreaAfterAction();
      return;
    }

    roleTarget.click();
  }

  private enterEditorHeading(heading: HTMLElement) {
    this.toggleEditorSectionHeading(heading);
  }

  private escapeEditorToMain(target: HTMLElement) {
    const area = this.getCurrentFocusArea(target);
    if (area?.dataset.focusArea !== "editor") return false;

    this.options.onEditorEscapeToMain?.();

    this.flashCurrentFocusAreaAfterAction({ previousArea: area, fallbackArea: this.getMainCanvasArea() });

    return true;
  }

  private getEditorSectionKeyFromElement(element: HTMLElement) {
    const heading = element.closest<HTMLElement>('[data-focus-role="editor-heading"][data-editor-section-key]');
    if (heading?.dataset.editorSectionKey) {
      return heading.dataset.editorSectionKey;
    }

    const content = element.closest<HTMLElement>("[data-editor-section-content]");
    if (content?.dataset.editorSectionContent) {
      return content.dataset.editorSectionContent;
    }

    const root = element.closest<HTMLElement>("[data-editor-section-root]");
    if (root?.dataset.editorSectionRoot) {
      return root.dataset.editorSectionRoot;
    }

    return null;
  }

  private isInsideEditorSection(element: HTMLElement, sectionKey: string) {
    if (!this.root.contains(element)) return false;

    const heading = element.closest<HTMLElement>('[data-focus-role="editor-heading"][data-editor-section-key]');
    if (heading?.dataset.editorSectionKey === sectionKey) {
      return true;
    }

    const content = element.closest<HTMLElement>("[data-editor-section-content]");
    if (content?.dataset.editorSectionContent === sectionKey) {
      return true;
    }

    const root = element.closest<HTMLElement>("[data-editor-section-root]");
    return root?.dataset.editorSectionRoot === sectionKey;
  }

  private scheduleEditorSectionCollapse(sectionKey: string) {
    if (sectionKey === "frame-image-move-copy") {
      return;
    }

    this.cancelEditorSectionCollapse(sectionKey);

    const timer = window.setTimeout(() => {
      this.editorSectionCollapseTimers.delete(sectionKey);

      const active = document.activeElement as HTMLElement | null;
      if (active && this.isInsideEditorSection(active, sectionKey)) {
        return;
      }

      this.collapseEditorSection(sectionKey);
    }, 0);

    this.editorSectionCollapseTimers.set(sectionKey, timer);
  }

  private cancelEditorSectionCollapse(sectionKey: string | null) {
    if (!sectionKey) return;

    const timer = this.editorSectionCollapseTimers.get(sectionKey);
    if (timer == null) return;

    window.clearTimeout(timer);
    this.editorSectionCollapseTimers.delete(sectionKey);
  }

  private clearEditorSectionCollapseTimers() {
    for (const timer of this.editorSectionCollapseTimers.values()) {
      window.clearTimeout(timer);
    }

    this.editorSectionCollapseTimers.clear();
  }


  private expandFocusedEditorSection(element?: HTMLElement | null) {
    const target = element ?? (document.activeElement as HTMLElement | null);
    if (!target || !this.root.contains(target)) return;

    const sectionKey = this.getEditorSectionKeyFromElement(target);
    if (!sectionKey) return;

    this.expandEditorSection(sectionKey);
  }

  private expandEditorSection(sectionKey: string) {
    const heading = this.getEditorSectionHeading(sectionKey);
    if (!heading) return;

    if (heading.getAttribute("aria-expanded") !== "true") {
      this.requestEditorSectionVisibility(sectionKey, true);
    }
  }

  private collapseEditorSection(sectionKey: string) {
    const heading = this.getEditorSectionHeading(sectionKey);
    if (!heading) return;

    if (heading.getAttribute("aria-expanded") === "true") {
      this.requestEditorSectionVisibility(sectionKey, false);
    }
  }

  private toggleEditorSectionHeading(heading: HTMLElement) {
    const sectionKey = heading.dataset.editorSectionKey;
    if (!sectionKey) return;

    this.requestEditorSectionVisibility(
      sectionKey,
      heading.getAttribute("aria-expanded") !== "true"
    );
  }

  private requestEditorSectionVisibility(sectionKey: string, open: boolean) {
    document.dispatchEvent(
      new CustomEvent("mansaku-editor-section-visibility-request", {
        detail: { sectionKey, open },
      })
    );
  }

  private getEditorSectionHeading(sectionKey: string) {
    return this.root.querySelector<HTMLElement>(
      `[data-focus-role="editor-heading"][data-editor-section-key="${CSS.escape(sectionKey)}"]`
    );
  }

  private focusEditorSectionHeading(sectionKey: string, attempt = 0) {
    window.requestAnimationFrame(() => {
      const heading = this.getEditorSectionHeading(sectionKey);

      if (heading) {
        this.focusElement(heading);
        return;
      }

      if (attempt < 8) {
        window.setTimeout(() => this.focusEditorSectionHeading(sectionKey, attempt + 1), 0);
      }
    });
  }

  private escapeOneStep(target: HTMLElement) {
    if (this.escapeEditorToMain(target)) return;

    const area = this.getCurrentFocusArea();
    const areaName = area?.dataset.focusArea as MansakuFocusArea | undefined;
    const layer = area?.dataset.focusLayer as MansakuFocusLayer | undefined;

    const topToolbarMenu = this.root.querySelector<HTMLElement>("[data-top-toolbar-menu]");

    if (
      topToolbarMenu &&
      (
        topToolbarMenu.contains(target) ||
        areaName === "menu"
      )
    ) {
      this.closeTopToolbarMenusAndFocusButton();
      return;
    }

    if (areaName === "menu" && layer === "context-menu") {
      const currentMenu = target.closest<HTMLElement>(
        ".split-submenu, [data-context-menu='true']"
      );

      const contextMenu = currentMenu?.closest<HTMLElement>("[data-context-menu='true']");
      if (contextMenu) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        return;
      }

      this.closeTopToolbarMenusAndFocusButton();
      return;
    }

    const contextMenu = this.findOpenContextMenu();
    if (contextMenu) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return;
    }

    if (target.closest<HTMLElement>('[data-focus-role="empty-page-add"]')) {
      const main = this.getMainCanvasArea();
      this.focusElement(main);
      return;
    }

    if (areaName === "template") {
      if (this.options.onTemplateEscape?.()) {
        this.flashCurrentFocusAreaAfterAction({ previousArea: area, fallbackArea: area });
        return;
      }

      const templateButton = this.findToolbarButtonByTitleContains(["テンプレート", "Template"]);
      this.focusElement(templateButton ?? this.getFocusableElements(this.getArea("menu") ?? this.root)[0]);
      this.flashCurrentFocusAreaAfterAction({ previousArea: area, fallbackArea: this.getArea("menu") });
      return;
    }

    if (areaName === "editor") {
      this.options.onEditorEscapeToMain?.();

      this.flashCurrentFocusAreaAfterAction({ previousArea: area, fallbackArea: this.getMainCanvasArea() });

      return;
    }

    if (areaName === "main" && layer === "page-list") {
      const activeCard = target.closest<HTMLElement>('[data-focus-role="page-card"]');

      if (activeCard && area) {
        this.options.onPageCardEscapeToPageList?.();

        window.requestAnimationFrame(() => {
          this.focusElement(area);
          this.flashCurrentFocusAreaAfterAction({ previousArea: activeCard, fallbackArea: area });
        });

        return;
      }

      // ページ一覧コンテナにフォーカスがある状態での Esc は何もしない。
      return;
    }

    if (areaName === "main" && layer === "canvas") {
      if (this.options.hasMainCanvasSelection?.()) {
        this.options.onMainCanvasEscapeToMain?.();

        window.requestAnimationFrame(() => {
          const canvas = this.getMainCanvasArea();
          this.focusElement(canvas);
          this.flashCurrentFocusAreaAfterAction({ previousArea: area, fallbackArea: canvas });
        });

        return;
      }

      this.options.onMainEscapeToPageList?.();

      window.requestAnimationFrame(() => {
        const primary = this.getMainPrimaryElement();
        const pageList = this.getArea("main", "page-list");

        if (primary?.dataset.focusRole === "empty-page-add" && pageList) {
          this.focusElement(pageList);
        } else {
          this.focusElement(primary);
        }

        this.flashCurrentFocusAreaAfterAction({ previousArea: area, fallbackArea: pageList });
      });

      return;
    }

    if (areaName === "menu") {
      const menuArea = this.getArea("menu");

      if (menuArea) {
        this.focusElement(menuArea);
        return;
      }

      this.moveToMainFromMenu();
      return;
    }

    target.blur();
  }

  private handleDirectionalKey(event: KeyboardEvent, target: HTMLElement) {
    const active = target.closest<HTMLElement>("[data-focus-role]") ?? target;
    const area = this.getCurrentFocusArea(target);
    const areaName = area?.dataset.focusArea;
    const layer = area?.dataset.focusLayer;

    const isSlider = active.matches('input[type="range"]');

    if (isSlider && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      return;
    }

    if (areaName === "menu" && layer === "context-menu") {
      if (!area) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.activateMenuKeyboardPointerGuard();

      if (event.key === "ArrowRight") {
        this.openFocusedSubmenu(active);
        return;
      }

      if (event.key === "ArrowLeft") {
        this.closeFocusedSubmenuOrReturnToParent(active);
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageDown" ||
        event.key === "PageUp"
      ) {
        this.moveMenuContextFocusByKey(event.key, area);
      }

      return;
    }

    if (areaName === "template") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.moveTemplateFocusByKey(event.key, area);
      return;
    }

    if (areaName === "editor" && target.closest("[data-frame-image-card='true']")) {
      return;
    }

    if (areaName === "main" && layer === "canvas") {
      return;
    }

    if (
      areaName === "menu" ||
      areaName === "main" ||
      areaName === "editor"
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.moveLinear(event.key, area);

      if (areaName === "editor") {
        this.expandFocusedEditorSection();
      }
    }
  }

  private moveLinear(key: string, area: HTMLElement | null | undefined) {
    if (!area) return;
    const items = this.getFocusableElements(area);
    if (items.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const index = active ? items.indexOf(active) : -1;

    let nextIndex = index < 0 ? 0 : index;

    if (key === "ArrowDown" || key === "ArrowRight" || key === "PageDown") {
      nextIndex = index < 0 ? 0 : (index + 1) % items.length;
    }

    if (key === "ArrowUp" || key === "ArrowLeft" || key === "PageUp") {
      nextIndex = index < 0 ? 0 : (index - 1 + items.length) % items.length;
    }

    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = items.length - 1;

    this.focusElement(items[nextIndex]);
  }

  private toggleMenuMain() {
    const area = this.getCurrentFocusArea();

    if (area?.dataset.focusArea === "menu") {
      this.moveToMainFromMenu();
      return;
    }

    const mainArea = area?.dataset.focusArea === "main" ? area : this.getArea("main");
    const active = document.activeElement as HTMLElement | null;
    const layer = mainArea?.dataset.focusLayer as "page-list" | "canvas" | undefined;

    if (mainArea && (layer === "page-list" || layer === "canvas")) {
      this.lastMainReturnPoint = { area: "main", layer, element: active };
    }

    this.options.onAltMoveToMenu?.();

    window.requestAnimationFrame(() => {
      const menu = this.getArea("menu");
      this.focusElement(this.getMenuPrimaryElement());
      this.flashCurrentFocusAreaAfterAction({ previousArea: area, fallbackArea: menu });
    });
  }

  private moveToMainFromMenu() {
    this.options.onAltMoveToMain?.();

    window.requestAnimationFrame(() => {
      const main = this.getArea("main", "page-list") ?? this.getArea("main", "canvas") ?? this.getArea("main");
      this.focusElement(this.getMainPrimaryElement());
      this.flashCurrentFocusAreaAfterAction({ previousArea: this.getArea("menu"), fallbackArea: main });
    });
  }

  private getMenuPrimaryElement() {
    return (
      this.options.getMenuPrimaryElement?.() ??
      this.root.querySelector<HTMLElement>('[data-focus-role="menu-primary"]') ??
      this.getFocusableElements(this.getArea("menu") ?? this.root)[0]
    );
  }

  private getMainPrimaryElement() {
    return (
      this.options.getMainPrimaryElement?.() ??
      this.root.querySelector<HTMLElement>('[data-current-page="true"]') ??
      this.root.querySelector<HTMLElement>('[data-focus-role="empty-page-add"]') ??
      this.root.querySelector<HTMLElement>('[data-focus-role="page-card"]') ??
      this.lastMainReturnPoint.element ??
      this.getFocusableElements(this.getArea("main") ?? this.root)[0]
    );
  }

  private openContextMenu(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
  }

  private getCurrentFocusArea(target?: HTMLElement | null) {
    const fromTarget = target?.closest<HTMLElement>("[data-focus-area]");
    if (fromTarget && this.root.contains(fromTarget)) {
      this.setActiveFocusArea(fromTarget);
      return fromTarget;
    }

    const active = document.activeElement as HTMLElement | null;
    const fromActive = active?.closest<HTMLElement>("[data-focus-area]");
    if (fromActive && this.root.contains(fromActive)) {
      this.setActiveFocusArea(fromActive);
      return fromActive;
    }

    if (this.activeFocusArea && this.root.contains(this.activeFocusArea)) {
      return this.activeFocusArea;
    }

    const main = this.root.querySelector<HTMLElement>('[data-focus-area="main"]');
    if (main) this.setActiveFocusArea(main);
    return main;
  }

  private setActiveFocusArea(area: HTMLElement) {
    if (!this.root.contains(area)) return;

    this.blurEmptyPageAddButtonWhenPageListBecomesActive(area);

    if (this.activeFocusArea !== area) {
      this.previousActiveFocusArea = this.activeFocusArea;
      this.activeFocusArea = area;
    } else {
      this.activeFocusArea = area;
    }
  }


  private setActiveFocusAreaByMouse(area: HTMLElement) {
    if (!this.root.contains(area)) return;

    this.blurEmptyPageAddButtonWhenPageListBecomesActive(area);

    this.previousActiveFocusArea = this.activeFocusArea;
    this.activeFocusArea = area;
  }

  private blurEmptyPageAddButtonWhenPageListBecomesActive(area: HTMLElement) {
    if (area.dataset.focusArea !== "main") return;
    if (area.dataset.focusLayer !== "page-list") return;

    const active = document.activeElement as HTMLElement | null;
    if (!active || !this.root.contains(active)) return;
    if (active.dataset.focusRole !== "empty-page-add") return;

    active.blur();
  }

  private getArea(area: MansakuFocusArea, layer?: MansakuFocusLayer) {
    const selector = layer
      ? `[data-focus-area="${area}"][data-focus-layer="${layer}"]`
      : `[data-focus-area="${area}"]`;
    return this.root.querySelector<HTMLElement>(selector);
  }

  private getMainCanvasArea() {
    return (
      this.root.querySelector<HTMLElement>(
        '[data-focus-area="main"][data-focus-layer="canvas"][data-focus-flash-area]'
      ) ?? this.getArea("main", "canvas")
    );
  }

  private focusFirst(area: HTMLElement | null | undefined) {
    if (!area) return;
    this.focusElement(this.getFocusableElements(area)[0]);
  }

  private focusElement(element: HTMLElement | null | undefined) {
    if (!element) return;

    const area = element.closest<HTMLElement>("[data-focus-area]");
    if (area && this.root.contains(area)) {
      this.setActiveFocusArea(area);
    }

    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    this.syncKeyboardMenuHover(element);
  }

  private flashCurrentFocusAreaAfterAction(options: {
    previousArea?: HTMLElement | null;
    fallbackArea?: HTMLElement | null;
    getFallbackArea?: () => HTMLElement | null;
    attempt?: number;
  } = {}) {
    const attempt = options.attempt ?? 0;
    const previousArea = options.previousArea ?? this.activeFocusArea ?? null;

    window.requestAnimationFrame(() => {
      const fallbackArea = options.getFallbackArea?.() ?? options.fallbackArea ?? null;
      const activeArea = this.updateActiveFocusAreaFromDocument(
        fallbackArea,
        previousArea
      );

      const previousFlashArea = this.getFocusFlashElement(previousArea);
      const activeFlashArea = this.getFocusFlashElement(activeArea);

      if (activeFlashArea && previousFlashArea && activeFlashArea !== previousFlashArea) {
        this.flash(activeArea);
        return;
      }

      if (activeFlashArea && !previousFlashArea && attempt >= 1) {
        this.flash(activeArea);
        return;
      }

      if (attempt >= 8) {
        return;
      }

      window.setTimeout(() => {
        this.flashCurrentFocusAreaAfterAction({
          previousArea,
          fallbackArea: options.fallbackArea,
          getFallbackArea: options.getFallbackArea,
          attempt: attempt + 1,
        });
      }, 0);
    });
  }

  private updateActiveFocusAreaFromDocument(
    fallbackArea: HTMLElement | null,
    previousArea: HTMLElement | null = null
  ) {
    const active = document.activeElement as HTMLElement | null;
    const activeArea = active && this.root.contains(active)
      ? active.closest<HTMLElement>("[data-focus-area]")
      : null;

    const shouldPreferFallback =
      fallbackArea &&
      this.root.contains(fallbackArea) &&
      (!activeArea || activeArea === previousArea);

    if (shouldPreferFallback) {
      this.setActiveFocusArea(fallbackArea);
      return fallbackArea;
    }

    if (activeArea && this.root.contains(activeArea)) {
      this.setActiveFocusArea(activeArea);
      return activeArea;
    }

    if (fallbackArea && this.root.contains(fallbackArea)) {
      this.setActiveFocusArea(fallbackArea);
      return fallbackArea;
    }

    if (this.activeFocusArea && this.root.contains(this.activeFocusArea)) {
      return this.activeFocusArea;
    }

    return null;
  }

  private syncKeyboardMenuHover(element: HTMLElement) {
    const menu = element.closest<HTMLElement>("[data-top-toolbar-menu], .split-submenu");
    const nextWrap = menu ? element.closest<HTMLElement>(".split-menu-wrap") : null;

    // キーボード由来のフォーカス同期では mouseenter / mouseleave を発火しない。
    // サブメニューの開閉は各 wrap の focus / blur に任せる。
    this.keyboardMenuHoverWrap = nextWrap;
  }

  private getFocusableElements(area: HTMLElement) {
    return Array.from(area.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
      if (!this.isVisible(element)) return false;
      if (element.dataset.focusSkip === "true") return false;
      if (element.dataset.disabled === "true") return false;
      if (element.getAttribute("aria-disabled") === "true") return false;
      if (element.hasAttribute("disabled")) return false;
      return true;
    });
  }

  private getPageCardElements(area: HTMLElement): HTMLElement[] {
    return Array.from(area.querySelectorAll<HTMLElement>('[data-focus-role="page-card"]')).filter((element) => {
      if (!this.isVisible(element)) return false;
      if (element.dataset.focusSkip === "true") return false;
      if (element.dataset.disabled === "true") return false;
      if (element.getAttribute("aria-disabled") === "true") return false;
      return true;
    });
  }

  private getTemplateItemElements(area: HTMLElement): HTMLElement[] {
    return Array.from(area.querySelectorAll<HTMLElement>('[data-focus-role="template-item"]')).filter((element) => {
      if (!this.isVisible(element)) return false;
      if (element.dataset.focusSkip === "true") return false;
      if (element.dataset.disabled === "true") return false;
      if (element.getAttribute("aria-disabled") === "true") return false;
      return true;
    });
  }

  private getEditorTabCycleElements(area: HTMLElement): HTMLElement[] {
    return this.getFocusableElements(area);
  }

  private isEventInsideRoot(event: KeyboardEvent) {
    const target = event.target as Node | null;
    if (target && this.root.contains(target)) return true;

    const active = document.activeElement;
    return !!active && this.root.contains(active);
  }

  private isTextInput(element: HTMLElement) {
    return (
      element instanceof HTMLTextAreaElement ||
      (element instanceof HTMLInputElement && element.type !== "range") ||
      element.isContentEditable
    );
  }

  private isVisible(element: HTMLElement) {
    if (element.hidden) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  private flash(element: HTMLElement | null | undefined) {
    if (this.lastInputMode !== "keyboard") return;

    const flashArea = this.getFocusFlashElement(element);
    if (!flashArea) return;


    this.lastFlashedFocusArea = flashArea;
    flashArea.dataset.focusFlashActive = "false";
    void flashArea.offsetWidth;

    window.requestAnimationFrame(() => {
      flashArea.dataset.focusFlashActive = "true";

      this.clearFocusFlashTimer();
      this.focusFlashClearTimer = window.setTimeout(() => {
        flashArea.dataset.focusFlashActive = "false";
        this.focusFlashClearTimer = null;
      }, 650);
    });
  }

  private clearFocusFlashTimer() {
    if (this.focusFlashClearTimer == null) return;

    window.clearTimeout(this.focusFlashClearTimer);
    this.focusFlashClearTimer = null;
  }

  private getFocusFlashElement(element: HTMLElement | null | undefined) {
    if (!element || !this.root.contains(element)) return null;

    const directFlashArea = element.closest<HTMLElement>("[data-focus-flash-area]");
    if (directFlashArea && this.root.contains(directFlashArea)) {
      return directFlashArea;
    }

    const focusArea = element.closest<HTMLElement>("[data-focus-area]");
    const areaName = focusArea?.dataset.focusArea;
    const layerName = focusArea?.dataset.focusLayer;

    if (areaName === "main" && layerName === "canvas") {
      return (
        this.root.querySelector<HTMLElement>(
          '[data-focus-area="main"][data-focus-layer="canvas"][data-focus-flash-area]'
        ) ?? focusArea ?? null
      );
    }

    if (areaName === "main" && layerName === "page-list") {
      return focusArea?.closest<HTMLElement>("[data-focus-flash-area]") ?? focusArea ?? null;
    }

    return focusArea ?? element;
  }

  private focusFirstOpenTopToolbarMenuWithRetry(kind: "main" | "settings" = "main", attempt = 0) {
    window.requestAnimationFrame(() => {
      const menu = this.root.querySelector<HTMLElement>(`[data-top-toolbar-menu="${kind}"]`);
      const firstItem = menu ? this.getMenuContextElements(menu)[0] : null;

      if (menu && firstItem) {
        this.focusElement(firstItem);
        this.flashCurrentFocusAreaAfterAction({ fallbackArea: menu });
        return;
      }

      if (attempt < 8) {
        window.setTimeout(() => this.focusFirstOpenTopToolbarMenuWithRetry(kind, attempt + 1), 0);
      }
    });
  }

  private closeTopToolbarMenusAndFocusButton() {
    this.keyboardMenuHoverWrap = null;
    window.dispatchEvent(new CustomEvent("mansaku-close-top-toolbar-menus"));

    window.requestAnimationFrame(() => {
      this.focusElement(this.getMenuPrimaryElement());
    });
  }

  private moveMenuContextFocusByKey(key: string, area: HTMLElement) {
    const menu = this.getCurrentMenuContainer(area);
    const items = this.getMenuContextElements(menu);
    if (items.length === 0) return;

    if (key === "Home") {
      this.focusElement(items[0]);
      return;
    }

    if (key === "End") {
      this.focusElement(items[items.length - 1]);
      return;
    }

    this.moveMenuContextFocus(key === "ArrowUp" || key === "PageUp" ? -1 : 1, menu);
  }

  private moveMenuContextFocus(delta: number, area: HTMLElement) {
    const menu = this.getCurrentMenuContainer(area);
    const items = this.getMenuContextElements(menu);
    if (items.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const current = active?.closest<HTMLElement>(
      "button, a[href], input, textarea, select, [tabindex]:not([tabindex='-1']), [data-focus-role]"
    );
    const index = current ? items.indexOf(current) : -1;

    const nextIndex = index < 0
      ? (delta < 0 ? items.length - 1 : 0)
      : (index + delta + items.length) % items.length;

    this.focusElement(items[nextIndex]);
  }

  private getCurrentMenuContainer(fallbackArea: HTMLElement) {
    const active = document.activeElement as HTMLElement | null;
    const activeMenu = active?.closest<HTMLElement>(
      ".split-submenu, [data-top-toolbar-menu], [data-context-menu='true']"
    );

    if (activeMenu && this.root.contains(activeMenu)) {
      return activeMenu;
    }

    return fallbackArea;
  }

  private getMenuContextElements(menu: HTMLElement) {
    return this.getFocusableElements(menu).filter((element) => {
      if (element.dataset.focusSkip === "true") return false;

      const ownerMenu = element.closest<HTMLElement>(
        ".split-submenu, [data-top-toolbar-menu], [data-context-menu='true']"
      );
      return ownerMenu === menu;
    });
  }

  private hasSubmenu(active: HTMLElement) {
    const wrap = active.closest<HTMLElement>(".split-menu-wrap");
    if (!wrap) return false;

    const submenu = this.getDirectSubmenu(wrap);
    if (!submenu) return false;

    return this.getMenuContextElements(submenu).length > 0;
  }

  private openFocusedSubmenu(active: HTMLElement) {
    const menuButton = active.closest<HTMLElement>("button, [data-focus-role]");
    if (!menuButton) return;

    const wrap = menuButton.closest<HTMLElement>(".split-menu-wrap");
    if (!wrap) return;

    this.activateMenuKeyboardPointerGuard();
    // キーボードでサブメニューを開く時に mousedown / mouseenter を偽装しない。
    // onFocusCapture で既に開いていない場合だけ、contextmenu 経路で開く。
    if (!this.getDirectSubmenu(wrap)) {
      menuButton.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    }

    const focusSubmenu = (attempt = 0) => {
      window.requestAnimationFrame(() => {
        const submenu = this.getDirectSubmenu(wrap);
        const firstItem = submenu ? this.getMenuContextElements(submenu)[0] : null;

        if (firstItem) {
          this.focusElement(firstItem);
          return;
        }

        if (attempt < 6) {
          window.setTimeout(() => focusSubmenu(attempt + 1), 0);
        }
      });
    };

    focusSubmenu();
  }

  private closeFocusedSubmenuOrReturnToParent(active: HTMLElement) {
    const submenu = active.closest<HTMLElement>(".split-submenu");
    if (!submenu) {
      return;
    }

    const wrap = submenu.parentElement?.closest<HTMLElement>(".split-menu-wrap");
    const parentButton = wrap?.querySelector<HTMLElement>(":scope > button");
    this.focusElement(parentButton ?? this.getMenuPrimaryElement());
  }

  private getDirectSubmenu(wrap: HTMLElement) {
    return Array.from(wrap.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.classList.contains("split-submenu") &&
        this.isVisible(child)
    ) ?? null;
  }

  private findToolbarButtonByTitleContains(words: string[]) {
    const menu = this.getArea("menu");
    if (!menu) return null;
    const buttons = Array.from(menu.querySelectorAll<HTMLElement>("button[title]"));
    return buttons.find((button) => words.some((word) => button.getAttribute("title")?.includes(word))) ?? null;
  }

  private findOpenContextMenu() {
    return this.root.querySelector<HTMLElement>("[data-context-menu='true'], [role='menu']:not([data-top-toolbar-menu])");
  }
}
