# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실질 코드 변경(`ExecutionsService.reRun` 의 40줄 입력 해석 블록을 `resolveManualOverrideInput` private 헬퍼로 추출)은 diff 대조·테스트 재실행(70+15 GREEN)으로 동작 완전 보존이 확인된 순수 리팩터. Critical 없음. 유일한 WARNING 은 코드가 아니라 plan 문서 체크리스트 staleness. forced reviewer 7명 전원 결과 확보(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | plan 위생 | `plan/in-progress/rerun-input-resolution-extract.md` 의 작업 체크리스트 6개 항목(`/consistency-check --impl-prep`, `resolveManualOverrideInput` 추출, 뮤테이션 검증, 트래커 종결, `masked-marker-test-gaps.md` 체크박스 갱신, `complete/` 이동)이 실제로는 모두 완료됐음(커밋 `95985e3ee`/`af0eb4031`, `plan/complete/masked-marker-test-gaps.md` 존재 등으로 실측 확인)에도 여전히 `[ ]` 미체크 상태로 남아 있음 | `plan/in-progress/rerun-input-resolution-extract.md:48-54` | 본 PR 마무리 커밋에서 완료된 6개 항목을 `[x]` 로 갱신(TEST WORKFLOW·`/ai-review` 완료 후 함께 갱신 가능) |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/13-replay-rerun.md` §8.1/§8.2 의 401 에러 코드가 `UNAUTHORIZED` 로 표기돼 있으나 규약(`2-api-convention.md` §5.3, `3-error-handling.md` §1.2)은 `AUTH_REQUIRED`. 런타임(`http-exception.filter.ts:144-145`)은 이미 `AUTH_REQUIRED` 를 내므로 코드는 옳고 spec 문서만 낡음(선존, 이번 diff 범위 밖) | `spec/5-system/13-replay-rerun.md` §8.1(~line 240)·§8.2(~line 269) | spec 편집은 developer 권한 밖 — `project-planner` 턴에서 `code` 열을 `UNAUTHORIZED`→`AUTH_REQUIRED` 로 정정. 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 신규 항목으로 정확히 등재되어 유실 없음 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 코드 동등성 | 순수 extract-method 리팩터 — diff 라인 단위 대조 결과 에러 코드(`INVALID_TRIGGER_PARAMETERS`)·응답 봉투(`details`)·검증 순서(raw 우선)·반환 shape(`{__triggerSource, parameters}`)이 한 글자도 안 바뀜. `useOriginal` 삼항 연산자의 지연 평가로 "원본 재사용 시 스키마 로드 생략" 동작도 그대로 보존 (security/requirement/side_effect 공통 확인) | `executions.service.ts:483-490`(호출부), `:546-583`(신설 헬퍼) | 조치 불요 |
| 2 | 유지보수성 | 에러 매핑 `catch` 블록이 `workflows.controller.ts` 와 여전히 손으로 중복(추출 이전부터 있던 선존 상태, 주석으로 "셋 다 같아야 한다" 의도 명시) | `executions.service.ts:565` ↔ `workflows.controller.ts:319` | 향후 이 블록을 다시 손댈 때 공유 헬퍼(예: `toTriggerParameterBadRequest(err)`)로 추출해 drift 재발 표면 축소 검토 |
| 3 | 유지보수성/문서화 | `resolveManualOverrideInput` 이름이 override 해석만 암시하지만 실제로는 `__triggerSource: 'manual'` 봉투 조립까지 책임짐(JSDoc 으로 이유는 충분히 설명됨) | `executions.service.ts:582` | 선택: `buildManualOverrideExecutionInput` 등으로 리네이밍 검토(우선순위 낮음) |
| 4 | 문서화 | 신규 `resolveManualOverrideInput` JSDoc 에 `@throws`/`@param`/`@returns` 태그 없음 — 같은 파일의 자매 메서드(`assertDryRunSupported`, `getChain`)는 태그 사용 | `executions.service.ts:530-583` | `@throws {BadRequestException} INVALID_TRIGGER_PARAMETERS ...` 및 `@param`/`@returns` 추가(선택, 비차단) |
| 5 | 테스트 | 비-`TriggerParameterValidationException` rethrow 분기(`throw err;`)를 직접 겨냥한 테스트 없음 — 추출 이전부터 있던 선존 갭, 이번 PR 이 만든 것 아님 | `executions.service.ts:580` | `resolveTriggerParametersRejectingMasked` 를 mock 해 임의 `Error` 전파를 확인하는 캐너리 1개를 백로그에 추가 |
| 6 | 범위 | 이동 과정에서 주석 문구 1곳("이 함수가"→"그 wrapper 가")이 지시대상 정확성을 위해 바뀜(코드 로직은 무변경) | `executions.service.ts:559` | 조치 불요 — 필연적 동반 수정이며 정확도 개선(문서화 리뷰어도 긍정 평가) |
| 7 | plan 위생 | 이미 완료된 별개 작업(`masked-marker-test-gaps`, PR #1196)의 plan `complete/` 이동과 관련 트래커 갱신이 이번 PR 에 번들됨 — `plan-lifecycle.md §3`("이동만 담은 별 PR 분리 금지")을 근거로 plan 문서가 명시적으로 예고·정당화 | `plan/complete/masked-marker-test-gaps.md`(신규), `plan/in-progress/masked-marker-test-gaps.md`(삭제), `plan/in-progress/rerun-input-resolution-extract.md` | 조치 불요 — 정책에 부합하는 의도적 번들링 |
| 8 | 테스트 | `resolveManualOverrideInput` 은 `private` 라 직접 단위 테스트 대상이 아니고 공개 메서드 `reRun()` 경유 간접 테스트로만 커버(의도적 설계, plan 문서에 근거 명시) | `executions.service.ts:546`, 커버: `executions-rerun.service.spec.ts:303-536` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 마커 재제출 거부(EIA §R17) 로직·에러 봉투·인가 체크 전부 보존, CI 가드(`masked-reject-callers.spec.ts`) 커버리지 무영향 |
| requirement | LOW | 코드는 spec(`13-replay-rerun.md` §8.1/§8.2)과 line-level 일치, 테스트 138/138 통과. plan 체크리스트 staleness 1건(WARNING) + spec 401 코드 drift(SPEC-DRIFT, 선존) |
| scope | NONE | 핵심 diff 는 예고된 추출 리팩터만; plan 이동/트래커 갱신 번들은 문서로 근거 명시된 의도적 처리 |
| side_effect | NONE | 새 전역상태·네트워크·DB 호출·`this` 바인딩 변화 없음, private 메서드라 공개 인터페이스 영향 없음 |
| maintainability | NONE | 잘 실행된 extract-method, JSDoc 으로 설계 의도 명시. 선존 중복(#2)만 INFO |
| testing | NONE | reRun 스펙 20/20·masked-reject-callers 15/15·executions 모듈 138/138 GREEN, 뮤테이션 3종이 실제 테스트 라인과 대응 확인. 선존 갭(#5)만 INFO |
| documentation | LOW | 이동된 주석 지시대상 정확히 갱신(긍정). JSDoc 태그 누락 1건(INFO)만으로 LOW 판정 |

## 발견 없는 에이전트

없음(전원 최소 INFO 이상 기록).

## 권장 조치사항

1. `plan/in-progress/rerun-input-resolution-extract.md` 의 완료된 작업 체크리스트 6개 항목을 `[x]` 로 갱신(WARNING #1) — 본 PR 마무리 커밋에서 처리 가능, 코드 변경 불필요.
2. (선택, 비차단) `resolveManualOverrideInput` JSDoc 에 `@throws`/`@param`/`@returns` 태그 추가해 자매 메서드 스타일과 통일.
3. (백로그) 비-`TriggerParameterValidationException` rethrow 분기 회귀 캐너리 1개 추가 — 이번 PR 필수 아님.
4. (planner 턴, 이번 PR 범위 밖) `spec/5-system/13-replay-rerun.md` §8.1·§8.2 의 401 `code` 열을 `UNAUTHORIZED`→`AUTH_REQUIRED` 로 정정 — 이미 `spec-sync-external-interaction-api-gaps.md` 에 등재되어 있어 유실 위험 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위와 무관 (순수 리팩터, 성능 특성 무변경) |
  | architecture | router 판단상 이번 diff 범위와 무관 (아키텍처 경계 변경 없음) |
  | dependency | router 판단상 이번 diff 범위와 무관 (의존성 변경 없음) |
  | database | router 판단상 이번 diff 범위와 무관 (DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 범위와 무관 (동시성 로직 무변경) |
  | api_contract | router 판단상 이번 diff 범위와 무관 (공개 API 계약 무변경, private 헬퍼 추출) |
  | user_guide_sync | router 판단상 이번 diff 범위와 무관 (사용자 가이드 대상 표면 변경 없음) |