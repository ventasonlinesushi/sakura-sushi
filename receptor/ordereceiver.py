# -*- coding: utf-8 -*-
"""Receptor de pedidos en línea.

Modos:
    python main.py --marca sakura                 # vigila Supabase (producción)
    python main.py --marca sakura --prueba pedido.txt   # procesa un mensaje de prueba e imprime
    python main.py --probar-impresora "YICHIP POS-58"   # ticket de prueba
    python main.py --lista-impresoras
    python main.py --recientes
"""
import argparse
import hashlib
import json
import logging
import os
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import printer
import procesador
from parser_pedido import parsear_mensaje
from store import Store
from supabase_orders import SupabaseOrders, order_a_pedido, estaciones_por_nombre

AQUI = os.path.dirname(os.path.abspath(__file__))


def cargar_config(ruta):
    ruta = ruta or os.path.join(AQUI, "config.json")
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def configurar_log(ruta):
    os.makedirs(os.path.join(AQUI, "logs"), exist_ok=True)
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    fh = logging.FileHandler(os.path.join(AQUI, "logs", "receptor.log"), encoding="utf-8")
    fh.setFormatter(fmt)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    root.addHandler(fh)
    root.addHandler(sh)


def modo_prueba(cfg, ruta_mensaje):
    with open(ruta_mensaje, encoding="utf-8") as f:
        texto = f.read()
    pedido = parsear_mensaje(texto)
    if not pedido:
        logging.error("El mensaje de prueba no es un pedido válido.")
        return 1
    pedido["_mensaje"] = texto
    store = Store(os.path.join(AQUI, "pedidos.db"))
    try:
        resultado = procesador.procesar(cfg, store, pedido)
        for k, v in resultado.items():
            estado = "OK" if v.get("ok") else f"ERROR: {v.get('error')}"
            print(f"  {k.upper():<8} {estado}")
        print("Pedido registrado en pedidos.db")
    finally:
        store.cerrar()
    return 0


def main():
    ap = argparse.ArgumentParser(description="Receptor de pedidos en línea")
    ap.add_argument("--marca", default="sakura", choices=["sakura", "mandala"])
    ap.add_argument("--config", default=None)
    ap.add_argument("--prueba", default=None, metavar="ARCHIVO")
    ap.add_argument("--probar-impresora", default=None, metavar="IMPRESORA")
    ap.add_argument("--lista-impresoras", action="store_true")
    ap.add_argument("--recientes", action="store_true")
    args = ap.parse_args()

    configurar_log(os.path.join(AQUI, "logs"))
    cfg = cargar_config(args.config)
    cfg["marca"] = args.marca

    if args.lista_impresoras:
        print("\n".join(printer.impresoras()))
        return 0

    if args.probar_impresora:
        printer.imprimir_prueba(args.probar_impresora, cfg.get("ancho_papel", "58"))
        print(f"Ticket de prueba enviado a: {args.probar_impresora}")
        return 0

    store = Store(os.path.join(AQUI, "pedidos.db"))

    if args.recientes:
        for p in store.recientes():
            print(f"#{p['id']} {p['recibido_en']} folio={p['folio']} {p['cliente']} ${p['total']}")
        store.cerrar()
        return 0

    if args.prueba:
        store.cerrar()
        return modo_prueba(cfg, args.prueba)

    # Modo vigilante (producción): consulta Supabase y procesa lo nuevo.
    sb = cfg.get("supabase") or {}
    if not sb.get("url") or not sb.get("key"):
        logging.error("Falta la configuración 'supabase' en config.json")
        return 1
    poller = SupabaseOrders(sb["url"], sb["key"])
    intervalo = float(cfg.get("intervalo_polling") or 6)

    # Cargar mapa de estaciones desde Supabase
    try:
        cfg["estaciones_nombre"] = estaciones_por_nombre(sb["url"], sb["key"], cfg["marca"])
        logging.info("Estaciones cargadas: %d productos", len(cfg["estaciones_nombre"]))
    except Exception as e:
        logging.warning("No se pudieron cargar estaciones: %s", e)

    logging.info("Escuchando pedidos nuevos de %s en Supabase...", cfg["marca"])
    try:
        while True:
            _ciclo_supabase(cfg, store, poller)
            time.sleep(intervalo)
    except KeyboardInterrupt:
        pass
    finally:
        store.cerrar()
    return 0


def _ciclo_supabase(cfg, store, poller):
    try:
        filas = poller.nuevos(cfg["marca"])
    except Exception as e:
        logging.warning("Error consultando Supabase: %s", e)
        return
    for fila in filas:
        oid = fila.get("id") or ""
        h = hashlib.sha256(f"sb|{oid}".encode("utf-8")).hexdigest()
        if store.ya_procesado(h):
            logging.info("Pedido %s ya procesado, se omite.", oid)
            continue
        pedido = order_a_pedido(fila)
        pedido["_mensaje"] = json.dumps(fila, ensure_ascii=False)
        logging.info("PEDIDO Folio=%s Cliente=%s Total=%s",
                     pedido.get("folio"), pedido.get("cliente"), pedido.get("total"))
        try:
            resultado = procesador.procesar(cfg, store, pedido)
            store.marcar_procesado(h)
            poller.marcar(oid, "recibido")
            resumen = []
            for k, v in resultado.items():
                if v and v.get("ok"):
                    resumen.append(k.upper())
                elif v and v.get("error"):
                    resumen.append(k.upper() + "(ERR)")
            logging.info("Impreso: %s", " | ".join(resumen) or "nada")
        except Exception as e:
            logging.error("Error procesando pedido %s: %s", oid, e)


if __name__ == "__main__":
    sys.exit(main())
