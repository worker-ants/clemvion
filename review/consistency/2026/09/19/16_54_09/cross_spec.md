# Cross-Spec 일관성 검토 — entity-column-declaration-drift (재실행)

## 스코프 정정

프롬프트의 `target` 은 `spec/2-navigation/` 이지만, 이 작업이 실제로 닿는 spec 은 루트 파일 `spec/1-data-model.md` 다(디렉터리 scope 제약으로 정확히 지정할 수 없었을 뿐). 실제 코드 diff(`origin/main...HEAD`, `0a040b96c..73bc0f1c3`)는 아래 8개 엔티티 파일만 바꾼다 — spec 문서 자체는 이번 커밋에서 변경되지 않았다(`spec/1-data-model.md`의 컬럼 표·Rationale·frontmatter `code:` 가드 목록은 선행 커밋 `cef3687f2`·`53335867a`에서 이미 `origin/main`에 반영·병합됨).

- `alerts/entities/alert-rule.entity.ts` — `workspace_id` `type: 'uuid'` 추가
- `workspaces/entities/workspace-invitation.entity.ts` — `workspace_id` `type: 'uuid'` 추가
- `integrations/entities/integration-usage-log.entity.ts` — `node_execution_id` · `workflow_id` `type: 'uuid'` 추가
- `llm/entities/llm-usage-log.entity.ts` — `workspace_id` `type: 'uuid'` 추가
- `nodes/entities/node.entity.ts` — `category` `enumName: 'node_category'` 추가
- `edges/entities/edge.entity.ts` — `type` `enumName: 'edge_type'` 추가
- `model-config/entities/model-config.entity.ts` — `kind` `default: 'chat'` 추가
- `workflow-assistant/entities/workflow-assistant-session.entity.ts` — `last_interaction_at` `default: () => 'now()'` 추가

모두 TypeORM 데코레이터 메타데이터 정정(`synchronize: false`라 DB 는 불변)이고, DB 상의 실제 타입·enum 이름·기본값은 마이그레이션(`V001` 등)이 이미 갖고 있던 사실이다.

## 대조 결과

### 1. 데이터 모델 충돌 — 없음

`spec/1-data-model.md` 의 각 해당 섹션(§2.6 Node · §2.7 Edge · §2.10.1 IntegrationUsageLog · §2.16 ModelConfig · §2.20 AssistantSession · §2.24 LlmUsageLog · §2.25 AlertRule)의 컬럼 표를 대조했다 — `workspace_id`/`node_execution_id`/`workflow_id` 는 이미 `UUID`로, `category`/`type` 은 이미 `Enum`으로 문서화돼 있다. 이번 변경은 그 문서된 사실을 TypeORM 데코레이터가 뒤늦게 따라잡은 것이라 새 모순을 만들지 않는다.

`enumName`(`node_category` · `edge_type`) 이 가리키는 PostgreSQL enum 타입 이름은 `codebase/backend/migrations/V001__initial_schema.sql` · `V003__add_trigger_category.sql` 의 실제 타입 이름과 일치한다 — 이름 충돌 없음.

`WorkspaceInvitation` 엔티티 자체는 `spec/1-data-model.md` 에 전용 컬럼 표 섹션이 없다(선행 갭, 이번 변경과 무관 — 필드 하나의 타입 정정이 없는 문서와 새로 모순될 수는 없다).

### 2. API 계약 충돌 — 없음

이번 diff 는 엔티티 컬럼 데코레이터만 바꾸고 컨트롤러·DTO·응답 shape 은 건드리지 않는다. `default: 'chat'` · `default: () => 'now()'` 는 INSERT 시 TypeORM 이 `RETURNING` 으로 값을 되읽어 오는지에만 영향(plan 자체가 실측 확인)하며, 두 컬럼 모두 서비스 계층이 생성 시 명시적으로 값을 채워 넣는 경로라 API 응답 shape 변화 없음.

### 3. 요구사항 ID 충돌 — 해당 없음

새 요구사항 ID 부여 없음.

### 4. 상태 전이 충돌 — 없음

`Integration` 상태 머신 등 도메인 상태 전이는 이번 diff 의 대상이 아니다. 앞선 1차 `--impl-prep`(10:58:34) 이 발견한 Critical — `spec/2-navigation/4-integration.md` §5.4 의 연결 테스트 코드가 소문자 `auth_failed`/`network`/`unknown_error` 로 `spec/conventions/error-codes.md` UPPER_SNAKE_CASE 를 어긴 문제 — 는 `origin/main`(`0a040b96c`, #1357)에서 이미 해소됐다: §5.4 는 현재 `DB_HOST_BLOCKED` · `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` 로 재기술돼 있고 §10.4 Rationale 도 "종전 §5.4 의 소문자 … 는 통합 상태 `statusReason`과 철자가 같은 다른 층의 값이었다"로 구분을 명문화했다. 이번 재실행 기준으로 그 Critical 은 재발하지 않는다.

### 5. 권한·RBAC 모델 충돌 — 해당 없음

이번 diff 는 권한 구조를 다루지 않는다.

### 6. 계층 책임 충돌 — 없음

엔티티(TypeORM 레이어)의 컬럼 메타데이터 정정으로, 서버/클라이언트 또는 도메인 모듈 간 책임 분할 결정과 무관하다. `entity-schema-declarations.e2e-spec.ts` 를 컬럼 층까지 넓히는 것도 같은 파일 안에서 이미 있던 "선언↔DB 대조" 책임의 자연스러운 확장이며, `spec/1-data-model.md` frontmatter `code:` 는 이 파일을 이미 가드 목록에 포함하고 있어(선행 커밋으로 병합됨) 새 파일 등록도 아니다.

## 요약

이번 재실행 대상 diff(8개 엔티티 파일의 컬럼 타입/enum 이름/기본값 데코레이터 추가)는 `spec/1-data-model.md` 가 이미 서술한 DB 사실을 TypeORM 선언에 뒤늦게 반영하는 것으로, 다른 spec 영역의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임과 새로운 모순을 만들지 않는다. 1차 `--impl-prep` 이 지적한 Cross-Spec 관련 Critical(§5.4 UPPER_SNAKE_CASE 불일치)은 이미 별도 PR(#1357, `0a040b96c`)로 해소되어 `origin/main` 에 반영됐고, 현재 브랜치 HEAD 기준 재검증에서도 해소 상태가 유지됨을 확인했다.

## 위험도

NONE
