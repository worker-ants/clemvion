# 신규 식별자 충돌 검토 — workflow-duplicate-nodes-edges.md

## 발견사항

발견된 CRITICAL/WARNING 없음. target 문서는 신규 식별자를 실질적으로 도입하지 않는
**계약 정정 + 버그 수정** plan이며, 사용하는 모든 명칭은 기존 spec·코드에서 이미
같은 의미로 정의된 것을 그대로 재사용한다. 검증 근거는 아래 관점별 상세 참조.

- **[INFO]** §1.3 신규 표 행("복제" 흐름)의 스코프가 `node`/`edge`로만 명시되고 `workflow` 자체는 언급 없음
  - target 신규 식별자: `spec/data-flow/11-workflow.md` §2.1 Postgres 표에 추가될 "복제" 흐름 레이블 (target §1.3: "`node`/`edge` 의 '복제' 흐름을 표에 명시")
  - 기존 사용처: 없음 — `§2.1` 기존 행의 "흐름" 값은 생성/활성 토글/버전 커밋/추가/이동·설정 변경/컨테이너·Tool Area 배치 뿐이며 "복제" 레이블은 어느 테이블에도 없다
  - 상세: 신규 레이블 "복제"는 기존 레이블과 문자열이 겹치지 않아 **충돌은 없다**. 다만 target §1.3 이 `node`/`edge`만 명시하고 `workflow` 테이블 자체의 "복제" 흐름 행(현재 "생성" 행만 있고 "복제"로 새 INSERT 하는 것은 다른 흐름) 추가 여부를 언급하지 않아, 실제 spec 반영 시 `workflow` 테이블도 "복제" 행을 넣을지 "생성" 행에 각주로 흡수할지 결정이 필요하다. 식별자 충돌이 아니라 완결성(completeness) 메모이므로 별도 등급 상향 없음.
  - 제안: spec 반영 시(§1.3 체크리스트 수행 시) `workflow` 테이블에도 "복제" 행(또는 "생성" 행에 각주)을 추가해 `node`/`edge`와 표기 대칭을 맞출 것을 권장. 명칭 충돌 이슈는 아님.

## 점검 관점별 확인 내역

### 1. 요구사항 ID 충돌 — 없음
target 은 새 요구사항 ID 를 부여하지 않는다. Rationale 에서 인용하는 `NAV-WF-04`
(`spec/2-navigation/_product-overview.md:51` — "워크플로우 생성/복제/삭제 기능", 필수)는
기존에 이미 존재하는 ID 이고, target 은 그 의미를 그대로 인용할 뿐 재정의하지 않는다.

### 2. 엔티티/타입명 충돌 — 없음
target §1.1 TO-BE 가 사용하는 필드/테이블명 전부 기존 spec·코드에서 동일 의미로 이미 확인됨:

| target 이 언급하는 이름 | 기존 정의 위치 | 의미 일치 여부 |
| --- | --- | --- |
| `container_id` / `tool_owner_id` | `spec/data-flow/11-workflow.md` §1.2, §2.1 (`node` 테이블 컬럼) + `workflows.service.ts` `exportWorkflow()` (`containerIndex`/`toolOwnerIndex` remap 로직, camelCase 는 TS 관례) | 일치 |
| `workflow_version` / `current_version` | `spec/data-flow/11-workflow.md` §2.1 ("버전 커밋" 행), §1.1 시퀀스 다이어그램 | 일치 |
| `llmConfigId` | `spec/data-flow/11-workflow.md` §1.5 import 행 ("AI 노드의 `llmConfigId` 미지정 시 …") + `workflows.service.ts:279` `importWorkflow()` 의 `AI_NODE_TYPES_WITH_LLM_CONFIG`/`llmConfigId` 처리 | 일치 |
| "엣지 endpoint" (source/target 참조) | `spec/data-flow/11-workflow.md` §1.5 export 행에서 이미 동일 표현 사용 | 일치 |

