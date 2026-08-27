#!/usr/bin/env python3
"""
merge_json.py — Deep merge source JSON into target JSON safely.
Usage: python3 merge_json.py <source_json> <target_json>
"""
import sys, json, os

def deep_merge(source, target):
    for key, val in source.items():
        if key in target and isinstance(val, dict) and isinstance(target[key], dict):
            deep_merge(val, target[key])
        elif key in target and isinstance(val, list) and isinstance(target[key], list):
            # Union of lists avoiding duplicates (for strings/simple items)
            for item in val:
                if item not in target[key]:
                    target[key].append(item)
        else:
            target[key] = val
    return target

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(0)
    source_file, target_file = sys.argv[1], sys.argv[2]
    if not os.path.exists(source_file):
        sys.exit(0)
    
    with open(source_file, 'r') as sf:
        try:
            source_data = json.load(sf)
        except Exception:
            sys.exit(0)
            
    target_data = {}
    if os.path.exists(target_file):
        try:
            with open(target_file, 'r') as tf:
                target_data = json.load(tf)
        except Exception:
            target_data = {}
            
    merged = deep_merge(source_data, target_data)
    with open(target_file, 'w') as tf:
        json.dump(merged, tf, indent=2)
        tf.write("\n")
