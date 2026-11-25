(function () {
  const data = window.SGC_DATA || { documentos: [], hallazgos: [] };
  const docs = data.documentos || [];
  const findings = data.hallazgos || [];

  const state = {
    search: "",
    category: "ALL",
    sector: "",
    year: "",
    sort: "codigo_asc",
    view: "cards"
  };

  const el = {
    kpis: document.getElementById("kpisSection"),
    search: document.getElementById("searchInput"),
    clearBtn: document.getElementById("btnClearFilters"),
    categoryChips: document.getElementById("categoryChips"),
    sectorFilter: document.getElementById("sectorFilter"),
    yearFilter: document.getElementById("yearFilter"),
    sortSelect: document.getElementById("sortSelect"),
    resultsCount: document.getElementById("resultsCount"),
    docsContainer: document.getElementById("docsContainer"),
    viewCards: document.getElementById("viewCards"),
    viewTable: document.getElementById("viewTable"),
    countAll: document.getElementById("countAll"),
    countHaccp: document.getElementById("countHaccp"),
    countPe: document.getElementById("countPe"),
    countReg: document.getElementById("countReg"),
    auditSection: document.getElementById("auditSection"),
    auditList: document.getElementById("auditList"),
    btnToggleAudit: document.getElementById("btnToggleAudit"),
    btnCloseAudit: document.getElementById("btnCloseAudit"),
    btnExportJson: document.getElementById("btnExportJson"),
    btnPrint: document.getElementById("btnPrint"),
    modal: document.getElementById("detailModal"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    btnCloseModal: document.getElementById("btnCloseModal"),
    modalBadge: document.getElementById("modalBadge"),
    modalTitle: document.getElementById("modalTitle"),
    modalSubtitle: document.getElementById("modalSubtitle"),
    modalBody: document.getElementById("modalBody")
  };

  function initCounts() {
    el.countAll.textContent = docs.length;
    el.countHaccp.textContent = docs.filter(d => d.categoria === "HACCP").length;
    el.countPe.textContent = docs.filter(d => d.categoria === "PE").length;
    el.countReg.textContent = docs.filter(d => d.categoria === "Registro").length;

    const withObs = docs.filter(d => d.observaciones_auditoria && d.observaciones_auditoria.length > 0).length;
    const rev2026 = docs.filter(d => String(d.vigencia).startsWith("2026")).length;

    el.kpis.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Total Documentos</div>
        <div class="kpi-value">${docs.length}</div>
        <div class="kpi-sub">HACCP, PE y Registros R</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Procedimientos (PE)</div>
        <div class="kpi-value">${docs.filter(d => d.categoria === "PE").length}</div>
        <div class="kpi-sub">PE-01 a PE-23</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Registros / Listados</div>
        <div class="kpi-value">${docs.filter(d => d.categoria === "Registro").length}</div>
        <div class="kpi-sub">R-02 a R-28.1</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Vigencias 2026</div>
        <div class="kpi-value">${rev2026}</div>
        <div class="kpi-sub">${withObs} docs con notas de revisión</div>
      </div>
    `;

    const sectors = new Set();
    docs.forEach(d => (d.sectores || []).forEach(s => {
      if (s && s !== "N/A") sectors.add(s);
    }));
    Array.from(sectors).sort((a, b) => a.localeCompare(b, "es")).forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      el.sectorFilter.appendChild(opt);
    });
  }

  function renderAudit() {
    el.auditList.innerHTML = findings.map(f => `
      <article class="audit-card">
        <div class="audit-card-top">
          <strong>${f.codigo}</strong>
          <span class="sev sev-${f.severidad}">${f.severidad}</span>
        </div>
        <h3>${f.titulo}</h3>
        <p>${f.detalle}</p>
        <div class="doc-tags">
          ${(f.documentos || []).map(code => `<span class="mini-tag">${code}</span>`).join("")}
        </div>
      </article>
    `).join("");
  }

  function matchesFilters(d) {
    if (state.category !== "ALL" && d.categoria !== state.category) return false;

    if (state.sector) {
      const hasSector = (d.sectores || []).some(s => s.toLowerCase() === state.sector.toLowerCase());
      if (!hasSector) return false;
    }

    if (state.year) {
      if (state.year === "N/D") {
        if (d.vigencia !== "N/D" && d.vigencia !== "Vigente") return false;
      } else if (!String(d.vigencia).startsWith(state.year)) {
        return false;
      }
    }

    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      const haystack = [
        d.codigo,
        d.titulo,
        d.categoria,
        d.subcategoria,
        d.vigencia,
        d.archivo_original,
        ...(d.sectores || []),
        ...(d.responsables || []),
        ...(d.registros_asociados || []),
        ...(d.parametros_clave || []),
        ...(d.observaciones_auditoria || [])
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  }

  function sortDocs(list) {
    const copy = [...list];
    if (state.sort === "codigo_asc") {
      return copy.sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
    }
    if (state.sort === "titulo_asc") {
      return copy.sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
    }
    if (state.sort === "vigencia_desc") {
      return copy.sort((a, b) => String(b.vigencia).localeCompare(String(a.vigencia)));
    }
    if (state.sort === "vigencia_asc") {
      return copy.sort((a, b) => String(a.vigencia).localeCompare(String(b.vigencia)));
    }
    return copy;
  }

  function renderDocs() {
    const filtered = sortDocs(docs.filter(matchesFilters));
    el.resultsCount.textContent = `Mostrando ${filtered.length} de ${docs.length} documentos`;

    if (filtered.length === 0) {
      el.docsContainer.className = "cards-grid";
      el.docsContainer.innerHTML = `<div class="kpi-card" style="grid-column:1/-1;">No se encontraron documentos con los filtros seleccionados.</div>`;
      return;
    }

    if (state.view === "table") {
      el.docsContainer.className = "table-wrap";
      el.docsContainer.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Documento</th>
              <th>Tipo</th>
              <th>Rev.</th>
              <th>Vigencia</th>
              <th>Registros / Vínculos</th>
              <th>Revisión</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(d => `
              <tr class="clickable-row" data-id="${d.id}">
                <td><strong>${d.codigo}</strong></td>
                <td>${d.titulo}</td>
                <td><span class="badge badge-${d.categoria}">${d.categoria}</span></td>
                <td>${d.revision}</td>
                <td>${d.vigencia}</td>
                <td>${(d.registros_asociados || []).join(", ") || "—"}</td>
                <td>${(d.observaciones_auditoria && d.observaciones_auditoria.length) ? `<span class="obs-indicator">${d.observaciones_auditoria.length} nota(s)</span>` : "OK"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
      el.docsContainer.querySelectorAll("tr.clickable-row").forEach(tr => {
        tr.addEventListener("click", () => openModal(tr.dataset.id));
      });
      return;
    }

    el.docsContainer.className = "cards-grid";
    el.docsContainer.innerHTML = filtered.map(d => {
      const obsCount = (d.observaciones_auditoria || []).length;
      const paramsHtml = (d.parametros_clave || []).slice(0, 3).map(p => `<li>${p}</li>`).join("");
      return `
        <article class="doc-card" data-id="${d.id}">
          <div>
            <div class="doc-card-head">
              <span class="code-pill">${d.codigo}</span>
              <span class="badge badge-${d.categoria}">${d.categoria}</span>
            </div>
            <h3 class="doc-title">${d.titulo}</h3>
            <div class="doc-meta">Rev. ${d.revision} · Vigencia: ${d.vigencia}</div>
            <ul class="doc-params">${paramsHtml}</ul>
          </div>
          <div class="doc-card-foot">
            <span>Vínculos: ${(d.registros_asociados || []).slice(0, 4).join(", ") || "—"}</span>
            ${obsCount ? `<span class="obs-indicator">${obsCount} nota(s)</span>` : `<span>Ver detalle →</span>`}
          </div>
        </article>
      `;
    }).join("");

    el.docsContainer.querySelectorAll(".doc-card").forEach(card => {
      card.addEventListener("click", () => openModal(card.dataset.id));
    });
  }

  function openModal(id) {
    const d = docs.find(item => item.id === id);
    if (!d) return;

    el.modalBadge.className = `badge badge-${d.categoria}`;
    el.modalBadge.textContent = `${d.categoria} · ${d.subcategoria || ""}`;
    el.modalTitle.textContent = `${d.codigo} — ${d.titulo}`;
    el.modalSubtitle.textContent = `Archivo base: ${d.archivo_original || d.codigo}`;

    const obsHtml = (d.observaciones_auditoria && d.observaciones_auditoria.length)
      ? `<div class="detail-block">
           <h3>Puntos de Revisión / Auditoría</h3>
           <div class="obs-box">
             <ul>${d.observaciones_auditoria.map(o => `<li>${o}</li>`).join("")}</ul>
           </div>
         </div>`
      : "";

    el.modalBody.innerHTML = `
      <div class="detail-block">
        <div class="detail-grid">
          <div><strong>Código:</strong><br>${d.codigo}</div>
          <div><strong>Revisión:</strong><br>${d.revision}</div>
          <div><strong>Vigencia:</strong><br>${d.vigencia}</div>
          <div><strong>Registros / Vínculos:</strong><br>${(d.registros_asociados || []).join(", ") || "N/A"}</div>
        </div>
      </div>

      <div class="detail-block">
        <h3>Sectores</h3>
        <div class="doc-tags">${(d.sectores || []).map(s => `<span class="mini-tag">${s}</span>`).join("")}</div>
      </div>

      <div class="detail-block">
        <h3>Responsables</h3>
        <div class="doc-tags">${(d.responsables || []).map(r => `<span class="mini-tag">${r}</span>`).join("")}</div>
      </div>

      <div class="detail-block">
        <h3>Parámetros y Lineamientos Clave</h3>
        <ul class="doc-params">${(d.parametros_clave || []).map(p => `<li>${p}</li>`).join("")}</ul>
      </div>

      ${obsHtml}
    `;

    el.modal.classList.remove("hidden");
  }

  function closeModal() {
    el.modal.classList.add("hidden");
  }

  el.search.addEventListener("input", e => {
    state.search = e.target.value;
    renderDocs();
  });

  el.clearBtn.addEventListener("click", () => {
    state.search = "";
    state.category = "ALL";
    state.sector = "";
    state.year = "";
    state.sort = "codigo_asc";
    el.search.value = "";
    el.sectorFilter.value = "";
    el.yearFilter.value = "";
    el.sortSelect.value = "codigo_asc";
    el.categoryChips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.category === "ALL"));
    renderDocs();
  });

  el.categoryChips.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.category;
    el.categoryChips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === chip));
    renderDocs();
  });

  el.sectorFilter.addEventListener("change", e => {
    state.sector = e.target.value;
    renderDocs();
  });

  el.yearFilter.addEventListener("change", e => {
    state.year = e.target.value;
    renderDocs();
  });

  el.sortSelect.addEventListener("change", e => {
    state.sort = e.target.value;
    renderDocs();
  });

  el.viewCards.addEventListener("click", () => {
    state.view = "cards";
    el.viewCards.classList.add("active");
    el.viewTable.classList.remove("active");
    renderDocs();
  });

  el.viewTable.addEventListener("click", () => {
    state.view = "table";
    el.viewTable.classList.add("active");
    el.viewCards.classList.remove("active");
    renderDocs();
  });

  el.btnToggleAudit.addEventListener("click", () => el.auditSection.classList.toggle("hidden"));
  el.btnCloseAudit.addEventListener("click", () => el.auditSection.classList.add("hidden"));

  el.btnExportJson.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ filtered_count: docs.filter(matchesFilters).length, documentos: docs.filter(matchesFilters) }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agrotres-sgc-filtrado.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  el.btnPrint.addEventListener("click", () => window.print());

  el.btnCloseModal.addEventListener("click", closeModal);
  el.modalBackdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
  });

  initCounts();
  renderAudit();
  renderDocs();
})();
