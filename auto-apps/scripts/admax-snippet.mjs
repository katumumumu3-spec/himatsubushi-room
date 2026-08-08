/**
 * Build AdMax banner HTML for generated apps (ninja AdMax / adm.shinobi.jp).
 */
export function buildAdmaxSlotHtml(bannerId) {
  const id = String(bannerId || "").trim();
  if (!id) return "";

  return `
<style>
  .ad-slot-wrap{margin:18px 0 8px;text-align:center}
  .ad-slot-wrap .ad-label{margin:0 0 6px;color:#667085;font-size:.75rem;font-weight:700}
  .ad-slot{min-height:50px}
</style>
<aside class="ad-slot-wrap" aria-label="スポンサー">
  <p class="ad-label">スポンサー</p>
  <div class="ad-slot" id="admaxBottom"></div>
</aside>
<script>
(function () {
  var admaxId = ${JSON.stringify(id)};
  var el = document.getElementById("admaxBottom");
  if (!el || !admaxId) return;
  var iframe = document.createElement("iframe");
  iframe.title = "advertisement";
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("frameborder", "0");
  iframe.style.cssText = "display:block;width:100%;max-width:320px;height:100px;border:0;margin:0 auto;overflow:hidden;";
  iframe.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;text-align:center;background:transparent;"><script src="https://adm.shinobi.jp/s/' + admaxId + '"><\\/script></body></html>';
  el.appendChild(iframe);
})();
</script>
`.trim();
}
