/**
 * Background Service Worker — BrowseGraph & TigerLens
 *
 * Manages:
 * - chrome.tabs.captureVisibleTab for screenshots
 * - IndexedDB-backed debounced ingestion queue
 * - Message passing between content scripts and side panel
 */

import { addToQueue, getPendingItems, updateQueueItem, removeFromQueue } from "../lib/idb";
import { ingestImage, ingestText } from "../lib/api";

// ─── Constants ──────────────────────────────────────────

const DEBOUNCE_MS = 2000;
const PROCESS_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;

// ─── Debounce Timer ─────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Message Handler ────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREENSHOT") {
    handleScreenshotCapture(message.sourceUrl || "")
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message.type === "INGEST_TEXT") {
    handleTextIngestion(message.text, message.sourceUrl, message.title)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_QUEUE_STATUS") {
    import("../lib/idb").then(({ getQueueStats }) => {
      getQueueStats()
        .then((stats) => sendResponse({ success: true, data: stats }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  return false;
});

// ─── Screenshot Capture ─────────────────────────────────

async function handleScreenshotCapture(sourceUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      { format: "png", quality: 85 },
      async (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!dataUrl) {
          reject(new Error("Failed to capture screenshot"));
          return;
        }

        // Extract base64 from data URL
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

        // Debounced queue addition
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
          try {
            const id = await addToQueue({
              type: "image",
              payload: { image_base64: base64, source_url: sourceUrl },
              sourceUrl,
            });
            console.log(`[BrowseGraph] Queued screenshot: ${id}`);
          } catch (err) {
            console.error("[BrowseGraph] Failed to queue screenshot:", err);
          }
        }, DEBOUNCE_MS);

        resolve(base64.slice(0, 50) + "...");
      }
    );
  });
}

// ─── Text Ingestion ─────────────────────────────────────

async function handleTextIngestion(
  text: string,
  sourceUrl: string,
  title: string
): Promise<string> {
  const id = await addToQueue({
    type: "text",
    payload: { text, source_url: sourceUrl, title },
    sourceUrl,
  });
  console.log(`[BrowseGraph] Queued text ingestion: ${id}`);
  return id;
}

// ─── Queue Processor ────────────────────────────────────

async function processQueue(): Promise<void> {
  try {
    const pending = await getPendingItems(5);

    for (const item of pending) {
      await updateQueueItem(item.id, { status: "processing" });

      try {
        if (item.type === "image") {
          await ingestImage(
            item.payload.image_base64,
            item.payload.source_url || "",
            ""
          );
        } else if (item.type === "text") {
          await ingestText(
            item.payload.text,
            item.payload.source_url || "",
            item.payload.title || ""
          );
        }

        await updateQueueItem(item.id, { status: "done" });
        console.log(`[BrowseGraph] Processed queue item: ${item.id}`);

        // Remove completed items after marking as done
        setTimeout(() => removeFromQueue(item.id), 30000);
      } catch (err: any) {
        const newRetries = item.retries + 1;
        if (newRetries >= MAX_RETRIES) {
          await updateQueueItem(item.id, {
            status: "error",
            retries: newRetries,
          });
          console.error(
            `[BrowseGraph] Item ${item.id} failed after ${MAX_RETRIES} retries:`,
            err
          );
        } else {
          await updateQueueItem(item.id, {
            status: "pending",
            retries: newRetries,
          });
          console.warn(
            `[BrowseGraph] Item ${item.id} retry ${newRetries}/${MAX_RETRIES}`
          );
        }
      }
    }
  } catch (err) {
    console.error("[BrowseGraph] Queue processor error:", err);
  }
}

// ─── Periodic Queue Processing ──────────────────────────

setInterval(processQueue, PROCESS_INTERVAL_MS);

// ─── Side Panel Registration ────────────────────────────

chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {
  // Side panel API may not be available in all Chrome versions
});

// ─── Extension Install Handler ──────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[BrowseGraph] Extension ${details.reason}: v${chrome.runtime.getManifest().version}`);
});

export {};