# -*- coding: utf-8 -*-
"""Consulta pedidos nuevos en Supabase y los convierte al formato interno.

Las páginas de pedido guardan cada pedido en la tabla `orders` de Supabase
(status='nuevo'). Este módulo los lee por marca y marca como 'recibido'
una vez impresos.
"""
import json
import urllib.parse
import urllib.request


def _request(url, metodo="GET", headers=None, data=None, timeout=20):
    req = urllib.request.Request(url, method=metodo, headers=headers or {})
    body = None
    if data is not None:
        req.add_header("Content-Type", "application/json")
        body = json.dumps(data).encode("utf-8")
    with urllib.request.urlopen(req, body, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8")


class SupabaseOrders:
    def __init__(self, url, key):
        self.base = url.rstrip("/") + "/rest/v1/orders"
        self._headers = {
            "apikey": key,
            "Authorization": "Bearer " + key,
        }

    def nuevos(self, marca, limite=50):
        q = urllib.parse.urlencode({
            "select": "*",
            "status": "eq.nuevo",
            "marca": "eq." + marca,
            "order": "created_at.asc",
            "limit": str(limite),
        })
        st, body = _request(self.base + "?" + q, headers=self._headers)
        if st >= 300:
            raise RuntimeError("Supabase GET {0}: {1}".format(st, body[:300]))
        return json.loads(body) or []

    def marcar(self, id, status="recibido"):
        st, body = _request(
            self.base + "?id=eq." + urllib.parse.quote(id),
            metodo="PATCH",
            headers=dict(self._headers, Prefer="return=minimal"),
            data={"status": status})
        if st >= 300:
            raise RuntimeError("Supabase PATCH {0}: {1}".format(st, body[:300]))


def order_a_pedido(fila):
    """Convierte una fila de `orders` al formato interno del procesador."""
    items = []
    for it in fila.get("items") or []:
        cant = int(it.get("qty") or 1)
        precio = float(it.get("price") or 0)
        items.append({
            "cantidad": cant,
            "nombre": it.get("name") or "",
            "total_linea": round(precio * cant, 2),
        })
    return {
        "folio": fila.get("folio") or "",
        "cliente": fila.get("name") or "",
        "telefono": fila.get("phone") or "",
        "tipo_servicio": "domicilio" if (fila.get("order_type") or "") == "domicilio" else "llevar",
        "direccion": fila.get("address") or "",
        "pago": fila.get("payment") or "",
        "salsas": fila.get("salsas") or "",
        "palitos": fila.get("palitos") or "",
        "notas": fila.get("notes") or "",
        "total": float(fila.get("total") or 0),
        "items": items,
        "_id_supabase": fila.get("id"),
    }


def estaciones_por_nombre(url, key, marca):
    """Consulta menu_items y devuelve {nombre_normalizado: estacion}."""
    sup = SupabaseOrders(url, key)
    ep = sup.base.replace("/orders", "/menu_items")
    q = urllib.parse.urlencode({
        "select": "nombre,estacion",
        "marca": "eq." + marca,
    })
    st, body = _request(ep + "?" + q, headers=sup._headers)
    if st >= 300:
        raise RuntimeError("Supabase GET {0}: {1}".format(st, body[:300]))
    filas = json.loads(body) or []
    mapa = {}
    for f in filas:
        n = (f.get("nombre") or "").strip().lower()
        e = (f.get("estacion") or "").strip()
        if n and e:
            mapa[n] = e
    return mapa
