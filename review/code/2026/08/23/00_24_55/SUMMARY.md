# Code Review 통합 보고서

## 전체 위험도
**NONE** — `POST /workflows/:id/execute` 요청 본문을 위한 순수 OpenAPI 문서화 diff(`ExecuteWorkflowDto` 신설 + `@ApiBody` 데코레이터 1줄). 런타임 계약(파이프 진입 여부·검증 여부·허용 키 범위)은 변경 없음이 캐너리 테스트로 실측 고정되어 있고, 직전 라운드(`00_07_27`, Critical 0 · Warning 3)의 모든 지적사항이 이번 diff에 반영되어 있음을 10개 reviewer가 독립적으로 재확인했다. 10개 reviewer 전원 결과 확보(forced 7명 전원 결과 있음, 재시도 필요 0건, 미확보 reviewer 0건). Critical 0건, Warning 0건.

## Critical 발견사항

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `@Body()` 인라인 타입과 `ExecuteWorkflowDto` 가 같은 요청 본문 형태를 두 곳에 손으로 중복 선언 — 이를 강제로 동기화하는 컴파일-타임/테스트 장치가 없어 인라인 타입에 필드가 추가/삭제돼도 DTO 갱신을 잊는 것을 잡아내지 못함(이 PR 이 막으려는 문제와 반대 방향의 drift 리스크) | `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:39,58` ↔ `workflows.controller.ts:281-285` | `Pick<ExecuteWorkflowDto, 'parameterValues' \| 'input'>` 로 타입만 참조하는 방식 검토(매핑 타입은 `Object` 로 폴백돼 파이프 skip 성질 유지). 도입 전 `design:paramtypes` 실측 권장 |
| 2 | architecture | `ExecuteWorkflowDto` 이름이 "검증되는 DTO" 라는 통상 기대를 유도하나 실제로는 class-validator 데코레이터 없는 문서 전용 클래스 — 방어가 캐너리 테스트 하나에만 의존 | `execute-workflow.dto.ts:30` | 현 결정(캐너리 테스트 방어) 유지. 문서 전용 DTO 패턴이 반복될 경우 공통 명명 규약/린트 규칙으로 격상 고려 |
| 3 | security / api_contract | `POST /workflows/:id/execute` 본문이 이번 변경 이후에도 스키마 검증을 받지 않음(선존 갭, 회귀 아님) — 공개 API 문서화로 이 갭의 외부 발견 가능성이 높아짐 | `execute-workflow.dto.ts:31-39, 41-58`; `workflows.controller.ts:256` | 신규 이슈 아님. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 별도 결정 항목으로 등재됨 — 그 트래커 우선순위 결정 시 참고 |
| 4 | requirement | `input` 필드 description 에 `parameterValues` 와 달리 명시적 `SoT: EIA §R17` 링크가 없음(문구는 "동일한 마커 거부 대상"까지만) | `execute-workflow.dto.ts:52-54` (vs `:32-35`) | 필수 아님. 원하면 `input` description 끝에 `(SoT: EIA §R17)` 추가 |
| 5 | testing | OpenAPI 노출 가드가 `@nestjs/swagger` 비공개 내부 메타데이터 키 문자열(`'swagger/apiParameters'`)에 의존 | `workflows-execute-body.spec.ts:101-103` | 필수 아님(loud failure 라 안전). 주석으로 "내부 상수 의존, 버전 업그레이드 시 재확인" 남기는 정도 |
| 6 | testing | "스키마 렌더링" 서브블록이 실 컨트롤러가 아닌 로컬 `StubController` 사용 — 실 앱의 `paths[...].requestBody` `$ref` 체인 자체는 직접 검증 안 함(저장소 기존 관례와 일치, 뮤테이션 실측으로 실질 위험 낮음) | `workflows-execute-body.spec.ts:118-141` | 조치 불요(선택: `AppModule` 전체 부팅 e2e 성격 테스트 추가 가능하나 비용 대비 불필요) |
| 7 | testing | 마커 거부 규칙 가드가 부분 문자열(`stringContaining('마커')`) 포함만 확인하는 약한 단언 | `workflows-execute-body.spec.ts:160-165` | 조치 불요(의도적 설계, 마커 리터럴 재기술 금지 규율과 일치). 필요시 두 필드가 동일 문구 공유하는지로 강화 가능 |
| 8 | maintainability | 동일 "DTO 를 `@Body()` 타입으로 바꾸면 계약이 좁아진다" 비교표가 DTO docstring·완료 plan·spec-sync 트래커 3곳에 거의 verbatim 중복 | `execute-workflow.dto.ts:16-21`; `plan/complete/execute-body-openapi.md:24-27`; `plan/in-progress/spec-sync-external-interaction-api-gaps.md:958-960` | DTO docstring 을 SoT 로 유지, plan/tracker 는 링크로 축약 고려(현 규모에서는 허용 가능한 트레이드오프) |
| 9 | maintainability | `ExecuteWorkflowDto` 클래스 docstring(29줄)이 클래스 본문(23줄)보다 김 | `execute-workflow.dto.ts:3-29` | 필수 아님. 후속 확장 시 표/경고 블록을 plan 문서로 옮기는 선택지 |
| 10 | documentation | `{@link WorkflowsController.execute}`, `{@link ExecuteNodeDto.input}` JSDoc 참조 대상 unimported(직전 라운드에서 이미 트리아지·조치불필요 결정) | `execute-workflow.dto.ts:8, 42` | 조치 불요, 재지적 안 함 |
| 11 | user_guide_sync | `MASKED_VALUE_RESUBMITTED` 마커 거부 규칙이 유저 가이드(MDX)·`backend-labels.ts` 어디에도 리터럴/코드로 서술되지 않음(선존 갭, 형제 `re-run.dto.ts` 와 대칭, 직전 라운드에서 이미 명시적 비조치 처분) | `execute-workflow.dto.ts` (Swagger 최초 노출) | 조치 불요(이미 처분됨). 추후 마커 재제출 거부 UX 전면 문서화 시 `re-run`·`execute` 동시 진행 권장 |
| 12 | side_effect | `@ApiBody` 추가로 공개 OpenAPI 스키마(문서 표면)가 확장됨 — 런타임 계약은 무변경, `additionalProperties: true` 로 기존 클라이언트 비파괴 | `workflows.controller.ts:256` | 조치 불필요, PR 의 명시적 의도 |
| 13 | api_contract | `ExecuteWorkflowDto.input` description 길이가 `swagger.md §3` 기본 권장(10~40자) 초과하나 정책 거부 캐비엇 예외 클래스에 정확히 해당 | `execute-workflow.dto.ts` `input` 필드 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 시크릿·인증/인가·인젝션 벡터 없음. 선존 검증 갭(INFO)만 재확인 |
| architecture | LOW | DTO-인라인 타입 이중 선언 미동기화 리스크(WARNING 성격이나 reviewer 자체는 LOW로 판정) |
| requirement | NONE | 직전 라운드 W1~W3 전부 반영 실측 확인(jest 9/9 GREEN, tsc 클린) |
| scope | NONE | 실질 코드 변경 3파일에 한정, drive-by 변경 없음 |
| side_effect | NONE | 전역상태·파일시스템·네트워크·이벤트 부작용 없음 |
| maintainability | NONE | 함수 길이·복잡도 등 실질 위험 없음, 중복 표 3곳(INFO)만 |
| testing | LOW | OpenAPI 노출 가드 신설로 W3 구조적 해소, 잔여는 전부 INFO |
| documentation | LOW | 직전 라운드 WARNING 3건 실측 반영 확인, unimported JSDoc(INFO)만 |
| api_contract | LOW | 하위호환성·응답형식·문서-런타임 정합성 전부 확인, 선존 검증 갭(INFO) |
| user_guide_sync | NONE | 매트릭스 매칭 1행(backend-api-change), target (a) 충족, target (b) 선존 갭(INFO)만 |

