"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_SUPABASE_URL = "https://onahtndmilugzhjwjtam.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uYWh0bmRtaWx1Z3poandqdGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Mzk3NjksImV4cCI6MjA4NzIxNTc2OX0.o5vDHODt9V435xEzv2hyWX_QznZ27XvzVhGuy6InU3U";
const DEFAULT_STORAGE_BUCKET = "documents";

function withNoStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
}

function sendJson(res, statusCode, payload) {
  withNoStore(res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
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

function encodePath(value) {
  return String(value || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildPublicStorageUrl(supabaseUrl, bucket, objectPath) {
  if (!supabaseUrl || !bucket || !objectPath) return "";
  const safeBucket = encodeURIComponent(String(bucket).trim());
  const safePath = encodePath(objectPath);
  return `${supabaseUrl}/storage/v1/object/public/${safeBucket}/${safePath}`;
}

function normalizeVideoRow(row) {
  return {
    id: row && row.id ? row.id : null,
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

function mergeDocuments(primary, secondary) {
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

async function readLocalArray(relativePath) {
  try {
    const absolutePath = path.join(process.cwd(), relativePath);
    const raw = await fs.readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function fetchSupabaseRows(supabaseUrl, supabaseKey, tableName) {
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

async function fetchStorageRows(supabaseUrl, supabaseKey, storageBucket) {
  if (!supabaseUrl || !supabaseKey || !storageBucket) return [];

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
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    return [];
  }
}

function mapStorageRowsToDocuments(rows, supabaseUrl, storageBucket) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const fileName = String(row && row.name ? row.name : "").trim();
      if (!fileName || fileName.endsWith("/")) return null;

      const objectPath = `uploads/${fileName}`;
      const downloadUrl = buildPublicStorageUrl(supabaseUrl, storageBucket, objectPath);
      if (!downloadUrl) return null;

      const rawDate = String((row && (row.updated_at || row.created_at || row.last_accessed_at)) || "").trim();

      return {
        id: `storage-${makeSlug(fileName)}`,
        title: humanizeStorageFileName(fileName) || "Uploaded Document",
        description: "Uploaded reference document.",
        date: rawDate ? rawDate.slice(0, 10) : "",
        downloadUrl
      };
    })
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const supabaseKey = String(process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
  const storageBucket = String(process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET).trim() || DEFAULT_STORAGE_BUCKET;

  const [fallbackVideos, fallbackDocuments, videosRows, documentsRows, storageRows] = await Promise.all([
    readLocalArray("content/videos.json"),
    readLocalArray("content/documents.json"),
    fetchSupabaseRows(supabaseUrl, supabaseKey, "videos"),
    fetchSupabaseRows(supabaseUrl, supabaseKey, "documents"),
    fetchStorageRows(supabaseUrl, supabaseKey, storageBucket)
  ]);

  const videos = Array.isArray(videosRows) && videosRows.length > 0
    ? videosRows.map((row) => normalizeVideoRow(row))
    : fallbackVideos.map((row) => normalizeVideoRow(row));

  const documentsFromTable = Array.isArray(documentsRows)
    ? documentsRows.map((row) => normalizeDocumentRow(row))
    : [];
  const documentsFromStorage = mapStorageRowsToDocuments(storageRows, supabaseUrl, storageBucket);
  const mergedDocuments = mergeDocuments(documentsFromTable, documentsFromStorage);
  const documents = mergedDocuments.length > 0
    ? mergedDocuments
    : fallbackDocuments.map((row) => normalizeDocumentRow(row));

  sendJson(res, 200, { videos, documents });
};
