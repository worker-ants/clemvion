#!/usr/bin/env python3
"""세션 기록으로 하네스의 토큰 · 시간 사용량을 잰다(NERV Task `CLE-T-ZTTHXD`).

하네스 비용 개선(컨텍스트 상한 · 대기 순서 등)이 실제로 효과가 있는지 같은 잣대로 다시 재려고 둔다.
Claude Code 가 남기는 세션 기록만 읽고 아무것도 쓰지 않는다. 모델을 부르지 않는다.

    python3 .claude/tools/usage_report.py [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--json]
                                          [--projects-dir DIR] [--prefix=NAME]

읽는 것(`<projects-dir>` 기본값 `~/.claude/projects`, 폴더 이름은 `<prefix>` 와 같거나 `<prefix>-` 로 시작):

  - 메인 세션            `<dir>/<세션>.jsonl`
  - Agent 서브에이전트    `<dir>/<세션>/subagents/<agent>.jsonl` (+ `.meta.json` 의 `agentType`)
  - Workflow 서브에이전트 `<dir>/<세션>/subagents/workflows/<wf>/<agent>.jsonl`
  - Workflow 실행 기록    `<dir>/<세션>/workflows/<wf>.json` (`workflowName` · `durationMs`)

`<prefix>` 기본값은 이 저장소 main 체크아웃 경로의 영숫자 아닌 글자를 `-` 로 바꾼 값이다. 워크트리
세션은 `<prefix>--claude-worktrees-<이름>` 폴더에 쌓인다.

중복 제거: 같은 세션이 워크트리를 옮길 때마다 여러 폴더에 같은 기록을 남긴다. 세션(과 에이전트)마다
가장 큰 파일 하나만 센다. 한 API 응답은 내용 블록마다 줄이 나뉘어 같은 `message.id` 로 여러 번
기록되므로 응답은 `message.id` 로 한 번만 센다. Workflow 실행 기록은 `runId` 로 한 번만 센다.

상대 비용(단위: Opus 입력 토큰 환산). 공개 API 가격 비율을 가정한 상대 지표라 구독 플랜의 실제 한도
계산과 다를 수 있다. 같은 잣대로 전후를 비교하는 용도다.

  입력 1 · 캐시 쓰기 1.25(5분) · 2.0(1시간) · 캐시 읽기 0.1 · 출력 5
  모델 배수: Opus 1 · Sonnet 0.6 · Haiku 0.2 · 알 수 없는 모델 1

서브에이전트 분류: Workflow 안의 에이전트는 실행 기록의 `workflowName` 으로(`ai-review*` → 코드 리뷰,
`consistency-check*` → 일관성), Agent 서브에이전트는 `agentType` 으로(`*-reviewer` · `review-router` ·
`code-review-summary` → 코드 리뷰, `*-checker` · `consistency-summary` → 일관성, `resolution-applier`,
`Explore` · `general-purpose` · `Plan` → 탐색, 그 밖은 기타) 나눈다.

작업 단위 라운드 수: Workflow 실행 기록 안의 `.claude/worktrees/<이름>/` 경로로 워크트리를 찾아
워크트리마다 `ai-review` · `consistency-check` 실행 수를 센다. 경로가 없는 실행은 세지 않는다.
"""

from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
import re
import statistics
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

TOKEN_WEIGHTS = {"input": 1.0, "cache_write_5m": 1.25, "cache_write_1h": 2.0,
                 "cache_read": 0.1, "output": 5.0}
MODEL_FACTORS = (("opus", 1.0), ("sonnet", 0.6), ("haiku", 0.2))
CTX_BUCKETS = ((200_000, "<200k"), (400_000, "200-400k"), (600_000, "400-600k"),
               (800_000, "600-800k"), (None, ">=800k"))
CATEGORIES = ("code_review", "consistency", "resolution", "explore", "other")
EXPLORE_TYPES = {"Explore", "general-purpose", "Plan", "claude"}
WORKTREE_RE = re.compile(r"\.claude/worktrees/([\w.-]+?)/")


def model_factor(model: str | None) -> float:
    m = (model or "").lower()
    for key, factor in MODEL_FACTORS:
        if key in m:
            return factor
    return 1.0