새 DTO·인터페이스·엔티티 이름은 도입되지 않는다. 구현계획(§2)도 "새 UUID 재발급 → 참조
재매핑" 이라는 **패턴**만 `importWorkflow()`(`workflows.service.ts:279`, 실측: `nodeIdMap`
사전 생성 → 배치 insert)에서 재사용한다고 서술할 뿐 새 변수·타입명을 명명하지 않는다.

### 3. API endpoint 충돌 — 없음
`POST /api/workflows/:id/duplicate` 는 신규 endpoint 가 아니라 기존에 이미 정의된
endpoint (`spec/2-navigation/1-workflow-list.md:124`, `spec/data-flow/11-workflow.md:137`)의
**응답 부수효과(계약) 정정**이다. method+path 조합이 이미 있는 자기 자신의 스펙 문장을
고치는 것이므로 "새 endpoint 가 기존 spec 과 충돌"하는 시나리오에 해당하지 않는다.
target 이 새로 추가하는 endpoint 는 없다.

### 4. 이벤트/메시지명 충돌 — 없음
webhook·queue·SSE 이벤트를 새로 도입하지 않는다.

### 5. 환경변수·설정키 충돌 — 없음
새 ENV var·config key 도입 없음.

### 6. 파일 경로 충돌 — 없음
- `plan/in-progress/workflow-duplicate-nodes-edges.md` 는 신규(untracked) 파일이나, `plan/in-progress/` 기존 목록(`ai-agent-tool-connection-rewrite.md`, `cafe24-backlog-residual.md` 등)과 이름이 겹치지 않고 케밥 케이스 명명 컨벤션과 일치한다. `plan/complete/`·`plan/research/` 에도 동일 이름 없음(`fix-duplicate-user-bubble.md` 는 무관한 별개 버그).
- target 이 수정 대상으로 지목한 두 spec 파일(`spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md`)을 동시에 `spec_impact` 로 참조하는 다른 `plan/in-progress/*.md` 는 없음 — 병행 작업에 의한 편집 충돌 위험도 낮다.
- 신규 spec 파일 생성은 없음 (기존 파일 수정만).

### 부가 확인 — Rationale 인용의 정합성
target Rationale 이 인용하는 `spec/3-workflow-editor/3-execution.md:753` ("workflows 의
duplicate 선례와 동일한 복제 후 자기 소유 패턴")은 실제로 존재하는 문장이며, 현재는 그
문장이 참조하는 `workflows.duplicate` 가 결함 상태(메타만 복제)라 선례 인용 자체가
모순이었다. target 이 duplicate 를 정상화하면 이 기존 인용과의 정합성이 오히려
회복된다 — 신규 식별자 문제는 아니지만 정합성 방향은 target 에 유리하다.

## 요약

target 문서(`plan/in-progress/workflow-duplicate-nodes-edges.md`)는 새 엔티티·API
endpoint·이벤트·환경변수·요구사항 ID·spec 파일을 도입하지 않는다. 언급되는 모든
식별자(`container_id`/`tool_owner_id`/`workflow_version`/`current_version`/`llmConfigId`/
`POST /api/workflows/:id/duplicate`/`NAV-WF-04`)는 `spec/data-flow/11-workflow.md`,
`spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/_product-overview.md`, 그리고
실제 코드(`codebase/backend/src/modules/workflows/workflows.service.ts`)에서 이미 같은
의미로 쓰이는 기존 식별자를 정확하게 재사용한 것으로 실측 확인됐다. 유일한 관찰은 §1.3
신규 "복제" 흐름 표 행의 스코프가 `node`/`edge`로만 한정돼 `workflow` 테이블 표기와의
대칭을 spec 반영 시 별도로 챙겨야 한다는 완결성 메모(INFO)이며, 이는 식별자 충돌이 아니다.

## 위험도

NONE
