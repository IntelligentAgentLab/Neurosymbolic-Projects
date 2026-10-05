// LaTeX -> PNG (via MathJax SVG + sharp), sized in inches for a given font size in pt.
const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { SVG } = require("mathjax-full/js/output/svg.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages.js");
const sharp = require("sharp");

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document("", {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: "none" }),
});

const EX_PER_EM = 0.442; // MathJax TeX font x-height

async function tex(src, { pt = 20, color = "1F2933", display = true } = {}) {
  const node = doc.convert(src, { display, em: 16, ex: 8, containerWidth: 1280 });
  let svg = adaptor.innerHTML(node);
  const w = parseFloat(svg.match(/width="([\d.]+)ex"/)[1]);
  const h = parseFloat(svg.match(/height="([\d.]+)ex"/)[1]);
  svg = svg.replace(/currentColor/g, "#" + color);
  const inPerEx = (pt * EX_PER_EM) / 72;
  const wIn = w * inPerEx, hIn = h * inPerEx;
  const px = Math.round(wIn * 300);
  const png = await sharp(Buffer.from(svg), { density: 1200 }).resize({ width: px }).png().toBuffer();
  return { data: "image/png;base64," + png.toString("base64"), w: wIn, h: hIn };
}

module.exports = { tex };
