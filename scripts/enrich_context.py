#!/usr/bin/env python3
# enrich_context.py — Autonomous Prompt Context & Intent Enrichment Engine
# Transforms a brief user prompt into a 5-dimensional technical specification dossier.

import sys
import os
import json
import re

def enrich_prompt(prompt, devkit_root="."):
    dossier = {
        "dossier_type": "5D_CONTEXT_DOSSIER",
        "user_prompt": prompt,
        "active_profile": "universal",
        "detected_intents": [],
        "codebase_queries": [],
        "matched_instincts": [],
        "injected_nfrs": [],
        "paired_oracle_spec": {},
        "recommended_skills": []
    }

    # 1. Read Active Profile
    active_profile_file = os.path.join(devkit_root, ".active-profile.json")
    if os.path.exists(active_profile_file):
        try:
            with open(active_profile_file, "r") as f:
                prof_data = json.load(f)
                dossier["active_profile"] = prof_data.get("name", "universal")
        except Exception:
            pass

    p_lower = prompt.lower()

    # 2. Detect Intents & Recommend Skills
    if any(k in p_lower for k in ["lỗi", "bug", "crash", "văng", "hỏng", "fail", "sửa", "chết", "die"]):
        dossier["detected_intents"].append("BUG_FIX")
        dossier["recommended_skills"].extend(["fixbugs", "tdd-workflow", "verification-before-completion"])
        dossier["paired_oracle_spec"] = {
            "required": True,
            "rule": "PAIRED EXECUTABLE ORACLE: Must observe test RED before editing code, then GREEN after.",
            "compile_only_permitted_if": "The root defect itself is a compilation/build failure."
        }

    if any(k in p_lower for k in ["nút", "click", "bấm", "giao diện", "ui", "màn hình", "layout", "button", "tap"]):
        dossier["detected_intents"].append("UI_INTERACTION")
        dossier["injected_nfrs"].append("Debounce >= 1000ms + Instant Disable on 1st click + Loading indicator.")
        dossier["injected_nfrs"].append("Touch Target >= 48dp (Mobile) / >= 44px (Web).")
        dossier["injected_nfrs"].append("Design Tokens adherence: Semantic colors from DESIGN.md.")
        if dossier["active_profile"] == "android":
            dossier["recommended_skills"].append("android-real-device-qa")

    if any(k in p_lower for k in ["lag", "chậm", "đơ", "anr", "tối ưu", "hiệu năng", "fps", "treo", "freeze", "xoay"]):
        dossier["detected_intents"].append("PERFORMANCE_AND_RESPONSIVENESS")
        dossier["injected_nfrs"].append("Non-blocking Main Thread: Move heavy work/IO to background dispatchers.")
        dossier["injected_nfrs"].append("Algorithm complexity: O(1) lookup via Map/Set; avoid O(N^2) dynamic loops.")
        dossier["injected_nfrs"].append("Zero memory leaks: unregister listeners/observers upon lifecycle destroy.")
        dossier["recommended_skills"].append("observability-instrumentation")
        if dossier["active_profile"] == "android":
            dossier["recommended_skills"].append("android-real-device-qa")

    if any(k in p_lower for k in ["mạng", "api", "gọi", "request", "server", "timeout", "offline", "sync"]):
        dossier["detected_intents"].append("NETWORK_AND_RESILIENCE")
        dossier["injected_nfrs"].append("Explicit Timeouts: Connect <= 10s, Read <= 15s.")
        dossier["injected_nfrs"].append("Idempotency-Key (UUIDv4) for state-mutating requests (POST/PUT).")
        dossier["injected_nfrs"].append("Exponential backoff with jitter for retries.")

    if any(k in p_lower for k in ["refactor", "thiết kế", "kiến trúc", "module", "tách", "interface"]):
        dossier["detected_intents"].append("ARCHITECTURE_REFACTOR")
        dossier["recommended_skills"].extend(["grill-plan", "deep-module-design", "documentation-and-adrs", "incremental-implementation"])

    if any(k in p_lower for k in ["xóa", "bỏ", "deprecate", "sunset", "chuyển sang", "migrate"]):
        dossier["detected_intents"].append("DEPRECATION_MIGRATION")
        dossier["recommended_skills"].extend(["deprecation-migration", "documentation-and-adrs"])

    if any(k in p_lower for k in ["giao", "antigravity", "pm", "phân công"]):
        dossier["detected_intents"].append("DUAL_AGENT_DELEGATION")
        dossier["recommended_skills"].append("giao")

    if any(k in p_lower for k in ["crashlytics", "traces.txt", "stacktrace", "sập app", "triage"]):
        dossier["detected_intents"].append("CRASH_TRIAGE")
        dossier["recommended_skills"].append("fixbugs")

    if any(k in p_lower for k in ["conflict", "xung đột", "merge", "rebase", "cherry-pick"]):
        dossier["detected_intents"].append("MERGE_CONFLICT")
        dossier["recommended_skills"].append("merge-conflict-resolver")

    if any(k in p_lower for k in ["release", "deploy", "đóng gói", "apk", "aab", "publish", "phát hành"]):
        dossier["detected_intents"].append("RELEASE_DEPLOY")
        dossier["recommended_skills"].extend(["deploy", "qc", "verification-before-completion"])

    if any(k in p_lower for k in ["review", "pr", "pull request", "soát diff", "chất vấn", "nghiệm thu"]):
        dossier["detected_intents"].append("CODE_AND_QA_REVIEW")
        dossier["recommended_skills"].extend(["qa-review", "open-code-review", "verification-before-completion"])

    if any(k in p_lower for k in ["spec", "tính năng mới", "feature lớn", "yêu cầu mới"]):
        dossier["detected_intents"].append("SPEC_PLANNING")
        dossier["recommended_skills"].extend(["spec-driven-development", "grill-plan", "documentation-and-adrs"])

    if any(k in p_lower for k in ["vỡ layout", "tràn khung", "lệch giao diện", "screenshot", "chụp màn"]):
        dossier["detected_intents"].append("VISUAL_QA")
        dossier["recommended_skills"].append("qa-visual")

    if any(k in p_lower for k in ["tìm hàm", "ai gọi", "luồng gọi", "đồ thị", "graph"]):
        dossier["detected_intents"].append("CODEBASE_EXPLORE")
        dossier["recommended_skills"].append("codebase-memory")

    if any(k in p_lower for k in ["bàn giao", "checkpoint", "nén ngữ cảnh", "compact", "phiên dài"]):
        dossier["detected_intents"].append("SESSION_HANDOFF")
        dossier["recommended_skills"].append("session-handoff")

    if any(k in p_lower for k in ["viết skill", "tạo skill", "chuẩn hóa skill", "rule mới"]):
        dossier["detected_intents"].append("SKILL_AUTHORING")
        dossier["recommended_skills"].append("writing-skills")

    # Fallback default intent if none matched
    if not dossier["detected_intents"]:
        dossier["detected_intents"].append("GENERAL_TASK")
        dossier["recommended_skills"].append("incremental-implementation")

    # Injected Core NFRs that apply to ALL tasks
    dossier["injected_nfrs"].append("Anti-Laziness: Strictly zero placeholder code (// ... existing code ...).")
    dossier["injected_nfrs"].append("Structured Logging: Zero raw console.log/println; mask 100% PII (Token/Password/ID).")
    dossier["injected_nfrs"].append("Anti-Swallowing: Zero empty catch/except blocks.")

    # 3. Match Instincts from instincts.md
    instincts_file = os.path.join(devkit_root, ".agents/instincts.md")
    if os.path.exists(instincts_file):
        try:
            with open(instincts_file, "r") as f:
                content = f.read()
            blocks = re.findall(r"(### \[(INSTINCT-\d+)\].*?)(?=### \[INSTINCT-|\Z)", content, re.DOTALL)
            for full_block, inst_id in blocks:
                # check matching keywords
                block_lower = full_block.lower()
                for word in p_lower.split():
                    if len(word) >= 3 and word in block_lower:
                        header_line = full_block.strip().split("\n")[0].replace("### ", "")
                        if header_line not in dossier["matched_instincts"]:
                            dossier["matched_instincts"].append(header_line)
        except Exception:
            pass

    if not dossier["matched_instincts"]:
        dossier["matched_instincts"] = [
            "[INSTINCT-001] Khôi Phục Trạng Thái Khi Thay Đổi Cấu Hình (Configuration Change)",
            "[INSTINCT-006] Chặn Đứng Luồng Chính (Main Thread) & Không Giải Phóng Tài Nguyên",
            "[INSTINCT-007] Chống Spam Click Bằng Cơ Chế Debounce Khóa Tức Thì"
        ]

    # 4. Generate Codebase Graph Search Queries
    tokens = [w for w in re.findall(r"[A-Za-z0-9_]{3,}", prompt) if w.lower() not in ["sửa", "lỗi", "giúp", "tạo", "làm", "cho", "vào", "khi", "bị"]]
    if tokens:
        dossier["codebase_queries"] = [
            f"search_graph(name_pattern=\".*{t}.*\")" for t in tokens[:3]
        ] + [
            "trace_path(function_name=\"<MatchedSymbol>\", direction=\"inbound\")"
        ]
    else:
        dossier["codebase_queries"] = [
            "search_graph(name_pattern=\".*<ComponentName>.*\")",
            "trace_path(function_name=\"<TargetFunction>\", direction=\"inbound\")"
        ]

    # Deduplicate recommended skills
    dossier["recommended_skills"] = list(dict.fromkeys(dossier["recommended_skills"]))

    return dossier

if __name__ == "__main__":
    prompt_input = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "sửa nút login bị bấm nhiều lần văng app"
    devkit_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    res = enrich_prompt(prompt_input, devkit_dir)
    print(json.dumps(res, indent=2, ensure_ascii=False))
