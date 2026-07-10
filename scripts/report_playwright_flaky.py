#!/usr/bin/env python3
"""Playwright flaky(재시도로 통과) 테스트를 CI 에 노출한다.

`retries` 로 통과한 테스트는 프로세스 exit 0(green)이라 CI 게이트에서 "clean 통과"와
구분되지 않는다 → 진짜 회귀가 우연히 2차 시도에서 통과하면 조용히 묻힌다. 이 스크립트는
Playwright JSON 리포트에서 flaky 테스트를 추출해 **GitHub Actions step summary
(`$GITHUB_STEP_SUMMARY`) + `::warning::` 어노테이션**으로 노출한다.

flaky 는 결함이 아니라 "관측 대상"이다 (retries 의 취지=순간 flake 흡수). 따라서 이 스크립트는
**항상 exit 0** 으로, 리포트 부재/파싱 실패에도 CI 를 깨지 않는다.

사용: `python3 scripts/report_playwright_flaky.py [<results.json 경로>]`
      (기본 경로: codebase/frontend/playwright-report/results.json)

배경/SoT: plan/in-progress/e2e-retry-visibility-followup.md, PR #872(retries 도입).
stdlib 전용(설치 불요) — `.claude/tests/test_report_playwright_flaky.py` 가 로직을 검증한다.
"""

from __future__ import annotations

import json
import os
import sys

DEFAULT_REPORT = "codebase/frontend/playwright-report/results.json"


def _iter_specs(suite):
    """suite 트리를 재귀 순회하며 모든 spec(dict)을 yield 한다.

    Playwright JSON 리포트의 suite 는 `specs`(직속 테스트)와 `suites`(중첩 describe/파일)를
    동시에 가질 수 있다.
    """
    for spec in suite.get("specs") or []:
        yield spec
    for child in suite.get("suites") or []:
        yield from _iter_specs(child)


def find_flaky(report):
    """JSON 리포트(dict)에서 flaky 테스트를 [{file,title,line,retries}] 로 반환한다.

    Playwright 는 재시도 끝에 통과한 테스트의 `test.status` 를 `"flaky"` 로 표기한다. spec 의
    어떤 test 든 flaky 면 그 spec 을 flaky 로 집계하고, `results[].retry` 의 최댓값을 재시도 횟수로 쓴다.
    """
    flaky = []
    for suite in report.get("suites") or []:
        for spec in _iter_specs(suite):
            tests = spec.get("tests") or []
            if not any(t.get("status") == "flaky" for t in tests):
                continue
            retries = 0
            for t in tests:
                for r in t.get("results") or []:
                    try:
                        retries = max(retries, int(r.get("retry", 0) or 0))
                    except (TypeError, ValueError):
                        pass
            flaky.append(
                {
                    "file": spec.get("file") or "",
                    "title": spec.get("title") or "",
                    "line": int(spec.get("line") or 0),
                    "retries": retries,
                }
            )
    return flaky


def _location(entry):
    return entry["file"] + (f":{entry['line']}" if entry["line"] else "")


def render_markdown(flaky):
    """step summary 용 마크다운. flaky 유무 모두 명시적으로 렌더(가시성)."""
    if not flaky:
        return (
            "### ✅ Playwright flaky 없음\n\n"
            "모든 테스트가 재시도 없이 통과했습니다."
        )
    lines = [
        f"### ⚠️ Playwright flaky {len(flaky)}건 — 재시도로 통과(근본 원인 미해결 가능)",
        "",
        "| # | 위치 | 테스트 | 재시도 |",
        "|---|------|--------|--------|",
    ]
    for i, f in enumerate(flaky, 1):
        title = f["title"].replace("|", "\\|")
        lines.append(f"| {i} | `{_location(f)}` | {title} | {f['retries']} |")
    lines += [
        "",
        "> retry 로 green 이 됐지만 타이밍·경합 등 **근본 원인은 미해결일 수 있습니다**.",
        "> 반복 시 spec 안정화 또는 quarantine 을 검토하세요 "
        "(plan: `e2e-retry-visibility-followup`).",
    ]
    return "\n".join(lines)


def _write_step_summary(markdown):
    """`$GITHUB_STEP_SUMMARY` 에 append(로컬/미설정 환경에선 no-op)."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(markdown + "\n")
    except OSError:
        pass


def main(argv):
    path = argv[1] if len(argv) > 1 else DEFAULT_REPORT
    if not os.path.isfile(path):
        print(f"[flaky-report] JSON 리포트 없음: {path} — skip (빌드 영향 없음)")
        return 0
    try:
        with open(path, encoding="utf-8") as fh:
            report = json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        print(f"[flaky-report] 리포트 파싱 실패: {exc} — skip (빌드 영향 없음)")
        return 0

    flaky = find_flaky(report)
    _write_step_summary(render_markdown(flaky))

    for f in flaky:
        # GitHub Actions 경고 어노테이션 — job 을 실패시키지 않는다.
        print(
            f"::warning file={f['file']},line={f['line']}::"
            f"flaky (재시도 {f['retries']}회 후 통과): {f['title']}"
        )
    print(
        f"[flaky-report] flaky {len(flaky)}건"
        + (" — 위 목록/step summary 참조" if flaky else " (clean)")
    )
    return 0  # flaky 는 non-blocking — 항상 성공 종료


if __name__ == "__main__":
    sys.exit(main(sys.argv))
