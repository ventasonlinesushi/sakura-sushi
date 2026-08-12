# -*- coding: utf-8 -*-
"""Servidor HTTP para impresión de tickets desde el panel admin.
Escucha en localhost:5100 y recibe pedidos via POST /print.
Imprime por ESTACION (cocina, sushi, bebidas, barra) + ticket cuenta en caja.
"""

import json
import os
import sys
import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse

PORT = 5100

DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR)

import printer
from menu_loader import BuscadorMenu, leer_menu, _normalizar, _coincide_categoria

# Cargar config
CONFIG_PATH = os.path.join(DIR, "config.json")
try:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        CONFIG = json.load(f)
except Exception:
    CONFIG = {"impresoras": {"caja": "YICHIP POS-58"}, "ancho_papel": "58"}

ESTACIONES = ("cocina", "sushi", "bebidas", "barra")


def _encabezado(t, empresa, data):
    ahora = datetime.datetime.now().strftime("%d/%m/%y %H:%M")
    tipo = data.get("order_type", "")
    tipo_str = "A DOMICILIO" if tipo == "domicilio" else ("EN RESTAURANTE" if tipo == "restaurante" else "PARA LLEVAR")

    t.linea("")
    t.linea(empresa, "cen", doble=True, bold=True)
    t.linea("")
    t.guion()
    t.linea(f"FOLIO: {data.get('folio', '?')}", bold=True)
    t.linea(ahora)
    t.linea(tipo_str)
    t.guion()
    if data.get("name"):
        t.linea(f"Cliente: {data['name']}")
    if data.get("phone"):
        t.linea(f"Tel: {data['phone']}")
    if tipo == "domicilio" and data.get("address"):
        t.linea(f"Dir: {data['address']}")
    elif tipo == "restaurante" and data.get("address"):
        t.linea(data['address'])
    t.guion()


def _items_ticket(t, items_lineas, subtotal=False):
    total = 0.0
    ancho = t.ancho
    for ln in items_lineas:
        qty = ln.get("qty", ln.get("cantidad", 1))
        price = ln.get("price", ln.get("precio", 0))
        name = ln.get("name", ln.get("nombre", "?"))
        total_linea = qty * price
        total += total_linea
        linea = f"{qty}x {name}"
        importe_str = f"${total_linea:.2f}"
        linea = linea[:ancho - len(importe_str) - 1]
        t.linea(linea.ljust(ancho - len(importe_str)) + importe_str)
    return total


def _pie(t, empresa, estacion=None):
    t.guion()
    if estacion:
        t.linea(f"=" * t.ancho)
        t.linea(f"ESTACION: {estacion.upper()}", "cen", bold=True)
        t.linea(f"=" * t.ancho)
        t.linea("")


def imprimir_cancelacion(data):
    """Imprime ticket de CANCELADO para una estación."""
    marca_key = data.get("marca", "")
    marca_info = CONFIG.get("marcas", {}).get(marca_key, {})
    empresa = marca_info.get("empresa", marca_key.upper() if marca_key else "PEDIDO")
    item = data.get("item", {})
    nombre = item.get("name", item.get("nombre", "?"))
    qty = item.get("qty", item.get("cantidad", 1))

    impresora_caja = CONFIG.get("impresoras", {}).get("caja", "")
    if not impresora_caja:
        return False, "sin impresora"

    t = printer.Ticket(CONFIG.get("ancho_papel", "58"))
    ancho = t.ancho
    ahora = datetime.datetime.now().strftime("%d/%m/%y %H:%M")

    t.linea("")
    t.linea(empresa, "cen", doble=True, bold=True)
    t.linea("=== CANCELADO ===", "cen", doble=True)
    t.guion()
    t.linea(f"FOLIO: {data.get('folio', '?')}", bold=True)
    t.linea(ahora)
    if data.get("name"):
        t.linea(f"Cliente: {data['name']}")
    t.guion()
    t.linea("SE CANCELO:", bold=True)
    importe_str = f"${(item.get('price',0) * qty):.2f}"
    linea = f"{qty}x {nombre}"
    linea = linea[:ancho - len(importe_str) - 1]
    t.linea(linea.ljust(ancho - len(importe_str)) + importe_str)
    t.guion()
    t.linea("FAVOR DE NO PREPARAR", "cen", bold=True)
    t.linea("")
    t.linea(f"{'·' * ancho}")
    t.linea("")

    try:
        printer._enviar(impresora_caja, t.compilar())
        return True, "cancel ticket printed"
    except Exception as e:
        return False, str(e)


