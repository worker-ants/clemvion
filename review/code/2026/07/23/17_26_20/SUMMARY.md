# Code Review 통합 보고서

## 전체 위험도

**HIGH** — 신규 harness 회귀 가드(`test_e2e_exemption_paths_sync.py`)의 파싱·판정 로직 자체는 정확하고(16/16 통과, 실측 뮤턴트 2방향 모두 정확히 포착), 보안·부작용·스코프 관점에서도 코드 결함은 없다. 다만 **documentation reviewer와 requirement reviewer가 독립적으로 동일한 CI 배선 갭을 지적**했다: 이 가드가 지키는 대상 파일(`.github/workflows/e2e.yml`) 자체가 `harness-checks.yml`의 `paths:` 목록에 없어, 그 파일만 단독 수정하는 PR에서는 새로 만든 가드가 전혀 실행되지 않는다. 이는 같은 plan 문서가 두 줄 아래(W5 항목)에서 이미 명문화한 동일 실패 클래스의 재발이다. `forced` 화이트리스트 7개 reviewer 전원 결과가 확보되어 강제 목록 미이행으로 인한 은폐 위험은 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CI-Config/Documentation | 신규 가드(`test_e2e_exemption_paths_sync.py`)가 보호하는 `.github/workflows/e2e.yml` 자체가 `harness-checks.yml`의 `paths:` 목록에 등재되어 있지 않다. `e2e.yml`의 `paths-ignore`만 단독 수정하는 PR에서는 `harness-checks.yml`이 트리거되지 않아 이 가드가 실행되지 않는다 — 저장소가 이미 겪고(같은 plan 문서 W5 항목) 명문화한 "가드 대상 파일이 harness-checks.yml paths에 동반 등재되지 않음" 실패 클래스의 재발. (documentation reviewer는 `[CRITICAL]`, requirement reviewer는 `[WARNING]`으로 동일 이슈를 독립 지적 — 상위 심각도로 통합) | `.github/workflows/harness-checks.yml:9-40` (`paths:` 목록); 관련 완료 주장 `plan/in-progress/harness-guard-followups.md:276` | `harness-checks.yml`의 `paths:`에 `.github/workflows/e2e.yml` 항목을 추가(다른 단일 파일 항목과 동일 패턴 — 사유 인라인 주석 포함). plan의 W3 완료 표시도 이 등재 반영 또는 잔여 항목으로 재오픈 |

## 경고 (WARNING)

