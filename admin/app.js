const config = window.BUILDERBALLERY_CONFIG || {};
const supabaseUrl = String(config.SUPABASE_URL || "https://onahtndmilugzhjwjtam.supabase.co").trim();
const supabaseKey = String(
  config.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uYWh0bmRtaWx1Z3poandqdGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Mzk3NjksImV4cCI6MjA4NzIxNTc2OX0.o5vDHODt9V435xEzv2hyWX_QznZ27XvzVhGuy6InU3U"
).trim();
const storageBucket = String(config.SUPABASE_STORAGE_BUCKET || "documents").trim() || "documents";

const supabaseClient = window.supabase?.createClient
  ? supabaseUrl && supabaseKey
    ? window.supabase.createClient(supabaseUrl, supabaseKey)
    : null
  : null;

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

function makeSlug(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRelatedDocumentIds(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function setStatus(id, message, type = "info") {
  const node = byId(id);
  if (!node) return;
  node.textContent = message || "";
  node.className = `status ${message ? `status-${type}` : ""}`.trim();
}

function setAuthStatus(message, type = "info") {
  setStatus("auth-status", message, type);
}

function setManagerStatus(message, type = "info") {
  setStatus("manager-status", message, type);
}

function toggleManager(session) {
  const authPanel = byId("auth-panel");
  const managerPanel = byId("manager-panel");
  const userEmail = byId("user-email");

  if (!authPanel || !managerPanel || !userEmail) return;

  const isSignedIn = Boolean(session?.user);
  authPanel.classList.toggle("hidden", isSignedIn);
  managerPanel.classList.toggle("hidden", !isSignedIn);

  if (isSignedIn) {
    userEmail.textContent = session.user.email || "Authenticated user";
  } else {
    userEmail.textContent = "-";
  }
}

function mapVideoRow(row) {
  return {
    id: row.id ?? null,
    title: row.title ?? "",
    category: row.category ?? "General",
    reelUrl: row.reelUrl ?? row.reel_url ?? "",
    summary: row.summary ?? "",
    relatedDocumentIds: normalizeRelatedDocumentIds(row.relatedDocumentIds ?? row.related_document_ids)
  };
}

function mapDocumentRow(row) {
  return {
    id: row.id ?? "",
    title: row.title ?? "",
    description: row.description ?? "",
    date: row.date ?? "",
    downloadUrl: row.downloadUrl ?? row.download_url ?? ""
  };
}

function formatDate(value) {
  if (!value) return "Date not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(parsed);
}

function renderVideos() {
  const root = byId("videos-list");
  if (!root) return;

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
      <p><span>Category:</span> ${escapeHtml(video.category)}</p>
      <p><span>Reel:</span> <a href="${escapeHtml(video.reelUrl)}" target="_blank" rel="noopener">Open</a></p>
      <p>${escapeHtml(video.summary)}</p>
      <p><span>Related docs:</span> ${escapeHtml((video.relatedDocumentIds || []).join(", ") || "None")}</p>
      <div class="list-actions">
        <button class="btn btn-danger" type="button" data-action="delete-video" data-index="${index}">Delete</button>
      </div>
    `;
    root.appendChild(item);
  });
}

function renderDocuments() {
  const root = byId("docs-list");
  if (!root) return;

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
      <p><span>ID:</span> ${escapeHtml(doc.id)}</p>
      <p><span>Date:</span> ${escapeHtml(formatDate(doc.date))}</p>
      <p>${escapeHtml(doc.description)}</p>
      <p><span>Download:</span> <a href="${escapeHtml(doc.downloadUrl)}" target="_blank" rel="noopener">Open file</a></p>
      <div class="list-actions">
        <button class="btn btn-danger" type="button" data-action="delete-doc" data-index="${index}">Delete</button>
      </div>
    `;
    root.appendChild(item);
  });
}