def imprimir_pedido_admin(data):
    """Imprime tickets por estación + cuenta en caja."""
    marca_key = data.get("marca", "")
    marca_info = CONFIG.get("marcas", {}).get(marca_key, {})
    empresa = marca_info.get("empresa", marca_key.upper() if marca_key else "PEDIDO")
    directorio_pedidos = marca_info.get("directorio_pedidos", "")

    # --- Agrupar ítems por estación ---
    items = data.get("items", [])
    categorias_estacion = CONFIG.get("categorias_estacion", {})
    mapa_nombres = CONFIG.get("estaciones_nombre") or {}

    buscador = None
    try:
        if directorio_pedidos and os.path.isdir(directorio_pedidos):
            menu = leer_menu(directorio_pedidos)
            buscador = BuscadorMenu(menu)
    except Exception:
        buscador = None

    grupos = {e: [] for e in ESTACIONES}
    for item in items:
        nombre = item.get("name", item.get("nombre", ""))
        nombre_lower = nombre.strip().lower() if nombre else ""
        estacion = None

        # 1. Mapa explícito de nombres
        if mapa_nombres:
            estacion = mapa_nombres.get(nombre_lower)

        # 2. Buscar en menú y mapear categoría → estación
        if not estacion and buscador:
            cat, nombre_real, _ = buscador.buscar(nombre)
            if cat and nombre_real != "Salmon":
                cat_norm = _normalizar(cat)
                for est_key, palabras in categorias_estacion.items():
                    if est_key in ESTACIONES and _coincide_categoria(cat_norm, palabras):
                        estacion = est_key
                        break

        # 3. Keyword matching directo sobre el nombre del ítem
        if not estacion:
            for est_key, palabras in categorias_estacion.items():
                if est_key in ESTACIONES:
                    for palabra in palabras:
                        if palabra and len(palabra) >= 3 and palabra in nombre_lower:
                            estacion = est_key
                            break
                    if estacion:
                        break

        if not estacion:
            estacion = "cocina"
        grupos.setdefault(estacion, []).append(item)

    impresoras = CONFIG.get("impresoras", {})
    impresora_caja = impresoras.get("caja", "")
    ok_count = 0
    err_count = 0

    # --- Imprimir por estación ---
    for est in ESTACIONES:
        lineas = grupos.get(est) or []
        if not lineas:
            continue
        nombre_imp = impresoras.get(est) or impresora_caja
        if not nombre_imp:
            continue

        t = printer.Ticket(CONFIG.get("ancho_papel", "58"))
        ancho = t.ancho
        ahora = datetime.datetime.now().strftime("%d/%m/%y %H:%M")
        tipo = data.get("order_type", "")
        tipo_str = "A DOMICILIO" if tipo == "domicilio" else ("EN RESTAURANTE" if tipo == "restaurante" else "PARA LLEVAR")

        # Encabezado estación
        t.linea("")
        t.linea(f"= {empresa} =", "cen", bold=True)
        t.linea(f"--- {est.upper()} ---", "cen", doble=True)
        t.guion()
        t.linea(f"FOLIO: {data.get('folio', '?')}", bold=True)
        t.linea(f"{ahora}  {tipo_str}")
        if data.get("name"):
            t.linea(f"Cliente: {data['name']}")
        if tipo == "restaurante" and data.get("address"):
            t.linea(data['address'])
        if data.get("notes"):
            t.linea(f"Nota: {data['notes']}")
        t.guion()

        total_items = 0
        for ln in lineas:
            qty = ln.get("qty", ln.get("cantidad", 1))
            name = ln.get("name", ln.get("nombre", "?"))
            comment = ln.get("comment", "")
            prep = ln.get("prep", "")
            total_items += qty
            linea = f"{qty}x {name}"
            t.linea(linea)
            if comment:
                t.linea(f"    >> {comment}")
            if prep:
                t.linea(f"    ** {prep}")

        t.guion()
        t.linea(f"Total: {total_items} producto(s)", bold=True)

        # Nota del pedido completo
        total_general = data.get("total", 0)
        pedido_items = sum(i.get("qty", i.get("cantidad", 1)) for i in items)
        if pedido_items != total_items:
            t.linea(f"")
            t.linea(f"Pedido completo: {pedido_items} productos")

        t.linea("")
        t.linea(f"{'·' * ancho}")
        t.linea("")

        try:
            printer._enviar(nombre_imp, t.compilar())
            ok_count += 1
        except Exception as e:
            err_count += 1

    # --- Imprimir CUENTA completa en CAJA ---
    if impresora_caja:
        t = printer.Ticket(CONFIG.get("ancho_papel", "58"))
        ancho = t.ancho
        ahora = datetime.datetime.now().strftime("%d/%m/%y %H:%M")
        tipo = data.get("order_type", "")
        tipo_str = "A DOMICILIO" if tipo == "domicilio" else ("EN RESTAURANTE" if tipo == "restaurante" else "PARA LLEVAR")

        t.linea("")
        t.linea(empresa, "cen", doble=True, bold=True)
        t.linea("CUENTA", "cen", bold=True)
        t.guion()
        t.linea(f"FOLIO: {data.get('folio', '?')}", bold=True)
        t.linea(ahora)
        t.linea(tipo_str)
        t.guion()
        if data.get("name"):
            t.linea(f"Cliente: {data['name']}")
        if data.get("phone"):
            t.linea(f"Tel: {data['phone']}")
        if tipo == "domicilio" and data.get("address"):
            t.linea(f"Dir: {data['address']}")
        elif tipo == "restaurante" and data.get("address"):
            t.linea(data['address'])
        t.guion()

        subtotal = 0.0
        for item in items:
            qty = item.get("qty", item.get("cantidad", 1))
            price = item.get("price", item.get("precio", 0))
            name = item.get("name", item.get("nombre", "?"))
            total_linea = qty * price
            subtotal += total_linea
            importe_str = f"${total_linea:.2f}"
            linea = f"{qty}x {name}"
            linea = linea[:ancho - len(importe_str) - 1]
            t.linea(linea.ljust(ancho - len(importe_str)) + importe_str)

        t.guion()
        t.linea(f"SUBTOTAL".ljust(ancho - 8) + f"${subtotal:.2f}".rjust(8))

        discount = data.get("discount", 0)
        extra = data.get("extra", 0)
        if discount > 0:
            disc_amt = round(subtotal * discount / 100)
            t.linea(f"DESC. {discount}%".ljust(ancho - 8) + f"-${disc_amt:.2f}".rjust(8))
        if extra > 0:
            t.linea(f"CARGO EXTRA".ljust(ancho - 8) + f"${extra:.2f}".rjust(8))

        total_general = subtotal - round(subtotal * discount / 100) + extra
        importe_total = f"${total_general:.2f}"
        t.linea(f"TOTAL".ljust(ancho - len(importe_total)) + importe_total, bold=True, doble=True)

        if data.get("payment"):
            t.guion()
            t.linea(f"Pago: {data['payment']}")
        if data.get("notes"):
            t.linea(f"Notas: {data['notes']}")

        t.linea("")
        t.linea("Gracias por su visita", "cen")
        t.linea(empresa, "cen", bold=True)
        t.linea(f"{'·' * ancho}")
        t.linea("")

        try:
            printer._enviar(impresora_caja, t.compilar())
            ok_count += 1
        except Exception as e:
            err_count += 1

    return ok_count > 0, f"Estaciones: {ok_count} OK, {err_count} errores"


