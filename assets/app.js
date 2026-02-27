const SITE_PATH = "/content/site.json";
const VIDEOS_PATH = "/content/videos.json";
const DOCUMENTS_PATH = "/content/documents.json";
const PUBLIC_CONTENT_API_PATH = "/api/public-content";

// Initialize Supabase Client
const config = window.BUILDERBALLERY_CONFIG || {};
const supabaseUrl = String(config.SUPABASE_URL || "https://onahtndmilugzhjwjtam.supabase.co").trim();
const supabaseKey = String(
  config.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uYWh0bmRtaWx1Z3poandqdGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Mzk3NjksImV4cCI6MjA4NzIxNTc2OX0.o5vDHODt9V435xEzv2hyWX_QznZ27XvzVhGuy6InU3U"
).trim();
const storageBucket = String(config.SUPABASE_STORAGE_BUCKET || "documents").trim() || "documents";
// The object exposed by the CDN is window.supabase
const supabaseClient = window.supabase && window.supabase.createClient
  ? supabaseUrl && supabaseKey
    ? window.supabase.createClient(supabaseUrl, supabaseKey)
    : null
  : null;

let activeVideoCategory = "";
function byId(id) {
  return document.getElementById(id);
}

function isReloadNavigation() {
  const entries = typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
    ? performance.getEntriesByType("navigation")
    : [];

  if (Array.isArray(entries) && entries.length > 0) {
    return entries[0] && entries[0].type === "reload";
  }

  // Legacy fallback for older engines.
  return Boolean(
    typeof performance !== "undefined" &&
      performance.navigation &&
      performance.navigation.type === 1
  );
}

function resetToHeroOnReload() {
  if (!isReloadNavigation()) return;

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  if (window.location.hash) {
    window.history.replaceState(null, document.title, cleanUrl);
  }

  const scrollTopNow = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  };

  scrollTopNow();
  requestAnimationFrame(scrollTopNow);
  window.addEventListener("load", scrollTopNow, { once: true });
}

