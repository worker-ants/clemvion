# 신규 식별자 충돌 검토 — spec/data-flow/ (--impl-prep)

## 검토 범위 확정

`git diff main...HEAD` 로 실제 target 변경분을 확인한 결과, 이번 라운드의 실질 target 은
`spec/data-flow/` 전체가 아니라 그 안의 **`spec/data-flow/11-workflow.md` 1개 파일의 국소 수정**과
연동 파일 `spec/2-navigation/1-workflow-list.md` 이다 (plan: `plan/in-progress/workflow-duplicate-nodes-edges.md`,
§1.1~§1.4 반영분). 내용은 `POST /api/workflows/:id/duplicate` 의 기존 계약 서술을 "메타 row 만 복제"에서
"nodes/edges 포함 캔버스 전체 복제"로 정정하는 **문서 정정 + Rationale 보강**이며, 구현(`workflows.service.ts`
`duplicate()`)은 아직 착수 전이다(§2 체크리스트 미체크 확인). 신규 식별자 도입 여부를 이 실제 diff 기준으로
점검했다.

## 발견사항

CRITICAL/WARNING/INFO 없음. target 은 신규 식별자를 도입하지 않는 **순수 계약 정정**이며, diff 에
등장하는 모든 명칭은 기존 spec·코드에서 이미 같은 의미로 정의돼 있음을 실측으로 확인했다. 직전
라운드(`review/consistency/2026/07/30/16_45_59/naming_collision.md`)가 지적한 유일한 INFO — `§2.1`
"복제" 흐름 행이 `node`/`edge` 에만 있고 `workflow` 자체엔 없어 비대칭이라는 지적 — 은 실제 반영된 diff 에서
`workflow` 행("복제 (§1.5)")이 추가되어 **해소됨**을 확인했다 (`spec/data-flow/11-workflow.md:150`).

## 점검 관점별 확인 내역

### 1. 요구사항 ID 충돌 — 없음
target diff 는 신규 요구사항 ID 를 부여하지 않는다. 새로 추가된 Rationale 절이 인용하는 `NAV-WF-04` 는
기존에 이미 정의된 ID (`spec/2-navigation/_product-overview.md:51` — "워크플로우 생성/복제/삭제 기능")
이고, target 은 그 정의를 재사용할 뿐 재정의하지 않는다 (grep 결과 `NAV-WF-04` 는 저장소 전체에서 이
두 위치에만 등장 — 정의 1곳 + 인용 1곳).

### 2. 엔티티/타입명 충돌 — 없음
diff 가 사용하는 모든 필드/테이블명은 기존 코드·spec 에서 동일 의미로 이미 존재함을 직접 확인:

| target 이 언급하는 이름 | 기존 정의 위치 (실측) | 의미 일치 |
| --- | --- | --- |
| `container_id` / `tool_owner_id` | `codebase/backend/src/modules/nodes/entities/node.entity.ts:66-77` (`@Column({ name: 'container_id' })` / `'tool_owner_id'`) | 일치 |
| `workflow_version` / `current_version` | `spec/data-flow/11-workflow.md` §2.1 기존 "버전 커밋" 행 (target 변경분 밖) | 일치 |
| `llmConfigId` | `workflows.service.ts` `importWorkflow()` 의 `AI_NODE_TYPES_WITH_LLM_CONFIG` 처리 로직 (target 변경분 밖, §1.5 import 행에서 이미 사용 중이던 이름) | 일치 |
| `workflow_test_dataset` | `codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts:32` `@Entity('workflow_test_dataset')` (엔티티 `WorkflowTestDataset` 은 `spec/1-data-model.md §2.13.3` 정의) | 일치 |
| `trigger` (webhook/schedule) | `spec/data-flow/10-triggers.md` 기존 정의 | 일치 |
| `DUPLICATE_NODE_LABEL` | `codebase/backend/src/modules/nodes/nodes.service.ts`, `workflows.service.ts:294,825` 기존 에러 코드 (target 은 §1.5 행 안에서 재인용만, 신규 도입 아님) | 일치 |

