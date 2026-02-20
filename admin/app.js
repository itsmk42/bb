const videosPath = "/content/videos.json";
const docsPath = "/content/documents.json";

let videos = [];
let documents = [];

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderVideos() {
  const root = byId("videos-list");
  root.innerHTML = "";
  if (videos.length === 0) {
    root.innerHTML = '<p class="list-item">No video entries yet.</p>';
    return;
  }

  videos.forEach((video, index) => {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `
      <strong>${escapeHtml(video.title)}</strong>
      <p>Category: ${escapeHtml(video.category)}</p>
      <p>Reel: ${escapeHtml(video.reelUrl)}</p>
      <p>${escapeHtml(video.summary)}</p>
      <p>Related docs: ${escapeHtml((video.relatedDocumentIds || []).join(", ") || "None")}</p>
      <div class="list-actions">
        <button type="button" data-type="video" data-index="${index}">Delete</button>
      </div>
    `;
    root.appendChild(item);
  });
}

function renderDocuments() {
  const root = byId("docs-list");
  root.innerHTML = "";
  if (documents.length === 0) {
    root.innerHTML = '<p class="list-item">No document entries yet.</p>';
    return;
  }

  documents.forEach((doc, index) => {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `
      <strong>${escapeHtml(doc.title)}</strong>
      <p>ID: ${escapeHtml(doc.id)}</p>
      <p>Date: ${escapeHtml(doc.date)}</p>
      <p>${escapeHtml(doc.description)}</p>
      <p>URL: ${escapeHtml(doc.downloadUrl)}</p>
      <div class="list-actions">
        <button type="button" data-type="doc" data-index="${index}">Delete</button>
      </div>
    `;
    root.appendChild(item);
  });
}

function wireForms() {
  const videoForm = byId("video-form");
  const docForm = byId("doc-form");

  videoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(videoForm);
    const relatedDocInput = String(formData.get("relatedDocumentIds") || "");
    const relatedDocumentIds = relatedDocInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    videos.push({
      title: String(formData.get("title") || "").trim(),
      category: String(formData.get("category") || "").trim(),
      reelUrl: String(formData.get("reelUrl") || "").trim(),
      summary: String(formData.get("summary") || "").trim(),
      relatedDocumentIds
    });

    videoForm.reset();
    renderVideos();
  });

  docForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(docForm);
    documents.push({
      id: String(formData.get("id") || "").trim(),
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      date: String(formData.get("date") || "").trim(),
      downloadUrl: String(formData.get("downloadUrl") || "").trim()
    });

    docForm.reset();
    renderDocuments();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const { type, index } = target.dataset;
    if (type === "video") {
      videos.splice(Number(index), 1);
      renderVideos();
    }
    if (type === "doc") {
      documents.splice(Number(index), 1);
      renderDocuments();
    }
  });

  byId("download-videos").addEventListener("click", () => {
    downloadJson("videos.json", videos);
  });

  byId("download-docs").addEventListener("click", () => {
    downloadJson("documents.json", documents);
  });
}

async function init() {
  [videos, documents] = await Promise.all([
    fetchJson(videosPath, []),
    fetchJson(docsPath, [])
  ]);

  renderVideos();
  renderDocuments();
  wireForms();
}

init();
