# -*- coding: utf-8 -*-
"""Parsea el mensaje de WhatsApp de un pedido en línea.

El mensaje lo arma la página de pedidos (checkout-service.js) con el
formato:

    *Empresa*
    *NUEVO PEDIDO*
    📋 Folio: 42

    *Nombre:* Juan Pérez
    *Teléfono:* 999 123 4567
    *Tipo:* A domicilio
    *Dirección:* ...
    *Pago:* Efectivo

    *PEDIDO*
    1 x California  =  $90

    *TOTAL: $90*

    *Cambios al platillo:*
    sin cebolla

    *Salsas:* Sin comentario
    *Palitos:* No
"""
import re


def _moneda(texto):
    if not texto:
        return 0.0
    t = str(texto).replace(",", "").replace("$", "").replace(" ", "")
    try:
        return float(t)
    except ValueError:
        return 0.0


def _extraer(texto, etiqueta):
    """Extrae '*Etiqueta:* valor'. Devuelve el valor o ''."""
    m = re.search(r"\*?" + re.escape(etiqueta) + r"\*?\s*:\s*\*?\s*([^\n\*]+)", texto)
    if m:
        return m.group(1).strip()
    return ""


def _items(texto):
    """Líneas entre '*PEDIDO*' y '*TOTAL'. Formato: '1 x Nombre  =  $90'."""
    m = re.search(r"\*PEDIDO\*.*?\n(.*?)\*TOTAL", texto, re.S)
    bloque = m.group(1) if m else ""
    items = []
    for linea in bloque.splitlines():
        linea = linea.strip()
        if not linea:
            continue
        im = re.match(r"^(\d+)\s*x\s+(.+?)\s*=\s*\$?\s*([\d.,\s]+)$", linea)
        if im:
            items.append({
                "cantidad": int(im.group(1)),
                "nombre": im.group(2).strip(),
                "total_linea": _moneda(im.group(3)),
            })
    return items


def _notas(texto):
    m = re.search(r"\*Cambios al platillo:\*\s*\*?\s*([^\n\*]+)", texto)
    if m:
        return m.group(1).strip()
    return ""


def parsear_mensaje(texto):
    """Devuelve dict con el pedido estructurado o None si no es un pedido."""
    if not texto or "NUEVO PEDIDO" not in texto.upper():
        return None

    primer = texto.strip().splitlines()[0].strip()
    empresa = primer.strip("*").strip() if primer else ""

    items = _items(texto)
    if not items:
        return None

    mt = re.search(r"\*TOTAL:\s*\$?\s*([\d.,\s]+)\*", texto)
    total = _moneda(mt.group(1)) if mt else 0.0

    folio_txt = _extraer(texto, "Folio")
    tipo = _extraer(texto, "Tipo").lower()
    if "domicilio" in tipo:
        tipo_servicio = "domicilio"
    elif "llevar" in tipo or "para llevar" in tipo:
        tipo_servicio = "llevar"
    else:
        tipo_servicio = tipo

    return {
        "empresa": empresa,
        "folio": folio_txt,
        "cliente": _extraer(texto, "Nombre"),
        "telefono": _extraer(texto, "Teléfono") or _extraer(texto, "Telefono"),
        "tipo_servicio": tipo_servicio,
        "direccion": _extraer(texto, "Dirección") or _extraer(texto, "Direccion"),
        "pago": _extraer(texto, "Pago"),
        "salsas": _extraer(texto, "Salsas") or "Sin comentario",
        "palitos": _extraer(texto, "Palitos") or "No",
        "notas": _notas(texto),
        "total": total,
        "items": items,
    }
