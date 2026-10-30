// Unified prototype control — a floating overlay (bottom-left) that lets you
// switch V1 <-> V2, jump between profiles and open the Specifications page.
// Plain DOM appended to <body>, entirely outside the dc-runtime React root
// (#dc-root), so it never interferes with support.js. Included via <script src="./nav.js">.
(function () {
  "use strict";

  // Each role maps to its V1 and V2 file (null = doesn't exist in that version).
  var ROLES = [
    { key: "landing",    label: "Accueil",    desc: "Landing + connexion",   color: "#174a7c", v1: "SUNUSOCIAL.dc.html", v2: "SUNUSOCIAL-v2.dc.html" },
    { key: "donateur",   label: "Donateur",   desc: "Espace donateur",       color: "#174a7c", v1: "Donateur.dc.html",   v2: "Donateur-v2.dc.html" },
    { key: "structure",  label: "Structure",  desc: "Espace structure",      color: "#de7d28", v1: "Structure.dc.html",  v2: "Structure-v2.dc.html" },
    { key: "hopital",    label: "Hôpital",    desc: "Don de sang",           color: "#a03b2a", v1: null,                 v2: "Hopital-v2.dc.html" },
    { key: "moderateur", label: "Modérateur", desc: "Console de modération", color: "#529e3b", v1: "Moderateur.dc.html", v2: "Moderateur-v2.dc.html" }
  ];
  var SPECS = "Specifications.dc.html";


  // Canonical slug: lowercase and strip extensions so detection works whether
  // the host serves "Donateur-v2.dc.html", a Pretty-URL "Donateur-v2.dc", or
  // even an extensionless path.
  function canon(name) {
    return (name || "").toLowerCase().replace(/\.html?$/, "").replace(/\.dc$/, "");
  }
  var hereSlug = canon(location.pathname.split("/").pop() || "index.html");
  var isSpecs = hereSlug === canon(SPECS);
  var isV2 = /-v2$/.test(hereSlug) || isSpecs;
  var curRole = null;
  ROLES.forEach(function (r) {
    if ((r.v1 && canon(r.v1) === hereSlug) || (r.v2 && canon(r.v2) === hereSlug)) curRole = r;
  });


  function build() {
    if (document.getElementById("proto-nav")) return;

    var style = document.createElement("style");
    style.textContent = [
      "#proto-nav{position:fixed;left:20px;bottom:20px;z-index:2147483000;",
      "font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}",
      "#proto-nav *{box-sizing:border-box}",
      "#proto-nav-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;",
      "border:0;padding:12px 16px;border-radius:999px;background:#174a7c;color:#fff;",
      "font-size:14px;font-weight:600;letter-spacing:.03em;box-shadow:0 6px 20px rgba(15,36,57,.35);",
      "transition:transform .15s ease,box-shadow .15s ease}",
      "#proto-nav-toggle:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(15,36,57,.45)}",
      "#proto-nav-toggle svg{width:18px;height:18px;flex:0 0 auto}",
      "#proto-nav-toggle .vtag{background:rgba(255,255,255,.22);border-radius:6px;padding:1px 7px;font-size:12px;font-weight:700}",
      "#proto-nav-panel{position:absolute;left:0;bottom:56px;width:284px;background:#fff;",
      "border:1px solid rgba(15,36,57,.14);border-radius:12px;overflow:hidden;",
      "box-shadow:0 16px 40px rgba(15,36,57,.28);opacity:0;transform:translateY(8px) scale(.98);",
      "transform-origin:bottom left;pointer-events:none;transition:opacity .16s ease,transform .16s ease}",
      "#proto-nav.open #proto-nav-panel{opacity:1;transform:none;pointer-events:auto}",
      "#proto-nav .sec{padding:10px 14px 6px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;",
      "color:#8a94a6;font-weight:700}",
      "#proto-nav .pills{display:flex;gap:8px;padding:2px 14px 12px}",
      "#proto-nav .pill{flex:1;text-align:center;border:1.5px solid #e2e8f0;background:#fff;color:#1e293b;",
      "border-radius:10px;padding:9px 0;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;",
      "font-family:'Montserrat',system-ui,sans-serif}",
      "#proto-nav .pill small{display:block;font-family:'Inter',system-ui,sans-serif;font-weight:500;",
      "font-size:10px;letter-spacing:0;color:#8a94a6;text-transform:none}",
      "#proto-nav .pill:hover{border-color:#174a7c}",
      "#proto-nav .pill.on{background:#174a7c;border-color:#174a7c;color:#fff;cursor:default}",
      "#proto-nav .pill.on small{color:rgba(255,255,255,.75)}",
      "#proto-nav .divide{height:1px;background:rgba(15,36,57,.08)}",
      "#proto-nav a.row,#proto-nav button.row{display:flex;width:100%;text-align:left;align-items:center;gap:11px;",
      "padding:10px 14px;text-decoration:none;border:0;background:none;cursor:pointer;",
      "color:#1e293b;transition:background .12s ease;font-family:'Inter',system-ui,sans-serif}",
      "#proto-nav a.row:hover,#proto-nav button.row:hover{background:#eaf1f8}",
      "#proto-nav a.row.current{background:#f5f9fd;cursor:default}",
      "#proto-nav .dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto}",
      "#proto-nav .radio{width:16px;height:16px;border-radius:50%;border:2px solid #cbd5e1;flex:0 0 auto}",
      "#proto-nav .radio.on{border-color:#174a7c;background:radial-gradient(#174a7c 42%,#fff 46%)}",
      "#proto-nav .txt{display:flex;flex-direction:column;line-height:1.25;min-width:0}",
      "#proto-nav .txt b{font-family:'Montserrat',system-ui,sans-serif;font-weight:600;font-size:15px;letter-spacing:.01em}",
      "#proto-nav .txt span{font-size:12px;color:#8a94a6}",
      "#proto-nav .badge{margin-left:auto;font-size:10px;letter-spacing:.06em;text-transform:uppercase;",
      "color:#de7d28;font-weight:700;flex:0 0 auto}",
      "#proto-nav .rate{margin-left:auto;font-family:'Montserrat',system-ui,sans-serif;font-weight:700;font-size:13px;color:#174a7c;flex:0 0 auto}",
      "@media print{#proto-nav{display:none!important}}"
    ].join("");
    document.head.appendChild(style);

    var root = document.createElement("div");
    root.id = "proto-nav";
    var panel = document.createElement("div");
    panel.id = "proto-nav-panel";
    panel.addEventListener("click", function (e) { e.stopPropagation(); });

    // ---- Version section ----
    panel.appendChild(sec("Version"));
    var pills = document.createElement("div");
    pills.className = "pills";
    pills.appendChild(versionPill("V1", "Prototype initial", !isV2, function () {
      return curRole && curRole.v1 ? curRole.v1 : "SUNUSOCIAL.dc.html";
    }));
    pills.appendChild(versionPill("V2", "Version actuelle", isV2, function () {
      return curRole && curRole.v2 ? curRole.v2 : "SUNUSOCIAL-v2.dc.html";
    }));
    panel.appendChild(pills);
    panel.appendChild(divide());

    // ---- Profils section ----
    panel.appendChild(sec("Profils"));
    ROLES.forEach(function (r) {
      var file = isV2 ? r.v2 : r.v1;
      if (!file) return;
      panel.appendChild(roleRow(r, file));
    });
    if (isV2) panel.appendChild(specRow());

    // Payment provider is decided (NabooPay, 29/10/2026): no provider toggle any more.
    try { localStorage.removeItem("sunu_provider"); } catch (e) {}

    var toggle = document.createElement("button");
    toggle.id = "proto-nav-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Ouvrir le panneau du prototype");
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle>' +
      '<path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"></path>' +
      '</svg><span>Prototype</span><span class="vtag">' + (isV2 ? "V2" : "V1") + "</span>";
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      root.classList.toggle("open");
    });
    document.addEventListener("click", function () { root.classList.remove("open"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") root.classList.remove("open"); });

    root.appendChild(panel);
    root.appendChild(toggle);
    document.body.appendChild(root);
  }

  function sec(label) {
    var d = document.createElement("div");
    d.className = "sec";
    d.textContent = label;
    return d;
  }
  function divide() {
    var d = document.createElement("div");
    d.className = "divide";
    return d;
  }
  function versionPill(label, sub, isCurrent, targetFn) {
    var html = label + "<small>" + sub + "</small>";
    if (isCurrent) {
      var span = document.createElement("span");
      span.className = "pill on";
      span.innerHTML = html;
      return span;
    }
    var a = document.createElement("a");
    a.className = "pill";
    a.href = targetFn();
    a.innerHTML = html;
    return a;
  }
  function roleRow(r, file) {
    var isCurrent = canon(file) === hereSlug;
    var a = document.createElement("a");
    a.className = "row" + (isCurrent ? " current" : "");
    if (!isCurrent) a.href = file;
    a.innerHTML =
      '<span class="dot" style="background:' + r.color + '"></span>' +
      '<span class="txt"><b>' + r.label + "</b><span>" + r.desc + "</span></span>" +
      (isCurrent ? '<span class="badge">Ici</span>' : "");
    return a;
  }
  function specRow() {
    var isCurrent = isSpecs;
    var a = document.createElement("a");
    a.className = "row" + (isCurrent ? " current" : "");
    if (!isCurrent) a.href = SPECS;
    a.innerHTML =
      '<span class="dot" style="background:#8a94a6"></span>' +
      '<span class="txt"><b>Spécifications</b><span>Règles et décisions du projet</span></span>' +
      (isCurrent ? '<span class="badge">Ici</span>' : "");
    return a;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
