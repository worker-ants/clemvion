# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(스코프 규율 — PR 선언 범위를 넘는 저장소 전역 CI 가드가 CHANGELOG 언급 없이 포함됨, 코드 자체는 안전·테스트 완비). 핵심 기능(마스킹 마커 재제출 서버측 거부)은 10라운드에 걸쳐 CRITICAL 1건 → 0으로 수렴했고, 이번 최종 라운드에서 신규 CRITICAL/기능적 결함은 발견되지 않았다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 확인됨 — 강제 항목 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | `production-build-devdep-guard.ts`+spec(신규, 279줄)이 "마스킹 재제출 거부"라는 선언된 PR 범위를 넘어 저장소 전역 devDependency 누출 방지 CI 불변식을 신설한다. 이 PR 이 스스로 택한 구현 방식(AST 파서 도입 → devDependency 유출 위험)이 낳은 부작용을 국소 수정 대신 일반화해 해결한 결과이며, `CHANGELOG.md` 에는 언급되지 않는다 | `codebase/backend/src/repo-guards/__tests__/production-build-devdep-guard.ts`, `production-build-devdep.spec.ts` | 코드 자체는 읽기 전용·뮤테이션 검증 완료로 즉시 조치 불요. 다음엔 이런 저장소 전역 불변식 가드는 별도 PR/커밋으로 분리하거나 최소한 CHANGELOG 한 줄로 스코프 확장을 명시할 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `throwIfAny`의 raw→resolve 2단계 검사 사이, 무관한 필드의 진짜 타입 오류가 resolve 를 조기 중단시키면 JSON 문자열 안 마커 검사(②)가 실행되지 않는 UX 지연(보안 우회 아님)이 이미 docstring 에 문서화돼 있으나 그 상호작용 자체를 고정하는 회귀 테스트는 없음 | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (`throwIfAny`) | 조치 불요(기존 라운드에서 의도적 보류 확정) |
| 2 | security/testing | `masked-reject-callers-guard.ts` 의 AST 탐지는 동적 문자열 조합·프록시/리플렉션 경유 호출까지는 포착 못함(외부 공격자 통제 불가 표면, CI 가드 목적에 비례한 과도 하드닝) | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` | 조치 불요 |
| 3 | architecture | 마스킹 거부라는 하나의 도메인 규칙이 컨트롤러(`WorkflowsController.execute`)와 서비스(`ExecutionsService.reRun`) 두 레이어에 각각 독립 배선됨 — 이 PR 이 만든 문제는 아니고 기존 컨트롤러 관행을 물려받음 | `workflows.controller.ts` `execute`, `executions.service.ts` `reRun` | 강제 아님. 다음에 `WorkflowsController.execute`를 손댈 기회에 서비스 레이어로 수렴 고려 |
| 4 | architecture | `trigger-parameter.types.ts` 가 타입 정의 외에 reason→code 매핑·Exception 클래스까지 겸함(기존 관례, 이번 PR 이 확장한 것) | `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` | 강제 아님. 파일 분리는 비용 대비 이득 불확실 |
| 5 | scope | 신규 repo-guard 인프라(가드+spec+tsconfig, ~613줄)가 핵심 기능 구현량(~785줄)과 맞먹거나 diff 전체의 약 44%를 차지 — 9라운드 중 6라운드가 원 기능이 아니라 가드 자신의 결함 수정에 쓰임 | `masked-reject-callers-guard.ts`+spec, `production-build-devdep-guard.ts`+spec | 조치 불요(이미 수렴, 매 라운드 근거 명시). 참고 등재 |
| 6 | side_effect | `MASKED_MARKERS` 가 module-private → `export const` 로 승격돼 egress 마스킹 판정과 재제출 거부 판정이 배열을 공유 — 직접 소비처는 `isMaskedMarker` 뿐이라 실수 변형 표면 없음, `Object.freeze`+캐너리로 불변성 보장 확인 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:150` | 조치 불요 |
| 7 | security/side_effect/api_contract | `errors`→`details` 응답 봉투 교정 — 필터가 애초에 `errors` 키를 읽지 않아 필드별 내역이 조용히 버려지던 선존 버그의 수정(신규 회귀 아님, 순수 개선). 회귀 테스트로 고정 확인 | `executions.service.ts:512`, 비교 `http-exception.filter.ts` | 조치 불요 — 확인 완료 |
| 8 | side_effect | `POST /workflows/:id/nodes/:nodeId/execute`(`executeNode`)는 이번 거부 검사를 거치지 않음 — 트리거 스키마 기반 파라미터 해석 자체가 없는 별개 메커니즘이라 스코프 밖(이전 라운드에서 이미 확정) | `workflows.controller.ts` `executeNode` | 조치 불요. 향후 스키마 기반 해석을 갖게 되면 재검토 |
| 9 | maintainability | 같은 try/catch 블록에 신규 한국어 주석과 기존 영어 주석 공존(기존 이슈, 이 PR 이 만든 문제 아님) | `workflows.controller.ts:314-322` | 강제 아님 |
| 10 | maintainability | `ExecutionsService.reRun` 이 137줄로 길고 6가지 책임을 순차 수행(순증 로직 없음, 관찰) | `executions.service.ts` `reRun` | 강제 아님. 다음 편집 시 `resolveRerunInput(...)` 류 헬퍼 추출 고려 |
| 11 | maintainability | `production-build-devdep.spec.ts` 의 vacuous-방지 하한값 `500`이 매직넘버(근거 미기록, fail-closed 라 실질 위험 낮음) | `production-build-devdep.spec.ts` | 실측 파일 수를 주석에 남기면 다음 임계값 조정이 쉬워짐 |
| 12 | testing | `findMaskedResubmissions`(exported) 직접 단위 테스트 부재, 상위 함수 경유 간접 커버만 존재 | `reject-masked-resubmission.ts` | 조치 불요(간접 커버 충분 판단 유효) |
| 13 | testing | 프런트(`masked-markers.ts`)/백엔드(`sanitize-error-message.ts`) `MASKED_MARKERS` 리터럴 동일성을 강제하는 크로스런타임(jest↔vitest) 테스트 없음(frontend 테스트 자신이 이미 자백·트래킹 중) | `sanitize-error-message.spec.ts`, `masked-markers.test.ts` | 이미 별도 트래커 항목으로 관리 중 |
| 14 | documentation | `ExecutionsService.reRun` 상단 JSDoc 요약이 신규 마스킹 재제출 거부 동작을 언급하지 않음(인라인 주석엔 상세 서술 존재) | `executions.service.ts:415` | 요약 줄에 `(EIA §R17 마스킹 재제출 거부 포함)` 구절 추가 고려. 강제 아님 |
| 15 | documentation | `toTriggerParameterErrorDetails` JSDoc 예시 reason 목록이 신규 `masked_value_resubmitted` 를 포함하지 않음(맵 자체엔 개별 doc comment 존재, 정보 손실 없음) | `trigger-parameter.types.ts:65-73` | 예시 갱신 또는 "등" 표현 추가. 강제 아님 |
| 16 | api_contract | 두 Manual 엔드포인트의 유효 요청 공간이 좁아지는 형식적 breaking 변경(마커 리터럴 3종이 값 자리 예약어화) — 외부 소비자 부재 확인·spec 4곳·CHANGELOG 에 근거 문서화 완료 | `reject-masked-resubmission.ts`, 호출부 2곳 | 조치 불요. 향후 유사 패턴엔 (a)소비자 확인 (b)spec 등재 (c)CHANGELOG 고지 세트 유지 |
| 17 | api_contract | 형제 엔드포인트가 동일 실패 계열에 서로 다른 최상위 `code`(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`) 사용 — 이번 PR 이 만든 이탈 아님, spec 에 명시적으로 문서화됨 | `executions.service.ts:505`, `workflows.controller.ts:318` | 조치 불요(스코프 밖, 이전 라운드 유지 결정) |
| 18 | api_contract | `ReRunRequestDto.inputOverride` Swagger 설명이 신규 예약어 제약(마스킹 마커 3종)을 노출하지 않음 | `re-run.dto.ts:19-26` | 다음 편집 기회에 description 한 줄 추가. 강제 아님(이미 유예된 항목) |
| 19 | user_guide_sync | `MASKED_VALUE_RESUBMITTED` 코드가 `backend-labels.ts` `ERROR_KO` 에 미매핑이나 매트릭스 `error-codes.ts` glob 범위 밖이며 형제 코드 3종과 동형(회귀 아님). `details[].code` 는 프런트가 애초에 소비하지 않아 일반 사용자 노출 경로 없음 | `sanitize-error-message.ts:150,164`, `trigger-parameter.types.ts` | 조치 불요(매트릭스 gate 밖) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. 5건 INFO(전부 조치 불요) — 값 검사 우선 순서로 boolean 완전 우회 근본 해소 재확인, 정보 노출 없음 |
| architecture | LOW | 마스킹 거부 로직이 controller/service 두 레이어에 각각 배선(INFO). 데코레이터 패턴·AST fitness function 등 긍정 설계 다수 |
| requirement | NONE | 요구사항 완전 구현 확인, spec 5문서 line-level 대조 결과 SPEC-DRIFT 없음 |
| scope | MEDIUM | `production-build-devdep-guard.ts`(+spec, 279줄)가 PR 선언 범위 밖 저장소 전역 CI 가드로 포함, CHANGELOG 미언급(WARNING). 핵심 기능 자체는 스코프 이탈 없음 |
| side_effect | NONE | 전역 상태·FS·네트워크 부작용 없음. `MASKED_MARKERS` export 승격 안전, 검사가 실행엔진/감사로그보다 항상 선행 확인 |
| maintainability | LOW | reRun 137줄/다책임, 매직넘버 500 근거 미기록 — 전부 INFO, 신규 CRITICAL/WARNING 없음 |
| testing | LOW | 뮤테이션 2건 직접 실측(순서 불변식, 가드 탐지 실효성) 모두 정확히 RED. 189/189 통과 실측. carry-over INFO 3건 |
| documentation | LOW | 문서화 수준 이례적으로 높음. `reRun` JSDoc 요약 미반영 등 INFO 2건만 |
| api_contract | LOW | 요청 유효값 집합 좁아지는 형식적 breaking 변경이나 근거·문서화 완료. 형제 코드 불일치 등 기존 drift는 스코프 밖 |
| user_guide_sync | NONE | frontend 변경 0건, 매트릭스 재매칭 항목도 기 확정 판단 유지. 동반 갱신 누락 없음 |

## 발견 없는 에이전트

없음 — 10개 에이전트 전원이 최소 1건 이상의 INFO 또는 WARNING 을 보고했다(순수 "문제 없음" 확정도 다수 포함).

## 권장 조치사항

1. (선택) `production-build-devdep-guard.ts`+spec 을 별도 PR/커밋으로 분리하거나, 최소한 `CHANGELOG.md` 에 "부산물로 저장소 전역 devDependency 누출 방지 가드를 신설했다"는 한 줄을 보강 — 스코프 선언과 실제 diff 범위의 괴리를 리뷰 없이도 드러나게 함 (scope WARNING 대응, 병합 차단 사유는 아님)
2. (선택, 강제 아님) `ExecutionsService.reRun` JSDoc 요약 및 `toTriggerParameterErrorDetails` JSDoc 예시에 신규 `MASKED_VALUE_RESUBMITTED`/거부 동작 한 줄 추가
3. (선택, 강제 아님) `ReRunRequestDto.inputOverride` Swagger description 에 마스킹 마커 예약어 제약 명시
4. 그 외 항목은 전부 이전 9라운드에서 이미 발견·수정·회귀 테스트로 고정된 것들의 재확인이며 즉시 조치가 필요한 사안 없음 — 현재 상태로 병합 가능

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 확인됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 성격상 낮은 관련도 |
  | dependency | router 판단 — 이번 diff 성격상 낮은 관련도 |
  | database | router 판단 — 이번 diff 성격상 낮은 관련도 |
  | concurrency | router 판단 — 이번 diff 성격상 낮은 관련도 |