def imprimir_corte(data):
    """Imprime Corte X, Corte Z o Cierre Diario en la impresora de caja."""
    try:
        t = printer.Ticket(CONFIG.get("ancho_papel", "58"))
        tipo = str(data.get("tipo", "CORTE")).upper()
        negocio = data.get("negocio") or data.get("marca") or "RESTAURANTE"
        ventas = data.get("ventas") or {}
        t.linea("")
        t.linea(str(negocio).upper(), "cen", bold=True)
        t.linea(tipo, "cen", doble=True, bold=True)
        t.linea(datetime.datetime.now().strftime("%d/%m/%Y %H:%M"), "cen")
        t.guion()
        t.linea("Cajero: " + str(data.get("usuario", "")))
        if data.get("abierto_en"):
            t.linea("Turno: " + str(data.get("abierto_en"))[:19].replace("T", " "))
        t.linea("Cuentas: " + str(data.get("pedidos", 0)))
        if data.get("pendientes"):
            t.linea("Pendientes: " + str(data.get("pendientes")), bold=True)
        t.guion(); t.linea("VENTAS POR METODO", "cen", bold=True)
        for etiqueta, clave in (("Efectivo", "efectivo"), ("Tarjeta", "tarjeta"), ("Transferencia", "transferencia"), ("DIDI", "didi"), ("Uber Eats", "uber"), ("Rappi", "rappi"), ("Pagado online", "online"), ("Otros", "otros")):
            valor = float(ventas.get(clave, 0) or 0)
            if valor or clave in ("efectivo", "tarjeta", "transferencia"):
                importe = f"${valor:.2f}"
                t.linea(etiqueta.ljust(t.ancho-len(importe)) + importe)
        subtotal_apps = float(ventas.get("apps", 0) or 0)
        if subtotal_apps:
            importe_apps = f"${subtotal_apps:.2f}"
            t.linea("Subtotal apps".ljust(t.ancho-len(importe_apps)) + importe_apps, bold=True)
        t.guion()
        total = float(ventas.get("total", 0) or 0)
        importe_total = f"${total:.2f}"
        t.linea("TOTAL".ljust(t.ancho-len(importe_total)) + importe_total, bold=True)
        auditoria = data.get("auditoria") or {}
        gastos = auditoria.get("gastos") or {}
        cancelaciones = auditoria.get("cancelaciones") or {}
        descuentos = auditoria.get("descuentos") or {}
        reabiertas = auditoria.get("reabiertas") or {}
        propinas = auditoria.get("propinas") or {}
        impuestos = auditoria.get("impuestos") or {}
        t.guion(); t.linea("CONTROL DE OPERACION", "cen", bold=True)
        t.linea(f"Gastos ({int(gastos.get('cantidad', 0) or 0)}): ${float(gastos.get('total', 0) or 0):.2f}")
        t.linea(f"Descuentos: ${float(descuentos.get('total', 0) or 0):.2f}")
        t.linea(f"Canceladas ({int(cancelaciones.get('cuentas', 0) or 0)}): ${float(cancelaciones.get('cuentas_total', 0) or 0):.2f}")
        t.linea(f"Prod. cancelados ({int(cancelaciones.get('productos', 0) or 0)}): ${float(cancelaciones.get('productos_total', 0) or 0):.2f}")
        t.linea(f"Cuentas reabiertas: {int(reabiertas.get('cantidad', 0) or 0)}")
        t.linea(f"Propinas pagadas: ${float(propinas.get('total', 0) or 0):.2f}", bold=True)
        if float(propinas.get("total", 0) or 0):
            t.linea(f"  Efectivo: ${float(propinas.get('efectivo', 0) or 0):.2f}")
            t.linea(f"  Tarjeta: ${float(propinas.get('tarjeta', 0) or 0):.2f}")
            t.linea(f"  Transferencia: ${float(propinas.get('transferencia', 0) or 0):.2f}")
            t.linea(f"  Otros: ${float(propinas.get('otros', 0) or 0):.2f}")
        if impuestos:
            t.linea(f"IVA {int(impuestos.get('tasa', 16) or 16)}% incluido: ${float(impuestos.get('incluido', 0) or 0):.2f}")
        neto = total - float(gastos.get("total", 0) or 0)
        t.linea(f"VENTA MENOS GASTOS: ${neto:.2f}", bold=True)
        t.linea(f"INGRESO + PROPINAS: ${total + float(propinas.get('total', 0) or 0):.2f}", bold=True)
        if tipo == "CIERRE DE TURNO" or data.get("contado"):
            t.guion(); t.linea("ARQUEO", "cen", bold=True)
            esperado = float(data.get("efectivo_esperado", 0) or 0)
            contado = data.get("contado") or {}
            diferencia = float(data.get("diferencia", 0) or 0)
            t.linea(f"Efectivo esperado: ${esperado:.2f}")
            t.linea("DECLARADO POR CAJERO", "cen", bold=True)
            for etiqueta, clave in (("Efectivo", "efectivo"), ("Tarjeta", "tarjeta"), ("Transferencia", "transferencia"), ("Apps / Otros", "apps")):
                real = float(ventas.get(clave, 0) or 0)
                declarado = float(contado.get(clave, 0) or 0)
                t.linea(f"{etiqueta}: ${declarado:.2f}")
                t.linea(f"  Sistema ${real:.2f} Dif ${declarado-real:.2f}")
            t.linea(f"Total declarado: ${float(contado.get('total', 0) or 0):.2f}")
            t.linea(f"Diferencia: ${diferencia:.2f}", bold=True)
            t.linea("CAJA CUADRADA" if diferencia == 0 else ("SOBRANTE" if diferencia > 0 else "FALTANTE"), "cen", bold=True)
        movimientos = data.get("movimientos") or []
        if movimientos:
            t.guion(); t.linea("MOVIMIENTOS", "cen", bold=True)
            for mov in movimientos[-10:]:
                signo = "+" if mov.get("tipo") == "entrada" else "-"
                t.linea(f"{signo}${float(mov.get('monto', 0) or 0):.2f} {mov.get('concepto', '')}")
        if data.get("notas"):
            t.guion(); t.texto("Nota: " + str(data.get("notas")))
        if data.get("validado"):
            t.guion(); t.linea("DIA VALIDADO", "cen", bold=True)
            t.linea("Sin turnos ni cuentas pendientes", "cen")
        t.guion(); t.linea("IMPORTES EN PESOS MEXICANOS", "cen")
        t.linea("IVA INCLUIDO - NO SE SUMA DE NUEVO", "cen")
        t.linea("INFORMATIVO - NO ES COMPROBANTE FISCAL", "cen"); t.linea("")
        impresora_caja = CONFIG.get("impresoras", {}).get("caja")
        printer._enviar(impresora_caja, t.compilar())
        return True, tipo + " impreso"
    except Exception as exc:
        return False, str(exc)


