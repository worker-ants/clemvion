#!/usr/bin/env python3
"""
pnpm 보안 설정(overrides / onlyBuiltDependencies) 스냅샷 가드.

pnpm 10.23 이 package.json 의 `pnpm` 필드를 더 이상 읽지 않아, CVE 상향 핀(overrides)과
native lifecycle-script 허용목록(onlyBuiltDependencies)은 pnpm-workspace.yaml 로 이전됐다
(plan/in-progress/pnpm-migration-followups.md §1 부수 발견). 그런데 `--frozen-lockfile` CI
는 pnpm-workspace.yaml 에서 override 를 지우고 lockfile 을 함께 재생성해도 (manifest ↔
lockfile 이 정합하므로) **통과**한다 — 즉 CVE 상향 핀이 조용히 사라져 취약 버전으로 회귀할
수 있다(OWASP A06/A08). 본 가드는 기대 baseline 과 실제 pnpm-workspace.yaml 을 대조해 핀
삭제·무단 추가를 PR 단계에서 fail-fast 로 잡는다.

핀을 **의도적으로** 추가/제거할 때는 이 파일의 EXPECTED_* 도 함께 갱신한다 — 이 2-place
편집(설정 + baseline) 자체가 리뷰 게이트다. 근거: review/code/2026/07/14/08_25_10 의
security WARNING(overrides 내용 검증 CI 가드 부재).
"""
import pathlib
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print("ERROR: PyYAML 필요 — CI 는 `pip install pyyaml` 후 실행한다.", file=sys.stderr)
    sys.exit(2)

# --- baseline: pnpm-workspace.yaml 과 정확히 일치해야 하는 보안 핀 집합 ---
# 변경 시 pnpm-workspace.yaml 과 여기를 함께 수정한다.
EXPECTED_OVERRIDES = {
    "lodash",
    "picomatch",
    "liquidjs",
    "ip-address",
    "express-rate-limit",
    "protobufjs",
    "fast-uri",
    "hono",
    "uuid",
    "ws",
    "@grpc/grpc-js",
    "multer",
    "form-data",
    "nodemailer",
    "next>postcss",
    "eslint-plugin-react-hooks",
    "undici@>=7.0.0 <7.28.0",
    "vite",
    "@babel/core",
}
EXPECTED_ONLY_BUILT = {
    "isolated-vm",
    "bcrypt",
    "esbuild",
    "@swc/core",
    "@tailwindcss/oxide",
}


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    ws = yaml.safe_load((root / "pnpm-workspace.yaml").read_text(encoding="utf-8")) or {}

    actual_overrides = set((ws.get("overrides") or {}).keys())
    actual_only_built = set(ws.get("onlyBuiltDependencies") or [])

    errors = []
    for label, expected, actual in (
        ("overrides", EXPECTED_OVERRIDES, actual_overrides),
        ("onlyBuiltDependencies", EXPECTED_ONLY_BUILT, actual_only_built),
    ):
        missing = expected - actual
        extra = actual - expected
        if missing:
            errors.append(
                f"  [{label}] baseline 에 있으나 pnpm-workspace.yaml 에서 사라짐 "
                f"(보안 핀 손실 위험): {sorted(missing)}"
            )
        if extra:
            errors.append(
                f"  [{label}] pnpm-workspace.yaml 에 있으나 baseline 미등록 "
                f"(무단 추가?): {sorted(extra)}"
            )

    if errors:
        print(
            "pnpm 보안 설정 드리프트 — pnpm-workspace.yaml 이 기대 baseline 과 불일치:",
            file=sys.stderr,
        )
        print("\n".join(errors), file=sys.stderr)
        print(
            "\n의도한 변경이면 scripts/check-pnpm-security-config.py 의 EXPECTED_* 를 "
            "함께 갱신하세요.",
            file=sys.stderr,
        )
        return 1

    print(
        f"OK: overrides {len(actual_overrides)}건 · "
        f"onlyBuiltDependencies {len(actual_only_built)}건 baseline 일치"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
