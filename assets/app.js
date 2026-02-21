const SITE_PATH = "/content/site.json";
const VIDEOS_PATH = "/content/videos.json";
const DOCUMENTS_PATH = "/content/documents.json";

function byId(id) {
  return document.getElementById(id);
}

function makeSlug(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeInstagramEmbedUrl(input) {
  if (!input) return "";
  const raw = String(input).trim();
  if (raw.includes("/embed")) return raw;
  const cleaned = raw.endsWith("/") ? raw : `${raw}/`;
  if (!cleaned.includes("instagram.com")) return "";
  return `${cleaned}embed/`;
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

async function fetchJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
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

function renderVideoCategoriesNav(categories) {
  const nav = byId("video-category-nav");
  if (!nav) return;
  nav.innerHTML = "";
  categories.forEach((category) => {
    const link = document.createElement("a");
    link.className = "chip";
    link.href = `#cat-${makeSlug(category)}`;
    link.textContent = category;
    nav.appendChild(link);
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
    renderVideoCategoriesNav(preferredCategories || []);
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

  renderVideoCategoriesNav(orderedCategories);

  orderedCategories.forEach((category) => {
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

      if (!embedUrl && video.reelUrl) {
        const fallbackLink = document.createElement("a");
        fallbackLink.href = video.reelUrl;
        fallbackLink.target = "_blank";
        fallbackLink.rel = "noopener";
        fallbackLink.textContent = "Open reel";
        fallbackLink.className = "chip";
        card.appendChild(fallbackLink);
      }

      if (Array.isArray(video.relatedDocumentIds) && video.relatedDocumentIds.length > 0) {
        const related = document.createElement("div");
        related.className = "related-docs";

        video.relatedDocumentIds.forEach((id) => {
          const doc = docsById.get(id);
          if (!doc || !doc.downloadUrl) return;
          const link = document.createElement("a");
          link.href = doc.downloadUrl;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = `Related: ${doc.title}`;
          related.appendChild(link);
        });

        if (related.childNodes.length > 0) card.appendChild(related);
      }

      grid.appendChild(card);
    });

    section.appendChild(grid);
    root.appendChild(section);
  });
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

    const button = document.createElement("a");
    button.className = "btn";
    button.href = doc.downloadUrl || "#";
    button.target = "_blank";
    button.rel = "noopener";
    button.textContent = "Download";
    actions.appendChild(button);

    card.appendChild(actions);
    root.appendChild(card);
  });
}

function configureForm(site) {
  const form = byId("inquiry-form");
  const help = byId("form-help");
  if (!form || !help) return;

  const endpoint = site?.inquiryEndpoint || "";
  if (!endpoint) {
    help.textContent = "Set inquiryEndpoint in /content/site.json to receive form submissions by email.";
    return;
  }

  form.action = endpoint;

  if (site?.inquirySuccessRedirect) {
    const next = document.createElement("input");
    next.type = "hidden";
    next.name = "_next";
    next.value = site.inquirySuccessRedirect;
    form.appendChild(next);
  }

  if (endpoint.includes("YOUR_EMAIL") || endpoint.includes("your-email")) {
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

async function init() {
  configureMobileMenu();

  const [site, videos, documents] = await Promise.all([
    fetchJson(SITE_PATH, {}),
    fetchJson(VIDEOS_PATH, []),
    fetchJson(DOCUMENTS_PATH, [])
  ]);

  setHomeCopy(site);
  renderVideos(videos, documents, site.defaultVideoCategories || []);
  renderDocuments(documents);
  configureForm(site);

  const year = byId("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

init();
