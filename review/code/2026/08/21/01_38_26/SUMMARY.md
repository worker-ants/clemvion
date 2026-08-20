# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 3건 중 2건은 이미 자체 발견·정규화가 완료된 선존/절차성 항목이고, 나머지 1건(base/wrapper 함수 이름 유사 병존)은 convention-only 강제라는 실질적이지만 경미한 구조적 여지. forced whitelist(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `resolveTriggerParametersRejectingMasked`(신규 wrapper)와 `resolveTriggerParameters`(base)가 같은 `utils/` 폴더에 유사한 이름으로 병존 — "어떤 호출부가 어떤 함수를 써야 하는가"라는 불변식이 컴파일러가 아니라 JSDoc 으로만 강제됨. 미래에 세 번째 Manual 경로가 생기면 잘못된(비-거부) 함수를 import 할 위험 | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (`resolveTriggerParametersRejectingMasked`) / `resolve-trigger-parameters.ts:109` (`resolveTriggerParameters`) | ESLint `no-restricted-imports`(Manual 소비 모듈에서 base 함수 import 금지) 또는 base 함수를 모듈 내부 전용으로 두고 wrapper 만 배럴로 공개하는 구조 고려 |
| 2 | scope | `fix(security)` 커밋(`50f799efd`)이 developer 턴에서 `spec/5-system/14-external-interaction-api.md` 를 직접 수정 — CLAUDE.md 의 developer `spec/` read-only 역할 경계 위반. **이미 작업자 스스로 `git log -S` 로 발견해 `plan/complete/spec-update-masked-reject-framing.md`(planner 턴 + `spec_impact` 등재)로 사후 정규화 완료** | `spec/5-system/14-external-interaction-api.md` (커밋 `50f799efd`) | 추가 조치 불요(이미 자체 정규화됨). 향후 유사 fix 커밋에서 spec 변경 필요 시 같은 턴에 planner 위임을 먼저 트리거하는 절차 재확인 |
| 3 | api_contract | `POST /executions/:id/re-run`(`code: 'INVALID_INPUT'`)과 `POST /workflows/:id/execute`(`code: 'INVALID_TRIGGER_PARAMETERS'`)가 동일 실패 사유(`masked_value_resubmitted`)에 대해 응답 봉투 최상위 `error.code` 를 다르게 반환. `details[].code` 는 이번 PR 로 완전히 수렴(`MASKED_VALUE_RESUBMITTED`)했지만 최상위 `code` drift는 선존 상태이며 이번 PR 이 만든 결함은 아님 — 다만 details 수렴으로 더 눈에 띄게 됨 | `codebase/backend/src/modules/executions/executions.service.ts` (게이트 506) vs `codebase/backend/src/modules/workflows/workflows.controller.ts` | 이번 diff 스코프 밖(강제 아님). 다음에 두 호출부 에러 봉투를 손댈 기회에 최상위 `code` 통일 고려, 또는 spec §6 근처에 "최상위 code 는 경로별로 다르다, details[].code 만 공통" 캐비엇 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/requirement | raw(coerce 전) 우선 검사 → resolve → resolve 후 재검사의 2단계 순서가 이전 라운드 CRITICAL(boolean 파라미터 완전 우회)을 해소한 상태로 코드·테스트·spec 세 곳에서 line-level 일치 확인 | `reject-masked-resubmission.ts:56-75`(`resolveTriggerParametersRejectingMasked`) | 확인용, 조치 불요 |
| 2 | security/requirement | 정확 일치(substring 아님) 판정 + `MAX_REDACT_DEPTH` 경계에서 값 검사가 깊이 검사보다 먼저 수행 — `a***b` 등 부분 포함 값은 정상 통과, 프런트 미러(`masked-markers.ts`)와도 리터럴 일치 | `reject-masked-resubmission.ts:132-145`(`hasMaskedLeaf`) | 확인용, 조치 불요 |
| 3 | security/side_effect/api_contract | `errors`→`details` 봉투 키 교정은 `GlobalExceptionFilter` 가 애초에 `errors` 를 읽지 않아 non-breaking(비어있던 자리를 처음 채움). 회귀 테스트로 고정 | `executions.service.ts:512`, `http-exception.filter.ts:73` | 확인용, 조치 불요 |
| 4 | security/side_effect/scope | webhook(`hooks.service.ts:183`)·schedule(`schedule-runner.service.ts:78,88`)은 의도적으로 신규 거부 wrapper 를 거치지 않고 base 함수를 그대로 호출 — docstring 에 명시된 의도된 스코프 경계, grep 으로 실측 확인 | 해당 파일 미변경 | 확인용, 조치 불요 |
| 5 | security/side_effect | `MASKED_MARKERS` 가 `Object.freeze` 로 런타임 불변화되어 egress 마스킹·ingress 거부 두 판정기가 공유하는 싱글턴 변형 파급을 차단 | `sanitize-error-message.ts:150-163` | 확인용, 조치 불요 |
| 6 | testing | 신규 export 된 `isMaskedMarker`/`MASKED_MARKERS`(+freeze 하드닝)를 직접 겨냥한 단위 테스트가 없음(간접 호출로만 검증) | `sanitize-error-message.ts`(`isMaskedMarker`), 대응 spec 부재 | 필수 아님. `expect(() => MASKED_MARKERS.add('x')).toThrow()` 캐너리 추가 권장 |
| 7 | testing | `findMaskedResubmissions` 의 `isRecord(rawSource)` 가드에서 "배열이 rawSource 로 들어오는" 분기가 직접 테스트되지 않음(null/문자열만 커버) | `reject-masked-resubmission.ts:121` | 필수 아님. `it.each([null,'nope',[1,2,3],42])` 파라미터화 권장 |
| 8 | maintainability/documentation | 두 호출부(`executions.service.ts`, `workflows.controller.ts`)에 "왜 여기서 마커를 거부하는가"를 설명하는 유사 취지의 인라인 주석이 각각 별도로 붙어 중복 서술 | `executions.service.ts:494-496`, `workflows.controller.ts:312-314` | 필수 아님. 함수 JSDoc 을 SoT 로 삼고 호출부 주석은 짧은 참조로 축약 검토 |
| 9 | maintainability | `throwIfAny` 함수명이 무엇을 던지는지 시그니처만으로 불명확(이전 라운드 이미 지적, 미강제 유지) | `reject-masked-resubmission.ts:91` | 필수 아님. `throwIfMaskedResubmissionErrors` 류로 구체화 고려 |
| 10 | security/requirement | `POST /workflows/:id/nodes/:nodeId/execute`(단일 노드 실행)는 트리거 파라미터 스키마 검증 경로 자체를 타지 않아 이번 가드 대상 밖 — 구조적으로 타당(재-flag 아님) | `workflows.controller.ts` (`executeNode`) | 확인용, 조치 불요 |
| 11 | user_guide_sync | `workflows.controller.ts execute()` 의 swagger jsdoc 이 400 분기(`INVALID_TRIGGER_PARAMETERS` 계열, 신규 `MASKED_VALUE_RESUBMITTED` 포함)를 문서화하지 않음 — 이 PR 이전부터 있던 갭, 신규 코드 하나가 그 안에 추가된 것뿐 | `workflows.controller.ts` (`execute`, `@ApiResponse`) | Non-blocking. 400 예시에 `MASKED_VALUE_RESUBMITTED` 샘플 추가 권장 |
| 12 | user_guide_sync | 유저 가이드 MDX(`05-run-and-debug/`)가 서버측 2층 방어를 명시하지 않음 — UI 관측 동작(마스킹 마커 남아있으면 Run 비활성)은 이미 정확히 기술돼 있어 실사용자 영향 없음, curl 직접 호출 시나리오만 미언급 | `codebase/frontend/src/content/docs/05-run-and-debug/*.mdx` | Non-blocking |
| 13 | api_contract | 신규 거부 경로에 대한 실제 HTTP(e2e/supertest) 왕복 검증이 없고 컨트롤러/서비스 단위 스펙(모킹)만 존재 — 이번 PR 이 고친 선존 버그가 바로 "throw 한 것"과 "필터가 실제로 응답한 것"의 불일치였다는 점에서 e2e 커버리지가 있었다면 더 강하게 회귀를 고정할 수 있었음 | `workflows.controller.spec.ts`, `executions-rerun.service.spec.ts` | 필수 아님. 실제 필터를 거친 400 본문 검증 supertest 1건 추가 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. 검사 순서·인가 체크 선행·MASKED_MARKERS freeze 등 이전 라운드 수정사항 실코드 재검증 완료 |
| performance | NONE | N+1·블로킹 I/O 없음. raw/resolve 2회 순회는 의도된 트레이드오프, 재귀 깊이 상한 10으로 유계 |
| architecture | LOW | base/wrapper 함수 이름 유사 병존(WARNING 1건). Open-Closed 준수, 순환 의존성 없음 |
| requirement | NONE | 2-phase 검사·정확 일치 경계·에러 봉투·스코프 경계가 spec/코드/테스트 line-level 일치, 68건 테스트 재실행 GREEN |
| scope | LOW | 절차 위반 1건(WARNING, 이미 자체 발견·사후 정규화 완료). 핵심 변경은 목적에 직접 기여, 무관한 파일 수정 없음 |
| side_effect | LOW | CRITICAL/WARNING 없음(전부 INFO). 요청 유효값 집합 축소는 breaking 이나 문서화·근거 확인됨 |
| maintainability | NONE | 이전 3라운드 WARNING 전부 실코드 해소 확인. 잔여 INFO 2건은 경미한 프로즈 반복 |
| testing | NONE | 68개 테스트 직접 실행 GREEN. INFO 2건(freeze 하드닝 직접 테스트 부재, isRecord 배열 케이스 미테스트) |
| documentation | NONE | JSDoc·spec 7곳 정합 확인. 잔여 INFO 1건(언어 혼재, 이전 라운드 처분 항목 재확인) |
| api_contract | LOW | 최상위 error.code 선존 drift(WARNING). breaking 변경은 문서화·근거 충분, Swagger drift 없음 |
| user_guide_sync | LOW | i18n/dict/backend-labels 갭 없음(신규 TSX 없음). INFO 2건(swagger jsdoc 사전 갭, MDX 서버측 방어층 미언급) |

