#!/usr/bin/env python3
"""
merge_markdown.py — Non-destructive boundary block injector for markdown files.
Preserves existing user content outside the marker boundaries.
"""

import sys
import os
import re

def merge_markdown(block_file: str, target_file: str, marker_id: str = "universal-agent-devkit"):
    start_marker = f"<!-- {marker_id}:start -->"
    end_marker = f"<!-- {marker_id}:end -->"

    with open(block_file, "r", encoding="utf-8") as f:
        block_content = f.read().strip()

    wrapped_block = f"{start_marker}\n{block_content}\n{end_marker}"

    if not os.path.exists(target_file):
        with open(target_file, "w", encoding="utf-8") as f:
            f.write(wrapped_block + "\n")
        print(f"  - Created {target_file} with {marker_id} block.")
        return

    with open(target_file, "r", encoding="utf-8") as f:
        original = f.read()

    pattern = re.compile(
        re.escape(start_marker) + r".*?" + re.escape(end_marker),
        re.DOTALL
    )

    if pattern.search(original):
        # Update existing block in place
        new_content = pattern.sub(wrapped_block, original)
        action = "Updated existing"
    else:
        # Append block to the end of the file
        new_content = original.rstrip() + "\n\n" + wrapped_block + "\n"
        action = "Injected"

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"  - {action} {marker_id} block in {target_file} (Preserved custom content).")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: merge_markdown.py <block_file> <target_file> [marker_id]")
        sys.exit(1)
    b_file = sys.argv[1]
    t_file = sys.argv[2]
    m_id = sys.argv[3] if len(sys.argv) > 3 else "universal-agent-devkit"
    merge_markdown(b_file, t_file, m_id)
