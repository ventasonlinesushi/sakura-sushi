# -*- coding: utf-8 -*-
"""Registro local de pedidos recibidos por WhatsApp (SQLite)."""
import os
import sqlite3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marca TEXT,
    folio TEXT,
    cliente TEXT,
    telefono TEXT,
    tipo_servicio TEXT,
    direccion TEXT,
    pago TEXT,
    total REAL,
    mensaje TEXT,
    recibido_en TEXT DEFAULT (datetime('now','localtime')),
    impreso INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lineas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER,
    nombre TEXT,
    cantidad INTEGER,
    total_linea REAL,
    estacion TEXT
);
CREATE TABLE IF NOT EXISTS procesados (
    hash TEXT PRIMARY KEY,
    procesado_en TEXT DEFAULT (datetime('now','localtime'))
);
"""


class Store:
    def __init__(self, ruta_bd):
        os.makedirs(os.path.dirname(ruta_bd) or ".", exist_ok=True)
        self.ruta = ruta_bd
        self._conn = sqlite3.connect(ruta_bd)
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def cerrar(self):
        try:
            self._conn.close()
        except Exception:
            pass

    def ya_procesado(self, hash_msg):
        fila = self._conn.execute("SELECT 1 FROM procesados WHERE hash = ?", (hash_msg,)).fetchone()
        return fila is not None

    def marcar_procesado(self, hash_msg):
        self._conn.execute("INSERT OR IGNORE INTO procesados (hash) VALUES (?)", (hash_msg,))
        self._conn.commit()

    def guardar_pedido(self, pedido, marca, lineas_estacion):
        """lineas_estacion: lista de (estacion, [dict cantidad/nombre/total_linea])."""
        cur = self._conn.execute(
            """INSERT INTO pedidos (marca, folio, cliente, telefono, tipo_servicio, direccion, pago, total, mensaje)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (marca, pedido.get("folio"), pedido.get("cliente"), pedido.get("telefono"),
             pedido.get("tipo_servicio"), pedido.get("direccion"), pedido.get("pago"),
             pedido.get("total"), pedido.get("_mensaje", "")))
        pedido_id = cur.lastrowid
        for estacion, lineas in lineas_estacion:
            for ln in lineas:
                self._conn.execute(
                    "INSERT INTO lineas (pedido_id, nombre, cantidad, total_linea, estacion) VALUES (?,?,?,?,?)",
                    (pedido_id, ln["nombre"], ln["cantidad"], ln["total_linea"], estacion))
        self._conn.execute("UPDATE pedidos SET impreso = 1 WHERE id = ?", (pedido_id,))
        self._conn.commit()
        return pedido_id

    def recientes(self, limite=20):
        cols = ["id", "marca", "folio", "cliente", "telefono", "tipo_servicio",
                "direccion", "pago", "total", "recibido_en", "impreso"]
        filas = self._conn.execute(
            "SELECT " + ",".join(cols) + " FROM pedidos ORDER BY id DESC LIMIT ?",
            (limite,)).fetchall()
        return [dict(zip(cols, f)) for f in filas]
