/* QR + UTM Studio — Deluxe ($9).
   Builds a print-shop-ready kit from the code the buyer already made in the
   free generator above: a lossless SVG, a batch of tagged codes from a pasted
   list, a logo-clearance guide computed from the buyer's own code, and a
   print-ready A4 sheet. Everything is derived from their own inputs, in their
   own browser. */
(function () {
  "use strict";

  var JB = window.JB;
  if (!JB || !JB.pro) return;
  var esc = JB.pro.escapeHtml;

  /* ============================================================
     shared field helpers — mirror the free tool's own logic exactly,
     re-implemented here because that closure is private
     ============================================================ */

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function sanitizeSlug(v) {
    return String(v || "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_.~]/g, "")
      .replace(/-+/g, "-");
  }

  function getValidUrl(raw) {
    if (!raw) return null;
    try {
      var u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u;
    } catch (e) {
      return null;
    }
  }

  /* Same shape as the free tool's buildTaggedUrl: sanitize each UTM field,
     set it on the URL if present, return the final tagged link (or null for
     an invalid destination). */
  function buildTaggedUrl(rawUrl, source, medium, campaign, term, content) {
    var u = getValidUrl(rawUrl);
    if (!u) return null;
    var s = sanitizeSlug(source);
    var m = sanitizeSlug(medium);
    var c = sanitizeSlug(campaign);
    var t = sanitizeSlug(term);
    var k = sanitizeSlug(content);
    if (s) u.searchParams.set("utm_source", s);
    if (m) u.searchParams.set("utm_medium", m);
    if (c) u.searchParams.set("utm_campaign", c);
    if (t) u.searchParams.set("utm_term", t);
    if (k) u.searchParams.set("utm_content", k);
    return u.toString();
  }

  function primaryFields() {
    return {
      destUrl: val("destUrl"),
      source: val("utmSource"),
      medium: val("utmMedium"),
      campaign: val("utmCampaign"),
      term: val("utmTerm"),
      content: val("utmContent"),
      size: parseInt(val("sizeSelect") || "512", 10) || 512,
      ec: (document.getElementById("ecSelect") && document.getElementById("ecSelect").value) || "M"
    };
  }

  function csvField(v) {
    var s = String(v === null || v === undefined ? "" : v);
    /* neutralize formula-leading cells (= + - @) so spreadsheets won't execute them */
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  /* ============================================================
     QR rendering — one matrix, three outputs (SVG string, PNG bytes,
     inline markup for the A4 sheet)
     ============================================================ */

  var QUIET_MODULES = 4; // matches the free tool's own PNG margin

  function makeQr(text, ec) {
    var qr = window.qrcode(0, ec || "M");
    qr.addData(text);
    qr.make();
    return qr;
  }

  function qrPathData(qr, quiet) {
    var n = qr.getModuleCount();
    var d = "";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += "M" + (c + quiet) + " " + (r + quiet) + "h1v1h-1z";
      }
    }
    return d;
  }

  /* Hand-written from the module matrix — one flat path, no vendor renderer.
     viewBox is in module units (data modules + a 4-module quiet zone on each
     side) so the file scales losslessly to any print size; crispEdges keeps
     every module a hard square instead of an anti-aliased blur. */
  function svgMarkup(qr) {
    var n = qr.getModuleCount();
    var size = n + QUIET_MODULES * 2;
    var d = qrPathData(qr, QUIET_MODULES);
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" ' +
      'shape-rendering="crispEdges" role="img" aria-label="QR code">' +
      '<rect x="0" y="0" width="' + size + '" height="' + size + '" fill="#ffffff"/>' +
      (d ? '<path d="' + d + '" fill="#0b0b0e"/>' : "") +
      "</svg>"
    );
  }

  function svgFile(qr) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + svgMarkup(qr) + "\n";
  }

  /* Same square/margin math as the free tool's PNG download, so a Deluxe PNG
     and a free PNG of the same code look identical at the same size. */
  function renderQrCanvas(qr, size) {
    var count = qr.getModuleCount();
    var margin = QUIET_MODULES;
    var total = count + margin * 2;
    var cell = Math.max(1, Math.floor(size / total));
    var offset = Math.floor((size - cell * count) / 2);
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#0b0b0e";
    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (qr.isDark(row, col)) ctx.fillRect(offset + col * cell, offset + row * cell, cell, cell);
      }
    }
    return canvas;
  }

  /* Real PNG bytes for the zip — decodes the canvas's own data: URL rather
     than putting a data: URL string in the archive. */
  function pngBytes(qr, size) {
    var dataUrl = renderQrCanvas(qr, size).toDataURL("image/png");
    var base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /* ============================================================
     batch mode — one destination per line, "URL | campaign name"
     ============================================================ */

  var BATCH_MAX = 100;

  function parseBatchLines(raw) {
    var lines = String(raw || "").split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var bar = line.indexOf("|");
      var urlPart = (bar === -1 ? line : line.slice(0, bar)).trim();
      var namePart = bar === -1 ? "" : line.slice(bar + 1).trim();
      if (!urlPart) continue;
      out.push({ url: urlPart, name: namePart });
    }
    return out;
  }

  /* Builds every valid line into svg/<slug>.svg + png/<slug>.png, tagged the
     same way as the single code above (same source/medium/term/content,
     campaign falls back to the campaign field when a line doesn't name one).
     Returns null when the batch box is empty, so build() can skip it. */
  function buildBatch(f) {
    var allLines = parseBatchLines(val("proBatchList"));
    if (!allLines.length) return null;

    var capped = allLines.length > BATCH_MAX;
    var lines = capped ? allLines.slice(0, BATCH_MAX) : allLines;

    var files = [];
    var csvRows = [["Slug", "Campaign", "Tagged URL"].map(csvField).join(",")];
    var used = {};
    var skipped = 0;

    lines.forEach(function (line) {
      var campaign = line.name || f.campaign;
      var tagged = buildTaggedUrl(line.url, f.source, f.medium, campaign, f.term, f.content);
      if (!tagged) {
        skipped += 1;
        return;
      }

      var baseSlug = sanitizeSlug(campaign) || "code";
      var slug = baseSlug;
      var n = 1;
      while (used[slug]) {
        n += 1;
        slug = baseSlug + "-" + n;
      }
      used[slug] = true;

      var qr = makeQr(tagged, f.ec);
      files.push({ name: "batch/svg/" + slug + ".svg", text: svgFile(qr) });
      files.push({ name: "batch/png/" + slug + ".png", bytes: pngBytes(qr, f.size) });
      csvRows.push([csvField(slug), csvField(sanitizeSlug(campaign)), csvField(tagged)].join(","));
    });

    files.push({ name: "batch/batch-index.csv", text: csvRows.join("\r\n") + "\r\n" });
    return { files: files, requested: allLines.length, built: lines.length, skipped: skipped, capped: capped };
  }

  /* ============================================================
     logo clearance guide — one printable page, built from the real code
     ============================================================ */

  /* The QR standard's own published error-correction budgets — how much of
     the code each level can reconstruct if it's damaged or covered. This
     tool doesn't invent these; they're fixed by the spec. */
  var EC_INFO = {
    L: { pct: 7, label: "L — Low" },
    M: { pct: 15, label: "M — Medium" },
    Q: { pct: 25, label: "Q — Quartile" },
    H: { pct: 30, label: "H — High" }
  };

  /* Conservative working assumption, stated plainly in the guide itself:
     spend half of the error-correction budget on the logo, keep the other
     half in reserve for the print damage and scuffing every physical code
     picks up. Not a spec value — a safety margin this tool chooses on
     purpose, and says so. */
  var LOGO_SAFETY_FACTOR = 0.5;
  var REFERENCE_SIZES_MM = [30, 50];

  function clearanceRow(taggedUrl, level) {
    var info = EC_INFO[level];
    var qr = makeQr(taggedUrl, level);
    var n = qr.getModuleCount();
    var totalModules = n + QUIET_MODULES * 2; // matches the quiet zone baked into this kit's SVG/PNG
    var safeAreaFraction = (info.pct / 100) * LOGO_SAFETY_FACTOR;
    var sideModules = Math.max(0, Math.floor(Math.sqrt(safeAreaFraction) * n));
    var mm = REFERENCE_SIZES_MM.map(function (printMm) {
      var mmPerModule = printMm / totalModules;
      return (sideModules * mmPerModule).toFixed(1);
    });
    return {
      level: level,
      label: info.label,
      pct: info.pct,
      dataModules: n,
      sideModules: sideModules,
      mm: mm
    };
  }

  function clearanceHtml(f, taggedUrl) {
    var rows = ["L", "M", "Q", "H"].map(function (lv) { return clearanceRow(taggedUrl, lv); });

    var body =
      "<h2>Safe centered-logo clearance, by error-correction level</h2>" +
      "<p>Computed from your actual code — <code>" + esc(taggedUrl) + "</code>.</p>" +
      "<table><thead><tr><th>Level</th><th class=\"num\">Recoverable</th>" +
      "<th class=\"num\">Code size</th><th class=\"num\">Safe logo square</th>" +
      "<th class=\"num\">at " + REFERENCE_SIZES_MM[0] + "mm print</th>" +
      "<th class=\"num\">at " + REFERENCE_SIZES_MM[1] + "mm print</th></tr></thead><tbody>" +
      rows.map(function (r) {
        return (
          "<tr><td>" + esc(r.label) + "</td>" +
          "<td class=\"num\">" + r.pct + "%</td>" +
          "<td class=\"num\">" + r.dataModules + "&times;" + r.dataModules + " modules</td>" +
          "<td class=\"num\">" + r.sideModules + "&times;" + r.sideModules + " modules</td>" +
          "<td class=\"num\">" + r.mm[0] + "mm &times; " + r.mm[0] + "mm</td>" +
          "<td class=\"num\">" + r.mm[1] + "mm &times; " + r.mm[1] + "mm</td></tr>"
        );
      }).join("") +
      "</tbody></table>" +

      "<h2>How this is worked out</h2>" +
      "<p>Each error-correction level can reconstruct a fixed share of damaged or covered modules — " +
      "L up to 7%, M up to 15%, Q up to 25%, H up to 30%. That is the QR standard's published " +
      "error-correction budget, not a figure this tool invents.</p>" +
      "<p>A centered logo is deliberate damage: it permanently covers modules, spending part of that " +
      "budget. The table above spends <strong>half</strong> of the available budget on the logo and holds " +
      "the other half in reserve for the print damage, ink bleed, and scuffing a physical code picks up " +
      "over time. That is a conservative working limit, not a guarantee — start there, then test.</p>" +

      "<h2>What the millimetre figures assume</h2>" +
      "<p>The mm columns assume you print the whole code — including its quiet zone, the blank border " +
      "already baked into the SVG and PNG in this kit — at the stated size. General formula for any other " +
      "print size: safe logo side (mm) = safe logo side in modules &times; (your print size in mm &divide; " +
      "total modules, counting the code plus its " + QUIET_MODULES + "-module quiet zone on each side).</p>" +

      "<h2>What this does not replace</h2>" +
      "<p>Test-scan the finished code — with the logo placed, at the real print size, on the real paper " +
      "or material — before it goes out. Try more than one phone and scanning app. If it doesn't scan " +
      "cleanly, shrink the logo or move up an error-correction level and rebuild the code.</p>";

    return JB.pro.reportHtml({
      kicker: "QR + UTM Deluxe",
      title: "Logo clearance guide — " + (f.campaign || "your code"),
      lede: "How much of the center your logo can safely cover, at each error-correction level.",
      body: body
    });
  }

  /* ============================================================
     print-ready A4 sheet — several copies of the one code, cut guides
     ============================================================ */

  function a4SheetHtml(f, taggedUrl) {
    var qr = makeQr(taggedUrl, f.ec);
    var svg = svgMarkup(qr);
    var cols = 3;
    var rows = 4;
    var count = cols * rows;
    var cellMm = 40;

    var cell =
      '<div class="cut-cell"><div class="code-box">' + svg + "</div>" +
      '<div class="cap"><strong>' + esc(f.campaign || "untitled") + "</strong><br>" +
      esc(taggedUrl) + "</div></div>";

    var grid = "";
    for (var i = 0; i < count; i++) grid += cell;

    var css =
      "@page { size: A4; margin: 12mm; }" +
      'body { margin:0; font:11px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; color:#111; background:#fff; }' +
      ".no-print { margin: 0 0 8mm; font-size: 11px; color:#555; }" +
      ".grid { display:grid; grid-template-columns: repeat(" + cols + ", 1fr); gap: 6mm; }" +
      ".cut-cell { border: 1px dashed #999; padding: 4mm; text-align:center; break-inside: avoid; }" +
      ".code-box { width:" + cellMm + "mm; height:" + cellMm + "mm; margin:0 auto 3mm; }" +
      ".code-box svg { width:100%; height:100%; display:block; }" +
      ".cap { font-size:8.5px; line-height:1.4; word-break:break-all; color:#333; }" +
      ".cap strong { display:block; font-size:9.5px; color:#000; }" +
      "@media print { .no-print { display:none; } }";

    var body =
      '<div class="no-print">Print-ready A4 sheet — ' + count + " copies of one code, dashed lines mark " +
      "where to cut. Print at 100% scale (not “fit to page”) for the code to come out at " + cellMm +
      "mm.</div>" +
      '<div class="grid">' + grid + "</div>";

    return (
      "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n" +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<meta name="robots" content="noindex">\n' +
      "<title>A4 print sheet — " + esc(f.campaign || "QR code") + "</title>\n" +
      "<style>" + css + "</style>\n</head>\n<body>\n" + body + "\n</body>\n</html>\n"
    );
  }

  /* ============================================================
     README
     ============================================================ */

  function readmeTxt(f, slug, batch) {
    var lines = [
      "QR + UTM Studio — Deluxe Kit — " + (f.campaign || "your code"),
      "Built " + new Date().toLocaleString(),
      "",
      "  " + slug + ".svg                  Vector QR code. Opens in Illustrator/Inkscape and scales to any",
      "                             size with no quality loss — hand this to a print shop.",
      "  " + slug + "-" + f.size + "px.png       Raster QR code at the size you had selected on the page.",
      "  clearance-guide.html        Printable guide: how big a centered logo can safely be at each",
      "                             error-correction level, computed from this code. Print it for a PDF.",
      "  a4-print-sheet.html         Several copies of this code with cut guides and captions, sized for",
      "                             A4. Open in a browser and print at 100% scale.",
      batch ? "  batch/svg/*.svg              One vector code per destination you pasted into the batch box," : null,
      batch ? "  batch/png/*.png              tagged with the source, medium, and campaign the same way as" : null,
      batch ? "                             the code above." : null,
      batch ? "  batch/batch-index.csv        Maps each batch file name to its campaign and full tagged URL." : null,
      "",
      "Everything here was generated in your browser from what you typed into the free QR + UTM Studio",
      "tool. Nothing was uploaded anywhere.",
      "",
      "Questions: contact@nymrel.com",
      ""
    ];
    return lines.filter(function (l) { return l !== null; }).join("\n");
  }

  /* ============================================================
     registration
     ============================================================ */

  JB.pro.register("qr-deluxe", {
    label: "Deluxe Kit",
    filenameLabel: "your files",
    summary: "Vector, batch, clearance guide, and print sheet, all built from the code above.",
    contents: [
      "SVG vector export — scales losslessly to any size, ready for a print shop",
      "Batch mode — paste a list of destinations below, get a tagged code for each one",
      "Logo clearance guide — safe centered-logo size at every error-correction level, computed from your code",
      "Print-ready A4 sheet — several copies with cut guides, ready to print at 100% scale",
      "README.txt — what each file is and how to use it"
    ],
    extraHtml:
      '<label for="proBatchList">Batch destinations (optional) — one per line: URL or URL | campaign name</label>' +
      '<textarea id="proBatchList" rows="7" placeholder="https://example.com/menu | Flyer Drop 1' +
      "\nhttps://example.com/specials | Table Tents" +
      '"></textarea>' +
      '<p class="pro-note" style="margin:.5rem 0 0">Up to ' + BATCH_MAX + " lines. Leave this blank to just get the single code above as SVG + PNG. " +
      "Each line reuses the source and medium fields above; add its own campaign name after a <code>|</code>, or it falls back to the campaign field.</p>",
    ready: function () {
      if (typeof window.qrcode !== "function") {
        return "The QR engine did not load — refresh the page and try again.";
      }
      var f = primaryFields();
      if (!getValidUrl(f.destUrl)) return "Enter a destination URL above first (with https://).";
      if (!sanitizeSlug(f.source)) return "Fill in the source field above first.";
      if (!sanitizeSlug(f.medium)) return "Fill in the medium field above first.";
      if (!sanitizeSlug(f.campaign)) return "Fill in the campaign field above first.";
      return "";
    },
    build: function () {
      /* Deferred a tick so the button's "Building…" state paints before the
         (occasionally heavy, for a full batch) synchronous QR work runs. */
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          try {
            var f = primaryFields();
            var taggedUrl = buildTaggedUrl(f.destUrl, f.source, f.medium, f.campaign, f.term, f.content);
            if (!taggedUrl) throw new Error("that destination URL isn't valid");

            var qr = makeQr(taggedUrl, f.ec);
            var slug = sanitizeSlug(f.campaign) || "qr-code";

            var files = [
              { name: slug + ".svg", text: svgFile(qr) },
              { name: slug + "-" + f.size + "px.png", bytes: pngBytes(qr, f.size) },
              { name: "clearance-guide.html", text: clearanceHtml(f, taggedUrl) },
              { name: "a4-print-sheet.html", text: a4SheetHtml(f, taggedUrl) }
            ];

            var batch = buildBatch(f);
            var notes = [];
            if (batch) {
              files = files.concat(batch.files);
              if (batch.skipped) notes.push(batch.skipped + " batch line(s) skipped (need a valid https:// URL)");
              if (batch.capped) notes.push("batch capped at " + BATCH_MAX + " lines");
            }

            files.push({ name: "README.txt", text: readmeTxt(f, slug, !!batch) });

            resolve({
              filename: "qr-deluxe-" + slug + ".zip",
              toast: notes.length ? "Deluxe Kit downloaded — " + notes.join("; ") : "Deluxe Kit downloaded — start with README.txt",
              files: files
            });
          } catch (err) {
            reject(err);
          }
        }, 10);
      });
    }
  });
})();
