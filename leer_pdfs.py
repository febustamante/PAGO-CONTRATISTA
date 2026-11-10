"""Lee liquidaciones de sueldo e imposiciones (comprobante de Previred) en PDF digital y genera resultado.json.

No usa Claude ni internet: lee el texto del PDF directamente, por eso es gratis, exacto y rápido.
Sirve para PDF que se pueden seleccionar con el cursor (los que salen del programa de remuneraciones y de Previred).
Para papel escaneado o contratos se sigue usando Claude (ver INSTRUCCIONES_ESCANEOS.md).

Requiere:  pip install pymupdf
Uso:
  python leer_pdfs.py --contratista "ROBINSON ZURITA" --liquidaciones Liq2026-08.pdf --imposiciones "IMPOSICIONES AGOSTO 2026.pdf" --salida resultado.json
Después:  python cargar_escaneos.py resultado.json
"""
import argparse
import json
import re
import sys
import warnings

warnings.filterwarnings("ignore")
try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("Falta instalar PyMuPDF:  pip install pymupdf")

RUT = re.compile(r"\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b")
MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
         "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12}


def norm_rut(r):
    return r.replace(".", "").upper()


def num(s):
    """'1.234' -> 1234 ; '23,5' -> 23.5"""
    s = s.strip().replace("(", "").replace(")", "")
    if "," in s:
        return float(s.replace(".", "").replace(",", "."))
    return int(s.replace(".", ""))


def lineas(pagina):
    """Agrupa las palabras de la página por línea visual (misma altura)."""
    filas = {}
    for x0, y0, x1, y1, w, *_ in pagina.get_text("words"):
        filas.setdefault(round(y0 / 3), []).append((x0, w))
    return [" ".join(w for _, w in sorted(f)) for _, f in sorted(filas.items())]


def liquidaciones(ruta, contratista):
    salida, saltadas = [], []
    for n, pag in enumerate(fitz.open(ruta), 1):
        ls = lineas(pag)
        texto = "\n".join(ls)
        if "LIQUIDACION DE REMUNERACIONES" not in texto.upper().replace("LIQUIDACIÓN", "LIQUIDACION"):
            continue
        try:
            per = re.search(r"Per[ií]odo\s*:\s*([A-Za-zñÑ]+)\s+de\s+(\d{4})", texto)
            periodo = f"{int(per.group(2)):04d}-{MESES[per.group(1).lower()]:02d}"
            rut = None
            for l in ls:  # el RUT del trabajador va en la línea de RUT que no tiene "Período"
                m = RUT.search(l)
                if l.strip().startswith("RUT") and m and "odo" not in l:
                    rut = m.group(0)
                    break
            nombre = re.search(r"TRABAJADOR\s+(.+?)\s+CARGO", texto.replace("\n", " "))
            base = re.search(r"Base Imponible\s*:\s*([\d.]+)", texto)
            dias = re.search(r"d[ií]as trabajados\s*:\s*([\d.,]+)", texto, re.I)
            liquido = re.search(r"Total L[ií]quido a Pagar\s+([\d.]+)", texto)
            if not (rut and base and dias):
                raise ValueError("faltan datos")
            salida.append({
                "tipo": "liquidacion", "rut": norm_rut(rut), "nombre": nombre.group(1).strip() if nombre else None,
                "contratista": contratista, "periodo": periodo, "archivo": f"{ruta.split(chr(92))[-1].split('/')[-1]} página {n}",
                "datos": {"dias_trabajados": num(dias.group(1)), "renta_imponible": num(base.group(1)),
                          "sueldo_liquido": num(liquido.group(1)) if liquido else None}})
        except Exception:
            saltadas.append(n)
    return salida, saltadas


def imposiciones(ruta, contratista):
    """Suma la remuneración imponible por RUT en las páginas de detalle del fondo de pensiones (AFP)."""
    pers = {}
    periodo = None
    filas_pag = []
    for pag in fitz.open(ruta):
        texto = pag.get_text()
        m = re.search(r"Per[ií]odo de Remuneraciones:\s*(\d{2})/(\d{4})", texto)
        if m:
            periodo = f"{m.group(2)}-{m.group(1)}"
        if "FONDO DE PENSIONES" not in texto or "DETALLE DE PAGO" not in texto:
            continue
        actual = None
        for l in texto.splitlines():
            l = l.strip()
            m = RUT.match(l)
            if m:
                nombre = l[m.end():].strip()
                if not nombre:
                    actual = None
                    continue
                actual = {"rut": norm_rut(m.group(0)), "nombre": nombre, "primero": None}
                filas_pag.append(actual)
            elif actual is not None and actual["primero"] is None and re.fullmatch(r"[\d.]+", l):
                actual["primero"] = num(l)  # primera cifra después del nombre = remuneración imponible (fondo de pensiones)
        for f in filas_pag:
            if f["primero"] is None:
                continue
            d = pers.setdefault(f["rut"], {"nombre": f["nombre"], "renta": 0, "filas": 0})
            d["renta"] += f["primero"]
            d["filas"] += 1
        filas_pag.clear()
    if not periodo:
        sys.exit("No se encontró el período en el archivo de imposiciones.")
    return [{"tipo": "imposicion", "rut": r, "nombre": d["nombre"], "contratista": contratista, "periodo": periodo,
             "archivo": ruta.split(chr(92))[-1].split("/")[-1], "datos": {"renta_imponible": d["renta"]}} for r, d in pers.items()]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--contratista", required=True, help="nombre del contratista, como aparece en Pagos (ej. ROBINSON ZURITA)")
    ap.add_argument("--liquidaciones")
    ap.add_argument("--imposiciones")
    ap.add_argument("--salida", default="resultado.json")
    a = ap.parse_args()
    if not (a.liquidaciones or a.imposiciones):
        sys.exit("Indica --liquidaciones y/o --imposiciones.")
    cont = a.contratista.strip().upper()
    items = []
    if a.liquidaciones:
        liq, saltadas = liquidaciones(a.liquidaciones, cont)
        items += liq
        print(f"Liquidaciones leídas: {len(liq)}" + (f" · páginas que no se pudieron leer: {saltadas}" if saltadas else ""))
        print("Períodos de las liquidaciones:", sorted({x['periodo'] for x in liq}))
    if a.imposiciones:
        imp = imposiciones(a.imposiciones, cont)
        items += imp
        print(f"Trabajadores en imposiciones: {len(imp)} · período {imp[0]['periodo'] if imp else '?'}")
    with open(a.salida, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=1)
    print(f"Listo: {len(items)} documentos en {a.salida}. Revisa que el mes sea el mismo en liquidaciones e imposiciones.")


if __name__ == "__main__":
    main()
