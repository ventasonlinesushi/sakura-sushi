/* ============================================================
   Vistas emergentes: selección de variante y paquetes de rollos.
   ============================================================ */
(function (global) {
  "use strict";

  class SheetView {
    constructor(deps) {
      this.currency = deps.currency;
      this.pkg = deps.pkgVM;
      this.e = {
        sheet: null, sheetName: null, sheetDesc: null, sheetOptions: null,
        pkgSheet: null, pkgTitle: null, pkgDesc: null, pkgOptions: null,
        pkgCount: null, pkgAdd: null
      };
      this.selectedVariant = null;
      this.pendingProduct = null;
      this.pkgSelected = [];
      this.pendingPkg = null;
      this.hooks = {
        onVariantConfirm: null,  // (ci, ii, item, variant)
        onPkgConfirm: null       // (ci, ii, item, selected)
      };
    }

    cache() {
      this.e.sheet = document.getElementById("sheet");
      this.e.sheetName = document.getElementById("sheetName");
      this.e.sheetDesc = document.getElementById("sheetDesc");
      this.e.sheetOptions = document.getElementById("sheetOptions");
      this.e.pkgSheet = document.getElementById("pkgSheet");
      this.e.pkgTitle = document.getElementById("pkgTitle");
      this.e.pkgDesc = document.getElementById("pkgDesc");
      this.e.pkgOptions = document.getElementById("pkgOptions");
      this.e.pkgCount = document.getElementById("pkgCount");
      this.e.pkgAdd = document.getElementById("pkgAdd");
    }

    /* ---------- Variante ---------- */
    openVariant(ci, ii, item) {
      this.selectedVariant = null;
      this.pendingProduct = { ci, ii, item };
      this.e.sheetName.textContent = item.name;
      this.e.sheetDesc.textContent = item.desc || "";
      this.e.sheetOptions.innerHTML = "";
      item.variants.forEach(v => {
        const opt = document.createElement("div");
        opt.className = "variant-opt";
        const s1 = document.createElement("span");
        s1.textContent = v.label;
        const s2 = document.createElement("span");
        s2.textContent = this.currency.format(v.price);
        opt.appendChild(s1); opt.appendChild(s2);
        opt.onclick = () => {
          this.selectedVariant = v;
          this.e.sheetOptions.querySelectorAll(".variant-opt").forEach(o => o.classList.remove("active"));
          opt.classList.add("active");
        };
        this.e.sheetOptions.appendChild(opt);
      });
      this._show(this.e.sheet);
    }

    confirmVariant() {
      if (!this.selectedVariant || !this.pendingProduct) return;
      const { ci, ii, item } = this.pendingProduct;
      this.hooks.onVariantConfirm && this.hooks.onVariantConfirm(ci, ii, item, this.selectedVariant);
      this.closeVariant();
    }

    closeVariant() {
      this._hide(this.e.sheet);
    }

    /* ---------- Paquete ---------- */
    openPkg(ci, ii, item) {
      this.pendingPkg = { ci, ii, item };
      this.pkgGroups = item.package.groups && item.package.groups.length ? item.package.groups : [{ name:"Opciones", choose:this.pkg.countOf(item), repeat:item.package.repeat!==false, options:item.package.rolls||[] }];
      this.pkgGroupSelected = this.pkgGroups.map(() => []);
      this.e.pkgTitle.textContent = item.name;
      this.e.pkgDesc.textContent = "Completa cada grupo del paquete:";
      this.e.pkgOptions.innerHTML = "";
      this.pkgGroups.forEach((group, gi) => {
        const heading = document.createElement("div");
        heading.className = "pkg-group-title";
        heading.textContent = (group.name || ("Grupo " + (gi + 1))) + " — escoge " + (group.choose || 1) + (group.repeat !== false ? " (puedes repetir)" : "");
        this.e.pkgOptions.appendChild(heading);
        (group.options || []).forEach(option => {
        const roll = typeof option === "string" ? option : option.name;
        const opt = document.createElement("div");
        opt.className = "pkg-opt";
        opt.dataset.roll = roll;
        opt.dataset.group = String(gi);
        const check = document.createElement("span");
        check.className = "pkg-check";
        check.textContent = "○";
        const label = document.createElement("span");
        label.className = "pkg-label";
        label.textContent = roll;
        const leg = document.createElement("span");
        leg.className = "pkg-legend";
        leg.textContent = "$" + item.price;
        opt.appendChild(check); opt.appendChild(label); opt.appendChild(leg);
        opt.onclick = () => {
          const selected = this.pkgGroupSelected[gi], n = group.choose || 1;
          const count = selected.filter(r => r === roll).length;
          if (group.repeat === false && count >= 1) {
            selected.splice(selected.lastIndexOf(roll), 1);
          } else if (selected.length >= n) {
            alert("En " + group.name + " solo puedes elegir " + n + ".");
            return;
          } else {
            selected.push(roll);
          }
          this._updatePkgUI();
        };
        this.e.pkgOptions.appendChild(opt);
        });
      });
      this._updatePkgUI();
      this._show(this.e.pkgSheet);
    }

    confirmPackage() {
      if (!this.pendingPkg || !this.pkgGroups.every((g,i) => this.pkgGroupSelected[i].length === (g.choose||1))) return;
      const { ci, ii, item } = this.pendingPkg;
      item._packageSelections = this.pkgGroups.map((g,i) => ({name:g.name,selected:this.pkgGroupSelected[i].slice()}));
      const selected = this.pkgGroupSelected.reduce((all,x) => all.concat(x), []);
      this.hooks.onPkgConfirm && this.hooks.onPkgConfirm(ci, ii, item, selected);
      this.closePkg();
    }

    closePkg() {
      this._hide(this.e.pkgSheet);
    }

    _updatePkgUI() {
      this.e.pkgOptions.querySelectorAll(".pkg-opt").forEach(opt => {
        const gi = Number(opt.dataset.group || 0);
        const roll = opt.dataset.roll;
        const count = (this.pkgGroupSelected[gi] || []).filter(r => r === roll).length;
        const check = opt.querySelector(".pkg-check");
        check.textContent = count > 0 ? "●" : "○";
        const lbl = opt.querySelector(".pkg-label");
        lbl.textContent = count > 1 ? roll + " ×" + count : roll;
        opt.classList.toggle("active", count > 0);
      });
      const summaries = this.pkgGroups.map((g,i) => (g.name||("Grupo "+(i+1)))+": "+this.pkgGroupSelected[i].length+"/"+(g.choose||1));
      this.e.pkgCount.textContent = summaries.join(" · ");
      const btn = this.e.pkgAdd;
      const complete = this.pkgGroups.every((g,i) => this.pkgGroupSelected[i].length === (g.choose||1));
      btn.disabled = !complete;
      const item = this.pendingPkg ? this.pendingPkg.item : null;
      btn.textContent = complete
        ? "Agregar " + this.currency.format(item.price)
        : "Completa todos los grupos";
    }

    _show(el) {
      el.classList.remove("hidden");
      requestAnimationFrame(() => el.classList.add("show"));
    }

    _hide(el) {
      el.classList.remove("show");
      setTimeout(() => el.classList.add("hidden"), 280);
    }
  }

  global.PosApp = global.PosApp || {};
  global.PosApp.SheetView = SheetView;
})(window);