function makeSlug(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripFileExtension(name) {
  return String(name || "").replace(/\.[^.]+$/, "");
}

function humanizeStorageFileName(name) {
  return stripFileExtension(name)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encodePath(path) {
  return String(path || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildPublicStorageUrl(bucket, objectPath) {
  if (!supabaseUrl || !bucket || !objectPath) return "";
  const safeBucket = encodeURIComponent(String(bucket).trim());
  const safePath = encodePath(objectPath);
  return `${supabaseUrl}/storage/v1/object/public/${safeBucket}/${safePath}`;
}

function normalizeInstagramEmbedUrl(input) {
  if (!input) return "";
  const raw = String(input).trim();

  try {
    const parsed = raw.startsWith("http")
      ? new URL(raw)
      : new URL(`https://www.instagram.com/${raw.replace(/^\/+/, "")}`);

    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (hostname !== "instagram.com") return "";

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return "";

    const type = segments[0];
    const id = segments[1];
    if (!["reel", "p", "tv"].includes(type) || !id) return "";

    return `https://www.instagram.com/${type}/${id}/embed/captioned/`;
  } catch (error) {
    return "";
  }
}

function normalizeInstagramPublicUrl(input) {
  if (!input) return "";
  const raw = String(input).trim();

  try {
    const parsed = raw.startsWith("http")
      ? new URL(raw)
      : new URL(`https://www.instagram.com/${raw.replace(/^\/+/, "")}`);

    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (hostname !== "instagram.com") return "";

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return "";

    const type = segments[0];
    const id = segments[1];
    if (!["reel", "p", "tv"].includes(type) || !id) return "";

    return `https://www.instagram.com/${type}/${id}/`;
  } catch (error) {
    return "";
  }
}

function normalizeSafeUrl(input, { allowRelative = false } = {}) {
  if (!input) return "";
  const raw = String(input).trim();
  if (!raw) return "";

  if (allowRelative && raw.startsWith("/")) {
    if (raw.startsWith("//")) return "";
    return raw;
  }

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function buildMaskedDocumentPath(doc) {
  const title = doc && doc.title ? doc.title : "";
  const id = doc && doc.id ? doc.id : "";
  const slug = makeSlug(title || id || "document");
  return `/documents/${slug || "document"}`;
}

function extractUrlFilename(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    const segment = decodeURIComponent(parsed.pathname.split("/").pop() || "").trim();
    return segment || "document";
  } catch (error) {
    return "document";
  }
}

function buildDownloadFilename(doc, url) {
  const fallback = extractUrlFilename(url);
  const titleSlug = makeSlug(doc && doc.title ? doc.title : "");
  if (!titleSlug) return fallback;

  const extensionMatch = fallback.match(/\.([a-z0-9]{1,8})$/i);
  if (!extensionMatch) return titleSlug;
  return `${titleSlug}.${extensionMatch[1].toLowerCase()}`;
}

async function downloadDocumentToDevice(url, fileName) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName || "document";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

function formatDate(dateValue) {
  if (!dateValue) return "Date not set";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(date);
}

function mergeDocumentSources(primary, secondary) {
  const merged = [];
  const seen = new Set();
  const sources = [primary, secondary];

  sources.forEach((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const doc = item || {};
      const key = String(doc.downloadUrl || doc.id || "").trim().toLowerCase();
      if (key && seen.has(key)) return;
      if (key) seen.add(key);
      merged.push(doc);
    });
  });

  return merged;
}

function normalizeVideoRow(row) {
  return {
    id: row && (row.id || null),
    title: row && row.title ? row.title : "",
    category: row && row.category ? row.category : "General",
    reelUrl: row && (row.reelUrl || row.reel_url) ? (row.reelUrl || row.reel_url) : "",
    summary: row && row.summary ? row.summary : "",
    relatedDocumentIds: Array.isArray(row && (row.relatedDocumentIds || row.related_document_ids))
      ? (row.relatedDocumentIds || row.related_document_ids)
      : []
  };
}

function normalizeDocumentRow(row) {
  return {
    id: row && row.id ? row.id : "",
    title: row && row.title ? row.title : "",
    description: row && row.description ? row.description : "",
    date: row && row.date ? row.date : "",
    downloadUrl: row && (row.downloadUrl || row.download_url) ? (row.downloadUrl || row.download_url) : ""
  };
}

function normalizeVideoRows(rows) {
  return Array.isArray(rows)
    ? rows.map((row) => normalizeVideoRow(row))
    : [];
}

function normalizeDocumentRows(rows) {
  return Array.isArray(rows)
    ? rows.map((row) => normalizeDocumentRow(row))
    : [];
}

async function fetchJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return fallback;
    return await response.json();
  } catch (error) {
    return fallback;
  }
}

