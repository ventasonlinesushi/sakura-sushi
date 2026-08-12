# -*- coding: utf-8 -*-
"""Desglosa paquetes en productos de producción sin modificar la cuenta."""


def _linea(nombre, cantidad=1, estacion=None):
    linea = {"cantidad": int(cantidad), "nombre": nombre, "total_linea": 0.0}
    if estacion:
        linea["estacion"] = estacion
    return linea


def _selecciones(nombre):
    if " · " not in nombre:
        return []
    return [x.strip() for x in nombre.split(" · ", 1)[1].split(" + ") if x.strip()]


def _rollos(nombre, esperados, cantidad_paquete):
    elegidos = _selecciones(nombre)
    lineas = [_linea(rollo, cantidad_paquete, "sushi") for rollo in elegidos]
    if len(elegidos) != esperados:
        lineas.append(_linea("ATENCION: ROLLOS DEL PAQUETE NO ESPECIFICADOS", cantidad_paquete, "sushi"))
    return lineas


def expandir_items(items, marca="sakura"):
    """Recibe ítems internos y devuelve los componentes para cocina/sushi/barra."""
    salida = []
    for item in items or []:
        nombre = str(item.get("nombre") or item.get("name") or "").strip()
        cantidad = int(item.get("cantidad") or item.get("qty") or 1)
        bajo = nombre.lower()

        if bajo.startswith("2 rollos x $150"):
            salida.extend(_rollos(nombre, 2, cantidad))
        elif bajo.startswith("super paquete 4 rollos x $379"):
            salida.extend(_rollos(nombre, 4, cantidad))
            salida.extend((_linea("Oniguri de Philadelphia Empanizado", 3 * cantidad, "cocina"),
                           _linea("Papas a la Francesa", cantidad, "cocina"),
                           _linea("Nestea", 2 * cantidad, "bebidas")))
        elif bajo.startswith("sakura lunch"):
            salida.extend(_rollos(nombre, 1, cantidad))
            salida.extend((_linea("Medio Yakimeshi de Pollo", cantidad, "cocina"),
                           _linea("Dedo de Queso Gouda", cantidad, "cocina"),
                           _linea("Nestea", cantidad, "bebidas")))
        elif bajo.startswith("2 yakimeshi de pollo"):
            salida.append(_linea("Yakimeshi de Pollo", 2 * cantidad, "cocina"))
        elif marca == "mandala" and bajo.startswith("2 rollos x $169"):
            salida.extend(_rollos(nombre, 2, cantidad))
        elif marca == "mandala" and bajo.startswith("paquete pareja"):
            salida.extend(_rollos(nombre, 2, cantidad))
            salida.extend((_linea("Yakimeshi de Pollo o Vegetariano", 2 * cantidad),
                           _linea("Dedo de Queso Gouda", 2 * cantidad)))
        elif marca == "mandala" and bajo.startswith("paquete familiar"):
            salida.extend(_rollos(nombre, 4, cantidad))
            salida.extend((_linea("Yakimeshi de Pollo", 2 * cantidad),
                           _linea("Dedo de Queso Philadelphia", 3 * cantidad),
                           _linea("Panchitos Jalapeños con Philadelphia", cantidad)))
        else:
            salida.append(dict(item))
    return salida
