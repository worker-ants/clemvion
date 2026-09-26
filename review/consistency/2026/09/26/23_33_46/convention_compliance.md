# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-done, diff-base=origin/main)

## 검토 범위 확인

- `spec/2-navigation/` 자체의 스펙 델타는 0 (이번 브랜치는 spec 을 바꾸지 않음).
- 구현 diff 는 `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`(+ 대응 spec.ts, e2e-spec.ts) 3개 파일 — `GET /api/workflows/:id/export` 응답의 `nodes`/`edges` 를 타입 없는 `Record<string, unknown>[]` 에서 신설 `ExportedNodeDto`/`ExportedEdgeDto` 로 광고하도록 변경.
- 이 변경은 `spec/2-navigation/1-workflow-list.md` §3.2 "Export/Import JSON 포맷" 이 이미 서술 중인 계약(index 기반 참조, `containerIndex`/`toolOwnerIndex`, edge 의 `sourceNodeIndex`/`targetNodeIndex`/`sourcePort`/`targetPort`/`type`/`condition`)의 **타입 광고를 코드에 반영**한 것으로, 실제 워킹트리(`codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` 절대경로로 확인)와 spec §3.2 서술이 필드 단위로 정확히 일치한다.

## 발견사항

### 신규 구현 (`ExportedNodeDto`/`ExportedEdgeDto`) 자체에 대한 규약 대조 — 위반 없음

- **명명**: `ExportedNodeDto`/`ExportedEdgeDto` 는 저장소 전체에서 클래스명이 유일하다 (`grep -rn "class ExportedNodeDto\|class ExportedEdgeDto"` 결과 선언 1건씩만 존재) — `swagger.md` §5-1 "응답 DTO 클래스명은 저장소 전체에서 유일해야 합니다" 준수. 같은 개념(`nodes`/`edges`)을 층(캔버스 저장·복원 `NodeDto`/`EdgeDto`, export 응답 `ExportedNodeDto`/`ExportedEdgeDto`, import 요청 `ImportNodeDto`/`ImportEdgeDto`)별로 다른 이름으로 분리한 것도 §5-1 의 "같은 개념을 층별로 나눠 선언해야 할 때는 이름을 다르게 둔다" 사례(`ChatChannelBotIdentityDto` vs `ChatChannelRotateBotIdentityDto` 선례)와 동형.
- **enum 데코레이터**: `@ApiProperty({ enum: NodeCategory, enumName: 'NodeCategory' })` / `@ApiProperty({ enum: EdgeType, enumName: 'EdgeType' })` 는 `swagger.md` §1-4 enum 패턴을 그대로 따름. 두 enum 을 엔티티(`node.entity.ts`/`edge.entity.ts`)에서 직접 import 하는 것은 §5-1 "엔티티 enum 에서 파생하지 않는다"(형제 DTO 가 **각자** 값을 재선언할 때의 드리프트 방지 규칙) 위반처럼 보일 수 있으나, 기존 `NodeDto.category`/`EdgeDto.type` 이 이미 동일 엔티티 enum 을 직접 import 해 쓰는 저장소 전역 기존 패턴이다(`node-response.dto.ts:2,19` / `edge-response.dto.ts:2,31`). `ExportedNodeDto`/`ExportedEdgeDto` 는 그 값을 **재선언**하지 않고 **같은 import 심볼을 공유**하므로 §5-1 이 막는 "각자 선언 → 드리프트" 문제가 원천적으로 없다. 위반 아님.
- **nullable 표현**: `description: string | null` → `@ApiProperty({ type: String, nullable: true })`, `containerIndex`/`toolOwnerIndex: number | null` → `@ApiProperty({ type: 'integer', nullable: true, ... })`, `condition: Record<string, unknown> | null` → `@ApiProperty({ ..., nullable: true })` — 전부 "상시 존재 + 값만 null" 패턴이라 `@ApiPropertyOptional` 이 아닌 `@ApiProperty({ nullable: true })` 를 쓴 것은 §1-4 Rationale("이 필드는 상시 존재하고 값만 없을 수 있다")과 정확히 부합. `description` 에 `type: String` 을 명시적으로 적어 CLI 플러그인 미개입 시 `type: object` 로 새는 실측을 코드 주석(`//`)으로 남긴 것도 §3 "내부 서사는 JSDoc 이 아니라 `//` 주석" 규약을 정확히 지킨 사례.
- **열린 map**: `config`/`condition` 은 `additionalProperties: true` 유지 — 두 필드 모두 노드/엣지 타입별로 실제 키 집합이 열려 있는 값이라 §1-4 "열린/동적 map" 조건에 해당, "타입 특정이 번거롭다"는 사유의 오남용이 아님.
- **금지 항목(§6 "빈 껍데기 스키마")**: 이번 diff 는 오히려 기존의 `@ApiProperty({ type: 'array', items: { type: 'object' } })`(타입 없는 배열 — §1-4 가 지목하는 문제 패턴)를 구조화된 DTO 참조로 교체한 것이라, 규약을 어기는 방향이 아니라 규약에 맞추는 방향의 변경이다.

