/* ============================================================
   CONFIGURACIÓN DE MARCA
   Edita aquí: negocio, WhatsApp, teléfono y prefijo de almacenamiento.
   ============================================================ */
(function (global) {
  "use strict";

  global.PosApp = global.PosApp || {};
  global.PosApp.brandConfig = {
    business: "Sakura Sushi Paseos Mid",
    marca: "sakura",
    whatsapp: "529993614410",
    phoneDisplay: "999 361 4410",
    banner: "Pide por WhatsApp",
    storagePrefix: "sakura",
    businessHours: {
      timezone: "America/Merida",
      days: {
        0: { enabled: true, open: "14:00", close: "22:30" },
        1: { enabled: true, open: "15:30", close: "22:50" },
        2: { enabled: true, open: "15:30", close: "22:50" },
        3: { enabled: true, open: "15:30", close: "22:50" },
        4: { enabled: true, open: "15:30", close: "22:50" },
        5: { enabled: true, open: "15:30", close: "22:50" },
        6: { enabled: true, open: "15:30", close: "22:50" }
      }
    },
    /* Panel admin (Supabase). Pega aquí la URL y la anon key del proyecto
       (configuración → API). Con esto cada pedido se guarda en la nube y
       lo ve el receptor en la PC. Déjalo en blanco para desactivarlo. */
    supabase: {
      url: "https://edquyomwiiaawqslsisd.supabase.co",
      key: "sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf"
    }
  };
})(window);
