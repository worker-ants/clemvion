# Code Review 통합 보고서

## 전체 위험도
**LOW** — 리뷰 대상 4개 backend 코드 파일은 실행 로직 0줄 변경의 순수 주석/JSDoc/Swagger `description` 문서화 diff 이며, 8개 reviewer(전원 forced) 모두 결과를 확보했다. 유일한 WARNING 은 코드가 아니라 완료 plan 문서(`plan/complete/masked-marker-cosmetic-followups.md`)가 아직 병합되지 않은 형제 PR(#1194)의 존재를 기정사실처럼 서술해 트래킹 정보 유실 위험을 만든다는 점이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 완료 plan 이 아직 병합되지 않은 형제 PR #1194(`egress-masking.md` 신설, 이 PR 과 같은 base 커밋에서 분기, `state: OPEN`/`mergedAt: null` 확인됨)의 존재를 "이미 소유" 라고 전제해, 그 문서 근거로 "이번 diff 가 산문 지점을 3곳 늘렸다"는 사실을 트래커(`spec-sync-external-interaction-api-gaps.md`)에 옮기지 않았다. 병합 순서가 보장되지 않으므로(#1194 가 이 PR 보다 늦게 병합되면) 이 정보가 어느 문서에도 남지 않을 위험이 있다. | `plan/complete/masked-marker-cosmetic-followups.md:67-69` | `spec-sync-external-interaction-api-gaps.md`(in-progress, 계속 편집 가능)에 "이번 diff 가 산문 지점 3곳 증가 — `egress-masking.md`(PR #1194, 미병합) 병합 시 흡수 예정, 실패/철회 시 이 항목을 직접 기록" 형태로 폴백을 남겨 등재. `masked-marker-cosmetic-followups.md` 는 이미 status: complete 로 봉인되어 직접 수정 대상 아님. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability, documentation, security, requirement, scope, testing, side_effect | 직전 리뷰 라운드(`19_25_39`)의 유일한 WARNING("`resolveTriggerParameters` JSDoc 블록 내부에서 영→한 언어 전환")이 이번 diff 로 정확히 해소됨을 다수 reviewer 가 직접 파일을 열어 재확인 — 블록 전체가 한국어로 통일되었고 원문 영문 bullet 3개의 정보 손실 없음. "## 헤딩 + 한국어" 스타일은 `shared/utils/` 트리(`strip-external-only-fields.ts`, `terminal-error-payload.ts` 등)의 기존 관례와 일치. | `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-123` | 조치 불요 (정합 확인됨). |
| 2 | documentation, api_contract | `POST /workflows/:id/execute` 는 `re-run` 과 동일한 마스킹 마커 거부 규칙(`resolveTriggerParametersRejectingMasked`) 적용 대상이지만, 이번 diff 로 `re-run.dto.ts` 만 Swagger description 이 상세화되어 형제 엔드포인트 간 OpenAPI 문서 비대칭이 더 도드라짐. `execute()` body 가 DTO 클래스가 아닌 인라인 타입이라 이번 코스메틱 스코프로는 반영 불가. | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-26` vs `codebase/backend/src/modules/workflows/workflows.controller.ts:275-279` | 조치 불요 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(:825-832)에 이유·이식 계획과 함께 이미 신규 항목으로 등재됨. `execute()` body 를 DTO 로 승격할 때 `re-run.dto.ts` description 을 이식. |
| 3 | side_effect, testing | base 함수 JSDoc 에 처음으로 wrapper 함수명(`resolveTriggerParametersRejectingMasked`)이 등장하지만, `masked-reject-callers-guard.ts` 는 `ts.createSourceFile` + identifier/ElementAccessExpression 노드만 순회하므로 JSDoc 트리비아는 판정 대상이 아님을 가드 소스에서 직접 확인 — CI 가드 오탐 없음. import 표면도 늘지 않음(`{@link}` 태그만 사용). | `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:108-123`, `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:110-141` | 조치 불요. |
| 4 | maintainability | 신규 JSDoc 3건(`REASON_TO_DETAIL` 의 `missing_required`/`coerce_failed`/`invalid_schema`) 중 `missing_required` 만 단일행 포맷이고 나머지 둘은 다중행 포맷 — 파일 지배 패턴(다중행)과 불일치하는 사소한 스타일 편차. | `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40` (단일행) vs `:45-56` (다중행) | 급하지 않음 — `missing_required` 를 다중행으로 통일하거나 짧은 항목 전부를 단일행으로 통일. |
| 5 | maintainability | `resolveTriggerParameters` JSDoc(24줄)이 함수 본문(~30줄)에 근접할 만큼 길어져, 아키텍처적 맥락(CI 가드 경로·spec §R17 인용)까지 함수 docblock 하나에 담김. | `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-163` | 즉시 조치 불요. 향후 이 블록이 더 늘어나면(예: 또 다른 wrapper 추가) 별도 모듈 문서로 분리 검토. |
| 6 | maintainability, documentation | `workflows.controller.ts` `execute()` 의 한/영 주석 혼재 해소는 이번 diff 로 건드린 try/catch 블록(`:320-322`)에만 한정되고, 나머지 3곳(`:294`, `:297-299`, `:332-335`)은 영문 그대로 잔존 — plan 이 스스로 명시한 의도된 좁은 스코프이며 신규 회귀 아님. | `codebase/backend/src/modules/workflows/workflows.controller.ts:294,297-299,332-335` | 다음에 이 메서드를 만질 기회에 나머지 영문 주석도 통일 (이미 plan/이전 리뷰에 기록됨). |
| 7 | security | Swagger description 이 마스킹 마커 리터럴 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)과 거부 조건을 공개 API 문서에 명시하지만, 이미 프런트엔드 egress 마스킹 동작과 spec(`1-manual-trigger.md §6`)에 공개돼 있던 값이라 신규 노출이 아님 — 값 자체는 시크릿이 아닌 sentinel 문자열. | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-24` | 조치 불요. |
| 8 | side_effect | `re-run.dto.ts` 의 Swagger description 변경은 "주석 전용"과 달리 OpenAPI 산출물(swagger.json/UI)이 실제로 바뀌는 유일한 변경이나, 이 필드의 description 문자열을 단언하는 테스트/스냅샷이 저장소에 없어 CI 를 깨뜨릴 부작용이 없음을 확인. | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24` | 조치 불요. OpenAPI 스냅샷 검증을 추가한다면 그 시점에 함께 갱신. |
| 9 | testing | Swagger description 프로즈(마커 3종 리터럴)와 `@workflow/masked-markers` 상수 값의 동기화를 강제하는 테스트는 없음 — 저장소 전반의 기존 한계이며 이번 PR 이 새로 만든 결함 아님(`egress-masking.md §3` "기계가 지키지 않는다" 가 이미 이 클래스를 소유). | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24` | 이번 범위 조치 불요. 마커 리터럴이 바뀌는 PR 에서 grep 체크리스트 항목으로 인지. |
| 10 | testing | 새로 문서화된 내용(4가지 reason→code 매핑, 마스킹 마커 거부 배선, `details[]` 봉투 구성)은 모두 기존 spec(`resolve-trigger-parameters.spec.ts`, `reject-masked-resubmission.spec.ts`, `workflows.controller.spec.ts`)이 라인 번호까지 이미 커버함을 재확인 — 신규 테스트 불필요. 이연된 갭 2건(`findMaskedResubmissions`, `throwIfAny` phase 경계 직접 단위 테스트 부재)은 plan 에 이미 사유와 함께 계류 중이며 이번 diff 가 그 로직을 건드리지 않음. | `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-71`, `resolve-trigger-parameters.ts:100-124`, `re-run.dto.ts:18-26`, `workflows.controller.ts:320-322` | 없음. |
| 11 | scope, side_effect | `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` 목록에 `executions.service.ts` 1줄 추가 — plan 이 스스로 `/consistency-check --impl-prep` WARNING 1건 반영으로 명시 귀속한 항목이며 임의 확장이 아님. 본문·데이터 모델·동작 무변경. | `spec/4-nodes/7-trigger/1-manual-trigger.md:10` | 조치 불요. |
| 12 | scope, side_effect | `review/code/2026/08/22/19_25_39/**`(11파일) · `review/consistency/2026/08/22/19_03_59/**`(8파일) 신규 산출물이 코드 diff·plan 파일과 함께 커밋됨 — 프로젝트 표준 워크플로(구현 완료 후 상시 강제 `/ai-review`, 착수 전 `consistency-check --impl-prep`)의 정상 산출물이며 `review/**` 는 gitignore 대상이 아님. | `review/code/2026/08/22/19_25_39/**`, `review/consistency/2026/08/22/19_03_59/**` | 조치 불요. |
| 13 | requirement, security, documentation, api_contract | 4개 코드 파일의 모든 신규 서술(마커 3종·정확 일치 판정·wrapper/base 역할 분리·`REASON_TO_DETAIL` 4종·§R17 인용·에러 코드·`details` vs `errors` 배선)을 실제 구현(`reject-masked-resubmission.ts`, `resolve-trigger-parameters.ts`, `executions.service.ts`, `http-exception.filter.ts`)과 spec 본문에 line-level 로 대조한 결과 전부 일치 — 지어낸 참조·오래된 주장 없음. | 4개 코드 파일 전체 | 없음 (정합 확인됨). |
| 14 | api_contract | 요청/응답 스키마, `class-validator` 데코레이터, HTTP 상태 코드, 에러 `code` 값, URL 경로, 인증/인가 데코레이터 어느 것도 이번 diff 로 변경되지 않음 — breaking change 없음. | 4개 코드 파일 전체 | 조치 불요. |
| 15 | security, testing | `BadRequestException` payload 구조(`code`/`message`/`details[]`)와 `resolveTriggerParametersRejectingMasked` wrapper 경유 호출 관계는 diff 전후 byte 단위 동일 — 인가/검증 경로 변경 없음. | `codebase/backend/src/modules/workflows/workflows.controller.ts:317-330` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행/인가/검증 로직 무변경, Swagger 마커 노출은 기존 공개 동작 문서화일 뿐 |
| requirement | LOW | 스펙 정합성 전부 확인됨; plan 문서의 미병합 PR 전제 서술 1건(WARNING) |
| scope | NONE | 코스메틱 4건 + plan 에 근거 있는 spec frontmatter 1줄, 은폐된 확장 없음 |
| side_effect | NONE | 유일한 실물 변경(Swagger description)도 CI 영향 없음, CI 가드 오탐 없음 |
| maintainability | LOW | 사소한 스타일 편차(JSDoc 포맷 불일치, docblock 길이, 의도된 좁은 스코프 잔존 혼재) |
| testing | NONE | 신규 테스트 불요, 기존 spec 이 신규 문서화 내용 전부 커버 재확인 |
| documentation | NONE | 신규 서술 전부 구현/spec 과 일치, 형제 엔드포인트 문서 비대칭은 이미 트래킹됨 |
| api_contract | LOW | 계약 변경 없음, OpenAPI 비대칭은 documentation 과 동일 사안(이미 트래킹) |

## 발견 없는 에이전트

없음 — 8개 에이전트 전원이 최소 INFO 이상의 관찰을 보고함(대부분 "조치 불요" 긍정 확인 포함).

## 권장 조치사항

1. `spec-sync-external-interaction-api-gaps.md`(in-progress)에 "이번 diff 가 산문 지점 3곳 증가 — PR #1194 병합 시 흡수 예정, 실패/철회 시 직접 기록" 형태로 폴백 항목을 등재한다 (requirement WARNING #1 해소).
2. (선택, 급하지 않음) `trigger-parameter.types.ts` 의 `REASON_TO_DETAIL` 신규 JSDoc 3건의 단일행/다중행 포맷을 통일한다.
3. (선택, 이미 트래킹됨) `execute()` body 를 DTO 로 승격하는 후속 작업 시 `re-run.dto.ts` 의 마스킹 마커 Swagger description 을 이식해 형제 엔드포인트 문서 비대칭을 해소한다.
4. (선택, 이미 트래킹됨) `workflows.controller.ts` `execute()` 의 나머지 영문 인라인 주석(:294, :297-299, :332-335)을 다음 편집 기회에 한국어로 통일한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 (개별 사유 미제공 — diff 가 실행 로직 무변경인 주석/문서 전용 변경이라 성능 영향 없음으로 추정) |
  | architecture | 라우터 판단 (개별 사유 미제공 — 구조/설계 변경 없음으로 추정) |
  | dependency | 라우터 판단 (개별 사유 미제공 — 의존성 변경 없음으로 추정) |
  | database | 라우터 판단 (개별 사유 미제공 — DB 스키마/쿼리 변경 없음으로 추정) |
  | concurrency | 라우터 판단 (개별 사유 미제공 — 동시성 관련 로직 변경 없음으로 추정) |
  | user_guide_sync | 라우터 판단 (개별 사유 미제공 — 사용자 대면 UI/가이드 변경 없음으로 추정) |
