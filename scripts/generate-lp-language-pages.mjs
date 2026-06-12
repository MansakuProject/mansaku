import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] || "dist";
const siteUrl = "https://mansaku.pages.dev";
const indexPath = path.join(outDir, "index.html");

const languages = {
  ja: {
    lang: "ja",
    hreflang: "ja",
    ogLocale: "ja_JP",
    title: "Mansaku - 漫画ページ制作ツール",
    description: "Mansakuは、お気に入りの画像を並べて漫画ページを作れるツールです。コマ割り、吹き出し、効果音、画像配置をまとめて扱え、PNG・PDFで出力できます。",
    ogDescription: "お気に入りの画像を並べて漫画ページを作れるツール。コマ割り、吹き出し、効果音、画像配置、PNG・PDF出力に対応。",
    imageAlt: "Mansaku の画面イメージ",
  },
  en: {
    lang: "en",
    hreflang: "en",
    ogLocale: "en_US",
    title: "Mansaku - Manga Page Creator",
    description: "Mansaku is a tool for arranging your favorite images into manga pages. It supports panels, speech bubbles, sound effects, image positioning, and PNG/PDF export.",
    ogDescription: "A tool for arranging your favorite images into manga pages. Supports panels, speech bubbles, sound effects, image positioning, and PNG/PDF export.",
    imageAlt: "Mansaku screen preview",
  },
  ko: {
    lang: "ko",
    hreflang: "ko",
    ogLocale: "ko_KR",
    title: "Mansaku - 만화 페이지 제작 도구",
    description: "Mansaku는 좋아하는 이미지를 배치해 만화 페이지를 만들 수 있는 도구입니다. 칸, 말풍선, 효과음, 이미지 배치, PNG/PDF 출력에 대응합니다.",
    ogDescription: "좋아하는 이미지를 배치해 만화 페이지를 만들 수 있는 도구. 칸, 말풍선, 효과음, 이미지 배치, PNG/PDF 출력에 대응합니다.",
    imageAlt: "Mansaku 화면 미리보기",
  },
  zh: {
    lang: "zh-CN",
    hreflang: "zh-CN",
    ogLocale: "zh_CN",
    title: "Mansaku - 漫画页面制作工具",
    description: "Mansaku 是一款可将喜欢的图片排列成漫画页面的工具。支持分格、气泡、音效文字、图像布局以及 PNG/PDF 导出。",
    ogDescription: "可将喜欢的图片排列成漫画页面的工具。支持分格、气泡、音效文字、图像布局以及 PNG/PDF 导出。",
    imageAlt: "Mansaku 画面预览",
  },
  fr: {
    lang: "fr",
    hreflang: "fr",
    ogLocale: "fr_FR",
    title: "Mansaku - Créateur de pages manga",
    description: "Mansaku est un outil pour organiser vos images favorites en pages manga. Il prend en charge les cases, bulles, effets sonores, placement d’images et l’export PNG/PDF.",
    ogDescription: "Un outil pour organiser vos images favorites en pages manga. Cases, bulles, effets sonores, placement d’images et export PNG/PDF.",
    imageAlt: "Aperçu de l’écran Mansaku",
  },
  ru: {
    lang: "ru",
    hreflang: "ru",
    ogLocale: "ru_RU",
    title: "Mansaku - инструмент создания страниц манги",
    description: "Mansaku — инструмент для создания страниц манги из ваших изображений. Поддерживает панели, облачка, звуковые эффекты, размещение изображений и экспорт PNG/PDF.",
    ogDescription: "Инструмент для создания страниц манги из ваших изображений. Панели, облачка, звуковые эффекты, размещение изображений и экспорт PNG/PDF.",
    imageAlt: "Предпросмотр экрана Mansaku",
  },
  es: {
    lang: "es",
    hreflang: "es",
    ogLocale: "es_ES",
    title: "Mansaku - creador de páginas manga",
    description: "Mansaku es una herramienta para organizar tus imágenes favoritas en páginas manga. Soporta viñetas, globos, efectos sonoros, colocación de imágenes y exportación PNG/PDF.",
    ogDescription: "Una herramienta para organizar tus imágenes favoritas en páginas manga. Viñetas, globos, efectos sonoros, colocación de imágenes y exportación PNG/PDF.",
    imageAlt: "Vista previa de Mansaku",
  },
  de: {
    lang: "de",
    hreflang: "de",
    ogLocale: "de_DE",
    title: "Mansaku - Manga-Seitenersteller",
    description: "Mansaku ist ein Tool, um Lieblingsbilder zu Manga-Seiten anzuordnen. Es unterstützt Panels, Sprechblasen, Soundeffekte, Bildplatzierung und PNG/PDF-Export.",
    ogDescription: "Ein Tool, um Lieblingsbilder zu Manga-Seiten anzuordnen. Panels, Sprechblasen, Soundeffekte, Bildplatzierung und PNG/PDF-Export.",
    imageAlt: "Mansaku Bildschirmvorschau",
  },
};