새 DTO·인터페이스·엔티티 이름은 도입되지 않는다. `POST /api/workflows/:id/duplicate` 의 응답 계약
서술만 바뀌었을 뿐, 관여하는 컬럼·테이블 집합은 "생성"/"추가" 행과 동일 컬럼 집합이라고 diff 스스로
명시한다.

### 3. API endpoint 충돌 — 없음
`POST /api/workflows/:id/duplicate` 는 신규 endpoint 가 아니다. 코드에 이미
`codebase/backend/src/modules/workflows/workflows.controller.ts:209` `@Post(':id/duplicate')` 로
존재하고, `spec/2-navigation/1-workflow-list.md:124`·`spec/data-flow/11-workflow.md:137` 에도 기존에
정의돼 있던 method+path 조합이다. target 은 그 문서화된 응답 부수효과(계약)를 실제 원하는 동작에
맞춰 정정할 뿐이며, 새 endpoint 를 추가하지 않는다.

### 4. 이벤트/메시지명 충돌 — 없음
webhook·queue·SSE 이벤트를 신규 도입하지 않는다. diff 범위 내 BullMQ 큐·WS/SSE 이벤트명 언급 없음.

### 5. 환경변수·설정키 충돌 — 없음
새 ENV var·config key 도입 없음.

### 6. 파일 경로 충돌 — 없음
- 수정 대상 두 파일(`spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md`)은 모두
  기존 파일이며 신규 spec 파일 생성은 없다.
- `plan/in-progress/workflow-duplicate-nodes-edges.md` 는 신규(untracked→커밋됨) 파일이나
  `plan/in-progress/` 기존 목록과 이름이 겹치지 않고 케밥 케이스 명명 컨벤션과 일치한다(직전 라운드에서
  이미 검증됨, 이번 라운드에서 재충돌 없음 재확인).

### 표 셀 값(흐름 레이블) "복제" 자체의 충돌 여부
`spec/data-flow/*.md` 전체에서 "복제" 문자열은 오직 `11-workflow.md` 안에서만 등장한다(다른 도메인
data-flow 문서에 동일 레이블 없음 — grep 확인). `11-workflow.md` §2.1 표 내부에서도 "생성/복제/활성
토글/버전 커밋/추가/이동·설정 변경/컨테이너·Tool Area 배치"로 각 행의 흐름 레이블이 서로 겹치지 않아
표 내부 충돌도 없다.

## 요약

target(`spec/data-flow/11-workflow.md` §1.5·§2.1·Rationale 및 `spec/2-navigation/1-workflow-list.md`
§2.6·API 표 정정분)은 `POST /api/workflows/:id/duplicate` 의 기존 계약 서술을 실제 의도된 동작(캔버스
전체 복제)에 맞게 고치는 **순수 문서 정정**이며, 신규 요구사항 ID·엔티티/타입·API endpoint·이벤트·환경변수·
spec 파일을 전혀 도입하지 않는다. 언급되는 모든 식별자(`container_id`/`tool_owner_id`/`workflow_version`/
`current_version`/`llmConfigId`/`workflow_test_dataset`/`trigger`/`DUPLICATE_NODE_LABEL`/
`POST /api/workflows/:id/duplicate`/`NAV-WF-04`)는 코드(`node.entity.ts`, `workflows.controller.ts`,
`workflows.service.ts`, `workflow-test-dataset.entity.ts`) 및 기존 spec 문서에서 이미 동일 의미로
쓰이던 것을 정확히 재사용했음을 직접 실측(파일 read·grep)으로 확인했다. 직전 라운드(16_45_59)가 남긴
유일한 INFO(§2.1 "복제" 행의 `workflow`/`node`/`edge` 비대칭)도 이번 반영분에서 해소됐다. 구현
(`workflows.service.ts` `duplicate()`)은 아직 spec 을 따라가지 못한 상태(코드는 여전히 메타 row 만
INSERT)이나, 이는 신규 식별자 충돌과 무관한 별도의 "spec-코드 drift" 사안으로 이후 개발 단계에서
해소될 예정이다.

## 위험도

NONE
