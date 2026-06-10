# 신규 식별자 충돌 검토 결과

검토 범위: `spec/2-navigation/` (전체) + `spec/1-data-model.md` + `spec/data-flow/10-triggers.md` 변경분  
검토 모드: `--impl-prep` (구현 착수 전)

---

## 발견사항

### 1. [INFO] `ALERT_RULE_NOT_FOUND` 에러 코드 — 중앙 등록 누락

- **target 신규 식별자**: `ALERT_RULE_NOT_FOUND` (HTTP 404)
- **기존 사용처**: `spec/5-system/3-error-handling.md` 에 등록 없음. 단, 구현체(`codebase/backend/src/modules/alerts/alerts.service.ts:49,66`)에 이미 존재하므로 codebase SoT 와는 정합
- **상세**: `spec/2-navigation/9-user-profile.md` §Alerts API 표가 `PATCH /api/alerts/:id` 와 `DELETE /api/alerts/:id` 의 404 응답으로 이 코드를 처음 spec 에 도입한다. 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md`)에 등록되지 않아 다른 spec 참조자가 코드 의미를 추론하기 어렵다.
- **제안**: `DUPLICATE_NODE_LABEL` 처럼(이번 diff 에서 `3-error-handling.md` 에 함께 등록됨) `ALERT_RULE_NOT_FOUND` 도 동일 파일에 한 행 추가 — `| \`ALERT_RULE_NOT_FOUND\` | 알림 규칙 미존재 | 404 |`

---

### 2. [INFO] `EMBEDDING_PROBE_FAILED` 에러 코드 — 중앙 등록 누락

- **target 신규 식별자**: `EMBEDDING_PROBE_FAILED` (HTTP 400)
- **기존 사용처**: `spec/5-system/3-error-handling.md` 에 등록 없음. 구현체(`codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`) 및 `spec/data-flow/6-knowledge-base.md` 에 이미 존재하므로 실질적 충돌은 없음
- **상세**: `spec/2-navigation/5-knowledge-base.md` 가 `POST /api/knowledge-bases/embedding-probe` 실패 응답으로 처음 spec 문서에 명시. 에러 카탈로그 미등록.
- **제안**: `ALERT_RULE_NOT_FOUND` 와 동일하게 `spec/5-system/3-error-handling.md` 에 등록 — `| \`EMBEDDING_PROBE_FAILED\` | 임베딩 probe 실패 (sanitize 메시지) | 400 |`

---

### 3. [INFO] `id: layout` / `id: nodes-overview` — 신규 frontmatter ID, 충돌 없음

- **target 신규 식별자**: `id: layout` (`spec/2-navigation/_layout.md`), `id: nodes-overview` (`spec/4-nodes/0-overview.md`)
- **기존 사용처**: 두 ID 모두 main branch 어느 spec 에도 존재하지 않음 — 충돌 없음
- **상세**: 기존 `id: common` 은 여러 `0-common.md` 파일에 중복 존재하나 이는 이번 diff 이전부터의 사전 상태이며 target 이 새로 도입한 것이 아님
- **제안**: 이상 없음

---

### 4. [INFO] `WorkflowsController` 명칭 정정 — 기존 spec 잔존 단편과 경계

- **target 신규 식별자**: 시퀀스 다이어그램 `participant Ctl as WorkflowsController` (`spec/data-flow/10-triggers.md` §1.1)
- **기존 사용처**: `spec/4-nodes/1-logic/12-background.md:258,262` 및 `spec/data-flow/3-execution.md:97` 에서 `ExecutionsController` 라는 이름이 여전히 등장하나, 이들은 `/api/executions/:id` 라우트를 담당하는 별도의 실제 컨트롤러(`executions.controller.ts`)를 가리킴 — 명칭 자체가 다른 클래스
- **상세**: `POST /api/workflows/:id/execute` 는 `WorkflowsController`(`workflows.controller.ts`)가 처리하고, `/api/executions/:id`·`/api/executions/:id/stop` 등은 `ExecutionsController`(`executions.controller.ts`)가 처리한다. 두 컨트롤러가 실제로 분리되어 있으므로 충돌 없음. target 의 정정은 정확하다.
- **제안**: 이상 없음. 단, `spec/data-flow/3-execution.md:97` 의 `participant API as ExecutionsController / WS gateway` 다이어그램 표기는 "실행 시작(execute)" 가 아닌 "실행 조회·중단" 경로이므로 용어 혼동 가능성이 낮다.

---

### 5. [INFO] `makeshop_pending_install` 응답 mode 값 — 신규, 충돌 없음

- **target 신규 식별자**: `mode: 'makeshop_pending_install'` (`spec/2-navigation/4-integration.md` §9.2)
- **기존 사용처**: `spec/2-navigation/4-integration.md` 이외 spec 에 해당 문자열 없음. 구현체(`codebase/backend/src/modules/integrations/integration-oauth.service.ts:1715`, `codebase/frontend/src/lib/api/integrations.ts:35`)에 이미 존재하므로 구현 정합
- **상세**: `cafe24_private_pending` 모드와 대칭 구조이며 별개 flow. 이름 패턴(`<provider>_pending_install`) 상 일관성 유지.
- **제안**: 이상 없음

---

### 6. [INFO] `embedding_llm_config_id` 컬럼 — `spec/1-data-model.md` 추가, 기존 data-flow 와 정합 확인 필요

- **target 신규 식별자**: `embedding_llm_config_id` UUID? 컬럼 (`spec/1-data-model.md` §2.x KnowledgeBase 테이블, migration `V029`)
- **기존 사용처**: `spec/data-flow/6-knowledge-base.md` 에서 이미 `embedding_llm_config_id (V029)` 형태로 참조 중 — 양방향 정합. `spec/5-system/8-embedding-pipeline.md` 에는 미언급
- **상세**: data-flow 가 먼저 언급하고 data-model 이 뒤따라 등록하는 정합 순서. `spec/5-system/8-embedding-pipeline.md` 는 임베딩 파이프라인 SoT 이지만 해당 필드 언급이 없음 — 빠진 참조이나 명명 충돌은 아님
- **제안**: `spec/5-system/8-embedding-pipeline.md` 에 `embedding_llm_config_id` 언급을 추가하면 참조 완결성이 높아진다 (필수 아님)

---

## 요약

이번 diff(`spec/2-navigation/` 전체 + `spec/1-data-model.md` + `spec/data-flow/10-triggers.md`)가 도입하는 신규 식별자 중 **동일 이름이 다른 의미로 기존에 사용 중인 충돌 사례는 없다**. API endpoint, 에러 코드, 엔티티 필드, 큐 이름, 컨트롤러 명칭 모두 기존 정의와 의미 분리가 명확하다. 다만 `ALERT_RULE_NOT_FOUND` 와 `EMBEDDING_PROBE_FAILED` 두 에러 코드가 구현체와 일부 spec 에는 존재하나 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md`)에 등록되지 않은 점이 일관성 보완 사항이다. `DUPLICATE_NODE_LABEL` 은 이번 diff 에서 카탈로그에 함께 등록되어 패턴을 따랐으므로, 나머지 두 코드도 동일하게 처리하면 충분하다.

## 위험도

LOW
