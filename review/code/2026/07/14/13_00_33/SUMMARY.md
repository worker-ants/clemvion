# 코드 리뷰 SUMMARY — 의존성 보안 거버넌스 가드 (§4 3+4)

- 범위: `--range HEAD~1..HEAD` (커밋 `a9b6b495b` — deps-security-checks.yml · check-pnpm-security-config.py · pnpm-workspace.yaml auditConfig · PROJECT.md)
- reviewer 2종 (focused): security, dependency

## 종합 위험도: **LOW** (Critical 0 / Warning 2 → **모두 fix**)

| reviewer | 위험도 | Critical | Warning | 핵심 |
|---|---|---|---|---|
| security | LOW | 0 | 2 | 가드가 키만 검증(값 약화 미탐지) · ignoreCves 자체 미가드. CVE 수용 범위·문서화·GH Actions 안전성(no injection, pull_request, safe_load)은 양호 |
| dependency | LOW | 0 | 0 (1 shared WARNING) | **실측 검증**: pnpm audit 이 install 없이 lockfile 만으로 동작(격리 dir), CVE 식별자 정확(GHSA 아님), baseline 정확 일치, moderate 적정. INFO: PyYAML 버전 미고정 |

## Warning 처분 (2건 모두 fix — 커밋 예정)

1. **[security/dependency] 가드가 override 키만 검증, 값(버전) 미검증 → 핀 약화 우회** → **FIX**: `EXPECTED_OVERRIDES` 를 `set` → `dict`(이름→값)로 확장, 값까지 정확 대조. negative test: `lodash ^4.18.0→^4.0.0` 시 exit 1("핀 값 변경(약화 위험)").
2. **[security] `auditConfig.ignoreCves` 자체가 스냅샷 밖 → 무단 CVE 억제 가능** → **FIX**: `EXPECTED_IGNORED_CVES` baseline 추가, ignoreCves 집합 대조. negative test: 가짜 CVE 추가/js-yaml 억제 삭제 시 exit 1.

+ **[dependency INFO] PyYAML 버전 미고정** → **FIX**: `pip install "pyyaml>=6,<7"` 로 핀.

## Info 처분 (비차단)
- CVE 수용 범위·근거 적절(단일 CVE, 실측 일치) / audit moderate 적정 / GH Actions 안전 / no-install audit 실측 확인 → 조치 불요.
- **branch protection required-check 등록**(security INFO, diff 밖) — 워크플로가 머지를 실제 차단하려면 repo 설정에서 `config-guard`/`audit` job 을 required check 로 등록 필요. **repo admin 액션(사용자)** — RESOLUTION·보고에 명시.
- 가드 회귀 테스트(`.claude/tests/`) 부재 · `--ignore-registry-errors` 미사용 — 저우선 후속(RESOLUTION 기록).
