#!/usr/bin/env python3
"""Playwright flaky(재시도로 통과) 테스트를 CI 에 노출한다.

`retries` 로 통과한 테스트는 프로세스 exit 0(green)이라 CI 게이트에서 "clean 통과"와
구분되지 않는다 → 진짜 회귀가 우연히 2차 시도에서 통과하면 조용히 묻힌다. 이 스크립트는
Playwright JSON 리포트에서 flaky 테스트를 추출해 **GitHub Actions step summary
(`$GITHUB_STEP_SUMMARY`) + `::warning::` 어노테이션**으로 노출한다.

flaky 는 결함이 아니라 "관측 대상"이다 (retries 의 취지=순간 flake 흡수). 따라서 이 스크립트는
**항상 exit 0** 으로, 리포트 부재/파싱 실패/예상 밖 스키마에도 CI 를 깨지 않는다
(`main()` 이 모든 처리 경로를 blanket try/except 로 감싼다).

사용: `python3 scripts/report_playwright_flaky.py [<results.json 경로>]`
      (기본 경로: DEFAULT_REPORT).

배경/SoT: plan/complete/e2e-retry-visibility-followup.md, PR #872(retries 도입).
stdlib 전용(설치 불요) — `.claude/tests/test_report_playwright_flaky.py` 가 로직을 검증한다.
"""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Iterator
from typing import Any

# 리포트 경로 SoT. `.github/workflows/e2e.yml` step 인자 · `playwright.config.ts` 의
# json reporter `outputFile` 과 **반드시 일치**해야 하며(경로가 어긋나면 스크립트가 조용히
# "리포트 없음 → skip" 하여 flaky surfacing 이 무력화된다), 그 정합은
# `.claude/tests/test_report_playwright_flaky.py` 의 cross-file 가드가 검증한다.
DEFAULT_REPORT = "codebase/frontend/playwright-report/results.json"


def _safe_int(value: Any, default: int = 0) -> int:
    """정수 변환(키 없음/None/비정수 → default). retry 값 방어용."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _iter_specs(suite: dict) -> Iterator[dict]:
    """suite 트리를 재귀 순회하며 모든 spec(dict)을 yield 한다.

    Playwright JSON 리포트의 suite 는 `specs`(직속 테스트)와 `suites`(중첩 describe/파일)를
    동시에 가질 수 있다.
    """
    for spec in suite.get("specs") or []:
        yield spec
    for child in suite.get("suites") or []:
        yield from _iter_specs(child)


def _max_flaky_retry(flaky_tests: list[dict]) -> int:
    """flaky 로 판정된 test 들의 `results[].retry` 최댓값(=재시도 횟수)."""
    retries = 0
    for test in flaky_tests:
        for result in test.get("results") or []:
            retries = max(retries, _safe_int(result.get("retry"), 0))
    return retries


def find_flaky(report: dict) -> list[dict]:
    """JSON 리포트(dict)에서 flaky 테스트를 [{file,title,line,retries}] 로 반환한다.

    Playwright 는 재시도 끝에 통과한 테스트의 `test.status` 를 `"flaky"` 로 표기한다. spec 의
    어떤 test 든 flaky 면 그 spec 을 flaky 로 집계하고, 재시도 횟수는 **그 flaky test 들**의
    `results[].retry` 최댓값으로 계산한다(비-flaky test 의 retry 는 제외).
    """
    flaky: list[dict] = []
    for suite in report.get("suites") or []:
        for spec in _iter_specs(suite):
            flaky_tests = [
                t for t in (spec.get("tests") or []) if t.get("status") == "flaky"
            ]
            if not flaky_tests:
                continue
            flaky.append(
                {
                    "file": spec.get("file") or "",
                    "title": spec.get("title") or "",
                    "line": _safe_int(spec.get("line"), 0),
                    "retries": _max_flaky_retry(flaky_tests),
                }
            )
    return flaky


def _location(entry: dict) -> str:
    return entry["file"] + (f":{entry['line']}" if entry["line"] else "")


def render_markdown(flaky: list[dict]) -> str:
    """step summary 용 마크다운. flaky 유무 모두 명시적으로 렌더(가시성)."""
    if not flaky:
        return "### ✅ Playwright flaky 없음\n\n모든 테스트가 재시도 없이 통과했습니다."
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


def _write_step_summary(markdown: str) -> None:
    """`$GITHUB_STEP_SUMMARY` 에 append(로컬/미설정 환경에선 no-op)."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(markdown + "\n")
    except OSError:
        pass


def _gha_escape(value: str) -> str:
    """GitHub Actions 워크플로 커맨드 message escaping — 개행/`%` 로 인한 커맨드 깨짐·주입 방지."""
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def _emit_annotations(flaky: list[dict]) -> None:
    """각 flaky 를 `::warning::` 어노테이션으로 출력(값은 `_gha_escape` 로 방어)."""
    for f in flaky:
        # ::warning:: 는 job 을 실패시키지 않는다. file/title 은 저장소 내부값이지만 방어적으로 escape.
        print(
            f"::warning file={_gha_escape(f['file'])},line={f['line']}::"
            f"flaky (재시도 {f['retries']}회 후 통과): {_gha_escape(f['title'])}"
        )


def _load_report(path: str) -> dict | None:
    """리포트 JSON 로드. 부재/파싱실패 시 None(비차단)."""
    if not os.path.isfile(path):
        print(f"[flaky-report] JSON 리포트 없음: {path} — skip (빌드 영향 없음)")
        return None
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        print(f"[flaky-report] 리포트 파싱 실패: {exc} — skip (빌드 영향 없음)")
        return None


def main(argv: list[str]) -> int:
    """리포트를 읽어 flaky 를 step summary + 어노테이션으로 노출한다.

    flaky 는 비차단 관측 신호이므로 **어떤 경로에서도 exit 0** 이다: 리포트 부재/파싱 실패는
    `_load_report` 가, 예상 밖 스키마로 인한 처리 예외는 아래 blanket try/except 가 흡수한다.
    (호출하는 CI step 은 추가로 `continue-on-error: true` 로도 방어된다.)
    """
    path = argv[1] if len(argv) > 1 else DEFAULT_REPORT
    report = _load_report(path)
    if report is None:
        return 0
    try:
        flaky = find_flaky(report)
        _write_step_summary(render_markdown(flaky))
        _emit_annotations(flaky)
        print(
            f"[flaky-report] flaky {len(flaky)}건"
            + (" — 위 목록/step summary 참조" if flaky else " (clean)")
        )
    except Exception as exc:  # 의도적 broad except — 관측 스크립트라 어떤 예외도 CI 를 깨면 안 됨
        print(f"[flaky-report] 처리 중 예외(무시, 빌드 영향 없음): {exc!r}")
    return 0  # flaky 는 non-blocking — 항상 성공 종료


if __name__ == "__main__":
    sys.exit(main(sys.argv))
