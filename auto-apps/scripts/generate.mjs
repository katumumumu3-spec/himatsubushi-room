import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ROOT,
  appDir,
  loadQueue,
  normalizeSearchText,
  pickNextPending,
  renderTemplate,
  saveQueue,
  slugify,
  templatePath,
  writeJson,
} from "./lib.mjs";

function buildSlug(item) {
  if (item.slug) return slugify(item.slug);
  if (item.id) return slugify(item.id);
  return slugify(item.name);
}

export function generateNextApp({ dryRun = false } = {}) {
  const queue = loadQueue();
  const item = pickNextPending(queue);
  if (!item) {
    return { ok: true, skipped: true, reason: "pending のプロンプトがありません" };
  }

  const templateFile = templatePath(item.template);
  if (!fs.existsSync(templateFile)) {
    throw new Error(`テンプレートが見つかりません: ${item.template}`);
  }

  const slug = buildSlug(item);
  const targetDir = appDir(slug);
  const html = fs.readFileSync(templateFile, "utf8");
  const config = item.config || {};
  const rendered = renderTemplate(html, {
    TITLE: item.name,
    DESCRIPTION: item.description,
    ROOM_URL: "https://himatsubushiroom.com/",
    CONFIG_JSON: JSON.stringify(config).replace(/</g, "\\u003c"),
    TEMPLATE_ID: item.template,
    SLUG: slug,
  });

  const meta = {
    id: item.id,
    slug,
    template: item.template,
    name: item.name,
    description: item.description,
    tags: item.tags || [],
    searchText: normalizeSearchText(item.name, item.description, ...(item.tags || [])),
    generatedAt: new Date().toISOString(),
  };

  if (!dryRun) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, "index.html"), rendered, "utf8");
    writeJson(path.join(targetDir, "meta.json"), meta);
    writeJson(path.join(ROOT, "prompts", "done", `${item.id}.json`), {
      ...meta,
      config,
    });

    item.status = "generated";
    item.slug = slug;
    item.generatedAt = meta.generatedAt;
    saveQueue(queue);
  }

  return { ok: true, skipped: false, item, meta, targetDir };
}

const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "");
if (isMain) {
  try {
    const result = generateNextApp();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