## 발견 없는 에이전트

없음 — 전원 최소 1건 이상의 확인성 INFO 를 보유(대부분 이전 라운드 수정사항의 실코드 재검증 결과).

## 권장 조치사항

1. (architecture WARNING) `resolveTriggerParametersRejectingMasked`/`resolveTriggerParameters` 오선택 방지를 위해 ESLint `no-restricted-imports` 또는 배럴 구조로 Manual 경로의 base 함수 직접 import 를 컴파일 타임에 차단하는 방안 검토 — 다음 Manual 경로 추가 시점 이전에.
2. (api_contract WARNING) 두 Manual 엔드포인트의 최상위 `error.code` 불일치(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`)는 선존 drift 이므로 이번 PR 병합을 막을 사유는 아니나, 다음에 이 봉투를 손댈 기회에 통일하거나 spec 에 캐비엇 명시.
3. (scope WARNING) 이미 사후 정규화 완료 — 추가 조치 불요. 향후 fix 턴에서 spec 변경 필요 시 즉시 planner 위임하는 절차 재확인만 권장.
4. (INFO, non-blocking) testing 이 지적한 `MASKED_MARKERS` freeze 직접 캐너리, `isRecord` 배열 케이스 파라미터화는 다음 편집 기회에 저비용으로 추가 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보 확인됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 diff 범위(패키지 의존성 변경 없음)와 무관 |
  | database | router 판단상 이번 diff 범위(DB 스키마/쿼리 변경 없음)와 무관 |
  | concurrency | router 판단상 이번 diff 범위(신규 헬퍼는 순수 동기 함수, 동시성 이슈 표면 없음)와 무관 |
