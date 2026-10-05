// Builds the lecture deck: Semantic loss on CIFAR-100 hierarchy.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { tex } = require("./math.js");
// Optional: writes THEME's colors into the deck's theme part. Set APPLY_THEME_JS to an apply_theme.js
// module (from the pptx skill); without it the deck still builds, with Office's default theme colors.
const applyTheme = process.env.APPLY_THEME_JS ? require(process.env.APPLY_THEME_JS).applyTheme : null;

const OUT = process.argv[2] || "SemanticLoss_MNIST_Lecture.pptx";
const ASSETS = path.join(__dirname, "assets");

// ---------- theme ----------
const HEX = {
  ink: "1F2933", inkSoft: "52606D", muted: "7B8794", dark: "14202E", panel: "F1F4F8", line: "D9DEE5",
  neural: "2A78D6", rule: "EB6834", aqua: "1BAF7A", violet: "4A3AA7", gold: "EDA100", white: "FFFFFF",
  codeBg: "1B2430", okTint: "E3F4EC", badTint: "FCE6DC", ruleTint: "FDEEE6", neuralTint: "E6F0FB",
};
const THEME = {
  name: "Semantic Loss MNIST Lecture",
  headFontFace: "Malgun Gothic",
  bodyFontFace: "Malgun Gothic",
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.dark, lt2: HEX.panel,
    accent1: HEX.neural, accent2: HEX.rule, accent3: HEX.aqua, accent4: HEX.violet, accent5: HEX.gold, accent6: HEX.inkSoft,
    hlink: HEX.neural, folHlink: HEX.violet,
  },
};
const METHOD_COLOR = { ce: HEX.neural, ce_ent: HEX.aqua, ce_eo: HEX.rule };
const METHOD_LABEL = { ce: "CE만", ce_ent: "+ 엔트로피 최소화", ce_eo: "+ 의미 손실" };
const CODE_FONT = "Consolas";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "지식으로 라벨을 대신할 수 있을까 — MNIST로 배우는 의미 손실";
pres.author = "Sangun Park";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, M = 0.6, CW = W - 2 * M;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: HEX.dark },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.1, w: 11.6, h: 1.9, fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.25, w: 11.6, h: 1.2, fontSize: 20, color: "BCCCDC", valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "SECTION_DARK",
  background: { color: HEX.dark },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.9, w: 11.6, h: 1.1, fontSize: 40, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.1, w: 11.6, h: 1.4, fontSize: 18, color: "BCCCDC", valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.2, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: "9AA5B1", align: "right" },
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: HEX.white },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.35, w: CW, h: 0.8, fontSize: 30, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "의미 손실 · MNIST exactly-one", options: { x: M, y: 6.95, w: 6, h: 0.3, fontSize: 10, color: HEX.muted, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: HEX.muted, align: "right" },
});

// ---------- helpers ----------
let section = "";
const NOTES = []; // [slide, section, notes, weight]
function sectionStart(title) { section = title; pres.addSection({ title }); }
function note(slide, notes, weight = 1) { NOTES.push([slide, section, notes || "", weight]); }
function content(title, notes) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  note(s, notes);
  return s;
}
// Minutes per section (75 total); divider slides count as 0.3 of a slide.
const BUDGET = { "도입": 4, "배경": 8, "의미 손실": 14, "실험 설계와 구현": 12, "실험 결과": 10, "논문 재현하기": 9, "마무리": 5, "실습": 0 };
function applyNotes() {
  let t = 0;
  for (const sec of Object.keys(BUDGET)) {
    const items = NOTES.filter((n) => n[1] === sec);
    const wsum = items.reduce((a, n) => a + n[3], 0);
    for (const [slide, , text, w] of items) {
      const dur = wsum ? (BUDGET[sec] * w) / wsum : 0;
      const mm = Math.floor(t), ss = Math.round((t - mm) * 60);
      const head = BUDGET[sec] ? `[${mm}:${String(ss).padStart(2, "0")} 시작 · 약 ${dur.toFixed(1)}분] ` : "[부록] ";
      slide.addNotes(head + text.replace(/^\[[^\]]*\]\s*/, ""));
      t += dur;
    }
  }
}
function divider(num, title, sub, notes) {
  sectionStart(title);
  const s = pres.addSlide({ masterName: "SECTION_DARK", sectionTitle: section });
  s.addText(num, { x: M, y: 1.9, w: 5, h: 0.9, fontSize: 54, bold: true, color: HEX.rule, margin: 0, isTextBox: true, objectName: "section-number" });
  s.addText(title, { placeholder: "title" });
  s.addText(sub, { placeholder: "body" });
  note(s, notes, 0.3);
  return s;
}
async function math(slide, src, x, y, { pt = 22, color = HEX.ink, maxW, align = "left", name } = {}) {
  const r = await tex(src, { pt, color });
  let w = r.w, h = r.h;
  if (maxW && w > maxW) { h = (h * maxW) / w; w = maxW; }
  const xx = align === "center" ? x - w / 2 : x;
  slide.addImage({ data: r.data, x: xx, y, w, h, altText: src, objectName: name || "equation" });
  return { w, h };
}
function text(slide, t, x, y, w, h, o = {}) {
  slide.addText(t, { x, y, w, h, fontSize: 16, color: HEX.ink, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 6, ...o });
}
function bullets(slide, items, x, y, w, h, o = {}) {
  const arr = items.map((it, i) => {
    const runs = typeof it === "string" ? { text: it } : it;
    const sub = runs.sub;
    return { text: runs.text, options: { bullet: sub ? { indent: 18 } : { indent: 18 }, indentLevel: sub ? 1 : 0, breakLine: i < items.length - 1, fontSize: sub ? 14 : (o.fontSize || 16), color: sub ? HEX.inkSoft : HEX.ink, bold: !!runs.bold } };
  });
  slide.addText(arr, { x, y, w, h, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 8, ...o });
}
function card(slide, x, y, w, h, { title, body, tag, tagColor = HEX.neural, fill = HEX.panel, titleSize = 18, bodySize = 15, name } = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.12, objectName: name || "card" });
  let tx = x + 0.25;
  if (tag) {
    slide.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.42, h: 0.42, fill: { color: tagColor }, line: { color: tagColor }, objectName: "tag" });
    slide.addText(tag, { x: x + 0.25, y: y + 0.25, w: 0.42, h: 0.42, fontSize: 13, bold: true, color: HEX.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
    tx = x + 0.8;
  }
  if (title) slide.addText(title, { x: tx, y: y + 0.22, w: x + w - tx - 0.2, h: 0.48, fontSize: titleSize, bold: true, color: HEX.ink, valign: "middle", margin: 0, isTextBox: true });
  if (body) {
    const by = title ? y + 0.8 : y + 0.25;
    if (Array.isArray(body)) bullets(slide, body, x + 0.25, by, w - 0.5, y + h - by - 0.15, { fontSize: bodySize });
    else text(slide, body, x + 0.25, by, w - 0.5, y + h - by - 0.15, { fontSize: bodySize });
  }
}
function pill(slide, t, x, y, w, color, o = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.4, fill: { color }, line: { color }, rectRadius: 0.2, objectName: "pill" });
  slide.addText(t, { x, y, w, h: 0.4, fontSize: 13, bold: true, color: HEX.white, align: "center", valign: "middle", margin: 0, isTextBox: true, ...o });
}
function arrow(slide, x1, y1, x2, y2, color = HEX.muted) {
  slide.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001, flipH: x2 < x1, flipV: y2 < y1, line: { color, width: 1.75, endArrowType: "triangle" }, objectName: "arrow" });
}
function box(slide, t, x, y, w, h, { fill = HEX.panel, color = HEX.ink, size = 14, bold = false, line } = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: line || fill, width: 1 }, rectRadius: 0.08, objectName: "box" });
  slide.addText(t, { x, y, w, h, fontSize: size, bold, color, align: "center", valign: "middle", margin: 2, isTextBox: true });
}

// Python syntax colouring for code panels.
const KW = new Set("def return import from for in if else elif and or not lambda with as class assert None True False while".split(" "));
function pyRuns(code, size) {
  const runs = [];
  const lines = code.replace(/\n$/, "").split("\n");
  lines.forEach((line, li) => {
    const toks = [];
    const re = /(#.*$)|("""[^]*?"""|"[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g;
    let m, prev = "";
    while ((m = re.exec(line))) {
      let color = "E6EDF3";
      if (m[1]) color = "7F8C9A";
      else if (m[2]) color = "A5D6A7";
      else if (m[3]) color = "F7A072";
      else if (m[4]) { if (KW.has(m[4])) color = "C792EA"; else if (prev === "def") color = "82AAFF"; }
      if (m[4]) prev = m[4]; else if (!m[5]) prev = "";
      toks.push({ text: m[0], options: { color } });
    }
    if (!toks.length) toks.push({ text: " ", options: { color: "E6EDF3" } });
    toks[toks.length - 1].options.breakLine = li < lines.length - 1;
    runs.push(...toks);
  });
  runs.forEach((r) => Object.assign(r.options, { fontFace: CODE_FONT, fontSize: size }));
  return runs;
}
function code(slide, src, x, y, w, h, { size = 13, title } = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: HEX.codeBg }, line: { color: HEX.codeBg }, rectRadius: 0.1, objectName: "code-panel" });
  let ty = y + 0.2;
  if (title) {
    slide.addText(title, { x: x + 0.3, y: y + 0.15, w: w - 0.6, h: 0.3, fontFace: CODE_FONT, fontSize: 11, color: "8B98A5", margin: 0, isTextBox: true });
    ty = y + 0.5;
  }
  slide.addText(pyRuns(src, size), { x: x + 0.3, y: ty, w: w - 0.6, h: y + h - ty - 0.15, valign: "top", margin: 0, isTextBox: true, lineSpacingMultiple: 1.05, objectName: "code" });
}
function table(slide, rows, x, y, w, o = {}) {
  const head = rows[0].map((c) => ({ text: c, options: { bold: true, color: HEX.white, fill: { color: o.headFill || HEX.dark }, align: "center" } }));
  const body = rows.slice(1).map((r, ri) => r.map((c, ci) => {
    const cell = typeof c === "object" && c !== null && c.text !== undefined ? c : { text: String(c) };
    return { text: cell.text, options: { color: HEX.ink, fill: { color: cell.fill || (ri % 2 ? "F7F9FB" : HEX.white) }, bold: !!cell.bold, align: ci === 0 && !o.centerFirst ? "left" : "center", ...(cell.options || {}) } };
  }));
  slide.addTable([head, ...body], { x, y, w, colW: o.colW, fontSize: o.fontSize || 14, fontFace: THEME.bodyFontFace, border: { type: "solid", pt: 0.75, color: HEX.line }, rowH: o.rowH || 0.38, valign: "middle", margin: [2, 6, 2, 6], autoPage: false });
}
const pct = (v, d = 1) => (100 * v).toFixed(d);
const ms = (a, k, d = 1) => (a ? `${pct(a[k].mean, d)} ± ${pct(a[k].std, d)}` : "진행 중");

