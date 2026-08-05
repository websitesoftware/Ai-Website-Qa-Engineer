(function () {
  "use strict";

  const CATEGORY_LABELS = {
    "app-router": "App Router",
    component: "Components",
    context: "Context",
    hook: "Hooks",
    lib: "Lib",
    screen: "Screens",
    config: "Config",
    entrypoint: "Entrypoint",
    controller: "Controllers",
    route: "Routes",
    service: "Services",
    repository: "Repositories",
    model: "Models",
    middleware: "Middleware",
    util: "Utils",
    socket: "Sockets",
  };

  const FRONTEND_ORDER = ["screen", "component", "app-router", "context", "hook", "lib", "config"];
  const BACKEND_ORDER = [
    "entrypoint",
    "route",
    "controller",
    "service",
    "repository",
    "model",
    "middleware",
    "util",
    "socket",
    "config",
  ];

  const main = document.getElementById("main");
  const navEl = document.getElementById("nav");
  const searchInput = document.getElementById("search");
  const themeToggle = document.getElementById("theme-toggle");

  let DATA = null;
  let currentRoute = { type: "overview" };

  // ---------- theme ----------
  function initTheme() {
    const saved = localStorage.getItem("qa-docs-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }
  themeToggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("qa-docs-theme", next);
  });
  initTheme();

  // ---------- data load ----------
  fetch("/api/data")
    .then((r) => r.json())
    .then((data) => {
      DATA = data;
      renderNav();
      renderOverview();
    })
    .catch(() => {
      main.innerHTML = '<p class="empty-state">Could not load docs/data.json. Run "npm run docs:build" first.</p>';
    });

  function groupByCategory(files, order) {
    const groups = {};
    for (const f of files) {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    }
    const orderedKeys = order.filter((k) => groups[k]).concat(Object.keys(groups).filter((k) => !order.includes(k)));
    return orderedKeys.map((k) => ({ category: k, files: groups[k].sort((a, b) => a.path.localeCompare(b.path)) }));
  }

  function renderNav() {
    const feGroups = groupByCategory(DATA.frontendFiles, FRONTEND_ORDER);
    const beGroups = groupByCategory(DATA.backendFiles, BACKEND_ORDER);

    let html = `
      <button class="nav-link" data-route="overview">Overview</button>
      <div class="nav-group">
        <div class="nav-heading">Frontend</div>
        ${feGroups
          .map(
            (g) =>
              `<button class="nav-link" data-route="cat" data-side="frontend" data-cat="${g.category}">
                <span>${CATEGORY_LABELS[g.category] || g.category}</span><span class="nav-count">${g.files.length}</span>
              </button>`,
          )
          .join("")}
      </div>
      <div class="nav-group">
        <div class="nav-heading">Backend</div>
        ${beGroups
          .map(
            (g) =>
              `<button class="nav-link" data-route="cat" data-side="backend" data-cat="${g.category}">
                <span>${CATEGORY_LABELS[g.category] || g.category}</span><span class="nav-count">${g.files.length}</span>
              </button>`,
          )
          .join("")}
      </div>
    `;
    navEl.innerHTML = html;

    navEl.querySelectorAll(".nav-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        searchInput.value = "";
        if (btn.dataset.route === "overview") {
          currentRoute = { type: "overview" };
          renderOverview();
        } else {
          currentRoute = { type: "cat", side: btn.dataset.side, cat: btn.dataset.cat };
          renderCategory(currentRoute.side, currentRoute.cat);
        }
        setActiveNav(btn);
      });
    });
  }

  function setActiveNav(activeBtn) {
    navEl.querySelectorAll(".nav-link").forEach((b) => b.classList.remove("active"));
    if (activeBtn) activeBtn.classList.add("active");
  }

  // ---------- overview ----------
  function renderOverview() {
    const s = DATA.stats;
    const fe = DATA.tech.frontend;
    const be = DATA.tech.backend;

    main.innerHTML = `
      <span class="eyebrow">Local reference · generated ${new Date(DATA.generatedAt).toLocaleString()}</span>
      <h1>AI Website QA Engineer</h1>
      <p class="lede">A self-hosted tool that crawls a live website, runs a full QA sweep — links, responsiveness,
        performance, accessibility, SEO, visual regression — scores it, and uses an LLM to explain, fix, and ship
        patches for what it finds. This page documents every file in the repo.</p>

      <div class="stat-row">
        <div class="stat"><div class="stat-label">Frontend files</div><div class="stat-value">${s.frontendFileCount}</div></div>
        <div class="stat"><div class="stat-label">Backend files</div><div class="stat-value">${s.backendFileCount}</div></div>
        <div class="stat"><div class="stat-label">Total lines documented</div><div class="stat-value">${s.totalLines.toLocaleString()}</div></div>
        <div class="stat"><div class="stat-label">Frontend stack</div><div class="stat-value">Next.js · React · TS</div></div>
        <div class="stat"><div class="stat-label">Backend stack</div><div class="stat-value">Node.js · Express</div></div>
      </div>

      <div class="section-heading"><span class="section-num">01</span><h2>Tech stack</h2></div>
      <p class="section-desc">Dependency lists read directly from each app's package.json.</p>
      <div class="tech-grid">
        ${techCard("Frontend", fe.name, fe.dependencies)}
        ${techCard("Backend", be.name, be.dependencies)}
        ${techCard("Frontend dev deps", fe.name, fe.devDependencies)}
        ${techCard("Backend dev deps", be.name, be.devDependencies)}
      </div>

      <div class="section-heading"><span class="section-num">02</span><h2>Browse the code</h2></div>
      <p class="section-desc">Pick a category from the sidebar, or search by file path, description, or export name.</p>

      <div class="section-heading"><span class="section-num">03</span><h2>How it works</h2></div>
      <p class="section-desc">The two real pipelines behind the product, in the order the code actually runs them.</p>
      ${flowRow("Scan pipeline", "scanEngine.service.js runScan()", SCAN_FLOW)}
      ${flowRow("AI Automation pipeline", "aiAutomation.service.js runAutomation() / createPullRequest()", AUTOMATION_FLOW)}
    `;
  }

  const SCAN_FLOW = [
    { label: "Crawl site", file: "crawler.service.js" },
    { label: "Check links", file: "linkChecker.service.js" },
    { label: "Responsive check", file: "responsive.service.js" },
    { label: "Console errors", file: "consoleError.service.js" },
    { label: "Lighthouse audit", file: "lighthouse.service.js" },
    { label: "Accessibility (axe)", file: "accessibility.service.js" },
    { label: "SEO audit", file: "seo.service.js" },
    { label: "Visual regression", file: "visualRegression.service.js" },
    { label: "Cross-browser", file: "crossBrowser.service.js" },
    { label: "Performance bench", file: "performanceBenchmark.service.js" },
    { label: "Aggregate & score", file: "scanEngine.service.js" },
  ];

  const AUTOMATION_FLOW = [
    { label: "Prioritize issues", file: "buildPrioritization()" },
    { label: "Locate in repo", file: "fileLocator.service.js" },
    { label: "Generate patch", file: "buildGroundedPatch()" },
    { label: "Release notes", file: "buildReleaseNotes()" },
    { label: "Open PR", file: "github.service.js" },
    { label: "CI/CD gate", file: "runCicd()" },
    { label: "Re-scan & verify", file: "verifyResolution()" },
  ];

  function flowRow(title, sub, steps) {
    return `
      <div class="flow-row">
        <div class="flow-row-label">
          <div class="flow-title">${escapeHtml(title)}</div>
          <div class="flow-sub">${escapeHtml(sub)}</div>
        </div>
        <div class="flow-steps">
          ${steps
            .map(
              (s, i) => `
                <div class="flow-step">
                  <div class="flow-step-index">${i + 1}</div>
                  <div class="flow-step-label">${escapeHtml(s.label)}</div>
                  <div class="flow-step-file">${escapeHtml(s.file)}</div>
                </div>
                ${i < steps.length - 1 ? '<div class="flow-arrow">›</div>' : ""}
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function techCard(title, sub, deps) {
    if (!deps || !deps.length) return "";
    return `
      <div class="tech-card">
        <h3>${title}</h3>
        <div class="tech-sub">${sub || ""}</div>
        <div class="tag-wrap">${deps.map((d) => `<span class="tag">${d}</span>`).join("")}</div>
      </div>
    `;
  }

  // ---------- category / file list ----------
  function renderCategory(side, cat) {
    const files = (side === "frontend" ? DATA.frontendFiles : DATA.backendFiles)
      .filter((f) => f.category === cat)
      .sort((a, b) => a.path.localeCompare(b.path));

    main.innerHTML = `
      <span class="eyebrow">${side === "frontend" ? "Frontend" : "Backend"}</span>
      <h1>${CATEGORY_LABELS[cat] || cat}</h1>
      <p class="lede">${files.length} file${files.length === 1 ? "" : "s"}.</p>
      <div class="file-list">${files.map(fileCardHtml).join("")}</div>
    `;
    wireFileCards();
  }

  function renderSearchResults(query) {
    const q = query.toLowerCase();
    const all = [...DATA.frontendFiles, ...DATA.backendFiles];
    const matches = all.filter((f) => {
      return (
        f.path.toLowerCase().includes(q) ||
        (f.description || "").toLowerCase().includes(q) ||
        (f.exports || []).some((e) => e.toLowerCase().includes(q))
      );
    });

    main.innerHTML = `
      <span class="eyebrow">Search</span>
      <h1>“${escapeHtml(query)}”</h1>
      <p class="lede">${matches.length} match${matches.length === 1 ? "" : "es"}.</p>
      <div class="file-list">${
        matches.length ? matches.map(fileCardHtml).join("") : '<p class="empty-state">No files match that search.</p>'
      }</div>
    `;
    wireFileCards();
    setActiveNav(null);
  }

  function fileCardHtml(f) {
    return `
      <div class="file-card" data-path="${escapeHtml(f.path)}">
        <div class="file-card-head">
          <span class="chevron">▶</span>
          <span class="file-path">${escapeHtml(f.path)}</span>
          <span class="file-lines">${f.lines || 0} ln</span>
          <span class="file-cat-tag">${CATEGORY_LABELS[f.category] || f.category}</span>
        </div>
        <div class="file-card-body">
          <p class="file-desc" ${f.descriptionFull ? `data-short="${escapeHtml(f.description || "")}" data-full="${escapeHtml(f.descriptionFull)}"` : ""}>${escapeHtml(f.description || "")}${
            f.descriptionFull ? ` <button class="more-toggle" type="button">more</button>` : ""
          }</p>
          ${
            f.exports && f.exports.length
              ? `<div class="exports-row">${f.exports.map((e) => `<span class="export-tag">${escapeHtml(e)}</span>`).join("")}</div>`
              : ""
          }
          <button class="source-toggle" type="button">View source</button>
          <div class="source-wrap" hidden></div>
        </div>
      </div>
    `;
  }

  function wireFileCards() {
    document.querySelectorAll(".file-card").forEach((card) => {
      const head = card.querySelector(".file-card-head");
      head.addEventListener("click", () => card.classList.toggle("open"));

      const srcBtn = card.querySelector(".source-toggle");
      srcBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        loadSource(card, srcBtn);
      });

      const moreBtn = card.querySelector(".more-toggle");
      if (moreBtn) {
        moreBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const p = card.querySelector(".file-desc");
          const showingFull = moreBtn.textContent === "less";
          p.firstChild.textContent = showingFull ? p.dataset.short : p.dataset.full;
          moreBtn.textContent = showingFull ? "more" : "less";
        });
      }
    });
  }

  function loadSource(card, btn) {
    const wrap = card.querySelector(".source-wrap");
    if (!wrap.hidden) {
      wrap.hidden = true;
      btn.textContent = "View source";
      return;
    }
    wrap.hidden = false;
    btn.textContent = "Hide source";
    if (wrap.dataset.loaded) return;

    wrap.innerHTML = '<div class="source-loading">Loading…</div>';
    fetch(`/api/source?path=${encodeURIComponent(card.dataset.path)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          wrap.innerHTML = `<div class="source-error">${escapeHtml(json.error)}</div>`;
          return;
        }
        wrap.dataset.loaded = "1";
        wrap.innerHTML = `<pre><code>${escapeHtml(json.content)}</code></pre>`;
      })
      .catch(() => {
        wrap.innerHTML = '<div class="source-error">Could not load file.</div>';
      });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- search ----------
  let searchDebounce;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      const q = searchInput.value.trim();
      if (!DATA) return;
      if (!q) {
        currentRoute = { type: "overview" };
        renderOverview();
        setActiveNav(navEl.querySelector('[data-route="overview"]'));
        return;
      }
      renderSearchResults(q);
    }, 120);
  });
})();
