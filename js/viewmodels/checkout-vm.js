/* ============================================================
   ViewModel de checkout: valida el formulario y arma el pedido.
   ============================================================ */
(function (global) {
  "use strict";

  class CheckoutViewModel {
    constructor(checkoutService, cartService, brandConfig, orderService, orderRepository) {
      this._service = checkoutService;
      this._cart = cartService;
      this._brand = brandConfig;
      this._orders = orderService;
      this._orderRepo = orderRepository;
    }

    get phoneDisplay() {
      return this._brand.phoneDisplay;
    }

    orderData(cart, loyaltyLine, form, confirmedFolio) {
      const folio = confirmedFolio || this._orderRepo.nextFolio();
      const options = {
        business: this._brand.business,
        name: form.name,
        phone: form.phone,
        orderType: form.orderType,
        address: form.address,
        payment: form.payment,
        cart,
        total: this._cart.total(cart),
        loyaltyLine,
        notes: form.notes,
        salsas: form.salsas,
        palitos: form.palitos,
        folio: this._orders.folioText(folio)
      };
      return {
        folio,
        url: this._service.waUrl(this._brand.whatsapp, this._service.buildMessage(options))
      };
    }

    async recordOrder(data, form, cart) {
      const record = this._orders.buildRecord({
        folio: data.folio,
        name: form.name,
        phone: form.phone,
        orderType: form.orderType,
        address: form.address,
        payment: form.payment,
        notes: form.notes,
        salsas: form.salsas,
        palitos: form.palitos,
        marca: this._brand.marca,
        cart,
        total: this._cart.total(cart)
      });
      const saved = await this._orders.pushOrder(record, this._brand.supabase);
      if (!saved) throw new Error("No se pudo registrar el pedido en el restaurante");
      record.folio = saved.folio;
      record.id = saved.id;
      this._orderRepo.save(record);
      this._orders.notify(record, this._brand.sheetsUrl);
      return record;
    }
  }

  global.PosApp = global.PosApp || {};
  global.PosApp.CheckoutViewModel = CheckoutViewModel;
})(window);