function chartBase(extra = {}) {
  return {
    catAxisLabelColor: HEX.inkSoft, valAxisLabelColor: HEX.inkSoft, catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", titleFontFace: "+mn-lt",
    valGridLine: { color: "E4E7EB", size: 0.75 }, catGridLine: { style: "none" },
    catAxisLineColor: "C9CED6", valAxisLineShow: false,
    legendFontSize: 12, legendColor: HEX.inkSoft, showLegend: true, legendPos: "b",
    dataLabelColor: HEX.ink, dataLabelFontSize: 10,
    ...extra,
  };
}

// ---------- MNIST results ----------
const PROJ = path.join(__dirname, "..", "..");
const rj = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sdev = (a) => (a.length < 2 ? 0 : Math.sqrt(a.reduce((s, v) => s + (v - mean(a)) ** 2, 0) / (a.length - 1)));
const LABELS = [100, 500, 1000];
const MS = ["ce", "ce_ent", "ce_eo"];
function loadMnist() {
  const best = rj(`${PROJ}/results/best_lambda.json`);
  const files = fs.readdirSync(`${PROJ}/results`).filter((f) => /^n.*_seed\d\.json$/.test(f));
  const runs = files.map((f) => rj(`${PROJ}/results/${f}`));
  const pick = (n, m) => runs.filter((r) => r.n_labeled === n && r.method === m && r.lam === (best[`${n}_${m}`] ?? 0)).sort((a, b) => a.seed - b.seed);
  const agg = {};
  for (const n of LABELS) {
    agg[n] = {};
    for (const m of MS) {
      const rs = pick(n, m);
      const o = { n: rs.length, lam: best[`${n}_${m}`] ?? 0, runs: rs };
      for (const k of Object.keys(rs[0].test)) {
        const v = rs.map((r) => r.test[k]);
        o[k] = { mean: mean(v), std: sdev(v), all: v };
      }
      agg[n][m] = o;
    }
  }
  const full = runs.filter((r) => r.n_labeled === null).map((r) => r.test.acc);
  const tune = fs.readdirSync(`${PROJ}/results/tune`).map((f) => rj(`${PROJ}/results/tune/${f}`));
  const lamGrid = [0.01, 0.03, 0.1, 0.3, 1.0, 3.0];
  const tuneAcc = (n, m) => lamGrid.map((l) => { const r = tune.find((t) => t.n_labeled === n && t.method === m && t.lam === l); return r ? r.val.acc : null; });
  // Paper protocol
  const pb = rj(`${PROJ}/results_paper/best.json`);
  const pfiles = fs.readdirSync(`${PROJ}/results_paper`).filter((f) => /_seed\d\.json$/.test(f)).map((f) => rj(`${PROJ}/results_paper/${f}`));
  const paper = {};
  for (const n of [100, 1000]) {
    paper[n] = {};
    for (const m of MS) {
      const c = pb[`${n}_${m}`];
      const rs = pfiles.filter((r) => r.n_labeled === n && r.method === m && r.batch_size === c.batch_size && r.weight === c.weight);
      const acc = rs.map((r) => r.test.acc);
      paper[n][m] = { cfg: c, n: rs.length, acc: { mean: mean(acc), std: sdev(acc), all: acc },
        maxCurve: mean(rs.map((r) => Math.max(...r.curve.map((x) => x.test_acc)))), prEo: mean(rs.map((r) => r.test.mean_pr_eo)) };
    }
  }
  return { best, agg, full: { mean: mean(full), std: sdev(full) }, lamGrid, tuneAcc, paper, outputs: rj(`${ASSETS}/outputs.json`) };
}
const D = loadMnist();
const PAPER_T1 = { 100: { ce: [78.46, 1.94], ce_ent: [96.27, 0.64], ce_eo: [98.38, 0.51] }, 1000: { ce: [94.26, 0.31], ce_ent: [98.32, 0.34], ce_eo: [98.78, 0.17] } };
const f1 = (v) => (100 * v).toFixed(1);
const f2 = (v) => (100 * v).toFixed(2);
const msd = (o, d = 1) => `${(100 * o.mean).toFixed(d)} ± ${(100 * o.std).toFixed(d)}`;
const gain = (n, a, b) => 100 * (D.agg[n][a].acc.mean - D.agg[n][b].acc.mean);
const sg = (v, d = 1) => (v >= 0 ? "+" : "") + v.toFixed(d);
const wins = (n, a, b) => D.agg[n][a].acc.all.filter((v, i) => v > D.agg[n][b].acc.all[i]).length;

