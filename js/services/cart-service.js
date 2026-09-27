/* ============================================================
   Servicio del carrito: reglas de negocio del carrito.
   Opera sobre arreglos de CartItem y devuelve arreglos nuevos
   (inmutabilidad en la capa de servicios).
   ============================================================ */
(function (global) {
  "use strict";

  class CartService {
    constructor(catalog) {
      this._catalog = catalog;
    }

    sanitize(cart) {
      try {
        return (cart || []).filter(e => {
          if (!e || typeof e.key !== "string") return false;
          const withoutAlga = e.key.split("|")[0];
          const clean = withoutAlga.indexOf("pkg:") === 0 ? withoutAlga.slice(4) : withoutAlga;
          const parts = clean.split(":");
          const item = this._catalog.getItem(+parts[0], +parts[1]);
          if (item && !Array.isArray(e.sauce_targets)) {
            e.sauce_targets = e.package_detail
              ? this._packageSauceTargets(e.package_detail.selected || [], e.package_detail.fixed || [])
              : this._targetsForItem(item, item.name);
          }
          if (item && e.package_detail && !Array.isArray(e.alga_targets)) {
            e.alga_targets = this._packageAlgaTargets(e.package_detail.selected || [], e.package_detail.fixed || []);
          }
          return !!item && item.available !== false;
        });
      } catch (e) {
        return [];
      }
    }

    _copyDetails(from, to) {
      if (from.sauce_targets) to.sauce_targets = from.sauce_targets.slice();
      if (from.alga_targets) to.alga_targets = from.alga_targets.slice();
      if (from.package_detail) to.package_detail = from.package_detail;
      if (from.desc) to.desc = from.desc;
      return to;
    }

    _targetsForItem(item, label) {
      return this._catalog.isSauceEligible(item) ? [label || item.name] : [];
    }

    _packageSauceTargets(selected, fixedItems) {
      const targets = (selected || []).filter(name => this._catalog.isSauceEligibleName(name));
      (fixedItems || []).forEach(fixed => {
        const name = typeof fixed === "string" ? fixed : fixed.name;
        const qty = typeof fixed === "object" ? Number(fixed.qty || 1) : 1;
        if (!this._catalog.isSauceEligibleName(name)) return;
        for (let n = 0; n < qty; n += 1) targets.push(name);
      });
      return targets;
    }

    _packageAlgaTargets(selected, fixedItems) {
      const targets = (selected || []).filter(name => this._catalog.isRollEligibleName(name));
      (fixedItems || []).forEach(fixed => {
        const name = typeof fixed === "string" ? fixed : fixed.name;
        const qty = typeof fixed === "object" ? Number(fixed.qty || 1) : 1;
        if (!this._catalog.isRollEligibleName(name)) return;
        for (let n = 0; n < qty; n += 1) targets.push(name);
      });
      return targets;
    }

    changeQty(cart, key, delta) {
      const result = cart.slice();
      const info = this._catalog.findItem(key);
      const item = this._catalog.getItem(info.cat, info.item);
      const entry = result.find(c => c.key === key);

      if (!entry) {
        const baseName = this._catalog.cartItemName(item, info.variant);
        const basePrice = this._catalog.getPrice(item, info.variant);
        const alga = key.includes("|alga=sin") ? "Sin alga" : key.includes("|alga=con") ? "Con alga" : "";
        const chosen = alga ? { name: baseName + " [" + alga + "]", price: basePrice } : (global.PosApp.MenuOptions ? global.PosApp.MenuOptions.choose(item, baseName, basePrice) : { name: baseName, price: basePrice });
        if (!chosen) return result;
        const created = global.PosApp.CartItem.create(
          key,
          chosen.name,
          chosen.price,
          delta
        );
        created.sauce_targets = this._targetsForItem(item, baseName);
        result.push(created);
      } else {
        const index = result.indexOf(entry);
        result[index] = this._copyDetails(entry, global.PosApp.CartItem.create(entry.key, entry.name, entry.price, entry.qty + delta));
        if (result[index].qty <= 0) result.splice(index, 1);
      }
      return result;
    }

    addCustomized(cart, key, name, price, detail) {
      const result = cart.slice();
      const existing = result.find(c => c.key === key);
      if (existing) {
        const updated = this._copyDetails(existing, global.PosApp.CartItem.create(key, existing.name, existing.price, existing.qty + 1));
        updated.desc = existing.desc || detail;
        result[result.indexOf(existing)] = updated;
      } else {
        const created = global.PosApp.CartItem.create(key, name, price, 1);
        created.desc = detail;
        const info = this._catalog.findItem(key);
        const item = this._catalog.getItem(info.cat, info.item);
        created.sauce_targets = this._targetsForItem(item, item && item.name);
        result.push(created);
      }
      return result;
    }

    removeEntry(cart, key) {
      return cart.filter(c => c.key !== key);
    }

    clear() {
      return [];
    }

    count(cart) {
      return cart.reduce((a, c) => a + c.qty, 0);
    }

    total(cart) {
      return cart.reduce((a, c) => a + c.price * c.qty, 0);
    }

    qtyOf(cart, key) {
      const entry = cart.find(c => c.key === key);
      return entry ? entry.qty : 0;
    }

    pkgCountOf(item) {
      return this._catalog.pkgCountOf(item);
    }

    pkgEntries(cart, ci, ii) {
      return cart.filter(e => e.key.indexOf("pkg:" + ci + ":" + ii + ":") === 0);
    }

    qtyOfPkg(cart, ci, ii) {
      return this.pkgEntries(cart, ci, ii).reduce((a, e) => a + e.qty, 0);
    }

    addPackage(cart, pkgInfo, selected) {
      const ci = pkgInfo.ci;
      const ii = pkgInfo.ii;
      const item = pkgInfo.item;
      const groups = item.package.groups || [];
      const required = groups.length ? groups.reduce((n,g) => n + (g.choose||1), 0) : this.pkgCountOf(item);
      if (selected.length !== required) return cart;

      const sorted = selected.slice().sort();
      const groupKey = (item._packageSelections||[]).map(g => g.name+"="+(g.selected||[]).slice().sort().join("+")).join("|");
      const key = "pkg:" + ci + ":" + ii + ":" + (groupKey||sorted.join("+"));
      const result = cart.slice();
      const entry = result.find(e => e.key === key);

      if (entry) {
        const updated = this._copyDetails(entry, global.PosApp.CartItem.create(entry.key, entry.name, entry.price, entry.qty + 1));
        result[result.indexOf(entry)] = updated;
      } else {
        const created = global.PosApp.CartItem.create(key, item.name + (sorted.length ? " · " + sorted.join(" + ") : ""), item.price, 1);
        const options = groups.length ? groups.reduce((all,g) => all.concat(g.options||[]), []) : (item.package.options||item.package.rolls||[]);
        created.package_detail = { name:item.name, selected:selected.slice(), selected_groups:(item._packageSelections||[]), groups:groups, fixed:(item.package.fixed||[]), options:options };
        created.desc = JSON.stringify(created.package_detail);
        created.sauce_targets = this._packageSauceTargets(selected, item.package.fixed || []);
        created.alga_targets = this._packageAlgaTargets(selected, item.package.fixed || []);
        result.push(created);
      }
      return result;
    }

    removeOnePackage(cart, ci, ii) {
      const entries = this.pkgEntries(cart, ci, ii);
      if (!entries.length) return cart;

      const last = entries[entries.length - 1];
      const result = cart.slice();
      const index = result.indexOf(last);
      result[index] = this._copyDetails(last, global.PosApp.CartItem.create(last.key, last.name, last.price, last.qty - 1));
      if (result[index].qty <= 0) result.splice(index, 1);
      return result;
    }
  }

  global.PosApp = global.PosApp || {};
  global.PosApp.CartService = CartService;
})(window);
