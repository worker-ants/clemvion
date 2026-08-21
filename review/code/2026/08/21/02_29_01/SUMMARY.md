# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 5라운드에 걸친 반복 수정으로 이전 CRITICAL(boolean 마커 완전 우회) 및 WARNING 전량이 해소되었고, 이번(6번째) 라운드에서 9개 reviewer가 실코드를 직접 재대조해도 신규 CRITICAL/WARNING을 발견하지 못했다. 남은 것은 전부 INFO(비차단, 대부분 이월·확인 목적). forced(router_safety) 화이트리스트 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원의 결과가 정상 확보되어 있어 강제 화이트리스트 미이행 이슈는 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `masked-reject-callers-guard.ts`의 `importsBaseFn`이 정규식 스캔이라 namespace import(`import * as base from ...`)/re-export 형태의 base 함수(`resolveTriggerParameters`) 우회 호출을 탐지하지 못함. 현재 실제 호출부 2곳(executions.service.ts, workflows.controller.ts)은 모두 안전한 named import 형태 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:73-84` | 조치 불요. 새 Manual 실행 경로가 namespace import/re-export로 base 함수를 쓰는 사례가 생기면 그때 탐지 패턴 확장(또는 AST 파서 전환) |
| 2 | DOCUMENTATION / API-CONTRACT | `ReRunRequestDto.inputOverride`의 Swagger description이 stale 함수명(`resolveTriggerParameters`)을 인용하고, 신규 마스킹 마커 거부 제약(§R17)을 서술하지 않음 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-25`; `workflows.controller.ts` execute()의 `@ApiBadRequestResponse` 도 동일 패턴 | 조치 불요(외부 Swagger 소비자 부재 확인됨, 이전 라운드부터 이월). 다음 DTO 편집 시 함수명 갱신 + "마스킹 마커 정확 일치 값은 거부됨" 한 줄 추가 권장 |
| 3 | DOCUMENTATION / MAINTAINABILITY | `workflows.controller.ts` 동일 try/catch 블록 안에 신규 한국어 인라인 주석과 기존 영어 인라인 주석이 언어를 달리해 공존 | `codebase/backend/src/modules/workflows/workflows.controller.ts:314-322` | 조치 불요(이 diff가 새로 만든 문제 아님, 3라운드 연속 이월). 다음 편집 기회에 언어 통일 검토 |
| 4 | MAINTAINABILITY | `ExecutionsService.reRun`이 137줄로 길고 6가지 책임(권한체크·dry-run·chain depth·입력해석·트리거·audit log)을 순차 수행. 이번 PR 증가분은 4줄(함수 호출 1개)뿐 | `codebase/backend/src/modules/executions/executions.service.ts:420-556` | 조치 불요(이번 PR 스코프 밖, 이월). 향후 `reRun` 편집 시 입력 해석 블록을 private 헬퍼로 추출 고려 |
| 5 | API-CONTRACT | 두 Manual 실행 엔드포인트의 최상위 `error.code`가 여전히 다름(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`). `details[].code`는 완전히 수렴했으나 최상위 봉투는 선존 drift이며 spec에 명문화됨 | `executions.service.ts:505`, `workflows.controller.ts:319`; `spec/5-system/3-error-handling.md:189-193` | 조치 불요. 통일하려면 기존 클라이언트가 보는 최상위 코드 자체가 바뀌는 별도 breaking-change 결정 필요(이 PR 스코프 밖) |
| 6 | TESTING | back-compat `input.parameters`(legacy) 경로로 들어온 마스킹 마커 재제출을 직접 겨냥하는 컨트롤러 캐너리 부재(코드 구조상 `parameterValues`와 동일 `rawValues` 변수를 거부 함수에 넘기므로 실질 위험은 낮음) | `workflows.controller.ts` execute() `rawValues` 산출부; `workflows.controller.spec.ts` (신규 캐너리 3건은 전부 `parameterValues`만 사용) | 필수 아님. `input: { parameters: { apiKey: '***' } }` 케이스 1건 추가 시 두 진입 경로 보장이 코드가 아닌 테스트로 고정됨 |
| 7 | TESTING | `REASON_TO_DETAIL.masked_value_resubmitted` 매핑(code/message 리터럴) 자체를 겨냥하는 단위 테스트가 `toTriggerParameterErrorDetails` spec에 없음(통합 테스트 2건이 간접 커버) | `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:59-62,74-81`; `resolve-trigger-parameters.spec.ts:160-189` | 필수 아님. 다음 spec 편집 기회에 `masked_value_resubmitted` 케이스 한 줄 추가 |
| 8 | TESTING | (이월) `findMaskedResubmissions`의 `rawSource`가 배열 자체인 경우를 직접 겨냥하는 케이스 없음, webhook/schedule 카브아웃 경계(마커 리터럴이 정상 값으로 통과)를 직접 겨냥하는 행위 테스트 없음 | `reject-masked-resubmission.ts:121`; `reject-masked-resubmission.spec.ts:313-316`; `hooks.service.spec.ts`, `schedule-runner.service.spec.ts` | 조치 불요(이전 라운드에서 이미 저위험 판정·의도적 미조치, 상태 변화 없음 재확인) |
| 9 | USER-GUIDE-SYNC | `MASKED_VALUE_RESUBMITTED` 등 `TriggerParameterErrorDetail.code` 4종 전부에 `backend-labels.ts`의 `ERROR_KO` ko 매핑 부재(기존 3형제와 동일한 선존 패턴, frontend 소비 경로 자체가 없어 현재 사용자 영향 없음 — 4개 코드 전수 grep 0건) | `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:59-62`; 대상 `codebase/frontend/src/lib/i18n/backend-labels.ts` | 새 조치 불요(이전 라운드 `01_15_47` RESOLUTION에서 근거와 함께 보류 결정, 이번 라운드 독립 재검증 완료). 향후 `details[].code` 소비 UI가 생기는 PR에서 4개 코드 일괄 매핑 추가 권장 |
| 10 | SIDE-EFFECT | `MASKED_MARKERS`의 공개 export 타입이 `ReadonlySet<string>` → `readonly string[]`로 변경(불변식 플라시보 교정). 현재 이 심볼을 직접 import하는 소비처는 없음(전부 `isMaskedMarker()` 경유) | `codebase/backend/src/shared/utils/sanitize-error-message.ts:150-166` | 조치 불요. 향후 `MASKED_MARKERS` 값을 직접 import하는 소비처가 생기면 타입 변경을 인지하고 시작 |
| 11 | SCOPE | 공유 tracker 문서에서 이번 작업(W6)과 무관한 별도 항목(W5, `Execution.inputData` 응답 의미 반전의 외부 소비자 확인)이 같은 diff에 함께 종결 처리됨. 코드 변경 없음, 종결 사유("저장소 소유자 직접 답변") 명시됨 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 조치 불요(문서 전용, 근거 명시, 기존 그루밍 관례와 일치) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | repo-guard 정규식 커버리지 갭(#1, 실익스플로잇 없음), 에러 상세 노출 안전성 확인 |
| requirement | NONE | 이전 라운드 CRITICAL/WARNING 전량 실코드로 재확인해 해소 확인. INFO 3건은 기존 설계 경계·이전 교정 확인 |
| scope | NONE | 실질 코드 변경 11개 파일이 단일 의도에 정확히 부합. 무관 tracker 항목 동시 종결(#11)만 기록 |
| side_effect | NONE | 이번 라운드 순증분 4개 파일 전부 저위험(타입 교체·테스트 보강). 런타임 요청 경로 미변경 |
| maintainability | LOW | 함수 길이/구조/네이밍 전부 양호. 이월 INFO 2건(주석 언어 혼재, `reRun` 길이)만 유효 |
| testing | LOW | 핵심 로직 테스트 촘촘. INFO 4건(신규 2 + 이월 2) 전부 저위험, 통합 테스트가 실질 커버 |
| documentation | NONE | JSDoc/spec 정합성 확인. 이월 INFO 2건(Swagger stale 함수명, 주석 언어 혼재)만 |
| api_contract | LOW | breaking change(마스킹 마커 거부)가 통제된 형태로 문서화됨. INFO 3건(code drift, Swagger 미보강, 문서화 확인) |
| user_guide_sync | NONE | frontend 코드 미변경. INFO 1건(ko 매핑 부재)은 기존 triage된 패턴 재확인 |

## 발견 없는 에이전트

없음 (전원 최소 1건 이상의 INFO 기록, 단 전부 비차단·다수 이월 확인 목적).

## 권장 조치사항

1. (필수 아님) `workflows.controller.spec.ts`에 legacy `input.parameters` 경로 마스킹 거부 캐너리 1건 추가 — 코드 구조 보장을 테스트로 고정 (#6)
2. (필수 아님) `resolve-trigger-parameters.spec.ts`의 `toTriggerParameterErrorDetails` describe 블록에 `masked_value_resubmitted` 케이스 추가 (#7)
3. (다음 DTO 편집 시) `re-run.dto.ts` Swagger description을 실제 함수명(`resolveTriggerParametersRejectingMasked`)과 신규 마커 거부 제약으로 갱신 (#2)
4. (다음 편집 시) `workflows.controller.ts`의 한/영 혼재 인라인 주석 언어 통일 (#3)
5. (후속 PR 스코프) `details[].code`를 소비하는 UI가 생기면 `backend-labels.ts`에 4개 코드(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`) ko 매핑을 일괄 추가 (#9)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명, 구체적 사유는 prompt에 미상세 — router가 이번 diff 범위와 무관하다고 판단해 제외한 것으로 추정)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 사유 미상세(router 판단, 이번 diff가 성능 경로와 무관한 것으로 추정) |
  | architecture | 사유 미상세(router 판단, 아키텍처 변경 없는 것으로 추정) |
  | dependency | 사유 미상세(router 판단, 의존성 변경 없는 것으로 추정) |
  | database | 사유 미상세(router 판단, DB 스키마/쿼리 변경 없는 것으로 추정) |
  | concurrency | 사유 미상세(router 판단, 동시성 표면 변경 없는 것으로 추정) |