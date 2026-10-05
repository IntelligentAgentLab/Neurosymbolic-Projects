// Builds the lecture deck: Semantic loss on CIFAR-100 hierarchy.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { tex } = require("./math.js");
const { load } = require("./results.js");
// Optional: writes THEME's colors into the deck's theme part. Set APPLY_THEME_JS to an apply_theme.js
// module (from the pptx skill); without it the deck still builds, with Office's default theme colors.
const applyTheme = process.env.APPLY_THEME_JS ? require(process.env.APPLY_THEME_JS).applyTheme : null;

const OUT = process.argv[2] || "SemanticLoss_Lecture.pptx";
const ASSETS = path.join(__dirname, "assets");
const R = load();

// ---------- theme ----------
const HEX = {
  ink: "1F2933", inkSoft: "52606D", muted: "7B8794", dark: "14202E", panel: "F1F4F8", line: "D9DEE5",
  neural: "2A78D6", rule: "EB6834", aqua: "1BAF7A", violet: "4A3AA7", gold: "EDA100", white: "FFFFFF",
  codeBg: "1B2430", okTint: "E3F4EC", badTint: "FCE6DC", ruleTint: "FDEEE6", neuralTint: "E6F0FB",
};
const THEME = {
  name: "Semantic Loss Lecture",
  headFontFace: "Malgun Gothic",
  bodyFontFace: "Malgun Gothic",
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.dark, lt2: HEX.panel,
    accent1: HEX.neural, accent2: HEX.rule, accent3: HEX.aqua, accent4: HEX.violet, accent5: HEX.gold, accent6: HEX.inkSoft,
    hlink: HEX.neural, folHlink: HEX.violet,
  },
};
const METHOD_COLOR = { ce_fine: HEX.neural, ce_both: HEX.violet, ce_both_eo: HEX.aqua, ce_both_sl: HEX.rule };
const METHOD_LABEL = { ce_fine: "fine CE", ce_both: "fine+coarse CE", ce_both_eo: "+ exactly-one SL", ce_both_sl: "+ 계층 의미 손실" };
const SETTING_LABEL = { full: "full (라벨 100%)", semi: "semi (라벨 10%)", weak: "weak (fine 10% + coarse 100%)" };
const CODE_FONT = "Consolas";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "의미 손실(Semantic Loss)로 규칙을 학습하는 신경망";
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
    { text: { text: "의미 손실 · CIFAR-100 계층 규칙", options: { x: M, y: 6.95, w: 6, h: 0.3, fontSize: 10, color: HEX.muted, margin: 0 } } },
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
const BUDGET = { "도입": 3, "뉴로심볼릭 도입": 4, "사전 지식": 9, "의미 손실 이론": 22, "실험 목적과 데이터": 6, "실험 설계와 구현": 20, "실험 결과와 토론": 16, "실습": 0 };
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

