# RESOLUTION — e2e playwright/config 정합 config-guard (§4 후속)

리뷰 세션: `review/code/2026/07/16/10_47_18` (reviewer: testing·scope·documentation)
구현 커밋: `b9c162cd1` / fix 커밋: `e9d5f3d5f`

## 판정
**1 Critical / 2 Warning — 전부 fix.** INFO 중 반영 대상 3건 처리, 나머지 의도적 유지.

## 발견 처분

| # | reviewer | 심각도 | 항목 | 처분 |
|---|---|---|---|---|
| 1 | testing | **Critical** | `_COMPOSE_MASK_RE` unanchored full-text search → 주석에 남은 마스킹 경로를 "존재"로 오판(false-negative), 가드 무력화 | **FIXED**(`e9d5f3d5f`) — 라인 앵커링 `^\s*-\s*.../node_modules\s*(?:#.*)?$`+MULTILINE. 회귀 테스트 2 |
| 2 | testing | Warning | `_BASE_TAG_RE` unanchored → 주석 속 `FROM ...tag` 오매칭 | **FIXED** — `^FROM ...`+MULTILINE. 회귀 테스트 1 |
| 3 | testing | Warning | name≠dir 매핑 미검증(fixture 항등만) | **FIXED** — `legacy-dir`↔`@workflow/renamed` fixture 테스트 |
| 4 | testing | INFO | closure diff 4방향 중 2방향만 테스트 | **FIXED**(부분) — missing-from-dockerfile 방향 테스트 추가 |
| 5 | testing | INFO | 방어 분기(파일 부재) 커버 0 | **FIXED** — missing-lockfile·missing-dockerfile 테스트 |
| 6 | testing | INFO | harness-checks paths 에 Dockerfile/compose 등 미등재 | **의도 유지** — primary enforcement 는 e2e.yml config-guard(paths-ignore 로 정상 트리거). harness-checks 는 harness 스코프 유지 |
| 7 | scope | INFO | plan §4 에 본 후속 완료 미기록 | **FIXED** — plan §4 갱신(잔여=branch protection 1건) |
| 8 | scope | INFO | backend `e2e` job 도 `needs: config-guard`(frontend 가드) | **의도 유지** — 저비용 fail-fast, 워크플로 전체 게이팅 |
| 9 | documentation | INFO×3 | 메시지 톤·헬퍼 docstring·PROJECT.md 미등재(자매 스크립트와 동일 수준) | **NO ACTION** — 컨벤션 정합 |

## TEST 결과
- 가드 실행: 실 repo pass(exit 0) + 주입 drift(mask-as-comment / 태그 불일치 / 마스킹 누락 / COPY 누락) 각각 FAIL 재확인.
- harness unittest: 파일 11→**18** tests, 전체 harness suite **201 tests OK**.
- **e2e**: 무해당 — 이 diff 는 CI 가드(Python 스크립트·workflow YAML·harness 테스트) + 주석뿐으로
  **제품 런타임 코드 0줄**. e2e 는 제품(backend/frontend runtime) 회귀 안전망이라 검증 대상이 없다(가드
  자신의 단위 테스트가 검증 계층). PROJECT.md 화이트리스트: `.github/**`·`.claude/**`·주석 전용 변경.
  (node-linker 본체 변경은 앞선 `19252b21e` 에서 both-stack e2e 254+46 green.)

## 결론
plan §4 저우선 후속(playwright 버전↔base 태그, @workflow 클로저 3자 정합)을 정적 config-guard 로 landing.
리뷰가 가드 자신의 robustness 결함(정규식 unanchored)을 포착 → 앵커링 + 회귀 테스트로 fix. 남은 §4 후속은
branch protection required-check 등록(저장소 admin, 사용자 액션) 1건. 머지 준비 완료.
