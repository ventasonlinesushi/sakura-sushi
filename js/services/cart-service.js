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
          const clean = e.key.indexOf("pkg:") === 0 ? e.key.slice(4) : e.key;
          const parts = clean.split(":");
          const item = this._catalog.getItem(+parts[0], +parts[1]);
          return !!item && item.available !== false;
        });
      } catch (e) {
        return [];
      }
    }

    changeQty(cart, key, delta) {
      const result = cart.slice();
      const info = this._catalog.findItem(key);
      const item = this._catalog.getItem(info.cat, info.item);
      const entry = result.find(c => c.key === key);

      if (!entry) {
        const baseName = this._catalog.cartItemName(item, info.variant);
        const basePrice = this._catalog.getPrice(item, info.variant);
        const chosen = global.PosApp.MenuOptions ? global.PosApp.MenuOptions.choose(item, baseName, basePrice) : { name: baseName, price: basePrice };
        if (!chosen) return result;
        result.push(global.PosApp.CartItem.create(
          key,
          chosen.name,
          chosen.price,
          delta
        ));
      } else {
        const index = result.indexOf(entry);
        result[index] = global.PosApp.CartItem.create(entry.key, entry.name, entry.price, entry.qty + delta);
        if (result[index].qty <= 0) result.splice(index, 1);
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
        const updated = global.PosApp.CartItem.create(entry.key, entry.name, entry.price, entry.qty + 1);
        updated.package_detail = entry.package_detail;
        updated.desc = entry.desc;
        result[result.indexOf(entry)] = updated;
      } else {
        const created = global.PosApp.CartItem.create(key, item.name + (sorted.length ? " · " + sorted.join(" + ") : ""), item.price, 1);
        const options = groups.length ? groups.reduce((all,g) => all.concat(g.options||[]), []) : (item.package.options||item.package.rolls||[]);
        created.package_detail = { name:item.name, selected:selected.slice(), selected_groups:(item._packageSelections||[]), groups:groups, fixed:(item.package.fixed||[]), options:options };
        created.desc = JSON.stringify(created.package_detail);
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
      result[index] = global.PosApp.CartItem.create(last.key, last.name, last.price, last.qty - 1);
      if (result[index].qty <= 0) result.splice(index, 1);
      return result;
    }
  }

  global.PosApp = global.PosApp || {};
  global.PosApp.CartService = CartService;
})(window);
