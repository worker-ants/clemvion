# RESOLUTION — 의존성 보안 거버넌스 가드 (§4 3+4) 리뷰 처분

세션: `review/code/2026/07/14/13_00_33` · reviewer 2종(security·dependency) · 0 Critical / 2 Warning
구현 커밋: `a9b6b495b` · fix 커밋: (본 커밋)

## 조치 항목

| # | 출처 | 등급 | 처분 | 대상 |
|---|---|---|---|---|
| 1 | security / dependency | WARNING | 가드가 override **키만** 검증 → **값(버전)까지 대조**하도록 `EXPECTED_OVERRIDES` 를 dict 로 확장. 핀 약화(`^4.18.0→^4.0.0`) exit 1 검증 | check-pnpm-security-config.py |
| 2 | security | WARNING | `auditConfig.ignoreCves` 무단 변경 미가드 → **`EXPECTED_IGNORED_CVES` baseline 추가**, 집합 대조. 가짜 CVE 추가/억제 삭제 exit 1 검증 | check-pnpm-security-config.py |
| 3 | dependency | INFO | PyYAML 버전 미고정 → `pip install "pyyaml>=6,<7"` 핀 | deps-security-checks.yml |
| 4 | — | — | PROJECT.md 문구를 강화된 가드(값+ignoreCves)에 맞게 갱신 | PROJECT.md |

Info(비차단, 조치 불요): CVE 수용 범위·근거·문서화 적절(실측 일치), audit `moderate` 레벨 적정, GH Actions 안전(no script-injection, `pull_request`(not `_target`), `yaml.safe_load`), `pnpm audit` 가 install 없이 lockfile 만으로 동작(격리 dir 실측), CVE 식별자 정확(GHSA 아님).

## TEST 결과
- **lint / unit / build**: 통과(구현 커밋 + config/CI 변경은 파이프라인 무영향, frozen install lockfile 불변).
- **e2e**: **면제** — 변경 set(CI workflow · Python 체크 스크립트 · audit-config · 문서)에 앱 런타임/빌드 산출 delta 없음(PROJECT.md §e2e 면제 취지). backend/frontend 런타임·Dockerfile·install 동작 무변경.
- 가드 검증(강화 후): baseline exit 0 + negative(값 약화·override 삭제·ignoreCves 추가/삭제) 전부 exit 1. audit `--audit-level=moderate` exit 0(수용 CVE 제외). workflow YAML 파싱 OK.
- workflow 자체 실동작은 PR CI 에서 검증(GH Actions 로컬 재현 불가).

## 보류·후속 항목 (저우선)
- **branch protection**: `.github/workflows/deps-security-checks.yml` 의 `config-guard`/`audit` job 을 `main` 필수 상태 검사로 등록해야 실제 머지 차단 — **repo admin(사용자) 액션**.
- 가드 회귀 테스트(`.claude/tests/test_check_pnpm_security_config.py`, stdlib unittest, harness-checks 게이트) — 로직 고정용, 후속.
- `pnpm audit` 레지스트리 일시 장애 flakiness 재발 시 `--ignore-registry-errors` 검토.
