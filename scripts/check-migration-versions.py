#!/usr/bin/env python3
"""
Flyway 마이그레이션 V번호 충돌·단조성 검출 스크립트.

여러 PR 이 병렬로 진행될 때 같은 V번호를 동시에 점유하거나, main 의 max(V)
보다 작거나 같은 V번호를 들고 들어오는 케이스를 PR CI 단계에서 fail-fast 로
잡아낸다. (`spec/conventions/migrations.md` 참고)

검사 항목:
  1. **중복** — 같은 V번호의 `.sql` 이 둘 이상이면 fail.
  2. **단조성** — PR 의 신규 V번호가 main 의 max(V) 보다 작거나 같으면 fail.
  3. **연속성** — PR 추가 V번호는 정확히 `main_max + 1, +2, ...` 형태로 gap 없이
     이어져야 한다.
  4. **conf 페어** — 같은 V번호의 `.conf` 가 존재한다면 base name (`V<NNN>__<name>`)
     이 `.sql` 과 일치해야 한다.

종료 코드: 정상 0, 위반 1.

사용:
    python3 scripts/check-migration-versions.py [--base origin/main] [--root <repo-root>]

기본 비교 대상은 `origin/main`. GitHub Actions PR 컨텍스트에서는
`origin/${{ github.base_ref }}` 형태로 전달한다 (`.github/workflows/migration-check.yml`).

의존성: Python 3 표준 라이브러리만 사용 (`subprocess`, `re`, `pathlib`, `argparse`).
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable


MIGRATIONS_DIR = Path("backend") / "migrations"
SQL_RE = re.compile(r"^V(?P<num>\d+)__(?P<name>[A-Za-z0-9_]+)\.sql$")
CONF_RE = re.compile(r"^V(?P<num>\d+)__(?P<name>[A-Za-z0-9_]+)\.conf$")


def run_git(args: list[str], cwd: Path) -> str:
    """git 명령 실행. 실패 시 stderr 를 그대로 노출하여 디버깅에 도움."""
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.stderr.write(
            f"[migration-guard] git {' '.join(args)} failed (exit {result.returncode}):\n"
            f"{result.stderr}"
        )
        return ""
    return result.stdout


def list_local_files(root: Path) -> list[str]:
    """현재 worktree 의 backend/migrations 파일 목록 (basename)."""
    target = root / MIGRATIONS_DIR
    if not target.is_dir():
        return []
    return sorted(p.name for p in target.iterdir() if p.is_file())


def list_base_files(root: Path, base_ref: str) -> tuple[list[str], str]:
    """비교 기준 ref (보통 main) 의 backend/migrations 파일 목록.

    merge-base 가 있으면 그 ref 의 ls-tree 를, 없으면 base_ref 자체의 ls-tree 를
    사용한다. PR open 시점에 base 가 갱신되어도 분기 시점 기준으로 비교해야
    "신규 V" 가 정확히 식별된다.
    """
    merge_base = run_git(["merge-base", "HEAD", base_ref], root).strip()
    ref = merge_base or base_ref
    raw = run_git(["ls-tree", "-r", "--name-only", ref, str(MIGRATIONS_DIR) + os.sep], root)
    files = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        # ls-tree 는 항상 backend/migrations/<name> 형태로 반환.
        files.append(Path(line).name)
    return sorted(files), ref


def parse_versions(files: Iterable[str]) -> dict[int, list[str]]:
    """파일 목록에서 V번호 → [.sql 파일 basename] 매핑."""
    by_version: dict[int, list[str]] = {}
    for name in files:
        m = SQL_RE.match(name)
        if not m:
            continue
        num = int(m.group("num"))
        by_version.setdefault(num, []).append(name)
    return by_version


def parse_confs(files: Iterable[str]) -> dict[int, list[str]]:
    """파일 목록에서 V번호 → [.conf 파일 basename] 매핑."""
    by_version: dict[int, list[str]] = {}
    for name in files:
        m = CONF_RE.match(name)
        if not m:
            continue
        num = int(m.group("num"))
        by_version.setdefault(num, []).append(name)
    return by_version


def check(root: Path, base_ref: str) -> list[str]:
    """전체 검사를 수행하고 위반 메시지 리스트를 반환."""
    failures: list[str] = []

    local_files = list_local_files(root)
    base_files, base_actual_ref = list_base_files(root, base_ref)

    local_sql = parse_versions(local_files)
    base_sql = parse_versions(base_files)
    local_conf = parse_confs(local_files)

    if not local_sql:
        failures.append(
            f"[migration-guard] FAIL: no migration .sql files found under {MIGRATIONS_DIR}/"
        )
        return failures

    # 검사 1: 중복 (.sql)
    for num in sorted(local_sql):
        if len(local_sql[num]) > 1:
            files_str = "\n".join(
                f"    - {MIGRATIONS_DIR}/{f}" for f in sorted(local_sql[num])
            )
            failures.append(
                f"[migration-guard] FAIL: V{num:03d} is duplicated\n{files_str}"
            )

    base_max = max(base_sql) if base_sql else 0
    new_versions = sorted(v for v in local_sql if v not in base_sql)

    # 검사 2: 단조성 + 검사 3: 연속성
    if new_versions:
        expected = base_max + 1
        for v in new_versions:
            if v <= base_max:
                files_str = "\n".join(
                    f"    - {MIGRATIONS_DIR}/{f}" for f in sorted(local_sql[v])
                )
                failures.append(
                    f"[migration-guard] FAIL: V{v:03d} is not greater than base ({base_actual_ref}) max V{base_max:03d}\n"
                    f"{files_str}\n"
                    f"    rebase onto {base_ref} and rename to V{base_max + 1:03d} or above"
                )
                continue
            if v != expected:
                files_str = "\n".join(
                    f"    - {MIGRATIONS_DIR}/{f}" for f in sorted(local_sql[v])
                )
                failures.append(
                    f"[migration-guard] FAIL: V{v:03d} leaves a gap (expected V{expected:03d} after base max V{base_max:03d})\n"
                    f"{files_str}\n"
                    f"    rename to V{expected:03d}"
                )
            expected = v + 1

    # 검사 4: .conf pair — 같은 V번호의 .sql 이 반드시 있어야 하고,
    # base name (V<NNN>__<descriptor>) 이 .sql 과 일치해야 한다.
    for num in sorted(local_conf):
        for conf_name in local_conf[num]:
            conf_base = conf_name[:-len(".conf")]
            sql_names = local_sql.get(num, [])
            sql_bases = {n[:-len(".sql")] for n in sql_names}
            if not sql_bases:
                failures.append(
                    f"[migration-guard] FAIL: V{num:03d} has .conf but no .sql\n"
                    f"    - {MIGRATIONS_DIR}/{conf_name}"
                )
                continue
            if conf_base not in sql_bases:
                paired = ", ".join(sorted(sql_bases))
                failures.append(
                    f"[migration-guard] FAIL: V{num:03d} .conf base name does not match its .sql\n"
                    f"    - {MIGRATIONS_DIR}/{conf_name}\n"
                    f"    expected base: {paired}"
                )

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Flyway 마이그레이션 V번호 충돌·단조성·연속성·.conf 페어 검사."
    )
    parser.add_argument(
        "--base",
        default="origin/main",
        help="비교 기준 ref (기본 origin/main). PR CI 에서는 origin/${{ github.base_ref }}.",
    )
    parser.add_argument(
        "--root",
        default=None,
        help="repository 루트 (기본은 스크립트의 부모 디렉토리).",
    )
    args = parser.parse_args()

    if args.root:
        root = Path(args.root).resolve()
    else:
        root = Path(__file__).resolve().parent.parent

    failures = check(root, args.base)

    if failures:
        for msg in failures:
            print(msg)
        print(
            f"\n[migration-guard] {len(failures)} violation(s) found. "
            "See spec/conventions/migrations.md for the policy.",
            file=sys.stderr,
        )
        return 1

    local_sql = parse_versions(list_local_files(root))
    max_v = max(local_sql) if local_sql else 0
    count = len(local_sql)
    print(
        f"[migration-guard] OK: {count} migration(s), max V{max_v:03d}, base={args.base}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