def weighted_cost(usage: dict, model: str | None) -> float:
    cc = usage.get("cache_creation") or {}
    w1h = cc.get("ephemeral_1h_input_tokens") or 0
    w5m = cc.get("ephemeral_5m_input_tokens") or 0
    if not (w1h or w5m):
        w5m = usage.get("cache_creation_input_tokens") or 0
    raw = ((usage.get("input_tokens") or 0) * TOKEN_WEIGHTS["input"]
           + w5m * TOKEN_WEIGHTS["cache_write_5m"] + w1h * TOKEN_WEIGHTS["cache_write_1h"]
           + (usage.get("cache_read_input_tokens") or 0) * TOKEN_WEIGHTS["cache_read"]
           + (usage.get("output_tokens") or 0) * TOKEN_WEIGHTS["output"])
    return raw * model_factor(model)


def context_size(usage: dict) -> int:
    return ((usage.get("input_tokens") or 0) + (usage.get("cache_creation_input_tokens") or 0)
            + (usage.get("cache_read_input_tokens") or 0))


def parse_ts(value) -> float | None:
    if not isinstance(value, str):
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def scan_transcript(path: str) -> dict:
    """한 jsonl 의 API 응답을 `message.id` 로 한 번씩 세어 합친다."""
    seen: set = set()
    out = {"calls": 0, "cost": 0.0, "ctx_sum": 0, "ctx_max": 0, "output": 0,
           "buckets": Counter(), "compactions": 0, "start": None, "end": None,
           "first_user": None, "agent_type": None}
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            ts = parse_ts(rec.get("timestamp"))
            if ts is not None:
                out["start"] = ts if out["start"] is None else min(out["start"], ts)
                out["end"] = ts if out["end"] is None else max(out["end"], ts)
            kind = rec.get("type")
            if kind == "system" and "compact" in str(rec.get("subtype", "")):
                out["compactions"] += 1
            msg = rec.get("message") or {}
            if kind == "user" and out["first_user"] is None:
                content = msg.get("content")
                out["first_user"] = content if isinstance(content, str) else json.dumps(
                    content, ensure_ascii=False)[:4000]
            if kind != "assistant":
                continue
            usage = msg.get("usage")
            key = msg.get("id") or rec.get("requestId") or rec.get("uuid")
            if not usage or key in seen:
                continue
            seen.add(key)
            ctx = context_size(usage)
            out["calls"] += 1
            out["cost"] += weighted_cost(usage, msg.get("model"))
            out["ctx_sum"] += ctx
            out["ctx_max"] = max(out["ctx_max"], ctx)
            out["output"] += usage.get("output_tokens") or 0
            for limit, label in CTX_BUCKETS:
                if limit is None or ctx < limit:
                    out["buckets"][label] += 1
                    break
    return out


def default_prefix() -> str:
    try:
        common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
                                capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        common = os.path.join(os.getcwd(), ".git")
    return re.sub(r"[^A-Za-z0-9]", "-", str(Path(common).parent))


def project_dirs(projects_dir: str, prefix: str) -> list[str]:
    return sorted(d for d in glob.glob(os.path.join(projects_dir, prefix + "*"))
                  if os.path.isdir(d) and (os.path.basename(d) == prefix
                                           or os.path.basename(d).startswith(prefix + "-")))


def keep_largest(paths, key_of) -> dict:
    best: dict = {}
    for p in paths:
        k = key_of(p)
        if k not in best or os.path.getsize(p) > os.path.getsize(best[k]):
            best[k] = p
    return best


def classify_agent_type(agent_type: str | None) -> str:
    t = agent_type or ""
    if t == "resolution-applier":
        return "resolution"
    if t.endswith("-reviewer") or t in ("review-router", "code-review-summary"):
        return "code_review"
    if t.endswith("-checker") or t == "consistency-summary":
        return "consistency"
    if t in EXPLORE_TYPES:
        return "explore"
    return "other"


def classify_workflow(name: str | None) -> str:
    n = name or ""
    if n.startswith("ai-review"):
        return "code_review"
    if n.startswith("consistency-check"):
        return "consistency"
    return "other"


def in_window(ts: float | None, since: float | None, until: float | None) -> bool:
    if ts is None:
        return since is None and until is None
    return (since is None or ts >= since) and (until is None or ts < until)


