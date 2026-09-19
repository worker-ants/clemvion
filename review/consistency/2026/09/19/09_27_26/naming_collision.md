# 신규 식별자 충돌 검토 — naming_collision

## 사전 메모 — bundle 된 target 과 실제 diff 의 불일치

프롬프트가 `## Target 문서`로 번들한 것은 `spec/2-navigation/*`(트리거 목록·스케줄 등)이지만,
실제 `git diff origin/main...HEAD --stat` 는 이 영역을 **전혀 건드리지 않는다**. 실제 변경은:

- 엔티티 데코레이터 6개 (`edge.entity.ts` · `integration-expiry-dispatch.entity.ts` ·
  `node.entity.ts` · `node-execution.entity.ts` · `workflow-assistant-session.entity.ts` ·
  `workspace.entity.ts`) — 선언된 인덱스/제약 이름·컬럼을 실제 DB(Flyway 마이그레이션)와
  맞추는 정정
- 신규 e2e 가드 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (441줄)
- `spec/3-workflow-editor/4-ai-assistant.md` 의 i18n 키 표 동기화 (신규 키
  `assistant.autoResumedHintShort` 포함, 이미 별도 커밋 `ff530fc8a`로 반영됨)
- `plan/in-progress/entity-schema-declaration-drift.md`(본 작업 추적, `spec_impact: none`)

`plan/in-progress/entity-schema-declaration-drift.md` 의 frontmatter 가 명시하듯
`spec_impact: none` — 이 작업은 spec 변경이 없는 순수 구현 정정이다. 따라서 프롬프트가 말하는
"scope(`spec/2-navigation`) 델타 0개" 자체는 (프롬프트 서술대로) 정상이지만, **그 스코프 선택
자체가 이번 diff 의 실제 영역과 무관**하다 — 신규 식별자 충돌을 점검해야 할 실제 표면은
`spec/2-navigation/*` 이 아니라 위 엔티티 파일들·e2e 가드·`spec/3-workflow-editor` 이다. 아래는
그 실제 표면을 대상으로 절대경로(`git -C <worktree>`)로 직접 확인한 결과다.

## 발견사항

### 엔티티 인덱스/제약 명 — 신규 도입 아님, 기존 DB 객체명과의 정합 확인

이번 diff 가 엔티티 데코레이터에 새로 채워 넣은 이름들은 모두 **이미 존재하는** Flyway 마이그레이션의
DB 객체명을 그대로 옮긴 것이다 (새 식별자를 만드는 것이 아니라 코드-DB 간 이름 불일치를 없애는 작업).
각각 grep 으로 유일성·의미 일치를 확인했다 — 모두 CRITICAL/WARNING 없음:

- **[INFO] `chk_no_self_loop`** (`codebase/backend/src/modules/edges/entities/edge.entity.ts:21`) —
  `codebase/backend/migrations/V001__initial_schema.sql:135` 의 동일 이름 CHECK 제약과 정확히 일치.
  다른 의미로 쓰인 곳 없음(grep 결과 2곳: 마이그레이션 원본 + 이번에 이름을 채운 엔티티 + 이를 검증하는
  신규 e2e).
- **[INFO] `chk_node_placement`** (`.../nodes/entities/node.entity.ts:25`) — `V001__initial_schema.sql:114`
  와 일치. 충돌 없음.
- **[INFO] `uq_workspace_personal_owner`** (`.../workspaces/entities/workspace.entity.ts:21`) —
  `V109__workspace_personal_owner_unique.sql:14`(`CREATE UNIQUE INDEX CONCURRENTLY ... uq_workspace_personal_owner`)
  및 `V108__workspace_personal_dedup_guard.sql`(선행 조건 주석)과 일치. 충돌 없음.
- **[INFO] `idx_node_execution_exec_status_active`** (`.../node-executions/entities/node-execution.entity.ts:38`) —
  `V095__node_execution_exec_status_active_index.sql:20` 과 일치(partial index 조건까지 동일). 충돌 없음.
- **[INFO] `idx_workflow_assistant_session_wf_user_active` / `idx_workflow_assistant_session_user_recent`**
  (`.../workflow-assistant/entities/workflow-assistant-session.entity.ts:23,29`) — 둘 다
  `V019__workflow_assistant.sql:32,35` 와 일치. 충돌 없음.
