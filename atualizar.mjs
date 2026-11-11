// Roda no GitHub Actions (Node 20). Busca dados reais e grava site/data/dados.json
import fs from "node:fs";
const brapi = process.env.BRAPI_TOKEN || "", fin = process.env.FINNHUB_TOKEN || "";
const cfg = JSON.parse(fs.readFileSync("carteira.json", "utf8"));
const out = { upd: new Date().toISOString(), px: {}, mac: {}, news: [], an: {}, erros: [] };
const j = async (u, h) => { const r = await fetch(u, { headers: h || {} }); if (!r.ok) throw new Error(r.status); return r.json(); };
const dec = s => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).trim();
const pick = (x, t) => { const m = x.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">")); return m ? dec(m[1]) : ""; };

for (const k of cfg.tickers || []) {
  try {
    const d = await j("https://brapi.dev/api/quote/" + k, brapi ? { Authorization: "Bearer " + brapi } : {});
    const q = d.results[0];
    out.px[k] = { p: q.regularMarketPrice, d: q.regularMarketChangePercent || 0, n: q.shortName || k };
  } catch (e) { out.erros.push(k + ": " + e.message); }
}
try { out.mac.selic = (await j("https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json"))[0].valor; } catch (e) { out.erros.push("selic"); }
try { out.mac.ipca = (await j("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json"))[0].valor; } catch (e) { out.erros.push("ipca"); }
try { out.mac.usd = Number((await j("https://economia.awesomeapi.com.br/json/last/USD-BRL")).USDBRL.bid).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); } catch (e) { out.erros.push("dólar"); }

for (const [s, u] of cfg.feeds || []) {
  try {
    const x = await (await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } })).text();
    for (const it of x.split("<item>").slice(1, 9)) out.news.push({ h: pick(it, "title"), u: pick(it, "link"), s, t: Date.parse(pick(it, "pubDate")) || 0 });
  } catch (e) { out.erros.push("feed " + s); }
}
if (fin) {
  try { (await j("https://finnhub.io/api/v1/news?category=general&token=" + fin)).slice(0, 6).forEach(n => out.news.push({ h: n.headline, u: n.url, s: n.source, t: n.datetime * 1000 })); } catch (e) { out.erros.push("finnhub notícias"); }
  for (const k of cfg.us || []) { try { const a = await j("https://finnhub.io/api/v1/stock/recommendation?symbol=" + k + "&token=" + fin); if (a[0]) out.an[k] = a[0]; } catch (e) { out.erros.push("analistas " + k); } }
}
out.news = out.news.filter(n => n.h && n.u).sort((a, b) => b.t - a.t).slice(0, 16);
fs.mkdirSync("site/data", { recursive: true });
fs.writeFileSync("site/data/dados.json", JSON.stringify(out));
console.log("ok", Object.keys(out.px).length, "ativos,", out.news.length, "notícias, erros:", out.erros);
