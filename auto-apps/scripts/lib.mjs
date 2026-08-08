import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function slugify(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9ぁ-んァ-ン一-龥ー]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "app";
}

export function normalizeSearchText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/\s+/g, " ")
    .trim();
}

export function queuePath() {
  return path.join(ROOT, "prompts", "queue.json");
}

export function templatePath(templateId) {
  return path.join(ROOT, "templates", templateId, "index.html");
}

export function appDir(slug) {
  return path.join(ROOT, "apps", slug);
}

export function loadQueue() {
  return readJson(queuePath());
}

export function saveQueue(queue) {
  writeJson(queuePath(), queue);
}

export function pickNextPending(queue) {
  return queue.items.find((item) => item.status === "pending") || null;
}

export function renderTemplate(html, vars) {
  let output = html;
  for (const [key, value] of Object.entries(vars)) {
    output = output.split(`{{${key}}}`).join(String(value));
  }
  return output;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForUrl(url, { timeoutSec = 180, intervalSec = 5 } = {}) {
  const deadline = Date.now() + timeoutSec * 1000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) return true;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalSec * 1000);
  }
  throw new Error(`公開URLの確認に失敗しました: ${url} (${lastError?.message || "timeout"})`);
}
