"""Sube a la plataforma los documentos que Claude leyó de los escaneos.

Uso:  python cargar_escaneos.py resultado.json
El archivo JSON es una lista de documentos (ver INSTRUCCIONES_ESCANEOS.md).
Pide tu usuario y clave de la plataforma; no guarda nada. Solo funciona con rol administrador.
"""
import getpass
import json
import sys
import urllib.request

URL = "https://cmfvnluppvqyqwpfjrbs.supabase.co"
CLAVE_PUBLICA = "sb_publishable_TvfWNvrb2AitDfwvW5YNww_QsR_gjD1"  # clave pública: no da acceso a datos por sí sola


def rpc(nombre, cuerpo):
    pedido = urllib.request.Request(
        f"{URL}/rest/v1/rpc/{nombre}",
        data=json.dumps(cuerpo).encode("utf-8"),
        headers={"apikey": CLAVE_PUBLICA, "Authorization": f"Bearer {CLAVE_PUBLICA}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(pedido, timeout=60) as r:
        return json.load(r)


def main():
    if len(sys.argv) != 2:
        sys.exit("Uso: python cargar_escaneos.py resultado.json")
    with open(sys.argv[1], encoding="utf-8") as f:
        items = json.load(f)
    if not isinstance(items, list) or not items:
        sys.exit("El archivo debe ser una lista con al menos un documento.")
    usuario = input("Usuario de la plataforma: ").strip()
    clave = getpass.getpass("Clave: ")
    r = rpc("pp_login", {"p_usuario": usuario, "p_clave": clave})
    if not r.get("ok"):
        sys.exit("No se pudo ingresar: " + str(r.get("error")))
    if r.get("debe_cambiar"):
        sys.exit("Primero entra a la plataforma y cambia tu clave temporal.")
    token = r["token"]
    try:
        res = rpc("pp_documentos_cargar", {"p_token": token, "p_items": items})
        print(f"Se cargaron {res['cargados']} documentos." if res.get("ok") else "Error: " + str(res.get("error")))
    finally:
        try:
            rpc("pp_salir", {"p_token": token})
        except Exception:
            pass


if __name__ == "__main__":
    main()
