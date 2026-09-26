---
title: "워크플로우 export 응답의 `nodes`/`edges` 를 응답 전용 DTO(`ExportedNodeDto` · `ExportedEdgeDto`)로 선언하고 와이어 계약을 건다"
status: in-progress
owner: developer
worktree: export-workflow-typed
spec_impact: none
started: 2026-09-26
---

# export 응답 `nodes`/`edges` 타입 선언

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «`ExportWorkflowDto.nodes`/`.edges` 도 타입 없는 객체
배열이다»(직전 PR `canvas-save-typed` 가 등재)를 닫는다. 그 항목이 선행으로 적은 결정 — import 요청 DTO 를 재사용할지, 응답 전용
DTO 를 둘지 — 을 아래 실측으로 정한다.

## 실측 (2026-09-26, origin/main `4691166fb`)

- 선언: `ExportWorkflowDto.nodes` · `.edges` 는 `items: { type: 'object' }` 다 → 응답 계약 검증자가 원소를 보지 않는다.
- 생산자 `WorkflowsService.exportWorkflow` 는 원소를 손으로 조립한다. **모든 키를 항상 싣는다**:
  - 노드 10키 — `type` · `category` · `label` · `positionX` · `positionY` · `config` · `isDisabled` · `description`(컬럼이
    nullable 이라 `null` 가능) · `containerIndex` · `toolOwnerIndex`(참조가 없으면 `null`).
  - 엣지 6키 — `sourceNodeIndex` · `sourcePort` · `targetNodeIndex` · `targetPort` · `type` · `condition`(컬럼이 nullable 이라
    `null` 가능).
- import 요청 DTO(`import-workflow.dto.ts` 의 파일 내부 클래스 `ImportNodeDto` · `ImportEdgeDto`)와 대조:
  - `ImportNodeDto.description` · `ImportEdgeDto.condition` 은 optional 이지만 **nullable 선언이 없다**. export 는 이 둘에
    `null` 을 싣는다 → 재사용하면 검증자가 «nullable 선언 없이 null» 로 잡는다.
  - 요청에서 optional 인 `config` · `isDisabled` · `sourcePort` · `targetPort` · `type` 등은 응답에서 **항상 실린다**. 재사용하면
    응답 문서가 «없을 수 있다» 고 거짓말한다(§5.4 — 상시 존재 키는 required).
  - 요청 쪽 `type` 은 허용 노드 타입 목록 enum 이다. export 는 저장된 값을 그대로 내보내므로 목록 밖 값(과거 타입)이 나갈 수
    있다 — 응답에 그 enum 을 약속할 수 없다.
  - **결정: 응답 전용 DTO.** 요청 DTO 는 «무엇을 받는가»(선택 필드 · 검증 데코레이터), 응답 DTO 는 «무엇이 항상 실리는가» 를
    적는다 — 두 계약이 같은 키 집합을 다른 지위로 다룬다.
- spec `spec/2-navigation/1-workflow-list.md` §3.2 는 export 의 키를 나열하고 SoT 를 `import-workflow.dto.ts` / `ExportWorkflowDto`
  로 적는다. 원소 DTO 는 `ExportWorkflowDto` 옆에 두므로 그 SoT 서술과 맞는다. 원소 타입은 적지 않으므로 충돌이 없다 →
  `spec_impact: none`.
- `formatVersion`(선언은 required, 생산자는 emit 안 함)은 spec 이 «미구현 (Planned)» 으로 적은 별개 갭이다. e2e F 가
  `allowMissing: ['formatVersion']` 로 다룬다 — 이 PR 은 건드리지 않는다.
- e2e: F(생성 → export → import)는 export 를 `ExportWorkflowDto` 와 대조하지만 노드 1개 · 엣지 0개라 원소 대조가 약하다.
  C(5노드 · 엣지 2 저장 → 복제 → **복제본 export**)는 export 를 대조하지 않는다.

## 방향

1. **DTO**(`workflow-response.dto.ts`) — `ExportedNodeDto`(10키) · `ExportedEdgeDto`(6키), 전부 required.
   - `null` 가능 필드는 `@ApiProperty({ nullable: true })`(§5.4 기본형 — 키 상시 존재, 값만 없을 수 있음):
     `description` · `containerIndex` · `toolOwnerIndex` · `condition`.
   - 공유 필드의 타입 표기는 `NodeDto` · `EdgeDto` 를 따른다: `type` 은 문자열(enum 을 약속하지 않는다) · `category` 는
     `NodeCategory` · 엣지 `type` 은 `EdgeType`(둘 다 DB enum 이라 보장된다) · `config` · `condition` 은 열린 맵.
   - 인덱스 필드는 `type: 'integer'`.
   - `ExportWorkflowDto.nodes` → `type: () => [ExportedNodeDto]` · `.edges` → `type: () => [ExportedEdgeDto]`.
