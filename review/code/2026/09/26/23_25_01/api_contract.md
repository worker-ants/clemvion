# API 계약 리뷰 — export-workflow-typed

## 발견사항

- **[INFO]** `GET /workflows/:id/export` 응답의 `formatVersion` 이 여전히 `required` 로 선언되지만 프로듀서가 emit 하지 않는다 (기존 갭, 이번 PR 범위 밖)
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:226-227` (`ExportWorkflowDto.formatVersion`)
  - 상세: OpenAPI 스키마는 `formatVersion: number` 를 `required` 로 광고하지만 실제 서비스는 이 키를 응답에 싣지 않는다. 이번 PR 이 만든 갭이 아니고(`spec/2-navigation/1-workflow-list.md` 가 "미구현 (Planned)" 으로 이미 추적), e2e(F·C) 도 `allowMissing: ['formatVersion']` 으로 명시적으로 이 갭을 우회하고 있어 회귀는 아니다. 다만 이 PR 이 `nodes`/`edges` 원소의 스키마를 훨씬 엄격하게(모든 키 항상 present) 만든 것과 대비해, 같은 DTO 안에 "선언 ≠ 실제" 필드가 남아 있는 상태라 OpenAPI 스펙만 보고 클라이언트를 생성하는 소비자에게는 오도 소지가 계속된다.
  - 제안: 조치 불필요(이미 별도 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 로 추적 중). 후속 PR 이 이 갭을 닫을 때 이 DTO 도 함께 정리하면 된다.

- **[INFO]** `ExportedNodeDto`/`ExportedEdgeDto` 는 참조를 UUID 가 아니라 같은 응답 `nodes[]` 배열의 index 로 정규화한다 — `NodeDto`/`EdgeDto`(canvas 저장·복원 응답)와 참조 방식이 다르다
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:139-142` (설계 의도 주석), `:183-189`(`containerIndex`/`toolOwnerIndex`), `:196-206`(`sourceNodeIndex`/`targetNodeIndex`)
  - 상세: 같은 워크플로우 리소스의 서로 다른 두 응답 표면(`/save`, `/versions/:id/restore` vs `/export`)이 노드·엣지 참조를 각각 UUID / 배열-index 로 다르게 광고한다. 설계상 의도(§3.2, export JSON 은 재-import 를 위해 자기완결적이어야 하므로 UUID 를 안 싣는다)이고 코드에 그 근거 주석이 이미 붙어 있어 결함은 아니다. 다만 API 계약 관점에서는 "같은 리소스의 노드/엣지 참조 표기가 엔드포인트마다 다르다"는 사실 자체가 클라이언트 구현자에게 함정이 될 수 있다.
  - 제안: 현행 유지(이미 code comment + plan 실측으로 근거가 남아 있음). 추가 조치 불요.

- **[INFO]** 이번 변경은 **wire 포맷을 바꾸지 않는 순수 OpenAPI 스키마 강화**다 — 하위 호환성 리스크 없음
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:242-251` (`ExportWorkflowDto.nodes`/`.edges` 타입을 `Record<string, unknown>[]` → `ExportedNodeDto[]`/`ExportedEdgeDto[]` 로 교체)
  - 상세: `WorkflowsService.exportWorkflow` 자체는 수정되지 않았고(CHANGELOG.md:29 "서버는 원래 이 형태를 돌려주고 있었다 — 응답 자체는 그대로다"), `class-transformer`/`class-validator` 가 응답 직렬화 단계에서 필드를 걸러내는 방식이 아니라면 실제 HTTP 응답 바이트는 그대로다. e2e(`workflow-crud.e2e-spec.ts` C·F)의 `assertMatchesContract` 대조가 이를 실측으로 뒷받침한다. 새 스키마가 `nodes`/`edges` 원소를 엄격한 `$ref` 로 광고하므로, 이 OpenAPI 문서로 코드젠하는 클라이언트는 재생성이 필요하지만 이는 **더 정확해지는 방향**이라 breaking 이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `spec/2-navigation/4-integration.md` §9.4 실패 응답 포맷이 SoT(`spec/5-system/2-api-convention.md` §5.3)·실제 구현(`GlobalExceptionFilter`)과 다르다는 사실이 이번 diff 의 plan 파일(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 새로 등재됐다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (§9.4 관련 항목 보강, `review/consistency/2026/09/26/22_52_28` W1 인용)
  - 상세: 이 diff 자체가 이 불일치를 만들거나 고치는 코드 변경이 아니라, `--impl-prep` 단계에서 발견된 **무관한 기존 spec drift**를 developer 가 실측하고 기존 planner 항목에 갱신 형태로 얹은 것이다(원문 grep 결과 이미 `review/consistency/2026/09/26/22_52_28/SUMMARY.md` WARNING#1 로 문서화). API 계약 관점에서 실질적 위반이지만 **이번 PR 의 코드 변경 범위 밖**이고 planner 턴으로 정상 라우팅됐다.
  - 제안: 조치 불요(이미 planner 인계 완료). 이 diff 를 근거로 재차 Critical/Warning 을 매길 필요 없음.

## 요약

이번 변경은 `GET /workflows/:id/export` 응답의 `nodes`/`edges` 원소를 타입 없는 `Record<string, unknown>` 대신 응답 전용 DTO(`ExportedNodeDto` 10필드 · `ExportedEdgeDto` 6필드)로 광고하는 **순수 문서화/스키마 강화 변경**이며, 서비스 구현(`WorkflowsService.exportWorkflow`)은 건드리지 않아 실제 wire 포맷은 바뀌지 않는다(하위 호환성 문제 없음). 새 DTO 는 §5.4 규약(항상 존재하는 키는 required, 값만 없을 수 있는 필드는 `nullable: true`)을 정확히 따르며, `NodeDto`/`EdgeDto` 를 재사용하지 않고 index 기반 참조 전용 DTO 를 신설한 설계 근거가 코드 주석·plan 실측으로 명시돼 있다. e2e(`workflow-crud.e2e-spec.ts` C 케이스)가 `assertMatchesContract` 로 복제본 export 응답 전체를 새 DTO 계약과 대조하고, 단위 캐너리(`workflow-response.dto.spec.ts`)가 스키마 회귀(원소 타입 되돌림·`nullable` 누락)를 뮤테이션 테스트로 검증했다. 남은 이슈(`formatVersion` required-but-not-emitted 갭, 참조 표기 방식의 엔드포인트 간 비대칭, 무관한 §9.4 spec drift)는 모두 이번 PR 이전부터 있었거나 별도 트래커로 정상 라우팅된 기존 갭으로, 이 PR 의 코드 변경이 새로 만들거나 악화시킨 API 계약 위반은 없다. 요청 검증·URL 설계·페이지네이션·인증/인가 항목은 이번 diff 에 해당 코드 변경이 없어 해당 없음.

## 위험도

LOW