def collect(projects_dir: str, prefix: str, since: float | None = None,
            until: float | None = None) -> dict:
    dirs = project_dirs(projects_dir, prefix)
    mains = keep_largest([p for d in dirs for p in glob.glob(os.path.join(d, "*.jsonl"))],
                         lambda p: os.path.basename(p)[:-6])
    agents = keep_largest(
        [p for d in dirs for p in glob.glob(os.path.join(d, "*", "subagents", "*.jsonl"))],
        lambda p: (p.split(os.sep)[-3], os.path.basename(p)))
    wf_agents = keep_largest(
        [p for d in dirs for p in glob.glob(os.path.join(d, "*", "subagents", "workflows", "*", "*.jsonl"))],
        lambda p: (p.split(os.sep)[-5], p.split(os.sep)[-2], os.path.basename(p)))
    runs: dict = {}
    for d in dirs:
        for p in glob.glob(os.path.join(d, "*", "workflows", "wf_*.json")):
            try:
                with open(p, encoding="utf-8") as fh:
                    rec = json.load(fh)
            except (OSError, ValueError):
                continue
            runs[rec.get("runId") or os.path.basename(p)[:-5]] = rec

    sessions = []
    for sid, path in mains.items():
        s = scan_transcript(path)
        if s["calls"] and in_window(s["start"], since, until):
            sessions.append({"session": sid, **s})
    kept = {s["session"] for s in sessions}

    cost = Counter()
    count = Counter()
    for (sid, _name), path in agents.items():
        if sid not in kept:
            continue
        meta = path[:-6] + ".meta.json"
        agent_type = None
        if os.path.exists(meta):
            try:
                with open(meta, encoding="utf-8") as fh:
                    agent_type = json.load(fh).get("agentType")
            except (OSError, ValueError):
                pass
        s = scan_transcript(path)
        cat = classify_agent_type(agent_type)
        cost[cat] += s["cost"]
        count[cat] += 1
    for (sid, wf, _name), path in wf_agents.items():
        if sid not in kept:
            continue
        cat = classify_workflow((runs.get(wf) or {}).get("workflowName"))
        s = scan_transcript(path)
        cost[cat] += s["cost"]
        count[cat] += 1

    durations = defaultdict(list)
    per_worktree = defaultdict(Counter)
    for rec in runs.values():
        if not in_window(parse_ts(rec.get("timestamp")), since, until):
            continue
        cat = classify_workflow(rec.get("workflowName"))
        durations[cat].append((rec.get("durationMs") or 0) / 60000)
        m = WORKTREE_RE.search(json.dumps(rec, ensure_ascii=False))
        if m and cat in ("code_review", "consistency"):
            per_worktree[m.group(1)][cat] += 1
    return {"sessions": sessions, "agent_cost": dict(cost), "agent_count": dict(count),
            "workflow_minutes": {k: v for k, v in durations.items()},
            "rounds_per_worktree": {k: dict(v) for k, v in per_worktree.items()}}


def summarize(data: dict) -> dict:
    sessions = data["sessions"]
    main_cost = sum(s["cost"] for s in sessions)
    calls = sum(s["calls"] for s in sessions)
    buckets = Counter()
    for s in sessions:
        buckets.update(s["buckets"])
    agent_cost = {c: data["agent_cost"].get(c, 0.0) for c in CATEGORIES}
    total = main_cost + sum(agent_cost.values())
    big = [s for s in sessions if s["calls"] > 1000]
    rounds = data["rounds_per_worktree"]

    def dist(cat):
        values = [r.get(cat, 0) for r in rounds.values()]
        if not values:
            return {"worktrees": 0, "mean": 0.0, "median": 0.0, "max": 0}
        return {"worktrees": len(values), "mean": round(sum(values) / len(values), 2),
                "median": statistics.median(values), "max": max(values)}

    def minutes(cat):
        values = data["workflow_minutes"].get(cat, [])
        return {"runs": len(values),
                "median": round(statistics.median(values), 1) if values else 0.0,
                "total_hours": round(sum(values) / 60, 1)}

    def share(x):
        return round(100 * x / total, 1) if total else 0.0

    return {
        "sessions": len(sessions),
        "period": [min((s["start"] for s in sessions), default=None),
                   max((s["end"] for s in sessions), default=None)],
        "cost_total": round(total),
        "cost": {"main": round(main_cost), **{c: round(v) for c, v in agent_cost.items()}},
        "cost_share": {"main": share(main_cost), **{c: share(v) for c, v in agent_cost.items()}},
        "agents": {c: data["agent_count"].get(c, 0) for c in CATEGORIES},
        "main": {"calls": calls,
                 "avg_context": round(sum(s["ctx_sum"] for s in sessions) / calls) if calls else 0,
                 "max_context": max((s["ctx_max"] for s in sessions), default=0),
                 "context_buckets": {label: buckets.get(label, 0) for _, label in CTX_BUCKETS},
                 "share_calls_ge_600k": round(100 * (buckets[">=800k"] + buckets["600-800k"]) / calls, 1)
                 if calls else 0.0,
                 "compactions": sum(s["compactions"] for s in sessions),
                 "sessions_over_1000_calls": len(big),
                 "cost_share_of_sessions_over_1000_calls":
                     round(100 * sum(s["cost"] for s in big) / main_cost, 1) if main_cost else 0.0},
        "workflows": {"code_review": minutes("code_review"), "consistency": minutes("consistency")},
        "rounds_per_worktree": {"code_review": dist("code_review"), "consistency": dist("consistency")},
    }


