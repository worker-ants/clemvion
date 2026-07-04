# ai-review SUMMARY — workflow cap validated write DTO

- 세션: `review/code/2026/07/04/21_11_10`
- 대상 커밋: `4dd8d0701` · diff base: `origin/main` (로컬 main stale → origin/main)
- router 활성 8/14: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract
  - skip: performance, architecture, dependency, database, concurrency, user_guide_sync

## 전체 위험도: LOW

## Critical: 0 · Warning: 0

전 reviewer NONE/LOW. 핵심 설계 결정(계약 narrowing·merge 전환)이 다각도로 검증됨:

| reviewer | 결과 | 핵심 |
| --- | --- | --- |
| security | NONE | 검증 강화(무해). spread-merge 는 검증된 단일 숫자 필드만 → prototype-pollution 없음. resolveConcurrencyCap backstop 병존. |
| requirement | LOW(INFO) | spec §8·§2.4 line-level 일치(필드명·기본값 3·Editor+·엔드포인트). tsc·unit 68/68. |
| scope | NONE | spread-merge 는 plan 명시 in-scope. consistency 산출물 필수 동반. |
| side_effect | LOW(INFO) | Object.assign(rest) 비-settings 필드 보존 정확. un-set 불가는 단일 필드 스키마상 무의미(의도). |
| maintainability | NONE | DTO 중복은 의도된 mirrored-but-independent 패턴. |
| testing | LOW(INFO) | 3계층 커버 양호. 경계=1·non-object 등 소소 보강 여지. |
| documentation | LOW(INFO) | JSDoc/swagger 정확. CHANGELOG 항목 누락(관례). |
| api_contract | LOW(INFO) | narrowing 은 우려되는 breaking 아님(독립 재검증: 소비자=resolveConcurrentExecutions만, 프런트=isActive만, §2.4 스코프, workspace 선례). nested-path 400 형식 기존 pipe 처리. |

## 조치한 INFO (품질 보강)

| INFO | reviewer | 조치 |
| --- | --- | --- |
| swagger `type:` 직접참조 → thunk | requirement#2 | `type: () => WorkflowSettingsDto` (swagger.md §87 관례·trigger DTO 선례). |
| CHANGELOG 항목 누락 | documentation | `## Unreleased — workflow 동시 실행 cap validated write DTO` 추가(narrowing·무영향 근거 기록). |
| 경계값·커버리지 | testing | `@Min(1)` 경계=1 accept 테스트 추가. (non-object 는 @Type coercion 모호로 제외.) |

## 미조치(기록) INFO

- `PATCH { settings: null }` → no-op(@IsOptional skip + spread null no-op). spec 무언급 gray-area, 무해.
- `ImportWorkflowDto.settings` opaque 비대칭 — plan 후속 명시.

## 판정

Critical/Warning 0. INFO 3건 품질 보강 반영 → 조치 후 TEST WORKFLOW 재통과(lint·unit·build·e2e 232). fix 커버 fresh ai-review 로 staleness 게이트 해소 예정.
