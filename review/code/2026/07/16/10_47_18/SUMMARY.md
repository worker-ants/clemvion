# AI 코드 리뷰 통합 보고서 — e2e playwright/config 정합 config-guard (§4 후속)

대상: `HEAD~1..HEAD` (커밋 `b9c162cd1`) — `scripts/check-e2e-playwright-config.py`(신규) +
`.claude/tests/test_check_e2e_playwright_config.py`(신규) + `.github/workflows/e2e.yml`(config-guard job) +
`harness-checks.yml`(paths) + Dockerfile/compose 주석.

실행 reviewer: **testing · scope · documentation** (CI 가드 성격에 맞춘 부분집합).

## 종합 판정: **1 Critical / 2 Warning — 전부 fix 완료** → 머지 가능

testing-reviewer 가 가드 자신의 존재 이유를 무력화하는 실질 결함을 로컬 재현으로 포착했다. 모두 fix.

## Critical (fix 완료)

| # | reviewer | 항목 | 처분 |
|---|---|---|---|
| 1 | testing | `_COMPOSE_MASK_RE` 가 YAML 리스트 항목이 아니라 **파일 전체 텍스트** unanchored substring search → 마스킹 라인을 지우고 경로를 언급하는 **주석**만 남기면 "존재"로 오판(false-negative). 정확히 가드가 막으려던 "마스킹 누락 silent pass" 를 못 막음 | **FIXED** — `^\s*-\s*.../node_modules\s*(?:#.*)?$` + `re.MULTILINE` 로 앵커링(Dockerfile COPY 정규식과 동일 패턴). 회귀 테스트 2개(주석 무시·인라인 주석 유효) 추가. 실 재현으로 fix 후 FAIL 확인 |

## Warning (fix 완료)

| # | reviewer | 항목 | 처분 |
|---|---|---|---|
| 2 | testing | `_BASE_TAG_RE` 도 앵커 없음 → `FROM ...playwright:vX` 를 언급하는 주석이 실제 `FROM` 앞에 오면 오매칭 | **FIXED** — `^FROM\s+...` + `re.MULTILINE` 앵커링 + 회귀 테스트(주석 속 태그 무시) |
| 3 | testing | `pkgname_to_dir` 의 "name≠dir 케이스 대응" 이 어떤 fixture 로도 검증 안 됨(항등 매핑만 사용) | **FIXED** — dir `legacy-dir` ↔ name `@workflow/renamed` fixture 로 해소 검증 테스트 추가 |

## INFO 처분

**반영:**
- **[scope]** plan §4 에 본 후속 완료 미기록 → **plan §4 갱신**(본 가드 완료 항목 추가, 잔여=branch protection 1건).
- **[testing]** closure diff 4방향 중 2방향만 테스트 → missing-from-dockerfile 방향 테스트 추가.
- **[testing]** 방어 분기(파일 부재) 커버리지 0 → missing-lockfile·missing-dockerfile 테스트 추가.

**의도적 유지(근거 기록):**
- **[testing]** `harness-checks.yml` paths 에 Dockerfile/compose/package.json/lockfile 미등재 → **의도** —
  harness-checks 는 harness 자기검증용이고, 이 가드의 primary enforcement 는 `e2e.yml` config-guard(그 파일들
  변경 시 `paths-ignore` 로 정상 트리거). 이중 등재는 harness-checks 스코프를 흐림.
- **[scope]** backend-only `e2e` job 도 `needs: config-guard` → **의도** — 저비용(정적 <5s) fail-fast, e2e 전체
  워크플로 게이팅이 자연스러움.
- **[documentation]** 성공/실패 메시지 톤·헬퍼 docstring·PROJECT.md 미등재 → 자매 스크립트
  (`check-migration-versions.py`·`check-pnpm-security-config.py`)와 동일 수준(CI-only 가드는 self-documenting
  관례). 조치 불요.

## 검증(fix 후)
가드 pass(실 repo) + 주입 drift(mask-as-comment·태그·마스킹 누락) 각각 FAIL 재확인. 파일 테스트 11→**18**,
전체 harness suite **201 tests OK**. (CI 가드 diff — 제품 런타임 무영향이라 제품 lint/unit/build/e2e 무해당;
가드 자신의 단위 테스트가 검증 계층.)
