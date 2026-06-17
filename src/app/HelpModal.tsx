import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { AppLanguage } from "./i18n";
import { createHelpTranslator } from "./helpI18n";
import { CloseSvgIcon } from "./svgIcons";
import { APP_VERSION } from "../version";

type HelpModalProps = {
  onClose: () => void;
  language: AppLanguage;
};

type HelpSection = {
  id: string;
  title: string;
  body: ReactNode;
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 15,
  fontWeight: 800,
  color: "#111827",
};

const paragraphStyle: CSSProperties = {
  margin: 0,
  lineHeight: 1.75,
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  lineHeight: 1.75,
};

const keyStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 20,
  padding: "1px 7px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  color: "#374151",
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  whiteSpace: "nowrap",
};

function HelpKey({ children }: { children: ReactNode }) {
  return <span style={keyStyle}>{children}</span>;
}

function HelpCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#ffffff",
      }}
    >
      <h3 style={sectionTitleStyle}>{title}</h3>
      <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#374151" }}>
        {children}
      </div>
    </section>
  );
}

function ShortcutRow({
  command,
  description,
}: {
  command: string;
  description: string;
}) {
  return (
    <>
      <HelpKey>{command}</HelpKey>
      <span>{description}</span>
    </>
  );
}

export function HelpModal({ onClose, language }: HelpModalProps) {
  const t = createHelpTranslator(language);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const sections: HelpSection[] = [
    {
      id: "start",
      title: t("help.start.title"),
      body: (
        <HelpCard title={t("help.start.title")}>
          <p style={paragraphStyle}>{t("help.start.description")}</p>
          <p style={paragraphStyle}>{t("help.start.contents")}</p>
        </HelpCard>
      ),
    },
    {
      id: "toolbar",
      title: t("help.toolbar.title"),
      body: (
        <HelpCard title={t("help.toolbar.title")}>
          <ul style={listStyle}>
            <li>{t("help.toolbar.menu")}</li>
            <li>{t("help.toolbar.save")}</li>
            <li>{t("help.toolbar.undoRedo")}</li>
            <li>{t("help.toolbar.template")}</li>
            <li>{t("help.toolbar.addItems")}</li>
            <li>{t("help.toolbar.zoom")}</li>
            <li>{t("help.toolbar.help")}</li>
            <li>{t("help.toolbar.language")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "templates",
      title: t("help.templates.title"),
      body: (
        <HelpCard title={t("help.templates.title")}>
          <ul style={listStyle}>
            <li>{t("help.templates.grouped")}</li>
            <li>{t("help.templates.doubleClick")}</li>
            <li>{t("help.templates.drag")}</li>
            <li>{t("help.templates.context")}</li>
            <li>{t("help.templates.afterAdd")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "pages",
      title: t("help.pages.title"),
      body: (
        <HelpCard title={t("help.pages.title")}>
          <ul style={listStyle}>
            <li>{t("help.pages.select")}</li>
            <li>{t("help.pages.reorder")}</li>
            <li>{t("help.pages.marquee")}</li>
            <li>{t("help.pages.exportToggle")}</li>
            <li>{t("help.pages.insertPaste")}</li>
            <li>{t("help.pages.clearSelection")}</li>
            <li>{t("help.pages.pageNumbers")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "canvas",
      title: t("help.canvas.title"),
      body: (
        <HelpCard title={t("help.canvas.title")}>
          <ul style={listStyle}>
            <li>{t("help.canvas.select")}</li>
            <li>{t("help.canvas.marquee")}</li>
            <li>{t("help.canvas.move")}</li>
            <li>{t("help.canvas.multiMove")}</li>
            <li>{t("help.canvas.imageDrop")}</li>
            <li>{t("help.canvas.zoom")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "frames",
      title: t("help.frames.title"),
      body: (
        <HelpCard title={t("help.frames.title")}>
          <ul style={listStyle}>
            <li>{t("help.frames.add")}</li>
            <li>{t("help.frames.moveResize")}</li>
            <li>{t("help.frames.edgeCorner")}</li>
            <li>{t("help.frames.linked")}</li>
            <li>{t("help.frames.split")}</li>
            <li>{t("help.frames.context")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "images",
      title: t("help.frameImage.title"),
      body: (
        <HelpCard title={t("help.frameImage.title")}>
          <ul style={listStyle}>
            <li>{t("help.frameImage.position")}</li>
            <li>{t("help.frameImage.scale")}</li>
            <li>{t("help.frameImage.fastMove")}</li>
            <li>{t("help.frameImage.preview")}</li>
            <li>{t("help.frameImage.moveCopy")}</li>
            <li>{t("help.frameImage.reset")}</li>
            <li>{t("help.frameImage.transparent")}</li>
            <li>{t("help.frameImage.flip")}</li>
            <li>{t("help.frameImage.delete")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "frameEffectLine",
      title: t("help.frameEffectLine.title"),
      body: (
        <HelpCard title={t("help.frameEffectLine.title")}>
          <ul style={listStyle}>
            <li>{t("help.frameEffectLine.open")}</li>
            <li>{t("help.frameEffectLine.kind")}</li>
            <li>{t("help.frameEffectLine.density")}</li>
            <li>{t("help.frameEffectLine.blank")}</li>
            <li>{t("help.frameEffectLine.color")}</li>
            <li>{t("help.frameEffectLine.handles")}</li>
            <li>{t("help.frameEffectLine.mode")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "bubbles",
      title: t("help.bubbles.title"),
      body: (
        <HelpCard title={t("help.bubbles.title")}>
          <ul style={listStyle}>
            <li>{t("help.bubbles.add")}</li>
            <li>{t("help.bubbles.editor")}</li>
            <li>{t("help.bubbles.text")}</li>
            <li>{t("help.bubbles.ruby")}</li>
            <li>{t("help.bubbles.textColor")}</li>
            <li>{t("help.bubbles.tone")}</li>
            <li>{t("help.bubbles.type")}</li>
            <li>{t("help.bubbles.tail")}</li>
            <li>{t("help.bubbles.context")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "sounds",
      title: t("help.sounds.title"),
      body: (
        <HelpCard title={t("help.sounds.title")}>
          <ul style={listStyle}>
            <li>{t("help.sounds.add")}</li>
            <li>{t("help.sounds.editor")}</li>
            <li>{t("help.sounds.text")}</li>
            <li>{t("help.sounds.transform")}</li>
            <li>{t("help.sounds.color")}</li>
            <li>{t("help.sounds.context")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "layer",
      title: t("help.layer.title"),
      body: (
        <HelpCard title={t("help.layer.title")}>
          <ul style={listStyle}>
            <li>{t("help.layer.change")}</li>
            <li>{t("help.layer.options")}</li>
            <li>{t("help.layer.multi")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "export",
      title: t("help.export.title"),
      body: (
        <HelpCard title={t("help.export.title")}>
          <ul style={listStyle}>
            <li>{t("help.export.save")}</li>
            <li>{t("help.export.saveAs")}</li>
            <li>{t("help.export.png")}</li>
            <li>{t("help.export.pdf")}</li>
            <li>{t("help.export.exclude")}</li>
            <li>{t("help.export.unsavedWarning")}</li>
            <li>{t("help.export.webSize")}</li>
          </ul>
        </HelpCard>
      ),
    },
    {
      id: "shortcuts",
      title: t("help.shortcuts.title"),
      body: (
        <HelpCard title={t("help.shortcuts.title")}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr)",
              gap: "8px 18px",
              alignItems: "center",
              lineHeight: 1.6,
            }}
          >
            <ShortcutRow
              command="Ctrl + S / ⌘ + S" 
              description={t("help.shortcuts.save")}
            />

            <ShortcutRow
              command="Ctrl + Z / ⌘ + Z"
              description={t("help.shortcuts.undo")}
            />

            <ShortcutRow
              command="Ctrl + Y"
              description={t("help.shortcuts.redo")}
            />

            <ShortcutRow
              command="Ctrl + Shift + Z / ⌘ + ⇧ + Z"
              description={t("help.shortcuts.redo")}
            />

            <ShortcutRow
              command="Ctrl + X / ⌘ + X"
              description={t("help.shortcuts.cut")}
            />

            <ShortcutRow
              command="Ctrl + C / ⌘ + C"
              description={t("help.shortcuts.copy")}
            />

            <ShortcutRow
              command="Ctrl + V / ⌘ + V"
              description={t("help.shortcuts.paste")}
            />

            <ShortcutRow
              command="Ctrl + A / ⌘ + A"
              description={t("help.shortcuts.selectAll")}
            />

            <ShortcutRow
              command="Delete"
              description={t("help.shortcuts.delete")}
            />

            <ShortcutRow
              command="Esc"
              description={t("help.shortcuts.cancel")}
            />
          </div>
        </HelpCard>
      ),
    },
    {
      id: "tips",
      title: t("help.tips.title"),
      body: (
        <HelpCard title={t("help.tips.title")}>
          <ul style={listStyle}>
            <li>{t("help.tips.context")}</li>
            <li>{t("help.tips.templateFirst")}</li>
            <li>{t("help.tips.image")}</li>
            <li>{t("help.tips.text")}</li>
            <li>{t("help.tips.fit")}</li>
            <li>{t("help.tips.highResolution")}</li>
            <li>{t("help.tips.fontDisplay")}</li>
          </ul>
        </HelpCard>
      ),
    },

    {
      id: "environment",
      title: t("help.environment.title"),
      body: (
        <HelpCard title={t("help.environment.title")}>
          <ul style={listStyle}>
            <li>{t("help.environment.browser")}</li>
            <li>{t("help.environment.os")}</li>
            <li>{t("help.environment.mobile")}</li>
            <li>{t("help.environment.note")}</li>
          </ul>
        </HelpCard>
      ),
    },

    {
      id: "terms",
      title: t("help.terms.title"),
      body: (
        <HelpCard title={t("help.terms.title")}>
          <ul style={listStyle}>
            <li>{t("help.terms.acceptance")}</li>
            <li>{t("help.terms.prohibited")}</li>
            <li>{t("help.terms.contentRights")}</li>
            <li>{t("help.terms.changes")}</li>
          </ul>
        </HelpCard>
      ),
    },

    {
      id: "privacy",
      title: t("help.privacy.title"),
      body: (
        <HelpCard title={t("help.privacy.title")}>
          <ul style={listStyle}>
            <li>{t("help.privacy.localSave")}</li>
            <li>{t("help.privacy.cookies")}</li>
            <li>{t("help.privacy.analytics")}</li>
            <li>{t("help.privacy.ads")}</li>
            <li>{t("help.privacy.external")}</li>
          </ul>
        </HelpCard>
      ),
    },

    {
      id: "version",
      title: t("help.version.title"),
      body: (
        <HelpCard title={t("help.version.title")}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              lineHeight: 1.7,
            }}
          >
            <div>{t("help.version.name")}</div>
            <div>{t("help.version.version")} {APP_VERSION}</div>
          </div>
        </HelpCard>
      ),
    },

    {
      id: "copyright",
      title: t("help.copyright.title"),
      body: (
        <HelpCard title={t("help.copyright.title")}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              lineHeight: 1.7,
            }}
          >
            <div>© 2026 Mansaku Project</div>

            <div>{t("help.copyright.notice")}</div>
          </div>
        </HelpCard>
      ),
    },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17, 24, 39, 0.35)",
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <style>
        {`
          .help-modal-close:hover {
            background: #e5e7eb;
          }

          .help-modal-nav-link:hover {
            background: #e5e7eb !important;
          }
        `}
      </style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, calc(100vw - 48px))",
          maxHeight: "min(760px, calc(100vh - 48px))",
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
          border: "1px solid #e5e7eb",
          boxSizing: "border-box",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
        }}
      >
        <div
          style={{
            height: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "0 16px 0 20px",
            borderBottom: "1px solid #e5e7eb",
            boxSizing: "border-box",
            background: "#ffffff",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              {t("help.title")}
            </h2>
            <div style={{ marginTop: 2, fontSize: 12, color: "#6b7280" }}>
              {t("help.subtitle")}
            </div>
          </div>

          <button
            type="button"
            title={t("help.close")}
            aria-label={t("help.close")}
            className="help-modal-close"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              border: "none",
              borderRadius: 8,
              background: "transparent",
              color: "#111827",
              cursor: "pointer",
            }}
          >
            <CloseSvgIcon />
          </button>
        </div>

        <div
          style={{
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "210px minmax(0, 1fr)",
          }}
        >
          <nav
            style={{
              borderRight: "1px solid #e5e7eb",
              background: "#f9fafb",
              padding: 10,
              boxSizing: "border-box",
              overflow: "auto",
            }}
          >
            <div
              style={{
                margin: "2px 8px 8px",
                fontSize: 11,
                fontWeight: 800,
                color: "#6b7280",
              }}
            >
              {t("help.contents")}
            </div>

            <div style={{ display: "grid", gap: 2 }}>
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className="help-modal-nav-link"
                  onClick={() => {
                    document.getElementById(section.id)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "7px 8px",
                    border: "none",
                    borderRadius: 8,
                    background: "transparent",
                    color: "#374151",
                    textAlign: "left",
                    fontSize: 13,
                    lineHeight: 1.3,
                    cursor: "pointer",
                  }}
                >
                  {section.title}
                </button>
              ))}
            </div>
          </nav>

          <div
            style={{
              minHeight: 0,
              overflow: "auto",
              padding: 18,
              boxSizing: "border-box",
              background: "#f3f4f6",
            }}
          >
            <div style={{ display: "grid", gap: 16 }}>
              {sections.map((section) => (
                <div key={section.id} id={section.id}>
                  {section.body}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
