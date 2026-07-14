#!/usr/bin/env python3
"""
pnpm 보안 설정(overrides / onlyBuiltDependencies / auditConfig.ignoreCves) 스냅샷 가드.

pnpm 10.23 이 package.json 의 `pnpm` 필드를 더 이상 읽지 않아, CVE 상향 핀(overrides)과
native lifecycle-script 허용목록(onlyBuiltDependencies)은 pnpm-workspace.yaml 로 이전됐다
(plan/in-progress/pnpm-migration-followups.md §1 부수 발견). 그런데 `--frozen-lockfile` CI
는 pnpm-workspace.yaml 에서 override 를 지우거나 값을 약화(downgrade)하고 lockfile 을 함께
재생성해도 (manifest ↔ lockfile 이 정합하므로) **통과**한다 — 즉 CVE 상향 핀이 조용히
사라지거나 취약 버전대로 되돌아갈 수 있다(OWASP A06/A08). 본 가드는 기대 baseline 과 실제
pnpm-workspace.yaml 을 대조해 아래를 PR 단계에서 fail-fast 로 잡는다.

  1. overrides       — 키(패키지명) **와 값(버전 범위)** 을 모두 대조. 삭제·값 약화·무단
                       추가를 모두 검출한다(review 08_25_10/13_00_33: 키만 보면 값 약화가
                       빠져나감).
  2. onlyBuiltDependencies — native build-script 허용목록의 정확한 집합 대조.
  3. auditConfig.ignoreCves — 수용(accept)한 CVE 목록 대조. audit 실패를 무력화하는 가장
                       강력한 레버라, 이것도 무단 변경을 잡아야 거버넌스가 완결된다.

핀/허용목록/수용 CVE 를 **의도적으로** 바꿀 때는 이 파일의 EXPECTED_* 도 함께 갱신한다 —
이 2-place 편집(설정 + baseline) 자체가 리뷰 게이트다. 근거: review/code/2026/07/14/08_25_10
및 13_00_33 의 security WARNING.
"""
import pathlib
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print("ERROR: PyYAML 필요 — CI 는 `pip install \"pyyaml>=6,<7\"` 후 실행한다.", file=sys.stderr)
    sys.exit(2)

# --- baseline: pnpm-workspace.yaml 과 정확히 일치해야 하는 보안 설정 ---
# 변경 시 pnpm-workspace.yaml 과 여기를 함께 수정한다.

# 이름 → 기대 버전 범위 (값까지 정확히 대조 — 핀 약화 검출).
EXPECTED_OVERRIDES = {
    "lodash": "^4.18.0",
    "picomatch": "^4.0.4",
    "liquidjs": "^10.27.0",
    "ip-address": "^10.2.0",
    "express-rate-limit": "^8.5.1",
    "protobufjs": "^7.6.3",
    "fast-uri": "^3.1.2",
    "hono": "^4.12.21",
    "uuid": "^13.0.2",
    "ws": "^8.21.0",
    "@grpc/grpc-js": "^1.14.4",
    "multer": "^2.2.0",
    "form-data": "^4.0.6",
    "nodemailer": "^9.0.1",
    "next>postcss": "^8.5.14",
    "eslint-plugin-react-hooks": "7.0.1",
    "undici@>=7.0.0 <7.28.0": "^7.28.0",
    "vite": "^8.0.16",
    "@babel/core": "^7.29.7",
}
EXPECTED_ONLY_BUILT = {
    "isolated-vm",
    "bcrypt",
    "esbuild",
    "@swc/core",
    "@tailwindcss/oxide",
}
# 검토 후 수용(accept)한 CVE — 사유는 pnpm-workspace.yaml 의 auditConfig 주석 참고.
EXPECTED_IGNORED_CVES = {
    "CVE-2026-53550",  # js-yaml <3.15.0 DoS, frontend>gray-matter 경로, moderate.
}


def _check_set(label, expected, actual, errors):
    missing = expected - actual
    extra = actual - expected
    if missing:
        errors.append(f"  [{label}] baseline 에 있으나 사라짐: {sorted(missing)}")
    if extra:
        errors.append(f"  [{label}] baseline 미등록 항목(무단 추가?): {sorted(extra)}")


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    ws = yaml.safe_load((root / "pnpm-workspace.yaml").read_text(encoding="utf-8")) or {}

    errors = []

    # 1. overrides — 키 + 값 대조 (핀 삭제·약화·무단 추가 모두 검출)
    actual_overrides = ws.get("overrides") or {}
    for name, expected_ver in EXPECTED_OVERRIDES.items():
        if name not in actual_overrides:
            errors.append(f"  [overrides] baseline 핀이 사라짐(보안 회귀 위험): {name}")
        elif str(actual_overrides[name]) != expected_ver:
            errors.append(
                f"  [overrides] 핀 값 변경(약화 위험): {name}: "
                f"{actual_overrides[name]!r} (기대 {expected_ver!r})"
            )
    for name in actual_overrides:
        if name not in EXPECTED_OVERRIDES:
            errors.append(f"  [overrides] baseline 미등록 핀(무단 추가?): {name}")

    # 2. onlyBuiltDependencies — 집합 대조
    _check_set(
        "onlyBuiltDependencies",
        EXPECTED_ONLY_BUILT,
        set(ws.get("onlyBuiltDependencies") or []),
        errors,
    )

    # 3. auditConfig.ignoreCves — 집합 대조 (무단 CVE 억제 방지)
    _check_set(
        "auditConfig.ignoreCves",
        EXPECTED_IGNORED_CVES,
        set((ws.get("auditConfig") or {}).get("ignoreCves") or []),
        errors,
    )

    if errors:
        print(
            "pnpm 보안 설정 드리프트 — pnpm-workspace.yaml 이 기대 baseline 과 불일치:",
            file=sys.stderr,
        )
        print("\n".join(errors), file=sys.stderr)
        print(
            "\n의도한 변경이면 scripts/check-pnpm-security-config.py 의 EXPECTED_* 를 "
            "함께 갱신하세요(설정 + baseline 2-place 편집 = 리뷰 게이트).",
            file=sys.stderr,
        )
        return 1

    print(
        f"OK: overrides {len(actual_overrides)}건(값 포함) · "
        f"onlyBuiltDependencies {len(EXPECTED_ONLY_BUILT)}건 · "
        f"ignoreCves {len(EXPECTED_IGNORED_CVES)}건 baseline 일치"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