없음 — 유일한 실질 이슈(위 CI 배선 갭)는 documentation reviewer의 `[CRITICAL]` 태그로 상위 통합되어 Critical 표에 반영됨.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | GitHub Actions `!` negation 패턴(paths-ignore 제외-취소 문법)에 대한 파서/테스트 커버리지 없음 — `e2e.yml` 자신의 주석이 대안으로 검토했던 문법인데 파서가 이를 일반 패턴으로만 취급 | `.claude/tests/test_e2e_exemption_paths_sync.py` (`parse_paths_ignore_blocks`/`_yaml_scalar`, 게이트 71-123) | negation 항목이 실제로 쓰이기 전에 `ParserBoundaryTest` 케이스 1개로 기대 동작 pin |
| 2 | Testing | `_yaml_scalar`가 YAML의 doubled-single-quote escape(`'it''s/**'` → `it's/**`)를 처리 못 함 — "every quote style" 표방과 실커버리지 사이 소폭 간극 (실 데이터엔 해당 패턴 없어 현재 위험 0) | `.claude/tests/test_e2e_exemption_paths_sync.py:_yaml_scalar` (게이트 71-88) | 필요 시 테스트 케이스 추가, 또는 독스트링 표현을 실제 커버 3종으로 좁히기 |
| 3 | Testing | W3 항목의 뮤턴트(비-vacuity) 검증 결과가 plan 문서에 미기록 — 인접 W5 항목은 "3종 뮤턴트 전부 포착"을 명시하는데 이번 항목은 그런 서술이 없음 (본 리뷰에서 직접 실측해 문제는 없음을 확인) | `plan/in-progress/harness-guard-followups.md:276-287` | 다음 편집 시 실측 검증 결과 한 줄 추가 |
| 4 | Maintainability | 비-vacuity 임계값 `5`가 의미 설명 없는 매직 넘버 | `.claude/tests/test_e2e_exemption_paths_sync.py:251` | 이름 붙은 상수로 추출(예: `_MIN_EXPECTED_WHITELIST_PATTERNS = 5  # 근거 주석`) |
| 5 | Maintainability | `set(self.blocks[0])` 계산이 3개 테스트 메서드에 중복 | `.claude/tests/test_e2e_exemption_paths_sync.py:270, 285, 299` | `setUpClass`에서 1회 계산해 `cls.mirrored`로 공유 |
| 6 | Scope | 이번 코드 변경(W3, e2e 화이트리스트 동기 가드)과 무관한 별개 백로그 항목(§E, fail-open 관측성)의 사용자 결정 기록이 같은 plan diff에 혼입 — 코드 영향은 없음 | `plan/in-progress/harness-guard-followups.md:220-225, 333` | 필요 시 별도 커밋/PR로 분리(강제 아님, 저장소 기존 관행과 부합할 수도 있음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신뢰 입력만 처리하는 순수 파서, 하드코딩 시크릿 없음 — 실질 위험 없음 |
| requirement | MEDIUM | CI 트리거 갭(harness-checks.yml paths에 e2e.yml 미등재) — Critical 표로 통합 |
| scope | LOW | §E 무관 plan 항목 혼입(코드 영향 없음) 외 스코프 이탈 없음 |
| side_effect | NONE | 부작용 없음 — 기존 harness `import _harness` 관례 재사용, read-only 파싱 |
| maintainability | LOW | 매직넘버·중복 계산 등 사소한 개선 여지 2건 |
| testing | LOW | 실측 뮤턴트 2방향 검증 완료(vacuous 아님), negation/quote-escape edge case 미커버 |
| documentation | CRITICAL 발견 포함 (자체 종합 표기는 MEDIUM) | CI 트리거 갭 — Critical 표로 통합 |

## 발견 없는 에이전트

- security — 실질 보안 결함 없음 (INFO만, 모두 "문제 없음" 확인 성격)
- side_effect — 실질 부작용 없음 (INFO만, 모두 "문제 없음" 확인 성격)

## 권장 조치사항

1. `harness-checks.yml`의 `paths:` 목록에 `.github/workflows/e2e.yml`을 추가해 신규 가드가 자기 보호 대상 파일의 단독 수정에도 CI에서 트리거되도록 배선한다 (Critical, 최우선).
2. `plan/in-progress/harness-guard-followups.md`의 W3 완료 표시를 위 CI 배선 반영 후 확정하거나, 배선 전까지는 잔여 항목으로 재오픈해 정직하게 기록한다.
3. (선택) `!` negation 패턴, YAML doubled-quote escape 등 현재 미사용이지만 향후 등장 가능한 edge case를 `ParserBoundaryTest`에 pin 테스트로 추가.
4. (선택) 매직 넘버 `5`를 이름 붙은 상수로 추출하고, `set(self.blocks[0])` 중복 계산을 `setUpClass`로 통합.
5. (선택) §E(fail-open 관측성) 관련 plan 결정 기록을 이번 diff와 분리할지 검토.

## 라우터 결정

- `routing_status=done` (router가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 즉 실행된 7명 전원이 router_safety에 의해 강제 포함되었고, 전원 결과가 정상 확보됨. 강제 화이트리스트 미이행에 따른 은폐 위험 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 본 diff는 harness 테스트/문서 전용 변경으로 성능 영향 코드 없음 |
  | architecture | router 판단 — 아키텍처 변경 없음 (신규 self-test 1개 파일 추가) |
  | dependency | router 판단 — 신규 외부 의존성 추가 없음 |
  | database | router 판단 — DB 관련 코드 변경 없음 |
  | concurrency | router 판단 — 동시성 관련 코드 변경 없음 |
  | api_contract | router 판단 — API 계약 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 문서 동기화 대상 아님(harness 내부 문서) |