2. **e2e**(`workflow-crud.e2e-spec.ts`) — C 의 복제본 export 를 `ExportWorkflowDto` 와 대조한다(`formatVersion` 은 F 와 같이
   `allowMissing`). 5노드 · 엣지 2 에 `containerIndex` · `toolOwnerIndex` 가 채워진 노드와 `null` 인 노드, `description` ·
   `condition` 이 `null` 인 원소가 모두 있다. F 는 그대로 둔다.
3. **캐너리**(`workflow-response.dto.spec.ts` — 직전 PR 이 만든 파일) — `ExportWorkflowDto.nodes.items` · `.edges.items` 가
   두 DTO 참조인지.
4. **CHANGELOG** — 항목 1(OpenAPI).

## 관찰 (이 PR 밖)

- 프런트엔드 `ExportedNode.description?: string`(`codebase/frontend/src/lib/api/workflows.ts`)은 실제로 오는 `null` 을 적지 않는다.
  ~~소비처가 falsy 로만 다뤄 동작 결함은 아니다.~~ → **정정**: 소비처 두 곳은 응답 전체를 `JSON.stringify` 해 파일로 내려받을
  뿐 필드를 읽지 않는다(grep). 그래서 동작 결함이 아니다. 트래커에 낮음으로 등재(`--impl-prep` INFO 1).

## `--impl-prep` 처분 (`review/consistency/2026/09/26/22_52_28` BLOCK: NO)

- **WARNING 1** — `4-integration.md` §9.4 의 실패 응답 형식(`{ code, message, details? }`)이 SoT §5.3 · 구현
  (`{ error: { code, message, requestId, details? } }`)과 다르다. 실측으로 확인했다. 이 plan 과 무관하고 spec 쓰기라 planner 몫이다.
  같은 §9.4 블록을 겨냥한 기존 planner 항목(«`INTEGRATION_TEST_FAILED` 의 상태 코드와 발생 경로…»)이 있어 **새로 만들지 않고 그
  항목을 갱신**했다.
- **INFO 1** — 프런트엔드 export 타입의 `null` 미반영 → 트래커 등재(위 관찰).
- **INFO 3** — 두 DTO 가 `NodeDto` · `EdgeDto` 를 재사용하지 않는 이유(UUID 미포함 · index 참조)를 코드에 적으라 → 선언 위 `//`
  주석으로 반영(import 요청 DTO 를 쓰지 않는 이유도 함께).
- INFO 2(기존 `NodeDto` · `EdgeDto` 의 §5.4 혼합형) · 4(`formatVersion` 갭) · 5 · 6(무관 문서) — 조치 불요.

## 구현 중 발견 — `string | null` 은 `type: object` 가 된다

생성 스키마를 probe 로 찍어 보니 `ExportedNodeDto.description` 이 `{"type":"object","nullable":true}` 였다. `string | null` 의
설계 타입이 `Object` 로 emit 되기 때문이다(swagger CLI 플러그인 없이 만든 스키마 — 테스트의 계약 검증자가 쓰는 것). `type: String`
을 명시하고, 캐너리에 `description` 스키마가 `{ type: 'string', nullable: true }` 인지 단언을 더했다.

- **범위 실측**: 기존 `NodeDto.description` · `.containerId` 도 같은 생성에서 `type: object` 다(probe). 다만 `@nestjs/swagger` 의
  데코레이터는 플러그인 메타데이터(`_OPENAPI_METADATA_FACTORY`)의 타입을 먼저 보고 없을 때만 설계 타입으로 떨어진다
  (`dist/decorators/helpers.js`). 배포 빌드(`nest build`)에는 플러그인이 있으므로 이 현상은 **테스트 쪽 생성에만** 있다.
  검증자는 타입을 대조하지 않으므로 지금 테스트 결과도 바꾸지 않는다 → 기존 DTO 는 건드리지 않는다.

## 뮤턴트 (예측 — 실측은 구현 뒤 채운다)

| # | 뮤턴트 | 예측 | 실측 · 죽인 케이스 |
|---|---|---|---|
| M1 | `ExportWorkflowDto.nodes` 를 타입 없는 배열로 되돌림 | 캐너리 RED | |
| M2 | `ExportWorkflowDto.edges` 를 타입 없는 배열로 되돌림 | 캐너리 RED | |
| M3 | `ExportedNodeDto.description` 의 `nullable` 제거 | e2e C RED(`null` 인데 nullable 아님) — e2e 1회 | |
| M4 | `ExportedNodeDto.description` 의 `type: String` 제거 | 캐너리 `description` 단언 RED · 나머지 GREEN | |

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/26/22_52_28` BLOCK: NO(W1 은 무관 · 기존 planner 항목 갱신)
- [x] DTO · e2e · 캐너리 · CHANGELOG · 트래커(§9.4 항목 갱신 · 프런트엔드 타입 항목 등재)
- [ ] 뮤턴트 표 실측
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기
