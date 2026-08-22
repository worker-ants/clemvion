# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실행 코드 변경 0줄(주석/JSDoc/Swagger description 만)인 코스메틱 PR. WARNING 2건은 모두 문서 일관성·비대칭 지적이며 기능적 결함은 아니다. forced reviewer 7명 전원 결과 확보 완료(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `resolveTriggerParameters` 함수의 JSDoc 블록 하나 안에서 기존 영문 설명(100-107) 뒤에 신규 한국어 설명(109-123)이 이어붙어, 같은 블록 내부에서 언어가 전환됨. 저장소의 "docblock 은 한 언어로, 한국어 설명은 별도 `//` 주석으로 분리" 패턴과 어긋남 | `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-124` | 신규 한국어 단락을 별도 블록/인라인 주석으로 분리하거나, 기존 영문 bullet 도 한국어로 통일해 블록 하나가 한 언어를 유지하게 한다 |
| 2 | documentation | `POST /workflows/:id/execute` 도 `re-run` 과 동일한 마스킹 마커 거부 규칙(`resolveTriggerParametersRejectingMasked`) 적용 대상인데, 이번 diff 로 `re-run.dto.ts` 만 상세히 문서화되어 형제 엔드포인트 간 OpenAPI 문서 비대칭이 더 두드러짐. `execute()` 의 `parameterValues` 는 DTO/`@ApiProperty` 없이 인라인 타입이라 예약어 설명이 전혀 반영되지 않음 | `codebase/backend/src/modules/workflows/workflows.controller.ts:275-279`(`@Body()` 인라인 타입), `:245-248`(`@ApiOperation`) | 이번 PR 스코프 밖이므로 즉시 수정 불요. `execute()` body 를 DTO로 승격하거나 `@ApiBody`로 문서화할 때 같은 예약어 설명을 이식하도록 트래커(`spec-sync-external-interaction-api-gaps.md` 또는 신규 항목)에 기록 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | Swagger description 이 마스킹 마커 리터럴 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)과 "부분 일치는 통과" 경계 조건을 명시하지만, 이미 spec·프런트에 공개된 기존 동작을 API 문서에 반영한 것뿐이라 신규 정보 노출·공격 표면 확대 아님 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24` | 조치 불요 |
| 2 | security | JSDoc 이 CI 가드 테스트 파일 경로(`masked-reject-callers-guard.ts`)를 인용하나 저장소 내부 경로 노출은 공격 표면과 무관 | `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:105-124` | 조치 불요 |
| 3 | requirement | `REASON_TO_DETAIL` 신규 JSDoc 3건이 spec(`error-codes.md`, `1-manual-trigger.md §6`) 및 실제 검증 로직과 정합 확인됨 | `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-56` | 없음 |
| 4 | requirement | base 함수 JSDoc 이 wrapper 함수명을 처음 언급하지만, CI 가드(`masked-reject-callers-guard.ts`)가 AST 기반이라 오탐 없음 — `masked-reject-callers.spec.ts` 15/15 GREEN 직접 실행 확인 | `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:108-123` | 없음 |
| 5 | requirement | Swagger description 3개 주장(마커 3종/정확 일치/400 응답)이 실제 구현(`isMaskedMarker`, `executions.service.ts:499-517`)과 일치. 구 설명의 부정확했던 문구("resolveTriggerParameters 검증")도 이번에 삭제되어 정확도 향상 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24` | 없음 |
| 6 | requirement | `workflows.controller.ts` 주석 한국어 번역이 "`errors`가 아닌 `details`" 대조 정보를 오히려 보강, 정보 손실 없음 | `codebase/backend/src/modules/workflows/workflows.controller.ts:320-322` | 없음 |
| 7 | requirement | spec frontmatter `code:` 목록에 `executions.service.ts` 추가 — 선행 consistency-check WARNING #1 정확히 해소 | `spec/4-nodes/7-trigger/1-manual-trigger.md:10` | 없음 |
| 8 | scope | plan 이 착수 전 선언한 "코스메틱 4건"에 spec frontmatter 1줄이 추가됐으나, 이는 `consistency-check --impl-prep` WARNING 반영이며 plan 에 근거가 명시돼 은폐된 확장 아님 | `spec/4-nodes/7-trigger/1-manual-trigger.md:10` | 조치 불요 |
| 9 | scope | `review/consistency/**` 8개 신규 파일과 plan 신규 파일은 표준 워크플로 산출물, 코드 diff 와 뒤섞이지 않음 | `review/consistency/2026/08/22/19_03_59/**`, `plan/in-progress/masked-marker-cosmetic-followups.md` | 조치 불요 |
| 10 | side_effect | `@ApiPropertyOptional` description 변경은 OpenAPI 산출물에 실제 반영되나(주석이 아닌 공개 문서 값 변경), 검증 데코레이터·타입은 불변이라 API 계약 자체는 무영향 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20` | OpenAPI 스냅샷 CI 검증이 있다면 갱신 여부만 확인 |
| 11 | side_effect | 나머지 3개 코드 파일은 순수 JSDoc/inline 주석 변경으로 실행 경로·시그니처·전역 상태 무영향 | `trigger-parameter.types.ts`, `resolve-trigger-parameters.ts`, `workflows.controller.ts:320-322` | 조치 불요 |
| 12 | maintainability | `workflows.controller.ts` `execute()` 메서드는 이번 fix 이후에도 여전히 한/영 혼재(의도된 스코프 축소, plan 에 명시) | `codebase/backend/src/modules/workflows/workflows.controller.ts:294, 297-299, 332-335` | 다음에 이 메서드를 만질 때 나머지 영문 주석도 통일 |
| 13 | maintainability | 마스킹 마커 리터럴 3종이 여러 문서 위치(Swagger description, spec §6)에 verbatim 중복 기술 — SoT(`@workflow/masked-markers`) 링크 없이 재복사됨. 이미 이번 세션 consistency-check `rationale_continuity` INFO #1 로 non-blocking defer 됨 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24`, `spec/4-nodes/7-trigger/1-manual-trigger.md §6` | 별도 액션 불요, 다음 수정 시 SoT 링크 보강 |
| 14 | testing | 4개 파일 모두 신규 테스트 불필요 확인 — 기존 스펙(`resolve-trigger-parameters.spec.ts`, `reject-masked-resubmission.spec.ts`, `workflows.controller.spec.ts`)이 로직을 이미 커버, 실행 로직 변경 없음 | 파일 1-4 전체 | 없음 |
| 15 | testing | base JSDoc 의 wrapper 함수명 최초 언급이 CI 가드 오탐 위험처럼 보였으나, AST 기반 판정 + 전용 캐너리 테스트로 이미 봉쇄됨(직접 실행 15/15 GREEN 확인) | `repo-guards/__tests__/masked-reject-callers.spec.ts`, `masked-reject-callers-guard.ts` | 조치 불요 |
| 16 | testing | Swagger description 프로즈와 마커 상수(`MASKED_MARKERS`)의 동기화를 강제하는 테스트 없음 — 저장소 전반의 공통 한계, 이번 PR 결함 아님 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24` | 이번 범위 조치 불요, 마커 변경 PR 에서 grep 체크리스트 항목으로 인지 |
| 17 | documentation | 신규 JSDoc·Swagger 서술(wrapper 역참조, CI 가드 경로, 부분 일치 통과, spec §R17 인용) 전부 소스 코드와 대조 검증해 정확함 확인 | `resolve-trigger-parameters.ts:108-124`, `re-run.dto.ts:19-24` | 없음 |
| 18 | documentation | `REASON_TO_DETAIL` JSDoc 4종이 "사용자가 취할 행동" 기준으로 일관 서술되어 내부 정합성 양호 | `trigger-parameter.types.ts:40-71` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 무변경, 신규 정보 노출 없음 |
| requirement | NONE | 신규 문서 서술 전부 코드·spec 대조 정합 확인, 캐너리 15/15 GREEN |
| scope | NONE | plan 선언 4건과 diff 정확 대응, spec frontmatter 1줄은 근거 있는 부산물 |
| side_effect | NONE | Swagger description 변경만 실질 산출물 영향, 계약 자체 불변 |
| maintainability | LOW | JSDoc 블록 내 언어 혼재(WARNING), 잔존 언어 혼재/문서 중복(INFO) |
| testing | NONE | 신규 테스트 불필요, 기존 스펙으로 회귀 커버, 가드 오탐 위험 봉쇄 확인 |
| documentation | LOW | 형제 엔드포인트 문서 비대칭(WARNING), 나머지 서술 정합 확인 |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 보고).

## 권장 조치사항
1. `resolve-trigger-parameters.ts` 의 `resolveTriggerParameters` JSDoc 블록에서 영어/한국어가 섞인 부분을 분리 — 신규 한국어 단락을 별도 블록 또는 인라인 `//` 주석으로 떼어내거나 기존 영문 bullet 을 한국어로 통일한다.
2. `POST /workflows/:id/execute` 의 `parameterValues` 를 향후 DTO 로 승격하거나 `@ApiBody` 로 문서화할 기회에, `re-run.dto.ts` 에 추가된 마스킹 마커 예약어 설명을 이식한다 — 트래커(`spec-sync-external-interaction-api-gaps.md` 등)에 후속 항목으로 기록.
3. (낮은 우선순위) 마스킹 마커 리터럴 3종이 여러 문서 위치에 verbatim 복사돼 있으므로, 다음에 이 문서들을 만질 때 공유 패키지(`@workflow/masked-markers`) SoT 링크를 보강한다 — 이미 non-blocking 으로 트래킹 중.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 강제 대상 7명 전원 결과 확보 확인됨 (누락 없음, "clean" 판정에 강제 미이행 리스크 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(주석/문서 변경) 와 무관 |
  | architecture | router 판단상 이번 diff 와 무관 |
  | dependency | router 판단상 이번 diff 와 무관 |
  | database | router 판단상 이번 diff 와 무관 |
  | concurrency | router 판단상 이번 diff 와 무관 |
  | api_contract | router 판단상 이번 diff 와 무관 (단, documentation 리뷰가 지적한 형제 엔드포인트 문서 비대칭은 별도 트래킹) |
  | user_guide_sync | router 판단상 이번 diff 와 무관 |