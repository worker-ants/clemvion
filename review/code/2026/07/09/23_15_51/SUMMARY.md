# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 5건(문서 과잉주장 1, 유지보수성 DRY 3, 배선 통합테스트 부재 1) 모두 기능 결함 아닌 프로세스/구조 부채. requirement 가 구현-spec(§7.2) 정합·기존 4개 enricher 패턴 재사용·40/40 단위테스트 통과 확인. `scope` 는 success 이나 산출 파일 미기록(FS-write flakiness).

## Critical
없음.

## WARNING (5)

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| 1 | 문서화 | JSDoc·plan 이 `$params.<name>` 자동완성을 "된다"고 서술하나 `$params` 는 root 변수 목록 미등록 → 이 enricher 영향권 밖 | **FIX** — JSDoc/plan 에서 `$params.<name>` 자동완성 주장 제거, 실제 영향 경로(`$node[...].output.parameters.<name>`, `$input.parameters.<name>`)만 서술 |
| 2 | 유지보수성 | `MANUAL_TRIGGER_TYPE_MAP` 이 `INFO_EXTRACTOR_TYPE_MAP` 과 100% 동일 identity map | **FIX** — 공용 `JSON_SCHEMA_IDENTITY_TYPE_MAP` 로 통합 |
| 3 | 유지보수성 | 5개 enricher 골격 반복(DRY) | **후속(백로그)** — 리뷰어도 "이번 PR 필수 아님, 6번째 enricher 전 권장". 4-way → 5-way 로 늘어난 pre-existing 구조 부채. 공용 `projectFieldsIntoSchema` 추출은 4개 기존 함수 동반 리팩터라 별도 PR |
| 4 | 유지보수성 | `use-expression-context.ts` 5-way dispatch 가 2곳 중복 | **후속(백로그)** — #3 과 함께 `ENRICHERS` 디스패치 테이블로. pre-existing(4-way 때부터) |
| 5 | 테스트 | manual_trigger 배선 2곳 통합테스트 부재 (기존 4개 enricher 도 동일 갭) | **부분 FIX 검토** — 기존 하네스 있으면 추가, 없으면 pre-existing 갭으로 이연(단위테스트가 enricher 계약 고정) |

## INFO (선별 처분)
- e2e 면제 근거 → RESOLUTION 에 명시(프론트 autocomplete 전용·런타임 무변경). 화이트리스트 대조.
- `0-common.md §3` `output: $params` 축약 → pre-existing, project-planner 후속(이미 추적).
- CHANGELOG 미갱신 → Unreleased 항목 추가.
- 테스트 커버리지 갭(병합 경로·무관 prop 보존·비-string name) → 여유 시 보강.
- security/side_effect: 신규 공격면·부작용 없음(기존 안전장치 재사용) — 조치 불요.

## 스킵된 reviewer
performance/architecture/dependency/database/concurrency/api_contract/user_guide_sync — 순수 프론트 JSON Schema 조작이라 해당 없음(router + router_safety 판단).

## 권장 조치
1. WARNING #1 문서 정정 (최우선 — 원 버그와 동일 계열).
2. WARNING #2 TYPE_MAP 통합.
3. WARNING #5 통합테스트(가능 시).
4. WARNING #3/#4 후속 백로그.
