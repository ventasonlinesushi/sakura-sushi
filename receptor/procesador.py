# -*- coding: utf-8 -*-
"""Procesa un pedido parseado: asigna estación, imprime e registra."""
import logging

import printer
from menu_loader import BuscadorMenu, leer_menu

log = logging.getLogger("procesador")

ESTACIONES = ("cocina", "sushi", "bebidas", "barra")


def _cargar_menu(cfg):
    marca = cfg["marcas"][cfg["marca"]]
    menu = leer_menu(marca["directorio_pedidos"])
    return BuscadorMenu(menu)


def _agrupar(pedido, buscador, mapa_categorias, mapa_nombres=None):
    """Agrupa ítems por estación. Si mapa_nombres existe, lo usa primero."""
    grupos = {e: [] for e in ESTACIONES}
    for ln in pedido.get("items_produccion") or pedido["items"]:
        nombre_lower = (ln["nombre"] or "").strip().lower()
        est = ln.get("estacion")
        if mapa_nombres:
            est = mapa_nombres.get(nombre_lower)
        if not est:
            est = buscador.estacion(ln["nombre"], mapa_categorias)
        ln["estacion"] = est
        grupos.setdefault(est, []).append(ln)
    return grupos


def procesar(cfg, store, pedido):
    """Imprime por estación + cuenta y registra el pedido."""
    buscador = _cargar_menu(cfg)
    mapa_nombres = cfg.get("estaciones_nombre") or {}
    grupos = _agrupar(pedido, buscador, cfg.get("categorias_estacion") or {}, mapa_nombres)

    resultado = {}

    for est in ESTACIONES:
        lineas = grupos.get(est) or []
        if not lineas:
            continue
        nombre_imp = cfg["impresoras"].get(est) or cfg["impresoras"].get("caja")
        err, n = printer.imprimir_estacion(cfg, pedido, est, lineas, nombre_imp)
        resultado[est] = {"ok": not err, "error": err, "lineas": n}
        log.info("Estación %s: %d línea(s) %s", est, n, "OK" if not err else "ERROR " + str(err))

    err_c, n_c = printer.imprimir_cuenta(cfg, pedido)
    resultado["cuenta"] = {"ok": not err_c, "error": err_c, "lineas": n_c}
    log.info("Cuenta: %s", "OK" if not err_c else "ERROR " + str(err_c))

    if store is not None:
        store.guardar_pedido(pedido, cfg["marca"], list(grupos.items()))

    return resultado
