import { loadQueue } from "./lib.mjs";

const allowedTemplates = new Set(["memory", "quiz", "clicker", "reaction", "sort"]);
const queue = loadQueue();
const errors = [];

if (!Array.isArray(queue.items)) {
  errors.push("queue.items が配列ではありません");
} else {
  const ids = new Set();
  for (const [index, item] of queue.items.entries()) {
    const label = `items[${index}]`;
    if (!item.id) errors.push(`${label}: id が必要です`);
    if (ids.has(item.id)) errors.push(`${label}: id が重複しています (${item.id})`);
    ids.add(item.id);
    if (!item.name) errors.push(`${label}: name が必要です`);
    if (!item.description) errors.push(`${label}: description が必要です`);
    if (!Array.isArray(item.tags) || item.tags.length < 1) {
      errors.push(`${label}: tags が1つ以上必要です`);
    }
    if (!allowedTemplates.has(item.template)) {
      errors.push(`${label}: template が不正です (${item.template})`);
    }
    if (!["pending", "generated", "done", "failed"].includes(item.status)) {
      errors.push(`${label}: status が不正です (${item.status})`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`queue OK: ${queue.items.length} items`);
