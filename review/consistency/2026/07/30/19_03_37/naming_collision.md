# 신규 식별자 충돌 검토 — spec/data-flow/ (--impl-done)

## 검토 범위 확정

`git log`/`git diff origin/main...HEAD --stat` 로 실제 target 변경분을 확인했다. 프롬프트의
`## Target 문서` 는 `spec/data-flow/` 폴더 전체(및 예산 초과로 생략된 8개 파일)를 나열하지만, 이번
라운드에서 실제로 수정된 파일은 다음으로 국한된다 (나머지 spec/data-flow/*.md 는 diff 밖 — 순수
컨텍스트):

- `spec/data-flow/11-workflow.md` — §1.5 표 행 정정, §2.1 Postgres 표에 `workflow`/`node`/`edge`
  "복제 (§1.5)" 행 3개 추가, `## Rationale` 에 3개 절 신설
- `spec/2-navigation/1-workflow-list.md` — §2.6 "복제" 행 서술 보강, API 표 `duplicate` 행 링크 추가,
  frontmatter `pending_plans` 에 신규 plan 등재
- `plan/in-progress/workflow-duplicate-nodes-edges.md` (신규 파일)
- `CHANGELOG.md` (신규 "Unreleased" 항목 1개 추가)
- 코드: `codebase/backend/src/modules/workflows/{workflows.service.ts,workflows.controller.ts}`,
  `codebase/backend/test/workflow-crud.e2e-spec.ts`, `workflows.service.spec.ts` — `duplicate()` 를
  트랜잭션 기반 캔버스 전체 복제로 재구현 (기존 "메타 row 만 복제" 버그 수정)

직전 두 라운드(`review/consistency/2026/07/30/16_45_59/naming_collision.md` --spec,
`review/consistency/2026/07/30/17_03_26/naming_collision.md` --impl-prep)가 이미 spec 정정분에 대해
동일 결론(NONE)을 냈다. 본 라운드(--impl-done)는 그 사이 **실제 구현이 완료**되었으므로, spec 서술뿐
아니라 완료된 코드 diff(`workflows.service.ts` `duplicate()` 재작성분) 가 신규 식별자를 도입했는지까지
추가로 실측했다.

## 점검 관점별 확인 내역

### 1. 요구사항 ID 충돌 — 없음
target 이 신규 요구사항 ID 를 부여하지 않는다. Rationale 이 인용하는 `NAV-WF-04` 는 기존
`spec/2-navigation/_product-overview.md:51`("워크플로우 생성/복제/삭제 기능") 정의를 재사용할 뿐이고
(저장소 전체에서 정의 1곳 + 인용 2곳뿐, 재정의 없음 — `git grep -n "NAV-WF-04"` 확인), 인용된
`R-2.2`(`spec/3-workflow-editor/3-execution.md:747`) 도 기존 앵커를 그대로 가리킨다.

### 2. 엔티티/타입명 충돌 — 없음
완료된 코드 diff 를 포함해 재확인한 결과, 신규 엔티티·DTO·인터페이스가 도입되지 않았다.

| 코드 diff 가 쓰는 이름 | 출처 | 신규 여부 |
| --- | --- | --- |
| `Workflow`/`Node`/`Edge` 엔티티 | `duplicate()` 재작성 전부터 파일 상단에 이미 import 되어 있던 엔티티(diff 에 신규 import 라인 없음 — `git diff` 로 import 구간 무변경 확인) | 기존 재사용 |
| `this.dataSource` | `duplicate()` 재작성 이전부터 이미 클래스 필드로 주입되어 `importWorkflow()` 등 다른 메서드가 쓰던 것(diff 에 constructor/DI 변경 없음) | 기존 재사용 |
| `QueryDeepPartialEntity<Node>[]` | TypeORM 기존 타입, `importWorkflow()` 의 배치 insert 패턴과 동일 방식 재사용 | 기존 재사용 |
| `idMap`/`remap`/`nodeRows`/`edgeRows`/`originalNodes`/`originalEdges`/`savedCopy` | `duplicate()` 함수 스코프 지역 변수 | 지역 변수 — 외부 노출 없음, 충돌 대상 아님 |
| `container_id`/`tool_owner_id`/`llmConfigId`/`workflow_test_dataset`/`current_version` | 기존 spec·엔티티 정의 재인용 (전 라운드에서 `node.entity.ts`/`workflow-test-dataset.entity.ts` 대조 완료) | 기존 재사용 |

§2.1 표에 새로 추가된 행 레이블 `복제 (§1.5)` 3개(`workflow`/`node`/`edge`)는 신규 "엔티티"가 아니라
기존 테이블에 대한 새 **흐름 레이블**이며, 서로 다른 세 테이블에 같은 레이블을 일관되게 붙인 것이라
표 내부 충돌이 없다(`spec/data-flow/*.md` 전체에서 "복제" 문자열은 `11-workflow.md` 안에만 등장 —
grep 재확인).

### 3. API endpoint 충돌 — 없음
`POST /api/workflows/:id/duplicate` 는 신규 endpoint 가 아니다. 코드에는
`workflows.controller.ts:213` `@Post(':id/duplicate')` 로 이미 존재했고, 이번 diff 는 `@ApiOperation
description` 문구와 `duplicate()` 의 **내부 구현**만 바꿨을 뿐 method+path+DTO 시그니처는 그대로다
(`WorkflowDto` 응답 타입 불변).

### 4. 이벤트/메시지명 충돌 — 없음
webhook·queue·SSE 이벤트를 신규 도입하지 않는다. `duplicate()` 는 BullMQ enqueue 도, WS/SSE emit 도
하지 않는 순수 DB 트랜잭션이다 (diff 범위 내 이벤트명 언급 없음).

### 5. 환경변수·설정키 충돌 — 없음
새 ENV var·config key 도입 없음. `REPEATABLE READ` 는 신규 식별자가 아니라 Postgres 표준 isolation
level 리터럴이며, `executions.service.ts` 의 기존 `findById` 선례와 동일 패턴으로 재사용된다(주석에
명시).

### 6. 파일 경로 충돌 — 없음
- 수정 대상 `spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md` 는 기존 파일.
- `plan/in-progress/workflow-duplicate-nodes-edges.md` 는 신규 파일이나 `plan/in-progress/` 기존
  목록·`plan/complete/`(`fix-duplicate-user-bubble.md` 등 유사 이름 포함) 어디와도 겹치지 않고
  케밥 케이스 컨벤션과 일치 (전전 라운드에서 이미 검증, 재확인 결과 동일).
- `CHANGELOG.md` 에 추가된 `## Unreleased — 워크플로우 복제가 nodes/edges 를 복사하지 않던 결함 수정`
  헤더는 파일 내 기존 관행(다수의 개별 `## Unreleased — <제목>` 헤더를 순차 추가)과 일치하며 제목
  텍스트도 기존 다른 20여 개 헤더와 중복되지 않는다.

### 참고 — "복제" 용어의 도메인 간 재사용 (신규 충돌 아님, 확인 완료)
`spec/3-workflow-editor/3-execution.md §R-2.2` 는 `WorkflowTestDataset` 의 "복제(clone)" — 워크스페이스
공유 데이터셋을 타 구성원이 자기 소유 사본으로 전환하는 access-control 동작 — 를 이미 정의하고 있다.
target 이 개정한 `11-workflow.md` Rationale 은 같은 한글 동사 "복제"를 워크플로우 캔버스 전체(nodes+
edges+meta) 복사라는 다른 의미로 쓰지만, 이는 이번에 새로 생긴 모호성이 아니다 — target 자신이 같은
diff 안에서 "[R-2.2 인용]은 '복제 후 자기 소유' **소유권 패턴**의 선례일 뿐 노드 내용 복사를 직접
진술하지는 않는다" 라고 명시적으로 선을 그어 두 용례가 혼동되지 않도록 이미 처리했다
(`spec/data-flow/11-workflow.md:252-255`). 조치 불요.

## 발견사항
CRITICAL/WARNING/INFO 없음. target(스펙 정정 3파일 + 완료된 코드 재구현)은 신규 요구사항 ID·엔티티/
타입·API endpoint·이벤트/메시지명·환경변수/설정키·spec 파일 경로를 전혀 도입하지 않았다. diff 에
등장하는 모든 명칭은 기존 코드·spec 에서 이미 같은 의미로 정의된 것의 재사용임을 실측(git diff·grep·
엔티티 파일 대조)으로 확인했다.

## 요약
이번 target 은 `POST /api/workflows/:id/duplicate` 가 "메타 row 만 복제"한다던 기존 spec 서술을 실제
의도(캔버스 전체 복제)에 맞게 정정하고, 그 사이 구현(`WorkflowsService.duplicate()`)도 트랜잭션 기반
nodes/edges 복제로 완료된 상태다. 신규 식별자 충돌 관점에서는 새 요구사항 ID·엔티티·endpoint·이벤트·
환경변수·파일 경로가 전혀 도입되지 않았고, 완료된 코드가 쓰는 모든 엔티티·타입·지역 변수 역시 기존
재사용이거나 함수 스코프에 갇힌 지역 식별자임을 확인했다. 유일하게 주목할 만한 지점은 "복제"라는
한글 동사가 workflow 캔버스 복제(본 target)와 `WorkflowTestDataset` 소유권 이전 clone(R-2.2, 별도
도메인)에 서로 다른 세분화 수준으로 쓰인다는 점인데, target 문서 스스로 그 차이를 명시적으로 선을 그어
이미 해소했으므로 추가 조치가 필요 없다. 직전 --spec/--impl-prep 라운드의 NONE 결론이 --impl-done
단계에서도 그대로 유지된다.

## 위험도
NONE
