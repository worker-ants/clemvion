# 신규 식별자 충돌 검토 — spec-draft-data-model-fk-actions

## 검토 개요

target draft 는 `spec/1-data-model.md` §2 FK 행 49개에 삭제 동작을 채우고, §2 에 빠진 컬럼 6개(`document_chunk.knowledge_base_id`
· `document_chunk.created_at` · `node_execution.parent_node_execution_id` · `assistant_message.auto_resumed` /
`auto_resume_reason` / `auto_resume_attempt`)를 추가하며, `execution.re_run_of` FK 표기 오류와 §2.22 `finish_reason` 값
목록, §3 인덱스 전략 표(Workspace 행), `spec/2-navigation/4-integration.md` §11.2 중복 방지 서술을 정정한다. 실제 DB(마이그레이션
V005·V009·V012·V020·V109)와 기존 코드(`workflow-assistant-message.entity.ts`, `workflow-assistant-stream.service.ts`,
`embedding.service.ts`)를 대조한 결과, **이 draft 가 새로 도입하는 모든 식별자·값은 이미 시스템(DB·코드·다른 spec 문서)에
존재하는 것을 `1-data-model.md`/`4-integration.md` 에 뒤늦게 반영하는 것**이며, 진짜 신규 명명은 없다. 이하 개별 확인 내역.

## 발견사항

### 1. 요구사항 ID 충돌 — 해당 없음

draft 는 새 요구사항 ID(`V-*`, `ND-*` 류)를 부여하지 않는다. 인용하는 마이그레이션 번호(V005, V009, V012, V020, V109)는 모두
`codebase/backend/migrations/` 에 실재하는 기존 ID 를 그대로 인용할 뿐 새로 채번하지 않는다.

### 2. 엔티티/타입명 충돌 — 해당 없음, 기존 사용과 일치 확인

- `document_chunk.knowledge_base_id` / `created_at`, `node_execution.parent_node_execution_id`,
  `workflow_assistant_message.auto_resumed` / `auto_resume_reason` / `auto_resume_attempt` 는 모두 마이그레이션(V005·V012·V020)에
  이미 존재하는 실제 DB 컬럼이며, `spec/1-data-model.md` §2 표에만 빠져 있던 것. §3 «인덱스 전략» 표는 이미 921~922행에서
  `parent_node_execution_id` 를 전제로 서술 중이라(§2.14 필드 표에는 없었음) draft 가 이 간극을 메운다 — 새 이름이 아니라 기존
  간극의 봉합.
- `auto_resumed`/`auto_resume_reason`/`auto_resume_attempt`(snake) ↔ `autoResumed`/`autoResumeReason`/`autoResumeAttempt`(camel)
  는 `spec/3-workflow-editor/4-ai-assistant.md`(§3.2·§6·§10, 600~605행)와 `spec/data-flow/11-workflow.md`(163·219행)에 이미
  동일 의미로 정의돼 있다. draft 의 §2.22 추가 행은 이 기존 정의와 완전히 일치 — 다른 의미로 쓰이는 곳 없음.
- `parent_node_execution_id` 는 `Execution.parent_execution_id`(§2.13, 486행 — 서브 워크플로우 **Execution** 부모)와 이름이
  유사하지만 테이블이 다르고 각각 독립적으로 이미 spec 전역(§2.14 §3 인덱스, `3-execution.md`, `4-ai-assistant.md`,
  `data-flow/3-execution.md`, `5-system/4-execution-engine.md`, `1-logic/12-background.md`)에서 구분되어 쓰이고 있다 — draft 는
  이 기존 구분을 재확인할 뿐 새로 만들지 않는다. 충돌 아님(참고용 기록).
- `execution.re_run_of` FK 대상 오탈자 정정(`executions`→`execution`)은 이름을 새로 짓는 것이 아니라 기존 테이블명 오기를
  고치는 것 — 신규 식별자 충돌 대상 아님.

### 3. API endpoint 충돌 — 해당 없음

draft 는 새 endpoint 를 정의하지 않는다.

### 4. 이벤트/메시지명 충돌 — 해당 없음, 기존 사용과 일치 확인

- §2.22 `finish_reason` 값 목록에 추가되는 `error` / `auto_resume_pending` 마커는 이미 다른 곳에 정의·사용 중이다:
  - `error`: `spec/3-workflow-editor/4-ai-assistant.md` 603행이 이미 `finishReason` 값 목록에 `'error'` 를 포함하고,
    `workflow-assistant-stream.service.ts` 737~743행이 `persistAssistantTurn(…, 'error', …)` 를 실제로 호출한다(draft 인용과
    일치).
  - `auto_resume_pending`: `FINISH_REASON_AUTO_RESUME_PENDING = 'auto_resume_pending'`
    (`workflow-assistant-message.entity.ts:65`)와 `spec/3-workflow-editor/4-ai-assistant.md`(603·1314·1353·1363행),
    `spec/data-flow/11-workflow.md:218` 이 이미 같은 문자열·같은 의미로 쓴다. §2.22 는 이 값이 빠져 있었을 뿐이다.
  - SSE 이벤트 이름 `auto_resume`(`4-ai-assistant.md:536`)는 draft 가 건드리지 않는다 — `auto_resume_pending`(DB 컬럼 값)과
    `auto_resume`(SSE 이벤트명)은 이미 spec 안에서 별개 식별자로 공존하며 draft 도 이 구분을 유지한다.
