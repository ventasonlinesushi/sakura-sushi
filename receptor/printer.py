# -*- coding: utf-8 -*-
"""Impresión de tickets térmicos ESC/POS por estación y cuenta.

Usa win32print para enviar bytes crudos a la impresora configurada.
Ancho 58 mm -> 32 columnas; 80 mm -> 42 columnas.
"""
import datetime
import re
import time

import win32print

from package_expander import expandir_items

ANCHOS = {"58": 32, "80": 42, "56": 32}

# Comandos ESC/POS
_INI = b"\x1b\x40"          # ESC @
_CP850 = b"\x1b\x74\x11"    # ESC t 17 (code page 850)
_IZQ = b"\x1b\x61\x00"      # ESC a 0
_CEN = b"\x1b\x61\x01"      # ESC a 1
_DER = b"\x1b\x61\x02"      # ESC a 2
_BOLD_ON = b"\x1b\x45\x01"  # ESC E 1
_BOLD_OFF = b"\x1b\x45\x00"
_DH = b"\x1b\x21\x10"       # doble altura (con ESC !)
_MODO_OFF = b"\x1b\x21\x00"
_CUT = b"\x1d\x56\x42"      # GS V 66 (corte total)
_FEED = b"\n\n"


def impresoras():
    return [p[2] for p in win32print.EnumPrinters(2)]


def _bytes(texto):
    out = bytearray()
    for ch in str(texto):
        try:
            out += ch.encode("cp850")
        except UnicodeEncodeError:
            pass  # emojis y símbolos no imprimibles se omiten
    return bytes(out)


class Ticket:
    def __init__(self, ancho_papel="58"):
        self.ancho = ANCHOS.get(str(ancho_papel), 32)
        self._buf = bytearray()

    def linea(self, texto="", al="izq", doble=False, bold=False):
        if al == "cen":
            linea = _centrar(texto, self.ancho, doble)
        elif al == "der":
            linea = texto.rjust(self.ancho)
        else:
            linea = texto
        if doble:
            self._buf += _DH
        if bold:
            self._buf += _BOLD_ON
        self._buf += _IZQ if al == "izq" else _CEN if al == "cen" else _DER
        self._buf += _bytes(linea) + b"\n"
        if bold:
            self._buf += _BOLD_OFF
        if doble:
            self._buf += _MODO_OFF
        self._buf += _IZQ

    def separador(self, ch="="):
        self.linea(ch * self.ancho)

    def guion(self):
        self.linea("-" * self.ancho)

    def blanco(self, n=1):
        for _ in range(n):
            self.linea()

    def item(self, cantidad, nombre, total_linea):
        precio = f"{total_linea:.2f}"
        disp = self.ancho - len(precio) - 3
        nombre = _cortar(nombre, disp)
        linea = f"{cantidad}x {nombre}".ljust(self.ancho - len(precio)) + precio
        self.linea(linea)

    def texto(self, texto, al="izq", bold=False):
        for renglon in _ajustar(texto, self.ancho):
            self.linea(renglon, al, bold=bold)

    def compilar(self):
        return bytes(_INI + _CP850 + self._buf) + _FEED + _CUT


def _cortar(texto, ancho):
    t = texto
    if len(t) > ancho:
        t = t[: ancho - 1] + "."
    return t


def _ajustar(texto, ancho):
    texto = texto or ""
    if len(texto) <= ancho:
        return [texto]
    renglones = []
    for palabra in texto.split(" "):
        if not renglones or len(renglones[-1]) + len(palabra) + 1 > ancho:
            if len(palabra) > ancho:
                renglones.append(palabra[:ancho])
                renglones.append(palabra[ancho:])
            else:
                renglones.append(palabra)
        else:
            renglones[-1] += " " + palabra
    return renglones