### [INFO] `Export`(부모 DTO) vs `Exported`(자식 DTO) 접두 형태 불일치

- target 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` — `ExportWorkflowDto`(동사형 `Export`) 의 자식 원소가 `ExportedNodeDto`/`ExportedEdgeDto`(과거분사형 `Exported`)로 명명됨.
- 위반 규약: 명시적으로 강제하는 조항은 없음(`swagger.md` §1-7 은 `Update` 접두의 top-level/nested 구분만 규정하고, export 계열 접두 형태는 다루지 않음).
- 상세: 계층 명명 자체는 §5-1 취지(층별로 다른 이름)에 부합해 문제는 아니지만, 부모-자식 접두 형태가 `Export*`/`Exported*` 로 갈라져 있어 향후 신규 기여자가 "부모와 같은 `Export` 접두를 쓸지 `Exported` 를 쓸지" 판단 기준이 없다.
- 제안: 지금 당장 수정할 사안은 아님(swagger 가드·계약 테스트는 이름 형태가 아니라 참조 무결성만 본다). 굳이 정리한다면 `swagger.md` §1-7 과 같은 형태로 "export 응답 원소는 `Exported<Entity>Dto`" 규칙을 짧게 규약화하는 편이 재발 방지에 낫다.

### [정보/추적 확인] §9.4 실패 응답 포맷 서술 — 이번 diff 무관, 이미 backlog 로 트래킹됨

- target 위치: `spec/2-navigation/4-integration.md` §9.4 "공통 응답 포맷" (`- 실패: `{ code, message, details? }``) — 현재도 동일 문구로 남아 있음을 워킹트리에서 재확인.
- 위반 규약: `spec/5-system/2-api-convention.md` §5.3 (`{ error: { code, message, requestId, details? } }`).
- 상세: 이 항목은 이전 라운드(`review/consistency/2026/09/26/22_52_28/convention_compliance.md` W1, `--impl-prep`)에서 이미 WARNING 으로 보고됐고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "같은 §9.4 의 실패 응답 형식도 틀렸다 (2026-09-26 보강)" 로 등재되어 planner 턴에서 같은 블록과 함께 고치기로 트래킹 중이다. `export-workflow-typed` 이번 구현 diff 와는 무관하다.
- 제안: 신규 조치 불필요 — 이미 등재된 followup 을 planner 가 처리하면 됨. 이번 라운드에서 중복 WARNING 으로 재상신하지 않음(추적 상태 확인용으로만 기록).

### [정보/추적 확인] 프런트엔드 export 타입의 optional vs null 표기 — 이미 backlog 로 트래킹됨

- target 위치: `codebase/frontend/src/lib/api/workflows.ts` 의 `ExportedNode.description?: string` 등이 optional 로 선언되어 있으나, 백엔드 `ExportedNodeDto`/`ExportWorkflowDto` 는 항상 키를 싣고 값만 `null` 일 수 있음 — API 규약 §5.4 "부재 표현" 관점에서 프런트 타입이 서버 계약과 어긋난다.
- 상세: 이 역시 22:52:28 라운드 INFO 로 이미 보고됐고 `spec-draft-nullable-notation-followups.md` 에 "낮음" 우선순위로 등재됨(현재 소비처가 필드를 읽지 않아 동작 결함은 아님, 2026-09-26 grep 실측 포함). 신규 위반 아님.

## 요약

이번 `export-workflow-typed` 구현 diff(`ExportedNodeDto`/`ExportedEdgeDto` 신설)는 `spec/conventions/swagger.md` 의 DTO 클래스명 유일성(§5-1), enum 데코레이터 패턴(§1-4), nullable 표현 규칙(§1-4 Rationale), JSDoc/내부 서사 분리(§3), 그리고 §6 "빈 껍데기 스키마 금지" 취지를 모두 충족하며, `spec/2-navigation/1-workflow-list.md` §3.2 가 이미 서술해 둔 export JSON 계약과 필드 단위로 정확히 일치한다 — CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다. 부모(`ExportWorkflowDto`)와 자식(`Exported*Dto`) 간 접두 형태 불일치는 강제 규약이 없는 사소한 스타일 이슈로 INFO 수준이다. `spec/2-navigation/4-integration.md` §9.4 의 에러 포맷 서술 및 프런트 `Exported*` 타입의 optional/null 불일치는 이번 diff 와 무관한 기존 이슈로, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정상적으로 등재·추적 중이라 이번 라운드에서 재상신하지 않는다.

## 위험도

LOW