async function fetchTableRows(tableName) {
  const { data, error } = await supabaseClient.from(tableName).select("*");
  if (error) {
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

async function loadContent() {
  const [videoRows, documentRows] = await Promise.all([
    fetchTableRows("videos"),
    fetchTableRows("documents")
  ]);

  videos = videoRows
    .map(mapVideoRow)
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

  documents = documentRows
    .map(mapDocumentRow)
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  renderVideos();
  renderDocuments();
}

function extractStoragePathFromUrl(downloadUrl) {
  try {
    const parsed = new URL(downloadUrl);
    const token = `/storage/v1/object/public/${storageBucket}/`;
    const index = parsed.pathname.indexOf(token);
    if (index === -1) return "";
    return decodeURIComponent(parsed.pathname.slice(index + token.length));
  } catch {
    return "";
  }
}

async function uploadDocumentFile(file) {
  const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const path = `uploads/${Date.now()}-${makeSlug(baseName)}${extension.toLowerCase()}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(storageBucket)
    .upload(path, file, { upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabaseClient.storage.from(storageBucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

async function handleSignIn(event) {
  event.preventDefault();
  setAuthStatus("", "info");

  const form = event.currentTarget;
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    setAuthStatus("Email and password are required.", "error");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    const message = String(error.message || "Sign in failed.");
    if (error.code === "email_not_confirmed" || /email not confirmed|email not verified/i.test(message)) {
      setAuthStatus(
        "Email verification is still pending for this account. Confirm the user in Supabase Authentication -> Users, then refresh and try again.",
        "error"
      );
    } else {
      setAuthStatus(message, "error");
    }
    return;
  }

  form.reset();
  setAuthStatus("Signed in successfully.", "success");
}

async function handleSignOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setManagerStatus(error.message, "error");
    return;
  }
  setManagerStatus("Signed out.", "info");
}

async function handleVideoSubmit(event) {
  event.preventDefault();
  setManagerStatus("", "info");

  const form = event.currentTarget;
  const formData = new FormData(form);

  const payload = {
    title: String(formData.get("title") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    reelUrl: String(formData.get("reelUrl") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    relatedDocumentIds: normalizeRelatedDocumentIds(formData.get("relatedDocumentIds"))
  };

  if (!payload.title || !payload.category || !payload.reelUrl || !payload.summary) {
    setManagerStatus("All video fields are required.", "error");
    return;
  }

  const { error } = await supabaseClient.from("videos").insert(payload);
  if (error) {
    setManagerStatus(`Video save failed: ${error.message}`, "error");
    return;
  }

  form.reset();
  await loadContent();
  setManagerStatus("Video saved.", "success");
}

async function handleDocumentSubmit(event) {
  event.preventDefault();
  setManagerStatus("", "info");

  const form = event.currentTarget;
  const formData = new FormData(form);

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const date = String(formData.get("date") || "").trim();
  const file = formData.get("file");
  const manualUrl = String(formData.get("downloadUrl") || "").trim();

  const generatedId = `doc-${makeSlug(title)}-${Date.now().toString().slice(-5)}`;
  const id = String(formData.get("id") || "").trim() || generatedId;

  if (!title || !description || !date) {
    setManagerStatus("Title, description, and date are required for documents.", "error");
    return;
  }

  let downloadUrl = manualUrl;

  if (file instanceof File && file.size > 0) {
    downloadUrl = await uploadDocumentFile(file);
  }

  if (!downloadUrl) {
    setManagerStatus("Upload a file or provide a direct download URL.", "error");
    return;
  }

  const payload = {
    id,
    title,
    description,
    date,
    downloadUrl
  };

  const { error } = await supabaseClient.from("documents").insert(payload);
  if (error) {
    setManagerStatus(`Document save failed: ${error.message}`, "error");
    return;
  }

  form.reset();
  await loadContent();
  setManagerStatus("Document uploaded and saved.", "success");
}

async function deleteVideo(index) {
  const video = videos[index];
  if (!video) return;

  let query = supabaseClient.from("videos").delete();

  if (video.id !== null && video.id !== undefined && String(video.id).trim() !== "") {
    query = query.eq("id", video.id);
  } else {
    query = query.eq("reelUrl", video.reelUrl).eq("title", video.title);
  }

  const { error } = await query;
  if (error) {
    setManagerStatus(`Video delete failed: ${error.message}`, "error");
    return;
  }

  await loadContent();
  setManagerStatus("Video deleted.", "success");
}

async function deleteDocument(index) {
  const doc = documents[index];
  if (!doc) return;

  const storagePath = extractStoragePathFromUrl(doc.downloadUrl);
  if (storagePath) {
    await supabaseClient.storage.from(storageBucket).remove([storagePath]);
  }

  const { error } = await supabaseClient.from("documents").delete().eq("id", doc.id);
  if (error) {
    setManagerStatus(`Document delete failed: ${error.message}`, "error");
    return;
  }

  await loadContent();
  setManagerStatus("Document deleted.", "success");
}

function wireManagerHandlers() {
  const videoForm = byId("video-form");
  const docForm = byId("doc-form");
  const signOutButton = byId("signout-btn");

  videoForm?.addEventListener("submit", async (event) => {
    try {
      await handleVideoSubmit(event);
    } catch (error) {
      setManagerStatus(`Video save failed: ${error.message}`, "error");
    }
  });

  docForm?.addEventListener("submit", async (event) => {
    try {
      await handleDocumentSubmit(event);
    } catch (error) {
      setManagerStatus(`Document save failed: ${error.message}`, "error");
    }
  });

  signOutButton?.addEventListener("click", async () => {
    try {
      await handleSignOut();
    } catch (error) {
      setManagerStatus(`Sign out failed: ${error.message}`, "error");
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button[data-action]");
    if (!(button instanceof HTMLButtonElement)) return;

    const action = button.dataset.action;
    const index = Number(button.dataset.index);

    if (Number.isNaN(index)) return;

    try {
      if (action === "delete-video") {
        await deleteVideo(index);
      }

      if (action === "delete-doc") {
        await deleteDocument(index);
      }
    } catch (error) {
      setManagerStatus(`Action failed: ${error.message}`, "error");
    }
  });
}

function wireAuthHandlers() {
  const signInForm = byId("signin-form");

  signInForm?.addEventListener("submit", async (event) => {
    try {
      await handleSignIn(event);
    } catch (error) {
      setAuthStatus(`Sign in failed: ${error.message}`, "error");
    }
  });

}

async function applySession(session) {
  toggleManager(session);

  if (session?.user) {
    try {
      await loadContent();
      setManagerStatus("Backend connected.", "success");
    } catch (error) {
      const message = `Backend setup incomplete: ${error.message}`;
      setManagerStatus(message, "error");
    }
  }
}

async function init() {
  if (!supabaseClient) {
    setAuthStatus("Supabase SDK failed to load.", "error");
    return;
  }

  wireAuthHandlers();
  wireManagerHandlers();

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setAuthStatus(error.message, "error");
  }

  await applySession(data?.session || null);

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    await applySession(session);
  });
}

init();
