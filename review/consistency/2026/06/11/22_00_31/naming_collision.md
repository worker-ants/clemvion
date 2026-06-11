# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system` (diff-base: origin/main)
검토 모드: 구현 완료 후 검토 (--impl-done)

---

## 발견사항

### 1. [WARNING] `document:graph_error` 이벤트명 — 기존 spec 과의 선언 불일치

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §6` 의 WebSocket 이벤트 표에서 `document:graph_error` 를 공식 이벤트 목록에서 제외하고 dead-declared 주석으로만 언급
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/2-navigation/5-knowledge-base.md:182` — `document:graph_started / _progress / _completed / _error / _retry / _failed` 로 `_error` 를 정규 이벤트인 것처럼 나열
  - `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/5-system/6-websocket-protocol.md:723` — 동일하게 `_error` 를 포함한 목록 형태로 기재
- **상세**: `10-graph-rag.md §6` 는 `document:graph_error` 가 타입 union 에만 dead-declared 되어 있고 실제로 emit 하지 않는다고 명시한다. 그러나 `spec/2-navigation/5-knowledge-base.md` 와 `spec/5-system/6-websocket-protocol.md` 는 이 이벤트를 `_retry` / `_failed` 와 동등한 정규 이벤트처럼 열거하여 소비자 코드 작성 시 혼선이 생긴다. 10-graph-rag.md 의 dead-declared 기록 자체는 `spec/data-flow/6-knowledge-base.md:289` 에도 `#443` 에서 제거됐다는 주석이 있어 충돌의 원인이 명확하다.
- **제안**: `spec/2-navigation/5-knowledge-base.md:182` 와 `spec/5-system/6-websocket-protocol.md:723` 에서 `_error` 를 목록에서 제거하고 `_started / _progress / _completed / _retry / _failed` 5종으로 통일한다.

---

### 2. [INFO] 계획 감사 액션 `password_change`, `2fa_enable`, `2fa_disable` — 네임스페이스 불일치 가능성

- **target 신규 식별자**: `spec/5-system/1-auth.md §4.1` Planned 액션 표의 `password_change`, `2fa_enable/disable`
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/data-flow/1-audit.md:69` 는 동일 이름을 미구현으로 나열, `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/5-system/1-auth.md:350`의 현재 구현 액션들은 모두 `auth_config.*`, `integration.*`, `workspace.*`, `execution.*` 처럼 `<resource>.<verb>` 형태를 따른다.
- **상세**: `§4.1` Action naming 규약은 `<resource>.<verb>` 를 필수로 명시한다. 그러나 Planned 섹션의 `password_change` 는 resource prefix 가 없어 규약과 불일치한다. 마찬가지로 `2fa_enable/disable` 은 `auth.2fa_enable` 또는 `user.2fa_enable` 형태여야 규약에 부합한다. 현재는 모두 미구현(Planned) 상태라 실제 충돌은 아니지만, 구현 시점에 이름이 그대로 채택될 위험이 있다.
- **제안**: Planned 목록을 `auth.password_changed`, `auth.2fa_enabled`, `auth.2fa_disabled` 등 `<resource>.<verb>` 형태로 미리 정정해 두어 구현 시 혼선을 방지한다. `workspace.create`, `member.invite` 등 동일 섹션의 다른 Planned 액션도 dot-prefix 가 있어 일관성 목적에도 부합한다.

---

### 3. [INFO] `document:graph_error` dead-declaration 유지 — websocket union 불필요 항목

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §6` 의 `document:graph_error` dead-declared 주석
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/data-flow/6-knowledge-base.md:289` 와 `:416` 이 이 이벤트를 이미 제거됐다고 기록
- **상세**: 제거 결정이 data-flow 와 graph-rag 본문에는 기록됐으나, nav spec 과 websocket-protocol 에는 반영이 누락됐다(위 WARNING 1 과 연동). 독립적인 INFO 사항으로, dead-declared 이벤트 자체를 spec union 표에서 삭제하거나 strikethrough 로 표기하면 혼동을 막을 수 있다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.3` 표의 이벤트 목록에서 `_error` 를 삭제하거나 `~~_error~~` (deprecated/removed) 로 명시한다.

---

## 요약

`spec/5-system` 이 도입하는 신규 식별자(요구사항 ID, 엔티티명, API endpoint, 환경변수, 이벤트명 등) 대부분은 기존 사용처와 충돌하지 않는다. 요구사항 ID `KB-GR-*` / `NF-GR-*` 는 타 spec 에서 사용되지 않으며, `WEBAUTHN_*` 환경변수·에러코드, `KB_REEXTRACT_IN_PROGRESS`, `GraphTraversalSummary` 등도 단일 정의 위치를 유지한다. 다만 `document:graph_error` WebSocket 이벤트가 `10-graph-rag.md` 에서 dead-declared 로 처리됐음에도 `spec/2-navigation/5-knowledge-base.md` 와 `spec/5-system/6-websocket-protocol.md` 두 곳에 정규 이벤트인 것처럼 남아 있어 소비자 혼선 가능성이 있다(WARNING). `password_change` 등 Planned 감사 액션이 `<resource>.<verb>` 네이밍 규약과 불일치하는 것은 미구현 상태의 선제 명확화 수준 이슈다(INFO).

## 위험도

LOW