## 발견 없는 에이전트

- requirement, scope, side_effect, maintainability, security, user_guide_sync (WARNING/CRITICAL 없음. INFO 는 있으나 실질 위험 아님)

## 권장 조치사항

1. (선택, 낮은 우선순위) `@Body()` 인라인 타입과 `ExecuteWorkflowDto` 를 `Pick<>` 기반 타입 참조로 통합해 두 곳 수동 동기화 부담 제거 검토 — 이번 PR 을 막을 사유는 아님.
2. (트래커 항목, 이 PR 범위 밖) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 등재된 "여분 top-level 키 400 거부 여부" 결정을 별도 작업으로 진행할 때 `class-validator` 데코레이터 부착이 뒤따라야 함.
3. (선택) `input` 필드 description 에 `parameterValues` 와 동일하게 `SoT: EIA §R17` 링크 추가.
4. 그 외 INFO 항목들은 전부 조치 불요로 이미 triage 완료 — 재작업 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨, 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(OpenAPI 문서화 전용)와 무관 |
  | dependency | router 판단상 이번 diff와 무관 |
  | database | router 판단상 이번 diff와 무관 |
  | concurrency | router 판단상 이번 diff와 무관 |

  (참고: api_contract, user_guide_sync 는 forced 목록에는 없으나 실행되어 결과 확보됨 — router 가 diff 성격상 추가 선별한 것으로 판단, 결과 정상 반영)