function escapeAttr(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceOrInsertHead(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/head>/, `    ${tag}\n  </head>`);
}

function setTitle(html, title) {
  return html.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(title)}</title>`);
}

function setHtmlLang(html, lang) {
  return html.replace(/<html lang="[^"]*">/, `<html lang="${escapeAttr(lang)}">`);
}

function setMetaName(html, name, content) {
  const tag = `<meta name="${name}" content="${escapeAttr(content)}" />`;
  return replaceOrInsertHead(
    html,
    new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*"\\s*\\/>`),
    tag
  );
}

function setMetaProperty(html, property, content) {
  const tag = `<meta property="${property}" content="${escapeAttr(content)}" />`;
  return replaceOrInsertHead(
    html,
    new RegExp(`<meta\\s+property="${property}"\\s+content="[^"]*"\\s*\\/>`),
    tag
  );
}

function setLinkRel(html, rel, href) {
  const tag = `<link rel="${rel}" href="${escapeAttr(href)}" />`;
  return replaceOrInsertHead(
    html,
    new RegExp(`<link\\s+rel="${rel}"\\s+href="[^"]*"\\s*\\/>`),
    tag
  );
}

function buildAlternateLinks() {
  const links = Object.entries(languages).map(([code, data]) => {
    return `<link rel="alternate" hreflang="${data.hreflang}" href="${siteUrl}/${code}/" />`;
  });

  links.push(`<link rel="alternate" hreflang="x-default" href="${siteUrl}/ja/" />`);
  return links.join("\n    ");
}

function replaceAlternateLinks(html) {
  return html.replace(
    /\s*<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href="[^"]+"\s*\/>/g,
    ""
  ).replace(/<meta property="og:title"/, `${buildAlternateLinks()}\n\n    <meta property="og:title"`);
}

function withLanguageMeta(baseHtml, code, data) {
  const url = `${siteUrl}/${code}/`;
  let html = baseHtml;

  html = setHtmlLang(html, data.lang);
  html = setTitle(html, data.title);
  html = setMetaName(html, "description", data.description);
  html = setLinkRel(html, "canonical", url);
  html = replaceAlternateLinks(html);

  html = setMetaProperty(html, "og:type", "website");
  html = setMetaProperty(html, "og:site_name", "Mansaku");
  html = setMetaProperty(html, "og:locale", data.ogLocale);
  html = setMetaProperty(html, "og:title", data.title);
  html = setMetaProperty(html, "og:description", data.ogDescription);
  html = setMetaProperty(html, "og:url", url);
  html = setMetaProperty(html, "og:image:alt", data.imageAlt);

  html = setMetaName(html, "twitter:title", data.title);
  html = setMetaName(html, "twitter:description", data.ogDescription);

  return html;
}

function writeSitemap() {
  const urls = Object.keys(languages)
    .map((code) => `  <url>\n    <loc>${siteUrl}/${code}/</loc>\n  </url>`)
    .join("\n");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n  <url>\n    <loc>${siteUrl}/app</loc>\n  </url>\n</urlset>\n`;

  fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap);
}

if (!fs.existsSync(indexPath)) {
  console.error(`index.html not found: ${indexPath}`);
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexPath, "utf8");

for (const [code, data] of Object.entries(languages)) {
  const html = withLanguageMeta(baseHtml, code, data);
  const targetDir = path.join(outDir, code);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "index.html"), html);
}

fs.writeFileSync(indexPath, withLanguageMeta(baseHtml, "ja", languages.ja));
writeSitemap();

console.log(`Generated ${Object.keys(languages).length} multilingual SEO landing pages in ${outDir}`);
