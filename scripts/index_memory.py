#!/usr/bin/env python3
"""
index_memory.py — 2-Tier Memory Indexing Generator (Geely EX2 Architecture)
Parses massive knowledge/bug files, generates a lightweight index (< 20KB),
and outputs exact line ranges with `sed -n 'a,bp'` on-demand slicing commands.
Prevents Context Window Bloat and reasoning degradation.
"""

import sys
import os
import re
from pathlib import Path

def generate_memory_index(file_path: str):
    p = Path(file_path)
    if not p.exists():
        print(f"❌ File not found: {file_path}")
        return 1

    with open(p, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    total_lines = len(lines)
    file_size_kb = p.stat().st_size / 1024

    sections = []
    header_pattern = re.compile(r"^(#{1,3})\s+(.*)")

    current_title = "Giới thiệu"
    current_start = 1
    current_level = 1

    for idx, line in enumerate(lines, start=1):
        m = header_pattern.match(line.strip())
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            if idx > current_start:
                sections.append((current_title, current_start, idx - 1, current_level))
            current_title = title
            current_start = idx
            current_level = level

    if current_start <= total_lines:
        sections.append((current_title, current_start, total_lines, current_level))

    out_path = p.parent / f"{p.stem}-index.md"

    out_lines = [
        f"# 📑 Mục Lục Bộ Nhớ 2 Tầng: {p.name}",
        f"> **Tệp gốc:** `{p.name}` ({total_lines} dòng, {file_size_kb:.1f} KB)",
        f"> **Quy tắc đọc:** KHÔNG nạp toàn bộ file gốc. Tra cứu mục cần thiết bên dưới và dùng lệnh `sed -n` để đọc lát cắt đúng 50–100 dòng.",
        "",
        "| STT | Tiêu Đề Mục / Bẫy Mã Nguồn | Phạm Vi Dòng | Lệnh Đọc Lát Cắt (On-Demand Slicing) |",
        "|:---:|:---|:---:|:---|"
    ]

    for i, (title, s_line, e_line, lvl) in enumerate(sections, start=1):
        clean_title = title.replace("|", "\\|")
        sed_cmd = f"`sed -n '{s_line},{e_line}p' {p.name}`"
        out_lines.append(f"| {i} | {clean_title} | `{s_line}–{e_line}` | {sed_cmd} |")

    out_lines.append("")
    out_lines.append("## 💡 Cách Sử Dụng:")
    out_lines.append(f"1. Đầu phiên làm việc, chỉ nạp tệp mục lục nhẹ này (`{out_path.name}`).")
    out_lines.append("2. Khi phát sinh triệu chứng hoặc lỗi cụ thể, chạy lệnh `sed -n` tương ứng để nạp đúng ngữ cảnh cần xử lý.")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines) + "\n")

    out_size_kb = out_path.stat().st_size / 1024
    print(f"✔ Đã tạo mục lục bộ nhớ 2 tầng tại: {out_path} ({out_size_kb:.1f} KB, {len(sections)} mục)")
    return 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: index_memory.py <path_to_markdown_file>")
        sys.exit(1)
    sys.exit(generate_memory_index(sys.argv[1]))