- **[INFO] `idx_node_workflow` 참조** (node.entity.ts:33 주석) — `V002__indexes.sql:8` 의 실제
  인덱스명과 일치. 삭제된 `IDX_node_workflow_label` / `UQ_node_workflow_label` (대응 마이그레이션이
  없어 DB 미적용이던 "유령" 선언)은 제거 후 코드 전체에서 주석 2곳 외 참조가 남지 않음
  (`git grep` 확인) — 다른 곳에서 그 이름을 기대하는 소비자 없음.
- **[INFO] `integration_expiry_dispatch` UNIQUE**(이름 제거) — 과거 데코레이터가 주장하던
  `integration_expiry_dispatch_key` 라는 이름은 `V009` 마이그레이션 어디에도 존재하지 않는
  (unnamed UNIQUE, Postgres 자동 명명) 허구의 이름이었고, 이번 diff 는 그 허구 이름을 제거했다 —
  이것도 새 식별자 충돌이 아니라 오기 삭제.

결론: 이번 diff 가 엔티티 레이어에 도입한 이름은 전부 **기존 DB 스키마와 1:1 로 일치**하며, 다른
의미로 이미 쓰이는 동명 식별자는 발견되지 않았다.

### 신규 파일 경로

- **[INFO] `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`** — `codebase/backend/test/`
  아래 기존 e2e 파일들과 이름 충돌 없음(`entity-schema-declarations` 접두는 새로 사용). `describe`
  타이틀("엔티티 스키마 선언 ↔ 실제 DB …")도 기존 describe 블록과 겹치지 않음.
- **[INFO] `plan/in-progress/entity-schema-declaration-drift.md`** — 기존 `plan/in-progress/` ·
  `plan/complete/` · `plan/research/` 어디에도 동명 파일 없음. `spec_impact: none` 이 frontmatter 에
  명시되어 있어 plan lifecycle 규약과 정합.
- **[INFO] `plan/complete/spec-draft-assistant-i18n-table-sync.md`** — 이미 `plan/complete/` 에
  직접 추가된 완료 문서(별도 커밋 `ff530fc8a`). 동명 in-progress 잔재 없음.

### i18n 키 — 신규 `assistant.autoResumedHintShort`

- **[INFO] `assistant.autoResumedHintShort`** (`spec/3-workflow-editor/4-ai-assistant.md:750` +
  `codebase/frontend/src/lib/i18n/dict/{ko,en}/assistant.ts`) — 기존 `assistant.*` 키 목록에 동명
  키 없음(grep 으로 전수 확인). 기존 `assistant.autoResumedHint` 와 접두를 공유하지만 의도된
  variant 관계(실시간 vs rehydrate 짧은 문구)이며 spec 본문이 그 구분을 명시적으로 서술 — 혼동
  가능성 낮음.

### API endpoint / 이벤트명 / ENV — 해당 diff 범위 내 신규 도입 없음

이번 diff 는 API endpoint·webhook/queue/SSE 이벤트명·ENV 변수를 신규로 추가하지 않는다
(`auto_resume` SSE 이벤트는 기존 이벤트의 페이로드 필드(`max`)만 추가, 이벤트명 자체는 기존).
따라서 이 세 관점에서는 검토 대상 신규 식별자가 없음.

## 요약

번들된 target(`spec/2-navigation/*`)은 이번 PR 의 실제 diff(엔티티 인덱스/제약 선언 정정 + 회귀
e2e + `spec/3-workflow-editor` i18n 표 동기화)와 무관하다 — scope 파라미터가 실제 변경 영역과
어긋난 것으로 보인다. 실제 diff 를 절대경로로 직접 대조한 결과, 이번에 코드에 채워진 인덱스/제약
이름(`chk_no_self_loop` · `chk_node_placement` · `uq_workspace_personal_owner` ·
`idx_node_execution_exec_status_active` · `idx_workflow_assistant_session_wf_user_active` ·
`idx_workflow_assistant_session_user_recent`)은 모두 신규 식별자가 아니라 **기존 Flyway
마이그레이션이 이미 DB 에 만들어 둔 이름을 그대로 옮긴 것**이며, 그 이름이 다른 의미로 이미
쓰이는 곳은 없다. 신규 e2e 파일 경로, 신규 plan 파일, 신규 i18n 키(`autoResumedHintShort`) 도
기존 명명 컨벤션·기존 항목과 충돌하지 않는다. CRITICAL/WARNING 없음.

## 위험도
NONE
