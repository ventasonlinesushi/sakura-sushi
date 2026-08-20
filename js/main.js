/* ============================================================
   Punto de entrada: monta el contenedor DI y arranca la app.
   Carga el menú desde Supabase (menu_items) con fallback al
   archivo estático menu-data.js.
   ============================================================ */
(function (global) {
  "use strict";

  const brand = PosApp.brandConfig;

  function initApp(menuData) {
    PosApp.menuData = menuData;

    const container = new PosApp.Container();

    /* ----- Repositorios ----- */
    container.registerSingleton("storageRepository", () => new PosApp.LocalStorageRepository());
    container.registerSingleton("cartRepository", c =>
      new PosApp.CartRepository(c.resolve("storageRepository"), brand.storagePrefix));
    container.registerSingleton("loyaltyRepository", c =>
      new PosApp.LoyaltyRepository(c.resolve("storageRepository"), brand.storagePrefix));
    container.registerSingleton("orderRepository", c =>
      new PosApp.OrderRepository(c.resolve("storageRepository"), brand.storagePrefix));

    /* ----- Servicios ----- */
    container.registerSingleton("currency", () => new PosApp.CurrencyService());
    container.registerSingleton("gradient", () => new PosApp.GradientService());
    container.registerSingleton("catalog", c =>
      new PosApp.CatalogService(PosApp.menuData, c.resolve("currency")));
    container.registerSingleton("cartService", c => new PosApp.CartService(c.resolve("catalog")));
    container.registerSingleton("loyaltyService", c =>
      new PosApp.LoyaltyService(c.resolve("loyaltyRepository")));
    container.registerSingleton("orderService", c =>
      new PosApp.OrderService(c.resolve("currency")));
    container.registerSingleton("checkoutService", c =>
      new PosApp.CheckoutService(c.resolve("currency")));

    /* ----- ViewModels ----- */
    container.registerSingleton("catalogVM", c =>
      new PosApp.CatalogViewModel(c.resolve("catalog"), c.resolve("gradient"), brand));
    container.registerSingleton("cartVM", c =>
      new PosApp.CartViewModel(c.resolve("cartService"), c.resolve("cartRepository"), brand));
    container.registerSingleton("loyaltyVM", c =>
      new PosApp.LoyaltyViewModel(c.resolve("loyaltyService")));
    container.registerSingleton("checkoutVM", c =>
      new PosApp.CheckoutViewModel(c.resolve("checkoutService"), c.resolve("cartService"), brand,
        c.resolve("orderService"), c.resolve("orderRepository")));
    container.registerSingleton("pkgVM", c => new PosApp.PackageViewModel(c.resolve("catalog")));

    /* ----- Vistas ----- */
    container.registerSingleton("menuView", c => new PosApp.MenuView({
      catalogVM: c.resolve("catalogVM"),
      cartVM: c.resolve("cartVM"),
      loyaltyVM: c.resolve("loyaltyVM"),
      currency: c.resolve("currency"),
      gradient: c.resolve("gradient"),
      pkgVM: c.resolve("pkgVM")
    }));
    container.registerSingleton("drawerView", c => new PosApp.DrawerView({
      cartVM: c.resolve("cartVM"),
      currency: c.resolve("currency"),
      gradient: c.resolve("gradient")
    }));
    container.registerSingleton("checkoutView", c => new PosApp.CheckoutView({
      cartVM: c.resolve("cartVM"),
      checkoutVM: c.resolve("checkoutVM"),
      loyaltyVM: c.resolve("loyaltyVM"),
      currency: c.resolve("currency")
    }));
    container.registerSingleton("sheetView", c => new PosApp.SheetView({
      currency: c.resolve("currency"),
      pkgVM: c.resolve("pkgVM")
    }));
    container.registerSingleton("appView", c => new PosApp.AppView({
      menuView: c.resolve("menuView"),
      drawerView: c.resolve("drawerView"),
      checkoutView: c.resolve("checkoutView"),
      sheetView: c.resolve("sheetView"),
      cartVM: c.resolve("cartVM")
    }));

    /* ----- Arranque ----- */
    const app = container.resolve("appView");
    app.init();

    /* ----- Funciones globales usadas por los onclick del HTML ----- */
    global.openDrawer = () => app.openDrawer();
    global.closeDrawer = () => app.closeDrawer();
    global.clearCart = () => app.clearCart();
    global.goCheckout = () => app.goCheckout();
    global.goBack = () => app.goBack();
    global.editOrder = () => app.editOrder();
    global.confirmVariant = () => app.sheets.confirmVariant();
    global.confirmPackage = () => app.sheets.confirmPackage();
    global.setType = t => app.checkout.setType(t);
    global.setPayment = p => app.checkout.setPayment(p);
    global.setPalitos = v => app.checkout.setPalitos(v);
    global.sendWhatsApp = () => app.checkout.send();
  }

  /* ----- Cargar menú: Supabase o estático ----- */
  const sb = brand.supabase;
  const ST = PosApp.menuData;

  function staticItem(category, name) {
    var cat = (ST || []).find(function (c) { return c.name === category; });
    return cat && (cat.items || []).find(function (item) { return item.name === name; });
  }

  if (sb && sb.url && sb.key) {
    const url = sb.url.replace(/\/$/, "") + "/rest/v1/menu_items?marca=eq." + encodeURIComponent(brand.marca || "") + "&order=categoria,orden";
    fetch(url, { cache:"no-store", headers: { "apikey": sb.key, "Authorization": "Bearer " + sb.key, "Cache-Control":"no-cache" } })
      .then(function (r) { if(!r.ok) throw new Error("No se pudo actualizar el menú"); return r.json(); })
      .then(function (rows) {
        var cats = [], catMap = {};
        PosApp.menuConfig = rows.filter(function(p){ return p.categoria === "__POS_CONFIG__"; }).map(function(p){ try { return JSON.parse(p.descripcion || "{}"); } catch(e) { return null; } }).filter(function(x){ return x && x.active !== false; });
        var packages = {};
        rows.filter(function(p){ return p.categoria === "__POS_PACKAGES__" && p.disponible !== false; }).forEach(function(p){ try { var x=JSON.parse(p.descripcion||"{}"); if(x.name)packages[x.name]=x; } catch(e){} });
        rows.filter(function(p){ return p.categoria !== "__POS_CONFIG__" && p.categoria !== "__POS_PACKAGES__" && p.disponible === true; }).forEach(function (p) {
          if (!catMap[p.categoria]) {
            catMap[p.categoria] = { name: p.categoria, items: [] };
            cats.push(catMap[p.categoria]);
          }
          var local = staticItem(p.categoria, p.nombre) || {};
          var pkg = packages[p.nombre];
          catMap[p.categoria].items.push({
            name: p.nombre,
            price: p.precio,
            desc: local.package ? (local.desc || p.descripcion || "") : (p.descripcion || local.desc || ""),
            image: p.image_url || local.image || "",
            category: p.categoria,
            id: p.id,
            variants: local.variants,
            package: pkg ? { count:pkg.choose||0, rolls:pkg.options||[], options:pkg.options||[], fixed:pkg.fixed||[], repeat:pkg.repeat!==false, groups:pkg.groups||[] } : local.package,
            featured: local.featured,
            emoji: local.emoji
          });
        });
        initApp(cats);
      })
      .catch(function () { initApp(ST); });
  } else {
    initApp(ST);
  }
})(window);
