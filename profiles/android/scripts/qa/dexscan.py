#!/usr/bin/env python3
"""
dexscan.py — Android DEX & Bytecode Policy Scanner
Scans compiled Android .apk or classes.dex files to detect dangerous APIs,
deprecated reflection, or forbidden Google Play SDK violations.
"""

import sys
import os
import zipfile
import re

DANGEROUS_PATTERNS = [
    (re.compile(rb"Ljava/lang/reflect/Method;->setAccessible"), "Bypassing Java Access Control (Reflection setAccessible)"),
    (re.compile(rb"Landroid/os/Build;->SERIAL"), "Restricted Hardware Identifier Access (Build.SERIAL)"),
    (re.compile(rb"Landroid/telephony/TelephonyManager;->getDeviceId"), "Restricted Device ID Access (IMEI / getDeviceId)"),
    (re.compile(rb"Landroid/os/Environment;->getExternalStorageDirectory"), "Non-scoped legacy storage API (getExternalStorageDirectory)")
]

def scan_apk_or_dex(target_path: str):
    print(f"🔍 [DEXSCAN] Đang quét bytecode: {target_path}...")
    if not os.path.exists(target_path):
        print(f"⚠️ Tệp không tồn tại: {target_path}")
        return 0

    findings = []
    
    # If APK, extract classes*.dex files in-memory
    if target_path.endswith(".apk") or target_path.endswith(".aar"):
        try:
            with zipfile.ZipFile(target_path, "r") as z:
                dex_names = [n for n in z.namelist() if n.startswith("classes") and n.endswith(".dex")]
                for dname in dex_names:
                    data = z.read(dname)
                    for pat, label in DANGEROUS_PATTERNS:
                        if pat.search(data):
                            findings.append((dname, label))
        except Exception as e:
            print(f"Lỗi đọc file nén: {e}")
            return 1
    else:
        # Direct DEX or binary file scan
        try:
            with open(target_path, "rb") as f:
                data = f.read()
            for pat, label in DANGEROUS_PATTERNS:
                if pat.search(data):
                    findings.append((os.path.basename(target_path), label))
        except Exception as e:
            print(f"Lỗi đọc file: {e}")
            return 1

    if findings:
        print(f"❌ Phát hiện {len(findings)} cảnh báo bytecode vi phạm chính sách:")
        for loc, lbl in findings:
            print(f"  • [{loc}] {lbl}")
        return 1
    else:
        print(f"✔ Bytecode SẠCH: 0 vi phạm chính sách API nguy hiểm.")
        return 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: dexscan.py <path_to_apk_or_dex>")
        sys.exit(0)
    sys.exit(scan_apk_or_dex(sys.argv[1]))
