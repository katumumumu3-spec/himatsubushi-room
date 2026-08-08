import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateNextApp } from "./generate.mjs";
import { registerAppBySlug } from "./register.mjs";
import { loadQueue, saveQueue, waitForUrl } from "./lib.mjs";

function getAppsBaseUrl() {
  return (process.env.APPS_BASE_URL || "https://apps.himatsubushiroom.com").replace(/\/$/, "");
}

async function main() {
  const mode = process.env.DAILY_MODE || "full";
  // modes: generate | register | full
  if (mode === "generate" || mode === "full") {
    const generated = generateNextApp();
    console.log("[generate]", JSON.stringify(generated));
    if (generated.skipped) {
      console.log("No pending prompts. Exit.");
      return;
    }

    if (mode === "generate") return;

    const url = `${getAppsBaseUrl()}/apps/${generated.meta.slug}/`;
    const timeoutSec = Number(process.env.PUBLISH_WAIT_SECONDS || 180);
    console.log(`[wait] ${url} (timeout ${timeoutSec}s)`);
    // In CI, commit/push happens between generate and register steps.
    // When run locally as full, we still try waiting.
    if (process.env.SKIP_PUBLISH_WAIT !== "1") {
      await waitForUrl(url, { timeoutSec, intervalSec: 8 });
    }
    const registered = await registerAppBySlug(generated.meta.slug);
    console.log("[register]", JSON.stringify(registered));
    return;
  }

  if (mode === "register") {
    const queue = loadQueue();
    const item = queue.items.find((entry) => entry.status === "generated");
    if (!item) {
      console.log("No generated app to register.");
      return;
    }
    const url = `${getAppsBaseUrl()}/apps/${item.slug}/`;
    const timeoutSec = Number(process.env.PUBLISH_WAIT_SECONDS || 180);
    if (process.env.SKIP_PUBLISH_WAIT !== "1") {
      await waitForUrl(url, { timeoutSec, intervalSec: 8 });
    }
    const registered = await registerAppBySlug(item.slug);
    console.log("[register]", JSON.stringify(registered));
    return;
  }

  throw new Error(`Unknown DAILY_MODE: ${mode}`);
}

const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "");
if (isMain) {
  main().catch((error) => {
    console.error(error.message || error);
    const queue = loadQueue();
    const item = queue.items.find((entry) => entry.status === "generated" || entry.status === "pending");
    if (item && item.status === "generated") {
      item.status = "failed";
      item.error = String(error.message || error);
      item.failedAt = new Date().toISOString();
      saveQueue(queue);
    }
    process.exit(1);
  });
}