// =====================================================================
async function build() {
  // ---------------- 0. Title & agenda ----------------
  sectionStart("도입");
  let s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: section });
  s.addText("규칙을 지키도록 학습하는 신경망", { placeholder: "title" });
  s.addText("의미 손실(Semantic Loss)로 CIFAR-100의 클래스 계층 규칙을 주입하는 실험", { placeholder: "body" });
  pill(s, "Neural", M, 1.2, 1.3, HEX.neural);
  s.addText("+", { x: M + 1.35, y: 1.2, w: 0.4, h: 0.4, fontSize: 20, bold: true, color: HEX.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
  pill(s, "Symbolic", M + 1.8, 1.2, 1.5, HEX.rule);
  s.addText(`뉴로심볼릭 AI 강의 · ${Object.values(BUDGET).reduce((a, b) => a + b, 0)}분`, { x: M, y: 6.6, w: 8, h: 0.4, fontSize: 14, color: "9AA5B1", margin: 0, isTextBox: true });
  note(s, "강의 소개. 오늘은 '규칙(지식)을 신경망 학습에 넣는 방법' 중 하나인 의미 손실을 이론-구현-실험 순으로 끝까지 따라가 본다. 학부생은 직관과 예제, 대학원생은 유도와 코드에 초점을 두면 된다.");

  s = content("오늘의 흐름", "[0:01] 전체 약 78분 구성. 1~2부(도입, 사전 지식)는 학부생을 위한 기초, 3부가 이론의 핵심, 4~6부는 실제 실험을 설계·구현·평가한 과정이다. 부록은 실습용이다.");
  const agenda = [
    ["1", "뉴로심볼릭 도입", "신경망과 기호 논리를 왜 결합하는가", "7분"],
    ["2", "사전 지식", "시그모이드·소프트맥스, 교차 엔트로피, 명제논리", "9분"],
    ["3", "의미 손실 이론", "정의, 예제, 계산 원리, 기울기, 닫힌 형태", "22분"],
    ["4", "실험 목적과 데이터", "연구 질문, CIFAR-100 계층 구조", "6분"],
    ["5", "실험 설계와 구현", "규칙·손실·모형·반복 실험·코드", "20분"],
    ["6", "결과와 토론", "세 가지 설정, 대조 실험, 한계", "16분"],
  ];
  agenda.forEach(([n, t, d, m], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.15, y = 1.5 + row * 1.7;
    card(s, x, y, 5.95, 1.45, { title: t, body: d, tag: n, tagColor: i < 2 ? HEX.neural : i === 2 ? HEX.rule : HEX.violet });
    s.addText(m, { x: x + 4.7, y: y + 0.22, w: 1.0, h: 0.48, fontSize: 13, color: HEX.muted, align: "right", valign: "middle", margin: 0, isTextBox: true });
  });

  s = content("신경망은 스스로 모순된 답을 낸다",
    "[0:03] 동기. 이 숫자는 우리 실험에서 나온 실제 값이다(weak 설정, fine+coarse CE 모델, 테스트 3시드 평균). 한 네트워크가 '단풍나무'와 '탈것'을 동시에 답하는 경우가 4장 중 1장꼴. 사람은 '단풍나무면 나무다'를 알지만 신경망은 이 지식을 모른다. 오늘의 질문: 이 지식을 학습에 어떻게 넣을까?");
  const incons = R.agg.weak.ce_both ? 1 - R.agg.weak.ce_both.consistency.mean : 0.24;
  s.addText(`${(100 * incons).toFixed(0)}%`, { x: M, y: 1.6, w: 4.6, h: 1.6, fontSize: 96, bold: true, color: HEX.rule, margin: 0, isTextBox: true, objectName: "stat" });
  text(s, "세부 클래스 예측과 상위 클래스 예측이 서로 모순되는 테스트 이미지의 비율", M, 3.25, 4.6, 0.9, { fontSize: 16, color: HEX.inkSoft });
  text(s, "CIFAR-100, fine 라벨 10% + coarse 라벨 100%로 학습한 ResNet-9 (규칙 없음)", M, 4.25, 4.6, 0.7, { fontSize: 12, color: HEX.muted });
  s.addImage({ path: path.join(ASSETS, "img/maple_tree.png"), altText: path.basename(path.join(ASSETS, "img/maple_tree.png")), x: 6.2, y: 1.6, w: 2.2, h: 2.2, objectName: "maple" });
  box(s, "fine 출력: maple_tree (단풍나무)", 8.7, 1.6, 4.0, 0.9, { fill: HEX.neuralTint, size: 15, bold: true });
  box(s, "coarse 출력: vehicles_1 (탈것)", 8.7, 2.75, 4.0, 0.9, { fill: HEX.badTint, size: 15, bold: true });
  card(s, 6.2, 4.3, 6.5, 2.2, { title: "사람이 아는 규칙", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint,
    body: ["maple_tree → trees : 단풍나무이면 나무다", "세부 클래스마다 규칙 하나, 100개면 모순이 사라진다", "질문: 이 지식을 신경망 학습에 어떻게 넣을 것인가?"] });

  // ---------------- 1. Neuro-symbolic intro ----------------
  divider("01", "뉴로심볼릭 도입", "지각(perception)과 추론(reasoning)을 한 시스템에", "[0:05] 1부 시작.");

  s = content("두 패러다임은 서로의 약점을 보완한다",
    "[0:06] 신경망은 픽셀에서 개념을 뽑는 지각에 강하지만 규칙을 보장하지 않고 많은 데이터가 필요하다. 기호 AI는 규칙을 정확히 다루고 설명 가능하지만, 픽셀 같은 원시 입력을 다루지 못한다. 뉴로심볼릭은 둘을 결합한다.");
  card(s, M, 1.5, 5.9, 3.6, { title: "신경망 (Neural)", tag: "N", tagColor: HEX.neural, fill: HEX.neuralTint,
    body: ["강점: 이미지·음성·텍스트 같은 원시 데이터에서 패턴을 학습", "강점: 잡음에 강하고 미분 가능 → 경사하강법", "약점: 대량의 라벨 데이터가 필요", "약점: 명시적 규칙을 보장하지 못함 (모순된 출력 가능)", "약점: 왜 그런 답을 냈는지 설명하기 어려움"] });
  card(s, M + 6.2, 1.5, 5.9, 3.6, { title: "기호 AI (Symbolic)", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint,
    body: ["강점: 논리 규칙으로 지식을 정확하게 표현", "강점: 적은 데이터로도 추론 가능, 결과 설명 가능", "강점: 제약을 100% 만족하는 답을 보장", "약점: 원시 데이터(픽셀)를 직접 다루지 못함", "약점: 규칙을 사람이 작성해야 하고, 예외에 취약"] });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.4, w: CW, h: 1.05, fill: { color: HEX.white }, line: { color: HEX.violet, width: 1.5 }, rectRadius: 0.12, objectName: "callout" });
  text(s, [{ text: "뉴로심볼릭 AI", options: { bold: true, color: HEX.violet } }, { text: " = 신경망의 지각(픽셀 → 개념) + 기호 AI의 추론(개념 → 규칙에 맞는 결론)" }], M + 0.3, 5.4, CW - 0.6, 1.05, { fontSize: 17, valign: "middle" });

  s = content("지식을 신경망에 넣는 세 가지 통로",
    "[0:08] 지식을 넣는 위치에 따라 분류할 수 있다. 오늘 다룰 의미 손실은 '손실 함수' 쪽이다. 장점: 모델 구조를 바꾸지 않고, 추론 시 추가 비용이 없으며, 라벨 없는 데이터에도 적용 가능. 관련 연구로 DeepProbLog(구조/추론 쪽), Logic Tensor Networks(퍼지 논리 기반 손실)가 있다.");
  const routes = [
    ["입력 · 데이터", "규칙으로 데이터를 보강", "예: 규칙 기반 증강, 가짜 라벨", HEX.inkSoft],
    ["구조 · 추론", "네트워크에 논리 추론기를 내장", "예: DeepProbLog, 제약 출력층", HEX.violet],
    ["손실 · 학습 목표", "규칙 위반을 벌점으로 학습", "예: 의미 손실, LTN", HEX.rule],
  ];
  routes.forEach(([t, d, e, c], i) => {
    const x = M + i * 4.1;
    card(s, x, 1.6, 3.85, 3.0, { title: t, body: [d, e], tag: String(i + 1), tagColor: c, fill: i === 2 ? HEX.ruleTint : HEX.panel });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.95, w: CW, h: 1.45, fill: { color: HEX.white }, line: { color: HEX.rule, width: 1.5 }, rectRadius: 0.12, objectName: "callout" });
  text(s, [{ text: "오늘의 주제 — 의미 손실 (Xu et al., ICML 2018)", options: { bold: true, color: HEX.rule, breakLine: true } },
    { text: "명제논리 제약 α를 만족할 확률을 손실로 바꾼다 — 구조 변경 없음 · 추론 비용 없음 · 라벨 없는 데이터에도 적용", options: { color: HEX.ink } }],
  M + 0.3, 5.15, CW - 0.6, 1.1, { fontSize: 16 });

  // ---------------- 2. Background ----------------
  divider("02", "사전 지식", "출력 확률, 손실 함수, 명제논리의 기본 개념", "[0:10] 2부: 이후 수식을 따라오기 위한 최소한의 배경.");

  s = content("시그모이드와 소프트맥스: 두 가지 확률 해석",
    "[0:11] 같은 로짓 z를 두 방식으로 확률로 바꿀 수 있다. 소프트맥스는 '하나의 분포'(합=1), 시그모이드는 '서로 독립인 n개의 동전'. 의미 손실은 시그모이드 해석을 쓴다: 각 출력이 독립적인 명제 변수 X_i가 참일 확률. 이 점이 이후 '세계의 확률'을 정의하는 핵심이다.");
  card(s, M, 1.5, 5.9, 4.95, { title: "소프트맥스 — 하나의 범주형 분포", tag: "1", tagColor: HEX.violet });
  await math(s, "\\mathrm{softmax}(z)_i = \\dfrac{e^{z_i}}{\\sum_{j=1}^{n} e^{z_j}},\\qquad \\sum_i p_i = 1", M + 0.3, 2.45, { pt: 20, maxW: 5.3 });
  bullets(s, ["정확히 하나의 클래스가 정답이라고 가정", "다중 클래스 분류의 표준 (교차 엔트로피와 결합)", "출력 사이의 관계가 구조적으로 고정됨"], M + 0.3, 3.85, 5.3, 2.3);
  card(s, M + 6.2, 1.5, 5.9, 4.95, { title: "시그모이드 — 독립적인 n개의 베르누이", tag: "2", tagColor: HEX.rule, fill: HEX.ruleTint });
  await math(s, "p_i = \\sigma(z_i) = \\dfrac{1}{1+e^{-z_i}},\\qquad X_i \\sim \\mathrm{Bernoulli}(p_i)", M + 6.5, 2.45, { pt: 20, maxW: 5.3 });
  bullets(s, ["각 출력 = '명제 X_i가 참'일 확률", "합이 1일 필요 없음 → 동시에 여러 개가 참일 수도", "의미 손실은 이 해석을 사용", { text: "z → log p = −softplus(−z),  log(1−p) = −softplus(z)", sub: true }], M + 6.5, 3.85, 5.3, 2.4);

  s = content("교차 엔트로피: 정답 방향을 알려주는 손실",
    "[0:13] 교차 엔트로피는 '정답 클래스의 로그 확률'을 최대화한다. 로짓에 대한 기울기가 p − y로 매우 단순하다는 점이 중요: 정답 쪽 확률은 올리고 나머지는 내린다. 의미 손실은 정답(y)을 모른다는 점에서 근본적으로 다르다 — 이 대비를 기억해 두자.");
  await math(s, "\\mathcal{L}_{\\mathrm{CE}}(z, y) = -\\log \\mathrm{softmax}(z)_y = -z_y + \\log \\sum_{j} e^{z_j}", M, 1.6, { pt: 26, maxW: CW });
  await math(s, "\\frac{\\partial \\mathcal{L}_{\\mathrm{CE}}}{\\partial z_j} = p_j - \\mathbb{1}[j = y]", M, 2.75, { pt: 26 });
  card(s, M, 4.0, 5.9, 2.45, { title: "필요한 것: 정답 라벨 y", tag: "N", tagColor: HEX.neural, fill: HEX.neuralTint,
    body: ["라벨이 있는 데이터에만 적용 가능", "정답 클래스의 확률을 1로, 나머지를 0으로 민다"] });
  card(s, M + 6.2, 4.0, 5.9, 2.45, { title: "의미 손실과의 차이", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint,
    body: ["의미 손실은 y가 필요 없다 — 규칙 α만 있으면 된다", "\"무엇이 정답인지\"가 아니라 \"어떤 조합이 가능한지\"를 가르친다"] });

  s = content("명제논리 기초: 함의(→)의 진리표",
    "[0:15] 학생들이 가장 헷갈리는 부분. P→Q는 'P가 참인데 Q가 거짓'인 경우에만 거짓이다. 특히 P가 거짓이면 Q와 상관없이 참(공허한 참). 펭귄 예제에서 '펭귄이 아니면 규칙은 자동으로 만족'이 바로 이 성질이다. 또한 P→Q ≡ ¬P∨Q 로 바꿔 쓸 수 있어 CNF로 표현된다.");
  table(s, [["P", "Q", "P → Q", "읽는 법"],
    ["1", "1", { text: "1", fill: HEX.okTint }, "펭귄이고 새다 — 규칙 만족"],
    ["1", "0", { text: "0", fill: HEX.badTint, bold: true }, "펭귄인데 새가 아니다 — 유일한 위반"],
    ["0", "1", { text: "1", fill: HEX.okTint }, "펭귄이 아니다 — 규칙과 무관 (공허한 참)"],
    ["0", "0", { text: "1", fill: HEX.okTint }, "펭귄이 아니다 — 규칙과 무관 (공허한 참)"]],
  M, 1.55, 7.4, { colW: [0.8, 0.8, 1.2, 4.6], rowH: 0.55, fontSize: 15, centerFirst: true });
  card(s, 8.4, 1.55, 4.33, 4.9, { title: "기호 정리", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint,
    body: ["¬ 부정 (not)", "∧ 논리곱 (and)", "∨ 논리합 (or)", "→ 함의 (if-then)", "P → Q ≡ ¬P ∨ Q", "리터럴: 변수 또는 그 부정", "절(clause): 리터럴의 논리합"] });
  text(s, "핵심: P → Q는 \"P가 참이면서 Q가 거짓\"인 경우 하나만 금지한다.", M, 4.55, 7.4, 0.8, { fontSize: 17, bold: true, color: HEX.rule });

  s = content("CNF와 \"세계(world)\": 제약을 만족하는 할당의 집합",
    "[0:18] CNF(논리곱 표준형)는 절들의 논리곱이다. n개의 변수에 0/1을 할당한 것 하나를 '세계'라 부르고, 총 2^n개가 있다. α를 만족하는 세계의 집합이 이후 확률 계산의 대상이다. exactly-one을 예로 들면 2^3=8개 중 3개만 만족한다.");
  await math(s, "\\alpha = \\underbrace{(X_1 \\lor X_2 \\lor X_3)}_{\\text{at least one}} \\land \\underbrace{(\\lnot X_1 \\lor \\lnot X_2) \\land (\\lnot X_1 \\lor \\lnot X_3) \\land (\\lnot X_2 \\lor \\lnot X_3)}_{\\text{at most one}}", M, 1.5, { pt: 22, maxW: CW });
  const worlds = [];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) worlds.push([a, b, c]);
  worlds.forEach((wv, i) => {
    const ok = wv[0] + wv[1] + wv[2] === 1;
    const x = M + i * 1.5;
    box(s, `(${wv.join(",")})`, x, 3.15, 1.3, 0.8, { fill: ok ? HEX.okTint : HEX.panel, size: 16, bold: ok, line: ok ? HEX.aqua : HEX.line });
    s.addText(ok ? "만족" : "위반", { x, y: 4.0, w: 1.3, h: 0.35, fontSize: 12, color: ok ? HEX.aqua : HEX.muted, align: "center", margin: 0, isTextBox: true });
  });
  bullets(s, ["세계 = 모든 변수에 0/1을 할당한 것 (n개 변수 → 2ⁿ개)", "x ⊨ α : 세계 x가 α를 만족한다", "exactly-one(원-핫) 제약을 만족하는 세계는 (1,0,0), (0,1,0), (0,0,1) 세 개뿐"], M, 4.65, CW, 1.8);

  // ---------------- 3. Theory ----------------
  divider("03", "의미 손실 이론", "제약을 만족할 확률을 손실로 — Xu et al. (2018)", "[0:20] 3부: 오늘의 핵심 이론.");

  s = content("의미 손실의 정의",
    "[0:21] 정의를 천천히 읽는다. 네트워크 출력 p를 n개의 독립 동전으로 보고 세계 하나를 뽑는다고 하자. 그 세계가 α를 만족할 확률이 Pr(α)이고, 의미 손실은 그 음의 로그다. 이 양을 '가중 모델 카운팅(WMC)'이라고도 부른다. 비례 기호(∝)는 원 논문 표기이며, 실제로는 가중치 λ로 스케일한다.");
  await math(s, "\\Pr(\\alpha \\mid \\mathbf{p}) = \\sum_{\\mathbf{x} \\models \\alpha} \\; \\prod_{i:\\, x_i = 1} p_i \\prod_{i:\\, x_i = 0} (1 - p_i)", M + CW / 2, 1.5, { pt: 30, align: "center", name: "eq-wmc" });
  await math(s, "L^{s}(\\alpha, \\mathbf{p}) \\;\\propto\\; -\\log \\Pr(\\alpha \\mid \\mathbf{p})", M + CW / 2, 3.0, { pt: 30, align: "center", color: HEX.rule, name: "eq-sl" });
  const parts = [["𝐩", "신경망의 시그모이드 출력 (독립 확률)"], ["𝐱 ⊨ α", "α를 만족하는 모든 세계에 대해 합"], ["∏", "세계 하나의 확률: 참이면 pᵢ, 거짓이면 1−pᵢ"], ["−log", "만족 확률이 1이면 손실 0, 0에 가까우면 손실 ∞"]];
  parts.forEach(([k, v], i) => {
    const x = M + i * 3.05;
    card(s, x, 4.45, 2.85, 2.0, { title: k, body: v, titleSize: 18, bodySize: 14, fill: i % 2 ? HEX.panel : HEX.ruleTint });
  });

  s = content("의미 손실이 갖는 좋은 성질",
    "[0:23] Xu et al.은 몇 가지 공리로부터 의미 손실이 (상수배를 제외하고) 유일하게 결정됨을 보였다. 강의에서는 실용적 성질 위주로: (1) 미분 가능 → 역전파 가능, (2) 라벨이 필요 없음 → 준지도 학습, (3) 논리적으로 동치인 두 식은 같은 손실(문법이 아니라 의미에 의존 — 그래서 이름이 'semantic'), (4) 출력이 확신을 가지고 제약을 만족하면 0.");
  const props = [
    ["미분 가능", "Pr(α)는 pᵢ의 다항식 → 역전파로 학습 가능", HEX.neural],
    ["라벨 불필요", "α만 있으면 계산 가능 → 라벨 없는 데이터도 학습 신호를 받음", HEX.rule],
    ["의미에만 의존", "논리적으로 동치인 식은 같은 손실 (P→Q 와 ¬P∨Q)", HEX.violet],
    ["만족 & 확신이면 0", "출력이 α를 만족하는 한 세계로 확신하면 Lˢ = 0", HEX.aqua],
  ];
  props.forEach(([t, d, c], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    card(s, M + col * 6.15, 1.55 + row * 2.5, 5.95, 2.25, { title: t, body: d, tag: String(i + 1), tagColor: c });
  });

  s = content("예제 1: exactly-one 제약",
    "[0:25] 원 논문의 가장 단순한 예. 출력이 원-핫에 가까울수록 Pr(α)가 1에 가깝고 손실은 0. 퍼져 있을수록 손실이 크다. 우리 테스트 코드가 이 표의 값을 그대로 재현한다(tests/test_losses.py).");
  await math(s, "\\Pr(\\text{exactly-one}) = \\sum_{i=1}^{n} p_i \\prod_{j \\ne i} (1 - p_j)", M, 1.5, { pt: 24 });
  await math(s, "0.8\\cdot 0.9 \\cdot 0.9 + 0.1 \\cdot 0.2 \\cdot 0.9 + 0.1 \\cdot 0.2 \\cdot 0.9 = 0.684", M, 2.65, { pt: 20, color: HEX.inkSoft });
  table(s, [["출력 𝐩", "해석", "Pr(α)", "Lˢ = −log Pr(α)"],
    ["(0.98, 0.01, 0.01)", "확신 있고 원-핫에 가까움", "0.961", { text: "0.04", fill: HEX.okTint, bold: true }],
    ["(0.8, 0.1, 0.1)", "어느 정도 확신", "0.684", "0.38"],
    ["(0.4, 0.4, 0.2)", "애매하게 퍼짐", "0.456", { text: "0.79", fill: HEX.badTint, bold: true }]],
  M, 3.45, CW, { colW: [3.0, 4.13, 2.0, 3.0], rowH: 0.52, fontSize: 16 });
  text(s, "확률이 한 곳에 모일수록 손실 → 0, 여러 곳에 퍼질수록 손실 ↑ — 라벨 없이도 \"원-핫이어야 한다\"는 신호를 준다.", M, 5.7, CW, 0.7, { fontSize: 16, bold: true, color: HEX.rule });

  s = content("닫힌 형태 유도: exactly-one을 로그 공간에서",
    "[0:28] 대학원생용 유도. 공통 인수 ∏(1−p_j)를 밖으로 빼면 합 안에는 p_i/(1−p_i) = e^{z_i}(오즈)만 남는다. 로그를 취하면 logsumexp와 softplus만으로 표현된다. 두 연산 모두 PyTorch에 수치적으로 안정한 구현이 있어 큰 로짓에서도 overflow가 없다. 계산량은 O(n) — 세계를 나열할 필요가 없다.");
  let y = 1.45;
  const steps = [
    ["\\Pr = \\sum_i p_i \\prod_{j\\ne i}(1-p_j) = \\Big[\\prod_{j}(1-p_j)\\Big] \\sum_i \\frac{p_i}{1-p_i}", "공통 인수 추출"],
    ["\\frac{p_i}{1-p_i} = \\frac{\\sigma(z_i)}{1-\\sigma(z_i)} = e^{z_i}, \\qquad \\log(1-p_j) = -\\mathrm{softplus}(z_j)", "오즈 = 지수 로짓"],
    ["\\log \\Pr(\\text{exactly-one}) = \\operatorname{logsumexp}_i(z_i) - \\sum_j \\mathrm{softplus}(z_j)", "최종 형태 (O(n))"],
  ];
  for (const [eq, lab] of steps) {
    pill(s, lab, M, y + 0.15, 2.6, lab.startsWith("최종") ? HEX.rule : HEX.inkSoft);
    await math(s, eq, M + 2.9, y, { pt: 22, maxW: CW - 2.9, color: lab.startsWith("최종") ? HEX.rule : HEX.ink });
    y += 1.35;
  }
  text(s, "logsumexp, softplus 모두 수치적으로 안정한 구현이 있다 → 로짓이 ±40이어도 overflow 없음", M, 5.75, CW, 0.6, { fontSize: 15, color: HEX.inkSoft });

  s = content("예제 2: 함의 규칙 — 펭귄은 새이고, 날지 못한다",
    "[0:31] 이제 출력 형식이 아니라 '지식'이 들어가는 예. 변수 3개 → 세계 8개, 그중 5개가 만족. 네트워크는 '날아다니는 새'라고 믿으면서 동시에 펭귄이라고도 믿고 있다(0.8). 위반 확률 0.656 중 0.576이 '펭귄인데 난다' 한 세계에 몰려 있다.");
  await math(s, "\\alpha = (P \\rightarrow B) \\land (P \\rightarrow \\lnot F) \\equiv (\\lnot P \\lor B) \\land (\\lnot P \\lor \\lnot F)", M, 1.4, { pt: 22 });
  text(s, "B = 새다,  F = 날 수 있다,  P = 펭귄이다     출력 𝐩 = (p_B, p_F, p_P) = (0.9, 0.8, 0.8)", M, 2.2, CW, 0.4, { fontSize: 15, color: HEX.inkSoft });
  const pw = [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 0], [1, 0, 1], [0, 0, 1], [1, 1, 1], [0, 1, 1]];
  const pB = 0.9, pF = 0.8, pP = 0.8;
  const rows = [["세계 (B, F, P)", "계산", "확률", "α"]];
  for (const [b, f, p] of pw) {
    const ok = !(p && (!b || f));
    const terms = [b ? pB : 1 - pB, f ? pF : 1 - pF, p ? pP : 1 - pP];
    const pr = terms.reduce((a, v) => a * v, 1);
    const why = ok ? "만족" : (!b && f ? "위반: 새 아니고 낢" : !b ? "위반: 새 아님" : "위반: 펭귄인데 낢");
    rows.push([`(${b}, ${f}, ${p})`, terms.map((t) => t.toFixed(1)).join(" × "), { text: pr.toFixed(3), bold: !ok && pr > 0.5 }, { text: why, fill: ok ? HEX.okTint : HEX.badTint }]);
  }
  table(s, rows, M, 2.75, 7.6, { colW: [1.8, 2.2, 1.2, 2.4], rowH: 0.42, fontSize: 13 });
  card(s, 8.6, 2.75, 4.13, 3.75, { title: "결과", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint, body: ["Pr(α) = 0.344", "Lˢ = −log 0.344 ≈ 1.07", "위반 0.656 중 0.576이 (1,1,1)에 집중: 펭귄인데 난다", "인수분해: Pr(α) = (1−p_P) + p_P·p_B·(1−p_F)"] });

  s = content("모든 세계를 더하지 않아도 되는 이유: 세 가지 원리",
    "앞 슬라이드의 인수분해가 어떻게 나오는가. 원리 1: 변수 하나(P)로 경우를 나누면 두 경우는 겹치지 않으므로 확률을 더하면 된다(섀넌 분해). 원리 2: P=0이면 두 규칙이 공허한 참이 되어 B, F에는 제약이 없고, 독립 변수의 모든 값의 합은 1이라 사라진다. 원리 3: P=1이면 B ∧ ¬F만 남고, 서로 다른 변수의 조건이므로 곱으로 쪼개진다. 결과: 세계 5개의 합이 항 2개로. 대학원생용 보충: Pr(α)는 각 p_i에 대해 1차식이라 ∂Pr/∂p_i = Pr(α|X_i=1) − Pr(α|X_i=0) — 다음 슬라이드의 기울기가 바로 이 값이다(p_P: 0.18 − 1 = −0.82). 이 세 원리를 회로로 자동화한 것이 지식 컴파일(SDD, d-DNNF)이고, 이 강의의 exactly-one·계층 제약 닫힌 형태도 같은 원리로 손으로 유도한 것이다.");
  await math(s, "\\Pr(\\alpha) = \\underbrace{(1 - p_P)}_{P=0} \\cdot \\underbrace{1}_{(2)} \\quad + \\quad \\underbrace{p_P}_{P=1} \\cdot \\underbrace{p_B \\,(1 - p_F)}_{(3)} \\quad = \\quad 0.2 + 0.144 = 0.344", M + CW / 2, 1.45, { pt: 22, align: "center", maxW: CW });
  const principles = [["경우 나누기 (섀넌 분해)", "P=0과 P=1은 겹치지 않는다 → 각 경우의 확률을 더한다", HEX.violet],
    ["자유 변수는 사라진다", "P=0이면 규칙이 자동으로 참 → B, F는 아무 값이나 → 합이 1", HEX.neural],
    ["독립이면 곱한다", "P=1이면 B ∧ ¬F만 남음 → Pr(B)·Pr(¬F) = p_B(1−p_F)", HEX.rule]];
  principles.forEach(([t, d, c], i) => {
    card(s, M + i * 4.1, 2.95, 3.85, 2.35, { title: t, body: d, tag: String(i + 1), tagColor: c, bodySize: 14 });
  });
  text(s, [{ text: "같은 원리로: ", options: { bold: true } }, { text: "exactly-one은 \"어느 변수가 참인가\"로 n가지 경우(원리 1) × 독립 곱(원리 3), 계층 제약은 \"어느 세부 클래스가 참인가\"로 100가지 경우 → 닫힌 형태. 지식 컴파일(SDD)은 이 원리를 회로로 자동화한 것." }],
    M, 5.55, CW, 0.9, { fontSize: 15, color: HEX.inkSoft });

  s = content("기울기는 깨진 규칙을 골라 교정한다",
    "[0:35] 인수분해식을 미분하면 각 확률을 어느 방향으로 밀어야 하는지 보인다. ∂Pr/∂p_F = −p_P p_B : '펭귄이고 새라고 믿을수록 난다는 믿음을 강하게 내려라' — 전건 긍정(modus ponens)의 미분 가능한 형태. 이미 거의 만족된 P→B 쪽(p_B)은 기울기가 작다. 손실 L=−log Pr의 기울기는 1/Pr ≈ 2.9배이며 부호는 반대(경사하강은 −∇L 방향 = ∇Pr 방향).");
  await math(s, "\\Pr(\\alpha) = (1 - p_P) + p_P\\, p_B\\, (1 - p_F)", M, 1.45, { pt: 24 });
  const grads = [["\\frac{\\partial \\Pr}{\\partial p_B} = p_P(1-p_F) = +0.16", "p_B 약하게 ↑", HEX.neural], ["\\frac{\\partial \\Pr}{\\partial p_F} = -p_P\\, p_B = -0.72", "p_F 크게 ↓", HEX.rule], ["\\frac{\\partial \\Pr}{\\partial p_P} = -1 + p_B(1-p_F) = -0.82", "p_P 크게 ↓", HEX.rule]];
  for (let i = 0; i < grads.length; i++) {
    const x = M + i * 4.1;
    card(s, x, 2.4, 3.9, 2.1, { fill: i === 0 ? HEX.neuralTint : HEX.ruleTint });
    await math(s, grads[i][0], x + 0.25, 2.6, { pt: 17, maxW: 3.4 });
    s.addText(grads[i][1], { x: x + 0.25, y: 3.75, w: 3.4, h: 0.5, fontSize: 18, bold: true, color: grads[i][2], margin: 0, isTextBox: true });
  }
  bullets(s, ["∂Pr/∂p_F = −p_P·p_B : \"펭귄이고 새라고 믿을수록 난다는 믿음을 강하게 내려라\" — 전건 긍정(modus ponens)의 미분 가능한 형태",
    "이미 거의 만족된 P → B (p_B = 0.9)는 기울기가 작고, 실제로 깨진 P → ¬F 쪽에 기울기가 집중된다",
    { text: "손실 기준으로는 ∂L/∂p = −(∂Pr/∂p)/Pr = (−0.47, +2.09, +2.38): 크기는 1/Pr ≈ 2.9배, 경사하강 방향은 동일", sub: true }], M, 4.8, CW, 1.9, { fontSize: 15 });

  s = content("의미 손실만으로 경사하강하면: 두 갈래 해소",
    "[0:38] demo_paper_examples.py로 만든 실제 궤적(로짓에 SGD, lr=0.5). p_F와 p_P가 모두 내려간다 — 모순을 푸는 길이 두 갈래이고, 의미 손실은 어느 쪽인지 지시하지 않는다. 실제 학습에서는 교차 엔트로피(데이터)가 균형을 결정한다: 진짜 펭귄 이미지면 p_P가 유지되고 p_F가 내려가며, 아니면 p_P가 내려간다.");
  const traj = JSON.parse(fs.readFileSync(path.join(ASSETS, "penguin_traj.json"), "utf8"));
  const labels = traj.map((t) => String(t[0]));
  s.addChart(pres.charts.LINE, [
    { name: "p_B (새)", labels, values: traj.map((t) => t[1]) },
    { name: "p_F (난다)", labels, values: traj.map((t) => t[2]) },
    { name: "p_P (펭귄)", labels, values: traj.map((t) => t[3]) },
  ], chartBase({ x: M, y: 1.45, w: 7.6, h: 5.05, chartColors: [HEX.neural, HEX.rule, HEX.aqua], lineSize: 2, lineDataSymbol: "none",
    valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: "0.0", showTitle: true, title: "확률 vs 경사하강 스텝", titleFontSize: 13, titleColor: HEX.inkSoft,
    catAxisTitle: "스텝", showCatAxisTitle: true, catAxisTitleFontSize: 11, catAxisTitleColor: HEX.inkSoft, catAxisLabelFrequency: 5 }));
  card(s, 8.6, 1.45, 4.13, 5.05, { title: "관찰", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint,
    body: [`Lˢ : ${traj[0][4].toFixed(2)} → ${traj[traj.length - 1][4].toFixed(2)} (30 스텝)`, `p_F : 0.80 → ${traj[traj.length - 1][2].toFixed(2)}`, `p_P : 0.80 → ${traj[traj.length - 1][3].toFixed(2)}`, `p_B : 0.90 → ${traj[traj.length - 1][1].toFixed(2)}`, "모순 해소의 방향은 데이터(CE)와의 균형이 결정"] });

  s = content("교차 엔트로피와 의미 손실의 역할 분담",
    "[0:41] 실제 학습에서는 두 손실을 더한다. CE는 정답을 알려주고 의미 손실은 정합성을 강제한다. 라벨이 없는 데이터에는 CE 항이 없으므로 의미 손실만 작동한다 — 이것이 준지도 학습에서 의미 손실이 가치 있는 이유. λ는 둘의 균형을 정하는 하이퍼파라미터로, 이후 실험에서 매우 중요함을 보게 된다.");
  await math(s, "\\mathcal{L} \\;=\\; \\underbrace{\\mathcal{L}_{\\mathrm{CE}}(\\mathbf{z}, y)}_{\\text{labeled only}} \\;+\\; \\lambda \\cdot \\underbrace{L^{s}(\\alpha, \\sigma(\\mathbf{z}))}_{\\text{every example}}", M + CW / 2, 1.5, { pt: 28, align: "center" });
  card(s, M, 3.35, 3.85, 2.4, { title: "CE: 무엇이 정답인가", tag: "N", tagColor: HEX.neural, fill: HEX.neuralTint, body: ["라벨 있는 데이터에만", "정답 방향을 지시"] });
  card(s, M + 4.1, 3.35, 3.85, 2.4, { title: "Lˢ: 무엇이 가능한가", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint, body: ["모든 데이터에", "정답을 모른 채 정합성만 강제"] });
  card(s, M + 8.2, 3.35, 3.93, 2.4, { title: "λ: 균형", tag: "λ", tagColor: HEX.violet, body: ["너무 작으면 효과 없음", "너무 크면 \"아무 원-핫이나 확신\"하는 쪽으로 붕괴 (실험에서 확인)"] });

  s = content("계산 복잡도: 언제 쉽고 언제 어려운가",
    "[0:43] 일반 CNF에 대한 WMC는 #P-hard. 변수가 많으면 2^n 세계를 나열할 수 없다. 원 논문은 제약을 SDD(Sentential Decision Diagram)로 '지식 컴파일'해서 회로 크기에 선형인 시간에 계산했다. 우리 실험의 계층 제약은 구조가 단순해서 손으로 닫힌 형태를 유도할 수 있다 — 5부에서 다룬다.");
  const cx = [["전수 나열", "2ⁿ개 세계를 모두 검사", "n ≤ 20 정도까지 (테스트용 기준 구현)", HEX.inkSoft],
    ["지식 컴파일", "α를 SDD / d-DNNF 회로로 한 번 컴파일", "회로 크기에 선형 — 원 논문의 일반 해법", HEX.violet],
    ["닫힌 형태", "제약의 구조를 이용해 직접 유도", "exactly-one, 계층 제약: O(n) — 이번 실험", HEX.rule]];
  cx.forEach(([t, a, b, c], i) => {
    card(s, M + i * 4.1, 1.55, 3.85, 2.75, { title: t, body: [a, b], tag: String(i + 1), tagColor: c, fill: i === 2 ? HEX.ruleTint : HEX.panel });
  });
  text(s, [{ text: "일반 CNF의 가중 모델 카운팅(WMC)은 #P-hard", options: { bold: true, breakLine: true } },
    { text: "→ 실제 적용에서는 \"제약을 효율적으로 계산 가능한 형태로 바꾸는 것\"이 핵심 엔지니어링 과제", options: { color: HEX.inkSoft } }], M, 4.75, CW, 1.2, { fontSize: 17 });

  // ---------------- 4. Purpose & data ----------------
  divider("04", "실험 목적과 데이터", "규칙은 언제, 얼마나, 왜 도움이 되는가", "[0:45] 4부: 이론을 실제 이미지 분류 문제로 가져간다.");

  s = content("실험 목적: 네 가지 연구 질문",
    "[0:46] 설계의 출발점. RQ1~3은 라벨 양에 따른 효과, RQ4는 효과의 원인 분리(대조 실험). '성능이 오른다'보다 '언제, 왜 오르는가'를 묻는 것이 좋은 실험 설계.");
  const rq = [["RQ1", "라벨이 충분할 때도 규칙이 도움이 되는가?", "full 설정"],
    ["RQ2", "라벨이 부족할 때, 라벨 없는 데이터에 규칙만으로 학습 신호를 줄 수 있는가?", "semi 설정"],
    ["RQ3", "상위 클래스 라벨만 있을 때, 함의 규칙이 그 정보를 하위 클래스 예측으로 전파하는가?", "weak 설정"],
    ["RQ4", "효과는 함의 규칙 때문인가, 아니면 단순히 출력을 확신하게 만드는 효과 때문인가?", "exactly-one 대조 실험"]];
  rq.forEach(([k, q, t], i) => {
    const y0 = 1.5 + i * 1.25;
    pill(s, k, M, y0 + 0.3, 1.0, i === 3 ? HEX.violet : HEX.rule);
    text(s, q, M + 1.3, y0 + 0.2, 8.4, 0.9, { fontSize: 17, valign: "middle" });
    s.addText(t, { x: 10.2, y: y0 + 0.3, w: 2.53, h: 0.4, fontSize: 13, color: HEX.inkSoft, align: "right", valign: "middle", margin: 0, isTextBox: true });
  });

  s = content("데이터셋: CIFAR-100",
    "[0:48] CIFAR-100은 32×32 컬러 이미지 6만 장. 100개 세부 클래스(fine)가 20개 상위 클래스(coarse)에 각각 정확히 5개씩 속한다. 이 계층이 우리 규칙 베이스가 된다. 데이터셋이 계층 라벨을 함께 제공하므로 규칙을 직접 작성할 필요 없이 데이터에서 추출했다(코드에서 일관성 검증).");
  s.addImage({ path: path.join(ASSETS, "img/mosaic.png"), altText: path.basename(path.join(ASSETS, "img/mosaic.png")), x: M, y: 1.5, w: 7.4, h: 2.47, objectName: "mosaic" });
  text(s, "학습 이미지 무작위 48장 (32×32를 확대)", M, 4.05, 7.4, 0.3, { fontSize: 11, color: HEX.muted });
  const stats = [["60,000", "이미지 (학습 50k / 테스트 10k)"], ["100", "세부 클래스 (fine), 클래스당 600장"], ["20", "상위 클래스 (coarse), 각 5개 fine"], ["32×32", "RGB 해상도"]];
  stats.forEach(([n, l], i) => {
    const y0 = 1.5 + i * 1.25;
    s.addText(n, { x: 8.4, y: y0, w: 4.3, h: 0.65, fontSize: 32, bold: true, color: i === 2 ? HEX.rule : HEX.neural, margin: 0, isTextBox: true });
    s.addText(l, { x: 8.4, y: y0 + 0.62, w: 4.3, h: 0.4, fontSize: 14, color: HEX.inkSoft, margin: 0, isTextBox: true });
  });
  text(s, "출처: Krizhevsky (2009), Learning Multiple Layers of Features from Tiny Images. 공식 배포본(python pickle)을 MD5 검증 후 사용.", M, 4.6, 7.4, 0.9, { fontSize: 13, color: HEX.inkSoft });
  text(s, "학습 50k 중 5,000장(클래스당 50장)은 λ 선택용 검증셋으로 분리 → 학습 45,000장", M, 5.55, 7.4, 0.9, { fontSize: 14, bold: true });

  s = content("계층 구조: 상위 클래스 → 세부 클래스",
    "[0:50] 상위 클래스 6개의 실제 예시. 같은 상위 클래스 안의 세부 클래스는 시각적으로 비슷한 경우가 많다(나무들, 대형 육식동물들). 그래서 '상위 클래스는 맞혔지만 세부 클래스는 틀린' 오류가 흔하다 — 결과 해석에서 다시 나온다.");
  const groups = [["trees", "나무"], ["large_carnivores", "대형 육식동물"], ["vehicles_1", "탈것 1"], ["flowers", "꽃"], ["fish", "어류"], ["people", "사람"]];
  const hier = JSON.parse(fs.readFileSync(path.join(ASSETS, "hierarchy.json"), "utf8"));
  groups.forEach(([g, ko], gi) => {
    const col = gi % 2, row = Math.floor(gi / 2);
    const x0 = M + col * 6.15, y0 = 1.45 + row * 1.78;
    s.addText([{ text: ko, options: { bold: true, color: HEX.rule, breakLine: true } }, { text: g, options: { color: HEX.muted, fontSize: 11 } }], { x: x0, y: y0, w: 1.45, h: 1.1, fontSize: 15, valign: "middle", margin: 0, isTextBox: true });
    hier[g].forEach((f, fi) => {
      const xi = x0 + 1.5 + fi * 0.86;
      s.addImage({ path: path.join(ASSETS, `img/${f}.png`), altText: path.basename(path.join(ASSETS, `img/${f}.png`)), x: xi, y: y0, w: 0.8, h: 0.8, objectName: `img-${f}` });
      s.addText(f.replace("_tree", "").replace("_", " "), { x: xi - 0.05, y: y0 + 0.84, w: 0.9, h: 0.3, fontSize: 10, color: HEX.inkSoft, align: "center", margin: 0, isTextBox: true });
    });
  });

  s = content("20개 상위 클래스 전체",
    "[0:52] 전체 목록. 각 상위 클래스에는 정확히 5개의 세부 클래스가 있다. 이 100개의 (세부 → 상위) 대응이 곧 100개의 함의 규칙이다.");
  const ko = { aquatic_mammals: "수생 포유류", fish: "어류", flowers: "꽃", food_containers: "식품 용기", fruit_and_vegetables: "과일·채소", household_electrical_devices: "가전제품", household_furniture: "가구", insects: "곤충", large_carnivores: "대형 육식동물", "large_man-made_outdoor_things": "대형 인공 구조물", large_natural_outdoor_scenes: "대형 자연 경관", large_omnivores_and_herbivores: "대형 잡식·초식동물", medium_mammals: "중형 포유류", "non-insect_invertebrates": "곤충 외 무척추동물", people: "사람", reptiles: "파충류", small_mammals: "소형 포유류", trees: "나무", vehicles_1: "탈것 1", vehicles_2: "탈것 2" };
  Object.keys(hier).forEach((g, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x0 = M + col * 3.08, y0 = 1.45 + row * 1.06;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x0, y: y0, w: 2.93, h: 0.94, fill: { color: HEX.panel }, line: { color: HEX.panel }, rectRadius: 0.08, objectName: "chip" });
    s.addText([{ text: ko[g] || g, options: { bold: true, fontSize: 13, color: HEX.ink, breakLine: true } }, { text: hier[g].join(", ").replace(/_/g, " "), options: { fontSize: 10, color: HEX.inkSoft } }], { x: x0 + 0.12, y: y0 + 0.06, w: 2.7, h: 0.82, valign: "top", margin: 0, isTextBox: true });
  });

  // ---------------- 5. Design & implementation ----------------
  divider("05", "실험 설계와 구현", "규칙 → 손실 → 모형 → 코드", "[0:53] 5부: 이론을 120개 출력의 신경망으로 옮긴다.");

  s = content("명제 규칙: 120개 변수, 5,242개 절",
    "[0:54] 출력 120개를 명제 변수로 본다. 규칙은 세 부분. 절의 개수: EO(f)는 '최소 하나' 1개 + 쌍마다 1개 C(100,2)=4950개, EO(c)는 1+190, 함의 100개 → 총 5,242개. 세계는 2^120 ≈ 1.3×10^36개지만 만족하는 세계는 정확히 100개: 세부 클래스를 고르면 상위 클래스가 결정되기 때문.");
  await math(s, "\\alpha \\;=\\; \\underbrace{\\mathrm{EO}(f_1,\\dots,f_{100})}_{4{,}951\\ \\text{clauses}} \\;\\land\\; \\underbrace{\\mathrm{EO}(c_1,\\dots,c_{20})}_{191\\ \\text{clauses}} \\;\\land\\; \\underbrace{\\bigwedge_{i=1}^{100} \\big(f_i \\rightarrow c_{\\mathrm{par}(i)}\\big)}_{100\\ \\text{implications}}", M + CW / 2, 1.45, { pt: 24, align: "center", maxW: CW });
  const big = [["2¹²⁰ ≈ 1.3 × 10³⁶", "가능한 세계 수", HEX.inkSoft], ["100", "α를 만족하는 세계 수", HEX.rule], ["5,242", "CNF 절의 수", HEX.violet]];
  big.forEach(([n, l, c], i) => {
    s.addText(n, { x: M + i * 4.1, y: 3.4, w: 3.9, h: 0.8, fontSize: 30, bold: true, color: c, margin: 0, isTextBox: true });
    s.addText(l, { x: M + i * 4.1, y: 4.2, w: 3.9, h: 0.4, fontSize: 14, color: HEX.inkSoft, margin: 0, isTextBox: true });
  });
  card(s, M, 4.9, CW, 1.55, { title: "예: maple_tree → trees,   lion → large_carnivores,   bus → vehicles_1", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint, titleSize: 16,
    body: "par(i) : 세부 클래스 i의 상위 클래스. CIFAR-100 메타데이터에서 추출하고, 학습·테스트 전체에서 함수(일대일 대응이 아닌 다대일)임을 검증", bodySize: 14 });

  s = content("닫힌 형태: 계층 제약의 만족 확률",
    "[0:57] 세 원리 적용: 원리 1 — '어느 세부 클래스가 참인가'로 100가지 겹치지 않는 경우로 나눈다. 경우 i에서는 함의 때문에 c_par(i)=1, EO(c) 때문에 나머지 coarse=0, 나머지 99개 함의는 f_j=0이라 공허한 참(펭귄 예시에서 '규칙이 사라지는' 것과 같은 현상; 자유 변수가 없어 원리 2 대신 이 형태로 나타남). 원리 3 — 각 경우는 세계 하나이므로 독립 곱. 만족하는 세계는 'f_i 하나와 그 부모 c_par(i) 하나만 1'인 100개. 각 세계의 확률을 쓰고 exactly-one과 같은 방법으로 공통 인수를 빼면, 합 안에는 e^{f_i + c_par(i)}만 남는다. 결과: logsumexp 한 번 + softplus 합 두 번. 부수 효과: 가장 확률 높은 만족 세계(MAP)는 argmax_i (f_i + c_par(i)) — 추론에도 쓸 수 있다.");
  y = 1.4;
  const hsteps = [
    ["\\Pr(\\alpha) = \\sum_{i=1}^{100} p_{f_i}\\, p_{c_{\\mathrm{par}(i)}} \\prod_{j \\ne i} (1 - p_{f_j}) \\prod_{k \\ne \\mathrm{par}(i)} (1 - p_{c_k})", "원리 1 + 원리 3", HEX.violet],
    ["= \\Big[\\prod_j (1-p_{f_j}) \\prod_k (1-p_{c_k})\\Big] \\sum_i e^{\\,f_i + c_{\\mathrm{par}(i)}}", "공통 인수 + 오즈", HEX.inkSoft],
    ["\\log \\Pr(\\alpha) = \\operatorname{logsumexp}_i\\big(f_i + c_{\\mathrm{par}(i)}\\big) - \\sum_j \\mathrm{softplus}(f_j) - \\sum_k \\mathrm{softplus}(c_k)", "최종 형태", HEX.rule],
    ["\\hat{\\mathbf{x}}_{\\mathrm{MAP}} :\\; \\hat{\\imath} = \\arg\\max_i \\big(f_i + c_{\\mathrm{par}(i)}\\big)", "부산물: MAP 세계", HEX.violet],
  ];
  for (const [eq, lab, c] of hsteps) {
    pill(s, lab, M, y + 0.12, 2.7, c);
    await math(s, eq, M + 3.0, y, { pt: 19, maxW: CW - 3.0, color: c === HEX.rule ? HEX.rule : HEX.ink });
    y += 1.3;
  }

  s = content("신경망 모형: ResNet-9 + 120차원 출력",
    "[1:00] 백본은 DAWNBench에서 유명한 ResNet-9(약 650만 파라미터). CIFAR-100을 30에폭에 70%대 정확도로 학습할 수 있어 여러 번 반복 실험하기 좋다. 중요한 것은 출력층: 하나의 선형층이 120개 로짓을 내고, 앞 100개는 세부, 뒤 20개는 상위 클래스. 같은 로짓을 CE에는 소프트맥스로, 의미 손실에는 시그모이드로 해석한다(원 논문 구현과 동일).");
  const blocks = [["입력\n3×32×32", HEX.panel], ["Conv 64", HEX.neuralTint], ["Conv 128\n+ Pool", HEX.neuralTint], ["Res 128", HEX.neuralTint], ["Conv 256\n+ Pool", HEX.neuralTint], ["Conv 512\n+ Pool", HEX.neuralTint], ["Res 512", HEX.neuralTint], ["Global\nMaxPool", HEX.neuralTint], ["Linear\n512→120", HEX.ruleTint]];
  const bw = 1.18, gap = 0.17;
  blocks.forEach(([t, f], i) => {
    const x = M + i * (bw + gap);
    box(s, t, x, 1.6, bw, 1.05, { fill: f, size: 12, bold: i === 8 });
    if (i < blocks.length - 1) arrow(s, x + bw + 0.01, 2.125, x + bw + gap - 0.01, 2.125);
  });
  text(s, "Conv = 3×3 합성곱 + BatchNorm + ReLU,   Res = 잔차 블록(Conv 두 개 + 스킵 연결)", M, 2.8, CW, 0.4, { fontSize: 12, color: HEX.muted });
  box(s, "f : 로짓 100개 (세부 클래스)", M + 1.3, 3.55, 4.4, 0.75, { fill: HEX.neuralTint, size: 15, bold: true });
  box(s, "c : 로짓 20개 (상위 클래스)", M + 6.6, 3.55, 4.4, 0.75, { fill: HEX.neuralTint, size: 15, bold: true });
  box(s, "softmax → CE(fine)", M, 4.85, 3.6, 0.7, { fill: HEX.panel, size: 14 });
  box(s, "sigmoid(f, c) → 의미 손실 Lˢ", M + 4.25, 4.85, 3.6, 0.7, { fill: HEX.ruleTint, size: 14, bold: true });
  box(s, "softmax → CE(coarse)", M + 8.5, 4.85, 3.6, 0.7, { fill: HEX.panel, size: 14 });
  arrow(s, M + 2.5, 4.32, M + 1.8, 4.83); arrow(s, M + 4.2, 4.32, M + 5.4, 4.83); arrow(s, M + 7.9, 4.32, M + 6.7, 4.83); arrow(s, M + 9.6, 4.32, M + 10.3, 4.83);
  text(s, "같은 120개 로짓을 두 가지로 해석: CE에는 소프트맥스(범주형 분포), 의미 손실에는 시그모이드(독립 명제 변수)", M, 5.85, CW, 0.7, { fontSize: 15, bold: true, color: HEX.rule });

  s = content("손실 함수 설계",
    "[1:02] 실제 손실. 마스크 m은 '이 이미지에 해당 라벨이 있는가'. CE는 라벨 있는 샘플만 평균, 의미 손실은 배치의 모든 샘플에 적용. λ_t는 처음 5에폭 동안 0에서 λ로 선형 증가(웜업) — 초기에는 모든 시그모이드가 0.5 근처라 Lˢ ≈ 80으로 매우 커서, 바로 큰 가중치를 주면 CE 학습을 방해하기 때문.");
  await math(s, "\\mathcal{L} = \\frac{\\sum_b m^{f}_b\\, \\mathrm{CE}(f_b, y^{f}_b)}{\\sum_b m^{f}_b} + \\frac{\\sum_b m^{c}_b\\, \\mathrm{CE}(c_b, y^{c}_b)}{\\sum_b m^{c}_b} + \\lambda_t \\cdot \\frac{1}{B}\\sum_{b=1}^{B} L^{s}(\\alpha, \\sigma(f_b, c_b))", M + CW / 2, 1.45, { pt: 21, align: "center", maxW: CW });
  await math(s, "\\lambda_t = \\lambda \\cdot \\min\\!\\Big(1, \\frac{t}{5 \\cdot \\text{steps per epoch}}\\Big)", M + CW / 2, 2.85, { pt: 20, align: "center", color: HEX.violet });
  card(s, M, 3.85, 3.85, 2.6, { title: "마스크 m", tag: "1", tagColor: HEX.neural, body: ["mᶠ = 1 : fine 라벨 있음", "mᶜ = 1 : coarse 라벨 있음", "설정(full/semi/weak)이 결정"], bodySize: 14 });
  card(s, M + 4.1, 3.85, 3.85, 2.6, { title: "의미 손실 항", tag: "2", tagColor: HEX.rule, fill: HEX.ruleTint, body: ["배치의 모든 이미지에 적용", "라벨 없는 이미지도 신호를 받음"], bodySize: 14 });
  card(s, M + 8.2, 3.85, 3.93, 2.6, { title: "λ 웜업", tag: "3", tagColor: HEX.violet, body: ["초기 Lˢ ≈ 80 (모든 p ≈ 0.5)", "처음 5에폭 동안 선형 증가", "CE 학습 초기를 방해하지 않도록"], bodySize: 14 });

  s = content("세 가지 학습 설정: 라벨의 양을 바꾼다",
    "[1:05] 학습 45,000장에 대해 라벨 가용성만 바꾼다. full: 모두 라벨. semi: 10%(클래스당 45장, 총 4,500장)만 라벨, 나머지 90%는 라벨 없음. weak: fine 라벨은 10%뿐이지만 coarse 라벨은 전부 있음 — 실제로 '대략적 분류는 싸고 세부 분류는 비싼' 상황을 모사. 모든 방법이 같은 스텝 수(에폭당 45,000장 전체를 순회)로 학습한다.");
  const sets = [["full", "fine 100%", "coarse 100%", "RQ1", 1.0, 1.0], ["semi", "fine 10%", "coarse 10% (같은 이미지)", "RQ2", 0.1, 0.1], ["weak", "fine 10%", "coarse 100%", "RQ3", 0.1, 1.0]];
  sets.forEach(([n, a, b, q, fa, fc], i) => {
    const y0 = 1.5 + i * 1.6;
    pill(s, n, M, y0 + 0.3, 1.2, i === 2 ? HEX.rule : HEX.inkSoft);
    s.addText(q, { x: M, y: y0 + 0.78, w: 1.2, h: 0.3, fontSize: 11, color: HEX.muted, align: "center", margin: 0, isTextBox: true });
    const bx = M + 1.5, bwid = 8.0;
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: y0 + 0.15, w: bwid, h: 0.42, fill: { color: "E9EDF2" }, line: { color: "E9EDF2" }, objectName: "bar-bg" });
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: y0 + 0.15, w: bwid * fa, h: 0.42, fill: { color: HEX.neural }, line: { color: HEX.neural }, objectName: "bar-fine" });
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: y0 + 0.65, w: bwid, h: 0.42, fill: { color: "E9EDF2" }, line: { color: "E9EDF2" }, objectName: "bar-bg" });
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: y0 + 0.65, w: bwid * fc, h: 0.42, fill: { color: HEX.violet }, line: { color: HEX.violet }, objectName: "bar-coarse" });
    s.addText(a, { x: bx + bwid + 0.2, y: y0 + 0.15, w: 2.6, h: 0.42, fontSize: 13, color: HEX.ink, valign: "middle", margin: 0, isTextBox: true });
    s.addText(b, { x: bx + bwid + 0.2, y: y0 + 0.65, w: 2.6, h: 0.42, fontSize: 13, color: HEX.ink, valign: "middle", margin: 0, isTextBox: true });
  });
  text(s, "막대 = 학습 이미지 45,000장 중 라벨이 있는 비율 (파랑: fine, 보라: coarse). 라벨 없는 이미지에는 의미 손실만 적용된다.", M, 6.25, CW, 0.5, { fontSize: 13, color: HEX.inkSoft });

  s = content("비교 방법: 한 번에 하나씩만 바꾼다",
    "[1:08] 대조군 설계가 실험의 핵심. ce_fine → ce_both는 coarse 라벨의 효과, ce_both → ce_both_eo는 '출력을 원-핫으로 확신하게 하는' 일반 효과, ce_both_eo → ce_both_sl은 함의 규칙 100개의 순수 효과다. 이렇게 하나씩 쌓아야 '무엇 덕분에 좋아졌는가'에 답할 수 있다.");
  const ms4 = [["ce_fine", "CE(fine)", "기준선", HEX.neural],
    ["ce_both", "+ CE(coarse)", "coarse 라벨의 효과", HEX.violet],
    ["ce_both_eo", "+ λ·Lˢ(EO(f) ∧ EO(c))", "확신(원-핫) 효과 — 대조군", HEX.aqua],
    ["ce_both_sl", "+ λ·Lˢ(α) — 함의 규칙 포함", "규칙의 순수 효과", HEX.rule]];
  ms4.forEach(([k, l, d, c], i) => {
    const y0 = 1.5 + i * 1.2;
    const x0 = M + i * 0.5;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x0, y: y0, w: 7.6, h: 0.95, fill: { color: HEX.panel }, line: { color: HEX.panel }, rectRadius: 0.1, objectName: "step" });
    s.addShape(pres.shapes.OVAL, { x: x0 + 0.2, y: y0 + 0.27, w: 0.4, h: 0.4, fill: { color: c }, line: { color: c }, objectName: "dot" });
    s.addText([{ text: k, options: { fontFace: CODE_FONT, bold: true, color: HEX.ink, breakLine: true } }, { text: l, options: { fontSize: 13, color: HEX.inkSoft } }], { x: x0 + 0.8, y: y0 + 0.08, w: 6.6, h: 0.8, fontSize: 16, valign: "middle", margin: 0, isTextBox: true });
    s.addText(d, { x: x0 + 7.8, y: y0 + 0.2, w: 4.0, h: 0.55, fontSize: 15, bold: i > 1, color: i === 3 ? HEX.rule : HEX.ink, valign: "middle", margin: 0, isTextBox: true });
  });
  text(s, "인접한 두 방법의 차이 = 새로 추가한 한 요소의 효과", M, 6.35, CW, 0.4, { fontSize: 15, bold: true, color: HEX.inkSoft });

  s = content("평가 지표: 정확도 외에 무엇을 볼 것인가",
    "[1:10] 정확도 외에 '규칙을 얼마나 지키는가'(일관성), '틀려도 덜 심하게 틀리는가'(같은 상위 클래스 내 오류 비율)를 본다. 추론 시 규칙을 쓰는 두 방법(마스킹, MAP)도 함께 측정해서 '학습 시 규칙 주입'과 비교한다.");
  table(s, [["지표", "정의", "의미"],
    ["fine / coarse 정확도", "argmax f = y_f,  argmax c = y_c", "기본 성능"],
    ["일관성 (consistency)", "par(argmax f) = argmax c", "규칙 준수율"],
    ["fine 정확도 (MAP)", "argmax_i (f_i + c_par(i))", "추론 시 규칙 적용 ①"],
    ["fine 정확도 (masked)", "예측 coarse의 자식 5개 중 argmax f", "추론 시 규칙 적용 ②"],
    ["coarse via fine", "par(argmax f) = y_c", "fine 예측의 상위 정확도"],
    ["같은 상위 내 오류 비율", "fine 오답 중 par(예측) = y_c 인 비율", "오류의 심각도 (높을수록 온건)"],
    ["평균 log Pr(α)", "테스트 이미지 평균", "확률적 규칙 준수"]],
  M, 1.5, CW, { colW: [3.2, 5.0, 3.93], rowH: 0.56, fontSize: 14 });

  s = content("학습 세부사항과 실험 프로토콜",
    "[1:12] 재현을 위한 세부. λ는 검증셋에서만 고르고 테스트셋은 최종 평가에만 썼다(데이터 누수 방지). 의미 손실의 λ 그리드는 처음 {0.005~0.5}였는데 최적값이 끝에 걸려 {1, 2, 5}로 확장했다 — 그리드 끝값이 선택되면 범위를 넓혀야 한다는 실전 교훈. 총 학습 횟수: 튜닝 30회 + 본 실험 36회.");
  card(s, M, 1.5, 5.9, 4.95, { title: "학습 설정", tag: "N", tagColor: HEX.neural, body: ["SGD (Nesterov, momentum 0.9), weight decay 5e-4", "학습률: one-cycle, 최대 0.1 · 배치 256 · 30 에폭", "증강: 랜덤 크롭(4px pad) + 좌우 반전 (GPU)", "혼합 정밀도: bfloat16 autocast (손실은 float32)", "하드웨어: Apple M4 Max (MPS), 1회 학습 약 5.5분"], bodySize: 14 });
  card(s, M + 6.2, 1.5, 5.9, 4.95, { title: "프로토콜", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint, body: ["검증셋 5,000장(클래스당 50)은 시드와 무관하게 고정", "λ 선택: 시드 0, 검증셋 fine 정확도 기준", "의미 손실 λ ∈ {0.005, 0.02, 0.1, 0.5, 1, 2, 5}", "exactly-one 대조군 λ ∈ {0.5, 1, 2}", "본 실험: 3 설정 × 4 방법 × 3 시드 → 테스트셋 평가", "보고: 3 시드 평균 ± 표준편차"], bodySize: 14 });

  // ---- repeated runs: seeds and mean ± std ----
  s = content("반복 실험: 시드와 \"평균 ± 표준편차\"의 의미",
    "결과 표의 '73.7 ± 0.3'을 읽는 법. 같은 설정을 시드(난수 초기값)만 바꿔 3번 학습했고, 표의 값은 3번의 평균 ± 표본 표준편차다. 시드가 바꾸는 것은 세 가지: 가중치 초기화, 미니배치 순서와 증강, 그리고 semi·weak 설정에서는 '어느 4,500장에 라벨이 있는가'. 검증셋과 테스트셋은 모든 시드에서 같다. 라벨 부분집합이 바뀌는 semi·weak의 편차(±1~2)가 full(±0.2~0.3)보다 큰 이유가 세 번째 요인이다. 표준편차는 n−1로 나누는 표본 표준편차.");
  const exRun = R.agg.full.ce_fine;
  const seedsV = exRun ? exRun.fine_acc.all.map((v) => +(100 * v).toFixed(2)) : [73.98, 73.77, 73.47];
  const mean3 = seedsV.reduce((a, b) => a + b, 0) / seedsV.length;
  const sd3 = Math.sqrt(seedsV.reduce((a, v) => a + (v - mean3) ** 2, 0) / (seedsV.length - 1));
  card(s, M, 1.5, 5.9, 2.75, { title: "시드가 바꾸는 것", tag: "N", tagColor: HEX.neural, fill: HEX.neuralTint,
    body: ["가중치 초기화", "미니배치 순서, 랜덤 크롭·좌우 반전", "semi·weak: 라벨을 줄 10%(4,500장)의 선택"], bodySize: 15 });
  card(s, M, 4.45, 5.9, 2.0, { title: "시드와 무관하게 고정", tag: "=", tagColor: HEX.inkSoft,
    body: ["검증셋 5,000장, 테스트셋 10,000장, 모델 구조, 하이퍼파라미터"], bodySize: 15 });
  table(s, [["full · fine CE", "시드 0", "시드 1", "시드 2"], ["테스트 fine 정확도 (%)", ...seedsV.map((v) => v.toFixed(2))]], M + 6.2, 1.5, 5.93, { colW: [2.53, 1.13, 1.13, 1.14], rowH: 0.5, fontSize: 14 });
  await math(s, "\\bar{x} = \\frac{1}{n}\\sum_{k=1}^{n} x_k, \\qquad s = \\sqrt{\\frac{1}{n-1}\\sum_{k=1}^{n} (x_k - \\bar{x})^2}", M + 6.2, 2.75, { pt: 18, maxW: 5.9 });
  await math(s, `\\bar{x} = ${mean3.toFixed(2)},\\quad s = ${sd3.toFixed(2)} \\quad\\Rightarrow\\quad ${mean3.toFixed(1)} \\pm ${sd3.toFixed(1)}`, M + 6.2, 3.85, { pt: 18, maxW: 5.9, color: HEX.rule });
  text(s, "± 는 \"한 번 학습했을 때 결과가 얼마나 흔들리는가\"를 나타낸다. 라벨이 적은 semi·weak는 라벨 부분집합까지 바뀌어 편차가 더 크다(±1~2).", M + 6.2, 4.75, 5.9, 1.6, { fontSize: 15 });

  s = content("차이를 읽는 법: 차이가 흔들림보다 큰가",
    "두 방법의 차이를 볼 때는 평균만 비교하지 말고 편차와 함께 본다. 예시 1(weak): 차이 5.6%p가 편차(±2.0, ±0.5)보다 훨씬 크고 3개 시드 모두 같은 방향 → 믿을 만한 차이. 예시 2(full): 차이 0.04%p는 편차보다 작다 → 차이가 없다고 봐야 한다. 표준편차(한 번 실행의 흔들림)와 표준오차(평균의 불확실성, s/√n)를 구분하자. 시드 3개는 표준편차 추정 자체가 거칠다 — 엄밀한 주장에는 시드 5~10개, 시드끼리 짝지은 비교(paired t-test 등)가 필요하다. 이번 강의에서는 '모든 시드에서 같은 방향인가'를 함께 본다.");
  const A = (st, m) => R.agg[st][m];
  const seeds = (st, m) => (A(st, m) ? A(st, m).fine_acc.all.map((v) => (100 * v).toFixed(1)).join(", ") : "–");
  const allWin = (st, a, b) => (A(st, a) && A(st, b) ? A(st, a).fine_acc.all.every((v, i) => v > A(st, b).fine_acc.all[i]) : false);
  table(s, [["비교 (fine 정확도 %)", "평균 ± 표준편차", "시드별 값", "판단"],
    [{ text: "weak · fine+coarse CE" }, ms(A("weak", "ce_both"), "fine_acc", 2), seeds("weak", "ce_both"), { text: allWin("weak", "ce_both_sl", "ce_both") ? "차이 ≫ 편차, 모든 시드 우세 → 믿을 만함" : "확인 필요", fill: HEX.okTint, bold: true, options: { rowspan: 2 } }],
    [{ text: "weak · + 계층 의미 손실", bold: true }, ms(A("weak", "ce_both_sl"), "fine_acc", 2), seeds("weak", "ce_both_sl")],
    [{ text: "full · + exactly-one SL" }, ms(A("full", "ce_both_eo"), "fine_acc", 2), seeds("full", "ce_both_eo"), { text: "차이 < 편차 → 차이가 없다고 판단", fill: HEX.badTint, bold: true, options: { rowspan: 2 } }],
    [{ text: "full · + 계층 의미 손실", bold: true }, ms(A("full", "ce_both_sl"), "fine_acc", 2), seeds("full", "ce_both_sl")]],
  M, 1.5, CW, { colW: [2.95, 2.15, 2.45, 4.58], rowH: 0.5, fontSize: 14 });
  card(s, M, 4.3, 3.85, 2.15, { title: "규칙 1", tag: "1", tagColor: HEX.rule, body: "평균의 차이를 두 방법의 표준편차와 비교한다", bodySize: 15 });
  card(s, M + 4.1, 4.3, 3.85, 2.15, { title: "규칙 2", tag: "2", tagColor: HEX.violet, body: "시드별로 짝지어 모두 같은 방향인지 본다", bodySize: 15 });
  card(s, M + 8.2, 4.3, 3.93, 2.15, { title: "주의", tag: "!", tagColor: HEX.inkSoft, body: "표준오차 = s/√n (n=3이면 약 0.58s). 시드 3개는 추정이 거칠다", bodySize: 15 });

  s = content("구현: 코드 구조",
    "[1:14] torch와 numpy만 사용(torchvision 없이 CIFAR 원본 파일을 직접 읽음). 손실 함수는 학습 코드와 분리해서 단위 테스트로 검증했다. 실험 실행기는 결과를 JSON으로 캐시해 중단되어도 이어서 실행된다.");
  code(s, `SemanticLoss/
├── semloss/
│   ├── losses.py             # 의미 손실: 전수 WMC, 닫힌 형태, CNF 생성
│   ├── data.py               # CIFAR-100 로딩, full/semi/weak 분할, GPU 증강
│   ├── model.py              # ResNet-9, 출력 120 = fine 100 + coarse 20
│   └── train.py              # 1회 학습 + 평가 지표 8종
├── tests/test_losses.py      # 논문 수치 재현 + 전수 계산과 대조
├── demo_paper_examples.py    # 2.1절 예제(표, 펭귄, 경사하강) 재현
├── run_experiments.py        # λ 튜닝 → 본 실험 → 대조 실험 (재시작 가능)
└── summarize.py              # 결과 집계 → results/summary.md`, M, 1.5, 7.9, 4.95, { size: 12.5 });
  card(s, 8.8, 1.5, 3.93, 4.95, { title: "설계 원칙", tag: "✓", tagColor: HEX.aqua, body: ["손실 함수는 순수 함수로 분리", "닫힌 형태는 전수 계산과 대조", "모든 실행을 JSON으로 캐시", "의존성 최소화 (torch, numpy)"], bodySize: 14 });

  s = content("구현 ①: 명제 규칙의 코드화 (CNF)",
    "[1:16] 규칙을 DIMACS 형식의 리터럴 리스트로 표현한다: +k는 X_k가 참, −k는 거짓. exactly-one은 '최소 하나' 절과 모든 쌍의 '둘 다 참은 안 됨' 절. 함의 f_i → c_par(i)는 ¬f_i ∨ c_par(i), 즉 [-(i+1), F+1+par(i)]. 이 CNF는 학습에 직접 쓰지 않고(5,242절, 2^120 세계) 작은 크기에서 닫힌 형태를 검증하는 기준으로 쓴다.");
  code(s, `def exactly_one_cnf(vars_):
    """CNF clauses for exactly-one over the given 1-based variable ids."""
    clauses = [list(vars_)]                                  # at least one
    clauses += [[-a, -b] for a, b in itertools.combinations(vars_, 2)]  # at most one
    return clauses


def hierarchy_cnf(parent, n_coarse):
    """CNF for the hierarchy constraint; fine vars are 1..F, coarse vars F+1..F+C."""
    n_fine = len(parent)
    fine = list(range(1, n_fine + 1))
    coarse = list(range(n_fine + 1, n_fine + n_coarse + 1))
    clauses = exactly_one_cnf(fine) + exactly_one_cnf(coarse)
    clauses += [[-(i + 1), n_fine + 1 + int(parent[i])] for i in range(n_fine)]  # f_i -> c_par(i)
    return clauses


PENGUIN_CNF = [[-3, 1], [-3, -2]]   # 1=B, 2=F, 3=P : (¬P ∨ B) ∧ (¬P ∨ ¬F)`, M, 1.45, CW, 5.05, { size: 13, title: "semloss/losses.py" });

  s = content("구현 ②: 정의 그대로 — 전수 가중 모델 카운팅",
    "[1:18] 정의를 그대로 옮긴 기준 구현. 모든 세계를 나열하고, 모든 절을 만족하는 세계의 확률(참이면 p, 거짓이면 1−p의 곱)을 더한다. 2^n이라 n≤20 정도에서만 쓸 수 있지만, torch 연산이라 autograd로 기울기까지 나온다 — 펭귄 예제의 (0.16, −0.72, −0.82)를 이 함수로 검증했다.");
  code(s, `def wmc_bruteforce(probs, clauses):
    """Pr(alpha) by enumerating all 2^n worlds (reference implementation, small n only)."""
    n = probs.shape[-1]
    total = probs.new_zeros(probs.shape[:-1])
    for world in itertools.product([0, 1], repeat=n):
        # x |= alpha : every clause has at least one true literal
        if all(any((lit > 0) == bool(world[abs(lit) - 1]) for lit in clause) for clause in clauses):
            w = torch.tensor(world, dtype=torch.bool, device=probs.device)
            # prod_i p_i^{x_i} (1 - p_i)^{1 - x_i}
            total = total + torch.prod(torch.where(w, probs, 1 - probs), dim=-1)
    return total


probs = torch.tensor([0.9, 0.8, 0.8], requires_grad=True)
pr = wmc_bruteforce(probs, PENGUIN_CNF)     # 0.344
pr.backward()                                # probs.grad = (0.16, -0.72, -0.82)`, M, 1.45, CW, 5.05, { size: 13, title: "semloss/losses.py · 기준 구현" });

  s = content("구현 ③: 닫힌 형태 — 학습에 쓰는 손실",
    "[1:20] 실제 학습에 쓰는 코드는 사실상 3줄. 수식과 코드가 1:1로 대응한다: coarse_logits[..., parent]는 각 세부 클래스의 부모 로짓을 모으는 인덱싱(gather)이다. 배치 B, 클래스 100이면 연산량은 O(B·120)으로 CE와 같은 수준 — 의미 손실을 넣어도 학습 시간이 거의 늘지 않는다.");
  code(s, `def exactly_one_log_prob(logits):
    """log Pr(exactly one X_i is true) = logsumexp(x) - sum softplus(x)."""
    return torch.logsumexp(logits, dim=-1) - F.softplus(logits).sum(dim=-1)


def hierarchy_log_prob(fine_logits, coarse_logits, parent):
    """log Pr(EO(fine) & EO(coarse) & AND_i (fine_i -> coarse_parent(i)))."""
    joint = fine_logits + coarse_logits[..., parent]   # f_i + c_par(i)
    return (torch.logsumexp(joint, dim=-1)
            - F.softplus(fine_logits).sum(dim=-1)
            - F.softplus(coarse_logits).sum(dim=-1))


def hierarchy_semantic_loss(fine_logits, coarse_logits, parent):
    """Batch mean of -log Pr(alpha)."""
    return -hierarchy_log_prob(fine_logits, coarse_logits, parent).mean()`, M, 1.45, 8.3, 5.05, { size: 12.5, title: "semloss/losses.py · 학습용" });
  card(s, 9.2, 1.45, 3.53, 5.05, { title: "수식 ↔ 코드", tag: "=", tagColor: HEX.rule, fill: HEX.ruleTint, body: ["fᵢ + c_par(i) ↔ joint", "logsumexpᵢ ↔ torch.logsumexp", "Σ softplus ↔ F.softplus().sum", "연산량 O(B·120), CE 수준"], bodySize: 14 });

  s = content("구현 ④: 닫힌 형태를 믿어도 되는가 — 테스트",
    "[1:22] 닫힌 형태를 손으로 유도했으니 틀릴 수 있다. 그래서 (1) 논문의 표 값, (2) 펭귄 예제의 확률과 기울기, (3) 무작위 로짓에서 전수 계산과의 일치(상대오차 1e-10), (4) 극단적 로짓(±40)에서의 수치 안정성을 테스트했다. 6개 테스트 모두 통과. 대학원생에게 강조: 손으로 유도한 손실은 반드시 기준 구현과 대조하라.");
  code(s, `def test_hierarchy_closed_form_matches_bruteforce():
    torch.manual_seed(0)
    parent = torch.tensor([0, 0, 1, 1, 2])    # 5 fine, 3 coarse
    cnf = hierarchy_cnf(parent, 3)
    logits = torch.randn(4, 8, dtype=torch.float64) * 2
    f, c = logits[:, :5], logits[:, 5:]
    brute = wmc_bruteforce(torch.sigmoid(logits), cnf)  # 2^8 worlds
    closed = hierarchy_log_prob(f, c, parent).exp()
    assert torch.allclose(closed, brute, rtol=1e-10)


def test_hierarchy_log_prob_is_stable_for_large_logits():
    f = torch.full((2, 100), -40.0); c = torch.full((2, 20), -40.0)
    f[:, 7] = 40.0; c[:, 1] = 40.0            # parent(7) == 1
    assert hierarchy_log_prob(f, c, parent).abs().max() < 1e-6`, M, 1.45, 8.3, 5.05, { size: 12.5, title: "tests/test_losses.py" });
  card(s, 9.2, 1.45, 3.53, 5.05, { title: "6 passed", tag: "✓", tagColor: HEX.aqua, body: ["논문 표 3행 (exactly-one)", "펭귄: Pr = 0.344, ∇ = (0.16, −0.72, −0.82)", "계층 닫힌 형태 = 전수 계산", "로짓 ±40에서도 유한·정확"], bodySize: 14 });

  s = content("구현 ⑤: 학습 루프의 핵심",
    "[1:24] 학습 스텝 하나. 마스크로 라벨 있는 샘플만 CE에 반영하되, 데이터 의존 분기 없이 곱셈으로 처리해 GPU 동기화를 피한다. 로짓은 bfloat16으로 계산하지만 손실은 float32로 바꿔 계산(softplus 합이 120개 항이라 정밀도 중요). 의미 손실은 라벨과 무관하게 배치 전체에 적용된다.");
  code(s, `with torch.autocast(device.type, dtype=torch.bfloat16):
    logits = model(x)
logits = logits.float()                                  # losses in float32
f, c = logits[:, :N_FINE], logits[:, N_FINE:]
mf, mc = has_f[b], has_c[b]                              # label-availability masks

# masked means keep the graph static (no data-dependent branching / sync)
ce_f = (F.cross_entropy(f, f_tr[b], reduction="none") * mf).sum() / mf.sum().clamp(min=1)
loss = ce_f
if method != "ce_fine":
    ce_c = (F.cross_entropy(c, c_tr[b], reduction="none") * mc).sum() / mc.sum().clamp(min=1)
    loss = loss + ce_c
if method == "ce_both_sl":
    lam_t = lam * min(1.0, step / (warmup_epochs * steps_per_epoch))
    sl = hierarchy_semantic_loss(f, c, parent)           # label-free: every image in the batch
    loss = loss + lam_t * sl
if method == "ce_both_eo":                               # ablation: EO(f) & EO(c), no implications
    lam_t = lam * min(1.0, step / (warmup_epochs * steps_per_epoch))
    sl = -(exactly_one_log_prob(f) + exactly_one_log_prob(c)).mean()
    loss = loss + lam_t * sl`, M, 1.45, CW, 5.05, { size: 12.5, title: "semloss/train.py" });

  s = content("구현 ⑥: 추론 시 규칙을 쓰는 두 가지 방법",
    "[1:26] 의미 손실은 학습 시 규칙을 주입한다. 비교를 위해 추론 시 규칙을 쓰는 두 방법도 구현: (1) 마스킹 — coarse 예측을 먼저 정하고 그 자식 5개 중에서 fine을 고른다(하향식). (2) MAP — 닫힌 형태 유도의 부산물로, 만족 세계 100개 중 확률이 가장 큰 세계를 고른다. 두 방법 모두 출력이 100% 일관적이다.");
  code(s, `pred_f = f.argmax(1)
pred_c = c.argmax(1)

# (1) Hierarchical masking: fine prediction restricted to children of predicted coarse.
masked = f.masked_fill(parent[None, :] != pred_c[:, None], float("-inf"))

# (2) MAP world under the constraint: argmax_i (f_i + c_par(i)).
pred_joint = (f + c[:, parent]).argmax(1)

consistency = (parent[pred_f] == pred_c).float().mean()          # rule compliance
within_superclass_err = (parent[pred_f[wrong]] == coarse[wrong]).float().mean()`, M, 1.45, CW, 3.6, { size: 14, title: "semloss/train.py · evaluate()" });
  card(s, M, 5.3, 5.9, 1.2, { title: "마스킹: coarse를 먼저 정하고 fine을 그 안에서", tag: "1", tagColor: HEX.violet, titleSize: 15 });
  card(s, M + 6.2, 5.3, 5.9, 1.2, { title: "MAP: 100개 만족 세계 중 최대 확률", tag: "2", tagColor: HEX.rule, fill: HEX.ruleTint, titleSize: 15 });

  // ---------------- 6. Results ----------------
  divider("06", "실험 결과와 토론", "정확도는 '확신'이, 규칙 준수는 '함의 규칙'이 만든다", "6부: 결과와 토론, 퀴즈까지 약 16분.");

  s = content("λ 선택: 최적점 너머에는 절벽이 있다",
    "[1:29] 검증셋 fine 정확도 vs λ (시드 0). 세 설정 모두 λ=5에서 학습이 붕괴했다(semi 6.5%, weak 5.7%). 의미 손실이 CE보다 지배적이 되면, 라벨과 무관하게 '아무 만족 세계로나 확신'하는 자명한 해로 수렴하기 때문 — 의미 손실은 정답 방향을 모른다는 이론의 직접적 결과. 라벨이 적은 semi는 더 일찍(λ=2) 무너진다. 최적 λ: full 2, semi 1, weak 2.");
  const lamLabels = R.lamGrid.map(String);
  s.addChart(pres.charts.LINE, ["full", "semi", "weak"].map((st) => ({ name: st, labels: lamLabels, values: R.tuneSl[st].map((v) => (v === null ? null : +(100 * v).toFixed(1))) })),
    chartBase({ x: M, y: 1.45, w: 8.0, h: 5.05, chartColors: [HEX.neural, HEX.aqua, HEX.rule], lineSize: 2, lineDataSymbol: "circle", lineDataSymbolSize: 8,
      valAxisMinVal: 0, valAxisMaxVal: 80, showTitle: true, title: "검증 fine 정확도 (%) vs λ", titleFontSize: 13, titleColor: HEX.inkSoft,
      showCatAxisTitle: true, catAxisTitle: "λ", catAxisTitleFontSize: 11, catAxisTitleColor: HEX.inkSoft }));
  card(s, 9.0, 1.45, 3.73, 5.05, { title: "읽는 법", tag: "λ", tagColor: HEX.violet, body: [`선택된 λ: full ${R.best.full}, semi ${R.best.semi}, weak ${R.best.weak}`, "λ = 5에서 모든 설정이 붕괴", "라벨이 적을수록(semi) 더 작은 λ에서 붕괴", "교훈: 의미 손실은 정답을 모른다 → CE가 방향을 잡아줘야 한다"], bodySize: 14 });

  s = content("주요 결과: 세부 클래스 정확도",
    "핵심 그림. 테스트셋 fine 정확도, 3시드 평균. 네 막대는 왼쪽부터 요소를 하나씩 추가한 것. 의미 손실 계열(청록, 주황)은 라벨이 적을수록 이득이 크다. 그런데 청록(exactly-one만)과 주황(함의 규칙 포함)의 높이가 거의 같다는 점에 주목 — 정확도 이득의 대부분은 함의 규칙이 아니라 exactly-one 부분에서 온다. 다음 슬라이드들에서 분해한다.");
  const methods = ["ce_fine", "ce_both", "ce_both_eo", "ce_both_sl"];
  const setNames = ["full", "semi", "weak"];
  s.addChart(pres.charts.BAR, methods.map((m) => ({ name: METHOD_LABEL[m], labels: setNames.map((x) => SETTING_LABEL[x]), values: setNames.map((st) => (R.agg[st][m] ? +(100 * R.agg[st][m].fine_acc.mean).toFixed(1) : 0)) })),
    chartBase({ x: M, y: 1.45, w: 8.6, h: 5.05, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60, barOverlapPct: -8, chartColors: methods.map((m) => METHOD_COLOR[m]),
      valAxisMinVal: 0, valAxisMaxVal: 80, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showTitle: true, title: "테스트 fine 정확도 (%), 3시드 평균", titleFontSize: 13, titleColor: HEX.inkSoft }));
  const g = (st, a, b) => (R.agg[st][a] && R.agg[st][b] ? (100 * (R.agg[st][a].fine_acc.mean - R.agg[st][b].fine_acc.mean)).toFixed(1) : "–");
  const sgn = (v) => (v === "–" ? v : (+v >= 0 ? "+" : "") + v);
  card(s, 9.5, 1.45, 3.23, 5.05, { title: "CE 대비 이득", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint, body: [{ text: "exactly-one / 계층 SL", bold: true }, `full: ${sgn(g("full", "ce_both_eo", "ce_both"))} / ${sgn(g("full", "ce_both_sl", "ce_both"))}%p`, `semi: ${sgn(g("semi", "ce_both_eo", "ce_both"))} / ${sgn(g("semi", "ce_both_sl", "ce_both"))}%p`, `weak: ${sgn(g("weak", "ce_both_eo", "ce_both"))} / ${sgn(g("weak", "ce_both_sl", "ce_both"))}%p`, "라벨이 적을수록 이득이 크다", "두 SL의 차이는 작다"], bodySize: 15 });

  s = content("결과 표: 평균 ± 표준편차 (3 시드)",
    "숫자로 보면. 표준편차를 함께 봐야 한다. weak에서 두 의미 손실 모두 편차를 줄였다(±2.0 → ±0.5): 학습이 더 안정적. 정확도는 exactly-one과 계층 SL이 비슷하거나(full, weak) exactly-one이 더 높지만(semi), 일관성 열은 계층 SL이 확실히 높다. '—'는 해당 방법이 coarse 헤드를 학습하지 않아 의미 없는 값.");
  const trows = [["설정 / 방법", "fine 정확도", "coarse 정확도", "일관성", "fine (MAP)"]];
  for (const st of setNames) {
    for (const m of methods) {
      const a = R.agg[st][m];
      const hero = m === "ce_both_sl";
      const c0 = m === "ce_fine";
      trows.push([{ text: `${st} · ${METHOD_LABEL[m]}`, bold: hero, fill: hero ? HEX.ruleTint : undefined },
        { text: ms(a, "fine_acc"), bold: hero, fill: hero ? HEX.ruleTint : undefined },
        { text: c0 ? "—" : ms(a, "coarse_acc"), fill: hero ? HEX.ruleTint : undefined },
        { text: c0 ? "—" : ms(a, "consistency"), fill: hero ? HEX.ruleTint : undefined },
        { text: c0 ? "—" : ms(a, "fine_acc_joint"), fill: hero ? HEX.ruleTint : undefined }]);
    }
  }
  table(s, trows, M, 1.4, CW, { colW: [3.6, 2.13, 2.13, 2.13, 2.14], rowH: 0.395, fontSize: 12 });

  s = content("규칙 준수: 일관성은 크게 오른다",
    "fine 예측과 coarse 예측이 서로 맞는 비율. 여기서는 그림이 다르다: exactly-one(청록)은 일관성을 조금만 올리지만, 함의 규칙을 포함한 계층 SL(주황)은 semi·weak에서 약 8%p를 더 올린다. 함의 규칙이 직접 최적화하는 대상이 바로 이 일관성이기 때문.");
  const m3 = ["ce_both", "ce_both_eo", "ce_both_sl"];
  s.addChart(pres.charts.BAR, m3.map((m) => ({ name: METHOD_LABEL[m], labels: setNames.map((x) => x), values: setNames.map((st) => (R.agg[st][m] ? +(100 * R.agg[st][m].consistency.mean).toFixed(1) : 0)) })),
    chartBase({ x: M, y: 1.45, w: 8.6, h: 5.05, barDir: "col", barGrouping: "clustered", barGapWidthPct: 70, barOverlapPct: -8, chartColors: m3.map((m) => METHOD_COLOR[m]),
      valAxisMinVal: 50, valAxisMaxVal: 100, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showTitle: true, title: "일관성 (%) : par(argmax f) = argmax c", titleFontSize: 13, titleColor: HEX.inkSoft }));
  const cons = (st, m) => (R.agg[st][m] ? pct(R.agg[st][m].consistency.mean) : "–");
  card(s, 9.5, 1.45, 3.23, 5.05, { title: "요약", tag: "S", tagColor: HEX.rule, fill: HEX.ruleTint, body: [{ text: "CE → EO → 계층 SL", bold: true }, `weak: ${cons("weak", "ce_both")} → ${cons("weak", "ce_both_eo")} → ${cons("weak", "ce_both_sl")}`, `semi: ${cons("semi", "ce_both")} → ${cons("semi", "ce_both_eo")} → ${cons("semi", "ce_both_sl")}`, `full: ${cons("full", "ce_both")} → ${cons("full", "ce_both_eo")} → ${cons("full", "ce_both_sl")}`, { text: "단위 %, y축이 50%에서 시작", sub: true }], bodySize: 15 });

  s = content("대조 실험 (RQ4): 함의 규칙은 무엇을 바꾸는가?",
    "RQ4의 답. exactly-one 대조군은 같은 의미 손실에서 함의 규칙 100개만 뺀 것: EO(f)∧EO(c). 막대는 계층 SL − exactly-one SL, 즉 함의 규칙의 순수 효과. 정확도(왼쪽)는 full·weak에서 노이즈 수준이고 semi에서는 오히려 낮다. 일관성(오른쪽)은 semi·weak에서 약 8%p 오른다. 결론: 정확도 이득은 주로 '출력을 원-핫으로 확신하게 하는' 효과(준지도 학습의 엔트로피 최소화와 유사)이고, 함의 규칙은 규칙 준수를 만든다. 처음 가설(규칙이 coarse 정보를 fine으로 전파해 정확도를 올린다)은 이 실험에서 지지되지 않았다 — 대조 실험이 왜 필요한지 보여주는 좋은 예.");
  const dif = (st, k) => (R.agg[st].ce_both_sl && R.agg[st].ce_both_eo ? +(100 * (R.agg[st].ce_both_sl[k].mean - R.agg[st].ce_both_eo[k].mean)).toFixed(1) : 0);
  const difStd = (st, k) => { const a = R.agg[st].ce_both_sl, b = R.agg[st].ce_both_eo; return a && b ? (100 * Math.sqrt(a[k].std ** 2 + b[k].std ** 2)).toFixed(1) : "–"; };
  s.addChart(pres.charts.BAR, [{ name: "fine 정확도 차이", labels: setNames, values: setNames.map((st) => dif(st, "fine_acc")) }],
    chartBase({ x: M, y: 1.45, w: 4.1, h: 4.0, barDir: "col", barGapWidthPct: 70, chartColors: [HEX.rule], showLegend: false, valAxisMinVal: -3, valAxisMaxVal: 9, valAxisMajorUnit: 3,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "+0.0;-0.0;0.0", showTitle: true, title: "fine 정확도 (%p)", titleFontSize: 13, titleColor: HEX.inkSoft }));
  s.addChart(pres.charts.BAR, [{ name: "일관성 차이", labels: setNames, values: setNames.map((st) => dif(st, "consistency")) }],
    chartBase({ x: M + 4.3, y: 1.45, w: 4.1, h: 4.0, barDir: "col", barGapWidthPct: 70, chartColors: [HEX.rule], showLegend: false, valAxisMinVal: -3, valAxisMaxVal: 9, valAxisMajorUnit: 3,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "+0.0;-0.0;0.0", showTitle: true, title: "일관성 (%p)", titleFontSize: 13, titleColor: HEX.inkSoft }));
  text(s, `막대 = 계층 SL − exactly-one SL (3시드 평균). 참고: 두 방법의 시드 간 표준편차를 합성한 값 — fine: full ±${difStd("full", "fine_acc")}, semi ±${difStd("semi", "fine_acc")}, weak ±${difStd("weak", "fine_acc")}`, M, 5.6, 8.4, 0.8, { fontSize: 12, color: HEX.muted });
  card(s, 9.2, 1.45, 3.53, 5.05, { title: "결론", tag: "4", tagColor: HEX.violet, body: ["정확도 이득의 대부분은 exactly-one(확신) 효과", "함의 규칙의 정확도 기여: 노이즈 수준, semi에서는 음수", "함의 규칙은 일관성을 약 8%p 올린다 (semi·weak)", "처음 가설은 지지되지 않음 → 대조 실험의 가치"], bodySize: 14 });

  s = content("오류의 질과 추론 시 규칙 적용",
    "두 가지 추가 관찰(weak 설정). (1) 함의 규칙을 넣은 모델은 틀려도 같은 상위 클래스 안에서 틀리는 비율이 가장 높다(CE 34% → exactly-one 36% → 계층 40%) — 사자를 호랑이로 틀리지 트럭으로 틀리지 않는다. 이것도 함의 규칙의 고유한 효과. (2) 추론 시 규칙 적용(MAP, 마스킹)은 CE 모델의 정확도를 약 2%p 올리지만, 학습 시 의미 손실을 쓴 모델에는 미치지 못한다.");
  const qrows = [["weak 설정 (3시드 평균)", "fine 정확도", "fine (MAP)", "fine (masked)", "같은 상위 내 오류"]];
  for (const m of ["ce_both", "ce_both_eo", "ce_both_sl"]) {
    const a = R.agg.weak[m]; const hero = m === "ce_both_sl";
    qrows.push([{ text: METHOD_LABEL[m], bold: hero, fill: hero ? HEX.ruleTint : undefined }, { text: ms(a, "fine_acc"), fill: hero ? HEX.ruleTint : undefined }, { text: ms(a, "fine_acc_joint"), fill: hero ? HEX.ruleTint : undefined }, { text: ms(a, "fine_acc_masked"), fill: hero ? HEX.ruleTint : undefined }, { text: ms(a, "within_superclass_err"), bold: hero, fill: hero ? HEX.ruleTint : undefined }]);
  }
  table(s, qrows, M, 1.5, CW, { colW: [3.13, 2.25, 2.25, 2.25, 2.25], rowH: 0.55, fontSize: 14 });
  card(s, M, 4.0, 5.9, 2.45, { title: "틀려도 덜 심하게 틀린다", tag: "1", tagColor: HEX.rule, fill: HEX.ruleTint, body: ["같은 상위 클래스 안의 오답 비율: CE < exactly-one < 계층", "예: lion을 tiger로 틀리지, truck으로 틀리지 않는다"], bodySize: 14 });
  card(s, M + 6.2, 4.0, 5.9, 2.45, { title: "학습 시 주입 > 추론 시 적용", tag: "2", tagColor: HEX.violet, body: ["MAP·마스킹은 CE 모델의 정확도를 약 2%p 올린다", "그래도 학습 시 의미 손실을 쓴 모델보다 낮다"], bodySize: 14 });

  s = content("토론: 한계와 주의할 점",
    "정직한 한계. (0) 가장 중요: 정확도 이득의 대부분은 함의 규칙이 아니라 exactly-one 부분에서 왔다. 엔트로피 최소화, pseudo-label 같은 일반 준지도 기법과의 비교가 다음 실험이 되어야 한다. (1) λ에 민감하고 최적점이 붕괴 구간 근처. (2) CE는 소프트맥스로 학습하므로 CE만 쓴 모델의 시그모이드 값은 확률로 보정되어 있지 않다 — log Pr(α)가 −200 근처로 나오는 이유. 이 지표는 의미 손실 모델끼리만 비교. (3) 닫힌 형태가 있는 단순한 제약이었다 — 일반 규칙은 지식 컴파일 필요. (4) 데이터셋·모델·에폭 하나씩. (5) λ를 시드 0으로 골라 테스트 시드 0과 라벨 부분집합이 같다(검증/테스트는 분리됨).");
  const lim = [["정확도 이득의 원천", "대부분 exactly-one(확신) 효과 — 엔트로피 최소화 같은 일반 준지도 기법과 비교가 필요", HEX.rule],
    ["λ 민감도", "최적 λ 근처에 붕괴 구간 (λ=5). 검증셋 튜닝과 웜업이 필수", HEX.violet],
    ["확률 보정", "CE(소프트맥스)만 쓴 모델의 시그모이드는 확률로 보정되지 않음 → log Pr(α) ≈ −200은 비교 불가", HEX.neural],
    ["범위", "닫힌 형태가 있는 단순한 제약, 데이터셋·모델 1개, 30 에폭, 시드 3개. 일반 CNF는 지식 컴파일 필요", HEX.inkSoft]];
  lim.forEach(([t, d, c], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    card(s, M + col * 6.15, 1.5 + row * 2.5, 5.95, 2.25, { title: t, body: d, tag: String(i + 1), tagColor: c, bodySize: 14 });
  });

  s = content("핵심 정리",
    "[1:50] 세 줄 요약으로 마무리. 시간이 남으면 이해 확인 문제로.");
  const take = [["1", "의미 손실 = −log Pr(규칙 만족)", "신경망 출력을 독립 확률로 보고, 규칙을 만족하는 세계들의 확률 합을 최대화한다. 미분 가능하고 라벨이 필요 없다.", HEX.rule],
    ["2", "기울기가 논리 추론을 수행한다", "깨진 규칙에 기울기가 집중되고(전건 긍정), 모순 해소의 방향은 데이터(CE)와의 균형이 정한다.", HEX.violet],
    ["3", "정확도는 확신이, 규칙 준수는 함의 규칙이 만든다", `라벨이 적을수록 의미 손실의 정확도 이득이 크다(weak ${sgn(g("weak", "ce_both_sl", "ce_both"))}%p). 그 대부분은 exactly-one 효과이고, 함의 규칙은 일관성을 약 8%p 올린다. 대조 실험 없이는 알 수 없었던 결론.`, HEX.neural]];
  take.forEach(([n, t, d, c], i) => {
    const y0 = 1.5 + i * 1.65;
    s.addShape(pres.shapes.OVAL, { x: M, y: y0 + 0.1, w: 0.8, h: 0.8, fill: { color: c }, line: { color: c }, objectName: "num" });
    s.addText(n, { x: M, y: y0 + 0.1, w: 0.8, h: 0.8, fontSize: 26, bold: true, color: HEX.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText(t, { x: M + 1.1, y: y0, w: CW - 1.1, h: 0.55, fontSize: 21, bold: true, color: HEX.ink, margin: 0, isTextBox: true, valign: "middle" });
    s.addText(d, { x: M + 1.1, y: y0 + 0.58, w: CW - 1.1, h: 0.8, fontSize: 15, color: HEX.inkSoft, margin: 0, isTextBox: true, valign: "top" });
  });

  s = content("이해 확인 문제",
    "[1:52] 3~5분. 정답은 다음 슬라이드. Q4는 대학원생용.");
  const qs = [["Q1", "출력 p = (0.5, 0.5, 0.5)일 때 exactly-one 제약의 Pr(α)와 의미 손실은?"],
    ["Q2", "펭귄 규칙에서 p_P = 0 (확실히 펭귄이 아님)이면 Pr(α)는? 이때 p_B, p_F에 대한 기울기는?"],
    ["Q3", "semi 설정에서 라벨이 없는 이미지는 어떤 손실 항으로부터 학습 신호를 받는가? λ가 너무 크면 왜 붕괴하는가?"],
    ["Q4", "규칙 \"maple_tree와 oak_tree는 동시에 참일 수 없다\"를 추가하면 계층 제약의 만족 세계 수와 닫힌 형태는 어떻게 바뀌는가?"]];
  qs.forEach(([k, q], i) => {
    const y0 = 1.5 + i * 1.25;
    pill(s, k, M, y0 + 0.25, 0.9, i === 3 ? HEX.violet : HEX.rule);
    text(s, q, M + 1.2, y0 + 0.12, CW - 1.2, 0.9, { fontSize: 17, valign: "middle" });
  });

  s = content("정답과 해설",
    "[1:55] 해설. Q4의 요점: EO(f)가 이미 '두 fine이 동시에 참일 수 없음'을 포함하므로 새 규칙은 중복 — 논리적으로 동치인 제약이므로 의미 손실도 변하지 않는다(의미에만 의존하는 성질).");
  await math(s, "\\text{Q1: } \\Pr = 3 \\cdot 0.5 \\cdot 0.5^2 = 0.375,\\quad Lˢ = -\\log 0.375 \\approx 0.98", M, 1.5, { pt: 20 });
  await math(s, "\\text{Q2: } \\Pr = (1 - 0) + 0 = 1,\\quad \\partial\\Pr/\\partial p_B = \\partial\\Pr/\\partial p_F = 0", M, 2.45, { pt: 20 });
  text(s, "펭귄이 아니면 규칙이 자동으로 만족된다(공허한 참) → 손실 0, 다른 출력에 아무 신호도 주지 않는다.", M, 3.2, CW, 0.5, { fontSize: 15, color: HEX.inkSoft });
  text(s, [{ text: "Q3: ", options: { bold: true } }, { text: "의미 손실 항만 (CE는 라벨이 있어야 한다). λ가 크면 CE가 정해 주는 방향보다 \"아무 만족 세계로나 확신\"하는 쪽이 이겨서, 라벨과 무관한 자명한 해로 수렴한다." }], M, 3.85, CW, 1.0, { fontSize: 16 });
  text(s, [{ text: "Q4: ", options: { bold: true } }, { text: "변하지 않는다. EO(f)가 이미 ¬maple ∨ ¬oak 절을 포함하므로 새 규칙은 중복이다. 논리적으로 동치인 제약은 같은 의미 손실을 갖는다 — 의미 손실이 \"의미에만 의존\"하는 성질의 예." }], M, 4.95, CW, 1.3, { fontSize: 16 });

  s = content("참고문헌",
    "추가 읽기 자료. Xu et al. 2018이 핵심 논문. Ahmed et al. 2022는 의미 손실의 후속 연구(신경 확률 회로), Giunchiglia et al. 2022는 딥러닝에 논리 제약을 넣는 방법들의 서베이.");
  bullets(s, [
    "J. Xu, Z. Zhang, T. Friedman, Y. Liang, G. Van den Broeck. A Semantic Loss Function for Deep Learning with Symbolic Knowledge. ICML 2018.",
    "A. Krizhevsky. Learning Multiple Layers of Features from Tiny Images. Tech. report, Univ. of Toronto, 2009. (CIFAR-100)",
    "A. Darwiche, P. Marquis. A Knowledge Compilation Map. JAIR 17, 2002. (d-DNNF, SDD)",
    "R. Manhaeve et al. DeepProbLog: Neural Probabilistic Logic Programming. NeurIPS 2018.",
    "S. Badreddine, A. d'Avila Garcez, L. Serafini, M. Spranger. Logic Tensor Networks. Artificial Intelligence 303, 2022.",
    "K. Ahmed, S. Teso, K.-W. Chang, G. Van den Broeck, A. Vergari. Semantic Probabilistic Layers for Neuro-Symbolic Learning. NeurIPS 2022.",
    "E. Giunchiglia, M. C. Stoian, T. Lukasiewicz. Deep Learning with Logical Constraints. IJCAI 2022 (survey).",
    "D. Page. How to Train Your ResNet (ResNet-9 / DAWNBench), Myrtle.ai blog, 2018.",
  ], M, 1.5, CW, 5.0, { fontSize: 14 });

  // ---------------- Appendix ----------------
  divider("부록", "실습", "직접 돌려 보기", "부록: 수업 후 실습용.");

  s = content("부록 A: 실습 환경과 실행",
    "실습 안내. GPU가 없으면 CPU에서도 돌지만 1회 학습이 수십 분 걸린다 — 실습에서는 --epochs 5 정도로 줄여서 경향만 보도록 안내. demo와 tests는 CPU에서 1초 안에 끝난다.");
  card(s, M, 1.5, 4.1, 4.95, { title: "환경", tag: "1", tagColor: HEX.neural, body: ["Python 3.10+, PyTorch 2.x, NumPy", "torchvision 불필요", "GPU: CUDA 또는 Apple MPS (자동 선택)", "CIFAR-100은 첫 실행 시 자동 다운로드 (약 160MB, MD5 검증)", "전체 실험: 1회 약 5.5분 × 66회 (M4 Max 기준)"], bodySize: 14 });
  code(s, `# 1. 손실 함수 단위 테스트 (1초)
python3 -m pytest -q tests

# 2. 논문 예제 재현: 표, 펭귄, 경사하강 궤적 (1초)
python3 demo_paper_examples.py

# 3. 전체 실험 (λ 튜닝 → 본 실험 → 대조 실험)
#    결과는 results/*.json 에 캐시 → 중단 후 재실행하면 이어서 진행
python3 run_experiments.py --epochs 30 --label-frac 0.1

# 4. 결과 표 생성 → results/summary.md
python3 summarize.py`, M + 4.35, 1.5, 7.78, 4.95, { size: 14, title: "터미널" });

  s = content("부록 B: 실습 과제",
    "난이도 순. 과제 1~2는 학부생, 3~4는 대학원생 수준. 과제 4는 이번 실험의 미해결 질문(다른 데이터·규칙으로의 일반화)과 연결된다.");
  const ex = [["기초", "λ 바꿔 보기", "--epochs 10으로 줄이고 weak 설정에서 λ ∈ {0.1, 1, 10}을 비교하라. λ=10에서 무엇이 일어나는가? 학습 로그의 sl, ce_f 값으로 설명하라.", HEX.neural],
    ["기초", "라벨 비율 곡선", "--label-frac을 0.05, 0.1, 0.25로 바꿔 semi 설정에서 ce_both와 ce_both_sl의 차이를 그래프로 그려라. 라벨이 많아질수록 이득은 어떻게 변하는가?", HEX.neural],
    ["심화", "새 규칙의 닫힌 형태", "\"at-most-one\" 제약(최대 하나만 참)의 log Pr를 logsumexp/softplus로 유도하고, wmc_bruteforce와 대조하는 테스트를 작성하라.", HEX.rule],
    ["심화", "다른 지식 베이스", "AwA2(동물-속성 행렬)에서 \"bat → flys\" 같은 함의 규칙을 생성해 같은 실험 틀을 적용하라. 닫힌 형태가 없으면 어떻게 계산할 것인가?", HEX.rule]];
  ex.forEach(([lv, t, d, c], i) => {
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
