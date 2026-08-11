# -*- coding: utf-8 -*-
"""Carga el menú desde menu-data.js de la página de pedidos.

Devuelve la estructura: { categoria: [nombre_producto, ...] }.
Lee el archivo JS directamente para que los cambios del menú se
reflejen sin tocar el receptor.
"""
import os
import re
import unicodedata

_ACENTOS = None


def _normalizar(texto):
    """Minúsculas, sin acentos, espacios compactos."""
    if not texto:
        return ""
    global _ACENTOS
    if _ACENTOS is None:
        _ACENTOS = dict.fromkeys(
            (c for c in range(ord("\u0300"), ord("\u0301") + 1) if unicodedata.category(chr(c)) == "Mn"), ""
        )
    t = unicodedata.normalize("NFD", texto).translate(_ACENTOS)
    return " ".join(t.lower().split())


def leer_menu(directorio):
    """directorio = carpeta del proyecto de pedidos (con js/data/menu-data.js)."""
    ruta = os.path.join(directorio, "js", "data", "menu-data.js")
    if not os.path.exists(ruta):
        raise FileNotFoundError("No existe el menú: " + ruta)
    with open(ruta, encoding="utf-8") as f:
        src = f.read()

    menu = {}
    categoria = None
    pat_cat = re.compile(r'^\s*name:\s*"([^"]+)",?\s*$')
    pat_item = re.compile(r'^\s*\{\s*name:\s*"([^"]+)"')

    for linea in src.splitlines():
        m = pat_cat.match(linea)
        if m:
            categoria = m.group(1)
            menu.setdefault(categoria, [])
            continue
        if categoria is not None:
            m2 = pat_item.match(linea)
            if m2:
                nombre = m2.group(1)
                if nombre not in menu[categoria]:
                    menu[categoria].append(nombre)
    return menu


class BuscadorMenu:
    """Mapa nombre-normalizado -> categoria, para asignar estación."""

    def __init__(self, menu):
        self._categoria_por_nombre = {}
        self._nombre_real = {}
        for categoria, items in menu.items():
            for nombre in items:
                clave = _normalizar(nombre)
                self._categoria_por_nombre[clave] = categoria
                self._nombre_real[clave] = nombre

    def buscar(self, texto):
        """Devuelve (categoria, nombre_catalogo, nombre_original) o (None, None, None)."""
        if not texto:
            return None, None, None
        clave = _normalizar(texto)
        if clave in self._categoria_por_nombre:
            return self._categoria_por_nombre[clave], self._nombre_real[clave], clave

        # Variante entre paréntesis: "Gohan Spicy (Camarón)" -> busca sin el paréntesis
        m = re.match(r"^(.*?)\s*\([^)]*\)\s*$", texto)
        if m:
            clave2 = _normalizar(m.group(1))
            if clave2 in self._categoria_por_nombre:
                return self._categoria_por_nombre[clave2], self._nombre_real[clave2], clave

        # Coincidencia parcial: nombre del menú contenido en el texto (p. ej. "2 Rollos x $150")
        for k, cat in sorted(self._categoria_por_nombre.items(), key=lambda x: -len(x[0])):
            if k and k in clave:
                return cat, self._nombre_real[k], clave
        return None, None, None

    def estacion(self, texto, mapa_categorias):
        """Asigna estación según la categoría encontrada y el mapa de palabras clave."""
        categoria, _, _ = self.buscar(texto)
        if not categoria:
            return "cocina"
        cat_norm = _normalizar(categoria)
        for estacion, claves in mapa_categorias.items():
            if _coincide_categoria(cat_norm, claves):
                return estacion
        return "cocina"


def _coincide_categoria(cat_norm, claves):
    palabras = set(cat_norm.split())
    for k in (c or "" for c in claves):
        k = k.strip()
        if not k:
            continue
        if " " in k:  # clave compuesta: se busca como frase
            if k in cat_norm:
                return True
            continue
        if len(k) >= 4:
            if any(p == k or p.startswith(k) for p in palabras):
                return True
        elif k in palabras:
            return True
    return False
