/* ============================================================
   Vista de checkout: formulario, resumen y envío a WhatsApp.
   ============================================================ */
(function (global) {
  "use strict";

  class CheckoutView {
    constructor(deps) {
      this.cart = deps.cartVM;
      this.checkout = deps.checkoutVM;
      this.loyalty = deps.loyaltyVM;
      this.currency = deps.currency;
      this.orderType = "domicilio";
      this.payment = "Efectivo";
      this.palitos = "Si";
      this.sauceSelections = {};
      this.algaSelections = {};
      this.sauceOptions = ["Salsa de anguila", "Soya con limón", "Chiles toreados"];
      this.e = {};
    }

    cache() {
      this.e = {
        fName: document.getElementById("fName"),
        fPhone: document.getElementById("fPhone"),
        optLlevar: document.getElementById("optLlevar"),
        optDomicilio: document.getElementById("optDomicilio"),
        deliveryNote: document.getElementById("deliveryNote"),
        fieldAddress: document.getElementById("fieldAddress"),
        fCalle: document.getElementById("fCalle"),
        fNumero: document.getElementById("fNumero"),
        fCruzamiento: document.getElementById("fCruzamiento"),
        fEspec: document.getElementById("fEspec"),
        optEfectivo: document.getElementById("optEfectivo"),
        optTransferencia: document.getElementById("optTransferencia"),
        fNotes: document.getElementById("fNotes"),
        sauceSelector: document.getElementById("sauceSelector"),
        algaSelector: document.getElementById("algaSelector"),
        optPalitosSi: document.getElementById("optPalitosSi"),
        optPalitosNo: document.getElementById("optPalitosNo"),
        checkoutItems: document.getElementById("checkoutItems"),
        checkoutTotal: document.getElementById("checkoutTotal")
      };
    }

    setType(t) {
      this.orderType = t === "llevar" ? "llevar" : "domicilio";
      const recoger = this.orderType === "llevar";
      this.e.optLlevar.classList.toggle("active", recoger);
      this.e.optDomicilio.classList.toggle("active", !recoger);
      this.e.fieldAddress.classList.toggle("hidden", recoger);
      this.e.deliveryNote.classList.toggle("hidden", recoger);
      // La dirección nunca se envía ni se exige para pedidos a recoger.
    }

    setPayment(p) {
      this.payment = p;
      this.e.optEfectivo.classList.toggle("active", p === "Efectivo");
      this.e.optTransferencia.classList.toggle("active", p === "Transferencia");
    }

    setPalitos(v) {
      this.palitos = v;
      this.e.optPalitosSi.classList.toggle("active", v === "Si");
      this.e.optPalitosNo.classList.toggle("active", v === "No");
    }

    render() {
      this.e.checkoutItems.innerHTML = "";
      this.cart.items.forEach(c => {
        const line = document.createElement("div");
        line.className = "os-line";
        const l = document.createElement("span");
        l.textContent = c.qty + " x " + c.name;
        const r = document.createElement("span");
        r.textContent = this.currency.format(c.price * c.qty);
        line.appendChild(l); line.appendChild(r);
        this.e.checkoutItems.appendChild(line);
      });
      this.e.checkoutTotal.textContent = this.currency.format(this.cart.total);
      this._renderSauces();
      this._renderAlga();
    }

    _targets(field) {
      const targets = [];
      this.cart.items.forEach(c => {
        const baseTargets = c[field] || [];
        for (let unit = 0; unit < c.qty; unit += 1) {
          baseTargets.forEach((name, index) => targets.push({
            id: c.key + "|" + unit + "|" + index,
            label: name + (c.qty > 1 ? " · pedido " + (unit + 1) : "")
          }));
        }
      });
      const totals = {}, seen = {};
      targets.forEach(t => { totals[t.label] = (totals[t.label] || 0) + 1; });
      targets.forEach(t => {
        seen[t.label] = (seen[t.label] || 0) + 1;
        t.displayLabel = t.label + (totals[t.label] > 1 ? " · " + seen[t.label] : "");
      });
      return targets;
    }

    _renderSauces() {
      const host = this.e.sauceSelector;
      const targets = this._targets("sauce_targets");
      const valid = {};
      targets.forEach(t => { valid[t.id] = true; });
      Object.keys(this.sauceSelections).forEach(id => { if (!valid[id]) delete this.sauceSelections[id]; });
      host.innerHTML = "";
      if (!targets.length) { host.innerHTML = '<div class="sauce-empty">Este pedido no requiere selección de salsas.</div>'; return; }
      targets.forEach(target => {
        const card = document.createElement("div"); card.className = "sauce-card";
        const title = document.createElement("b"); title.textContent = target.displayLabel; card.appendChild(title);
        const options = document.createElement("div"); options.className = "sauce-options";
        this.sauceOptions.forEach(name => {
          const button = document.createElement("button"); button.type = "button"; button.className = "sauce-option";
          const selected = this.sauceSelections[target.id] || [];
          button.classList.toggle("active", selected.indexOf(name) !== -1); button.textContent = name;
          button.onclick = () => {
            if (!this._toggleSauce(target.id, name)) { alert("Solo puedes escoger 2 opciones por cada sushi, yakimeshi o gohan."); return; }
            this._renderSauces();
          };
          options.appendChild(button);
        });
        card.appendChild(options); host.appendChild(card);
      });
    }

    _toggleSauce(targetId, name) {
      const current = (this.sauceSelections[targetId] || []).slice();
      const index = current.indexOf(name);
      if (index !== -1) current.splice(index, 1);
      else if (current.length >= 2) return false;
      else current.push(name);
      this.sauceSelections[targetId] = current;
      return true;
    }

    _renderAlga() {
      const host = this.e.algaSelector;
      const targets = this._targets("alga_targets");
      const valid = {};
      targets.forEach(t => { valid[t.id] = true; if (!this.algaSelections[t.id]) this.algaSelections[t.id] = "Con alga"; });
      Object.keys(this.algaSelections).forEach(id => { if (!valid[id]) delete this.algaSelections[id]; });
      host.innerHTML = "";
      if (!targets.length) { host.innerHTML = '<div class="sauce-empty">Los rollos individuales ya indican Con alga o Sin alga al agregarlos.</div>'; return; }
      targets.forEach(target => {
        const card = document.createElement("div"); card.className = "sauce-card";
        const title = document.createElement("b"); title.textContent = target.displayLabel; card.appendChild(title);
        const options = document.createElement("div"); options.className = "sauce-options";
        ["Con alga", "Sin alga"].forEach(name => {
          const button = document.createElement("button"); button.type = "button"; button.className = "sauce-option";
          button.classList.toggle("active", this.algaSelections[target.id] === name); button.textContent = name;
          button.onclick = () => { this.algaSelections[target.id] = name; this._renderAlga(); };
          options.appendChild(button);
        });
        card.appendChild(options); host.appendChild(card);
      });
    }

    _sauceSummary() {
      return this._targets("sauce_targets").map(t => {
        const selected = this.sauceSelections[t.id] || [];
        return t.displayLabel + ": " + (selected.length ? selected.join(" + ") : "Sin salsas");
      }).join(" | ");
    }

    _algaSummary() {
      return this._targets("alga_targets").map(t => t.displayLabel + ": " + (this.algaSelections[t.id] || "Con alga")).join(" | ");
    }

    _form() {
      const name = this.e.fName.value.trim();
      const phone = this.e.fPhone.value.trim();
      const calle = this.e.fCalle.value.trim();
      const numero = this.e.fNumero.value.trim();
      const cruzamiento = this.e.fCruzamiento.value.trim();
      const espec = this.e.fEspec.value.trim();
      const notes = this.e.fNotes.value.trim();
      const salsas = this._sauceSummary();
      const alga = this._algaSummary();

      if (!name) { alert("Escribe tu nombre."); return null; }
      if (!phone) { alert("Escribe tu teléfono."); return null; }
      if (this.orderType === "domicilio") {
        if (!calle) { alert("Escribe la calle de tu dirección."); return null; }
        if (!numero) { alert("Escribe el número de tu casa."); return null; }
        if (!cruzamiento) { alert("Escribe el cruzamiento de tu calle."); return null; }
      }

      let address = "";
      if (this.orderType === "domicilio") {
        address = calle + " #" + numero + ", cruce con " + cruzamiento;
        if (espec) address += " (" + espec + ")";
      }

      return { name, phone, address, notes, salsas, alga, orderType: this.orderType, payment: this.payment, palitos: this.palitos };
    }

    async send() {
      const hours = global.PosApp.getBusinessStatus && global.PosApp.getBusinessStatus();
      if (hours && !hours.open) {
        alert("En este momento estamos fuera de horario. " + hours.message + ". Tu pedido no fue registrado.");
        return;
      }
      const form = this._form();
      if (!form) return;
      const data = this.checkout.orderData(this.cart.items, this.loyalty.line(), form);
      try {
        const record = await this.checkout.recordOrder(data, form, this.cart.items);
        if (record.loyalty) this.loyalty.syncFromServer(record.loyalty);
        const loyaltyLine = record.loyalty ? this.loyalty.registeredLine(record.loyalty) : this.loyalty.line();
        const confirmed = this.checkout.orderData(this.cart.items, loyaltyLine, form, record.folio);
        if (!record.loyalty) this.loyalty.registerVisit();
        this.onSent && this.onSent();
        // Abrir WhatsApp en la pestaña actual evita ventanas vacías/bloqueadas
        // en navegadores móviles, incluidos pedidos para recoger.
        window.location.assign(confirmed.url);
      } catch (error) {
        // El registro en el POS puede fallar aunque WhatsApp funcione.
        // No afirmamos que el pedido llegó al restaurante: el cliente decide
        // si quiere enviarlo por WhatsApp como alternativa manual.
        const sendManually = confirm(
          "No pudimos confirmar que tu pedido se registró en el restaurante. " +
          "Puedes enviarlo por WhatsApp para que el personal lo confirme manualmente. " +
          "Si ya habías intentado enviarlo, verifica con el restaurante para evitar duplicados.\\n\\n" +
          "¿Quieres abrir WhatsApp con tu pedido?"
        );
        if (sendManually) {
          const manual = this.checkout.orderData(this.cart.items, this.loyalty.line(), form);
          // Navegación en la misma pestaña: funciona incluso si se bloquean ventanas emergentes.
          window.location.href = manual.url;
        }
      }
    }
  }

  global.PosApp = global.PosApp || {};
  global.PosApp.CheckoutView = CheckoutView;
})(window);
