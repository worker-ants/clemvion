# 신규 식별자 충돌 검토 — spec/3-workflow-editor/ (impl-done)

## 조사 범위와 방법

- scope 델타: `spec/3-workflow-editor/4-ai-assistant.md` 1개 파일 (36줄, i18n 키 표 정정).
- 구현 diff 7개 파일: 엔티티 6개(`edge`·`integration-expiry-dispatch`·`node-execution`·`node`·`workflow-assistant-session`·`workspace`) + 신규 e2e `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`.
- 번들이 예산 초과로 diff 본문을 절단했으므로, 워킹트리 절대경로에서 `git diff origin/main...HEAD`(전체 및 scope-only)를 직접 재실행해 실제 변경분을 확인했다.
- 새로 등장하는 문자열 리터럴(인덱스명·제약명·i18n 키)마다 (a) 같은 코드베이스 내 다른 의미 사용처, (b) 대응 Flyway 마이그레이션, (c) `origin/main` 기준 선재 여부를 개별 grep 으로 대조했다.

## 발견사항

이 라운드는 CRITICAL/WARNING 급 신규 식별자 충돌을 찾지 못했다. 아래는 확인 과정과 그 근거(비-충돌 판정)를 남긴다.

- **[INFO] 엔티티 인덱스·제약 이름은 "신규 식별자"가 아니라 기존 DB 객체명의 재부여**
  - target 신규 식별자(표면상): `chk_no_self_loop`, `chk_node_placement`, `idx_node_execution_exec_status_active`, `idx_workflow_assistant_session_wf_user_active`, `idx_workflow_assistant_session_user_recent`, `uq_workspace_personal_owner`
  - 기존 사용처: `codebase/backend/migrations/V001__initial_schema.sql:135`(`chk_no_self_loop`), `:114`(`chk_node_placement`), `V095__node_execution_exec_status_active_index.sql:20`, `V019__workflow_assistant.sql:32,35`, `V109__workspace_personal_owner_unique.sql:14`(+`V108__workspace_personal_dedup_guard.sql:2,34` 가 같은 이름을 선행조건으로 참조)
  - 상세: 여섯 이름 모두 각각 정확히 1개의 기존 마이그레이션 객체와 1:1 대응하며, 코드베이스 어디에도 같은 이름이 다른 테이블·다른 의미로 쓰이는 곳이 없다(전수 grep, 매치 3건 이하로 전부 위 마이그레이션·엔티티·신규 e2e 자기 참조). 이번 커밋(`ffd58da4e`)의 목적 자체가 "엔티티 데코레이터 선언을 실제 DB 이름에 맞춘다"이므로 이 이름들은 신규 도입이 아니라 **이미 존재하는 DB 식별자를 코드가 뒤늦게 정확히 인용**한 것이다. 충돌 없음.
  - 제안: 없음 (정상).

- **[INFO] 신규 e2e 파일 경로·파일-로컬 헬퍼명 — 컨벤션 부합, 충돌 없음**
  - target 신규 식별자: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`, 그 안의 `reportMatch`/`realIndexes`/`probeTable`/`normalizedCheck`/`normalizedPredicate`/`sameColumns`/`inRolledBackTx`/`attempt`/`describeIndexDecl`/`describeForeignKeyDecl` 등
  - 기존 사용처: 없음 — `codebase/backend/test/*.e2e-spec.ts` 전수(`agent-memory-admin`…`external-interaction` 등)와 대조해 파일명 중복 없음, `<topic>.e2e-spec.ts` kebab-case 컨벤션 그대로 따름. 인접한 `deletion-cascade-indexes.e2e-spec.ts`(index 이름을 검증하는 유사 목적 파일)와 대상 인덱스명 집합도 겹치지 않음(전자는 FK 인덱스 30여 개, 후자는 이번 PR 이 정정한 6개로 서로 disjoint).
  - 상세: 헬퍼 함수들은 파일 스코프(비-export) 지역 함수라 다른 모듈과 이름 공간이 애초에 분리되어 있고, `grep -rn "function <name>"` 결과도 이 파일 하나뿐이었다.
  - 제안: 없음 (정상).

- **[INFO] i18n 키 `assistant.autoResumedHintShort` — spec 이 이미-구현된 코드를 뒤늦게 반영한 것, 신규 식별자 아님**
  - target 신규 식별자(표면상): `spec/3-workflow-editor/4-ai-assistant.md` §13 표에 추가된 `assistant.autoResumedHintShort` 행 + `autoResume` 메타의 `max` 필드 서술
  - 기존 사용처: `git grep autoResumedHintShort origin/main` 로 확인한 결과 **`origin/main` 시점에 이미** `codebase/frontend/src/lib/i18n/dict/ko/assistant.ts:20`, `dict/en/assistant.ts:22`, `assistant-message.tsx:144,151` 에 존재했다.
  - 상세: 이번 diff 는 spec 표를 실제 사전(ko/en dict)에 맞추는 정정(§13 정합 작업, 커밋 `ff530fc8a`)이지 새 키를 도입하는 것이 아니다. 따라서 "target 이 새로 부여하는 식별자"에 해당하지 않는다 — 충돌 판정 대상 자체가 아니다.
  - 제안: 없음 (정상). 참고로 같은 이유(코드가 이미 사전을 보유)로 `autoResume.max` 필드도 신규가 아니다.

- **[INFO] ENV var — 신규 없음**
  - target 신규 식별자: 신규 e2e 가 참조하는 `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE`
  - 기존 사용처: `codebase/backend/test/helpers/db.ts:10,14` 등 다른 e2e 전반이 쓰는 기존 키와 완전히 동일(같은 기본값 `'postgres'`/`'clemvion_e2e'`).
  - 상세: 새 ENV 키 도입 없음.
  - 제안: 없음.

## 요약

이번 스코프의 실제 diff(spec 표 정정 + 여섯 엔티티 데코레이터 정정 + 신규 e2e 가드 1개)는 대부분 "코드/spec 을 이미 존재하는 DB·사전 실체에 맞추는" 정정이라, 문자 그대로 새로 발명된 식별자가 거의 없다. 유일하게 표면상 새로 보였던 항목들(인덱스·제약 이름, i18n 키)을 전수 대조한 결과 전부 기존 마이그레이션·기존 사전 코드와 1:1 대응했고, 다른 의미로 재사용되는 곳도 없었다. 신규 e2e 파일명·헬퍼 함수명도 기존 명명 컨벤션(kebab-case `.e2e-spec.ts`, 파일-로컬 헬퍼)을 그대로 따르며 다른 파일과 겹치지 않는다. 신규 식별자 충돌 관점에서 이 변경은 안전하다.

## 위험도

NONE
