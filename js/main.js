/* ============================================================
   Punto de entrada: monta el contenedor DI y arranca la app.
   Carga el menú desde Supabase (menu_items) con fallback al
   archivo estático menu-data.js.
   ============================================================ */
(function (global) {
  "use strict";

  const brand = PosApp.brandConfig;

  function minutes(value) {
    var p = String(value || "").split(":"), h = Number(p[0]), m = Number(p[1]);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  }

  function businessStatus(now) {
    var cfg = PosApp.businessHours || brand.businessHours;
    if (!cfg || !cfg.days) return { open: true, message: "Abierto para pedidos" };
    var zone = cfg.timezone || "America/Merida", parts = {};
    new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now || new Date()).forEach(function (p) { parts[p.type] = p.value; });
    var dayMap = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }, day = dayMap[parts.weekday], rule = cfg.days[day] || cfg.days[String(day)];
    if (!rule || rule.enabled === false) return { open:false, message:"Cerrado hoy · pedidos en línea no disponibles" };
    var current = Number(parts.hour) * 60 + Number(parts.minute), start = minutes(rule.open), end = minutes(rule.close);
    var isOpen = end >= start ? current >= start && current < end : current >= start || current < end;
    return { open:isOpen, message:isOpen ? ("Abierto · pedidos hasta " + rule.close) : ("Cerrado · abrimos a las " + rule.open), rule:rule };
  }

  PosApp.getBusinessStatus = businessStatus;

  function renderBusinessStatus() {
    var el = document.getElementById("businessStatus"); if (!el) return;
    var status = businessStatus(); el.textContent = (status.open ? "🟢 " : "🔴 ") + status.message;
    el.classList.toggle("open", status.open); el.classList.toggle("closed", !status.open);
  }

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
    renderBusinessStatus();
    global.setInterval(renderBusinessStatus, 60000);

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
        PosApp.businessHours = PosApp.menuConfig.find(function(x){ return x.type === "business_hours"; }) || brand.businessHours;
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
