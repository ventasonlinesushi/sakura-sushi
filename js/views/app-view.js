/* ============================================================
   Vista principal: coordina menú, drawer, checkout y sheets.
   Expone las funciones globales que usan los onclick del HTML.
   ============================================================ */
(function (global) {
  "use strict";

  class AppView {
    constructor(deps) {
      this.menu = deps.menuView;
      this.drawer = deps.drawerView;
      this.checkout = deps.checkoutView;
      this.sheets = deps.sheetView;
      this.cart = deps.cartVM;
      this.el = {};
    }

    init() {
      this.el = {
        menu: document.getElementById("menu"),
        cats: document.getElementById("cats"),
        floatCart: document.getElementById("floatCart"),
        badge: document.getElementById("badge"),
        fcTotal: document.getElementById("fcTotal"),
        overlay: document.getElementById("overlay"),
        drawer: document.getElementById("drawer"),
        clearBtn: document.getElementById("clearBtn"),
        drawerBody: document.getElementById("drawerBody"),
        drawerFoot: document.getElementById("drawerFoot"),
        drawerTotal: document.getElementById("drawerTotal"),
        checkout: document.getElementById("checkout")
      };

      this.checkout.cache();
      this.sheets.cache();

      this.menu.hooks.onQty = (key, delta) => this.cart.changeQty(key, delta);
      this.menu.hooks.onAlga = (key, item) => this.openAlga(key, item);
      this.menu.hooks.onVariant = (ci, ii, item) => this.sheets.openVariant(ci, ii, item);
      this.menu.hooks.onPkg = (ci, ii, item) => this.sheets.openPkg(ci, ii, item);
      this.menu.hooks.onRemovePkg = (ci, ii) => this.cart.removeOnePackage(ci, ii);

      this.drawer.hooks.onQty = (key, delta) => this.cart.changeQty(key, delta);
      this.drawer.hooks.onRemove = key => this.cart.remove(key);
      this.drawer.hooks.onClear = () => this.cart.clear();

      this.sheets.hooks.onVariantConfirm = (ci, ii, item, variant) =>
        this.cart.changeQty(this.menu.catalog.key(ci, ii, variant), 1);
      this.sheets.hooks.onPkgConfirm = (ci, ii, item, selected) =>
        this.cart.addPackage(ci, ii, item, selected);

      this.checkout.onSent = () => this.refreshAll();

      this.cart.onChange = () => this.refreshAll();

      this.menu.attach(this.el.cats, this.el.menu);
      this.menu.renderChips();
      this.menu.renderMenu();
      this.refreshFloat();
    }

    openAlga(key, item) {
      const modal = document.getElementById("algaModal");
      const name = document.getElementById("algaProduct");
      const confirm = document.getElementById("algaConfirm");
      const choices = Array.from(modal.querySelectorAll('input[name="algaChoice"]'));
      const replace = document.getElementById("proteinReplace");
      const additions = Array.from(modal.querySelectorAll('input[name="proteinAdd"]'));
      const toppings = Array.from(modal.querySelectorAll('input[name="rollTopping"]'));
      const total = document.getElementById("customTotal");
      const base = Number(item.price) || 0;
      const prices = { pollo:25, arrachera:30, camaron:35, kanikama:35, tampico:35, spicy:6 };
      const labels = { pollo:"Pollo", arrachera:"Arrachera", camaron:"Camarón", kanikama:"Kanikama", tampico:"Tampico", spicy:"Spicy" };
      name.textContent = item.name;
      choices.forEach(c => { c.checked = false; });
      replace.value = "";
      additions.concat(toppings).forEach(c => { c.checked = false; });
      const recalc = () => {
        const chosen = choices.find(c => c.checked);
        const extra = (replace.value ? prices[replace.value] : 0) +
          additions.concat(toppings).filter(c => c.checked).reduce((sum,c) => sum + prices[c.value],0);
        total.textContent = "$" + (base + extra).toLocaleString("es-MX");
        confirm.disabled = !chosen;
      };
      choices.forEach(c => { c.onchange = recalc; });
      replace.onchange = recalc;
      additions.concat(toppings).forEach(c => { c.onchange = recalc; });
      recalc();
      modal.classList.remove("hidden");
      document.getElementById("algaCancel").onclick = () => modal.classList.add("hidden");
      confirm.onclick = () => {
        const selected = choices.find(c => c.checked);
        if (!selected) return;
        const details = [selected.value === "sin" ? "SIN ALGA" : "CON ALGA"];
        if (replace.value) details.push("CAMBIAR PROTEÍNA POR " + labels[replace.value].toUpperCase() + " +$" + prices[replace.value]);
        additions.filter(c => c.checked).forEach(c => details.push("AGREGAR PROTEÍNA " + labels[c.value].toUpperCase() + " +$" + prices[c.value]));
        toppings.filter(c => c.checked).forEach(c => details.push("AGREGAR TOPPING " + labels[c.value].toUpperCase() + " +$" + prices[c.value]));
        const extra = (replace.value ? prices[replace.value] : 0) +
          additions.concat(toppings).filter(c => c.checked).reduce((sum,c) => sum + prices[c.value],0);
        const detail = details.join(" | ");
        const customKey = key + "|alga=" + selected.value + "|custom=" + [replace.value, additions.filter(c=>c.checked).map(c=>c.value).join("+"), toppings.filter(c=>c.checked).map(c=>c.value).join("+")].join("~");
        const displayName = item.name + " · " + details.join(" · ");
        this.cart.addCustomized(customKey, displayName, base + extra, detail);
        modal.classList.add("hidden");
        this.closeDrawer();
        this.el.checkout.classList.add("hidden");
        this.el.menu.classList.remove("hidden");
        this.el.cats.classList.remove("hidden");
        this.refreshFloat();
      };
    }

    openDrawer() {
      this.drawer.renderDrawer(this.el.drawerBody, this.el.drawerTotal, this.el.drawerFoot, this.el.clearBtn);
      this.el.drawer.classList.add("show");
      this.el.overlay.classList.add("show");
    }

    closeDrawer() {
      this.el.drawer.classList.remove("show");
      this.el.overlay.classList.remove("show");
    }

    continueShopping() {
      this.closeDrawer();
      this.goBack();
    }

    clearCart() {
      this.cart.clear();
    }

    goCheckout() {
      this.closeDrawer();
      if (!this.cart.items.length) return;
      this.el.menu.classList.add("hidden");
      this.el.cats.classList.add("hidden");
      this.el.checkout.classList.remove("hidden");
      this.el.floatCart.classList.add("hidden");
      window.scrollTo(0, 0);
      this.checkout.render();
    }

    goBack() {
      this.el.checkout.classList.add("hidden");
      this.el.menu.classList.remove("hidden");
      this.el.cats.classList.remove("hidden");
      this.refreshFloat();
      window.scrollTo(0, 0);
    }

    editOrder() {
      this.goBack();
      setTimeout(() => this.openDrawer(), 60);
    }

    refreshAll() {
      this.menu.renderMenu();
      this.drawer.renderDrawer(this.el.drawerBody, this.el.drawerTotal, this.el.drawerFoot, this.el.clearBtn);
      this.refreshFloat();
    }

    refreshFloat() {
      this.drawer.refreshFloat(this.el.floatCart, this.el.badge, this.el.fcTotal);
    }
  }

  global.PosApp = global.PosApp || {};
  global.PosApp.AppView = AppView;
})(window);