# ---- Servidor HTTP ----
class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """Servidor HTTP que maneja cada request en un hilo separado."""
    daemon_threads = True


class PrintHandler(BaseHTTPRequestHandler):
    def _es_local(self):
        return self.client_address[0] in ("127.0.0.1", "::1")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/ping":
            self._resp(200, {"ok": True, "msg": "print_server running"})
        elif path == "/printers":
            if not self._es_local():
                self._resp(403, {"error": "La configuracion solo se permite desde la computadora del POS"})
                return
            self._resp(200, {"ok": True, "printers": printer.impresoras(), "configured": CONFIG.get("impresoras", {}), "paper": CONFIG.get("ancho_papel", "58")})
        else:
            self._resp(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path in ("/printer-config", "/printer-test"):
            if not self._es_local():
                self._resp(403, {"error": "La configuracion solo se permite desde la computadora del POS"})
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length).decode("utf-8"))
                if path == "/printer-test":
                    nombre = str(data.get("printer", "")).strip()
                    if nombre not in printer.impresoras():
                        raise ValueError("La impresora seleccionada no esta instalada")
                    printer.imprimir_prueba(nombre, str(data.get("paper", CONFIG.get("ancho_papel", "58"))))
                    self._resp(200, {"ok": True, "msg": "Ticket de prueba enviado"})
                    return
                estaciones = ("caja", "cocina", "sushi", "bebidas", "barra")
                disponibles = set(printer.impresoras())
                nuevas = {}
                for estacion in estaciones:
                    nombre = str((data.get("printers") or {}).get(estacion, "")).strip()
                    if nombre and nombre not in disponibles:
                        raise ValueError(f"Impresora no instalada: {nombre}")
                    nuevas[estacion] = nombre
                papel = str(data.get("paper", "58"))
                if papel not in ("58", "80"):
                    raise ValueError("Ancho de papel invalido")
                CONFIG["impresoras"] = nuevas
                CONFIG["ancho_papel"] = papel
                temporal = CONFIG_PATH + ".tmp"
                with open(temporal, "w", encoding="utf-8") as f:
                    json.dump(CONFIG, f, ensure_ascii=False, indent=2)
                os.replace(temporal, CONFIG_PATH)
                self._resp(200, {"ok": True, "msg": "Configuracion guardada"})
            except Exception as e:
                self._resp(400, {"error": str(e)})
            return
        if path == "/corte":
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception as e:
                self._resp(400, {"error": "invalid JSON", "detail": str(e)})
                return
            ok, msg = imprimir_corte(data)
            self._resp(200 if ok else 500, {"ok": ok, "msg": msg})
            return
        if path == "/cancel":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length)
                data = json.loads(body.decode("utf-8"))
            except Exception as e:
                self._resp(400, {"error": "invalid JSON", "detail": str(e)})
                return
            ok, msg = imprimir_cancelacion(data)
            self._resp(200 if ok else 500, {"ok": ok, "msg": msg})
            return
        if path != "/print":
            self._resp(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body.decode("utf-8"))
        except Exception as e:
            self._resp(400, {"error": "invalid JSON", "detail": str(e)})
            return
        ok, msg = imprimir_pedido_admin(data)
        if ok:
            self._resp(200, {"ok": True, "msg": msg})
        else:
            self._resp(500, {"error": "print failed", "detail": msg})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _resp(self, code, body_dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(body_dict, ensure_ascii=False).encode("utf-8"))

    def log_message(self, format, *args):
        pass


def main():
    p = PORT
    host = "0.0.0.0"
    if "--port" in sys.argv:
        idx = sys.argv.index("--port") + 1
        if idx < len(sys.argv):
            p = int(sys.argv[idx])
    if "--host" in sys.argv:
        idx = sys.argv.index("--host") + 1
        if idx < len(sys.argv):
            host = sys.argv[idx]

    server = ThreadingHTTPServer((host, p), PrintHandler)
    print(f"print_server escuchando en http://{host}:{p}")
    print(f"Impresoras: caja={CONFIG.get('impresoras',{}).get('caja','?')} | cocina={CONFIG.get('impresoras',{}).get('cocina','?')} | sushi={CONFIG.get('impresoras',{}).get('sushi','?')} | bebidas={CONFIG.get('impresoras',{}).get('bebidas','?')}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nprint_server detenido.")
        server.shutdown()


if __name__ == "__main__":
    main()
