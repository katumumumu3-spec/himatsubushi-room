import fs from "node:fs";
import path from "node:path";
import { buildAdmaxSlotHtml } from "./admax-snippet.mjs";
import { ROOT, readJson } from "./lib.mjs";

/**
 * Patch already-generated apps under apps/*/index.html to include AdMax.
 * Safe to re-run: replaces existing ad-slot-wrap blocks first.
 */
function loadAdmaxConfig() {
  const file = path.join(ROOT, "config", "admax.json");
  if (!fs.existsSync(file)) throw new Error("config/admax.json がありません");
  return readJson(file);
}

function patchHtml(html, slotHtml) {
  let next = html.replace(/<aside class="ad-slot-wrap"[\s\S]*?<\/aside>\s*<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>\s*/g, "");
  next = next.replace(/<style>\s*\.ad-slot-wrap\{[\s\S]*?<\/style>\s*/g, "");

  if (next.includes('id="admaxBottom"')) {
    return { html: next, changed: false, reason: "already has admaxBottom in unknown format" };
  }

  const roomPatterns = [
    /(<a class="room"[^>]*>もっと遊ぶ → ひまつぶしルーム<\/a>)/,
    /(<div><a class="room"[^>]*>もっと遊ぶ → ひまつぶしルーム<\/a><\/div>)/,
  ];

  for (const pattern of roomPatterns) {
    if (pattern.test(next)) {
      next = next.replace(pattern, `${slotHtml}\n    $1`);
      return { html: next, changed: true };
    }
  }

  // Fallback: insert before </body>
  if (next.includes("</body>")) {
    next = next.replace("</body>", `${slotHtml}\n</body>`);
    return { html: next, changed: true };
  }

  return { html: next, changed: false, reason: "no insertion point" };
}

const admax = loadAdmaxConfig();
const slotHtml = buildAdmaxSlotHtml(admax.bannerBottomId);
const appsRoot = path.join(ROOT, "apps");
const dirs = fs.existsSync(appsRoot)
  ? fs.readdirSync(appsRoot, { withFileTypes: true }).filter((d) => d.isDirectory())
  : [];

let patched = 0;
for (const dir of dirs) {
  const indexPath = path.join(appsRoot, dir.name, "index.html");
  if (!fs.existsSync(indexPath)) continue;
  const original = fs.readFileSync(indexPath, "utf8");
  const result = patchHtml(original, slotHtml);
  if (result.changed) {
    fs.writeFileSync(indexPath, result.html, "utf8");
    patched += 1;
    console.log(`patched: ${dir.name}`);
  } else {
    console.log(`skip: ${dir.name} (${result.reason || "unchanged"})`);
  }
}

console.log(`done. patched=${patched}`);