async function fetchPublicContentBundle() {
  try {
    const response = await fetch(PUBLIC_CONTENT_API_PATH, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return {
      videos: normalizeVideoRows(payload && payload.videos),
      documents: normalizeDocumentRows(payload && payload.documents)
    };
  } catch (error) {
    return null;
  }
}

function withTimeout(promise, timeoutMs, fallbackValue) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallbackValue);
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((_error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

async function fetchRowsViaRest(tableName) {
  if (!supabaseUrl || !supabaseKey) return [];

  try {
    const endpoint = `${supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}?select=*`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      },
      cache: "no-store"
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

async function fetchSupabaseRows(tableName) {
  if (supabaseClient) {
    return withTimeout(
      (async () => {
        try {
          const { data, error } = await supabaseClient.from(tableName).select("*");
          if (!error && Array.isArray(data) && data.length > 0) {
            return data;
          }
          return fetchRowsViaRest(tableName);
        } catch (error) {
          return fetchRowsViaRest(tableName);
        }
      })(),
      7000,
      []
    );
  }

  return withTimeout(fetchRowsViaRest(tableName), 7000, []);
}

async function fetchStorageDocuments() {
  if (!supabaseUrl || !supabaseKey || !storageBucket) return [];

  return withTimeout(
    (async () => {
      try {
        const endpoint = `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(storageBucket)}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            prefix: "uploads",
            limit: 200,
            offset: 0,
            sortBy: { column: "created_at", order: "desc" }
          }),
          cache: "no-store"
        });

        if (!response.ok) return [];
        const rows = await response.json();
        if (!Array.isArray(rows)) return [];

        return rows
          .map((row) => {
            const fileName = String(row && row.name ? row.name : "").trim();
            if (!fileName || fileName.endsWith("/")) return null;

            const objectPath = `uploads/${fileName}`;
            const downloadUrl = buildPublicStorageUrl(storageBucket, objectPath);
            if (!downloadUrl) return null;

            const rawDate = String(
              (row && (row.updated_at || row.created_at || row.last_accessed_at)) || ""
            ).trim();

            return {
              id: `storage-${makeSlug(fileName)}`,
              title: humanizeStorageFileName(fileName) || "Uploaded Document",
              description: "Uploaded reference document.",
              date: rawDate ? rawDate.slice(0, 10) : "",
              downloadUrl
            };
          })
          .filter(Boolean);
      } catch (error) {
        return [];
      }
    })(),
    7000,
    []
  );
}

function setHomeCopy(site) {
  if (!site) return;
  const headline = byId("hero-headline");
  const bio = byId("hero-bio");
  const intro = byId("hero-intro");
  if (headline && site.headline) headline.textContent = site.headline;
  if (bio && site.bioParagraph) bio.textContent = site.bioParagraph;
  if (intro && site.introParagraph) intro.textContent = site.introParagraph;
  if (site.personName) {
    document.title = `${site.personName} | Civil Engineer & Residential Construction Specialist`;
  }
}

function renderVideoCategoriesNav(categories, activeCategory, onSelect) {
  const nav = byId("video-category-nav");
  if (!nav) return;
  nav.innerHTML = "";
  if (!Array.isArray(categories) || categories.length === 0) return;

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip chip-filter${category === activeCategory ? " is-active" : ""}`;
    button.textContent = category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => {
      if (typeof onSelect === "function") {
        onSelect(category, button);
      }
    });
    nav.appendChild(button);
  });
}

function renderVideos(videos, documents, preferredCategories) {
  const root = byId("videos-content");
  if (!root) return;
  root.innerHTML = "";

  if (!Array.isArray(videos) || videos.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No reels added yet. Open Content Manager to add Instagram video entries by category.";
    root.appendChild(empty);
    renderVideoCategoriesNav(preferredCategories || [], "", null);
    return;
  }

  const docsById = new Map((documents || []).map((doc) => [doc.id, doc]));
  const grouped = new Map();

  videos.forEach((video) => {
    const category = video.category || "General";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(video);
  });

  const discovered = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
  const preferred = (preferredCategories || []).filter((name) => grouped.has(name));
  const remaining = discovered.filter((name) => !preferred.includes(name));
  const orderedCategories = [...preferred, ...remaining];

  if (!activeVideoCategory || !grouped.has(activeVideoCategory)) {
    activeVideoCategory = orderedCategories[0] || "";
  }

  renderVideoCategoriesNav(orderedCategories, activeVideoCategory, (category, button) => {
    if (category === activeVideoCategory) return;
    activeVideoCategory = category;
    renderVideos(videos, documents, preferredCategories);
    if (button && typeof button.scrollIntoView === "function") {
      button.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  });

  if (!activeVideoCategory || !grouped.has(activeVideoCategory)) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No reels available in this category.";
    root.appendChild(empty);
    return;
  }

  const category = activeVideoCategory;
  const section = document.createElement("section");
  section.className = "video-category";
  section.id = `cat-${makeSlug(category)}`;

  const title = document.createElement("h3");
  title.textContent = category;
  section.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "video-grid";

  grouped.get(category).forEach((video) => {
    const card = document.createElement("article");
    card.className = "video-card";

    const iframe = document.createElement("iframe");
    iframe.className = "video-frame";
    iframe.loading = "lazy";
    iframe.allowFullscreen = true;
    iframe.setAttribute(
      "allow",
      "autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share"
    );
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.scrolling = "no";
    iframe.title = video.title || `${category} reel`;
    const embedUrl = normalizeInstagramEmbedUrl(video.reelUrl);
    if (embedUrl) {
      iframe.src = embedUrl;
    }
    card.appendChild(iframe);

    const videoTitle = document.createElement("h4");
    videoTitle.textContent = video.title || "Construction Reel";
    card.appendChild(videoTitle);

    const summary = document.createElement("p");
    summary.textContent = video.summary || "Summary not added yet.";
    card.appendChild(summary);

    const publicReelUrl = normalizeInstagramPublicUrl(video.reelUrl);
    if (publicReelUrl) {
      const fallbackLink = document.createElement("a");
      fallbackLink.href = publicReelUrl;
      fallbackLink.target = "_blank";
      fallbackLink.rel = "noopener noreferrer";
      fallbackLink.textContent = embedUrl ? "Watch on Instagram" : "Open reel";
      fallbackLink.className = "chip";
      card.appendChild(fallbackLink);
    }

    if (Array.isArray(video.relatedDocumentIds) && video.relatedDocumentIds.length > 0) {
      const related = document.createElement("div");
      related.className = "related-docs";

      video.relatedDocumentIds.forEach((id) => {
        const doc = docsById.get(id);
        const docUrl = doc && doc.downloadUrl ? doc.downloadUrl : "";
        const safeDocUrl = normalizeSafeUrl(docUrl, { allowRelative: true });
        if (!doc || !safeDocUrl) return;
        const link = document.createElement("a");
        link.href = safeDocUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `Related: ${doc.title}`;
        related.appendChild(link);
      });

      if (related.childNodes.length > 0) card.appendChild(related);
    }

    grid.appendChild(card);
  });

  section.appendChild(grid);
  root.appendChild(section);
}

function renderDocuments(documents) {
  const root = byId("documents-content");
  if (!root) return;
  root.innerHTML = "";

  if (!Array.isArray(documents) || documents.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No documents added yet. Add PDFs and metadata from the Content Manager.";
    root.appendChild(empty);
    return;
  }

  const sorted = [...documents].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da;
  });

  sorted.forEach((doc) => {
    const safeDownloadUrl = normalizeSafeUrl(doc.downloadUrl, { allowRelative: true });
    const maskedPath = buildMaskedDocumentPath(doc);
    const card = document.createElement("article");
    card.className = "doc-card";

    const title = document.createElement("h3");
    title.textContent = doc.title || "Untitled Document";
    card.appendChild(title);

    const description = document.createElement("p");
    description.textContent = doc.description || "Description not added.";
    card.appendChild(description);

    const meta = document.createElement("p");
    meta.className = "doc-meta";
    meta.textContent = `Date: ${formatDate(doc.date)}`;
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "doc-actions";

    const viewButton = document.createElement("a");
    viewButton.className = "btn btn-secondary";
    viewButton.href = maskedPath;
    viewButton.dataset.docAction = "view";
    viewButton.dataset.docUrl = safeDownloadUrl;
    viewButton.textContent = "View";
    if (safeDownloadUrl) actions.appendChild(viewButton);

    const downloadButton = document.createElement("a");
    downloadButton.className = "btn";
    downloadButton.href = `${maskedPath}?download=1`;
    downloadButton.dataset.docAction = "download";
    downloadButton.dataset.docUrl = safeDownloadUrl;
    downloadButton.dataset.docFilename = buildDownloadFilename(doc, safeDownloadUrl);
    downloadButton.textContent = "Download";
    if (safeDownloadUrl) {
      actions.appendChild(downloadButton);
    } else {
      const invalid = document.createElement("p");
      invalid.className = "doc-invalid-link";
      invalid.textContent = "Download link unavailable.";
      actions.appendChild(invalid);
    }

    card.appendChild(actions);
    root.appendChild(card);
  });
}

function configureForm(site) {
  const form = byId("inquiry-form");
  const help = byId("form-help");
  if (!form || !help) return;

  const endpoint = String(site && site.inquiryEndpoint ? site.inquiryEndpoint : "").trim();
  const safeEndpoint = normalizeSafeUrl(endpoint);
  if (!safeEndpoint) {
    help.textContent = "Set inquiryEndpoint in /content/site.json to receive form submissions by email.";
    return;
  }

  form.action = safeEndpoint;

  if (site && site.inquirySuccessRedirect) {
    const next = document.createElement("input");
    next.type = "hidden";
    next.name = "_next";
    next.value = site.inquirySuccessRedirect;
    form.appendChild(next);
  }

  if (safeEndpoint.includes("YOUR_EMAIL") || safeEndpoint.includes("your-email")) {
    help.textContent = "Update inquiryEndpoint in /content/site.json with your actual email endpoint before going live.";
  } else {
    help.textContent = "After submit, details are delivered to your configured email endpoint.";
  }
}

function configureMobileMenu() {
  const header = document.querySelector(".site-header");
  const toggle = byId("mobile-menu-toggle");
  const nav = byId("primary-nav");
  if (!header || !toggle || !nav) return;

  const closeMenu = () => {
    header.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const shouldOpen = !header.classList.contains("menu-open");
    header.classList.toggle("menu-open", shouldOpen);
    toggle.setAttribute("aria-expanded", String(shouldOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!header.classList.contains("menu-open")) return;
    if (target instanceof Node && header.contains(target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  if (typeof window.matchMedia !== "function") return;
  const desktopMq = window.matchMedia("(min-width: 760px)");
  const handleDesktop = (event) => {
    if (event.matches) closeMenu();
  };
  if (typeof desktopMq.addEventListener === "function") {
    desktopMq.addEventListener("change", handleDesktop);
  } else if (typeof desktopMq.addListener === "function") {
    desktopMq.addListener(handleDesktop);
  }
}

function configureWhatsApp(site) {
  const button = byId("whatsapp-float");
  if (!button) return;

  const link = String(
    (site && site.whatsappLink) ||
      "https://wa.me/919019707029?text=Hi%20Builder%20Ballery%2C%20I%20need%20consultation%20for%20my%20home%20construction."
  ).trim();
  const safeLink = normalizeSafeUrl(link);

  if (safeLink) {
    button.href = safeLink;
  }
}

function configureTopButton() {
  const button = byId("top-float");
  if (!button) return;

  const updateVisibility = () => {
    button.classList.toggle("is-visible", window.scrollY > 460);
  };

  updateVisibility();
  window.addEventListener("scroll", updateVisibility, { passive: true });
}

function wireDocumentActions() {
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const link = target.closest("a[data-doc-action]");
    if (!(link instanceof HTMLAnchorElement)) return;

    const url = String(link.dataset.docUrl || "").trim();
    const action = String(link.dataset.docAction || "").trim();
    if (!url) return;

    event.preventDefault();

    if (action === "view") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (action === "download") {
      const fileName = String(link.dataset.docFilename || "document").trim();
      try {
        await downloadDocumentToDevice(url, fileName);
      } catch (error) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  });
}

async function init() {
  resetToHeroOnReload();
  configureMobileMenu();
  wireDocumentActions();

  const [siteResponse, fallbackVideos, fallbackDocuments] = await Promise.all([
    fetchJson(SITE_PATH, {}),
    fetchJson(VIDEOS_PATH, []),
    fetchJson(DOCUMENTS_PATH, [])
  ]);

  const site = siteResponse || {};
  const categories = site.defaultVideoCategories || [];

  setHomeCopy(site);
  renderVideos(fallbackVideos, fallbackDocuments, categories);
  renderDocuments(fallbackDocuments);
  configureForm(site);
  configureWhatsApp(site);
  configureTopButton();

  const year = byId("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const apiBundle = await withTimeout(fetchPublicContentBundle(), 7000, null);
  if (apiBundle) {
    const apiVideos = Array.isArray(apiBundle.videos) ? apiBundle.videos : [];
    const apiDocuments = Array.isArray(apiBundle.documents) ? apiBundle.documents : [];
    if (apiVideos.length > 0 || apiDocuments.length > 0) {
      const videosFromApi = apiVideos.length > 0 ? apiVideos : fallbackVideos;
      const documentsFromApi = apiDocuments.length > 0 ? apiDocuments : fallbackDocuments;
      renderVideos(videosFromApi, documentsFromApi, categories);
      renderDocuments(documentsFromApi);
      return;
    }
  }

  const [dbVideos, dbDocuments, storageDocuments] = await Promise.all([
    fetchSupabaseRows("videos"),
    fetchSupabaseRows("documents"),
    fetchStorageDocuments()
  ]);

  const videos = Array.isArray(dbVideos) && dbVideos.length > 0 ? dbVideos : fallbackVideos;
  const documentsFromDb = Array.isArray(dbDocuments) ? dbDocuments : [];
  const documentsFromStorage = Array.isArray(storageDocuments) ? storageDocuments : [];
  const mergedDocuments = mergeDocumentSources(documentsFromDb, documentsFromStorage);
  const documents = mergedDocuments.length > 0 ? mergedDocuments : fallbackDocuments;

  renderVideos(videos, documents, categories);
  renderDocuments(documents);
}

init().catch((error) => {
  console.error("Builder Ballery bootstrap failed", error);
});