def _centrar(texto, ancho, doble=False):
    largo = len(texto) * (2 if doble else 1)
    if largo >= ancho:
        return texto
    return " " * ((ancho - largo) // 2) + texto


def _enviar(nombre_impresora, datos):
    if not nombre_impresora:
        raise ValueError("No hay impresora configurada para esta estación")
    h = win32print.OpenPrinter(nombre_impresora)
    try:
        win32print.StartDocPrinter(h, 1, ("ticket", None, "RAW"))
        try:
            win32print.StartPagePrinter(h)
            win32print.WritePrinter(h, datos)
            win32print.EndPagePrinter(h)
        finally:
            win32print.EndDocPrinter(h)
    finally:
        win32print.ClosePrinter(h)


def _ahora():
    return datetime.datetime.now().strftime("%d/%m/%Y %H:%M")


def _tipo_texto(pedido):
    return {"domicilio": "A DOMICILIO", "llevar": "PARA LLEVAR"}.get(
        pedido.get("tipo_servicio"), (pedido.get("tipo_servicio") or "").upper())


def _encabezado(t, cfg, pedido):
    marca = cfg["marcas"][cfg["marca"]]
    t.linea("")
    t.linea(marca["empresa"], "cen", doble=True, bold=True)
    t.linea("PEDIDO EN LINEA", "cen", bold=True)
    t.linea("*" * (t.ancho - 1), "cen")
    t.linea(f"Folio: {pedido.get('folio') or '?'}     {_tipo_texto(pedido)}", "izq")
    if pedido.get("cliente"):
        t.linea(f"Cliente: {pedido['cliente']}")
    if pedido.get("telefono"):
        t.linea(f"Tel: {pedido['telefono']}")
    if pedido.get("tipo_servicio") == "domicilio" and pedido.get("direccion"):
        t.linea(f"Dir: {pedido['direccion']}")
    if pedido.get("notas"):
        t.linea(f"Nota: {pedido['notas']}")
    t.guion()


def imprimir_estacion(cfg, pedido, estacion, lineas, nombre_impresora):
    """lineas: lista de dicts con cantidad/nombre/total_linea."""
    if not lineas or not nombre_impresora:
        return None, 0
    t = Ticket(cfg.get("ancho_papel"))
    _encabezado(t, cfg, pedido)
    t.linea(f"ESTACION: {estacion.upper()}", "cen", bold=True)
    t.guion()
    subtotal = 0.0
    for ln in lineas:
        t.item(ln["cantidad"], ln["nombre"], ln["total_linea"])
        if ln.get("paquete"):
            t.texto("  PAQUETE: " + str(ln["paquete"]), bold=True)
        subtotal += ln["total_linea"]
    t.guion()
    t.linea(f"TOTAL {estacion.upper()}".ljust(t.ancho - len(f"{subtotal:.2f}")) + f"{subtotal:.2f}", "izq", bold=True)
    t.blanco()
    t.linea(f"Enviado: {_ahora()}", "izq")
    t.linea("", "izq")
    err = None
    try:
        _enviar(nombre_impresora, t.compilar())
    except Exception as e:
        err = str(e)
    return err, len(lineas)


def imprimir_cuenta(cfg, pedido):
    t = Ticket(cfg.get("ancho_papel"))
    marca = cfg["marcas"][cfg["marca"]]
    t.linea("")
    t.linea(marca["empresa"], "cen", doble=True, bold=True)
    t.linea("CUENTA · PEDIDO EN LINEA", "cen", bold=True)
    t.linea("*" * (t.ancho - 1), "cen")
    t.linea(f"Folio: {pedido.get('folio') or '?'}     {_tipo_texto(pedido)}")
    if pedido.get("cliente"):
        t.linea(f"Cliente: {pedido['cliente']}")
    if pedido.get("telefono"):
        t.linea(f"Tel: {pedido['telefono']}")
    if pedido.get("tipo_servicio") == "domicilio" and pedido.get("direccion"):
        t.linea(f"Dir: {pedido['direccion']}")
    t.guion()

    subtotal = 0.0
    for ln in pedido["items"]:
        t.item(ln["cantidad"], ln["nombre"], ln["total_linea"])
        detalles = expandir_items([ln], cfg.get("marca") or "sakura")
        if len(detalles) != 1 or detalles[0].get("nombre") != ln["nombre"]:
            t.linea("  INCLUYE:", bold=True)
            for detalle in detalles:
                t.texto(f"   {detalle.get('cantidad', 1)}x {detalle.get('nombre', '')}")
        subtotal += ln["total_linea"]

    t.guion()
    t.linea("Subtotal".ljust(t.ancho - len(f"{subtotal:.2f}")) + f"{subtotal:.2f}")
    if pedido.get("tipo_servicio") == "domicilio":
        t.linea("Envio".ljust(t.ancho - len("costo")) + "costo segun ubicacion")
    total = pedido.get("total") or subtotal
    t.linea(("TOTAL A PAGAR").ljust(t.ancho - len(f"${total:.2f}")) + f"${total:.2f}", "izq", bold=True)
    if pedido.get("pago"):
        t.linea(f"Pago: {pedido['pago']}")
    if pedido.get("salsas"):
        t.linea(f"Salsas: {pedido['salsas']}")
    if pedido.get("palitos"):
        t.linea(f"Palitos: {pedido['palitos']}")
    if pedido.get("notas"):
        t.linea(f"Notas: {pedido['notas']}")
    t.blanco()
    t.linea(f"Recibido: {_ahora()}", "izq")
    t.linea("Gracias por tu pedido!", "cen")
    err = None
    try:
        _enviar(cfg["impresoras"]["caja"], t.compilar())
    except Exception as e:
        err = str(e)
    return err, len(pedido["items"])


def imprimir_prueba(nombre_impresora, ancho_papel="58"):
    t = Ticket(ancho_papel)
    t.linea("")
    t.linea("PRUEBA DE IMPRESION", "cen", doble=True, bold=True)
    t.separador()
    t.linea("Sistema de pedidos en linea")
    t.linea("Estaciones: COCINA · SUSHI · BEBIDAS")
    t.item(2, "California", 180.00)
    t.item(1, "Yakimeshi de Pollo", 95.00)
    t.guion()
    t.linea("TOTAL".ljust(t.ancho - len("275.00")) + "275.00", bold=True)
    t.linea(f"{datetime.datetime.now():%d/%m/%Y %H:%M}", "izq")
    t.linea("", "izq")
    _enviar(nombre_impresora, t.compilar())