def render(summary: dict) -> str:
    def day(ts):
        return dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d") if ts else "?"

    def m(x):
        return f"{x / 1e6:,.1f}M"

    c, sh, mn = summary["cost"], summary["cost_share"], summary["main"]
    wf, rw = summary["workflows"], summary["rounds_per_worktree"]
    labels = {"main": "메인 세션", "code_review": "코드 리뷰 에이전트", "consistency": "일관성 에이전트",
              "resolution": "resolution-applier", "explore": "탐색 에이전트", "other": "기타 에이전트"}
    lines = [f"기간 {day(summary['period'][0])} ~ {day(summary['period'][1])} · 세션 {summary['sessions']}개",
             f"상대 비용(Opus 입력 토큰 환산) 합계 {m(summary['cost_total'])}"]
    for key in ("main", *CATEGORIES):
        extra = f" · {summary['agents'][key]}개" if key in summary["agents"] else ""
        lines.append(f"  {labels[key]:<20} {m(c[key]):>10} {sh[key]:>5.1f}%{extra}")
    lines += [
        f"메인 세션 호출 {mn['calls']:,}번 · 평균 컨텍스트 {mn['avg_context']:,} · 최대 {mn['max_context']:,}",
        f"  60만 토큰 이상 호출 {mn['share_calls_ge_600k']}% · 자동 compact {mn['compactions']}번 · "
        f"1,000번 넘게 호출한 세션 {mn['sessions_over_1000_calls']}개(메인 비용의 "
        f"{mn['cost_share_of_sessions_over_1000_calls']}%)",
        f"워크플로 ai-review {wf['code_review']['runs']}회(중앙값 {wf['code_review']['median']}분, "
        f"합 {wf['code_review']['total_hours']}h) · consistency-check {wf['consistency']['runs']}회"
        f"(중앙값 {wf['consistency']['median']}분, 합 {wf['consistency']['total_hours']}h)",
        f"워크트리당 라운드 ai-review 평균 {rw['code_review']['mean']} · 중앙값 {rw['code_review']['median']} · "
        f"최대 {rw['code_review']['max']} / consistency-check 평균 {rw['consistency']['mean']} · "
        f"중앙값 {rw['consistency']['median']} · 최대 {rw['consistency']['max']} "
        f"(워크트리 {rw['code_review']['worktrees']}개)",
    ]
    return "\n".join(lines)


def to_epoch(day: str | None) -> float | None:
    return dt.datetime.strptime(day, "%Y-%m-%d").timestamp() if day else None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--projects-dir", default=os.path.expanduser("~/.claude/projects"))
    ap.add_argument("--prefix", help="세션 폴더 이름 접두. `-` 로 시작하므로 --prefix=NAME 로 준다. 기본값은 main 체크아웃 경로에서 만든다")
    ap.add_argument("--since", help="이 날짜(로컬 0시)부터 시작한 세션만")
    ap.add_argument("--until", help="이 날짜(로컬 0시) 전에 시작한 세션만")
    ap.add_argument("--json", action="store_true", help="요약을 JSON 으로")
    args = ap.parse_args(argv)
    try:
        since, until = to_epoch(args.since), to_epoch(args.until)
    except ValueError:
        print("날짜는 YYYY-MM-DD 형식이어야 한다", file=sys.stderr)
        return 2
    summary = summarize(collect(args.projects_dir, args.prefix or default_prefix(), since, until))
    print(json.dumps(summary, ensure_ascii=False, indent=2) if args.json else render(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