// =====================================================================
async function build() {
  // ---------------- 도입 ----------------
  sectionStart("도입");
  let s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: section });
  s.addText("지식으로 라벨을 대신할 수 있을까", { placeholder: "title" });
  s.addText("MNIST로 배우는 의미 손실(Semantic Loss) — exactly-one 제약 하나로 시작하기", { placeholder: "body" });
  pill(s, "Neural", M, 1.2, 1.3, HEX.neural);
  s.addText("+", { x: M + 1.35, y: 1.2, w: 0.4, h: 0.4, fontSize: 20, bold: true, color: HEX.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
  pill(s, "Symbolic", M + 1.8, 1.2, 1.5, HEX.rule);
  s.addText(`뉴로심볼릭 AI 기초 강의 · 약 ${Object.values(BUDGET).reduce((a, b) => a + b, 0)}분`, { x: M, y: 6.6, w: 8, h: 0.4, fontSize: 14, color: "9AA5B1", margin: 0, isTextBox: true });
  note(s, "강의 소개. 오늘은 가장 단순한 논리 지식인 '정답은 정확히 하나'를 신경망 학습에 넣는 방법을 배운다. 이론 → 실험 → 논문 재현 순서. CIFAR-100 계층 규칙 강의의 기초편에 해당한다.");

  s = content("오늘의 흐름", "전체 구성. 1~2부는 개념, 3~4부는 우리 실험, 5부는 원 논문을 직접 재현해 본 이야기. 5부는 연구를 '읽고 확인하는 법'에 관한 내용이다.");
  const agenda = [["1", "배경", "MNIST, 준지도 학습, 출력 해석, exactly-one", HEX.neural],
    ["2", "의미 손실", "세계와 확률, 정의, 계산 원리, 기울기", HEX.rule],
    ["3", "실험 설계와 구현", "질문, 설정, 손실, 코드", HEX.violet],
    ["4", "실험 결과", "정확도, 규칙 준수, 출력의 모양", HEX.violet],
    ["5", "논문 재현하기", "공식 코드 읽기, 차이점, 재현 결과, 교훈", HEX.aqua],
    ["6", "마무리", "핵심 정리, 확인 문제, 실습", HEX.inkSoft]];
  agenda.forEach(([n, t, d, c], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    card(s, M + col * 6.15, 1.5 + row * 1.7, 5.95, 1.45, { title: t, body: d, tag: n, tagColor: c });
  });

  s = content("라벨 100장 vs 55,000장",
    "동기. 같은 신경망이라도 라벨이 100장이면 76%, 55,000장이면 98.8%. 나머지 54,900장의 이미지는 있는데 라벨만 없다. 사람이 아는 '숫자는 정확히 하나'라는 지식으로 이 이미지들을 학습에 쓸 수 있을까? 이것이 오늘의 질문이다.");
  s.addText(`${f1(D.agg[100].ce.acc.mean)}%`, { x: M, y: 1.6, w: 5.5, h: 1.3, fontSize: 80, bold: true, color: HEX.neural, margin: 0, isTextBox: true, objectName: "stat" });
  text(s, "라벨 100장으로 학습한 MLP의 테스트 정확도", M, 2.95, 5.5, 0.5, { fontSize: 16, color: HEX.inkSoft });
  s.addText(`${f1(D.full.mean)}%`, { x: M, y: 3.7, w: 5.5, h: 1.3, fontSize: 80, bold: true, color: HEX.aqua, margin: 0, isTextBox: true, objectName: "stat" });
  text(s, "라벨 55,000장(전부)으로 학습한 같은 MLP", M, 5.05, 5.5, 0.5, { fontSize: 16, color: HEX.inkSoft });
  card(s, 6.6, 1.6, 6.13, 4.0, { title: "남은 54,900장에는 라벨이 없다", tag: "?", tagColor: HEX.rule, fill: HEX.ruleTint,
    body: ["라벨을 붙이는 데는 비용이 든다", "그런데 우리는 \"이미지마다 숫자는 정확히 하나\"라는 것을 안다", "이 지식만으로 라벨 없는 이미지에서 학습 신호를 만들 수 있을까?"], bodySize: 16 });
  text(s, "5시드 평균, 테스트셋 10,000장", 6.6, 5.8, 6.13, 0.4, { fontSize: 12, color: HEX.muted });

  // ---------------- 1. 배경 ----------------
  divider("01", "배경", "데이터, 학습 설정, 출력 해석, 그리고 지식", "1부 시작.");

  s = content("데이터셋: MNIST 손글씨 숫자", "MNIST는 28×28 흑백 손글씨 숫자 7만 장. 딥러닝의 'Hello World'. 우리는 학습 6만 장 중 5천 장을 λ 선택용 검증셋으로 떼고, 55,000장에서 라벨을 100/500/1,000장만 남긴다(클래스별 같은 수).");
  s.addImage({ path: path.join(ASSETS, "mosaic.png"), altText: path.basename(path.join(ASSETS, "mosaic.png")), x: M, y: 1.5, w: 7.6, h: 1.9, objectName: "mosaic" });
  text(s, "학습 이미지 무작위 64장", M, 3.5, 7.6, 0.3, { fontSize: 11, color: HEX.muted });
  const st = [["70,000", "이미지 (학습 60k / 테스트 10k)"], ["10", "클래스 (숫자 0~9)"], ["28×28", "흑백, 784개 픽셀 → MLP 입력"]];
  st.forEach(([n, l], i) => {
    s.addText(n, { x: 8.6, y: 1.5 + i * 1.3, w: 4.1, h: 0.7, fontSize: 32, bold: true, color: HEX.neural, margin: 0, isTextBox: true });
    s.addText(l, { x: 8.6, y: 2.18 + i * 1.3, w: 4.1, h: 0.4, fontSize: 14, color: HEX.inkSoft, margin: 0, isTextBox: true });
  });
  table(s, [["분할", "이미지 수", "용도"], ["학습", "55,000", "라벨 100 / 500 / 1,000장 + 나머지는 라벨 없음"], ["검증", "5,000", "λ 선택에만 사용"], ["테스트", "10,000", "최종 평가에만 사용"]],
    M, 4.1, 7.6, { colW: [1.4, 1.6, 4.6], rowH: 0.48, fontSize: 14 });

  s = content("준지도 학습: 라벨 있는 데이터 + 라벨 없는 데이터", "준지도 학습의 핵심 질문: 라벨 없는 데이터에서 무엇을 배울 수 있나? 교차 엔트로피는 라벨이 있어야 계산된다. 라벨 없는 데이터에 쓸 수 있는 손실이 필요하다 — 오늘은 두 가지: 의미 손실(지식)과 엔트로피 최소화(확신).");
  box(s, "라벨 있음\n100장", M, 1.7, 2.6, 1.4, { fill: HEX.neuralTint, size: 18, bold: true });
  box(s, "라벨 없음\n54,900장", M, 3.4, 2.6, 1.4, { fill: HEX.panel, size: 18, bold: true });
  box(s, "신경망\n(MLP)", 4.3, 2.55, 2.4, 1.4, { fill: HEX.white, size: 18, bold: true, line: HEX.line });
  arrow(s, M + 2.65, 2.4, 4.25, 3.0); arrow(s, M + 2.65, 4.1, 4.25, 3.5);
  box(s, "교차 엔트로피\n(정답 라벨 필요)", 7.6, 1.7, 2.6, 1.4, { fill: HEX.neuralTint, size: 15 });
  box(s, "??\n(라벨 없이 무엇을?)", 7.6, 3.4, 2.6, 1.4, { fill: HEX.ruleTint, size: 15, bold: true });
  arrow(s, 6.75, 3.0, 7.55, 2.4); arrow(s, 6.75, 3.5, 7.55, 4.1);
  card(s, 10.5, 1.7, 2.23, 3.1, { title: "후보", tag: "!", tagColor: HEX.rule, body: ["의미 손실 (지식)", "엔트로피 최소화 (확신)"], bodySize: 14 });
  text(s, "모든 방법은 매 스텝 \"라벨 있는 이미지 100장 + 라벨 없는 이미지 250장\"을 함께 본다.", M, 5.3, CW, 0.6, { fontSize: 16, color: HEX.inkSoft });

  s = content("출력 해석: 소프트맥스와 시그모이드", "같은 10개의 로짓을 두 가지로 확률로 바꿀 수 있다. 소프트맥스는 합이 1인 분포(정확히 하나가 구조적으로 강제됨). 시그모이드는 10개의 독립적인 '예/아니오'. 의미 손실은 시그모이드 해석을 쓴다 — 그래야 '정확히 하나'가 지켜지는지를 물을 수 있다.");
  card(s, M, 1.5, 5.9, 4.95, { title: "소프트맥스 — 10개 중 하나를 고르는 분포", tag: "1", tagColor: HEX.neural, fill: HEX.neuralTint });
  await math(s, "q_i = \\frac{e^{z_i}}{\\sum_{j=1}^{10} e^{z_j}}, \\qquad \\sum_i q_i = 1", M + 0.3, 2.45, { pt: 20, maxW: 5.3 });
  bullets(s, ["교차 엔트로피 학습에 사용", "\"정확히 하나\"가 구조로 강제됨", "로짓 전체에 같은 값을 더해도 그대로 (이동 불변)"], M + 0.3, 3.75, 5.3, 2.5, { fontSize: 15 });
  card(s, M + 6.2, 1.5, 5.9, 4.95, { title: "시그모이드 — 10개의 독립적인 예/아니오", tag: "2", tagColor: HEX.rule, fill: HEX.ruleTint });
  await math(s, "p_i = \\sigma(z_i) = \\frac{1}{1 + e^{-z_i}}, \\qquad X_i \\sim \\mathrm{Bernoulli}(p_i)", M + 6.5, 2.45, { pt: 20, maxW: 5.3 });
  bullets(s, ["각 출력 = \"이 이미지는 숫자 i다\"가 참일 확률", "여러 개가 동시에 참일 수도, 하나도 없을 수도", "의미 손실은 이 해석으로 \"정확히 하나\"를 검사"], M + 6.5, 3.75, 5.3, 2.5, { fontSize: 15 });

  s = content("지식: \"숫자는 정확히 하나\" (exactly-one)", "지식을 명제논리로 쓴다. 변수 10개(이 이미지는 숫자 i다). '적어도 하나' 절 1개 + '둘 다는 아니다' 절 45개 = 46개 절. 2^10=1,024개 세계 중 만족하는 것은 원-핫 10개뿐. 이 지식은 라벨이 필요 없다: 어떤 이미지든 성립한다.");
  await math(s, "\\alpha = \\underbrace{(X_0 \\lor X_1 \\lor \\cdots \\lor X_9)}_{\\text{at least one: 1 clause}} \\;\\land\\; \\underbrace{\\bigwedge_{i<j} (\\lnot X_i \\lor \\lnot X_j)}_{\\text{at most one: 45 clauses}}", M + CW / 2, 1.5, { pt: 24, align: "center", maxW: CW });
  const bigs = [["2¹⁰ = 1,024", "가능한 세계 수", HEX.inkSoft], ["10", "α를 만족하는 세계 (원-핫)", HEX.rule], ["46", "CNF 절의 수", HEX.violet]];
  bigs.forEach(([n, l, c], i) => {
    s.addText(n, { x: M + i * 4.1, y: 3.35, w: 3.9, h: 0.8, fontSize: 32, bold: true, color: c, margin: 0, isTextBox: true });
    s.addText(l, { x: M + i * 4.1, y: 4.15, w: 3.9, h: 0.4, fontSize: 14, color: HEX.inkSoft, margin: 0, isTextBox: true });
  });
  card(s, M, 4.9, CW, 1.55, { title: "이 지식은 모든 이미지에 성립한다 — 라벨이 없어도", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint, titleSize: 17,
    body: "정답이 무엇인지는 모르지만, 정답이 \"정확히 하나\"라는 것은 안다. 이 차이가 라벨 없는 데이터를 쓰는 열쇠다.", bodySize: 15 });

  // ---------------- 2. 의미 손실 ----------------
  divider("02", "의미 손실", "\"지식을 만족할 확률\"을 손실로", "2부: 이론의 핵심.");

  s = content("세계와 확률: 3개 클래스로 작게 보기", "변수 3개로 줄여서 본다. 출력 p=(0.8, 0.1, 0.1)을 독립 동전 3개로 보면 세계 8개 각각의 확률이 나온다(참이면 p, 거짓이면 1−p를 곱함). 원-핫 세계 3개의 확률을 더하면 0.684 — 이것이 '지식을 만족할 확률'이다.");
  const p3 = [0.8, 0.1, 0.1];
  const rows3 = [["세계 (X₁, X₂, X₃)", "계산", "확률", "exactly-one"]];
  let sat3 = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
    const w = [a, b, c];
    const t = w.map((x, i) => (x ? p3[i] : 1 - p3[i]));
    const pr = t.reduce((u, v) => u * v, 1);
    const ok = a + b + c === 1;
    if (ok) sat3 += pr;
    rows3.push([`(${w.join(", ")})`, t.map((v) => v.toFixed(1)).join(" × "), { text: pr.toFixed(3), bold: ok }, { text: ok ? "만족" : "위반", fill: ok ? HEX.okTint : HEX.badTint }]);
  }
  table(s, rows3, M, 1.45, 7.4, { colW: [2.0, 2.4, 1.4, 1.6], rowH: 0.47, fontSize: 14 });
  card(s, 8.4, 1.45, 4.33, 4.95, { title: "만족하는 세계의 합", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint, body: [`0.648 + 0.018 + 0.018 = ${sat3.toFixed(3)}`, "= 출력이 지식을 만족할 확률 Pr(α)", "나머지 0.316은 \"0개\" 또는 \"2개 이상\"이 참인 세계"], bodySize: 15 });

  s = content("의미 손실의 정의", "정의. Pr(α)는 만족하는 세계들의 확률 합, 의미 손실은 그 음의 로그. 출력이 원-핫에 가까울수록 Pr(α)→1, 손실→0. 미분 가능하므로 다른 손실에 더해 역전파할 수 있고, 라벨이 필요 없다.");
  await math(s, "\\Pr(\\alpha \\mid \\mathbf{p}) = \\sum_{\\mathbf{x} \\models \\alpha} \\prod_{i:\\,x_i=1} p_i \\prod_{i:\\,x_i=0} (1 - p_i)", M + CW / 2, 1.5, { pt: 28, align: "center" });
  await math(s, "L^{s}(\\alpha, \\mathbf{p}) = -\\log \\Pr(\\alpha \\mid \\mathbf{p})", M + CW / 2, 2.95, { pt: 28, align: "center", color: HEX.rule });
  table(s, [["출력 𝐩 (3개 클래스)", "해석", "Pr(α)", "Lˢ"],
    ["(0.98, 0.01, 0.01)", "확신 있고 원-핫에 가까움", "0.961", { text: "0.04", fill: HEX.okTint, bold: true }],
    ["(0.8, 0.1, 0.1)", "어느 정도 확신", "0.684", "0.38"],
    ["(0.4, 0.4, 0.2)", "애매하게 퍼짐", "0.456", "0.79"],
    ["(0.5, 0.5, 0.5)", "아무것도 모름", "0.375", { text: "0.98", fill: HEX.badTint, bold: true }]],
  M, 4.0, CW, { colW: [3.0, 4.13, 2.0, 3.0], rowH: 0.48, fontSize: 15 });

  s = content("모든 세계를 더하지 않아도 되는 이유: 세 가지 원리",
    "펭귄 예제(P→B, P→¬F)로 원리를 보인다. 원리 1: 변수 하나로 경우를 나누면 겹치지 않으므로 더하면 된다(섀넌 분해). 원리 2: 제약이 없는 변수는 모든 값의 합이 1이라 사라진다. 원리 3: 독립인 부분은 곱으로 쪼개진다. 결과: 세계 5개의 합이 항 2개로 줄어든다. 지식 컴파일(SDD, d-DNNF)은 이 원리를 회로로 자동화한 것.");
  await math(s, "\\Pr(\\alpha) = \\underbrace{(1 - p_P)}_{P=0} \\cdot \\underbrace{1}_{(2)} \\;+\\; \\underbrace{p_P}_{P=1} \\cdot \\underbrace{p_B \\,(1 - p_F)}_{(3)} \\;=\\; 0.2 + 0.144 = 0.344", M + CW / 2, 1.45, { pt: 22, align: "center", maxW: CW });
  const pr3 = [["원리 1", "경우 나누기 (섀넌 분해)", "P=0과 P=1은 겹치지 않는다 → 각 경우의 확률을 더한다", HEX.violet],
    ["원리 2", "자유 변수는 사라진다", "P=0이면 규칙이 자동으로 참 → B, F는 아무 값이나 → 합이 1", HEX.neural],
    ["원리 3", "독립이면 곱한다", "P=1이면 B ∧ ¬F만 남음 → Pr(B)·Pr(¬F) = p_B(1−p_F)", HEX.rule]];
  pr3.forEach(([k, t, d, c], i) => {
    card(s, M + i * 4.1, 3.0, 3.85, 2.55, { title: t, body: d, tag: String(i + 1), tagColor: c, bodySize: 14 });
  });
  text(s, "펭귄 규칙 (P → B) ∧ (P → ¬F), 출력 (p_B, p_F, p_P) = (0.9, 0.8, 0.8): 세계 5개를 더하는 대신 항 2개", M, 5.8, CW, 0.6, { fontSize: 14, color: HEX.inkSoft });

  s = content("원리를 exactly-one에 적용하면: 닫힌 형태",
    "exactly-one에 원리를 적용. 원리 1: '어느 변수가 참인가'로 n개의 겹치지 않는 경우로 나눈다. 원리 3: 각 경우는 독립 곱. 그다음은 대수: 공통 인수 ∏(1−p_j)를 빼면 p_i/(1−p_i)=e^{z_i}(오즈)만 남는다. 로그를 취하면 logsumexp와 softplus — PyTorch에 안정적인 구현이 있다. 계산량 O(n), 1,024개 세계를 나열하지 않는다.");
  let yy = 1.45;
  const st4 = [["\\Pr(\\alpha) = \\sum_{i=1}^{n} p_i \\prod_{j \\ne i} (1 - p_j)", "원리 1 + 원리 3", HEX.violet],
    ["= \\Big[\\prod_{j} (1 - p_j)\\Big] \\sum_{i} \\frac{p_i}{1 - p_i}, \\qquad \\frac{p_i}{1-p_i} = e^{z_i}", "공통 인수 + 오즈", HEX.inkSoft],
    ["\\log \\Pr(\\alpha) = \\operatorname{logsumexp}(z) - \\sum_{j} \\mathrm{softplus}(z_j)", "최종 형태 O(n)", HEX.rule]];
  for (const [eq, lab, c] of st4) {
    pill(s, lab, M, yy + 0.15, 2.8, c);
    await math(s, eq, M + 3.1, yy, { pt: 22, maxW: CW - 3.1, color: c === HEX.rule ? HEX.rule : HEX.ink });
    yy += 1.35;
  }
  text(s, "softplus(z) = log(1 + eᶻ) = −log(1 − σ(z)). 로짓이 ±50이어도 overflow 없이 계산된다.", M, 5.6, CW, 0.6, { fontSize: 15, color: HEX.inkSoft });

  s = content("기울기: 1등은 올리고, 나머지는 내린다",
    "Pr(α)는 각 p_i에 대해 1차식이라 기울기 = (X_i를 참으로 했을 때의 만족 확률) − (거짓으로 했을 때). p=(0.8,0.1,0.1)에서 1등은 +0.63, 나머지는 −0.56. 즉 의미 손실은 이미 앞선 클래스를 더 확신하게 하고 나머지를 끈다. 정답을 모르는 채 '현재 1등'을 밀어준다 — 라벨 없는 데이터에서 '확신'을 만드는 원리이자, 틀린 1등도 밀어줄 수 있는 위험.");
  await math(s, "\\frac{\\partial \\Pr(\\alpha)}{\\partial p_i} = \\Pr(\\alpha \\mid X_i = 1) - \\Pr(\\alpha \\mid X_i = 0)", M + CW / 2, 1.45, { pt: 24, align: "center" });
  const gr = [["p₁ = 0.8 (1등)", "0.81 − 0.18 = +0.63", "↑ 더 확신", HEX.rule], ["p₂ = 0.1", "0.18 − 0.74 = −0.56", "↓ 끈다", HEX.neural], ["p₃ = 0.1", "0.18 − 0.74 = −0.56", "↓ 끈다", HEX.neural]];
  gr.forEach(([k, v, d, c], i) => {
    const x = M + i * 4.1;
    card(s, x, 2.6, 3.85, 1.9, { fill: i === 0 ? HEX.ruleTint : HEX.neuralTint });
    s.addText(k, { x: x + 0.25, y: 2.75, w: 3.4, h: 0.45, fontSize: 17, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
    s.addText(v, { x: x + 0.25, y: 3.25, w: 3.4, h: 0.45, fontSize: 15, color: HEX.inkSoft, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.25, y: 3.75, w: 3.4, h: 0.5, fontSize: 18, bold: true, color: c, margin: 0, isTextBox: true });
  });
  card(s, M, 4.8, CW, 1.65, { title: "의미: 정답을 몰라도 \"현재 1등\"을 더 확신하게 만든다", tag: "!", tagColor: HEX.violet, titleSize: 17,
    body: ["장점: 라벨 없는 이미지도 결정 경계에서 멀어지도록 학습된다", "위험: 1등이 틀렸다면 틀린 답을 더 확신하게 만든다 → λ 조절이 중요"], bodySize: 15 });

  s = content("비교 대상: 엔트로피 최소화",
    "의미 손실과 가장 가까운 기존 기법은 엔트로피 최소화(Grandvalet & Bengio, 2005). 소프트맥스 분포의 엔트로피를 줄여 확신하게 만든다. 둘 다 '확신'을 만들지만 대상이 다르다: 엔트로피는 소프트맥스(이동 불변), 의미 손실은 시그모이드의 절대값. 그래서 엔트로피 최소화는 시그모이드 기준의 '정확히 하나'를 보장하지 않는다 — 결과에서 확인한다. 또 엔트로피는 복잡한 논리 규칙으로 일반화하기 어렵다.");
  card(s, M, 1.5, 5.9, 4.95, { title: "엔트로피 최소화", tag: "H", tagColor: HEX.aqua });
  await math(s, "H(\\mathbf{q}) = -\\sum_i q_i \\log q_i, \\quad \\mathbf{q} = \\mathrm{softmax}(\\mathbf{z})", M + 0.3, 2.45, { pt: 19, maxW: 5.3 });
  bullets(s, ["소프트맥스 분포를 뾰족하게 만든다", "로짓 전체를 올려도 같다 → 참인 시그모이드 수는 못 막음", "다른 논리 규칙으로 확장할 방법이 없다"], M + 0.3, 3.6, 5.3, 2.7, { fontSize: 15 });
  card(s, M + 6.2, 1.5, 5.9, 4.95, { title: "의미 손실 (exactly-one)", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint });
  await math(s, "L^{s} = -\\operatorname{logsumexp}(\\mathbf{z}) + \\sum_i \\mathrm{softplus}(z_i)", M + 6.5, 2.45, { pt: 19, maxW: 5.3 });
  bullets(s, ["시그모이드 10개가 \"정확히 하나만 참\"이 되도록", "로짓의 절대 수준까지 제약한다", "규칙만 바꾸면 어떤 논리 제약으로도 확장 가능 (예: CIFAR 계층 규칙)"], M + 6.5, 3.6, 5.3, 2.7, { fontSize: 15 });

  // ---------------- 3. 설계와 구현 ----------------
  divider("03", "실험 설계와 구현", "질문 → 설정 → 손실 → 코드", "3부.");

  s = content("실험의 질문", "두 가지 질문. Q1은 원 논문의 주장, Q2는 대조 실험. 엔트로피 최소화가 없으면 '지식 덕분'인지 '확신 덕분'인지 구분할 수 없다.");
  const qs = [["Q1", "라벨 없는 이미지에 \"정확히 하나\"라는 지식만 주어도 정확도가 오르는가?", "CE만 vs + 의미 손실"],
    ["Q2", "그 효과는 단순히 \"확신하게 만드는\" 것과 무엇이 다른가?", "+ 엔트로피 최소화 vs + 의미 손실"],
    ["Q3", "라벨 수에 따라 효과는 어떻게 변하는가?", "라벨 100 / 500 / 1,000장"]];
  qs.forEach(([k, q, t], i) => {
    const y0 = 1.6 + i * 1.5;
    pill(s, k, M, y0 + 0.3, 1.0, i === 1 ? HEX.violet : HEX.rule);
    text(s, q, M + 1.3, y0 + 0.15, 7.6, 1.0, { fontSize: 18, valign: "middle" });
    s.addText(t, { x: 9.2, y: y0 + 0.3, w: 3.53, h: 0.45, fontSize: 14, color: HEX.inkSoft, align: "right", valign: "middle", margin: 0, isTextBox: true });
  });

  s = content("신경망과 학습 설정", "모형은 원 논문과 같은 크기의 MLP(784-1000-500-250-250-250-10). 공간 구조를 쓰지 않는 '순열 불변' 설정이라 CNN이나 기하 증강은 쓰지 않는다. 입력 잡음 σ=0.3은 원 논문의 사다리 네트워크 설정을 따른 것. 매 스텝 라벨 100장 + 비라벨 250장, 30에폭(6,600스텝), 1회 학습 약 20초.");
  const layers = [["입력\n784", HEX.panel], ["1000", HEX.neuralTint], ["500", HEX.neuralTint], ["250", HEX.neuralTint], ["250", HEX.neuralTint], ["250", HEX.neuralTint], ["출력\n10 로짓", HEX.ruleTint]];
  layers.forEach(([t, f], i) => {
    const x = M + i * 1.75;
    box(s, t, x, 1.6, 1.45, 1.0, { fill: f, size: 15, bold: i === 6 });
    if (i < layers.length - 1) arrow(s, x + 1.47, 2.1, x + 1.73, 2.1);
  });
  text(s, "각 은닉층: Linear + BatchNorm + ReLU,   학습 시 입력에 가우시안 잡음 σ = 0.3", M, 2.75, CW, 0.4, { fontSize: 13, color: HEX.muted });
  table(s, [["항목", "설정"], ["배치 구성", "매 스텝 라벨 있는 100장(복원 추출) + 라벨 없는 250장"], ["학습 길이", "30에폭 = 6,600스텝 (라벨 없는 이미지 기준)"], ["최적화", "Adam, one-cycle 학습률(최대 0.002), λ는 처음 10% 동안 0에서 증가"], ["라벨 수", "100 / 500 / 1,000장 (클래스별 같은 수), 시드마다 다르게 선택"], ["반복", "λ는 검증셋으로 선택(시드 0) → 테스트는 시드 5개"]],
    M, 3.35, CW, { colW: [2.4, 9.73], rowH: 0.5, fontSize: 14 });

  s = content("손실 함수", "라벨 있는 이미지에는 CE, 모든 이미지(라벨 있는 것 포함)에 정규화 항. 정규화 항이 의미 손실이면 '지식', 엔트로피면 '확신'. 같은 로짓을 CE에는 소프트맥스, 의미 손실에는 시그모이드로 해석한다(원 논문 구현 방식).");
  await math(s, "\\mathcal{L} = \\underbrace{\\frac{1}{|B_L|}\\sum_{b \\in B_L} \\mathrm{CE}(\\mathbf{z}_b, y_b)}_{\\text{라벨 있는 100장}} \\;+\\; \\lambda_t \\cdot \\underbrace{\\frac{1}{|B|}\\sum_{b \\in B} R(\\mathbf{z}_b)}_{\\text{350장 전부}}", M + CW / 2, 1.45, { pt: 24, align: "center", maxW: CW });
  const regs = [["ce", "R = 0", "기준선: 라벨 있는 데이터만", HEX.neural], ["ce_ent", "R = H(softmax(z))", "확신만 (대조군)", HEX.aqua], ["ce_eo", "R = −log Pr(exactly-one)", "지식 (의미 손실)", HEX.rule]];
  regs.forEach(([k, r, d, c], i) => {
    const x = M + i * 4.1;
    card(s, x, 3.3, 3.85, 2.2, { title: k, body: [r, d], tag: String(i + 1), tagColor: c, fill: i === 2 ? HEX.ruleTint : HEX.panel, bodySize: 15 });
  });
  text(s, "λ_t: 학습 초반 10% 동안 0에서 λ까지 선형 증가 (웜업)", M, 5.75, CW, 0.5, { fontSize: 15, color: HEX.violet, bold: true });

  s = content("평가 지표", "정확도 외에 '규칙을 얼마나 지키는가'를 두 가지로 본다. 평균 Pr(EO)는 확률적 준수, 원-핫 비율은 '0.5를 넘는 출력이 정확히 1개인가'라는 이산적 준수.");
  table(s, [["지표", "정의", "의미"],
    ["테스트 정확도", "argmax z = 정답", "기본 성능"],
    ["평균 Pr(exactly-one)", "테스트 이미지 10,000장의 Pr(α) 평균", "규칙을 확률적으로 얼마나 만족하는가"],
    ["원-핫 비율", "σ(zᵢ) > 0.5인 출력이 정확히 1개인 이미지 비율", "규칙을 실제 판단으로 얼마나 지키는가"],
    ["소프트맥스 엔트로피", "H(softmax(z)) 평균", "예측이 얼마나 확신에 차 있는가"]],
  M, 1.5, CW, { colW: [3.0, 5.0, 4.13], rowH: 0.62, fontSize: 15 });
  text(s, "모든 값은 시드 5개의 평균 ± 표준편차. 차이가 표준편차보다 큰지, 시드별로 같은 방향인지 함께 본다.", M, 4.9, CW, 0.6, { fontSize: 15, color: HEX.inkSoft });

  s = content("구현 ①: 손실 함수", "실제 코드. exactly-one은 한 줄. 엔트로피 최소화는 소프트맥스의 로그 확률로 계산. 두 손실 모두 배치 평균. 모든 이미지에 적용하므로 라벨이 필요 없다.");
  code(s, `def exactly_one_log_prob(logits):
    """log Pr(exactly one X_i is true) = logsumexp(z) - sum softplus(z)."""
    return torch.logsumexp(logits, dim=-1) - F.softplus(logits).sum(dim=-1)


def exactly_one_semantic_loss(logits):
    """Batch mean of -log Pr(exactly-one)."""
    return -exactly_one_log_prob(logits).mean()


def softmax_entropy(logits):
    """Batch mean of the entropy of softmax(z)."""
    logp = F.log_softmax(logits, dim=-1)
    return -(logp.exp() * logp).sum(dim=-1).mean()`, M, 1.45, 8.3, 5.05, { size: 13, title: "semloss/losses.py" });
  card(s, 9.2, 1.45, 3.53, 5.05, { title: "수식 ↔ 코드", tag: "=", tagColor: HEX.rule, fill: HEX.ruleTint, body: ["logsumexp(z) ↔ torch.logsumexp", "Σ softplus(zⱼ) ↔ F.softplus().sum", "연산량 O(10), CE 수준"], bodySize: 14 });

  s = content("구현 ②: 학습 스텝", "학습 스텝 하나. 라벨 있는 배치와 라벨 없는 배치를 이어 붙여 한 번에 통과시킨다. CE는 앞쪽(라벨 있는) 부분에만, 정규화 항은 전체에. 모든 방법이 같은 스텝 수로 학습한다.");
  code(s, `bl = lab[torch.randint(len(lab), (100,))]           # 100 labeled (with replacement)
bu = perm[i:i + 250]                                # 250 unlabeled
z = model(torch.cat([x_tr[bl], x_tr[bu]]))          # one forward pass for both
ce = F.cross_entropy(z[:len(bl)], y_tr[bl])         # labels only for the first part
loss = ce
lam_t = lam * min(1.0, step / (warmup_frac * total))
if method == "ce_eo":
    reg = exactly_one_semantic_loss(z)              # knowledge only, no labels: every image
elif method == "ce_ent":
    reg = softmax_entropy(z)                        # control: just make predictions confident
if method != "ce":
    loss = loss + lam_t * reg
opt.zero_grad(); loss.backward(); opt.step()`, M, 1.45, CW, 5.05, { size: 13, title: "semloss/train.py" });

  s = content("구현 ③: 닫힌 형태를 믿어도 되는가 — 테스트", "손으로 유도한 식은 틀릴 수 있다. 정의대로 모든 세계를 더하는 기준 구현(wmc_bruteforce)과 대조한다: 논문 표 값, 클래스 10개(2^10=1,024 세계)에서의 일치, 기울기 일치, 큰 로짓에서의 안정성. 8개 테스트 모두 통과.");
  code(s, `def test_closed_form_matches_bruteforce_for_ten_classes():
    logits = torch.randn(5, 10, dtype=torch.float64) * 3
    cnf = exactly_one_cnf(list(range(1, 11)))                # 46 clauses
    brute = wmc_bruteforce(torch.sigmoid(logits), cnf)       # 2^10 worlds
    assert torch.allclose(exactly_one_log_prob(logits).exp(), brute, rtol=1e-10)


def test_exactly_one_log_prob_is_stable_for_large_logits():
    z = torch.full((2, 10), -50.0)
    z[:, 3] = 50.0
    assert exactly_one_log_prob(z).abs().max() < 1e-6   # one-hot: Pr = 1
    z[:, 4] = 50.0                                       # two "true" outputs
    assert (exactly_one_log_prob(z) < -40).all()         # violated`, M, 1.45, 8.3, 5.05, { size: 12.5, title: "tests/test_losses.py" });
  card(s, 9.2, 1.45, 3.53, 5.05, { title: "8 passed", tag: "✓", tagColor: HEX.aqua, body: ["논문 표 4행 재현", "1,024개 세계 전수 계산과 일치", "기울기 일치 (자동 미분 대조)", "로짓 ±50에서도 안정"], bodySize: 14 });

  // ---------------- 4. 결과 ----------------
  divider("04", "실험 결과", "정확도는 오르고, 규칙 준수는 크게 오른다", "4부.");

  s = content("λ 선택: 검증셋으로 고른다", "의미 손실의 λ에 따른 검증 정확도(시드 0). 라벨이 많을수록 최적 λ가 커지는 경향(0.1 → 1 → 3). CIFAR 실험과 달리 λ=3에서도 학습이 무너지지 않았다. 엔트로피 최소화는 세 경우 모두 λ=0.3이 선택되었다.");
  const lamL = D.lamGrid.map(String);
  s.addChart(pres.charts.LINE, LABELS.map((n) => ({ name: `라벨 ${n}장`, labels: lamL, values: D.tuneAcc(n, "ce_eo").map((v) => +(100 * v).toFixed(1)) })),
    chartBase({ x: M, y: 1.45, w: 8.0, h: 5.05, chartColors: [HEX.neural, HEX.aqua, HEX.rule], lineSize: 2, lineDataSymbol: "circle", lineDataSymbolSize: 8,
      valAxisMinVal: 75, valAxisMaxVal: 100, showTitle: true, title: "의미 손실: 검증 정확도 (%) vs λ", titleFontSize: 13, titleColor: HEX.inkSoft,
      showCatAxisTitle: true, catAxisTitle: "λ", catAxisTitleFontSize: 11, catAxisTitleColor: HEX.inkSoft }));
  card(s, 9.0, 1.45, 3.73, 5.05, { title: "선택된 λ", tag: "λ", tagColor: HEX.violet, body: [{ text: "의미 손실 / 엔트로피", bold: true }, ...LABELS.map((n) => `${n}장: ${D.best[`${n}_ce_eo`]} / ${D.best[`${n}_ce_ent`]}`), "라벨이 많을수록 최적 λ가 커짐", "테스트셋은 선택에 쓰지 않음"], bodySize: 14 });

  s = content("결과 ①: 정확도", "핵심 그림. 세 라벨 수 모두 의미 손실(주황)이 가장 높다. 라벨이 적을수록 CE 대비 이득이 크다. 그러나 엔트로피 최소화(청록)와의 차이는 작다 — 정확도 이득의 대부분은 두 방법이 공유하는 '확신' 효과.");
  s.addChart(pres.charts.BAR, MS.map((m) => ({ name: METHOD_LABEL[m], labels: LABELS.map((n) => `라벨 ${n}장`), values: LABELS.map((n) => +(100 * D.agg[n][m].acc.mean).toFixed(1)) })),
    chartBase({ x: M, y: 1.45, w: 8.6, h: 5.05, barDir: "col", barGrouping: "clustered", barGapWidthPct: 70, barOverlapPct: -8, chartColors: MS.map((m) => METHOD_COLOR[m]),
      valAxisMinVal: 70, valAxisMaxVal: 100, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showTitle: true, title: "테스트 정확도 (%), 5시드 평균", titleFontSize: 13, titleColor: HEX.inkSoft }));
  card(s, 9.5, 1.45, 3.23, 5.05, { title: "의미 손실의 이득", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint,
    body: [{ text: "CE 대비 / 엔트로피 대비", bold: true }, ...LABELS.map((n) => `${n}장: ${sg(gain(n, "ce_eo", "ce"))} / ${sg(gain(n, "ce_eo", "ce_ent"))}%p`)].concat([`전체 라벨 기준: ${f1(D.full.mean)}%`, { text: "y축이 70%에서 시작", sub: true }]), bodySize: 15 });

  s = content("결과 ①-보충: 평균 ± 표준편차와 시드별 비교", "표로 보면. 라벨 100장에서는 시드 간 편차(±3)가 크다 — 어떤 100장을 뽑느냐에 따라 결과가 크게 달라진다. 의미 손실은 CE보다 5개 시드 모두 높다(믿을 만한 차이). 엔트로피 대비는 차이가 편차보다 작아 확실하다고 말하기 어렵다.");
  const tr = [["라벨 수", "CE만", "+ 엔트로피 최소화", "+ 의미 손실", "CE보다 높은 시드", "엔트로피보다 높은 시드"]];
  for (const n of LABELS) tr.push([`${n}장`, msd(D.agg[n].ce.acc, 2), msd(D.agg[n].ce_ent.acc, 2), { text: msd(D.agg[n].ce_eo.acc, 2), bold: true, fill: HEX.ruleTint }, `${wins(n, "ce_eo", "ce")} / 5 시드`, `${wins(n, "ce_eo", "ce_ent")} / 5 시드`]);
  table(s, tr, M, 1.5, CW, { colW: [1.3, 2.0, 2.2, 2.0, 2.2, 2.43], rowH: 0.58, fontSize: 15 });
  card(s, M, 4.1, 5.9, 2.35, { title: "CE 대비: 믿을 만한 향상", tag: "✓", tagColor: HEX.aqua, body: ["세 라벨 수 모두, 5개 시드 모두에서 높다", "라벨이 적을수록 향상이 크다"], bodySize: 15 });
  card(s, M + 6.2, 4.1, 5.9, 2.35, { title: "엔트로피 대비: 작은 차이", tag: "≈", tagColor: HEX.inkSoft, body: ["차이 +0.2~1.0%p, 대부분 편차 범위 안", "정확도만 보면 \"확신\" 효과와 구분하기 어렵다"], bodySize: 15 });

  s = content("결과 ②: 규칙 준수 — 여기서 차이가 드러난다", "정확도로는 비슷했던 두 방법이 규칙 준수에서는 크게 다르다. 의미 손실은 원-핫 비율을 99% 이상으로 올린다. 엔트로피 최소화는 85~87%: 소프트맥스는 확신에 차 있지만 시그모이드로 보면 여러 출력이 동시에 '참'이다. 이것이 '확신'과 '지식'의 차이.");
  s.addChart(pres.charts.BAR, MS.map((m) => ({ name: METHOD_LABEL[m], labels: LABELS.map((n) => `라벨 ${n}장`), values: LABELS.map((n) => +(100 * D.agg[n][m].onehot_rate.mean).toFixed(1)) })),
    chartBase({ x: M, y: 1.45, w: 8.6, h: 5.05, barDir: "col", barGrouping: "clustered", barGapWidthPct: 70, barOverlapPct: -8, chartColors: MS.map((m) => METHOD_COLOR[m]),
      valAxisMinVal: 50, valAxisMaxVal: 100, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showTitle: true, title: "원-핫 비율 (%) : σ(zᵢ) > 0.5인 출력이 정확히 1개", titleFontSize: 13, titleColor: HEX.inkSoft }));
  card(s, 9.5, 1.45, 3.23, 5.05, { title: "평균 Pr(EO)", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint,
    body: [{ text: "CE / 엔트로피 / 의미 손실", bold: true }, ...LABELS.map((n) => `${n}장: ${D.agg[n].ce.mean_pr_eo.mean.toFixed(2)} / ${D.agg[n].ce_ent.mean_pr_eo.mean.toFixed(2)} / ${D.agg[n].ce_eo.mean_pr_eo.mean.toFixed(2)}`), { text: "y축이 50%에서 시작", sub: true }], bodySize: 14 });

  s = content("결과 ③: 출력의 모양을 직접 보면", "라벨 100장, 시드 0으로 학습한 세 모델의 실제 테스트 출력. 오른쪽 예시(정답 2)에서 CE만 쓴 모델은 2, 5, 6의 시그모이드가 모두 0.5를 넘고 6이 가장 높아 오답이다. CE만 쓴 모델은 테스트 이미지의 약 39%에서 0.5를 넘는 출력이 2개 이상이다. 엔트로피 최소화도 15%. 의미 손실은 거의 정확히 하나.");
  const O = D.outputs;
  const cats = ["0개", "1개", "2개", "3개 이상"];
  s.addChart(pres.charts.BAR, MS.map((m) => ({ name: METHOD_LABEL[m], labels: cats, values: O.counts[m].map((c) => +(100 * c / O.n_test).toFixed(1)) })),
    chartBase({ x: M, y: 1.45, w: 6.2, h: 5.05, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60, barOverlapPct: -8, chartColors: MS.map((m) => METHOD_COLOR[m]),
      valAxisMinVal: 0, valAxisMaxVal: 100, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showTitle: true, title: "σ(zᵢ) > 0.5인 출력 개수의 분포 (%), 라벨 100장", titleFontSize: 12, titleColor: HEX.inkSoft }));
  const ex = O.examples.find((e) => e.ce.filter((v) => v > 0.5).length >= 2) || O.examples[0];
  s.addImage({ path: path.join(ASSETS, ex.image), altText: path.basename(path.join(ASSETS, ex.image)), x: 7.1, y: 1.5, w: 1.3, h: 1.3, objectName: "digit" });
  text(s, `테스트 이미지 #${ex.index} (정답 ${ex.label})`, 8.55, 1.6, 4.2, 0.4, { fontSize: 14, bold: true });
  text(s, "각 모델의 시그모이드 출력 σ(z₀) … σ(z₉)", 8.55, 2.05, 4.2, 0.4, { fontSize: 12, color: HEX.muted });
  s.addChart(pres.charts.BAR, MS.map((m) => ({ name: METHOD_LABEL[m], labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], values: ex[m] })),
    chartBase({ x: 7.0, y: 3.0, w: 5.73, h: 3.5, barDir: "col", barGrouping: "clustered", barGapWidthPct: 40, chartColors: MS.map((m) => METHOD_COLOR[m]),
      valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.5, valAxisLabelFormatCode: "0.0", showValue: false, showTitle: false, legendFontSize: 11 }));

  s = content("결과 정리: 확신 vs 지식", "4부 정리. 정확도: 둘 다 '확신'을 만들어서 비슷하게 오른다. 규칙 준수: 의미 손실만 '정확히 하나'를 지킨다. CIFAR-100 계층 규칙 실험에서도 같은 패턴이었다: 정확도는 exactly-one 부분, 규칙 준수는 함의 규칙.");
  table(s, [["", "CE만", "+ 엔트로피 최소화", "+ 의미 손실"],
    ["정확도 (라벨 100장)", f1(D.agg[100].ce.acc.mean), f1(D.agg[100].ce_ent.acc.mean), { text: f1(D.agg[100].ce_eo.acc.mean), bold: true }],
    ["정확도 (라벨 1,000장)", f1(D.agg[1000].ce.acc.mean), f1(D.agg[1000].ce_ent.acc.mean), { text: f1(D.agg[1000].ce_eo.acc.mean), bold: true }],
    ["원-핫 비율 (라벨 100장)", f1(D.agg[100].ce.onehot_rate.mean), f1(D.agg[100].ce_ent.onehot_rate.mean), { text: f1(D.agg[100].ce_eo.onehot_rate.mean), bold: true, fill: HEX.ruleTint }],
    ["무엇을 만드는가", "—", "소프트맥스의 확신", { text: "확신 + 규칙 준수", bold: true }]],
  M, 1.5, CW, { colW: [3.4, 2.4, 3.0, 3.33], rowH: 0.6, fontSize: 15 });
  card(s, M, 4.75, 5.9, 1.7, { title: "정확도: 둘 다 \"확신\"으로 비슷하게 오른다", tag: "≈", tagColor: HEX.aqua, titleSize: 15, body: "라벨 없는 이미지를 결정 경계에서 멀어지게 만드는 효과", bodySize: 14 });
  card(s, M + 6.2, 4.75, 5.9, 1.7, { title: "규칙 준수: 의미 손실만 \"정확히 하나\"를 지킨다", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint, titleSize: 15, body: "CIFAR-100 계층 규칙 실험과 같은 패턴", bodySize: 14 });

  // ---------------- 5. 논문 재현하기 ----------------
  divider("05", "논문 재현하기", "논문은 98%, 우리는 81% — 무엇이 다른가?", "5부: 연구를 읽고 확인하는 법. 대학원생에게 특히 중요한 내용.");

  s = content("논문의 주장과 우리 결과", "원 논문 표 1. 라벨 100장에서 의미 손실 98.38%, 엔트로피 96.27%, 기준선 78.46%. 우리 기준선(76.2%)은 비슷한데, 의미 손실은 80.6%로 18%p나 낮다. 엔트로피도 마찬가지. 무엇이 다를까? 논문 본문만으로는 알 수 없어 공식 코드를 읽었다.");
  s.addChart(pres.charts.BAR, [
    { name: "논문 표 1", labels: ["CE만", "+ 엔트로피", "+ 의미 손실"], values: [PAPER_T1[100].ce[0], PAPER_T1[100].ce_ent[0], PAPER_T1[100].ce_eo[0]] },
    { name: "우리 실험", labels: ["CE만", "+ 엔트로피", "+ 의미 손실"], values: MS.map((m) => +(100 * D.agg[100][m].acc.mean).toFixed(1)) }],
  chartBase({ x: M, y: 1.45, w: 7.6, h: 5.05, barDir: "col", barGrouping: "clustered", barGapWidthPct: 70, barOverlapPct: -8, chartColors: [HEX.violet, HEX.rule],
    valAxisMinVal: 60, valAxisMaxVal: 100, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showTitle: true, title: "라벨 100장, 테스트 정확도 (%)", titleFontSize: 13, titleColor: HEX.inkSoft }));
  card(s, 8.6, 1.45, 4.13, 5.05, { title: "무엇이 이상한가", tag: "?", tagColor: HEX.violet, body: ["기준선은 비슷하다 (78.5 vs 76.2)", "라벨 없는 데이터를 쓰는 두 기법만 크게 다르다 (+20%p vs +4%p)", "논문 본문의 설정 설명만으로는 원인을 알 수 없다", "→ 공식 코드를 읽는다"], bodySize: 15 });

  s = content("공식 코드 읽기: 본문과 다른 점들", "github.com/UCLA-StarAI/Semantic-Loss의 semi_supervised/semantic.py를 읽고 정리한 차이. 증강(크롭)은 본문의 '순열 불변' 설명과 다르고, 학습률·학습 길이도 본문과 다르다. 검증셋 없이 학습 중 테스트 정확도를 출력한다. README는 '라벨 100장 결과는 매우 불안정하며 환경과 TensorFlow 버전에도 영향을 받는다'고 스스로 경고한다.");
  table(s, [["항목", "논문 본문", "공식 코드", "우리 실험"],
    ["전처리", "표준화 + 잡음 σ=0.3", "이미지별 표준화 + 잡음 + 25×25 무작위 크롭", "[0,1] 스케일 + 잡음 σ=0.3"],
    ["지도 손실", "(명시 없음)", "시그모이드 BCE", "소프트맥스 CE"],
    ["의미 손실 가중치", "(부록)", "0.0005, 라벨 있는 이미지에도", "0.1~3 (검증셋 튜닝)"],
    ["학습률 / 길이", "0.002 / 20에폭", "1e-4 / 50,000스텝", "0.002 / 6,600스텝"],
    ["정규화", "배치 정규화", "드롭아웃 0.5 (BN은 사실상 비활성)", "배치 정규화"],
    ["검증셋", "10,000장", "없음 (학습 중 테스트 정확도 출력)", "5,000장"]],
  M, 1.45, CW, { colW: [2.2, 2.6, 4.2, 3.13], rowH: 0.62, fontSize: 13 });
  text(s, "공식 README: \"라벨 100장 결과는 매우 불안정하다 — 시스템 환경, TensorFlow 버전에도 영향을 받는다\"", M, 6.0, CW, 0.5, { fontSize: 14, bold: true, color: HEX.violet });

  s = content("공식 설정을 PyTorch로 옮겨 재현", "공식 코드를 PyTorch로 충실히 이식(paper_protocol.py)하고, README가 중요하다고 한 배치 크기와 손실 가중치를 검증셋으로 튜닝한 뒤 5시드로 평가. 테스트는 마지막 스텝 값만 사용. 기준선은 논문보다 오히려 높지만, 라벨 없는 데이터를 쓰는 기법의 큰 이득은 재현되지 않았다.");
  const pr = [["라벨", "방법", "선택 설정 (배치, 가중치)", "재현 결과", "논문 표 1"]];
  for (const n of [100, 1000]) for (const m of MS) {
    const P = D.paper[n][m];
    pr.push([`${n}장`, METHOD_LABEL[m], m === "ce" ? `${P.cfg.batch_size}, —` : `${P.cfg.batch_size}, ${P.cfg.weight}`, { text: msd(P.acc, 2), bold: m === "ce_eo" }, { text: `${PAPER_T1[n][m][0].toFixed(2)} ± ${PAPER_T1[n][m][1].toFixed(2)}`, bold: m === "ce_eo" }]);
  }
  table(s, pr, M, 1.45, CW, { colW: [1.3, 2.6, 3.0, 2.6, 2.63], rowH: 0.5, fontSize: 14 });
  card(s, M, 5.15, 5.9, 1.3, { title: "기준선: 논문과 같거나 더 높다", tag: "✓", tagColor: HEX.aqua, titleSize: 15 });
  card(s, M + 6.2, 5.15, 5.9, 1.3, { title: "의미 손실·엔트로피의 큰 이득: 재현 안 됨", tag: "✗", tagColor: HEX.rule, fill: HEX.ruleTint, titleSize: 15 });

  s = content("왜 차이가 날까: 확인한 것과 확인하지 못한 것", "확인한 것: (1) 테스트셋 엿보기로는 설명이 안 된다 — 학습 곡선 전체에서 최고값을 골라도 87.8%. (2) 공식 설정은 시그모이드 BCE를 쓰는데, BCE가 이미 출력을 원-핫으로 밀어서 CE만 써도 Pr(EO)=0.96 — 의미 손실이 더할 일이 거의 없다. 확인하지 못한 것: 잡음·학습률 튜닝, TF1의 수치 세부, 시드 10개. 그래서 결론은 '재현 불가'가 아니라 '시도한 범위에서 찾지 못함'.");
  const P100 = D.paper[100];
  card(s, M, 1.5, 5.9, 3.2, { title: "확인한 것", tag: "✓", tagColor: HEX.aqua, body: [
    `테스트 엿보기로는 설명 안 됨: 곡선의 최고값도 ${f1(P100.ce_eo.maxCurve)}%`,
    `BCE가 이미 원-핫을 만든다: CE만 써도 Pr(EO) = ${P100.ce.prEo.toFixed(2)}`,
    "그래서 의미 손실이 더할 일이 거의 없다",
    "기본값(가중치 0.0005)에서는 효과가 사실상 0"], bodySize: 15 });
  card(s, M + 6.2, 1.5, 5.9, 3.2, { title: "확인하지 못한 것", tag: "?", tagColor: HEX.inkSoft, body: [
    "잡음 크기, 학습률 튜닝 (범위 일부만 탐색)",
    "TensorFlow 1과 PyTorch의 수치·초기화 세부",
    "논문의 시드 10개, 검증셋 10,000장 조건",
    "결론: \"재현 불가\"가 아니라 \"찾지 못함\""], bodySize: 15 });

  s = content("교훈: 논문 결과를 읽고 확인하는 법", "5부 정리. 학생들이 논문을 읽고 재현할 때의 체크리스트. 특히 '대조군'과 '공식 코드'가 핵심. 그리고 의미 손실의 개념 자체(규칙 준수를 만든다)는 두 설정 모두에서 확인되었다는 점을 강조 — 수치가 재현되지 않는다고 아이디어가 틀린 것은 아니다.");
  const les = [["1", "본문만 믿지 말고 공식 코드를 읽는다", "증강, 학습률, 손실 형태가 본문과 다를 수 있다", HEX.violet],
    ["2", "기준선부터 맞춘다", "기준선이 맞아야 \"방법의 효과\"를 비교할 수 있다", HEX.neural],
    ["3", "대조군을 둔다", "엔트로피 최소화가 없었다면 \"지식 덕분\"이라고 오해했을 것", HEX.aqua],
    ["4", "테스트셋은 마지막에 한 번만", "선택은 검증셋으로. 학습 중 테스트 정확도는 기록만", HEX.rule],
    ["5", "결론의 강도를 정직하게", "\"재현 불가\" ≠ \"시도한 범위에서 찾지 못함\"", HEX.inkSoft]];
  les.forEach(([n, t, d, c], i) => {
    const y0 = 1.45 + i * 1.0;
    s.addShape(pres.shapes.OVAL, { x: M, y: y0 + 0.12, w: 0.6, h: 0.6, fill: { color: c }, line: { color: c }, objectName: "num" });
    s.addText(n, { x: M, y: y0 + 0.12, w: 0.6, h: 0.6, fontSize: 18, bold: true, color: HEX.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText(t, { x: M + 0.85, y: y0 + 0.05, w: 5.4, h: 0.75, fontSize: 17, bold: true, color: HEX.ink, valign: "middle", margin: 0, isTextBox: true });
    s.addText(d, { x: M + 6.35, y: y0 + 0.05, w: 5.78, h: 0.75, fontSize: 15, color: HEX.inkSoft, valign: "middle", margin: 0, isTextBox: true });
  });

  // ---------------- 6. 마무리 ----------------
  divider("06", "마무리", "정리와 확인", "6부.");

  s = content("핵심 정리", "세 줄 요약.");
  const take = [["1", "의미 손실 = −log Pr(지식을 만족)", "출력을 독립 확률로 보고, 지식을 만족하는 세계들의 확률을 더한다. exactly-one은 logsumexp − Σsoftplus 한 줄.", HEX.rule],
    ["2", "계산은 세 원리로 줄어든다", "경우 나누기(합), 자유 변수 소거(1), 독립 분리(곱). 지식 컴파일은 이를 자동화한 것.", HEX.violet],
    ["3", "정확도는 확신이, 규칙 준수는 지식이 만든다", `라벨 100장: CE ${f1(D.agg[100].ce.acc.mean)}% → 의미 손실 ${f1(D.agg[100].ce_eo.acc.mean)}% (엔트로피 ${f1(D.agg[100].ce_ent.acc.mean)}%). 원-핫 비율은 의미 손실만 99% 이상. 논문의 98%는 재현하지 못했다.`, HEX.neural]];
  take.forEach(([n, t, d, c], i) => {
    const y0 = 1.5 + i * 1.65;
    s.addShape(pres.shapes.OVAL, { x: M, y: y0 + 0.1, w: 0.8, h: 0.8, fill: { color: c }, line: { color: c }, objectName: "num" });
    s.addText(n, { x: M, y: y0 + 0.1, w: 0.8, h: 0.8, fontSize: 26, bold: true, color: HEX.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText(t, { x: M + 1.1, y: y0, w: CW - 1.1, h: 0.55, fontSize: 21, bold: true, color: HEX.ink, margin: 0, isTextBox: true, valign: "middle" });
    s.addText(d, { x: M + 1.1, y: y0 + 0.58, w: CW - 1.1, h: 0.8, fontSize: 15, color: HEX.inkSoft, margin: 0, isTextBox: true, valign: "top" });
  });

  s = content("이해 확인 문제", "3~5분. 정답은 다음 슬라이드.");
  const qq = [["Q1", "출력 p = (0.6, 0.6, 0.1)일 때 exactly-one의 Pr(α)는? 두 개가 동시에 높으면 왜 손실이 커지는가?"],
    ["Q2", "출력이 소프트맥스뿐인 모델에 exactly-one 의미 손실을 걸면 어떻게 되는가?"],
    ["Q3", "엔트로피 최소화 모델의 원-핫 비율이 85~87%에 그친 이유는?"],
    ["Q4", "논문 재현에서 기준선을 먼저 맞추는 것이 왜 중요한가?"]];
  qq.forEach(([k, q], i) => {
    const y0 = 1.5 + i * 1.25;
    pill(s, k, M, y0 + 0.25, 0.9, i === 3 ? HEX.violet : HEX.rule);
    text(s, q, M + 1.2, y0 + 0.12, CW - 1.2, 0.9, { fontSize: 17, valign: "middle" });
  });

  s = content("정답과 해설", "해설.");
  await math(s, "\\text{Q1: } \\Pr = 0.6\\cdot0.4\\cdot0.9 + 0.4\\cdot0.6\\cdot0.9 + 0.4\\cdot0.4\\cdot0.1 = 0.448,\\quad L^s \\approx 0.80", M, 1.5, { pt: 19, maxW: CW });
  text(s, "두 출력이 모두 높으면 \"둘 다 참\"인 (위반) 세계의 확률이 커진다. 기울기는 둘 중 하나를 끄도록 작용한다.", M, 2.2, CW, 0.6, { fontSize: 15, color: HEX.inkSoft });
  text(s, [{ text: "Q2: ", options: { bold: true } }, { text: "의미가 없다. 소프트맥스는 합이 1인 분포라 \"정확히 하나\"가 이미 구조로 강제된다. 의미 손실은 출력을 독립 확률(시그모이드)로 볼 때 의미가 있다." }], M, 2.95, CW, 0.9, { fontSize: 16 });
  text(s, [{ text: "Q3: ", options: { bold: true } }, { text: "엔트로피는 소프트맥스에 걸리고, 소프트맥스는 로짓 전체를 같이 올려도 변하지 않는다. 그래서 로짓이 모두 높은 채로(시그모이드 여러 개 > 0.5) 소프트맥스만 뾰족해질 수 있다." }], M, 3.95, CW, 1.0, { fontSize: 16 });
  text(s, [{ text: "Q4: ", options: { bold: true } }, { text: "기준선이 다르면 \"방법의 효과\"와 \"설정의 차이\"를 구분할 수 없다. 이번에는 기준선이 맞았기 때문에, 차이가 라벨 없는 데이터를 쓰는 부분에 있음을 좁힐 수 있었다." }], M, 5.05, CW, 1.0, { fontSize: 16 });

  s = content("참고문헌", "추가 읽기.");
  bullets(s, [
    "J. Xu, Z. Zhang, T. Friedman, Y. Liang, G. Van den Broeck. A Semantic Loss Function for Deep Learning with Symbolic Knowledge. ICML 2018.",
    "공식 코드: github.com/UCLA-StarAI/Semantic-Loss (semi_supervised/semantic.py, mnist_input.py)",
    "Y. LeCun, C. Cortes, C. J. C. Burges. The MNIST database of handwritten digits.",
    "Y. Grandvalet, Y. Bengio. Semi-supervised Learning by Entropy Minimization. NeurIPS 2005.",
    "A. Rasmus, H. Valpola, M. Honkala, M. Berglund, T. Raiko. Semi-Supervised Learning with Ladder Networks. NeurIPS 2015.",
    "A. Darwiche, P. Marquis. A Knowledge Compilation Map. JAIR 17, 2002.",
  ], M, 1.5, CW, 5.0, { fontSize: 14 });

  // ---------------- 부록 ----------------
  divider("부록", "실습", "직접 돌려 보기", "부록: 수업 후 실습용.");

  s = content("부록 A: 실습 환경과 실행", "MLP라 CPU에서도 돈다(1회 수십 초~수 분). 논문 재현 스크립트는 2시간 이상 걸리므로 과제용으로는 일부 설정만 돌리도록 안내.");
  card(s, M, 1.5, 4.1, 4.95, { title: "환경", tag: "1", tagColor: HEX.neural, body: ["Python 3.10+, PyTorch 2.x, NumPy", "torchvision 불필요", "GPU 자동 선택 (CPU 가능)", "MNIST 자동 다운로드 (11MB)", "1회 학습 약 20초 (M4 Max, MPS)"], bodySize: 14 });
  code(s, `# 1. 손실 함수 단위 테스트
python3 -m pytest -q tests

# 2. 우리 실험: λ 튜닝 → 3 라벨 수 × 3 방법 × 5 시드 (약 30분)
python3 run_experiments.py

# 3. 결과 표 → results/summary.md
python3 summarize.py

# 4. 공식 코드 설정 재현 (약 2.5시간)
python3 run_paper_protocol.py`, M + 4.35, 1.5, 7.78, 4.95, { size: 14, title: "터미널" });

  s = content("부록 B: 실습 과제", "난이도 순. 과제 3은 이번에 확인하지 못한 부분(잡음·학습률)을 직접 탐색해 보는 과제.");
  const hw = [["기초", "λ 바꿔 보기", "라벨 100장에서 λ ∈ {0.01, 1, 30}을 비교하라. 학습 로그의 val Pr(EO)와 정확도는 어떻게 움직이는가?", HEX.neural],
    ["기초", "출력 들여다보기", "CE만 쓴 모델과 의미 손실 모델에서, 0.5를 넘는 시그모이드가 2개 이상인 테스트 이미지를 찾아 그려 보라.", HEX.neural],
    ["심화", "재현 실험 확장", "paper_protocol.py에서 잡음 σ ∈ {0.1, 0.5}, 학습률 ∈ {1e-3, 1e-5}를 탐색하라. 논문 수치에 가까워지는가?", HEX.rule],
    ["심화", "새로운 지식", "\"짝수 숫자는 0, 2, 4, 6, 8 중 하나\" 같은 상위 개념 변수를 추가하고, 그 제약의 닫힌 형태를 세 원리로 유도하라.", HEX.rule]];
  hw.forEach(([lv, t, d, c], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    card(s, M + col * 6.15, 1.5 + row * 2.5, 5.95, 2.25, { title: t, body: d, tag: lv === "기초" ? "B" : "A", tagColor: c, bodySize: 14 });
  });

  applyNotes();
  await pres.writeFile({ fileName: OUT });
  if (applyTheme) await applyTheme(OUT, THEME);
  else console.warn("APPLY_THEME_JS not set: theme colors not applied");
  console.log("wrote", OUT);
}

build().catch((e) => { console.error(e); process.exit(1); });
