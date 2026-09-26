# 신규 식별자 충돌 검토 — `canvas-save-typed` (--impl-prep, scope=`spec/2-navigation/`)

## 사전 확인 사항

- 이 브랜치(`claude/canvas-save-typed`)의 실제 diff 는 `origin/main` 대비 `plan/in-progress/canvas-save-typed.md` 62줄 추가뿐이다 (`git diff origin/main...HEAD --stat`). `spec/**`·`codebase/**` 는 아직 한 글자도 바뀌지 않았다 — 이번 호출은 **구현 착수 전** 단계이며, 계획(plan)의 `spec_impact: none` 그대로다.
- target 으로 번들된 `spec/2-navigation/*.md` (1-workflow-list · 2-trigger-list · 3-schedule 전문 + 나머지 15개는 예산 초과로 생략)는 **이번 작업이 새로 쓰는 문서가 아니라**, 계획이 건드릴 코드(`codebase/backend/src/modules/workflows/**`)가 `1-workflow-list.md` 의 `code:` frontmatter 범위에 걸려 orchestrator 가 impl-prep 컨텍스트로 첨부한 기존 spec 이다. 즉 이 채널에서 검토할 "target 이 새로 도입하는 식별자"는 **이 spec 번들 자체가 아니라, 계획서(`plan/in-progress/canvas-save-typed.md`)가 예고하는 구현**이다.

## 계획이 예고하는 변경과 식별자 교차 검증

계획의 실제 변경 범위: `CanvasSaveResultDto.nodes` / `.edges` 를 `Record<string, unknown>[]` → `NodeDto[]` / `EdgeDto[]` 로 **타입 선언만** 교체(`workflow-response.dto.ts:74-80`, 실측 확인). 새 엔티티·새 endpoint·새 이벤트·새 ENV·새 파일 경로는 예고되어 있지 않다. 항목별로 확인했다.

- **요구사항 ID** — 계획은 새 ID 를 발급하지 않는다. 번들된 spec 도 이번 변경으로 새 NAV-*/PRD ID 를 추가하지 않는다. 해당 없음.
- **엔티티/타입명** — `NodeDto`(`codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts:5`), `EdgeDto`(`codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts:5`) 모두 **단일 정의**로 존재함을 grep 으로 확인(`class NodeDto` / `class EdgeDto` 각 1건). `CanvasSaveResultDto` 도 `workflow-response.dto.ts:69` 단일 정의. 계획은 이 세 타입 중 무엇도 새로 만들지 않고 기존 필드에 기존 타입을 참조시킬 뿐이라 충돌 표면이 없다.
  - 참고 확인: 같은 파일의 `ExportWorkflowDto`(`workflow-response.dto.ts:135`)도 `nodes`/`edges` 필드를 갖지만, 계획서가 스스로 적었듯 export 포맷은 **index 참조 기반**(`sourceNodeIndex`/`containerIndex` 등)이라 `NodeDto`/`EdgeDto` 와 형태가 다르다. 계획은 이를 "같은 이름으로 재사용하면 안 되는 별개 타입"으로 이미 인지하고 새 트래커 항목(별도 DTO 필요)으로 분리해 두었다 — 이번 PR 범위에 끌어들이지 않으므로 충돌 없음.
- **API endpoint** — 소비 endpoint 둘 다 기존: `POST /workflows/:id/save`(`saveCanvas`, `workflows.controller.ts:471`) · `POST /workflows/:id/versions/:versionId/restore`(`restoreVersion`, `workflows.controller.ts:480`). 신규 method+path 없음.
- **이벤트/메시지명** — webhook·queue·SSE 이벤트 신설 없음.
- **환경변수·설정키** — 신규 ENV/config key 없음.
- **파일 경로** — 계획은 새 spec 파일을 만들지 않는다(`spec_impact: none`). 계획이 언급하는 신규 e2e 케이스("I": 5노드 그래프 저장→복원)는 기존 `workflow-crud.e2e-spec.ts` 안에 케이스를 추가하는 것으로 보이며 새 파일 경로가 아니다 — 단, 케이스 배치 파일이 확정되지 않았다면 구현 시점에 기존 명명 컨벤션(`*.e2e-spec.ts`)만 따르면 된다(INFO, 차단 아님).

## 번들된 기존 spec 자체의 내부 정합성 (참고 확인)

target 번들(1-workflow-list·2-trigger-list·3-schedule)은 이번 계획과 무관하게 이미 여러 PR 을 거쳐 정착된 문서다. 이번 계획의 변경 표면과 무관한 영역이라 전수 재검토는 범위 밖이지만, 스팟체크로 새 식별자성 충돌은 발견되지 않았다 — 예: 폴더 순환 에러 코드는 기존 `CONTAINER_CYCLE`/`CYCLE_DETECTED` 와 겹치지 않도록 신설을 스스로 회피했다고 문서 Rationale §3 가 명시(`spec/2-navigation/1-workflow-list.md` Rationale 3), `TRIGGER_ENDPOINT_PATH_CONFLICT`/`RESOURCE_CONFLICT` 계열도 트리거 전용으로 스코프됨. 이 계획의 diff 범위에 속하지 않으므로 새 발견 없음.

## 요약

이번 turn 은 병합(머지) 사실 확인 요청과 함께 실행된 impl-prep 신규 식별자 충돌 검토다. 실측 결과 이 브랜치는 아직 `spec/**`·`codebase/**` 를 전혀 수정하지 않았고(diff 는 plan 문서 추가뿐), 계획서(`canvas-save-typed.md`)가 예고하는 유일한 변경은 기존 `CanvasSaveResultDto.nodes`/`.edges` 필드의 타입 선언을 `Record<string, unknown>[]` 에서 이미 유일하게 정의돼 있는 기존 DTO 클래스 `NodeDto`/`EdgeDto` 참조로 좁히는 것뿐이다. 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 중 어느 것도 신설되지 않으며, 이름이 겹칠 후보였던 `ExportWorkflowDto.nodes`/`.edges`(다른 형태의 필드)도 계획이 스스로 분리해 별도 트래커 항목으로 미뤄 두었다. 신규 식별자 충돌 관점에서 차단 사유는 없다.

## 위험도

NONE