- §11.2 재작성이 쓰는 `integration_expiry_dispatch` / `threshold` / `token_expires_at` 은 `spec/data-flow/5-integration.md`
  (289·341·405행)·`spec/data-flow/8-notifications.md`(68·90행)에 이미 동일 스키마로 정의돼 있고, 실제 DB(V009)와도 일치한다
  (`grep -rn threshold_key spec/` 1건 — 삭제 대상인 draft 원문 그 자체뿐). 삭제되는 `threshold_key` 는 애초에 존재하지 않는
  컬럼명이었고, 이를 대체하는 세 식별자는 이미 다른 두 문서의 SoT 와 그대로 일치 — 충돌 없음.

### 5. 환경변수·설정키 충돌 — 해당 없음

draft 는 새 ENV var·config key 를 도입하지 않는다.

### 6. 파일 경로 충돌 — 해당 없음

- `plan/in-progress/spec-draft-data-model-fk-actions.md` 는 `ls plan/in-progress/` 기준 유일한 파일명이며, 같은 디렉터리의
  `spec-draft-eia-62-waiting-payload.md` / `spec-draft-eia-notification-payload-contract.md` /
  `spec-draft-nullable-notation-followups.md` 와 동일한 `spec-draft-*` 명명 관례를 따른다 — 겹치거나 관례를 깨지 않는다.
- `spec_impact` 의 두 경로(`spec/1-data-model.md`, `spec/2-navigation/4-integration.md`)는 기존 파일 편집이며 신규 경로가
  아니다.

### [INFO] §3 «인덱스 전략» 표에 추가되는 Workspace 행의 삽입 위치가 기존 배열 순서(§2 엔티티 선언 순)와 어긋난다

- target 신규 식별자: 없음(새 이름 충돌 아님) — 순서 관례 관측 사항
- 기존 사용처: `spec/1-data-model.md` 898~934행 §3 «인덱스 전략» 표. 현재 표는 `WorkspaceMember`(§2.3)로 시작해 이후 §2 엔티티
  선언 순서(Workflow §2.4 → Folder §2.5 → Node §2.6 → Edge §2.7 → …)를 그대로 따른다. `Workspace` 자체는 §2.2(WorkspaceMember
  보다 앞)이지만, V109 이전에는 Workspace 에 표에 실을 인덱스가 없어 표에 등장하지 않았다.
- 상세: draft §E 는 새 Workspace 행을 "WorkspaceMember 행 아래"에 넣으라고 지시한다. 그러나 §2 선언 순서 관례를 따르면
  Workspace(§2.2)가 WorkspaceMember(§2.3)보다 **위**에 와야 한다 — 지금 지시대로 넣으면 `WorkspaceMember, Workspace` 순이
  되어 유일하게 이 두 행만 §2 선언 순서를 거스른다. 식별자 자체의 충돌은 아니지만, 표의 암묵적 정렬 관례와 어긋나 다음 편집자가
  "왜 Workspace 가 WorkspaceMember 뒤에 있는가"를 오인할 수 있다.
- 제안: Workspace 행을 WorkspaceMember 행 **위**(표의 첫 행)로 옮기거나, 그럴 수 없다면 Rationale 에 "삽입 순서는 §2 선언
  순이 아니라 우연"이라는 한 줄을 남겨 다음 대조 작업이 반증하지 않도록 한다. Blocking 은 아니다.

## 요약

target draft 가 새로 표기하는 모든 컬럼명·값 마커·테이블/제약 이름(`knowledge_base_id`, `parent_node_execution_id`,
`auto_resumed`/`auto_resume_reason`/`auto_resume_attempt`, `error`/`auto_resume_pending`, `integration_expiry_dispatch`/
`threshold`/`token_expires_at`)은 실제 DB 마이그레이션과 이미 존재하는 다른 spec 문서(`4-ai-assistant.md`,
`data-flow/11-workflow.md`, `data-flow/5-integration.md`, `data-flow/8-notifications.md`) 서술과 전수 대조했을 때 전부 같은
의미로 이미 쓰이고 있었다 — 이 PR 은 새 이름을 짓는 것이 아니라 `1-data-model.md`/`4-integration.md` 가 그 기존 사실을 아직
반영하지 못한 간극을 메운다. `parent_node_execution_id` ↔ `parent_execution_id` 처럼 표면적으로 비슷한 이름 쌍도 이미 spec
전역에서 일관되게 구분되어 쓰이고 있어 혼동 사례가 아니다. 신규 파일 경로(`plan/in-progress/spec-draft-data-model-fk-actions.md`)
도 기존 명명 관례를 따르며 겹치는 파일이 없다. 유일한 지적은 §3 표에 신규 삽입되는 Workspace 행의 위치가 기존 §2 선언 순서
관례와 어긋난다는 순서상의 INFO 사항으로, 식별자 충돌이 아니라 가독성 문제다.

## 위험도

NONE
