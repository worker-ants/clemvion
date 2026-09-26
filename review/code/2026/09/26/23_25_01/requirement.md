# 요구사항(Requirement) 충족 리뷰 — export-workflow-typed

## 발견사항

- **[INFO]** `GET /workflows/:id/export` 의 생산자(`WorkflowsService.exportWorkflow`)는 이번 diff 대상이 아니지만, 신설된 `ExportedNodeDto`/`ExportedEdgeDto` 선언과 line-level 로 실측 대조한 결과 완전히 일치한다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`exportWorkflow`, 대략 456-498줄, 이번 diff 에 없어 게이트 번호 없음 — 함수명으로 기재)
  - 상세: 노드 10필드(`type`·`category`·`label`·`positionX`·`positionY`·`config`·`isDisabled`·`description`·`containerIndex`·`toolOwnerIndex`) · 엣지 6필드(`sourceNodeIndex`·`sourcePort`·`targetNodeIndex`·`targetPort`·`type`·`condition`) 모두 서비스가 항상 싣고, `containerIndex`/`toolOwnerIndex`/`condition`/`description` 만 `null` 이 될 수 있는 실제 동작이 DTO 의 `nullable: true` 필드 선택과 정확히 일치한다. 엔티티 컬럼 정의(`Node.type: string(50)`, `Node.category: NodeCategory` enum, `Edge.type: EdgeType` enum, `Edge.condition: jsonb nullable`)도 DTO 타입 표기와 어긋나지 않는다.
  - 제안: 조치 불요 — spec fidelity 확인용 기록.

- **[INFO]** 관련 spec `spec/2-navigation/1-workflow-list.md` §3.2 와 대조했을 때 불일치 없음.
  - 위치: `spec/2-navigation/1-workflow-list.md:144-153`
  - 상세: §3.2 는 top-level 키(`name`/`description`/`tags`/`settings`/`nodes[]`/`edges[]`), index 기반 참조(`containerIndex`/`toolOwnerIndex`/`sourceNodeIndex`/`targetNodeIndex`, "없으면 `null`"), `formatVersion` 미구현(Planned) 경고를 명시한다. 이번 DTO 신설은 이 서술 중 어느 것도 어기지 않으며, `formatVersion` required 선언과 구현 미emit 갭도 손대지 않고 e2e 의 `allowMissing: ['formatVersion']` 로 기존 방식 그대로 유지한다(F 케이스 원래 존재, C 케이스에 신규 추가).
  - 제안: 조치 불요.

- **[INFO]** 뮤테이션·테스트 실측 재현: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.spec.ts` 를 `npm test`(프로젝트 스크립트, `npx jest` 아님 — `npx` 는 워크스페이스 루트 node_modules 를 잡아 ESM 로딩 오류를 낸다)로 직접 실행해 5개 테스트 전부 통과함을 확인했다. `npx tsc --noEmit`도 이번 diff 대상 파일(`workflow-response.dto.ts`/`.spec.ts`/`workflow-crud.e2e-spec.ts`)에서는 에러가 없다(다른 무관 파일의 pre-existing 타입 에러만 존재, 이 PR 이 만든 것 아님).
  - 위치: 해당 없음(검증 기록)
  - 제안: 조치 불요.

- **[INFO]** `--impl-prep` consistency-check(`review/consistency/2026/09/26/22_52_28`, BLOCK: NO)가 권고한 두 항목 — (1) `ExportedNodeDto`/`ExportedEdgeDto` 가 `NodeDto`/`EdgeDto` 를 재사용하지 않는 설계 의도를 코드 주석으로 남길 것, (2) 프런트엔드 `ExportedNode.description` nullable 미반영을 트래커에 등재할 것 — 둘 다 실제로 반영됐음을 확인했다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:139-142` (설계 의도 주석), `plan/in-progress/spec-draft-nullable-notation-followups.md:1324-1329`(신규 항목)
  - 제안: 조치 불요.

- **[INFO]** e2e C 케이스(`workflow-crud.e2e-spec.ts`)가 새로 추가한 `assertMatchesContract(dupExport.body.data, await contractForDto(ExportWorkflowDto), { allowMissing: ['formatVersion'] })` 는 `containerIndex`/`toolOwnerIndex` 가 채워진 노드·`null` 인 노드, `description`/`condition` 이 `null` 인 원소를 모두 포함하는 5노드·2엣지 그래프로 실행되어 F 케이스(1노드·0엣지)보다 실질적으로 강한 원소 대조를 제공한다. 뮤턴트 표(M1~M4, plan 문서)도 각 방향(선언 되돌림·nullable 제거·type 제거)이 실제로 캐너리/e2e 를 KILL 시킴을 기록하고 있어 vacuous 테스트가 아님을 뒷받침한다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:315-321`
  - 제안: 조치 불요.

## 요약

`GET /workflows/:id/export` 응답의 `nodes`/`edges` 를 타입 없는 객체 배열에서 응답 전용 DTO(`ExportedNodeDto` 10필드·`ExportedEdgeDto` 6필드)로 광고하는 변경이다. 서비스 생산자 코드(`exportWorkflow`)는 건드리지 않고 순수 OpenAPI 문서화 계층만 추가했으며, 실측(entity 컬럼 정의·서비스 로직) 대조 결과 DTO 필드명·타입·nullable 여부가 실제 동작과 정확히 일치한다. 관련 spec(`spec/2-navigation/1-workflow-list.md` §3.2)의 index 기반 참조 서술·`formatVersion` Planned 갭과도 충돌이 없다. 회귀 가드용 단위 캐너리(`workflow-response.dto.spec.ts`, 5건 직접 실행 확인 통과)와 e2e 원소 대조(C 케이스, 5노드/2엣지로 null/non-null 양쪽 커버)가 추가됐고, 4개 뮤턴트가 전부 KILLED 로 기록돼 테스트가 실효성 있음을 뒷받침한다. `--impl-prep` consistency-check 의 두 권고(설계 의도 주석, FE 타입 갭 트래커 등재)도 실제로 반영됨을 확인했다. TODO/FIXME/HACK 성 미완성 표시는 없고, CRITICAL/WARNING 급 기능 결함이나 spec 불일치는 발견되지 않았다.

## 위험도
NONE
