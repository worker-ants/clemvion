# 변경 범위(Scope) 리뷰

## 발견사항

(없음)

전체 changeset(파일 13개)을 점검했으나 요청된 범위(`POST /workflows/:id/execute` 본문을 OpenAPI 에만 문서화하고 런타임 계약은 건드리지 않는다)를 벗어나는 항목을 찾지 못했다.

- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (신규) — `@ApiBody` 전용 DTO 신설. 목적에 정확히 부합.
- `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` (신규) — 계약 무변경을 지키는 캐너리 테스트. plan(`execute-body-openapi.md` "검증 기준")이 명시적으로 요구한 산출물이라 범위 내.
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — diff 는 `ApiBody`/`ExecuteWorkflowDto` import 2줄 + `@ApiBody({ type: ExecuteWorkflowDto, required: false })` 데코레이터 1줄 + 근거 주석 3줄뿐이다(`workflows.controller.ts` `execute()` 메서드 상단, 게이트 253~256). `@Body()` 파라미터의 인라인 타입(`body?: { input?: ...; parameterValues?: ... }`, 게이트 281~285)은 의도한 대로 그대로 유지돼 있고, 다른 메서드(`findAll`/`create`/`update`/`executeNode`/`saveCanvas`/`importWorkflow` 등)에는 손을 대지 않았다. drive-by 리팩토링·포맷팅·무관 임포트 정리 없음.
- `plan/in-progress/execute-body-openapi.md` (신규) — 이 작업 자신의 plan 문서. 프로젝트 컨벤션(`plan/in-progress/<name>.md`)대로.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 정본 트래커 갱신. (1) 이 작업이 닫는 항목의 체크박스를 `[ ]`→`[x]`로 flip 하며 결정 근거를 남김(게이트 946), (2) "여분 키 400 거부" 이연 결정 신규 등재(게이트 902~909, plan 이 "검증을 켜는 것은 별개 결정 — 트래커에 등재"로 명시적으로 요구한 항목), (3) `re-run.dto.ts` 의 `type: Object` 축약형 관련 consistency 부수 발견 신규 등재(게이트 910~915) — **코드는 건드리지 않고 트래커 등재만 함**. `re-run.dto.ts` 자체나 다른 미관련 항목은 수정하지 않았다.
- `review/consistency/2026/08/22/23_46_23/*` (7개 파일: `SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`) — plan 체크리스트의 `/consistency-check --impl-prep` 의무 단계 산출물이며 `review/consistency/**` 컨벤션 경로에 정확히 위치. 코드 변경이 아니라 workflow 산출물이라 스코프 이탈로 볼 수 없음.

기능 확장(over-engineering)·불필요한 리팩토링·무관 파일 수정·포맷팅 뒤섞임·불필요한 주석/임포트 변경·의도치 않은 설정 변경 — 8개 점검 관점 전부 위반 없음. `ExecuteWorkflowDto` 에 class-validator 데코레이터를 **의도적으로 달지 않은 것**(런타임 계약을 안 바꾸겠다는 명시적 결정)도 docstring·plan·트래커·테스트 4곳에 일관되게 근거가 남아 있어 "숨은 범위 확장"이 아니다.

## 요약

변경 범위가 매우 타이트하다. 신규 DTO+`@ApiBody` 데코레이터+캐너리 테스트+plan/tracker 문서화로 구성된 변경 전부가 "실행 계약은 바꾸지 않고 OpenAPI 문서만 채운다"는 단일 목적에 직결되며, 컨트롤러 diff 는 필요한 3줄(주석 포함)로 최소화돼 있고 `@Body()` 파라미터 타입은 의도적으로 미변경 상태를 유지했다. 트래커 파일의 부수 항목 등재(re-run.dto.ts 표기 통일)도 코드는 건드리지 않고 이연 기록만 남겨 스코프 밖 작업을 실제로 수행하지 않았다. review/consistency 산출물은 프로젝트가 의무화한 impl-prep 단계 결과물로 스코프 이탈이 아니다.

## 위험도
NONE
